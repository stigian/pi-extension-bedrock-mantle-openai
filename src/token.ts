import { createHash } from "node:crypto";
import { getTokenProvider } from "@aws/bedrock-token-generator";
import type { ProviderEnv } from "@earendil-works/pi-ai";
import { AWS_SCOPED_PROCESS_ENV_KEYS, getProviderEnvValue, withScopedProcessEnv } from "./env.js";
import { createBearerTokenFailureMessage } from "./errors.js";

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
    throw new Error(createBearerTokenFailureMessage(region, error));
  }
}

/**
 * Clears cached token providers (useful for testing).
 */
export function clearTokenProviderCache(): void {
  tokenProviderCache.clear();
}

function getTokenProviderCacheKey(region: string, env?: ProviderEnv): string {
  const fingerprint = createHash("sha256");
  let hasScopedAuthInput = false;

  for (const key of AWS_SCOPED_PROCESS_ENV_KEYS) {
    const value = getProviderEnvValue(key, env);
    if (!value) {
      continue;
    }

    hasScopedAuthInput = true;
    fingerprint.update(key);
    fingerprint.update("\0");
    fingerprint.update(value);
    fingerprint.update("\0");
  }

  if (!hasScopedAuthInput) {
    return region;
  }

  return `${region}\nsha256=${fingerprint.digest("hex")}`;
}
