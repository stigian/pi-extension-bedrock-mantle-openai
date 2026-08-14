/**
 * Resolves the AWS region according to the precedence chain:
 * 1. Explicit provider setting (passed from settings/config)
 * 2. AWS_REGION environment variable
 * 3. AWS_DEFAULT_REGION environment variable
 *
 * Throws a diagnostic error if no region can be resolved.
 */
export function resolveRegion(configuredRegion?: string): string {
  if (configuredRegion && configuredRegion.trim().length > 0) {
    return configuredRegion.trim();
  }

  const envRegion = process.env.AWS_REGION?.trim();
  if (envRegion && envRegion.length > 0) {
    return envRegion;
  }

  const envDefaultRegion = process.env.AWS_DEFAULT_REGION?.trim();
  if (envDefaultRegion && envDefaultRegion.length > 0) {
    return envDefaultRegion;
  }

  throw new Error(
    "AWS region could not be resolved. Please set AWS_REGION or AWS_DEFAULT_REGION environment variable, or configure 'region' in Pi settings under 'bedrock-mantle-openai'."
  );
}

/**
 * Constructs the Bedrock Mantle base URL for a given region unless an explicit override is provided.
 */
export function getMantleBaseUrl(region: string, baseUrlOverride?: string): string {
  if (baseUrlOverride && baseUrlOverride.trim().length > 0) {
    return baseUrlOverride.trim();
  }
  return `https://bedrock-mantle.${region}.api.aws/openai/v1`;
}
