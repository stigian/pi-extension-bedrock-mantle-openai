import assert from "node:assert";
import test, { describe } from "node:test";
import { CredentialsProviderError, ProviderError, TokenProviderError } from "@smithy/core/config";
import type { Model } from "@earendil-works/pi-ai";
import { APIConnectionError, AuthenticationError, NotFoundError, PermissionDeniedError } from "openai/error";
import { withScopedProcessEnv } from "../src/env.js";
import {
  createBearerTokenFailureMessage,
  sanitizeBedrockMantleError,
  sanitizeBedrockMantleErrorText,
} from "../src/errors.js";
import { MODELS } from "../src/models.js";
import {
  DEFAULT_MANTLE_BASE_URL,
  getConfiguredRegion,
  getMantleBaseUrl,
  getStandardMantleEndpointRegion,
  isStandardMantleEndpoint,
  resolveMantleTarget,
  resolveRegion,
} from "../src/region.js";
import { streamBedrockMantle } from "../src/stream.js";
import { clearTokenProviderCache, getBearerTokenProvider } from "../src/token.js";

describe("Bedrock Mantle OpenAI Extension Verification", () => {
  test("catalog models and thinkingLevelMap", () => {
    assert.strictEqual(MODELS.length, 5);
    const gpt54 = MODELS.find((model) => model.id === "openai.gpt-5.4");
    assert.ok(gpt54, "GPT-5.4 model exists in catalog");
    assert.strictEqual(gpt54.contextWindow, 272000);
    assert.deepStrictEqual(gpt54.thinkingLevelMap, {
      off: "none",
      minimal: null,
      low: "low",
      medium: "medium",
      high: "high",
      xhigh: "xhigh",
      max: null,
    });

    const sol = MODELS.find((model) => model.id === "openai.gpt-5.6-sol");
    assert.ok(sol, "GPT-5.6 Sol model exists in catalog");
    assert.strictEqual(sol.contextWindow, 1000000);
    assert.strictEqual(sol.thinkingLevelMap.max, "max");
  });

  test("configured region honors explicit input, provider env, and process env precedence", async () => {
    assert.strictEqual(getConfiguredRegion("us-gov-west-1"), "us-gov-west-1");
    assert.strictEqual(getConfiguredRegion(undefined, { AWS_REGION: "eu-central-1" }), "eu-central-1");
    assert.strictEqual(getConfiguredRegion(undefined, { AWS_DEFAULT_REGION: "ap-southeast-2" }), "ap-southeast-2");

    await withEnv(
      {
        AWS_REGION: "us-east-1",
        AWS_DEFAULT_REGION: undefined,
      },
      async () => {
        assert.strictEqual(getConfiguredRegion(), "us-east-1");
      }
    );

    await withEnv(
      {
        AWS_REGION: undefined,
        AWS_DEFAULT_REGION: "us-west-2",
      },
      async () => {
        assert.strictEqual(getConfiguredRegion(), "us-west-2");
      }
    );
  });

  test("Mantle base URL formatting and endpoint detection support standard endpoints", () => {
    const govUrl = getMantleBaseUrl("us-gov-west-1");
    assert.strictEqual(govUrl, "https://bedrock-mantle.us-gov-west-1.api.aws/openai/v1");
    assert.strictEqual(getMantleBaseUrl("us-east-1"), DEFAULT_MANTLE_BASE_URL);
    assert.strictEqual(getStandardMantleEndpointRegion(govUrl), "us-gov-west-1");
    assert.strictEqual(getStandardMantleEndpointRegion("https://proxy.internal/v1"), undefined);
    assert.strictEqual(isStandardMantleEndpoint(govUrl), true);
    assert.strictEqual(isStandardMantleEndpoint("https://proxy.internal/v1"), false);
  });

  test("target resolution prefers env region over standard catalog endpoint", () => {
    const target = resolveMantleTarget(DEFAULT_MANTLE_BASE_URL, undefined, {
      AWS_REGION: "us-gov-west-1",
    });

    assert.deepStrictEqual(target, {
      region: "us-gov-west-1",
      baseUrl: "https://bedrock-mantle.us-gov-west-1.api.aws/openai/v1",
    });
  });

  test("target resolution infers region from standard explicit baseUrl when env is absent", () => {
    const target = resolveMantleTarget("https://bedrock-mantle.us-gov-west-1.api.aws/openai/v1");

    assert.deepStrictEqual(target, {
      region: "us-gov-west-1",
      baseUrl: "https://bedrock-mantle.us-gov-west-1.api.aws/openai/v1",
    });
    assert.strictEqual(
      resolveRegion("https://bedrock-mantle.us-gov-west-1.api.aws/openai/v1"),
      "us-gov-west-1"
    );
  });

  test("custom explicit endpoints are preserved and require env region", async () => {
    const customBaseUrl = "https://custom-proxy.internal/openai/v1";

    assert.deepStrictEqual(resolveMantleTarget(customBaseUrl, undefined, { AWS_REGION: "us-west-2" }), {
      region: "us-west-2",
      baseUrl: customBaseUrl,
    });

    await withEnv(
      {
        AWS_REGION: undefined,
        AWS_DEFAULT_REGION: undefined,
      },
      async () => {
        assert.throws(
          () => resolveMantleTarget(customBaseUrl),
          /Set AWS_REGION or AWS_DEFAULT_REGION, including provider-scoped env overrides, when using a custom Bedrock Mantle baseUrl/
        );
      }
    );
  });

  test("bearer token provider memoization includes scoped AWS auth inputs", () => {
    clearTokenProviderCache();
    const provider1 = getBearerTokenProvider("us-gov-west-1", { AWS_PROFILE: "gov" });
    const provider2 = getBearerTokenProvider("us-gov-west-1", { AWS_PROFILE: "gov" });
    assert.strictEqual(provider1, provider2, "Provider function is memoized per region/env tuple");

    const providerOtherProfile = getBearerTokenProvider("us-gov-west-1", { AWS_PROFILE: "commercial" });
    assert.notStrictEqual(provider1, providerOtherProfile, "Different scoped auth env gets a different provider instance");

    const directCredsProvider1 = getBearerTokenProvider("us-gov-west-1", {
      AWS_ACCESS_KEY_ID: "AKIAEXAMPLE1",
      AWS_SECRET_ACCESS_KEY: "secret-a",
      AWS_SESSION_TOKEN: "session-a",
    });
    const directCredsProvider2 = getBearerTokenProvider("us-gov-west-1", {
      AWS_ACCESS_KEY_ID: "AKIAEXAMPLE1",
      AWS_SECRET_ACCESS_KEY: "secret-a",
      AWS_SESSION_TOKEN: "session-a",
    });
    assert.strictEqual(
      directCredsProvider1,
      directCredsProvider2,
      "Identical direct credential tuples reuse the same provider instance"
    );

    const rotatedSecretProvider = getBearerTokenProvider("us-gov-west-1", {
      AWS_ACCESS_KEY_ID: "AKIAEXAMPLE1",
      AWS_SECRET_ACCESS_KEY: "secret-b",
      AWS_SESSION_TOKEN: "session-a",
    });
    assert.notStrictEqual(
      directCredsProvider1,
      rotatedSecretProvider,
      "Changing scoped credentials yields a different provider instance"
    );
  });

  test("scoped process env only overlays AWS credential-resolution keys", async () => {
    await withEnv(
      {
        AWS_PROFILE: undefined,
        AWS_CONTAINER_AUTHORIZATION_TOKEN: undefined,
        CUSTOM_SECRET: undefined,
      },
      async () => {
        await withScopedProcessEnv(
          {
            AWS_PROFILE: "gov-profile",
            AWS_CONTAINER_AUTHORIZATION_TOKEN: "opaque-token",
            CUSTOM_SECRET: "should-not-leak",
          },
          async () => {
            assert.strictEqual(process.env.AWS_PROFILE, "gov-profile");
            assert.strictEqual(process.env.AWS_CONTAINER_AUTHORIZATION_TOKEN, "opaque-token");
            assert.strictEqual(process.env.CUSTOM_SECRET, undefined);
          }
        );

        assert.strictEqual(process.env.AWS_PROFILE, undefined);
        assert.strictEqual(process.env.AWS_CONTAINER_AUTHORIZATION_TOKEN, undefined);
        assert.strictEqual(process.env.CUSTOM_SECRET, undefined);
      }
    );
  });

  test("bearer token failures are classified from Smithy error types", () => {
    const credentialsError = new CredentialsProviderError("Not found in ENV: AWS_ACCESS_KEY_ID", {
      tryNextLink: false,
    });
    const credentialsMessage = createBearerTokenFailureMessage("us-gov-west-1", credentialsError);
    assert.match(credentialsMessage, /No usable AWS credentials were resolved/);

    const providerError = Object.assign(
      new ProviderError("Error response received from instance metadata service", { tryNextLink: false }),
      { statusCode: 401 }
    );
    const providerMessage = createBearerTokenFailureMessage("us-gov-west-1", providerError);
    assert.match(providerMessage, /credential provider request failed with status 401/);

    const tokenProviderError = new TokenProviderError("Token provider failed", { tryNextLink: false });
    const tokenMessage = createBearerTokenFailureMessage("us-gov-west-1", tokenProviderError);
    assert.match(tokenMessage, /AWS token generation failed before the Bedrock request was sent/);
  });

  test("raw OpenAI-compatible SDK errors are sanitized from structured fields", () => {
    const target = {
      region: "us-gov-west-1",
      baseUrl: "https://bedrock-mantle.us-gov-west-1.api.aws/openai/v1",
    };

    const unauthorized = sanitizeBedrockMantleError(
      new AuthenticationError(
        401,
        {
          code: "invalid_api_key",
          message: "The security token included in the request is invalid.",
          type: "permission_denied_error",
          param: null,
        },
        undefined,
        new Headers()
      ),
      target
    );
    assert.match(unauthorized, /401 Unauthorized/);
    assert.match(unauthorized, /AWS\/Bedrock authentication failed/);
    assert.match(unauthorized, /Upstream error code: invalid_api_key \(permission_denied_error\)/);

    const forbidden = sanitizeBedrockMantleError(
      new PermissionDeniedError(
        403,
        {
          code: "access_denied",
          message: "Access denied",
          type: "permission_denied_error",
          param: null,
        },
        undefined,
        new Headers()
      ),
      target
    );
    assert.match(forbidden, /403 Forbidden/);
    assert.match(forbidden, /IAM permissions/);

    const missing = sanitizeBedrockMantleError(
      new NotFoundError(
        404,
        {
          code: "model_not_found",
          message: "Model not found",
          type: "not_found_error",
          param: null,
        },
        undefined,
        new Headers()
      ),
      target
    );
    assert.match(missing, /404 Not Found/);
    assert.match(missing, /selected model is available in this region/);

    const connection = sanitizeBedrockMantleError(new APIConnectionError({}), target);
    assert.match(connection, /Connection error while calling Bedrock Mantle endpoint/);
    assert.match(connection, /proxy configuration/);
  });

  test("formatted OpenAI API error strings are parsed from defined response bodies", () => {
    const target = {
      region: "us-gov-west-1",
      baseUrl: "https://bedrock-mantle.us-gov-west-1.api.aws/openai/v1",
    };

    const unauthorized = sanitizeBedrockMantleErrorText(
      'OpenAI API error (401): {"code":"invalid_api_key","message":"The security token included in the request is invalid.","param":null,"type":"permission_denied_error"}',
      target
    );
    assert.match(unauthorized, /401 Unauthorized/);
    assert.match(unauthorized, /AWS\/Bedrock authentication failed/);
    assert.match(unauthorized, /Upstream error code: invalid_api_key \(permission_denied_error\)/);

    const connection = sanitizeBedrockMantleErrorText("Connection error.", target);
    assert.match(connection, /Connection error while calling Bedrock Mantle endpoint/);
    assert.match(connection, /proxy configuration/);

    const redacted = sanitizeBedrockMantleErrorText(
      "Credential debug AWS_SECRET_ACCESS_KEY=topsecret Authorization: Bearer abc123"
    );
    assert.doesNotMatch(redacted, /topsecret/);
    assert.doesNotMatch(redacted, /abc123/);
    assert.match(redacted, /\[redacted\]/);
  });

  test("pre-execution diagnostic error event stream is emitted when custom endpoint has no region source", async () => {
    await withEnv(
      {
        AWS_REGION: undefined,
        AWS_DEFAULT_REGION: undefined,
      },
      async () => {
        const stream = streamBedrockMantle(
          createTestModel(MODELS[0]!, "https://custom-proxy.internal/openai/v1"),
          { messages: [] }
        );
        const events: Array<{ type: string; error?: { errorMessage?: string } }> = [];

        for await (const event of stream) {
          events.push(event);
        }

        assert.ok(events.length >= 2, "Stream received start and error events");
        const errorEvent = events.find((event) => event.type === "error");
        assert.ok(errorEvent, "Error event emitted");
        assert.match(
          errorEvent.error?.errorMessage ?? "",
          /Set AWS_REGION or AWS_DEFAULT_REGION, including provider-scoped env overrides, when using a custom Bedrock Mantle baseUrl/
        );
      }
    );
  });
});

async function withEnv(
  overrides: Record<string, string | undefined>,
  run: () => Promise<void>
): Promise<void> {
  const originalValues = new Map<string, string | undefined>();

  for (const [name, value] of Object.entries(overrides)) {
    originalValues.set(name, process.env[name]);
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }

  try {
    await run();
  } finally {
    for (const [name, value] of originalValues) {
      restoreEnvVar(name, value);
    }
  }
}

function createTestModel(
  base = MODELS[0]!,
  baseUrl = DEFAULT_MANTLE_BASE_URL
): Model<"openai-responses"> {
  return {
    ...base,
    api: "openai-responses",
    provider: "bedrock-mantle-openai",
    baseUrl,
  };
}

function restoreEnvVar(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
