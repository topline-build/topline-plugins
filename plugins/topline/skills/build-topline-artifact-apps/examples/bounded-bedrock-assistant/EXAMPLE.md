# Bounded Bedrock assistant

## Example user request

"Add a private question box that gives an operator one concise answer from the platform-configured model."

## Fit and template

Start from `scripts/artifacts/templates/python-api`, add pinned and tested compatible `boto3`/`botocore` versions to `requirements.txt`, keep a private page at `/`, and expose one server-side `POST /_artifact/api/chat` path. This is not an AgentCore runner or autonomous assistant.

## Contract decisions

- The browser posts to `./_artifact/api/chat`; it never holds credentials or calls Bedrock directly.
- Require the platform viewer dependency, accept one message of at most 4,000 characters, and make exactly one `Converse` operation per valid turn.
- Read the model from `PLATFORM_ARTIFACT_BEDROCK_MODEL_ID` and use the injected `platform_artifact_inference.BedrockInference` helper. Topline supplies the production inference role and region; customers do not enable AWS models. Do not add an API key, caller-supplied model, memory, tools, retrieval, streaming, transcript, worker, or schedule.
- Cap output at 512 tokens and return whether `stopReason` was `max_tokens` so the UI can say the answer reached its limit.
- Return `503` when model configuration or the bounded provider call is unavailable. Do not expose raw provider errors.

## Bounded invocation

Keep SDK timeouts and retry work inside the artifact's request deadline (30 seconds unless `resources.timeoutSeconds` raises it):

```py
from botocore.config import Config
from platform_artifact_inference import BedrockInference

client = BedrockInference(
    config=Config(
        connect_timeout=2,
        read_timeout=10,
        retries={"total_max_attempts": 1, "mode": "standard"},
    ),
)
response = client.converse(
    modelId=os.environ["PLATFORM_ARTIFACT_BEDROCK_MODEL_ID"],
    messages=[{"role": "user", "content": [{"text": question}]}],
    inferenceConfig={"maxTokens": 512},
)
result = {
    "answer": response["output"]["message"]["content"][0]["text"],
    "truncated": response.get("stopReason") == "max_tokens",
}
```

The helper assumes the model-scoped Topline production role and refreshes its in-memory credentials five minutes before expiry. It leaves customer data/secret clients on their existing workload identity. Missing or denied inference configuration fails closed; there is no customer-account Bedrock fallback. Include STS and Bedrock time in the request deadline and return the safe unavailable response on provider failures. Do not copy credentials into environment variables, source, logs, or chat.

## Validation and controls

- Replace the template's `/_artifact/api/example` implementation and `src/check.py` assertions; inherited checks do not validate chat.
- Stub the injected inference module for local tests. Test `POST` only, viewer required, invalid/no-session makes zero calls, valid makes exactly one model operation, message bounds, missing model or inference role returns `503`, bounded provider failures, `max_tokens` returns `truncated: true`, and no raw error leaks.
- Verify browser code uses the relative route and visibly distinguishes unavailable and truncated answers.
- Run structured Python checks, `node scripts/artifacts/validate-local --dir <appDir>`, source sync, draft deploy, rendered smoke, and validation.

## Limitations and graduation boundary

This is one bounded completion. Multi-turn memory, retrieval, tools, streaming, model selection, cross-user history, or autonomous execution requires explicit privacy, cost, and platform-service review.
