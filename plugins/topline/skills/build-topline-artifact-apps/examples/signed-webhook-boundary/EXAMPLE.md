# Signed webhook boundary

## Example user request

"Accept provider event notifications, safely record each event once, and show operators the receiver status."

## Classification: platform service, not an artifact app

Do not create an `artifact-app.json` for this request under the current contract. Raw artifact Lambda URLs require AWS IAM, stable artifact routes authorize a viewer before forwarding, and the proxy does not forward arbitrary provider signature, timestamp, or delivery-ID headers. The artifact runtime also has no general transactional idempotency store for machine ingress.

A secret binding and declared API path do not create a public webhook. Dropping viewer checks would still leave an unreachable or unverifiable route and would weaken the platform boundary.

## Required platform-service design

Use an explicitly reviewed machine-ingress service with:

- a narrowly exposed endpoint and provider-specific verification adapter based on current vendor documentation;
- exact raw-body preservation and an allowlist for required signature, timestamp, and delivery-ID headers;
- bounded body size, rate limiting, secret rotation, constant-time signature checks, and replay-window enforcement;
- a durable idempotency store with a uniqueness constraint, retention policy, atomic effect boundary, and ambiguous-outcome reconciliation;
- queue/dead-letter handling when processing is not safely synchronous;
- redacted logs, observable failures, and safe provider acknowledgments.

An artifact app may be an adjacent private operations dashboard over approved webhook status data after that service exists. It does not own ingress.

## Evidence required before this becomes artifact-native

Only add a webhook artifact specimen after the platform contract has a tested per-route machine-ingress capability, provider-header forwarding contract, body/rate controls, and durable idempotency boundary. Validation must send signed deliveries through the deployed ingress, reject bad/stale/replayed requests, preserve exact bytes and headers, and prove concurrent duplicates create one effect.
