# App roles

## Example user request

"Only finance should approve expenses. Let me say who the approvers are."

The same shape covers "reps see their own leads", "helpdesk agents work the
queue" and any other "only these people may do X" inside one app.

## Fit and starting point

Topline does not provide roles inside an app. Sharing decides who can open the
app; the app decides what each person may do once inside. Each app keeps its
own roles in its own company table, keyed on the signed-in email the platform
proxy sets, and gives the people who run it a screen to manage them.

Use this pattern whenever an app has more than one kind of user. Build it into
whatever the app starts from (usually the `table-approvals-app` starter, see
[Table approvals app](../table-approvals-app/EXAMPLE.md)), with
`serverTables: true`. Read [Viewer identity](../../references/viewer-identity.md#roles-inside-your-app)
for the rules this example follows.

Seat levels (app, chat, builder) are unrelated: they decide what a person can
use in Topline, not what they can do inside an app.

## Naming

This is a convention, not a rule: when the customer or person names things
differently, use their names. Following it when nobody has a preference means
anyone moving between apps finds roles in the same place. Inspect and
validation don't check any of these names.

| Thing | Convention |
| --- | --- |
| Roles table | `<app_slug>_roles`, e.g. `expenses_roles` |
| Its columns | `email` (lowercase), `role`, `granted_by`, `granted_at` |
| Rule table (domain rules, only if used) | `<app_slug>_role_rules` with `pattern`, `role`, `granted_by`, `granted_at` |
| Role names | lowercase singular `snake_case` nouns for what the person is: `approver`, `rep`, `agent`, `reviewer` |
| Manager role | `role_manager`, for people who manage roles but don't edit the app |
| Identity route | `GET ./_artifact/api/me` returning `{ email, roles: string[] }` |
| Management page | titled "People and roles", at `#/people` (or `/people` for server-rendered apps) |

## Create the table

Run with `platform_run_artifact_workspace_sql` (`scope: "company"`) or, in a
coding task, the workspace SQL tool. Give it `documentation` with a description
and a sensitivity for every column, as for any company table.

```sql
create table company_data.expenses_roles (
  email text not null,
  role text not null,
  granted_by text not null,
  granted_at timestamptz not null default now()
)
```

```sql
create unique index expenses_roles_email_role on company_data.expenses_roles (email, role) where _deleted_at is null
```

Nobody seeds rows. The app's owner and editors can always manage roles (see
below), so the first person to open the live app as an editor adds everyone
else from the "People and roles" page.

Declare **no** `tables[]` binding for the roles table: a binding is a browser
route every viewer can call, and with a write binding any viewer could make
themselves an approver.

## Server: who is asking, and what may they do

All checks run in server code, from the proxy headers, on every request.

```js
// src/roles.js (server code only). tablesSql is the helper from the
// table-approvals starter / references/server-runtime-recipes.md.
import { tablesSql } from "./tables-sql.js";

const ROLES = "company_data.expenses_roles";
const MANAGER = "role_manager";
const CACHE_MS = 60_000; // at most 60 seconds, or drop the cache entirely
const cache = new Map();

export function viewerOf(req) {
  const raw = req.headers["x-platform-viewer-email"];
  const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!email) return null; // anonymous: never look up roles
  return { email, isEditor: req.headers["x-platform-artifact-access"] === "owned" };
}

export async function rolesOf(req, email, sql = tablesSql) {
  const hit = cache.get(email);
  if (hit && hit.until > Date.now()) return hit.roles;
  const { rows } = await sql(req,
    `select distinct role from ${ROLES} where email = :email and _deleted_at is null`,
    { email });
  const roles = rows.map((row) => row.role);
  cache.set(email, { roles, until: Date.now() + CACHE_MS });
  return roles;
}

export function forgetRoles(email) { cache.delete(email); }

// Owners and editors (access "owned") can always manage roles: no lock-out.
export function canManageRoles(viewer, roles) {
  return viewer.isEditor || roles.includes(MANAGER);
}

// Throws an error the handler turns into 401/403.
export async function requireRole(req, role, sql = tablesSql) {
  const viewer = viewerOf(req);
  if (!viewer) throw Object.assign(new Error("sign_in_required"), { status: 401 });
  const roles = await rolesOf(req, viewer.email, sql);
  const allowed = role === MANAGER ? canManageRoles(viewer, roles) : roles.includes(role);
  if (!allowed) throw Object.assign(new Error(`role_required:${role}`), { status: 403 });
  return { ...viewer, roles };
}
```

