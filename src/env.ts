import { readFileSync } from "node:fs";
import type { ProviderEnv } from "@earendil-works/pi-ai";

let bunSandboxEnvCache: Map<string, string> | null = null;
let scopedEnvQueue: Promise<void> = Promise.resolve();

/**
 * Mirrors pi-ai provider env lookup so custom providers can respect provider-scoped
 * environment overrides and Bun sandbox fallbacks.
 */
export function getProviderEnvValue(name: string, env?: ProviderEnv): string | undefined {
  return env?.[name] || process.env[name] || getBunSandboxEnvValue(name) || undefined;
}

/**
 * Temporarily overlays process.env so AWS SDK credential resolution can honor
 * provider-scoped environment overrides during token generation.
 *
 * This intentionally bridges Pi's scoped provider env semantics into the AWS SDK,
 * which still resolves credentials from process-global environment state.
 * Calls are serialized because process.env is process-global; do not remove the
 * queue unless token generation is rewritten to avoid ambient env lookup.
 */
export async function withScopedProcessEnv<T>(
  env: ProviderEnv | undefined,
  fn: () => Promise<T>
): Promise<T> {
  if (!env || Object.keys(env).length === 0) {
    return fn();
  }

  let releaseQueue!: () => void;
  const previousQueue = scopedEnvQueue;
  scopedEnvQueue = new Promise<void>((resolve) => {
    releaseQueue = resolve;
  });

  await previousQueue;

  const originalValues = new Map<string, string | undefined>();
  try {
    for (const [key, value] of Object.entries(env)) {
      originalValues.set(key, process.env[key]);
      process.env[key] = value;
    }
    return await fn();
  } finally {
    for (const [key, value] of originalValues) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    releaseQueue();
  }
}

function getBunSandboxEnvValue(name: string): string | undefined {
  if (typeof process === "undefined" || !process.versions?.bun || Object.keys(process.env).length > 0) {
    return undefined;
  }

  if (bunSandboxEnvCache === null) {
    bunSandboxEnvCache = new Map<string, string>();
    try {
      const data = readFileSync("/proc/self/environ", "utf-8");
      for (const entry of data.split("\0")) {
        const separatorIndex = entry.indexOf("=");
        if (separatorIndex > 0) {
          bunSandboxEnvCache.set(entry.slice(0, separatorIndex), entry.slice(separatorIndex + 1));
        }
      }
    } catch {
      // /proc/self/environ may not exist or may not be readable.
    }
  }

  return bunSandboxEnvCache.get(name);
}
