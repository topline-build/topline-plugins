# Public form, private board

## Example user request

"Put a 'Request a quote' form on our website. New requests should land on a
pipeline board only our sales team can see."

## Fit and starting point

One app with a public front and a private back office. The quote form and its
submit route are public routes (`audience: "public"`); the board is private,
like any other route. Never split this into two apps that share a table.

The data lives in company tables and every read and write runs in the app's
server code through server table SQL, as in
[Table approvals app](../table-approvals-app/EXAMPLE.md). With the Build MCP,
start from `platform_init_artifact_app` with `starter: "table-approvals-app"`
and reshape it; in a coding task, start from
`scripts/artifacts/templates/table-editor` and move writes into server code.

## Topology and contract decisions

- Two entry points: `quote.html` (+ `quote.js`) for the public form and
  `index.html` (+ `board.js`) for the board. The form never loads the board's
  bundle, so no private screen code or route names become public. Inspect
  errors when a public page loads a file from a private route and warns when a
  file is shared with private pages.
- `serverTables: true` and **no** `tables[]`: public routes never reach
  `/_artifact/tables/*`, and a binding would hand the board's rows to any
  viewer's browser.
- The submit handler writes with `actingUser: "public-quote-form"`, so row
  history says where a lead came from. Board actions use the signed-in
  viewer's `x-platform-viewer-email` as `actingUser`.
- The form must work with no viewer email. A signed-in staff member who can
  see the app still gets their email on the form page, so it may show a
  "Open the board" link to them.
- `embed.allowedOrigins` lists the company website so the form can sit in an
  iframe there.

```json
{
  "manifestVersion": 2,
  "id": "quote-pipeline",
  "title": "Quote pipeline",
  "kind": "tool",
  "runtime": { "target": "aws_lambda_function_url", "region": "us-west-2", "entryPoint": "artifactApp", "language": "node" },
  "build": { "command": "npm run build", "outputDir": "dist" },
  "validation": { "localCommand": "npm test" },
  "routes": [
    { "path": "/", "kind": "page", "handler": "artifactApp" },
    { "path": "/assets/*", "kind": "asset", "handler": "artifactApp" },
    { "path": "/quote", "kind": "page", "handler": "artifactApp", "audience": "public" },
    { "path": "/quote-assets/*", "kind": "asset", "handler": "artifactApp", "audience": "public" },
    { "path": "/_artifact/quote", "kind": "api", "handler": "artifactApp", "audience": "public" },
    { "path": "/_artifact/api/leads", "kind": "api", "handler": "artifactApp" }
  ],
  "serverTables": true,
  "embed": { "allowedOrigins": ["https://www.example-pest.com"] },
  "sourceBindings": [],
  "env": ["PLATFORM_ARTIFACT_ID", "PLATFORM_ARTIFACT_VERSION_ID"],
  "viewerPolicy": "private"
}
```

## Create the table

Run with `platform_run_artifact_workspace_sql` (`scope: "company"`), with the
column documentation company tables need:

```sql
create table company_data.quote_leads (
  name text not null,
  email text not null,
  phone text,
  address text,
  service text,
  message text,
  stage text not null default 'new',
  source_ip text,
  owner_email text,
  dedupe_key text unique
)
```

Document `dedupe_key` too ("Email plus ten-minute bucket; blocks repeat submits").

## The public submit route

`POST /_artifact/quote` in the server code, in this order:

1. Refuse a body over a few kilobytes and anything but JSON.
2. Honeypot: a hidden `company_website` field must be empty; when it isn't,
   answer 200 and store nothing.
3. Verify the Turnstile token: post it with the secret key and
   `remoteip` set to the `x-platform-client-ip` header to
   `https://challenges.cloudflare.com/turnstile/v0/siteverify`. Get the secret
   key through the secret request flow and bind it with `secretBindings`;
   never put it in source. The site key in `quote.html` is public.
4. Validate fields; trim, cap lengths, require a plausible email.
5. Duplicate check the database enforces: give `quote_leads` a
   `dedupe_key text unique` column, fill it with the email and the current
   ten-minute bucket (fixed buckets, so two submits either side of a bucket
   edge both save), and let a repeat do nothing. A `where not exists (...)`
   check races: twenty identical submits at once saved three rows in a test,
   while the unique key saved one.

```js
const windowStart = Math.floor(Date.now() / 600_000); // ten-minute buckets
await tablesSql(req,
  `insert into company_data.quote_leads (name, email, phone, address, service, message, source_ip, dedupe_key)
   values (:name, :email, :phone, :address, :service, :message, :ip, :dedupeKey)
   on conflict (dedupe_key) do nothing`,
  { ...fields, ip: req.headers["x-platform-client-ip"] ?? null,
    dedupeKey: `${fields.email.toLowerCase()}:${windowStart}` },
  "public-quote-form");
```

Answer the same "Thanks, we'll be in touch" for a new lead and a duplicate so
the form can't be used to probe who has asked. Topline already limits each
visitor address to 20 submits a minute (429 with `Retry-After`) before this
code runs.

## The private board

`/` and `/_artifact/api/leads` are private: signed-in members the app is shared
with open them; a signed-out visitor is sent to Topline sign-in and back. The
board lists `quote_leads` by `stage` and moves a lead with an optimistic update
(`where _row_id = :id and _version = :version`), answering 409 on a conflict.

## Embedding

Give the website owner either snippet. Both work on the Topline address and on
a company-domain address:

```html
<iframe src="https://<app address>/quote" title="Request a quote"
        style="width:100%;min-height:640px;border:0" loading="lazy"></iframe>
```

```html
<a href="https://<app address>/quote">Request a quote</a>
```

The iframe works only on the sites in `embed.allowedOrigins`. The form page
sets no cookies, so browsers that block third-party cookies still show it.

## Verify and hand off

- validate-local and inspect pass with no public-page errors (and no shared
  bundle warning).
- Drafts are members-only; check the form as a signed-out visitor with the
  anonymous smoke when it is offered.
- In the handoff, say that `/quote`, `/quote-assets/*` and `/_artifact/quote`
  become public when they publish, and that the publish dialog lists them. The
  app's sharing panel can turn public pages off at once.
