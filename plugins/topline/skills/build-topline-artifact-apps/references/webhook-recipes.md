# Webhook provider recipes

Starting points for a webhook route's `passHeaders` and `verify` (see
[Webhook receiver](../examples/webhook-receiver/EXAMPLE.md)). Providers change
their headers and signing; check each against the provider's current docs
before you ship.

## Generic HMAC

Most providers that say "HMAC-SHA256 of the request body":

```json
{
  "webhook": {
    "passHeaders": ["x-signature", "x-delivery-id"],
    "verify": { "scheme": "hmac-sha256", "secret": "provider_signing_secret", "signatureHeader": "x-signature", "encoding": "hex" }
  }
}
```

- `encoding`: `hex` or `base64`, whichever the docs show.
- `prefix`: set it when the header looks like `sha256=<digest>`.
- Older senders using SHA-1 (for example `X-Hub-Signature`): `scheme: "hmac-sha1"`.
- GitHub-style: `"signatureHeader": "x-hub-signature-256"`, `"prefix": "sha256="`,
  delivery ID in `x-github-delivery`.

## Timestamped signatures

When the provider signs `<timestamp>.<body>` and sends the timestamp in its
own header:

```json
{
  "verify": {
    "scheme": "hmac-sha256", "secret": "provider_signing_secret",
    "signatureHeader": "x-signature", "encoding": "hex",
    "signedPayload": "timestamp.body", "timestampHeader": "x-timestamp", "toleranceSeconds": 300
  }
}
```

List both headers in `passHeaders`. Deliveries older or newer than the
tolerance get 401 `webhook_timestamp_out_of_range`. `timestampHeader` is only
allowed with `signedPayload: "timestamp.body"`: a timestamp outside the
signature could be swapped for a fresh one on a replayed delivery. Even a
signed timestamp lets a delivery be replayed inside the tolerance window, so
dedupe on the delivery ID either way.

## Stripe, Slack and Standard Webhooks

These put the timestamp inside the signature header or use their own secret
format (`whsec_` keys), which the generic check doesn't parse. Don't use
`verify`: list the headers in `passHeaders` and verify in your code with the
provider's official SDK helper, using the secret from `platformSecrets.get`.

- Stripe: `passHeaders: ["stripe-signature"]`, then
  `stripe.webhooks.constructEvent(rawBody, req.headers["stripe-signature"], secret)`.
- Slack: `passHeaders: ["x-slack-signature", "x-slack-request-timestamp"]`;
  the signature is `v0=` + HMAC-SHA256 of `v0:<timestamp>:<body>`. Use the
  Slack SDK's verifier and check the timestamp is within five minutes.
- Standard Webhooks (Svix and others): `passHeaders: ["webhook-id",
  "webhook-timestamp", "webhook-signature"]`, then the `standardwebhooks`
  library's `verify`.

Use the raw body bytes for these checks, never re-serialized JSON.

## Typeform

`passHeaders: ["typeform-signature"]`, `scheme: "hmac-sha256"`,
`encoding: "base64"`, `prefix: "sha256="`. You set the secret in Typeform's
webhook settings, so ask the person to generate it in a password manager and
paste it into both Typeform and the secret request.

## Jotform, Gravity Forms and other static bearers

Providers that send a fixed token instead of a signature: put `authorization`
(or their token header) in `passHeaders`, no `verify`, and compare the token
in your code with `crypto.timingSafeEqual` against the bound secret. Treat
the route as unverified in the handoff; the publish dialog shows "Signature
not checked by Topline".

## Duplicates and replays

Every provider retries, and a captured delivery can be replayed while its
timestamp is within the tolerance. Store the provider's delivery ID (or event ID) in a
table column with a unique constraint and `insert ... on conflict do nothing`,
then answer 200 for a duplicate.
