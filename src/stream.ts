import {
  createAssistantMessageEventStream,
  type AssistantMessage,
  type AssistantMessageEventStream,
  type Context,
  type Model,
  type SimpleStreamOptions,
} from "@earendil-works/pi-ai";
import { openAIResponsesApi } from "@earendil-works/pi-ai/compat";
import { resolveMantleTarget } from "./region.js";
import { getBearerToken } from "./token.js";

interface BedrockMantleStreamOptions extends SimpleStreamOptions {
  region?: string;
}

/**
 * Creates an AssistantMessageEventStream emitting a pre-execution error event.
 * Prevents unhandled exceptions from crashing the agent runtime when credentials or region fail.
 */
function createErrorStream(
  model: Model<"openai-responses">,
  stopReason: "error" | "aborted",
  error: unknown
): AssistantMessageEventStream {
  const stream = createAssistantMessageEventStream();
  const output = createErrorMessage(model, stopReason, error);

  queueMicrotask(() => {
    pushErrorEvent(stream, output, stopReason);
  });

  return stream;
}

/**
 * streamSimple implementation for Bedrock Mantle OpenAI provider.
 * Resolves region and endpoint from Pi's composed baseUrl plus provider-scoped env,
 * generates a bearer token, and delegates execution to openAIResponsesApi.
 */
export function streamBedrockMantle(
  model: Model<"openai-responses">,
  context: Context,
  options?: SimpleStreamOptions
): AssistantMessageEventStream {
  const providerOptions = options as BedrockMantleStreamOptions | undefined;

  let target;
  try {
    target = resolveMantleTarget(model.baseUrl, providerOptions?.region, options?.env);
  } catch (err) {
    return createErrorStream(model, "error", err);
  }

  const effectiveModel: Model<"openai-responses"> = {
    ...model,
    baseUrl: target.baseUrl,
  };

  const stream = createAssistantMessageEventStream();

  (async () => {
    try {
      const token = await getBearerToken(target.region, options?.env);

      const delegatedOptions: SimpleStreamOptions = {
        ...options,
        apiKey: token,
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
      const stopReason = options?.signal?.aborted ? "aborted" : "error";
      const output = createErrorMessage(model, stopReason, err);
      pushErrorEvent(stream, output, stopReason);
    }
  })();

  return stream;
}

function pushErrorEvent(
  stream: AssistantMessageEventStream,
  output: AssistantMessage,
  stopReason: "error" | "aborted"
): void {
  stream.push({ type: "start", partial: output });
  stream.push({ type: "error", reason: stopReason, error: output });
  stream.end();
}

function createErrorMessage(
  model: Model<"openai-responses">,
  stopReason: "error" | "aborted",
  error: unknown
): AssistantMessage {
  const errorMessage = error instanceof Error ? error.message : String(error);

  return {
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
    stopReason,
    errorMessage,
    timestamp: Date.now(),
  };
}
