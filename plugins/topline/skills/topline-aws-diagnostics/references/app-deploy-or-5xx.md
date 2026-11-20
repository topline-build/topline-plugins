# Playbook: App Deploy Failed or App Returns 5xx

Symptom: a deploy of an artifact app fails, an app page shows an error, or an
app route or upload returns a 5xx. Follow the [rules](rules-and-evidence.md);
accounts are in the account map (documentation id `aws-account-map`, `docs/AWS_ACCOUNT_MAP_FOR_AGENTS.md`).

Real cases (2026-11-19):

- **Secrets read failed in every app.** The Lambda adapters called Secrets
  Manager with `x-amz-target: SecretsManager.GetSecretValue`; the JSON
  protocol target is `secretsmanager.GetSecretValue`, and the other casing
  returns `UnknownOperationException` (400). The role was allowed: an SDK read
  from the same role succeeded. So `platformSecrets.get` failed in the app's
  own logs while IAM showed no denial. Lesson: a 400 with no AccessDenied in
  CloudTrail is a request-shape bug, not a permission gap.
- **Browser uploads returned 503.** The hosted API answered every upload with
  `storage_uploads_unavailable` because `ARTIFACT_STORAGE_ACCESS_POINT_ALIAS`
  had dropped out of the hosted env: a release built the API revision from
  the running one, which predated the converge that added the key. The
  `<prefix>-app-files` access point existed throughout. The API now logs
  `artifact_uploads_unavailable` and publishes `Topline/HostedApps
  UploadsUnavailable`.

## With Topline's read tools

1. `platform_artifact_status` (Build MCP) or `inspect_harness_state` (chat):
   deployment state, the failing step, and the deployment record id.
   `platform_deploy_operation` for one deploy's steps.
2. App logs: `get_logs` with `target: "artifact_app"` (v1
   `inspect_artifact_app_logs`; Build MCP `platform_read_artifact_logs`;
   coding agent `artifact_app_logs`). Search for `Error`, `Exception`,
   `Task timed out`, `UnknownOperationException`, `AccessDenied`.
3. A 5xx from a Topline route (upload, sign-in, `/_artifact/*`) rather than
   from app code is in the hosted API's logs, not the app's: staff
   `platform_read_logs` with `target: "api"` and `contains:
   "uploads_unavailable"` (or the route's error code).
4. `platform_run_artifact_smoke` re-checks the draft after a fix; it is the
   evidence that the 5xx is gone.
5. Function state, the role's boundary and denials are not visible to these
   tools: run the script below. Env values are never visible to agents, and a
   missing env key on the hosted side is staff work; name it as the lead.

## With the AWS runner

Script: the "Runner script" block at the end of this page
(`scripts/app_5xx.js`). Copy it as the `script` of
`aws_run_script` with `appId` set to the app's id, and set `ARTIFACT_ID` (and
`PART`, or `null` for every function of the app). With `ARTIFACT_ID` left
`null` it returns the recently changed app ids instead.

| Step | Call | What it tells you |
| --- | --- | --- |
| Functions | `lambda ListFunctions` in pages of 20 or fewer (smaller after `$truncated`), matched on `<prefix>-artifact-<id>[-<part>]` | The app's real function names; none means it was never deployed or the deploy failed before creating it |
| Function shape | `lambda GetFunctionConfiguration` (state, last update status, runtime, memory, timeout; never `Environment`) | A failed update, a pending state, a timeout too low |
| Role and boundary | `iam GetRole` on the function's role | Whether the runtime boundary `<prefix>-artifact-runtime-boundary` is attached (storage roles) or the shared `<prefix>-artifact-app-lambda` role is used |
| Errors | `logs DescribeLogGroups`, then `FilterLogEvents` on `/aws/lambda/<function>` with the error pattern, pages of 20, empty pages with a `nextToken` followed | The app's own failure lines, deduplicated; no log group means the function has not run yet |
| Metrics | `cloudwatch GetMetricStatistics` `AWS/Lambda` `Invocations`, `Errors`, `Throttles` | Whether errors are new, constant, or throttling (account concurrency) |
| Denials | `cloudtrail LookupEvents` by `Username` = function name (its role session) and = `topline-hosted-artifact-deploy` (deploy role session), kept only `AccessDenied*` / `Unauthorized*` | A runtime permission gap vs a deploy permission gap |

