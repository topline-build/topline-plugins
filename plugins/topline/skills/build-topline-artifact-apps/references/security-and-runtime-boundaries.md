# Security and Runtime Boundaries

Treat the artifact package as an untrusted application boundary with only
declared platform capabilities. A successful local build does not authorize a
cloud, database, identity, or publish operation.

## Viewer and routes

Set `viewerPolicy` to `private` or `tenant`. Route APIs under `/_artifact/*`
and call them relatively from browser code (`./_artifact/...`) so draft, live,
and immutable-version paths continue to work. Never call platform `/api/*`, use
a root-absolute artifact fetch, or add an undeclared absolute URL.

The viewer-scoped binding path is intentionally narrow: it requires a signed-in
viewer, `resource: "customers"`, and `emailField: "email"`; the runtime filters
to the matching viewer. It is not a replacement for arbitrary source ACLs.

## Roles inside your app

Topline does not provide roles inside an app; sharing only decides who can
open it. When an app has approvers, reps, agents or other kinds of user, it
keeps them in its own company table (`<app_slug>_roles`: `email`, `role`,
`granted_by`, `granted_at`) and enforces them in server code:

- Authorize only from the proxy-set `x-platform-viewer-email` header, looked
  up on each request (or cached for at most 60 seconds), and answer `403`
  when the role is missing. Browser code may hide buttons using the app's own
  `./_artifact/api/me`; it never decides access.
- Viewers with `x-platform-artifact-access: owned` (owner and editors) can
  always manage roles, so the first manager needs no seeded row. A
  `role_manager` role covers managers who don't edit the app.
- The app has a "People and roles" page for adding and removing people.
- Public routes never read roles.

