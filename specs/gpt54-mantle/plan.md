# Implementation Plan: Bedrock Mantle OpenAI provider extension for Pi

This implementation plan is governed by `spec.md`.

## 1. Technical Context

### Runtime and Language
- **Language:** TypeScript, loaded by Pi via [jiti](https://github.com/unjs/jiti);
  no build or compilation step is required for execution.
- **Module format:** ESM (`"type": "module"`).
- **Host environment:** Pi extension runtime (`ExtensionAPI`) on Node.js.

### Dependencies
| Dependency | Role | package.json section |
|---|---|---|
| `@aws/bedrock-token-generator` | Generates short-term Bedrock bearer tokens from the AWS default credential chain | `dependencies` (retained during `npm install --omit=dev`) |
| `@earendil-works/pi-coding-agent` | `ExtensionAPI`, `pi.registerProvider()` | `peerDependencies: "*"` (provided by Pi, not vendored) |
| `@earendil-works/pi-ai` | `openAIResponsesApi().streamSimple`, provider and model type definitions | `peerDependencies: "*"` |
| `typebox` | Required if typed tool parameters are added | `peerDependencies: "*"` |

Transitive AWS SDK credential provider packages are provided through `@aws/bedrock-token-generator` and are not declared directly.

### Runtime Prerequisites
- An active AWS credential chain (environment variables, shared configuration file, AWS IAM Identity Center/SSO, or container/instance IAM role) with authorization to generate bearer tokens and invoke `bedrock-mantle:CallWithBearerToken` in the target AWS region and partition.
- An AWS region configured via `AWS_REGION`, `AWS_DEFAULT_REGION`, or explicit provider configuration.

### Verified Host Runtime Behavior
Confirmed by inspecting the bundled `pi-ai` OpenAI Responses implementation (`api/openai-responses.ts`):
- `buildParams` sets `store: false` by default, satisfying FR-17s and FR-17u without additional modification.
- After parameter construction, `pi-ai` invokes `await options.onPayload?.(params, model)` and substitutes the returned payload if defined, providing the mechanism to set `store: true` when enabled (FR-17t).
- `getClientApiKey` evaluates `options.apiKey` first. `createClient` instantiates `new OpenAI({ apiKey, baseURL: model.baseUrl })`, transmitting `Authorization: Bearer <apiKey>`. Passing the generated token as `apiKey` satisfies FR-12.
- `buildParams` translates reasoning configurations using `model.thinkingLevelMap?.[effort] ?? effort`, and maps reasoning status `off` using `thinkingLevelMap?.off ?? "none"`. Providing an explicit `thinkingLevelMap` (FR-4c) is supported directly by the host runtime.
- `options.signal` is passed into `client.responses.create(...)`, enabling cancellation (FR-16) through signal propagation.

## 2. Architecture

**Design Approach:** Register a single provider with `api: "openai-responses"` whose `streamSimple` method (a) generates and caches a short-term bearer token, and (b) delegates request handling to the built-in `pi-ai` Responses streaming implementation. This matches the pattern used by `custom-provider-gitlab-duo`. It avoids custom stream parsing, manual request signing, or custom SDK wrappers.

### Request Execution Flow
```
Pi turn
  └─ provider "bedrock-mantle-openai" (api: openai-responses)
       └─ streamSimple(model, context, options)          [extension wrapper]
            ├─ resolve region  (provider config → AWS_REGION → AWS_DEFAULT_REGION)
            ├─ tokenProvider()  ← @aws/bedrock-token-generator (cached/refreshed)
            ├─ build delegated options:
            │     apiKey    = <generated bearer token>
            │     onPayload = store opt-in payload transformer (if enabled)
            │     (signal, reasoning, headers, pass-through options)
            └─ openAIResponsesApi().streamSimple(modelWithBaseUrl, context, opts)
                 └─ pi-ai constructs parameters (store: false default),
                    POST https://bedrock-mantle.<region>.api.aws/openai/v1/responses
                    Authorization: Bearer <token>
```

### Key Design Decisions

- **DD-1 — Token Provider Lifecycle:** Instantiate `getTokenProvider({ region })` per resolved AWS region, memoized at module scope by region identifier. The provider manages token caching and refreshment internally, supporting long-lived sessions (FR-11, Scenario C) without generating tokens on every request.
- **DD-2 — Token Injection via `apiKey`:** Pass the bearer token as `options.apiKey`. In `pi-ai`'s `openai-responses` pipeline, `apiKey` is the documented configuration property that populates the HTTP `Authorization: Bearer <token>` header.
- **DD-3 — Server-Side Storage (`store`) Control:** Omit `onPayload` by default to retain `store: false`. When server-side storage is explicitly enabled by configuration, attach an `onPayload` handler that sets `params.store = true` and returns the modified parameters (FR-17t).
- **DD-4 — Provider Registration and Model Availability Check:** Pi evaluates provider availability before listing models. Inspection of `core/provider-composer.js` (`composeApiKeyAuth.check`) confirms that a string literal `apiKey` (without environment variable references or command substitutions) passes evaluation and returns `{ type: "api_key", source: "configured API key" }`. This marks the provider as configured in `core/model-runtime.js` (`runAvailabilityRefresh`), making registered models visible in `/model` and `--list-models`. The extension registers using a static placeholder `apiKey` (e.g., `"bedrock-mantle"`) and leaves `authHeader` unassigned. The placeholder string is overwritten by `streamSimple` with the generated bearer token prior to invoking `pi-ai`.
- **DD-5 — Region Resolution and Error Handling:** Evaluate AWS regions in the sequence defined in FR-6. If resolution fails, throw an error specifying `AWS_REGION`, `AWS_DEFAULT_REGION`, and the provider configuration key. Token generation failures are caught and re-thrown with error messages detailing the target region and referencing AWS credential setup instructions (FR-13, Scenario D).
- **DD-6 — Static Model Catalogue:** The model catalogue is defined as a static array of model metadata definitions (FR-4, FR-4a). Adding a model requires updating metadata rather than modifying execution logic. The catalogue includes only Responses API frontier models: `openai.gpt-5.4`, `openai.gpt-5.5`, and the `gpt-5.6` family (`gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`).

## 3. Project Structure

```
pi-extension-bedrock-mantle-openai/
├── package.json              # ESM manifest, pi.extensions entry, dependencies, peerDependencies
├── README.md                 # Setup, AWS credentials, region config (including us-gov-west-1), model selection
├── index.ts                  # Extension entry point: default export registering the provider
├── src/
│   ├── models.ts             # Static MODELS catalogue (id, name, reasoning, thinkingLevelMap, input, cost, contextWindow, maxTokens)
│   ├── config.ts             # Config surface resolution (baseUrl, store, region override, model overrides) from settings.json/models.json
│   ├── region.ts             # Region resolution (config → AWS_REGION → AWS_DEFAULT_REGION) with diagnostic error handling
│   ├── token.ts              # Bearer token provider factory wrapping @aws/bedrock-token-generator with region memoization
│   └── stream.ts             # streamBedrockMantle wrapper function (token retrieval and pi-ai delegation)
└── specs/gpt54-mantle/       # Specification and implementation plan
```

Separating code into dedicated modules within `src/` keeps the catalogue, region resolution, token lifecycle, and streaming delegation modular and testable, simplifying complete removal when upstream support is available in Pi (G2, SC-6).

## 4. Interface Contracts

### Provider Registration (`index.ts`)
```typescript
pi.registerProvider("bedrock-mantle-openai", {
  name: "Bedrock Mantle (OpenAI)",
  baseUrl: <resolved or configured endpoint>,   // https://bedrock-mantle.<region>.api.aws/openai/v1
  api: "openai-responses",
  apiKey: "bedrock-mantle",                  // DD-4 placeholder; overridden dynamically in streamSimple
  models: MODELS,                            // FR-3, FR-4
  streamSimple: streamBedrockMantle,
});
```

### Stream Delegation Contract (`src/stream.ts`)
`streamBedrockMantle(model, context, options): AssistantMessageEventStream`
- Resolve the target AWS region (DD-5) and construct `modelWithBaseUrl = { ...model, baseUrl }`.
- Obtain bearer token via `await getBearerTokenProvider(region)()` (DD-1); wrap authentication errors (FR-13).
- Construct delegated options: `{ ...options, apiKey: token, ...(storeEnabled ? { onPayload } : {}) }`.
- Invoke `openAIResponsesApi().streamSimple(modelWithBaseUrl, context, delegated)`.
- If an initialization error occurs before stream construction, return an event stream emitting a single `error` event to report the failure through model error channels rather than an unhandled exception.

### Extension Configuration Surface (FR-20)
Configured through Pi settings files (`settings.json` or `models.json`):
- `baseUrl`: Endpoint override (defaults to region-derived URL) — FR-5, FR-8.
- `store`: Boolean toggle for server-side response retention (defaults to `false`) — FR-17s, FR-17t, FR-17u.
- Region override key: Explicit region name (falls back to environment variables) — FR-6.

AWS credentials and default region variables are read exclusively from standard AWS environment variables.

### Model Metadata (`src/models.ts`)
Each entry defines: `{ id, name, reasoning: true, input: ["text"], contextWindow, maxTokens, cost, thinkingLevelMap }`.

**Release Requirement (FR-4c):** Every model entry must include a verified, per-model `thinkingLevelMap` corresponding to that model's accepted `reasoning.effort` parameter values.
- **GPT-5.6 Sol / Terra / Luna** (accepted values: `none`, `low`, `medium`, `high`, `xhigh`, `max`):
  `{ off: "none", minimal: null, low: "low", medium: "medium", high: "high", xhigh: "xhigh", max: "max" }`.
- **GPT-5.4 / GPT-5.5** (accepted values: `none`, `low`, `medium`, `high`, `xhigh` — no `max`, verified via the OpenAI API model reference):
  `{ off: "none", minimal: null, low: "low", medium: "medium", high: "high", xhigh: "xhigh", max: null }`. The FR-4c gate is satisfied; both models are included in `MODELS`.

Model `openai.gpt-5.4` specifies `contextWindow: 272000`. Values for `maxTokens` and `cost` are specified using documented approximations until final values are confirmed. The GPT-5.6 family specifies `contextWindow: 1000000` based on published model cards, subject to verification.

## 5. Phased Implementation

- **Phase 1 — Project Structure and Registration:** Create `package.json` (ESM configuration, `pi.extensions` export, dependencies, peerDependencies), and an `index.ts` entry point registering the provider with an initial model definition. Verify that the extension loads and `openai.gpt-5.4` appears in `pi --list-models` (FR-2, FR-18, DD-4, V-2).
- **Phase 2 — Region Resolution and Authentication:** Implement `src/region.ts` and `src/token.ts`. Integrate token retrieval into `streamSimple` and verify execution against the AWS GovCloud endpoint in `us-gov-west-1` (FR-5, FR-6, FR-7, FR-9, FR-10, FR-11, FR-12, V-1, V-3).
- **Phase 3 — Streaming Delegation:** Implement reasoning parameter pass-through, request cancellation via `AbortSignal`, token usage reporting, and error handling wrappers (FR-13, FR-14, FR-15, FR-16).
- **Phase 4 — Catalogue Expansion:** Populate additional model definitions in `src/models.ts`. Ensure each model has an explicitly verified `thinkingLevelMap` prior to inclusion (FR-4c, FR-4d).
- **Phase 5 — Storage Configuration:** Implement configuration parsing and `onPayload` handling for the `store` setting (FR-17s, FR-17t, FR-17u, V-4).
- **Phase 6 — Documentation:** Write `README.md` covering installation via `pi install`, AWS credential requirements, region configuration (including `us-gov-west-1`), model selection, and uninstallation procedures (FR-17, FR-19, SC-3, SC-6).

## 6. Requirements Coverage Matrix

| Requirement Group | Implementation Location | Phase |
|---|---|---|
| FR-1–FR-4d (Registration, Catalogue, Reasoning) | `index.ts`, `src/models.ts` | Phase 1, Phase 4 |
| FR-5–FR-8 (Endpoint and Region) | `src/region.ts`, DD-5 | Phase 2 |
| FR-9–FR-13 (Authentication) | `src/token.ts`, DD-1, DD-2, DD-5 | Phase 2, Phase 3 |
| FR-14–FR-16 (Streaming) | `src/stream.ts`, DD-3 | Phase 3 |
| FR-17s–FR-17u (Server-Side Storage) | `src/stream.ts` (`onPayload`), DD-3 | Phase 5 |
| FR-17–FR-21 (Packaging and Configuration) | `package.json`, `README.md`, Provider Config | Phase 1, Phase 6 |

## 7. Verification Procedures

Targeted verification checks for core functionality:
- **V-1 — Endpoint Connectivity:** Verify that a streaming request in `us-gov-west-1` reaches `POST /openai/v1/responses` and returns HTTP status 200 with valid content.
- **V-2 — Provider Availability Checking (DD-4):** Confirm that registering with a placeholder `apiKey` displays models in `/model` and that missing AWS credentials trigger diagnostic errors (FR-13) rather than uncaught exceptions.
- **V-3 — Token Refresh in Long Sessions (FR-11):** Confirm that requests issued past token expiration succeed without manual intervention.
- **V-4 — Server-Side Storage Default (FR-17u):** Verify that default request payloads set `store: false`, and that enabling the setting updates payloads to `store: true`.

## 8. Open Questions Status

- **OQ-6 — Resolved:** `pi-ai` defaults to `store: false`. Enabling server-side storage is handled via `onPayload`.
- **OQ-4 — Resolved (Non-blocking):** Standard model parameters are derived from published model cards; approximate values are designated as such until confirmed.
- **OQ-5 — Resolved:** `thinkingLevelMap` verification is established as a release gate per model (FR-4c). All catalogued models have confirmed mappings: GPT-5.6 family from AWS model cards; GPT-5.4/5.5 from the OpenAI API model reference (`none`/`low`/`medium`/`high`/`xhigh`, no `max`).
- **DD-4 — Resolved:** Placeholder `apiKey` registration enables model listing while delegating token generation to request execution.

## 9. Non-Goals

The following items remain outside the scope of this project: AWS SigV4 request signing, Non-Responses APIs (such as Chat Completions or Bedrock Converse API), custom image/tool/guardrail implementations, suppressing the built-in non-functional `amazon-bedrock/openai.gpt-5.4` provider entry, and host modifications to Pi.