Use it at the top of every route that needs a role, before reading or writing
anything:

```js
// POST /_artifact/api/decisions
const viewer = await requireRole(req, "approver");
// ... the optimistic update from the table approvals example, actingUser = viewer.email
```

A cache is per server instance, so a removed role can keep working on another
instance for up to 60 seconds. Keep it short, or skip it.

## `GET ./_artifact/api/me`

The browser needs the roles only to hide buttons it can't use. Declare the
route in `routes[]` (`{ "path": "/_artifact/api/me", "kind": "api", ... }`).
It is the app's own route, separate from the platform's `./_artifact/me`.

```js
// GET /_artifact/api/me
const viewer = viewerOf(req);
if (!viewer) return json(res, 401, { error: "sign_in_required" });
const roles = await rolesOf(req, viewer.email);
const all = canManageRoles(viewer, roles) && !roles.includes("role_manager")
  ? [...roles, "role_manager"] : roles;
return json(res, 200, { email: viewer.email, roles: all });
```

```js
// Browser: hide what the viewer can't use. The server still checks every call.
const me = await fetch("./_artifact/api/me").then((r) => r.json());
document.querySelector("#approve-queue").hidden = !me.roles.includes("approver");
document.querySelector("a[href='#/people']").hidden = !me.roles.includes("role_manager");
```

## The "People and roles" page

Every app with roles has this page, at `#/people`, so nobody edits a table by
hand to make someone an approver. Only managers see it, and its routes require
`role_manager` (which includes editors).

- `GET ./_artifact/api/roles` lists the live rows: email, role, granted by,
  granted at.
- `POST ./_artifact/api/roles` with `{ email, role }` adds a row. Lowercase and
  trim the email, accept only the app's known role names, and record the
  manager as `granted_by`:

  ```js
  const manager = await requireRole(req, "role_manager");
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+$/.test(email) || !KNOWN_ROLES.includes(body.role)) return json(res, 400, { error: "invalid_role_grant" });
  try {
    await tablesSql(req,
      `insert into ${ROLES} (email, role, granted_by)
       select :email, :role, :grantedBy
       where not exists (select 1 from ${ROLES} where email = :email and role = :role and _deleted_at is null)`,
      { email, role: body.role, grantedBy: manager.email }, manager.email);
  } catch (error) {
    // Two managers adding the same grant at once: the unique index wins, and the grant exists.
    if (!String(error?.message ?? "").includes("23505")) throw error;
  }
  forgetRoles(email);
  ```

- `DELETE ./_artifact/api/roles/<_row_id>` removes a row with
  `delete from company_data.expenses_roles where _row_id = :id`, passing the
  manager as `actingUser` so the row history names them. Never set
  `_deleted_at` yourself; it is platform-owned. Forget that email's cached
  roles.
- After adding someone, the page says: "Adding a role doesn't share the app.
  If they can't open it yet, share it with them in Topline." The app can't see
  who it is shared with, so it always says this.
- Saves work on the live app. On a draft they answer `draft_is_read_only`
  unless the manifest sets `previewWrites: true`, and then a draft write
  changes real rows.

## Mapping to the customer's own setup

The app's checks stay the same shape; only `rolesOf` reads more places. Pick
whichever fits; plain email rows are the default.

