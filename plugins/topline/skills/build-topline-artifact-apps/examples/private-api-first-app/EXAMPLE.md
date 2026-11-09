# Private API-first app

## Example user request

"Expose a small private API that validates a proposed service window and returns normalized warnings, with an in-app page explaining the endpoint."

## Fit and template

This is a bounded, deterministic API-first artifact, so start from `scripts/artifacts/templates/python-api`. `/` remains a useful private operational/docs page while the main behavior lives at the declared `/_artifact/api/validate-service-window` path. A truly headless service is platform-service work.

## Topology and boundaries

- FastAPI runs behind the Lambda Function URL through `src.app:app`; preserve the template build that installs Python dependencies into `.python`.
- The implementation accepts `POST` on the declared API path and returns `405` for other methods. Route declarations do not encode the method.
- Require the trusted platform viewer dependency. Never accept a client-supplied `isOperator`, role, email, or tenant field as authorization.
- Validate a small typed body, perform deterministic bounded computation, and return an explicit response model that allowlists fields.
- The baseline has no source binding, database, secret, cache, durable state, or background process.

## Canonical shape

```py
class WindowRequest(BaseModel):
    startLocal: time
    endLocal: time
    timezone: str = Field(min_length=1, max_length=64)

class WindowResult(BaseModel):
    valid: bool
    normalizedMinutes: int | None
    warnings: list[str]

@app.post("/_artifact/api/validate-service-window", response_model=WindowResult)
def validate_window(body: WindowRequest, viewer=Depends(require_platform_viewer)):
    return calculate_window(body)  # bounded and deterministic
```

Return `401` when the platform session is absent, `422` for invalid input, `405` for another method, and a safe `500` only for an unexpected server failure. Never return raw exceptions or additional model fields.

## Manifest explanation

The manifest names the Python entry point and exact page/API paths. `kind: "tool"` and `viewerPolicy: "private"` match a private request/response utility. The manifest alone does not implement methods, dependencies, models, or tests.

## Validation and controls

- Replace the template example endpoint and `src/check.py` assertions with this exact route and status/schema matrix.
- Test no session, non-POST methods, missing/extra fields, invalid and encoded timezones, inverted/equal windows, boundary times, and a valid request. Assert response fields exactly match `WindowResult`.
- Run `python3 src/check.py`, its structured JSON mode, and `node scripts/artifacts/validate-local --dir <appDir>` from the repository root.
- Complete commit, source sync, draft deployment, rendered smoke, validation preparation, and validation request. Verify `/` explains the authenticated API and no raw errors appear.

## Limitations and graduation boundary

Use this for bounded request/response computation attached to a visible private artifact. Source lookups need an approved data path; public APIs, issued credentials, durable state, streaming, workers, queues, or long-running processing require a separately reviewed architecture.
