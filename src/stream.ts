import {
  createAssistantMessageEventStream,
  type AssistantMessage,
  type AssistantMessageEventStream,
  type Context,
  type Model,
  type SimpleStreamOptions,
} from "@earendil-works/pi-ai";
import { openAIResponsesApi } from "@earendil-works/pi-ai/compat";
import { resolveProviderConfig } from "./config.js";
import { getMantleBaseUrl, resolveRegion } from "./region.js";
import { getBearerToken } from "./token.js";

/**
 * Creates an AssistantMessageEventStream emitting a pre-execution error event.
 * Prevents unhandled exceptions from crashing the agent runtime when credentials or region fail.
 */
function createErrorStream(
  model: Model<"openai-responses">,
  error: unknown
): AssistantMessageEventStream {
  const stream = createAssistantMessageEventStream();
  const errorMessage = error instanceof Error ? error.message : String(error);

  const output: AssistantMessage = {
    role: "assistant",
    content: [],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "error",
    errorMessage,
    timestamp: Date.now(),
  };

  queueMicrotask(() => {
    stream.push({ type: "start", partial: output });
    stream.push({ type: "error", reason: "error", error: output });
    stream.end();
  });

  return stream;
}

/**
 * streamSimple implementation for Bedrock Mantle OpenAI provider.
 * Resolves region and configuration, generates bearer token, and delegates execution to openAIResponsesApi.
 */
export function streamBedrockMantle(
  model: Model<"openai-responses">,
  context: Context,
  options?: SimpleStreamOptions
): AssistantMessageEventStream {
  let config;
  let region: string;
  try {
    config = resolveProviderConfig(model.baseUrl, options as Record<string, unknown> | undefined);
    region = resolveRegion(config.region);
  } catch (err) {
    return createErrorStream(model, err);
  }

  const baseUrl = getMantleBaseUrl(region, config.baseUrl);
  const effectiveModel: Model<"openai-responses"> = {
    ...model,
    baseUrl,
  };

  const stream = createAssistantMessageEventStream();

  (async () => {
    try {
      const token = await getBearerToken(region);

      const userOnPayload = options?.onPayload;
      const storeEnabled = config.store === true;

      const onPayload = async (payload: unknown, m: Model<any>) => {
        let currentPayload = payload;
        if (storeEnabled && currentPayload && typeof currentPayload === "object") {
          (currentPayload as Record<string, unknown>).store = true;
        }
        if (userOnPayload) {
          const res = await userOnPayload(currentPayload, m);
          if (res !== undefined) {
            currentPayload = res;
          }
        }
        return currentPayload;
      };

      const delegatedOptions: SimpleStreamOptions = {
        ...options,
        apiKey: token,
        onPayload,
      };

      const innerStream = openAIResponsesApi().streamSimple(
        effectiveModel,
        context,
        delegatedOptions
      );

      for await (const event of innerStream) {
        stream.push(event);
      }
      stream.end();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const output: AssistantMessage = {
        role: "assistant",
        content: [],
        api: model.api,
        provider: model.provider,
        model: model.id,
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
        stopReason: options?.signal?.aborted ? "aborted" : "error",
        errorMessage,
        timestamp: Date.now(),
      };
      stream.push({ type: "start", partial: output });
      stream.push({
        type: "error",
        reason: output.stopReason as "aborted" | "error",
        error: output,
      });
      stream.end();
    }
  })();

  return stream;
}
