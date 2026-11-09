# Internal action tool

## Example user request

"Give operations a private screen to review an item and submit one approval to our existing approval API."

## Fit and template

This is a small private tool with a meaningful work surface and a bounded, idempotent external action. Start from `scripts/artifacts/templates/internal-tool`. `/` remains the operational page required for use and rendered smoke.

## Topology and contract decisions

- The implementation accepts `POST` on the declared `/_artifact/api/actions/approve` path and returns `405` for other methods. Route declarations do not encode HTTP methods.
- Browser code calls the artifact route relatively. The server re-requires the platform viewer session, validates a narrow payload, resolves `approvalApiToken` through `platformSecrets`, and calls the approval API.
- `viewerPolicy: "private"` does not provide role-level RBAC. If sharing is insufficient, use an approved authorization broker or graduate the action to platform-service work.
- Records people edit in Topline belong in tables declared in manifest `tables[]` (see [Replace a spreadsheet](../replace-a-spreadsheet/EXAMPLE.md)); this example is for a decision an external system owns. The external approval API owns the durable decision and must support an idempotency token plus lookup/reconciliation after ambiguous outcomes. Runtime code must not use artifact workspace tables, `DATABASE_URL`, or direct Postgres access as a hidden write path.
- There is no dataset, source binding, cache, or schedule. The manifest holds only a server-side secret reference, never the secret value.

## Implementation pattern

```text
require platform viewer session
require POST; otherwise return 405
validate { itemId, decision, idempotencyKey }
bind the key to actor + normalized request fingerprint; reject conflicting reuse
submit through the provider's idempotent API
on timeout, query the provider by key before deciding whether retry is safe
return the provider's durable final decision state
```

Disable the control only while its request is pending. Do not announce success before the provider's durable result returns, and render a retryable or operator-actionable failure without leaking the response body or credential.

## Manifest explanation

The manifest declares a `tool`, private page, one API path, and a Secrets Manager ARN resolved only on the server. It intentionally has no `datasets[]`; a live dataset can read a table, but this tool needs none.

## Validation and controls

- Replace the placeholder ARN with an approved tenant secret reference and verify the execution role can resolve only that secret.
- Test missing session, rejected non-POST methods, malformed payload, conflicting key reuse, duplicate same-request key, provider rejection, ambiguous timeout reconciliation, and a successful first write.
- Assert a retry returns the same provider result without a duplicate effect and no browser bundle, log, or error contains the credential.
- Run local validation, commit/source sync, draft deploy, rendered smoke, validation preparation, and validation request. Smoke must show a useful private action surface and truthful failure/success state.

## Limitations and graduation boundary

Use this only for a bounded, low-volume action against an existing idempotent API. A destination without reconciliation, role rules the artifact cannot enforce, multi-step approvals, queues, long-running jobs, compensation, high-concurrency workflow state, or no meaningful UI requires platform-service work.