Don't hardcode email lists, check roles in the browser, add a `tables[]`
binding for the roles table (any viewer could write it), or share one roles
table across apps. The pattern, the page and the 403 tests are in
[App roles](../examples/app-roles/EXAMPLE.md); the identity rules are in
[Viewer identity](viewer-identity.md#roles-inside-your-app).

## Public pages

Use public pages when one app needs a front anyone can open (a "Request a
quote" form, a booking page, a status page) and a private back office (the
pipeline board, the dispatch view). Mark only those routes public:

```json
{
  "routes": [
    { "path": "/", "kind": "page", "handler": "artifactApp" },
    { "path": "/quote", "kind": "page", "handler": "artifactApp", "audience": "public" },
    { "path": "/quote-assets/*", "kind": "asset", "handler": "artifactApp", "audience": "public" },
    { "path": "/_artifact/quote", "kind": "api", "handler": "artifactApp", "audience": "public" }
  ],
  "embed": { "allowedOrigins": ["https://www.example.com"] }
}
```

- `audience` defaults to `"viewers"`: everyone the app is shared with, as
  before. `"public"` is anyone on the internet, on the **live** app only.
  Drafts and versions stay members-only; check public pages before publishing
  with the anonymous smoke when it is offered. The one exception: a webhook
  route with `webhook.verify` also answers anonymous callers on the latest
  draft (`/draft/`), because the adapter refuses any call without a valid
  signature before your handler runs.
- Platform routes (`/_artifact/data|tables|knowledge|secrets|pipeline/*`,
  `/_artifact/me`, `/_artifact/mcp`) are never public, and a public `/*` never
  covers anything under `/_artifact/`: mark each public api route on its own
  (`/_artifact/quote`), never `/_artifact/*`. Topline decides on one canonical
  path (no `//`, decoded once, case-checked against private routes) and sends
  your code that same path; anonymous visitors must use the canonical spelling.
  A public page reads and writes only through the app's own server code:
  write submissions with server table SQL (`serverTables: true`) and an
  `actingUser` such as `"public-quote-form"`, never with `tables[]`.
- A public page loads its scripts, styles and images from public routes too,
  or visitors get a blank page; inspect and validate-local name each file
  served from a private route. Give the public page its own entry point: a
  bundle it shares with private pages becomes public (its code and route
  names, never its data), and inspect warns about it.
- What a public request gets: `x-platform-route-audience: public` and
  `x-platform-client-ip` (the visitor's address as Topline's edge saw it; use
  it, not `x-forwarded-for`). It never gets `x-platform-viewer-email`, the
  browser table token or the secrets token. Signed-in staff who can see the
  app keep their normal access and email on a public page, so it can show
  them extras; everyone else, including other Topline users and members the
  app isn't shared with, is anonymous. Never treat a missing email on a
  public route as an error.
- Topline limits anonymous visitors before your code runs: 120 page or asset
  requests and 20 api requests per minute per visitor address, and 600 public
  api requests per minute per app; over that it answers 429 with
  `Retry-After`. If Topline's shared Redis is unavailable the limits are counted
  per server task instead, so they are looser for that time; don't rely on them
  as an exact quota. Add your own checks on top: a honeypot field, duplicate
  checks, and a CAPTCHA such as Cloudflare Turnstile whose secret key comes
  through the secret request flow.
- `embed.allowedOrigins` lists up to 10 exact `https://` origins (no wildcard,
  no path) that may frame the public pages; it needs at least one public
  page. Public page responses carry `Content-Security-Policy: frame-ancestors
  'self' <Topline> <your sites>`. Your own CSP can only narrow it.
- A signed-out visitor to a private page of such an app is sent to Topline
  sign-in and back. The publish dialog lists every public path, marks new
  ones, and is the only way a version that adds public routes goes live:
  automated publishes (the app monitor's fixes) stop for a person. The app's
  sharing panel can turn all public pages off at once, with no redeploy.

## Data, secrets, and private state

Use catalog/read-only tools and bounded declared datasets for source data. Do
not put database URLs, source API credentials, keys, passwords, bearer tokens,
or cloud credentials in source, manifests, browser bundles, or ordinary env
variables. The app runtime must not connect directly to Postgres.

For a third-party API, declare an exact region-matching Secrets Manager ARN in
`secretBindings[]`. The runtime receives the ARN and resolves the value with
its least-privilege role: in Node `await globalThis.platformSecrets.get("<binding name>")`
(a global the platform installs; there is nothing to import), in Python
`from platform_artifact_secrets import get_secret`. Keep vendor calls
server-side behind a declared artifact route. See
[Server runtime recipes](server-runtime-recipes.md#secrets-in-server-code).

### Getting a key

When the app needs a third-party key (a Slack webhook, an email provider key, a
partner API token), never ask the person to paste it into your chat, never look
through files for one, and never read or echo a value.

1. Call `platform_list_build_secrets` first. Reuse an approved key; never ask
   twice for a name that is listed or pending.
2. Call `platform_request_build_secret` with a binding `name`
   (`slack_webhook_url`), a `label` for the card, a `reason` a non-engineer
   understands, and a `hint` saying where to find the value. If the person says
   the key is already on their machine, pass `source` (`{fromEnv: "VAR"}` or
   `{fromFile: ".env", key: "VAR"}`) instead: the local Topline MCP helper reads
   and uploads it, and you get back only `provided`.
3. Tell the person exactly: open `threadUrl`, find the card titled with your
   label, and paste the value there or pick a saved key. Anyone the build thread
   is shared with can fill it. If they paste a key into your chat anyway, tell
   them to rotate it.
4. Keep building against `platformSecrets.get(name)`. Before deploying, poll
   `platform_list_build_secrets`: bind each `approved` entry in `secretBindings[]`
   exactly by `name`, `secretArn` and `suggestedEnv`. On `declined`, stop and
   report the note; on `expired`, ask again once. A refused deploy names the
   binding and its request state.

A pasted key is saved for this app only: no other app can bind it, and it keeps
working if the person who pasted it leaves. See the
`notify-via-slack-or-email` example for alerts built on this.

To save credentials from a form, declare `secretWrites` and `PUT` to
`./_artifact/secrets/<prefix><name>` from the page; never send secrets through
your own server code. That route is for a Topline-hosted app's own page only.
A server you run outside Topline instead holds an account API key and calls
`/api/v1/secrets` directly (docs/product/app-api-keys.md).

Keep company data in tables: records people add or edit in an app, or
that another app may use. For browser reads and saves, declare them in manifest
`tables[]`; the platform serves those routes and builds every SQL statement,
and their saves work only on the live app on its own origin. The app's own
server code may instead run table SQL as the app (manifest `serverTables: true`,
or a list such as `["jobs:read", "job_notes:write"]` that limits it to those tables)
by POSTing to the URL in the `x-platform-tables-sql-url` request header with
the `x-platform-tables-token` it is given as a bearer token;
the app's own sign-in and logic then decide who may change what, and the
token must never reach the browser. A server-only app declares no `tables[]`:
each `tables[]` binding is a route every viewer of the app can call, and a
`list` binding returns every row's `_row_id`, `_version` and readable columns
regardless of what the server code filters. Declare `tables[]` only for
tables the browser should read or write directly, with `readableColumns`
every viewer may see. The request contract, system columns and a copyable
helper are in [Server runtime recipes](server-runtime-recipes.md). While tables are on there are no private
workspace tables: build checkpoints and caches are tables too, so name them for
what they hold and drop them when the build is done.
Source and analytics reads remain on `run_psql`. Neither path is an unscoped
platform database escape hatch.

## Managed S3 objects

Declare `storageBindings[]` to provision durable named namespaces in the
harness-managed S3 bucket. Backends use the standard AWS SDK with resolved
`ARTIFACT_STORAGE_BINDINGS` JSON metadata (an array of
`{ name, access, bucket, prefix, region }`) and workload IAM. Listing is
granted only with a `Prefix` inside the namespace, so reading a key that
doesn't exist answers 403 `AccessDenied`, not `NoSuchKey`. Request bodies
through the app proxy are limited to 4,500,000 bytes (a clean 413 above it).
Files from browsers go through the platform upload route instead: declare
`uploads` on the binding and use the vendored `artifact-uploads.js` helper; the
platform picks keys, checks every file before your `onComplete` route hears
about it, and serves downloads and per-viewer access itself (see
[Server runtime recipes](server-runtime-recipes.md#uploads-and-downloads-through-the-app)).
Never proxy file bodies through app routes or presign your own browser links
for uploaded files. Server code still supports files,
exports, app state, tags, versions, pagination and multipart uploads. Use the
provided prefix for every key and listing. Signed URLs are temporary bearer
capabilities. Server code in drafts and live versions shares a binding's files;
use separate names for test data. Browser uploads from a draft stay in the
draft's own storage. Redeploys and binding
removal keep objects; app deletion deletes them. Bucket
settings and other apps' namespaces stay outside the workload role. Local
builders do not receive that role.

## Webhooks and Bedrock

An ordinary private API route depends on the platform viewer/session check.
External provider webhooks arrive on a webhook route: a public `api` route with
a `webhook` block (see [Webhook receiver](../examples/webhook-receiver/EXAMPLE.md)).

- Only the headers in `passHeaders` reach app code, on that route only.
  `cookie`, `host`, hop-by-hop, `x-forwarded-*` and platform headers can never
  be listed. `authorization` can, on a webhook route only.
- The body arrives byte for byte, with `x-platform-body-sha256`.
- With `verify`, the app's Lambda adapter checks the HMAC signature (and
  timestamp) before the handler, on any spelling of the path. Bad or stale
  signatures get 401 and never reach app code; the handler sees
  `x-platform-webhook-verified: true`. The signing secret is read with the
  app's own role and never reaches logs, responses, the browser or the agent.
- A webhook route is a public route: no viewer identity, no table token for
  the browser, never a platform data route. Server code writes with server
  table SQL.
- Adding a webhook route, removing `verify`, changing its secret or adding a
  `passHeaders` name needs a person to publish.
- There is no platform queue, retry or replay; dedupe on a delivery ID.

The narrow machine-ingress exception is a validated, promoted
`kind: "mcp_server"` deployment at exact `/_artifact/mcp`. It uses FastMCP
3.4.7 Streamable HTTP with stateless JSON responses. Topline creates and keeps
the bearer private, IAM-signs the Lambda request, and forwards only bounded MCP
protocol headers plus a trusted platform claim. The artifact never declares,
reads, rotates, or receives that credential. A workspace manager connects the
live artifact in Developer Access, reviews every tool, and explicitly enables
chat and/or coding agents before use.

For simple chat, use one bounded server-side Bedrock `Converse` call per turn on
a private `/_artifact/api/*` route. Use the platform-injected
`platform_artifact_inference.BedrockInference` helper and
`PLATFORM_ARTIFACT_BEDROCK_MODEL_ID`. The helper assumes the model-scoped Topline
production inference role with in-memory temporary credentials; customer data
and secret clients retain workload IAM. Customers never enable models in their
own AWS accounts. Validate/bound messages, mock the call in
local tests, and return a clear `503` if the model setting is absent. Do not
hardcode a model ID, request a Bedrock API key, put Bedrock in browser code, or
silently add tools, memory, streaming, history, or an agent loop.

## Operator boundary

The sandbox must not run direct cloud deploy, IAM, database-write, or secret
commands. Use bridge tools for the documented artifact lifecycle. If the needed
bridge capability is absent, stop and name the missing tool; do not substitute
an unapproved route.
