import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { MODELS } from "./src/models.js";
import { streamBedrockMantle } from "./src/stream.js";

export default function (pi: ExtensionAPI) {
  pi.registerProvider("bedrock-mantle-openai", {
    name: "Bedrock Mantle (OpenAI)",
    baseUrl: "https://bedrock-mantle.us-east-1.api.aws/openai/v1",
    api: "openai-responses",
    apiKey: "bedrock-mantle",
    models: MODELS.map((m) => ({
      ...m,
      provider: "bedrock-mantle-openai",
      api: "openai-responses" as const,
      baseUrl: "https://bedrock-mantle.us-east-1.api.aws/openai/v1",
    })),
    streamSimple: streamBedrockMantle,
  });
}
