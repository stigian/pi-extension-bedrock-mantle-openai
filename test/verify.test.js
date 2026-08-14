import assert from "node:assert";
import test, { describe } from "node:test";
import { resolveRegion, getMantleBaseUrl } from "../src/region.js";
import { getBearerTokenProvider, clearTokenProviderCache } from "../src/token.js";
import { resolveProviderConfig, loadConfigFile } from "../src/config.js";
import { MODELS } from "../src/models.js";
import { streamBedrockMantle } from "../src/stream.js";

describe("Bedrock Mantle OpenAI Extension Verification", () => {
  test("TASK-002 & TASK-008: Catalog models and thinkingLevelMap", () => {
    assert.strictEqual(MODELS.length, 5);
    const gpt54 = MODELS.find((m) => m.id === "openai.gpt-5.4");
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

    const sol = MODELS.find((m) => m.id === "openai.gpt-5.6-sol");
    assert.ok(sol, "GPT-5.6 Sol model exists in catalog");
    assert.strictEqual(sol.contextWindow, 1000000);
    assert.strictEqual(sol.thinkingLevelMap.max, "max");
  });

  test("TASK-004: Region resolution and precedence", () => {
    // Explicit override
    assert.strictEqual(resolveRegion("us-gov-west-1"), "us-gov-west-1");

    // Env var fallback
    const origRegion = process.env.AWS_REGION;
    const origDefaultRegion = process.env.AWS_DEFAULT_REGION;

    process.env.AWS_REGION = "us-east-1";
    delete process.env.AWS_DEFAULT_REGION;
    assert.strictEqual(resolveRegion(), "us-east-1");

    delete process.env.AWS_REGION;
    process.env.AWS_DEFAULT_REGION = "us-west-2";
    assert.strictEqual(resolveRegion(), "us-west-2");

    // Error when no region is available
    delete process.env.AWS_REGION;
    delete process.env.AWS_DEFAULT_REGION;
    assert.throws(() => resolveRegion(), /AWS region could not be resolved/);

    // Restore env
    if (origRegion) process.env.AWS_REGION = origRegion;
    if (origDefaultRegion) process.env.AWS_DEFAULT_REGION = origDefaultRegion;
  });

  test("TASK-004 & TASK-013: Mantle Base URL formatting for GovCloud and commercial", () => {
    assert.strictEqual(
      getMantleBaseUrl("us-gov-west-1"),
      "https://bedrock-mantle.us-gov-west-1.api.aws/openai/v1"
    );
    assert.strictEqual(
      getMantleBaseUrl("us-east-1"),
      "https://bedrock-mantle.us-east-1.api.aws/openai/v1"
    );
    assert.strictEqual(
      getMantleBaseUrl("us-east-1", "https://custom-proxy.internal/v1"),
      "https://custom-proxy.internal/v1"
    );
  });

  test("TASK-005 & TASK-014: Bearer token provider memoization", () => {
    clearTokenProviderCache();
    const provider1 = getBearerTokenProvider("us-gov-west-1");
    const provider2 = getBearerTokenProvider("us-gov-west-1");
    assert.strictEqual(provider1, provider2, "Provider function is memoized per region");

    const providerOther = getBearerTokenProvider("us-east-1");
    assert.notStrictEqual(provider1, providerOther, "Different regions get different provider instances");
  });

  test("TASK-012 & TASK-015: Storage default and configuration resolution", () => {
    const configDefault = resolveProviderConfig();
    assert.strictEqual(configDefault.store, undefined, "Store is undefined/false by default");

    const configEnabled = resolveProviderConfig(undefined, { store: true });
    assert.strictEqual(configEnabled.store, true, "Store can be explicitly enabled");
  });

  test("TASK-007 & TASK-011: Pre-execution diagnostic error event stream", async () => {
    const origRegion = process.env.AWS_REGION;
    const origDefaultRegion = process.env.AWS_DEFAULT_REGION;
    delete process.env.AWS_REGION;
    delete process.env.AWS_DEFAULT_REGION;

    const dummyModel = {
      id: "openai.gpt-5.4",
      name: "GPT-5.4",
      api: "openai-responses",
      provider: "bedrock-mantle-openai",
      baseUrl: "https://bedrock-mantle.us-gov-west-1.api.aws/openai/v1",
      reasoning: true,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 272000,
      maxTokens: 128000,
    };

    const stream = streamBedrockMantle(dummyModel, { messages: [] });
    const events = [];

    for await (const event of stream) {
      events.push(event);
    }

    assert.ok(events.length >= 2, "Stream received start and error events");
    const errorEvent = events.find((e) => e.type === "error");
    assert.ok(errorEvent, "Error event emitted");
    assert.match(errorEvent.error.errorMessage, /AWS region could not be resolved/);

    // Restore env
    if (origRegion) process.env.AWS_REGION = origRegion;
    if (origDefaultRegion) process.env.AWS_DEFAULT_REGION = origDefaultRegion;
  });
});
