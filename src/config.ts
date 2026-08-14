import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface BedrockMantleConfig {
  region?: string;
  baseUrl?: string;
  store?: boolean;
}

/**
 * Reads provider settings from local or global Pi configuration files (settings.json / models.json).
 */
export function loadConfigFile(): BedrockMantleConfig {
  const homeDir = os.homedir();
  const candidatePaths = [
    path.join(process.cwd(), ".pi", "settings.json"),
    path.join(process.cwd(), ".pi", "models.json"),
    path.join(homeDir, ".pi", "agent", "settings.json"),
    path.join(homeDir, ".pi", "agent", "models.json"),
  ];

  for (const configPath of candidatePaths) {
    try {
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, "utf-8");
        const parsed = JSON.parse(content);
        
        const providerConfig =
          parsed["bedrock-mantle-openai"] ||
          parsed.providers?.["bedrock-mantle-openai"];

        if (providerConfig && typeof providerConfig === "object") {
          const res: BedrockMantleConfig = {};
          if (typeof providerConfig.region === "string" && providerConfig.region.trim()) {
            res.region = providerConfig.region.trim();
          }
          if (typeof providerConfig.baseUrl === "string" && providerConfig.baseUrl.trim()) {
            res.baseUrl = providerConfig.baseUrl.trim();
          }
          if (typeof providerConfig.store === "boolean") {
            res.store = providerConfig.store;
          }
          return res;
        }
      }
    } catch {
      // Ignore invalid JSON or unreadable config files
    }
  }

  return {};
}

/**
 * Resolves effective provider configuration by combining settings files, model parameters, and runtime options.
 */
export function resolveProviderConfig(
  modelBaseUrl?: string,
  options?: Record<string, unknown>
): BedrockMantleConfig {
  const fileConfig = loadConfigFile();
  const res: BedrockMantleConfig = { ...fileConfig };

  if (modelBaseUrl && modelBaseUrl.length > 0 && !modelBaseUrl.includes("us-east-1")) {
    // If model has a custom baseUrl set (not the default us-east-1 placeholder)
    res.baseUrl = modelBaseUrl;
  }

  if (options) {
    if (typeof options.region === "string" && options.region.trim().length > 0) {
      res.region = options.region.trim();
    }
    if (typeof options.baseUrl === "string" && options.baseUrl.trim().length > 0) {
      res.baseUrl = options.baseUrl.trim();
    }
    if (typeof options.store === "boolean") {
      res.store = options.store;
    }
  }

  return res;
}
