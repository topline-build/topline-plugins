# Playbook: Something Worked Yesterday

Symptom: a feature that worked stops after a release, a converge or a hosted
sync, with no code change in the app. Follow the [rules](rules-and-evidence.md);
accounts are in the account map (documentation id `aws-account-map`, `docs/AWS_ACCOUNT_MAP_FOR_AGENTS.md`).

The usual cause is configuration drift: an env key that names a resource that
no longer exists, or a key that dropped out. Two traps:

- **Frozen running revisions.** A hosted customer's own API and worker are
  scaled to 0 and pinned. On the dev tenant on 2026-11-19 the worker service
  still ran revision 167 (registered 11-09), whose
  `PIPELINE_JOB_RUNNER_SECURITY_GROUPS` named a group deleted on 11-15;
  revision 168 (11-15) named only live groups. Copying the running revision's
  network onto the schedules caused the pipeline outage. Always diff against
  the newest registered revision.
- **Two accounts in one env.** A hosted service's env names queues and build
  subnets in Topline's account, and the pipeline network and upload access
  point alias in the customer's. Check each id where it lives.

Real cases: the deleted security group (pipeline outage, 11-15..19) and the
dropped `ARTIFACT_STORAGE_ACCESS_POINT_ALIAS` (upload 503, 11-19).

## With Topline's read tools

1. Find when it stopped: the first error in the logs (`get_logs` for the app,
   task or service; staff `platform_read_logs`) and the last success.
2. Compare that time with releases and converges (the Admin release and
   converge history, or the changelog). A start time that matches a release
   or converge is a lead, not a cause.
3. Staff: Ops MCP `ops_customer_diagnostics` reads the customer account's
   services and task definitions (`ecs describe-services`,
   `describe-task-definition`). Compare the running revision with the newest
   one by number and registration time.
4. Env values are never visible to agents. Run the script below for the
   revision gap and what changed in CloudTrail, and hand the env key check to
   staff.

## With the AWS runner

Script: the "Runner script" block at the end of this page
(`scripts/revision_drift.js`). Copy it as the `script` of
`aws_run_script`, without `appId`. It reads this company's own account only:

1. `ecs ListClusters` for `<prefix>-cluster`, `ListServices` (or `SERVICES`,
   for example `["<prefix>-platform-worker", "<prefix>-platform-api"]`),
   `DescribeServices` for desired and running counts, rollout state and the
   running revision, and `ListTaskDefinitions` (`sort: DESC`, one result) for
   the newest registered revision. `frozen: true` means the running revision
   is history and the newest is current.
2. `cloudtrail LookupEvents` for `DeleteSecurityGroup`, `UpdateSchedule` and
   `UpdateService` in the window: what was deleted or rewritten, and when.

It never reads a task definition: `ecs:DescribeTaskDefinition` is never
granted to `builder-read`, because task-definition env holds values. Env key
diffs between revisions, env-named resources, and the hosted services in
Topline's account are staff work (Ops MCP `ops_customer_diagnostics`, or the
read-only AWS CLI with an SSO profile).

Second source: the deletion or rewrite in CloudTrail plus the failing call
that needs the resource (the `RunTask` error, or the app or API log line).

## Evidence summary

```text
Symptom: <feature> broke at <time>; worked at <time>
Cause: <env key KEY names a deleted resource | KEY dropped from the newest revision>
Evidence 1: <service> newest revision <n> vs running <m>: <key diff / missing id>
Evidence 2: <the failing call's error that names the same resource or key>
Scope: <services, customers>
Not checked: <denied reads>
Next step: Topline staff correct the hosted env or schedule through the setup runner; never edit a task definition directly
```

## Runner script

Copy this whole block as the `script` of `aws_run_script`, after setting the values under `settings`. It is `scripts/revision_drift.js` in the topline-aws-diagnostics skill, copied here by `npm run docs:generate`.

