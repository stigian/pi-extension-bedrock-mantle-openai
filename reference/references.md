# Reference Index

Sources gathered during initial research for this extension. Each entry is a URL or workspace path with a one-line description of what's there.

---

## AWS Documentation

- https://docs.aws.amazon.com/bedrock/latest/userguide/bedrock-mantle.html  
  Primary Mantle endpoint doc: Responses API, supported regions, endpoint table, stateful conversation storage, prerequisites.

- https://docs.aws.amazon.com/bedrock/latest/userguide/endpoints.html  
  Side-by-side comparison of `bedrock-mantle` vs `bedrock-runtime`: API support, capabilities, auth, quotas, and when to choose each.

- https://docs.aws.amazon.com/bedrock/latest/userguide/inference-chat-completions-mantle.html  
  Chat Completions API on `bedrock-mantle`: endpoint table, auth methods, guardrail header usage.

- https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys.html  
  Short-term vs long-term Bedrock API key overview, usage (env var and header), auto-refresh pattern, IAM condition keys.

- https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys-generate.html  
  How to generate short-term and long-term API keys; covers the `@aws/bedrock-token-generator` library.

- https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys-use.html  
  How to pass a Bedrock API key: `AWS_BEARER_TOKEN_BEDROCK` env var, `Authorization: Bearer` header, SDK `api_key` field.

- https://docs.aws.amazon.com/bedrock/latest/userguide/models-api-compatibility.html  
  Per-model API compatibility table (Invoke, Converse, Chat Completions, Responses, Messages) for all Bedrock model families.

- ./model-cards.md  
  Sourced model-card excerpts for the catalogue (GPT-5.4/5.5/5.6 Sol/Terra/Luna): context windows, IDs, regions, reasoning-effort values, `/openai/v1` confirmation, and metadata discrepancies to resolve.

---

## AWS Security / Best Practices

- https://aws.amazon.com/blogs/security/securing-amazon-bedrock-api-keys-best-practices-for-implementation-and-management/  
  NIST CSF-mapped guidance on short-term vs long-term key security, CloudTrail detection patterns, EventBridge monitoring, and incident response.

---

## openai-node SDK (PR #1938)

- https://github.com/openai/openai-node/pull/1938  
  PR description: provider seam design, SigV4 approach, endpoint URL decision (`/openai/v1`), packaging split, compatibility notes.

- https://raw.githubusercontent.com/openai/openai-node/848381998fe3d0d7132903ee0d802981939ed8fc/src/internal/bedrock.ts  
  Core auth helpers: `resolveBedrockEndpoint`, `resolveBedrockBearerAuth`, `BedrockBearerAuth`, endpoint normalization logic.

- https://raw.githubusercontent.com/openai/openai-node/848381998fe3d0d7132903ee0d802981939ed8fc/src/providers/bedrock/aws.ts  
  `BedrockSigV4Auth` class and `bedrock()` factory; SigV4 signing, credential resolution order, static/profile/chain options.

- https://raw.githubusercontent.com/openai/openai-node/848381998fe3d0d7132903ee0d802981939ed8fc/src/internal/provider.ts  
  Provider seam internals: `createProvider`, `configureProvider`, `ProviderRuntime` interface, globalThis registry pattern.

- https://github.com/openai/openai-node/blob/main/docs/bedrock.md  
  End-user Bedrock guide: all auth modes with code examples, endpoint override, `BedrockOpenAI` legacy class, SigV4 body constraints.

---

## @aws/bedrock-token-generator

- https://github.com/aws/aws-bedrock-token-generator-js/blob/main/README.md  
  JS/TS token generator API: `getTokenProvider(options)`, `getToken(options)`, token format, caching/refresh behavior, credential provider integration.

---

## Pi Extension Architecture

- /home/vscode/node_modules/@earendil-works/pi-coding-agent/docs/extensions.md  
  Full extension API: events, `registerTool`, `registerCommand`, `registerProvider`, lifecycle, `before_provider_headers` hook.

- /home/vscode/node_modules/@earendil-works/pi-coding-agent/docs/custom-provider.md  
  `pi.registerProvider()` reference: legacy config form, native `createProvider` form, OAuth, `streamSimple`, API type table, model definition fields.

- /home/vscode/node_modules/@earendil-works/pi-coding-agent/docs/models.md  
  `models.json` format reference: provider config, model fields, `compat` options for OpenAI-compatible providers, value resolution syntax.

- /home/vscode/node_modules/@earendil-works/pi-coding-agent/examples/extensions/custom-provider-gitlab-duo/index.ts  
  Best reference implementation: delegates to `openAIResponsesApi().streamSimple`, injects per-request auth headers, `streamSimple` wrapping pattern.

- /home/vscode/node_modules/@earendil-works/pi-coding-agent/examples/extensions/custom-provider-anthropic/index.ts  
  Full custom `streamSimple` implementation with OAuth; shows event-by-event stream assembly, `calculateCost`, thinking/tool-call handling.

- /home/vscode/node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-ai/dist/compat.js  
  The `@earendil-works/pi-ai/compat` entrypoint exports lazy API factories (`openAICompletionsApi`, `openAIResponsesApi`, `anthropicMessagesApi`) used by extensions.

---

## Project Workspace

- /workspaces/stigian-ai/dixie/reference/harness-sdk/strands-ts/src/models/openai/mantle.ts  
  Reference implementation of Mantle auth in the Strands harness SDK: `BedrockMantleConfig`, `createMantleApiKeySetter`, `bedrockMantleBaseUrl`, lazy token generator loading.

- /workspaces/stigian-ai/dixie/reference/harness-sdk/strands-py/tests_integ/models/test_model_mantle.py  
  Python integration tests using `bedrock_mantle_config` shorthand on `OpenAIModel` and `OpenAIResponsesModel`.

- /workspaces/stigian-ai/reference/strands-sdk-python/tests_integ/models/test_model_mantle.py  
  Alternative Python test using raw `botocore` SigV4 signing directly via `httpx.Auth`; shows the manual SigV4 path without the token generator.
