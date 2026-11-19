# Signed webhook boundary

## Example user request

"Accept provider event notifications, safely record each event once, and show operators the receiver status."

## Classification: an artifact app with a webhook route

This used to be platform-service work. Apps now receive webhooks on a public
`api` route with a `webhook` block: Topline passes the provider headers the
manifest names and the exact body, checks an HMAC signature before the handler
runs, and the app records each event once with a unique delivery ID. Build it
from [Webhook receiver](../webhook-receiver/EXAMPLE.md) and the
[provider recipes](../../references/webhook-recipes.md).

## What still belongs to a platform service

- Durable queueing, platform retries, a delivery log or replay. Webhook routes
  answer synchronously; the provider's own retries cover app downtime.
- Signature schemes that aren't HMAC (RSA or Ed25519 signatures, mutual TLS,
  IP allowlists) beyond what the app can check itself from `passHeaders`.
- Webhooks into `kind: "mcp_server"` apps.
