# Bedrock Mantle OpenAI Provider Extension for Pi

A Pi extension that registers a custom model provider routing OpenAI models—primarily `openai.gpt-5.4` and the `gpt-5.6` family—through Amazon Bedrock's OpenAI-compatible **Mantle** endpoint (`bedrock-mantle`).

Standard Bedrock integrations use the Bedrock Converse API, which does not support recent OpenAI models. This extension enables access via the OpenAI **Responses API** on Bedrock Mantle using standard AWS credentials and short-term bearer tokens generated via `@aws/bedrock-token-generator`.

---

## Features

- **Responses API Support:** Streams responses using Pi's built-in OpenAI Responses API pipeline.
- **AWS GovCloud Compatibility:** Fully compatible with `us-gov-west-1` (`https://bedrock-mantle.us-gov-west-1.api.aws/openai/v1`).
- **Seamless Credential Integration:** Uses the default AWS credential chain (environment variables, IAM roles, SSO, AWS shared credentials file).
- **Zero-Storage Privacy Default:** Defaults payloads to `store: false` to prevent server-side content retention on Bedrock endpoints.
- **Frontier Model Catalog:** Pre-configured support for:
  - `openai.gpt-5.4` (Available in AWS GovCloud `us-gov-west-1` and commercial regions)
  - `openai.gpt-5.5`
  - `openai.gpt-5.6-sol`
  - `openai.gpt-5.6-terra`
  - `openai.gpt-5.6-luna`

---

## Installation

Install the package into Pi using `pi install`:

```bash
pi install git:github.com/stigian-ai/pi-extension-bedrock-mantle-openai
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
- (Or AWS Managed Policy: `AmazonBedrockMantleInferenceAccess`)

### 2. Region Selection

The region is resolved in the following precedence order:
1. `region` specified in Pi configuration (`settings.json` or `models.json`)
2. `AWS_REGION` environment variable
3. `AWS_DEFAULT_REGION` environment variable

#### Commercial Region Example:
```bash
export AWS_REGION="us-east-1"
```

#### AWS GovCloud Example:
```bash
export AWS_REGION="us-gov-west-1"
```

### 3. Provider Settings (Optional)

You can customize provider options in `.pi/settings.json` or `~/.pi/agent/settings.json`:

```json
{
  "bedrock-mantle-openai": {
    "region": "us-gov-west-1",
    "store": false,
    "baseUrl": "https://bedrock-mantle.us-gov-west-1.api.aws/openai/v1"
  }
}
```

- `region`: Overrides environment region resolution.
- `store`: `false` (default) disables server-side prompt/response persistence; set to `true` to enable.
- `baseUrl`: Custom endpoint override.

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

## Uninstallation

To remove the extension and restore default host behavior:

```bash
pi remove pi-extension-bedrock-mantle-openai
```

Or remove the extension entry from your `.pi/settings.json` or `~/.pi/agent/settings.json` file.
