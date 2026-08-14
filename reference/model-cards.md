# Model Card Excerpts — OpenAI frontier models on Amazon Bedrock (Mantle)

Sourced excerpts for the extension's model catalogue (spec FR-3/FR-4, OQ-4/OQ-5).
Values are quoted from the authoritative AWS Bedrock model cards; secondary sources
noted where they conflict. Fetched 2026 (see each URL for the live page).

> **Cross-cutting fact (all cards):** *"This model is available on the
> `openai/v1/responses` path on the `bedrock-mantle` endpoint. This is different
> from the `v1/responses` path used by other models on the responses endpoint."*
> — confirms OQ-1 (`/openai/v1`, not `/v1`).

> **Auth (AWS-blessed path, matches Approach 1):** the GPT-5.6 how-to shows the
> Python `BedrockOpenAI` client taking `bedrock_token_provider=lambda: provide_token(region=...)`
> from `aws_bedrock_token_generator`, or `AWS_BEARER_TOKEN_BEDROCK`. Confirms the
> short-term-token-from-AWS-credentials design.

> **IAM:** managed policy `AmazonBedrockMantleInferenceAccess`; actions
> `bedrock-mantle:CreateInference` and `bedrock-mantle:CallWithBearerToken`.

---

## Summary table (for the catalogue)

| Model | Model ID | Context (card) | Max output | Input | Reasoning effort | Regions (In-Region) | Prompt caching |
|---|---|---|---|---|---|---|---|
| GPT-5.4 | `openai.gpt-5.4` | 272K | N/A | text, image | not stated on card | us-east-1, us-east-2, us-west-2, **us-gov-west-1** | not listed |
| GPT-5.5 | `openai.gpt-5.5` | 272K | N/A | text, image | not stated on card | us-east-1, us-east-2 | not listed |
| GPT-5.6 Sol | `openai.gpt-5.6-sol` | 1M | N/A | text, image | none/low/medium/high/xhigh/max | us-east-1, us-east-2 | yes |
| GPT-5.6 Terra | `openai.gpt-5.6-terra` | 1M | N/A | text, image | none/low/medium/high/xhigh/max | us-east-1, us-east-2, us-west-2 | yes |
| GPT-5.6 Luna | `openai.gpt-5.6-luna` | 1M | N/A | text, image | none/low/medium/high/xhigh/max | us-east-1, us-east-2, us-west-2 | yes |