- **Plain email rows** (above).
- **Domain rules**: "everyone `@finance.acme.com` is an approver". Keep them in
  `expenses_role_rules` (`pattern` is an exact email or `*@domain`), managed on
  the same page, and add them to the lookup:

  ```sql
  select role from company_data.expenses_roles where email = :email and _deleted_at is null
  union
  select role from company_data.expenses_role_rules
   where _deleted_at is null and (pattern = :email or pattern = '*@' || split_part(:email, '@', 2))
  ```

- **Roles from the customer's own source**: join a roster, such as an HR
  roster, on email. The roster must be a company table (listed on the Data
  page); connector data in `source_*` schemas can't be read through server
  table SQL:

  ```sql
  union
  select 'approver' from company_data.hr_roster
   where lower(email) = :email and department = 'Finance' and _deleted_at is null
  ```

  Say on the "People and roles" page which roles come from the roster, since
  they can't be removed there.

## Tests: a fake viewer and the 403 paths

Local runs have no proxy, so tests send the headers and stub table SQL. Cover
anonymous, signed in without the role, with the role, and the editor bootstrap.

```js
// test/roles.test.js  (node --test)
import test from "node:test";
import assert from "node:assert/strict";
import { requireRole } from "../src/roles.js";

const rows = [{ email: "ana@example.com", role: "approver" }];
const fakeSql = async (_req, _sql, { email }) => ({ rows: rows.filter((r) => r.email === email) });
const req = (email, access = "shared") => ({ headers: {
  ...(email ? { "x-platform-viewer-email": email } : {}),
  "x-platform-artifact-access": access } });
const status = (promise) => promise.then(() => 200, (err) => err.status);

test("anonymous is 401", async () => assert.equal(await status(requireRole(req(null), "approver", fakeSql)), 401));
test("signed in without the role is 403", async () => assert.equal(await status(requireRole(req("bo@example.com"), "approver", fakeSql)), 403));
test("approver passes", async () => assert.equal(await status(requireRole(req("ana@example.com"), "approver", fakeSql)), 200));
test("non-manager can't change roles", async () => assert.equal(await status(requireRole(req("ana@example.com"), "role_manager", fakeSql)), 403));
test("an editor can always manage roles", async () => assert.equal(await status(requireRole(req("ed@example.com", "owned"), "role_manager", fakeSql)), 200));
```

Use a distinct email per test, or clear the cache between tests. Add one route
test that sends a forged role in the request body and still gets 403.

## Who can do what across apps (admin recipe)

Each app has its own roles table, so a Builder answers "who can do what" or
offboards someone by reading every `*_roles` table at once. First find them with
`list_data_catalog` (or on the Data page) -- company SQL can't read
`information_schema`. Then query them together, one `UNION ALL` branch per table:

```sql
select 'expenses' as app, email, role, granted_by, granted_at from company_data.expenses_roles where _deleted_at is null
union all
select 'leads', email, role, granted_by, granted_at from company_data.leads_roles where _deleted_at is null
union all
select 'helpdesk', email, role, granted_by, granted_at from company_data.helpdesk_roles where _deleted_at is null
order by email, app
```

Offboarding is a `delete ... where email = :email` per table, run by a Builder,
plus removing the person's access in Topline.

## Why one table per app, not one shared table

A single shared `app_roles` table was considered and rejected:

- Any app that declares a table can read and write all of its rows, so one app
  could change another app's permissions.
- A schema change to it would couple every app.

Making it safe would need a platform-enforced row filter per app, which is the
platform-roles design Topline decided against. The naming convention gives the
consistency instead.

## Don't

- Hardcode email lists in code or env. Roles live in the table and change on
  the "People and roles" page.
- Decide access in the browser, or trust a role, email or `/_artifact/me`
  answer the browser sends back. The server reads the proxy headers.
- Share one roles table across apps, or add a `tables[]` binding for it.
- Look up roles on public routes: anonymous visitors have no email, and role
  checks don't apply to them.
- Leave out the management page, or require someone to seed rows by hand.

## Handoff

Tell the person: "To give someone a role, open the app, go to **People and
roles**, and add their email. Anyone who can edit the app can always do this.
Adding a role doesn't share the app: share it with them in Topline too."
