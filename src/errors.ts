import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { MantleTarget } from "./region.js";

const FORMATTED_OPENAI_API_ERROR_PREFIX = /^OpenAI API error \((\d{3})\):\s*/;
const OPENAI_CONNECTION_ERROR_TEXT = "Connection error.";

const SMITHY_PROVIDER_ERROR_NAMES = new Set([
  "CredentialsProviderError",
  "ProviderError",
  "TokenProviderError",
]);

const REDACTION_PATTERNS: Array<[RegExp, string]> = [
  [/(AWS_ACCESS_KEY_ID=)([^\s]+)/g, "$1[redacted]"],
  [/(AWS_SECRET_ACCESS_KEY=)([^\s]+)/g, "$1[redacted]"],
  [/(AWS_SESSION_TOKEN=)([^\s]+)/g, "$1[redacted]"],
  [/(AWS_BEARER_TOKEN_BEDROCK=)([^\s]+)/g, "$1[redacted]"],
  [/(Authorization:\s*Bearer\s+)([^\s]+)/gi, "$1[redacted]"],
];

interface OpenAICompatibleErrorBody {
  code?: string;
  message?: string;
  param?: string | null;
  type?: string;
}

interface OpenAICompatibleStatusError {
  status: number;
  body?: OpenAICompatibleErrorBody;
}

interface SmithyProviderErrorShape {
  name?: unknown;
  statusCode?: unknown;
}

export function createBearerTokenFailureMessage(region: string, error: unknown): string {
  const detail = classifyBearerTokenFailure(region, error);

  return (
    `${detail} ` +
    `Please ensure valid AWS credentials (via provider-scoped env, AWS environment variables, AWS profile, IAM role, or SSO) ` +
    `with permissions for Bedrock Mantle in region '${region}'.`
  );
}

export function sanitizeBedrockMantleErrorText(
  errorMessage: string,
  target?: MantleTarget
): string {
  const trimmed = errorMessage.trim();
  const formattedApiError = parseFormattedOpenAIApiError(trimmed);
  if (formattedApiError) {
    return formatOpenAIApiError(formattedApiError, target);
  }

  if (trimmed === OPENAI_CONNECTION_ERROR_TEXT) {
    return formatConnectionError(target);
  }

  return redactSensitiveText(trimmed);
}

export function sanitizeBedrockMantleError(error: unknown, target?: MantleTarget): string {
  const rawApiError = getOpenAIApiError(error);
  if (rawApiError) {
    return formatOpenAIApiError(rawApiError, target);
  }

  if (isOpenAIConnectionError(error)) {
    return formatConnectionError(target);
  }

  return sanitizeBedrockMantleErrorText(getErrorMessage(error), target);
}

export function sanitizeAssistantErrorMessage(
  message: AssistantMessage,
  target?: MantleTarget
): AssistantMessage {
  if (!message.errorMessage) {
    return message;
  }

  const sanitized = sanitizeBedrockMantleErrorText(message.errorMessage, target);
  if (sanitized === message.errorMessage) {
    return message;
  }

  return {
    ...message,
    errorMessage: sanitized,
  };
}

function classifyBearerTokenFailure(region: string, error: unknown): string {
  if (isCredentialsProviderError(error)) {
    return `Failed to generate a Bedrock bearer token for region '${region}'. No usable AWS credentials were resolved.`;
  }

  if (isTokenProviderError(error)) {
    return `Failed to generate a Bedrock bearer token for region '${region}'. AWS token generation failed before the Bedrock request was sent.`;
  }

  const providerErrorStatusCode = getSmithyProviderStatusCode(error);
  if (providerErrorStatusCode !== undefined) {
    return `Failed to generate a Bedrock bearer token for region '${region}'. An AWS credential provider request failed with status ${providerErrorStatusCode}.`;
  }

  if (isSmithyProviderError(error)) {
    return `Failed to generate a Bedrock bearer token for region '${region}'. AWS credential provider resolution failed.`;
  }

  return `Failed to generate a Bedrock bearer token for region '${region}'. AWS credential resolution or token generation failed.`;
}

function parseFormattedOpenAIApiError(message: string): OpenAICompatibleStatusError | undefined {
  const match = message.match(FORMATTED_OPENAI_API_ERROR_PREFIX);
  if (!match) {
    return undefined;
  }

  const status = Number(match[1]);
  if (!Number.isInteger(status)) {
    return undefined;
  }

  const bodyText = message.slice(match[0].length);
  return {
    status,
    body: parseOpenAIApiErrorBodyText(bodyText),
  };
}

function getOpenAIApiError(error: unknown): OpenAICompatibleStatusError | undefined {
  if (!(error instanceof Error)) {
    return undefined;
  }

  const candidate = error as Error & {
    status?: unknown;
    error?: unknown;
    code?: unknown;
    message: string;
    param?: unknown;
    type?: unknown;
  };

  if (typeof candidate.status !== "number") {
    return undefined;
  }

  return {
    status: candidate.status,
    body: normalizeOpenAIApiErrorBody(candidate.error, candidate),
  };
}