**Notes / discrepancies to resolve before finalizing metadata:**
- **Context window conflict for GPT-5.6:** the model cards (below) state **1M tokens**;
  the GPT-5.6 how-to blog says *"a 272K-token context window"*. An Aug 2026 AWS
  announcement ("GPT-5.6 Sol, Terra, and Luna now support 1 million token context
  windows on Amazon Bedrock") indicates 1M is the current/updated value. Use 1M but
  verify live.
- **Max output tokens = N/A** on every card → the extension must ship a conservative
  `maxTokens` default (spec FR-3).
- **Effort values for GPT-5.4/5.5 not stated on their AWS cards — RESOLVED via OpenAI.**
  The AWS Bedrock cards omit them, but OpenAI's own API model reference is authoritative
  for the model-level parameter set:
  - GPT-5.4: `none` (default), `low`, `medium`, `high`, `xhigh` — no `max`, no `minimal`.
    Source: https://developers.openai.com/api/docs/models/gpt-5.4
  - GPT-5.5: `none`, `low`, `medium` (default), `high`, `xhigh` — no `max`, no `minimal`.
    Source: https://developers.openai.com/api/docs/models/gpt-5.5
  Resulting `thinkingLevelMap` for both: `off→none`, `minimal→null`, `low/medium/high`
  passthrough, `xhigh→xhigh`, `max→null` (`max` is GPT-5.6-only). Satisfies FR-4c/OQ-5.
  The 5.6 family supports `none/low/medium/high/xhigh/max`.
- **GovCloud:** only **GPT-5.4** lists `us-gov-west-1`. None of 5.5 / 5.6 do — the
  primary GovCloud target remains GPT-5.4 (spec G4/G5).
- **Image input** is supported by all five (cards list Image = yes). Spec currently
  scopes `input: ["text"]` (image is a non-goal); revisit if image support is wanted.

---

## GPT-5.4
Source: https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-openai-gpt-54.html

- Launch: June 1, 2026 · Lifecycle: Active · EOL: N/A
- **Context window: 272K tokens · Max output tokens: N/A**
- Input: Text, Image · Output: Text
- APIs: Responses (yes); Chat Completions / Invoke / Converse (no)
- Endpoint: `bedrock-mantle` only · Model ID `openai.gpt-5.4`
- URL: `https://bedrock-mantle.{region}.api.aws/openai/v1`
- Features: Server-side tool calling, Client-side tool calling, Projects
- Service tiers: Standard only (Priority/Flex/Reserved: no)
- In-Region availability: us-east-1, us-east-2, us-west-2, **us-gov-west-1** (Geo/Global: no)
- Model/service card (OpenAI): https://deploymentsafety.openai.com/gpt-5-4-thinking/gpt-5-4-thinking.pdf

> *"GPT-5.4 brings frontier reasoning, coding, computer use, long-context workflows,
> and tool use to Amazon Bedrock."*

## GPT-5.5
Source: https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-openai-gpt-55.html

- Launch: June 1, 2026 · Lifecycle: Active · EOL: N/A
- **Context window: 272K tokens · Max output tokens: N/A**
- Input: Text, Image · Output: Text
- APIs: Responses (yes); others (no) · Endpoint: `bedrock-mantle` · ID `openai.gpt-5.5`
- URL: `https://bedrock-mantle.{region}.api.aws/openai/v1`
- Features: Server-side tool calling, Client-side tool calling, Projects
- Service tiers: Standard only
- In-Region availability: us-east-1, us-east-2 (card lists no us-west-2, no GovCloud)
- Model/service card (OpenAI): https://deploymentsafety.openai.com/gpt-5-5/gpt-5-5.pdf

> *"GPT-5.5 is OpenAI's most capable model, designed for advanced coding, research,
> analysis, software operation, document workflows, and long-running agentic tasks."*

## GPT-5.6 Sol
Source: https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-openai-gpt-56-sol.html

- Launch: July 13, 2026 · Lifecycle: Active · EOL: N/A
- **Context window: 1M tokens** (max output not listed)
- Input: Text, Image · Output: Text
- APIs: Responses (yes) · Endpoint: `bedrock-mantle` · ID `openai.gpt-5.6-sol`
- URL: `https://bedrock-mantle.{region}.api.aws/openai/v1`
- Features: Server-side tool calling, Projects, **Prompt caching**
- Service tiers: Standard only
- In-Region availability: us-east-1, us-east-2
- Model/service card (OpenAI): https://deploymentsafety.openai.com/gpt-5-6/gpt-5-6.pdf

> *"GPT-5.6 Sol is the most capable OpenAI model yet, delivering frontier reasoning
> and state-of-the-art agentic performance across coding, cybersecurity, and
> scientific research."*

## GPT-5.6 Terra
Source: https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-openai-gpt-56-terra.html

- Launch: July 13, 2026 · Lifecycle: Active · EOL: N/A
- **Context window: 1M tokens** (max output not listed)
- Input: Text, Image · Output: Text
- APIs: Responses (yes) · Endpoint: `bedrock-mantle` · ID `openai.gpt-5.6-terra`
- Features: Server-side tool calling, Projects, **Prompt caching**
- Service tiers: Standard only
- In-Region availability: us-east-1, us-east-2, us-west-2

> *"GPT-5.6 Terra is the balanced model for everyday production work. It delivers
> superior performance to GPT-5.5 at a lower cost, completing tasks with fewer output
> tokens for stronger performance per dollar."*

## GPT-5.6 Luna
Source: https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-openai-gpt-56-luna.html

- Launch: July 13, 2026 · Lifecycle: Active · EOL: N/A
- **Context window: 1M tokens** (max output not listed)
- Input: Text, Image · Output: Text
- APIs: Responses (yes) · Endpoint: `bedrock-mantle` · ID `openai.gpt-5.6-luna`
- Features: Server-side tool calling, Projects, **Prompt caching**
- Service tiers: Standard only
- In-Region availability: us-east-1, us-east-2, us-west-2

> *"GPT-5.6 Luna is the fast and affordable model from OpenAI. Use Luna for
> high-volume inference tasks like classification, summarization, routing, and
> real-time applications."*

---

## Reasoning effort (OQ-5) — authoritative for GPT-5.6
Source: https://aws.amazon.com/blogs/machine-learning/get-started-with-openai-gpt-5-6-sol-terra-and-luna-on-amazon-bedrock/

> *"They also support `none`, `low`, `medium`, `high`, `xhigh`, and `max` reasoning
> effort, so you can switch models without changing your API integration."*

> *"You access GPT-5.6 models through the OpenAI Responses API on the `bedrock-mantle`
> endpoint. The base URL is `https://bedrock-mantle.{region}.api.aws`, and the
> Responses API is served at `/openai/v1/responses`. ... This `openai/v1` path is
> specific to the OpenAI models."*

Implication for `thinkingLevelMap`: GPT-5.6 accepts `none` (off), `low`, `medium`,
`high`, `xhigh`, `max` — so for the 5.6 family `xhigh`/`max` should map to real
values rather than `null`. GPT-5.4/5.5 effort set still to be confirmed live.

## Pricing (per OpenAI, billed via AWS)
Sources:
- OpenAI GPT-5.6 launch: https://openai.com/index/gpt-5-6/ —
  *"Sol is $5 input / $30 output; Terra is $2.50 input / $15 output; and Luna is
  $1 input ..."* (Update Jul 30, 2026: Luna reduced 80%, Terra reduced 20%.)
- AWS states Bedrock pricing matches OpenAI first-party rates; authoritative current
  rates: https://aws.amazon.com/bedrock/pricing/ (per-token; N/A values must be read
  live). GPT-5.4/5.5 per-token rates not quoted on cards — read from pricing page.

## Related announcements
- GPT-5.4 & 5.5 GA / regions: https://aws.amazon.com/about-aws/whats-new/2026/06/openai-gpt-us-east-virginia-amazon/
- GPT-5.6 GA: https://aws.amazon.com/about-aws/whats-new/2026/07/openai-gpt-sol-terra/
- GPT-5.6 1M context update: https://aws.amazon.com/about-aws/whats-new/2026/08/gpt-sol-terra-luna-long-context-bedrock
- Consolidated OpenAI model list: https://docs.aws.amazon.com/bedrock/latest/userguide/model-cards-openai.html
