# Webhook receiver

## Example user request

"When someone fills in our website form, the form provider should send the
lead straight into our lead board."

## Fit and starting point

One app: a public webhook route receives the provider's deliveries, and a
private board shows the leads. A webhook route is a public `api` route with a
`webhook` block. Topline passes the provider headers it names and the exact
request body, and with `verify` it checks an HMAC signature before your
handler runs. A bad, stale or missing signature gets 401 and your code never
sees it.

Start like [Public form, private board](../public-form-private-board/EXAMPLE.md):
company tables through server table SQL (`serverTables: true`, no `tables[]`),
Node server code. The platform's signature check runs in the Node adapter; a
Python app lists the headers in `passHeaders` and verifies in its own code.

Provider header names and signature shapes are in
[Webhook provider recipes](../../references/webhook-recipes.md).

## The manifest

```json
{
  "manifestVersion": 2,
  "id": "lead-intake",
  "title": "Lead intake",
  "kind": "tool",
  "runtime": { "target": "aws_lambda_function_url", "region": "us-west-2", "entryPoint": "artifactApp", "language": "node" },
  "build": { "command": "npm run build", "outputDir": "dist" },
  "validation": { "localCommand": "npm test" },
  "routes": [
    { "path": "/", "kind": "page", "handler": "artifactApp" },
    { "path": "/_artifact/api/leads", "kind": "api", "handler": "artifactApp" },
    {
      "path": "/_artifact/api/hooks/forms",
      "kind": "api",
      "handler": "artifactApp",
      "audience": "public",
      "webhook": {
        "passHeaders": ["x-form-signature", "x-form-delivery-id", "x-form-timestamp"],
        "verify": {
          "scheme": "hmac-sha256",
          "secret": "forms_signing_secret",
          "signatureHeader": "x-form-signature",
          "encoding": "hex",
          "prefix": "sha256=",
          "signedPayload": "timestamp.body",
          "timestampHeader": "x-form-timestamp",
          "toleranceSeconds": 300
        }
      }
    }
  ],
  "secretBindings": [
    { "name": "forms_signing_secret", "env": "FORMS_SIGNING_SECRET_ARN", "secretArn": "<from the secret flow>" }
  ],
  "serverTables": true,
  "sourceBindings": [],
  "env": ["PLATFORM_ARTIFACT_ID", "PLATFORM_ARTIFACT_VERSION_ID"],
  "viewerPolicy": "private"
}
```

Rules inspect and validate-local enforce:

- `webhook` needs `kind: "api"` and `audience: "public"` on one exact path
  (no `/*`), at most 5 webhook routes per app, never a platform route.
- `passHeaders`: up to 10 lowercase names. Never `cookie`, `host`, hop-by-hop
  headers, `x-platform-*`, `x-forwarded-*` or other platform headers.
  `authorization` is allowed here only, for providers that send a static
  bearer.
- `verify.secret` names a `secretBindings` entry. The signature and timestamp
  headers must also be in `passHeaders`. `timestampHeader` and
  `toleranceSeconds` go together, and the timestamp must be signed:
  `timestampHeader` needs `signedPayload: "timestamp.body"`. For a provider
  that sends a timestamp but doesn't sign it, use `signedPayload: "body"` with
  no `timestampHeader`.
- `authorization` reaches Node and Python apps under its own name.
- `scheme` is `hmac-sha256` (or `hmac-sha1` for older senders); `encoding` is
  `hex` or `base64`; `prefix` is stripped from each signature. The header may
  carry several signatures, comma or space separated; any one matching passes.

## Getting the signing secret

Never ask the person to paste the secret into chat, and never put it in
source. Request it through the secret flow with a hint for where the
provider shows it ("Form settings > Webhooks > Signing secret"), then bind it
in `secretBindings`. A draft can't deploy until the binding is approved, so
the secret is always there when the check runs.

If the provider lets you choose the secret, ask the person to generate a long
random value in their password manager, paste it into the provider and into
the secret request. You never see it.