The hosted side (Topline's account: hosted API logs, hosted env keys such as
`ARTIFACT_STORAGE_ACCESS_POINT_ALIAS`) is not reachable from the runner; it is
staff work (`platform_read_logs`, Ops MCP).

Second source: the app log line plus the matching metric spike, or a
CloudTrail denial plus the role's policy or boundary lacking that action. For
a missing env key: staff confirm the key absent from the newest hosted
revision and the resource it should name existing.

## Evidence summary

```text
Symptom: <app/route> returns <status> since <time>; deploy <id> failed at <step>
Cause: <request-shape bug | missing env key | IAM gap | app code error>
Evidence 1: <log line or error code, count, time range>
Evidence 2: <metric, CloudTrail denial, or env key check that agrees>
Scope: <one app | every app | every hosted customer>
Not checked: <denied reads>
Next step: <redeploy through Topline | Topline fix + release | person grants access>
```

## Runner script

Copy this whole block as the `script` of `aws_run_script`, after setting the values under `settings`. It is `scripts/app_5xx.js` in the topline-aws-diagnostics skill, copied here by `npm run docs:generate`.

```js
// Playbook: an app deploy failed or the app returns 5xx (references/app-deploy-or-5xx.md).
// Paste this whole file as the `script` of aws_run_script, with appId set to the app's id (narrows
// Lambda and log reads to that app). Read-only. Returns one compact summary object; never the
// function's environment, never raw responses.

// ---- settings ----
const ARTIFACT_ID = null;   // the app's id (with or without dashes); null = list recently changed apps
const PART = null;          // e.g. "web"; null = every function of the app (at most 2)
const HOURS = 24;
const LIST_PAGES = 10;      // ListFunctions pages (it has no name filter)
const LOG_PAGES = 4;        // FilterLogEvents pages; empty pages with a nextToken are followed
const TRAIL_PAGES = 3;      // CloudTrail pages of 10 per role session
const DEPLOY_ROLE_SESSION = "topline-hosted-artifact-deploy";   // the deploy role's session name
const ERROR_PATTERN = '?ERROR ?Error ?Exception ?"Task timed out" ?UnknownOperationException ?AccessDenied ?"Runtime exited"';

// ---- helpers: the same block in every script in this folder (aws, page, denied) ----
const REGION = null;               // null = this company's own region (the runner refuses others)
const CALL_BUDGET = 45;            // the runner stops a script at 50 calls
const TIME_BUDGET_MS = 18000;      // the runner stops a script at 25 s
const startedAt = Date.now();
const notChecked = [];             // refused reads: the exact action, a permission the user can request
const problems = [];               // other failed reads (throttling, validation, timeouts)
let callsMade = 0;
const DENIED = /AccessDenied|Unauthorized|not authorized|write_blocked|s3_requires_app_scope/i;

function short(text, max) {
  const s = String(text == null ? "" : text).replace(/\s+/g, " ").trim();
  return s.length > (max || 200) ? s.slice(0, max || 200) + "..." : s;
}
function budgetLeft() { return callsMade < CALL_BUDGET && Date.now() - startedAt < TIME_BUDGET_MS; }
function failed(r) { return !r || r.ok === false; }

// A refused read is an answer: record the exact action once and move on. Never retry it.
function denied(r, action) {
  if (!r || r.ok !== false || !DENIED.test(r.errorCode + " " + r.message)) return false;
  if (!notChecked.some((n) => n.action === action)) notChecked.push({ action, errorCode: r.errorCode, message: short(r.message, 240) });
  return true;
}

// One AWS call. Failures resolve to { ok: false, errorCode, message }. Codes in `expected`
// (ResourceNotFoundException for a log group that does not exist yet) are answers, not problems.
async function aws(service, operation, params, expected) {
  callsMade += 1;
  const r = await call_aws(service, operation, REGION, params || {});
  if (!failed(r)) return r;
  if (r && r.errorCode === "credentials_unavailable") throw new Error("credentials_unavailable: " + r.message);
  const code = r ? r.errorCode : "no_response";
  if ((expected || []).indexOf(code) === -1 && !denied(r, service + ":" + operation)) {
    problems.push({ call: service + ":" + operation, errorCode: code, message: short(r && r.message, 240) });
  }
  return r || { ok: false, errorCode: code, message: "" };
}

// Pages through a list in small pages, following NextToken, nextToken or NextMarker (as Marker).
// A $truncated page dropped items to fit the per-call cap and lost its token: never count from it,
// retry the same page smaller. Empty pages that still carry a token (FilterLogEvents) are followed
// up to maxPages. `complete` is true only when the last page had no token.
async function page(service, operation, params, opt) {
  const o = Object.assign({ items: "Items", size: 20, sizeKey: "MaxResults", maxPages: 5, maxItems: 200, expected: [] }, opt);
  const out = { items: [], pages: 0, complete: false, error: null };
  let size = o.size, tokenKey = null, token = null;
  while (out.pages < o.maxPages && out.items.length < o.maxItems) {
    if (!budgetLeft()) { out.error = "script_budget"; break; }
    const req = Object.assign({}, params);
    if (o.sizeKey) req[o.sizeKey] = size;
    if (token) req[tokenKey] = token;
    const r = await aws(service, operation, req, o.expected);
    if (failed(r)) { out.error = r.errorCode; break; }
    if (r.$truncated) {
      if (!o.sizeKey || size <= 1) { out.error = "item_over_output_cap"; break; }
      size = Math.max(1, Math.min(Math.floor(size / 2), r.$itemsReturned || size));
      continue;
    }
    out.pages += 1;
    const list = r[o.items];
    if (Array.isArray(list)) for (const item of list) out.items.push(item);
    if (r.NextToken) { tokenKey = "NextToken"; token = r.NextToken; }
    else if (r.nextToken) { tokenKey = "nextToken"; token = r.nextToken; }
    else if (r.NextMarker) { tokenKey = "Marker"; token = r.NextMarker; }
    else { out.complete = true; break; }
  }
  if (out.items.length > o.maxItems) out.items.length = o.maxItems;
  return out;
}
// ---- end helpers ----

// App functions come from ListFunctions, never from a guessed name: <prefix>-artifact-<32 hex>[-<part>].
async function appFunctions() {
  const want = ARTIFACT_ID ? String(ARTIFACT_ID).replace(/-/g, "").toLowerCase() : null;
  const list = await page("lambda", "ListFunctions", {}, { items: "Functions", sizeKey: "MaxItems", size: 20, maxPages: LIST_PAGES, maxItems: 1000 });
  const apps = [];
  for (const f of list.items) {
    const m = /^(.+)-artifact-([0-9a-f]{32})(?:-(.+))?$/.exec(f.FunctionName || "");
    if (m) apps.push({ name: f.FunctionName, prefix: m[1], artifact: m[2], part: m[3] || null, lastModified: f.LastModified });
  }
  return { list, apps, mine: want ? apps.filter((a) => a.artifact === want) : [] };
}

async function functionShape(name) {
  const r = await aws("lambda", "GetFunctionConfiguration", { FunctionName: name });
  if (failed(r)) return { error: r.errorCode };
  // Field allowlist: Environment and code locations are never read out.
  const shape = {};
  for (const k of ["State", "StateReasonCode", "StateReason", "LastUpdateStatus", "LastUpdateStatusReasonCode", "Runtime", "MemorySize", "Timeout", "Version", "LastModified"]) {
    if (r[k] !== undefined) shape[k] = typeof r[k] === "string" ? short(r[k], 200) : r[k];
  }
  const roleName = String(r.Role || "").split("/").pop();
  shape.role = roleName || null;
  if (roleName) {
    const role = await aws("iam", "GetRole", { RoleName: roleName });
    shape.roleBoundary = failed(role) ? "not read: " + role.errorCode
      : String((((role.Role || {}).PermissionsBoundary) || {}).PermissionsBoundaryArn || "").split("/").pop() || null;
  }
  return shape;
}

// The log group exists only after the first invoke: ResourceNotFound or no group = "no logs yet".
async function recentErrors(name, start) {
  const group = "/aws/lambda/" + name;
  const groups = await page("logs", "DescribeLogGroups", { logGroupNamePrefix: group }, { items: "logGroups", sizeKey: "limit", size: 5, maxPages: 1 });
  if (groups.error) return { logGroup: group, error: groups.error };
  if (!groups.items.some((g) => g.logGroupName === group)) return { logGroup: group, logs: "none yet: the function has not run since it was created" };
  const events = await page("logs", "FilterLogEvents", { logGroupName: group, filterPattern: ERROR_PATTERN, startTime: start, interleaved: true },
    { items: "events", sizeKey: "limit", size: 20, maxPages: LOG_PAGES, maxItems: 20, expected: ["ResourceNotFoundException"] });
  if (events.error === "ResourceNotFoundException") return { logGroup: group, logs: "none yet: the function has not run since it was created" };
  const seen = {};
  for (const e of events.items) {
    const line = short(e.message, 240);
    const s = seen[line] || (seen[line] = { line, count: 0, last: e.timestamp });
    s.count += 1;
    if (e.timestamp > s.last) s.last = e.timestamp;
  }
  const lines = Object.keys(seen).map((k) => seen[k]).sort((a, b) => b.count - a.count).slice(0, 8)
    .map((s) => ({ line: s.line, count: s.count, last: new Date(s.last).toISOString() }));
  // Empty pages can carry a token: zero is only "zero" when paging finished.
  return { logGroup: group, matched: events.items.length, searchedToEnd: events.complete, pages: events.pages, lines, stoppedBecause: events.error };
}

async function metrics(name, start, end) {
  const out = {};
  for (const metric of ["Invocations", "Errors", "Throttles"]) {
    const r = await aws("cloudwatch", "GetMetricStatistics", {
      Namespace: "AWS/Lambda", MetricName: metric, Dimensions: [{ Name: "FunctionName", Value: name }],
      StartTime: Math.floor(start / 1000), EndTime: Math.floor(end / 1000), Period: 3600, Statistics: ["Sum"]
    });
    out[metric] = failed(r) ? "not read: " + r.errorCode : (r.Datapoints || []).reduce((n, p) => n + (p.Sum || 0), 0);
  }
  return out;
}

// Denials recorded by CloudTrail for a role session name (the function, or the deploy role).
async function denials(username, start, end) {
  const trail = await page("cloudtrail", "LookupEvents", {
    LookupAttributes: [{ AttributeKey: "Username", AttributeValue: username }], StartTime: Math.floor(start / 1000), EndTime: Math.floor(end / 1000)
  }, { items: "Events", size: 10, maxPages: TRAIL_PAGES, maxItems: 200 });
  const found = {};
  for (const item of trail.items) {
    let e;
    try { e = JSON.parse(item.CloudTrailEvent || "{}"); } catch (_) { continue; }
    const code = e.errorCode || "";
    if (!/Denied|Unauthorized/.test(code)) continue;
    const key = String(e.eventSource || "").split(".")[0] + ":" + e.eventName + " " + code;
    found[key] = (found[key] || 0) + 1;
  }
  return { username, scanned: trail.items.length, searchedToEnd: trail.complete, denied: found, stoppedBecause: trail.error };
}

async function main() {
  const end = Date.now();
  const start = end - HOURS * 3600 * 1000;
  const fns = await appFunctions();
  if (!ARTIFACT_ID) {
    const recent = fns.apps.slice().sort((a, b) => String(b.lastModified).localeCompare(String(a.lastModified))).slice(0, 15)
      .map((a) => ({ artifact: a.artifact, part: a.part, lastModified: a.lastModified }));
    return { error: "Set ARTIFACT_ID (the app's id) and run again.", appFunctionsSeen: fns.apps.length, listedToEnd: fns.list.complete, recentlyChanged: recent, notChecked, problems };
  }
  const targets = fns.mine.filter((f) => PART === null || f.part === PART).slice(0, 2);
  if (!targets.length) {
    return { artifact: ARTIFACT_ID, functions: [], listedToEnd: fns.list.complete,
      finding: fns.list.complete ? "No function for this app: it was never deployed, or the deploy failed before creating it." : "Not found in the pages read; run again with appId set to narrow the list.",
      notChecked, problems, calls: callsMade };
  }
  const functions = [];
  for (const f of targets) {
    functions.push({ name: f.name, part: f.part, shape: await functionShape(f.name), metrics: await metrics(f.name, start, end), errors: await recentErrors(f.name, start) });
  }
  return {
    artifact: ARTIFACT_ID, windowHours: HOURS, functions,
    functionRoleDenials: await denials(targets[0].name, start, end),
    deployRoleDenials: await denials(DEPLOY_ROLE_SESSION, start, end),
    notChecked, problems, calls: callsMade,
    note: "A 5xx from a Topline route (upload, sign-in, /_artifact/*) is in the hosted API's logs, not here."
  };
}

try { return await main(); } catch (e) { return { error: short(e && e.message, 300), notChecked, problems, calls: callsMade }; }
```
