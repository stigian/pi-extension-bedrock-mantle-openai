import { getTokenProvider } from "@aws/bedrock-token-generator";
import type { ProviderEnv } from "@earendil-works/pi-ai";
import { getProviderEnvValue, withScopedProcessEnv } from "./env.js";

const TOKEN_PROVIDER_ENV_KEYS = [
  "AWS_PROFILE",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "AWS_WEB_IDENTITY_TOKEN_FILE",
  "AWS_ROLE_ARN",
  "AWS_ROLE_SESSION_NAME",
  "AWS_CONTAINER_CREDENTIALS_RELATIVE_URI",
  "AWS_CONTAINER_CREDENTIALS_FULL_URI",
  "AWS_SHARED_CREDENTIALS_FILE",
  "AWS_CONFIG_FILE",
  "AWS_SDK_LOAD_CONFIG",
] as const;

const tokenProviderCache = new Map<string, () => Promise<string>>();

/**
 * Returns a memoized token provider function for the specified AWS region and
 * effective AWS auth environment.
 */
export function getBearerTokenProvider(region: string, env?: ProviderEnv): () => Promise<string> {
  const cacheKey = getTokenProviderCacheKey(region, env);
  let provider = tokenProviderCache.get(cacheKey);

  if (!provider) {
    const profile = getProviderEnvValue("AWS_PROFILE", env)?.trim();
    provider = getTokenProvider({
      region,
      ...(profile ? { profile } : {}),
    });
    tokenProviderCache.set(cacheKey, provider);
  }

  return provider;
}

/**
 * Retrieves a short-term Bedrock bearer token for the specified AWS region.
 * Supports provider-scoped AWS env overrides during credential resolution.
 */
export async function getBearerToken(region: string, env?: ProviderEnv): Promise<string> {
  try {
    const provider = getBearerTokenProvider(region, env);
    const token = await withScopedProcessEnv(env, () => provider());
    if (!token) {
      throw new Error("Token generator returned an empty token");
    }
    return token;
  } catch (error) {
    const origMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to generate Bedrock bearer token for region '${region}': ${origMessage}. ` +
      `Please ensure valid AWS credentials (via provider-scoped env, AWS environment variables, AWS profile, IAM role, or SSO) ` +
      `with permissions for Bedrock Mantle in region '${region}'.`
    );
  }
}

/**
 * Clears cached token providers (useful for testing).
 */
export function clearTokenProviderCache(): void {
  tokenProviderCache.clear();
}

function getTokenProviderCacheKey(region: string, env?: ProviderEnv): string {
  const parts = [region];
  for (const key of TOKEN_PROVIDER_ENV_KEYS) {
    const value = getProviderEnvValue(key, env);
    if (value) {
      parts.push(`${key}=${value}`);
    }
  }
  return parts.join("\n");
}