function normalizeOpenAIApiErrorBody(
  bodyValue: unknown,
  fallback?: {
    code?: unknown;
    message?: string;
    param?: unknown;
    type?: unknown;
  }
): OpenAICompatibleErrorBody | undefined {
  const source = unwrapOpenAIApiErrorBody(bodyValue);

  const body: OpenAICompatibleErrorBody = {
    code: getOptionalString(source?.code ?? fallback?.code),
    message: getOptionalString(source?.message ?? fallback?.message),
    param: getOptionalNullableString(source?.param ?? fallback?.param),
    type: getOptionalString(source?.type ?? fallback?.type),
  };

  return hasOpenAIApiErrorBodyContent(body) ? body : undefined;
}

function unwrapOpenAIApiErrorBody(value: unknown): Record<string, unknown> | undefined {
  if (!isPlainObject(value)) {
    return undefined;
  }

  if (isPlainObject(value.error)) {
    return value.error;
  }

  return value;
}

function parseOpenAIApiErrorBodyText(bodyText: string): OpenAICompatibleErrorBody | undefined {
  try {
    return normalizeOpenAIApiErrorBody(JSON.parse(bodyText), {
      message: bodyText,
    });
  } catch {
    return undefined;
  }
}

function formatOpenAIApiError(
  error: OpenAICompatibleStatusError,
  target?: MantleTarget
): string {
  const context = formatTargetContext(target);
  const codeSuffix = formatOpenAIApiCodeSuffix(error.body);

  switch (error.status) {
    case 400:
      return `Bedrock Mantle request failed with 400 Bad Request${context}. Check the request payload and selected model settings.${codeSuffix}`;
    case 401:
      return `Bedrock Mantle request failed with 401 Unauthorized${context}. AWS/Bedrock authentication failed; check the configured AWS credentials, AWS profile, or generated bearer token.${codeSuffix}`;
    case 403:
      return `Bedrock Mantle request failed with 403 Forbidden${context}. Check IAM permissions for Bedrock Mantle token generation and inference in this region.${codeSuffix}`;
    case 404:
      return `Bedrock Mantle request failed with 404 Not Found${context}. Verify the endpoint hostname and that the selected model is available in this region.${codeSuffix}`;
    case 429:
      return `Bedrock Mantle request failed with 429 Too Many Requests${context}. Bedrock Mantle throttled the request; retry with backoff or check service quotas.${codeSuffix}`;
    default:
      return `Bedrock Mantle request failed with status ${error.status}${context}. Check the endpoint, region, and upstream Bedrock Mantle response.${codeSuffix}`;
  }
}

function formatOpenAIApiCodeSuffix(body?: OpenAICompatibleErrorBody): string {
  const code = getOptionalString(body?.code);
  if (!code) {
    return "";
  }

  const type = getOptionalString(body?.type);
  return type ? ` Upstream error code: ${code} (${type}).` : ` Upstream error code: ${code}.`;
}

function formatConnectionError(target?: MantleTarget): string {
  return `Connection error${formatTargetContext(target)}. Check network reachability, proxy configuration, and the endpoint hostname.`;
}

function formatTargetContext(target?: MantleTarget): string {
  if (!target) {
    return " while calling Bedrock Mantle";
  }

  return ` while calling Bedrock Mantle endpoint '${target.baseUrl}' for region '${target.region}'`;
}

function isOpenAIConnectionError(error: unknown): boolean {
  return error instanceof Error && error.name === "APIConnectionError";
}

function isCredentialsProviderError(error: unknown): boolean {
  return error instanceof Error && error.name === "CredentialsProviderError";
}

function isTokenProviderError(error: unknown): boolean {
  return error instanceof Error && error.name === "TokenProviderError";
}

function isSmithyProviderError(error: unknown): error is Error & SmithyProviderErrorShape {
  return error instanceof Error && SMITHY_PROVIDER_ERROR_NAMES.has(error.name);
}

function getSmithyProviderStatusCode(error: unknown): number | undefined {
  if (!isSmithyProviderError(error)) {
    return undefined;
  }

  return typeof error.statusCode === "number" ? error.statusCode : undefined;
}

function hasOpenAIApiErrorBodyContent(body: OpenAICompatibleErrorBody): boolean {
  return body.code !== undefined || body.message !== undefined || body.param !== undefined || body.type !== undefined;
}

function getOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getOptionalNullableString(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }

  return getOptionalString(value);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function redactSensitiveText(value: string): string {
  let redacted = value;
  for (const [pattern, replacement] of REDACTION_PATTERNS) {
    redacted = redacted.replace(pattern, replacement);
  }
  return redacted;
}
