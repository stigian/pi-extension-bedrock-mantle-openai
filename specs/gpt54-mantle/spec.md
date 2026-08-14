# Specification: Bedrock Mantle OpenAI provider extension for Pi

## Overview

This specification defines a shareable Pi extension that registers a custom model provider routing OpenAI models—primarily `openai.gpt-5.4`—through Amazon Bedrock's OpenAI-compatible **Mantle** endpoint (`bedrock-mantle`). Pi's built-in `amazon-bedrock` provider advertises GPT-5.4 but routes requests through the Bedrock Converse API, which recent OpenAI models do not support, resulting in AWS API errors. This extension provides support for using the OpenAI **Responses API** on the `bedrock-mantle` endpoint, authenticated via standard AWS credentials.

The extension serves as an interim solution until native upstream support is integrated following updates in `openai/openai-node` ([pull request #1938](https://github.com/openai/openai-node/pull/1938)) and Pi ([issue #5363](https://github.com/earendil-works/pi/issues/5363)). The architecture prioritizes a minimal integration surface to facilitate straightforward removal when native support is released.

**Architectural Design (Approach 1):** Register a provider with `api: "openai-responses"` and a lightweight `streamSimple` delegation wrapper. The wrapper generates a short-term Bedrock bearer token using the default AWS credential chain (via `@aws/bedrock-token-generator`) and delegates response streaming to Pi's internal `pi-ai` Responses API implementation. This aligns with the integration model demonstrated in `custom-provider-gitlab-duo`.

## Goals

- **G1 — Package Shareability:** Distributable as a Git-based Pi package, following established team patterns such as `jswank/pi-extension-vertex-anthropic`.
- **G2 — Minimal Complexity:** Maintain minimal code footprint and dependencies; avoid reimplementing stream parsing or request signing; ensure complete uninstallation when upstream support is available.
- **G3 — Credential Reuse:** Utilize the existing default AWS credential chain without introducing separate configuration mechanisms.
- **G4 — AWS GovCloud Compatibility:** Support execution against the AWS GovCloud Mantle endpoint in `us-gov-west-1` (`bedrock-mantle.us-gov-west-1.api.aws`).
- **G5 — Primary Support for GPT-5.4:** Ensure `openai.gpt-5.4` functions reliably in AWS GovCloud, while supporting commercial-region OpenAI models where applicable.

## Non-Goals

- Implementation of AWS SigV4 request signing (bearer token authentication is used exclusively).
- Support for OpenAI Chat Completions API or Bedrock Converse API routing.
- Suppressing, replacing, or modifying Pi's built-in non-functional `amazon-bedrock/openai.gpt-5.4` provider entry.
- Multi-modal image input, server-side tool execution, AWS Bedrock Guardrails, or Mantle stateful conversation management beyond standard Responses API usage.
- Wrapping the `openai-node` SDK provider interface (designated as Approach 3).

## Functional Requirements

Requirements are structured for independent verification.

### Provider Registration

- **FR-1.** Register exactly one provider via `pi.registerProvider()` using identifier `bedrock-mantle-openai` and `api: "openai-responses"`.
- **FR-2.** Upon installation and configuration, display `openai.gpt-5.4` in the `/model` selector and `pi --list-models` output under the `bedrock-mantle-openai` provider header.
- **FR-3.** Register `openai.gpt-5.4` with model metadata attributes: `reasoning: true`, `input: ["text"]`, `contextWindow: 272000` (verified via model card), default `maxTokens` (set to a documented conservative default), and `cost` (documented approximation).
- **FR-4.** Provide a default model catalogue containing Responses API frontier models available on `bedrock-mantle`: `openai.gpt-5.4`, `openai.gpt-5.5`, and the `gpt-5.6` family (`gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`). All entries configure `api: "openai-responses"` and share the authentication and streaming delegation pipeline; adding models requires adding catalogue metadata rows.
- **FR-4a.** The default catalogue EXCLUDES open-weight models (`gpt-oss` / GPT OSS Safeguard variants requiring InvokeModel or Chat Completions APIs) and restricted access variants (`Cyber` and `Daybreak` models requiring specific IAM authorization).
- **FR-4b.** Declaring model metadata in the catalogue enables model selection within Pi; actual execution availability depends on account access and AWS region deployment. Model availability in commercial regions must not impact AWS GovCloud operations.
- **FR-4c.** Every model entry in the distributed catalogue MUST specify an explicit, verified `thinkingLevelMap` matching that specific model's accepted `reasoning.effort` parameter values. Relying on generic fallbacks or host default mappings is prohibited. A model whose accepted reasoning effort values are unconfirmed (via AWS model cards or active verification) must be excluded from the catalogue until verified.
- **FR-4d.** Accepted `reasoning.effort` mapping specifications:
  - **GPT-5.6 Sol / Terra / Luna:** Documented effort values: `none`, `low`, `medium`, `high`, `xhigh`, `max`. Value mapping: `off` → `none`, `minimal` → `null` (unsupported level), `low`/`medium`/`high` → passthrough, `xhigh` → `xhigh`, `max` → `max`.
  - **GPT-5.4 / GPT-5.5:** Accepted effort values verified against the OpenAI API model reference (the Bedrock cards omit them): `none`, `low`, `medium`, `high`, `xhigh` — no `max`, no `minimal`. Defaults: GPT-5.4 → `none`, GPT-5.5 → `medium`. Value mapping: `off` → `none`, `minimal` → `null` (unsupported level), `low`/`medium`/`high` → passthrough, `xhigh` → `xhigh`, `max` → `null` (unsupported; `max` is GPT-5.6-only). This satisfies the FR-4c gate for 5.4/5.5.

### Endpoint and Region Resolution

- **FR-5.** Derive the provider `baseUrl` from the resolved AWS region using format `https://bedrock-mantle.<region>.api.aws/openai/v1`, unless an explicit override is provided.
- **FR-6.** Resolve AWS region and credentials through standard AWS configuration mechanisms. Region precedence order: (1) explicit provider setting in `settings.json` or `models.json`, (2) `AWS_REGION` environment variable, (3) `AWS_DEFAULT_REGION` environment variable. If no region is resolved, terminate initialization with a diagnostic error specifying the expected environment variables and configuration keys.
- **FR-6a.** Do not introduce custom environment variables for provider options. Standard AWS environment variables are the sole environment inputs recognized.
- **FR-7.** Configuring region `us-gov-west-1` directs requests to the AWS GovCloud endpoint without requiring code modifications.
- **FR-8.** Support `baseUrl` overrides in `settings.json` or `models.json` to accommodate custom network or endpoint configurations.

### Authentication

- **FR-9.** Authenticate requests using a short-term Bedrock bearer token generated at runtime via `@aws/bedrock-token-generator` (`getTokenProvider`) from the AWS default credential chain.
- **FR-10.** Resolve credentials using standard AWS credential mechanisms (environment variables, AWS shared credentials file, IAM Identity Center/SSO, container or instance IAM roles). The extension does not store credential material.
- **FR-11.** Generate tokens for the targeted region and manage caching and refreshment within the token provider. Token refresh must operate transparently across long-lived sessions exceeding token validity windows (up to 12 hours).
- **FR-12.** Transmit the bearer token in the HTTP `Authorization: Bearer <token>` header on every endpoint request.
- **FR-13.** Catch credential or token generation failures and emit diagnostic errors referencing the target region and AWS credential configuration, preventing unhandled runtime exceptions.

### Server-Side Storage and Privacy

- **FR-17s.** Default request payloads to `store: false` to prevent server-side persistence of prompts and responses on AWS Bedrock Mantle endpoints.
- **FR-17t.** Support server-side response retention (`store: true`) as an explicit configuration toggle when persistence features are required.
- **FR-17u.** Enforce `store: false` by default in AWS GovCloud environments to prevent unauthorized content persistence.

### Streaming Execution

- **FR-14.** Provide a `streamSimple` delegation function that injects the generated bearer token and delegates execution to `openAIResponsesApi().streamSimple` in `pi-ai`.
- **FR-15.** Support text content streaming, reasoning content emission, tool invocation, and token usage reporting for `openai.gpt-5.4`.
- **FR-16.** Support request cancellation via `AbortSignal` propagation when cancellation is triggered in the user interface.

### Packaging and Distribution

- **FR-17.** Package the extension for installation via Git references (e.g., `pi install git:github.com/<org>/pi-extension-bedrock-mantle-openai@<ref>`) or setting entries in `settings.json`.
- **FR-18.** Declare the `pi.extensions` entry point in `package.json` and include `@aws/bedrock-token-generator` in production `dependencies` to ensure retention during pruned installations (`npm install --omit=dev`).
- **FR-19.** Provide a `README.md` documenting package installation, AWS credential configuration, region selection (including `us-gov-west-1`), model selection, and uninstallation steps.

### Configuration Surface

- **FR-20.** Configure non-AWS options (`baseUrl`, `store`, model overrides) exclusively through Pi configuration files (`settings.json` or `models.json`).
- **FR-21.** Operate without custom configuration parameters when standard AWS environment variables (`AWS_REGION` or `AWS_DEFAULT_REGION`) and default AWS credentials are present.

## User Scenarios

### Scenario A — AWS GovCloud Execution (Primary Use Case)

1. An operator in AWS GovCloud configures standard AWS credentials for Bedrock in `us-gov-west-1`.
2. The operator installs the extension package and sets the provider region to `us-gov-west-1`.
3. The operator selects model `bedrock-mantle-openai/openai.gpt-5.4` in the `/model` interface.
4. The operator submits a prompt, receiving a streamed response over the Responses API path without endpoint errors.

### Scenario B — Commercial Region Execution

1. An operator configures commercial AWS credentials and sets the region to `us-east-1`.
2. The operator selects a commercial model entry and executes prompts successfully.

### Scenario C — Extended Session Execution

1. An operator executes prompts across a session exceeding single token validity windows (e.g., >12 hours).
2. Token generation transparently refreshes bearer tokens, maintaining continuous operation without re-authentication prompts.

### Scenario D — Diagnostic Reporting for Configuration Errors

1. An operator runs the extension without valid AWS credentials or a resolvable region.
2. Initialization fails with a diagnostic message detailing missing environment variables and credential requirements.

## Success Criteria

- **SC-1.** In `us-gov-west-1`, `bedrock-mantle-openai/openai.gpt-5.4` successfully completes streaming request/response cycles using existing AWS Bedrock credentials and region configuration.
- **SC-2.** Region changes (between AWS GovCloud and commercial regions) require configuration updates only, with no code modifications.
- **SC-3.** The extension installs and executes directly from the Git repository using standard Pi package commands without manual compilation or dependency intervention.
- **SC-4.** Total extension codebase remains concise and delegates stream parsing and request execution entirely to underlying libraries.
- **SC-5.** Prompts dispatched to `bedrock-mantle-openai/openai.gpt-5.4` bypass the non-functional Bedrock Converse API routing path.
- **SC-6.** Uninstalling the package and removing provider settings fully restores default host behavior.

## Dependencies

- Runtime: `@aws/bedrock-token-generator` (including transitive AWS SDK dependencies).
- Host Provided: `@earendil-works/pi-coding-agent` (Extension API interface) and `@earendil-works/pi-ai` (OpenAI Responses API client).
- Prerequisites: Active AWS credentials with IAM permissions for `bedrock-mantle:CallWithBearerToken` and bearer token generation in the target region.

## Resolved and Active Open Questions

- **OQ-1 — Endpoint Path (Resolved):** Standardized on `/openai/v1`. Verified via active test in `us-gov-west-1` (`POST /openai/v1/responses` returning HTTP 200). `baseUrl` override functionality is maintained (FR-8).
- **OQ-2 — Token Generation in AWS GovCloud (Resolved):** Verified that bearer tokens generated via `@aws/bedrock-token-generator` (scoped to `us-gov-west-1`) are accepted by the Bedrock Mantle endpoint in `us-gov-west-1`.
- **OQ-3 — Host Provider Entry Handling (Resolved):** The built-in `amazon-bedrock/openai.gpt-5.4` entry remains unmodified. Users select the extension provider explicitly (`bedrock-mantle-openai/openai.gpt-5.4`).
- **OQ-4 — Catalogue Parameters (Resolved):** Includes Responses API frontier models. Parameter values are populated from published model cards, with unverified values marked as approximate.
- **OQ-5 — Reasoning Control Verification (Resolved):** Per-model verification of `thinkingLevelMap` is established as a release gate (FR-4c). GPT-5.6 family values are from the AWS model cards; GPT-5.4/5.5 values are verified against the OpenAI API model reference (`developers.openai.com/api/docs/models/gpt-5.4` and `.../gpt-5.5`). All catalogued models now have verified mappings; no frontier model remains blocked by the gate.
- **OQ-6 — Server-Side Storage Parameter Handling (Resolved):** Storage parameters are controlled via `onPayload` interception during request delegation.

## Out of Scope

AWS SigV4 request signing, non-Responses API endpoints, custom multi-modal/tool implementations, automated modification of Pi host binaries or built-in providers.
