import type { Api, Context, Model, SimpleStreamOptions } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { MODELS } from "./src/models.js";
import { DEFAULT_MANTLE_BASE_URL } from "./src/region.js";
import { streamBedrockMantle } from "./src/stream.js";

/**
 * Pi's provider registration surface accepts any Model<Api>, but this extension
 * only supports the OpenAI Responses API. Guard at the framework boundary, then
 * hand the narrowed model to the provider-specific implementation.
 */
function streamProviderModel(
  model: Model<Api>,
  context: Context,
  options?: SimpleStreamOptions
) {
  if (model.api !== "openai-responses") {
    throw new Error(`Unsupported API for bedrock-mantle-openai: ${model.api}`);
  }

  return streamBedrockMantle(model as Model<"openai-responses">, context, options);
}

export default function (pi: ExtensionAPI) {
  pi.registerProvider("bedrock-mantle-openai", {
    name: "Bedrock Mantle (OpenAI)",
    baseUrl: DEFAULT_MANTLE_BASE_URL,
    api: "openai-responses",
    apiKey: "bedrock-mantle",
    models: MODELS.map((m) => ({
      ...m,
      provider: "bedrock-mantle-openai",
      api: "openai-responses" as const,
      baseUrl: DEFAULT_MANTLE_BASE_URL,
    })),
    streamSimple: streamProviderModel,
  });
}