```js
// Playbook: something worked yesterday (references/worked-yesterday.md). This company's own ECS
// services: running vs newest registered revision, plus what changed in CloudTrail. Paste this
// whole file as the `script` of aws_run_script, without appId. Read-only. Returns one compact
// summary object; task-definition bodies (and their env) are never read.

// ---- settings ----
const SERVICES = null;      // e.g. ["<prefix>-platform-worker", "<prefix>-platform-api"]; null = services on <prefix>-cluster (at most 10)
const HOURS = 72;
const CHANGE_EVENTS = ["DeleteSecurityGroup", "UpdateSchedule", "UpdateService"];

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

async function cluster() {
  const list = await page("ecs", "ListClusters", {}, { items: "clusterArns", sizeKey: "maxResults", size: 20, maxPages: 2 });
  const name = list.items.map((arn) => String(arn).split("/").pop()).find((n) => /-cluster$/.test(n));
  return name ? { name, prefix: name.replace(/-cluster$/, "") } : null;
}

async function serviceNames(clusterName, prefix) {
  if (SERVICES) return SERVICES.map((s) => s.replace("<prefix>", prefix));
  const list = await page("ecs", "ListServices", { cluster: clusterName }, { items: "serviceArns", sizeKey: "maxResults", size: 10, maxPages: 2 });
  return list.items.map((arn) => String(arn).split("/").pop()).slice(0, 10);
}

// Current = newest registered revision of the family; a frozen running revision is history.
async function drift(clusterName, names) {
  const out = [];
  if (!names.length) return out;
  const r = await aws("ecs", "DescribeServices", { cluster: clusterName, services: names.slice(0, 10) });
  if (failed(r)) return [{ error: r.errorCode }];
  for (const svc of r.services || []) {
    const running = String(svc.taskDefinition || "");
    const family = running.split("/").pop().split(":")[0];
    const newest = await aws("ecs", "ListTaskDefinitions", { familyPrefix: family, sort: "DESC", maxResults: 1 });
    const newestArn = failed(newest) ? null : (newest.taskDefinitionArns || [])[0] || null;
    const primary = (svc.deployments || []).find((d) => d.status === "PRIMARY") || {};
    out.push({
      service: svc.serviceName, desired: svc.desiredCount, running: svc.runningCount,
      runningRevision: Number(running.split(":").pop()) || null, newestRevision: newestArn ? Number(newestArn.split(":").pop()) : "not read",
      frozen: newestArn ? newestArn !== running : null,
      rollout: primary.rolloutState || null, rolloutReason: short(primary.rolloutStateReason, 160) || null,
      lastEvent: (svc.events || [])[0] ? { at: String(svc.events[0].createdAt), message: short(svc.events[0].message, 200) } : null
    });
  }
  for (const f of r.failures || []) out.push({ service: String(f.arn || "").split("/").pop(), error: f.reason });
  return out;
}

// What changed in the window, from CloudTrail (small events only; never task-definition bodies).
async function changes(start, end) {
  const out = {};
  for (const name of CHANGE_EVENTS) {
    const trail = await page("cloudtrail", "LookupEvents", {
      LookupAttributes: [{ AttributeKey: "EventName", AttributeValue: name }], StartTime: Math.floor(start / 1000), EndTime: Math.floor(end / 1000)
    }, { items: "Events", size: 10, maxPages: 2, maxItems: 20 });
    const rows = [];
    for (const item of trail.items) {
      let e;
      try { e = JSON.parse(item.CloudTrailEvent || "{}"); } catch (_) { continue; }
      const p = e.requestParameters || {};
      rows.push({ at: e.eventTime, target: p.groupId || p.subnetId || p.name || p.service || null, taskDefinition: p.taskDefinition ? String(p.taskDefinition).split("/").pop() : undefined, error: e.errorCode || undefined });
    }
    out[name] = { count: rows.length, searchedToEnd: trail.complete, rows: rows.slice(0, 8), stoppedBecause: trail.error };
  }
  return out;
}

async function main() {
  const end = Date.now();
  const start = end - HOURS * 3600 * 1000;
  const c = await cluster();
  if (!c) return { error: "No ECS cluster ending in -cluster is visible to this persona.", notChecked, problems };
  const names = await serviceNames(c.name, c.prefix);
  return {
    cluster: c.name, windowHours: HOURS,
    services: await drift(c.name, names),
    changesInWindow: await changes(start, end),
    notChecked: notChecked.concat([{ action: "ecs:DescribeTaskDefinition", errorCode: "never_granted", message: "builder-read never reads task definitions (their env holds values): env key diffs and env-named resources need Topline staff (Ops MCP ops_customer_diagnostics)." }]),
    problems, calls: callsMade,
    rule: "Current = newest registered revision. A frozen running revision is history, not config. Hosted services in Topline's account are not reachable from here."
  };
}

try { return await main(); } catch (e) { return { error: short(e && e.message, 300), notChecked, problems, calls: callsMade }; }
```
