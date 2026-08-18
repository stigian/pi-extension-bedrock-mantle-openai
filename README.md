# Bedrock Mantle OpenAI Provider for Pi

A [Pi](https://pi.dev/) extension that adds support for OpenAI models on Amazon Bedrock's OpenAI-compatible Mantle endpoint.

Standard Bedrock integrations use the Bedrock Converse API, which does not support recent OpenAI models. This extension calls the OpenAI Responses API on Bedrock Mantle, using AWS credentials to mint short-lived bearer tokens via `@aws/bedrock-token-generator`.

## Features

- Uses standard AWS credential configuration (same as the Bedrock provider)
- AWS GovCloud support
- Model catalog includes GPT-5-series models available on Bedrock Mantle
  - `openai.gpt-5.4`
  - `openai.gpt-5.5`
  - `openai.gpt-5.6-sol`
  - `openai.gpt-5.6-terra`
  - `openai.gpt-5.6-luna`

## Installation

```bash
pi install git:github.com/stigian/pi-extension-bedrock-mantle-openai
```

For local development, install from a checkout:

```bash
pi install ./pi-extension-bedrock-mantle-openai
```

## Configuration

### 1. AWS credentials

Provide AWS credentials with permission to call Bedrock Mantle:

**AWS profile / SSO**

```bash
export AWS_PROFILE="..."
```

**STS credentials**

```bash
export AWS_ACCESS_KEY_ID="AKIA..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_SESSION_TOKEN="..."
```

Required IAM permissions:

- `bedrock-mantle:CallWithBearerToken`
- `bedrock-mantle:CreateInference`

Or the AWS managed policy `AmazonBedrockMantleInferenceAccess`.

### 2. Region

The effective AWS region is resolved in this order:

1. Explicit `region` option passed at runtime.
2. Provider-scoped `AWS_REGION`.
3. Process `AWS_REGION`.
4. Provider-scoped `AWS_DEFAULT_REGION`.
5. Process `AWS_DEFAULT_REGION`.
6. The region encoded in a standard Mantle base URL (e.g. `https://bedrock-mantle.us-gov-west-1.api.aws/openai/v1`).
7. Fallback to `us-east-1` when the default Mantle endpoint is in use.

```bash
export AWS_REGION="us-gov-west-1"
```

Provider environment variables from `auth.json` or other Pi provider auth flows also apply, so Mantle can use different AWS settings than the surrounding shell.

### 3. `baseUrl` override in `models.json`

Use Pi's standard provider `baseUrl` override to target a specific endpoint:

```json
{
  "providers": {
    "bedrock-mantle-openai": {
      "baseUrl": "https://bedrock-mantle.us-gov-west-1.api.aws/openai/v1"
    }
  }
}
```

Per-model overrides work through Pi's standard `modelOverrides` support.

When the override points at a standard Mantle hostname, the extension infers the AWS region from it. For custom proxy hostnames, also set `AWS_REGION` or `AWS_DEFAULT_REGION` so bearer token generation has an explicit region.

## Usage

Verify the provider is registered:

```bash
pi --list-models
```

Select a model interactively with `/model`, or specify one on the command line:

```bash
pi -m bedrock-mantle-openai/openai.gpt-5.4 "Explain AWS GovCloud Bedrock Mantle endpoints"
```

## Uninstallation

```bash
pi remove pi-extension-bedrock-mantle-openai
```

Or remove the entry from `.pi/settings.json` or `~/.pi/agent/settings.json`, depending on where it was installed.
