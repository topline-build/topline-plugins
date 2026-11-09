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

## Data, secrets, and private state

Use catalog/read-only tools and bounded declared datasets for source data. Do
not put database URLs, source API credentials, keys, passwords, bearer tokens,
or cloud credentials in source, manifests, browser bundles, or ordinary env
variables. The app runtime must not connect directly to Postgres.

For a third-party API, declare an exact region-matching Secrets Manager ARN in
`secretBindings[]`. The runtime receives the ARN and resolves the value with
its least-privilege role (`platformSecrets.get(...)` in Node or
`get_secret(...)` in Python). Keep vendor calls server-side behind a declared
artifact route.

To save credentials from a form, declare `secretWrites` and `PUT` to
`./_artifact/secrets/<prefix><name>` from the page; never send secrets through
your own server code. That route is for a Topline-hosted app's own page only.
A server you run outside Topline instead holds an account API key and calls
`/api/v1/secrets` directly (docs/product/app-api-keys.md).

Keep company data in tables: records people add or edit in an app, or
that another app may use. For browser reads and saves, declare them in manifest
`tables[]`; the platform serves those routes and builds every SQL statement,
and their saves work only on the live app on its own origin. The app's own
server code may instead run table SQL as the app (manifest `serverTables: true`)
by POSTing to the URL in the `x-platform-tables-sql-url` request header with
the `x-platform-tables-token` it is given as a bearer token;
the app's own sign-in and logic then decide who may change what, and the
token must never reach the browser. While tables are on there are no private
workspace tables: build checkpoints and caches are tables too, so name them for
what they hold and drop them when the build is done.
Source and analytics reads remain on `run_psql`. Neither path is an unscoped
platform database escape hatch.

## Managed S3 objects

Declare `storageBindings[]` to provision durable named namespaces in the
harness-managed S3 bucket. Backends use the standard AWS SDK with resolved
`ARTIFACT_STORAGE_BINDINGS` JSON metadata and workload IAM. This supports files,
exports, app state, tags, versions, pagination and multipart uploads. Use the
provided prefix for every key and listing. Keep SDK calls and presigning behind
authenticated app routes; app code authorizes which files each viewer may
access. Signed URLs are temporary bearer capabilities. Direct browser uploads
and fetches need separately configured CORS. Drafts and live versions share a
binding's files; use separate names for test data. Redeploys and binding
removal keep objects; app deletion deletes them. Bucket
settings and other apps' namespaces stay outside the workload role. Local
builders do not receive that role.

## Webhooks and Bedrock

An ordinary private API route depends on the platform viewer/session check.
External provider webhooks are not artifact-native today: raw function URLs
require AWS IAM, stable routes authorize a viewer, required provider headers are
not a general forwarding contract, and no transactional ingress-idempotency
store is declared by the manifest. Route webhook ingestion to a reviewed
platform service; an artifact may visualize its approved status data later.

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
