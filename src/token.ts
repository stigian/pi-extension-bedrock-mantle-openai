import { getTokenProvider } from "@aws/bedrock-token-generator";

const tokenProviderCache = new Map<string, () => Promise<string>>();

/**
 * Returns a memoized token provider function for the specified AWS region.
 * The underlying getTokenProvider manages caching and token refresh internally.
 */
export function getBearerTokenProvider(region: string): () => Promise<string> {
  let provider = tokenProviderCache.get(region);
  if (!provider) {
    provider = getTokenProvider({ region });
    tokenProviderCache.set(region, provider);
  }
  return provider;
}

/**
 * Retrieves a short-term Bedrock bearer token for the specified AWS region.
 * Catches credential or token generation errors and wraps them with diagnostic guidance.
 */
export async function getBearerToken(region: string): Promise<string> {
  try {
    const provider = getBearerTokenProvider(region);
    const token = await provider();
    if (!token) {
      throw new Error("Token generator returned an empty token");
    }
    return token;
  } catch (error) {
    const origMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to generate Bedrock bearer token for region '${region}': ${origMessage}. ` +
      `Please ensure valid AWS credentials (via AWS environment variables, AWS profile, IAM role, or SSO) ` +
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
