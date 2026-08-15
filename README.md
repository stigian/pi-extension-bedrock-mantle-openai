# Bedrock Mantle OpenAI Provider Extension for Pi

A Pi extension that registers a custom model provider routing OpenAI frontier models through Amazon Bedrock's OpenAI-compatible **Mantle** endpoint (`bedrock-mantle`).

Standard Bedrock integrations use the Bedrock Converse API, which does not support recent OpenAI models. This extension uses the OpenAI **Responses API** on Bedrock Mantle with standard AWS credentials and short-term bearer tokens generated via `@aws/bedrock-token-generator`.

---

## Features

- **Responses API Support:** Streams responses using Pi's built-in OpenAI Responses API pipeline.
- **AWS GovCloud Compatibility:** Compatible with `us-gov-west-1` (`https://bedrock-mantle.us-gov-west-1.api.aws/openai/v1`).
- **Provider-Scoped Env Support:** Honors Pi provider-scoped env overrides for region and AWS credential resolution.
- **Standard Responses Defaults:** Uses Pi's built-in OpenAI Responses pipeline and leaves its default `store: false` behavior unchanged.
- **Frontier Model Catalog:** Pre-configured support for:
  - `openai.gpt-5.4`
  - `openai.gpt-5.5`
  - `openai.gpt-5.6-sol`
  - `openai.gpt-5.6-terra`
  - `openai.gpt-5.6-luna`

---

## Installation

Install the package into Pi using `pi install`:

```bash
pi install git:github.com/stigian/pi-extension-bedrock-mantle-openai
```

Or for local development:

```bash
pi -e ./pi-extension-bedrock-mantle-openai
```

---

## Configuration

### 1. AWS Credentials

Ensure your environment has valid AWS credentials with permissions for Bedrock Mantle:

```bash
export AWS_ACCESS_KEY_ID="AKIA..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_SESSION_TOKEN="..." # If using temporary credentials / SSO
```

**Required IAM Permissions:**
- `bedrock-mantle:CallWithBearerToken`
- `bedrock-mantle:CreateInference`
- or AWS managed policy `AmazonBedrockMantleInferenceAccess`

### 2. Region Selection

The effective AWS region is resolved in the following precedence order:
1. explicit runtime/provider option `region` when the caller supplies one
2. provider-scoped `AWS_REGION`
3. process `AWS_REGION`
4. provider-scoped `AWS_DEFAULT_REGION`
5. process `AWS_DEFAULT_REGION`
6. the region encoded in a standard Mantle base URL such as `https://bedrock-mantle.us-gov-west-1.api.aws/openai/v1`
7. fallback to `us-east-1` when the standard default Mantle endpoint is in use

Examples:

```bash
export AWS_REGION="us-east-1"
# or
export AWS_REGION="us-gov-west-1"
```

Pi provider-scoped env also works through `auth.json` or other provider auth flows, so Mantle can use different AWS settings than the surrounding shell environment.

### 3. Preferred `baseUrl` Override in `models.json`

Pi already supports provider-level `baseUrl` overrides in `models.json`. Use that standard mechanism for endpoint overrides:

```json
{
  "providers": {
    "bedrock-mantle-openai": {
      "baseUrl": "https://bedrock-mantle.us-gov-west-1.api.aws/openai/v1"
    }
  }
}
```

Per-model overrides remain available through Pi's standard `modelOverrides` support.

If the override points at a standard Mantle hostname, the extension infers the AWS region from that hostname automatically. For custom proxy hostnames, set `AWS_REGION` or `AWS_DEFAULT_REGION` as well so bearer token generation still has an explicit region.

---

## Usage

List available models to verify provider registration:

```bash
pi --list-models
```

Select a model interactively in Pi using `/model` or specify it on the command line:

```bash
pi -m bedrock-mantle-openai/openai.gpt-5.4 "Explain AWS GovCloud Bedrock Mantle endpoints"
```

---

## Validation

Run the package validation locally:

```bash
npm run check
```

This now performs three checks:
- strict TypeScript validation with `tsc --noEmit`
- a smoke-load of the extension entrypoint
- the typed verification suite under `test/verify.test.ts`

You can also run the type checker directly:

```bash
npm run typecheck
```

---

## Uninstallation

To remove the extension:

```bash
pi remove pi-extension-bedrock-mantle-openai
```

Or remove the extension entry from your `.pi/settings.json` or `~/.pi/agent/settings.json` file.
