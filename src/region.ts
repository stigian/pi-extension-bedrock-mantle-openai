import type { ProviderEnv } from "@earendil-works/pi-ai";
import { getProviderEnvValue } from "./env.js";

export const DEFAULT_MANTLE_REGION = "us-east-1";
export const DEFAULT_MANTLE_BASE_URL = `https://bedrock-mantle.${DEFAULT_MANTLE_REGION}.api.aws/openai/v1`;

export interface MantleTarget {
  region: string;
  baseUrl: string;
}

/**
 * Resolves the explicitly configured AWS region according to Pi's provider-env precedence.
 */
export function getConfiguredRegion(
  configuredRegion?: string,
  env?: ProviderEnv
): string | undefined {
  if (configuredRegion && configuredRegion.trim().length > 0) {
    return configuredRegion.trim();
  }

  const envRegion = getProviderEnvValue("AWS_REGION", env)?.trim();
  if (envRegion) {
    return envRegion;
  }

  const envDefaultRegion = getProviderEnvValue("AWS_DEFAULT_REGION", env)?.trim();
  if (envDefaultRegion) {
    return envDefaultRegion;
  }

  return undefined;
}

/**
 * Resolve the effective Mantle region and endpoint.
 *
 * Standard Mantle endpoints follow Pi's built-in Bedrock pattern:
 * explicit region/env overrides win, otherwise the region is inferred from the
 * model base URL. Custom endpoints are preserved as-is and require an explicit
 * region when the hostname does not encode one.
 */
export function resolveMantleTarget(
  modelBaseUrl: string | undefined,
  configuredRegion?: string,
  env?: ProviderEnv
): MantleTarget {
  const normalizedBaseUrl = normalizeBaseUrl(modelBaseUrl);
  const explicitRegion = getConfiguredRegion(configuredRegion, env);
  const endpointRegion = getStandardMantleEndpointRegion(normalizedBaseUrl);

  if (!isStandardMantleEndpoint(normalizedBaseUrl)) {
    if (!explicitRegion) {
      throw new Error(
        "AWS region could not be resolved. Set AWS_REGION or AWS_DEFAULT_REGION, including provider-scoped env overrides, when using a custom Bedrock Mantle baseUrl."
      );
    }

    return {
      region: explicitRegion,
      baseUrl: normalizedBaseUrl,
    };
  }

  const resolvedRegion = explicitRegion || endpointRegion || DEFAULT_MANTLE_REGION;
  return {
    region: resolvedRegion,
    baseUrl: getMantleBaseUrl(resolvedRegion),
  };
}

/**
 * Resolves the effective AWS region for Bedrock Mantle token generation.
 */
export function resolveRegion(
  modelBaseUrl?: string,
  configuredRegion?: string,
  env?: ProviderEnv
): string {
  return resolveMantleTarget(modelBaseUrl, configuredRegion, env).region;
}

/**
 * Constructs the standard Bedrock Mantle base URL for a given region.
 */
export function getMantleBaseUrl(region: string): string {
  return `https://bedrock-mantle.${region}.api.aws/openai/v1`;
}

export function getStandardMantleEndpointRegion(baseUrl?: string): string | undefined {
  if (!baseUrl) {
    return undefined;
  }

  try {
    const { hostname } = new URL(baseUrl);
    const match = hostname.toLowerCase().match(/^bedrock-mantle\.([a-z0-9-]+)\.api\.aws$/);
    return match?.[1];
  } catch {
    return undefined;
  }
}

export function isStandardMantleEndpoint(baseUrl?: string): boolean {
  return getStandardMantleEndpointRegion(baseUrl) !== undefined;
}

function normalizeBaseUrl(baseUrl?: string): string {
  return typeof baseUrl === "string" && baseUrl.trim().length > 0
    ? baseUrl.trim()
    : DEFAULT_MANTLE_BASE_URL;
}
