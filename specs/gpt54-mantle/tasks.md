# Implementation Tasks: Bedrock Mantle OpenAI Provider Extension

## Phase 1: Setup

- [ ] [TASK-001] Initialize ESM manifest and dependency declarations in `pi-extension-bedrock-mantle-openai/package.json`
- [ ] [TASK-002] Define initial static model metadata schema and catalog stub in `pi-extension-bedrock-mantle-openai/src/models.ts`
- [ ] [TASK-003] Implement extension entry point, register `bedrock-mantle-openai` provider (placeholder `apiKey`, `api: "openai-responses"`, `streamSimple` wiring), and confirm the extension loads without error in `pi-extension-bedrock-mantle-openai/index.ts` (FR-1, DD-4)

## Phase 2: Foundational Components

- [ ] [TASK-004] Implement AWS region resolution logic with precedence chain and diagnostic errors in `pi-extension-bedrock-mantle-openai/src/region.ts` (FR-5, FR-6, FR-6a, FR-7)
- [ ] [TASK-005] Implement memoized Bedrock bearer token provider factory wrapping `@aws/bedrock-token-generator` in `pi-extension-bedrock-mantle-openai/src/token.ts` (FR-9, FR-10, FR-11, FR-12)
- [ ] [TASK-012] Implement configuration surface resolution reading `baseUrl`, `store`, region override, and model overrides from `settings.json`/`models.json`, with AWS credentials/region sourced only from standard AWS variables in `pi-extension-bedrock-mantle-openai/src/config.ts` (FR-8, FR-20, FR-21)

## Phase 3: Streaming Execution & Core Functionality

- [ ] [TASK-006] Implement `streamBedrockMantle` wrapper delegating token injection and execution to `openAIResponsesApi().streamSimple` in `pi-extension-bedrock-mantle-openai/src/stream.ts` (FR-14, FR-15, FR-16)
- [ ] [TASK-007] Implement diagnostic error event stream handling for pre-execution failures in `pi-extension-bedrock-mantle-openai/src/stream.ts` (FR-13)

## Phase 4: Model Catalog & Reasoning Configuration

- [ ] [TASK-008] Implement verified model definitions and explicit `thinkingLevelMap` entries for the five frontier models (`openai.gpt-5.4`, `openai.gpt-5.5`, `openai.gpt-5.6-sol`, `openai.gpt-5.6-terra`, `openai.gpt-5.6-luna`) in `pi-extension-bedrock-mantle-openai/src/models.ts`. Maps: 5.4/5.5 → `{off:none, minimal:null, low, medium, high, xhigh, max:null}`; 5.6 family → `{off:none, minimal:null, low, medium, high, xhigh, max}`. Mark `maxTokens`/`cost` as documented approximations pending live confirmation (FR-3, FR-4, FR-4a, FR-4c, FR-4d)

## Phase 5: Server-Side Storage Configuration

- [ ] [TASK-009] Implement server-side storage (`store`) setting toggle via `onPayload` payload modification, defaulting to `store: false` in `pi-extension-bedrock-mantle-openai/src/stream.ts` (FR-17s, FR-17t, FR-17u)

## Phase 6: Polish & Documentation

- [ ] [TASK-010] Create documentation covering installation via `pi install`, AWS credentials, region config (including `us-gov-west-1`), model selection, and uninstallation in `pi-extension-bedrock-mantle-openai/README.md` (FR-17, FR-19, SC-3, SC-6)

## Phase 7: Verification

- [ ] [TASK-011] Verify provider availability: registering with placeholder `apiKey` lists `openai.gpt-5.4` in `/model` and `pi --list-models`, and missing AWS credentials produce diagnostic errors rather than uncaught exceptions (FR-2, V-2)
- [ ] [TASK-013] Verify endpoint connectivity: a streaming request in `us-gov-west-1` reaches `POST /openai/v1/responses`, returns HTTP 200 with valid streamed content, and bypasses the Bedrock Converse path (SC-1, SC-5, V-1)
- [ ] [TASK-014] Verify token refresh across a long-lived session: requests issued past token expiration succeed without manual re-authentication (FR-11, V-3)
- [ ] [TASK-015] Verify server-side storage default: default payloads set `store: false` and enabling the setting updates payloads to `store: true` (FR-17u, V-4)
