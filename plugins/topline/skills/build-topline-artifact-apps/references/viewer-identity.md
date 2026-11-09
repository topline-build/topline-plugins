# Viewer Identity

Topline signs viewers in and decides who may open an app before any request
reaches it. Artifact code never handles Auth0, sessions, cookies, or tokens.
Instead, the platform proxy tells the app's server code who is viewing through
request headers.

## What the app receives

Every request the proxy forwards to app server code carries these headers:

| Header | Value |
| --- | --- |
| `x-platform-viewer-email` | The signed-in viewer's email, trimmed and lowercased. Absent when the viewer is anonymous (see below). |
| `x-platform-tenant-id` | The tenant (company) that owns the app. |
| `x-platform-artifact-access` | How the viewer reached the app: `owned`, `shared`, `tenant`, `public`, or `internal`. |
| `x-platform-artifact-id`, `x-platform-artifact-version-id` | The artifact and the exact version serving this request. |

The proxy forwards only `accept`, `accept-language`, and `content-type` from
the browser and sets every `x-platform-*` header itself, so a viewer cannot
forge them. Read the `x-platform-*` names; the unprefixed `x-viewer-email`,
`x-tenant-id`, and `x-artifact-access` copies are legacy.

Browser code can ask the platform directly: `GET ./_artifact/me` (see below).

The app does not receive a name, picture, role, Auth0 subject, ID token, access
token, or company name. Do not call Auth0, platform `/api/*` routes, or any
other identity service to get them.

## When the email is present

Treat a missing email as an anonymous viewer, never as an error to work around.

| How the viewer opened the app | `x-platform-viewer-email` | `x-platform-artifact-access` |
| --- | --- | --- |
| Topline member or collaborator signed in with access to the artifact | Present | `owned`, `shared`, or `tenant` |
| Live app limited to **Only people added**, opened by an approved person (on a Topline address or a company domain) | Present | `public` |
| Live app set to **Anyone with the link** | Present only if the visitor happens to be signed in to Topline in that browser; treat as anonymous | `public` |
| Platform machine call to a `kind: "mcp_server"` app at `/_artifact/mcp` | Absent | `internal` |

`public` describes the link, not whether the viewer signed in. Decide
"signed in or not" from the email header alone.

Support "view as" does not apply inside an app: a Topline staff member using
"view as" reaches the app with their own email, not the impersonated person's.

## Browser code: `/_artifact/me`

Every hosted app, static or not, gets a platform route that answers who is
viewing. Fetch it relatively so draft, live, and version paths all work:

```js
const me = await fetch("./_artifact/me").then((r) => r.json());
// { signedIn: true, email: "viewer@example.com", access: "shared", tenantId: "..." }
// { signedIn: false, email: null, access: "public", tenantId: "..." }
```

The platform answers it before the app sees the request, with
`Cache-Control: no-store`. It accepts only `GET` and `HEAD`. Apps cannot declare
their own `/_artifact/me` route; paths under it, such as `/_artifact/me/prefs`,
are still the app's.

On an **Anyone with the link** app it always reports `signedIn: false`, even
when the visitor happens to be signed in to Topline, so a public page never
learns a passer-by's email.

Use it only to display who is signed in. Anything the browser holds can be
edited, so never send this email back to your own server as proof of who is
asking. Server code reads the headers instead.

## Using it

- **Personalize the page.** Fetch `./_artifact/me` from browser code and show
  the email or a greeting. Never trust an email the browser sends back in a
  body, query string, or header.
- **Scope data.** Filter server-side by the header email. For the platform
  `customers` binding, use the viewer-scoped binding instead; the platform
  filters it for you.
- **Roles and display names.** Keep them in a table keyed by
  lowercased email (manifest `tables[]`) and look them up server-side. The
  platform does not supply roles.
- **Writes and audit.** Record the header email as the actor on every write.
- **Require sign-in.** Return `401` when a route needs a viewer and the email is
  missing. For an app that must never be anonymous, also set `viewerPolicy` to
  `private` or `tenant` and do not publish it with **Anyone with the link**.

Python (FastAPI), as in the `python-api` template:

```python
from typing import Annotated
from fastapi import Depends, Header, HTTPException


def current_viewer(
    email: Annotated[str | None, Header(alias="x-platform-viewer-email")] = None,
    access: Annotated[str | None, Header(alias="x-platform-artifact-access")] = None,
    tenant_id: Annotated[str | None, Header(alias="x-platform-tenant-id")] = None,
):
    email = (email or "").strip().lower()
    if not email:
        raise HTTPException(status_code=401, detail="platform_session_required")
    return {"email": email, "access": access, "tenantId": tenant_id}


@app.get("/_artifact/api/me")
def me(viewer=Depends(current_viewer)):
    return viewer
```

Node (`artifactApp(req, res)` handler):

```js
function currentViewer(req) {
  const raw = req.headers["x-platform-viewer-email"];
  const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!email) return null;
  return {
    email,
    access: req.headers["x-platform-artifact-access"] ?? null,
    tenantId: req.headers["x-platform-tenant-id"] ?? null
  };
}
```

## Testing locally

Local runs have no proxy, so send the headers yourself, for example
`curl -H "x-platform-viewer-email: viewer@example.com" -H "x-platform-artifact-access: owned" ...`.
Cover both the signed-in case and the missing-email case in the app's tests.