Topline reads the secret with the app's own role and keeps it in memory for
five minutes. After a rotation, a signature that fails against a cached copy
older than 30 seconds is checked once more against a fresh read, so the new
secret works right away. If a read fails, Topline keeps using the last secret
it read.

To rotate, change the secret in Topline first, then in the provider. The other
way round, the provider's own address sends deliveries signed with a secret
Topline doesn't have yet, and it can briefly hit the limit of 30 rejected
deliveries a minute and get 429s.

## The handler: dedupe, then answer quickly

Providers retry, so the same delivery can arrive twice. Keep a table with a
unique delivery ID and let the database drop the duplicate:

```sql
create table company_data.form_deliveries (
  delivery_id text not null unique,
  received_at timestamptz not null default now(),
  payload jsonb not null
)
```

```js
export async function artifactApp(req, res) {
  if (req.url.split("?")[0] === "/_artifact/api/hooks/forms" && req.method === "POST") {
    // Topline already checked the signature; this header says so.
    if (req.headers["x-platform-webhook-verified"] !== "true") return send(res, 401, { error: "unverified" });
    const body = await readBody(req); // the exact bytes the provider sent
    const deliveryId = req.headers["x-form-delivery-id"];
    if (!deliveryId) return send(res, 400, { error: "delivery_id_missing" });
    await tablesSql(req,
      `insert into company_data.form_deliveries (delivery_id, payload)
       values (:deliveryId, cast(:payload as jsonb))
       on conflict (delivery_id) do nothing`,
      { deliveryId, payload: body.toString("utf8") },
      "form-webhook");
    // A duplicate is still a success: answer 200 so the provider stops retrying.
    return send(res, 200, { ok: true });
  }
  // ...the private board and its api
}
```

- Answer 2xx as soon as the delivery is stored. Do heavier work (enrichment,
  notifications) afterwards within the request deadline, or from the board.
- Your status goes back to the provider: a 5xx makes it retry, as normal.
- `x-platform-body-sha256` carries the hash of the bytes Topline received if
  you want to confirm what arrived.
- A text body (JSON, form or plain text) that isn't valid UTF-8 can't reach
  the app byte for byte, so it fails closed with 400 `webhook_body_mismatch`.
  Binary content types arrive unchanged.
- The tolerance window stops old deliveries, not a replay inside it: always
  dedupe on the delivery ID.
- There is no platform queue or replay. If the app is down, the provider's
  own retries cover it.

Webhook routes have their own rate limit: 600 deliveries a minute per route,
with no per-address limit on good deliveries, because providers send from a
few addresses. An address that sends more than 30 deliveries a minute with a
bad signature or timestamp gets 429 for the rest of that minute. During a
secret rotation that can be the provider's own address, so rotate the secret
in Topline first, then in the provider.

## Test with signed samples before publishing

Drafts are members-only, so a provider can't reach one. Test locally with the
platform's own check:

```sh
node scripts/artifacts/webhook-sample --dir <appDir> --route /_artifact/api/hooks/forms --body samples/lead.json
```

It signs the sample with a local test secret and runs it through the exact
verifier the adapter uses (`scripts/artifacts/lib/webhook-verifier.mjs`): a
good signature reaches your handler and gets 2xx, a bad one gets 401 and never
reaches it, a stale timestamp gets 401, and the same delivery twice gets 2xx
both times. In your own tests, also assert that the duplicate adds no second
row.

Outside the coding workspace, write the same test with `node:crypto`: compute
`createHmac("sha256", testSecret).update(body).digest("hex")`, add the
`prefix`, and check your handler's dedupe with a fake `tablesSql`.

## Hand off the URL

After the person publishes, the webhook URL is the live app address plus the
route path, on the Topline address or a company-domain address:

```text
https://<app address>/_artifact/api/hooks/forms
```

Tell the person:

- "Paste this URL into <provider> after you publish", with the provider's
  setting names from the recipe.
- The publish dialog lists it under "Receives webhooks at", with whether
  Topline checks its signature. Adding a webhook, removing `verify`, changing
  its secret or adding a `passHeaders` name needs a person to publish.
- The app's sharing panel shows the last verified delivery and how many
  signatures were rejected in the last 24 hours.
