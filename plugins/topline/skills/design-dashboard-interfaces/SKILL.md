---
name: design-dashboard-interfaces
description: Design, implement, or critique operational dashboards, analytical charts, and reporting tables using the product design system, truthful data displays, and rendered validation. Use for dashboard layouts, KPI views, reporting drilldowns, responsive data interfaces, and their component states.
---

# Design Dashboard Interfaces

Build dashboards that help a specific person notice, decide, and act. Favor a quiet, dense, scannable application interface over a marketing page or a collection of decorative widgets.

## Start with the project

1. Establish the deliverable: design proposal, working UI, or review. Read repository instructions and inspect the existing application when modifying it.
2. Use the project's design system. If Storybook MCP is available, call `list-all-documentation`, then `get-documentation` or `get-documentation-for-story` before reading component source. From Claude Code or Codex on the Topline MCP, the same reads are `platform_storybook` with `action` `list`, `docs` and `preview` (see the topline-design-system-storybook skill). Treat the customer's published brand description and rendered stories as design input, not merely component documentation.
3. Inspect nearby screens and matching stories. Preserve established interaction and visual language unless the task explicitly calls for a redesign.
4. Live interfaces use connected data and verified metric definitions; never invent runtime fallback metrics or unsupported business meaning. Design proposals and stories may use clearly labeled synthetic fixtures. Keep their totals and comparisons consistent, and do not present them as customer facts.

In Topline coding harnesses, the customer can describe its brand in the published design-system Storybook. Use that guidance and its rendered examples as the visual reference, then import the corresponding vendored components and tokens from `src/design-system/`. Do not recreate them or substitute generic styling.

Inspect what is actually published before promising a component. A local Pencil proposal is design evidence, not proof that a component is available to builders. This skill covers interface quality; use the artifact-app workflow for runtime, datasets, permissions, and deployment when that work is in scope.

## Define the dashboard contract

Before choosing widgets, state:

- **User:** who returns to this screen and how often?
- **Question:** what must they understand within seconds?
- **Decision:** what decision or action follows?
- **Grain:** what does one row, mark, or number represent?
- **Interaction scope:** read-only reporting, editing, or operational actions? Do not infer spreadsheet editing from a dense table.
- **Context:** which time range, target, baseline, or comparison gives the data meaning?
- **Freshness:** when was the data updated, and can it be stale or partial?
- **Source and coverage:** is this production, demo, synthetic, or unverified data; which offices, entities, dates, and cohorts does it cover?
- **Failure cost:** what happens if the user misses an exception or misreads a value?

If these are unclear, infer the smallest credible contract from the task and existing product, then make the assumptions visible in the implementation or handoff.

Do not infer data provenance from a working connection, a live query, a tenant name, or plausible totals. Read the authorized source metadata and existing dataset definition. If those do not establish production provenance and coverage, describe them as unverified and keep that limitation visible beside the metrics. A connected demo database is still demo data.

### Show data scope before business conclusions

- Put a persistent **Demo data** or **Synthetic data** label beside the page's scope and freshness when applicable. Carry it into drilldowns, exports, screenshots, and the chat handoff; do not call these production or live customer KPIs.
- State the actual included offices/entities and date range. A two-office sample must not read as a company-wide total. Keep source coverage separate from the user's selected filters.
- Define each rate's numerator, denominator, cohort, date basis, and exclusions from the dataset query. A current active count is not automatically the denominator for a historical retention rate. Do not infer customer health or forecast accuracy from an unexplained percentage.
- Reconcile cards, charts, tables, and drilldowns against the same filtered records. Represent an absent or zero denominator as unavailable/not comparable according to the metric definition, rather than silently showing zero percent.
- Verify scope labels and totals in ready, filtered, partial, stale, empty, and error states. A failed request must end loading with a useful retry path while preserving filters; it must not replace missing data with invented values or leave stale values looking current.
- In the delivery summary, identify the verified source and coverage before quoting totals. If source metadata is unavailable, state the specific gap and avoid claiming that the result represents the customer's whole business.

### Make operational trust details usable

- Define each KPI group, chart, and table in plain language: the business question, metric meaning, date basis, and applied filters. Keep essential scope visible; put secondary methodology in an accessible details control. Raw SQL is supporting evidence, not the user-facing explanation.
- Show source last-updated time, not the browser render time. Use a shared freshness label only when the datasets share a refresh boundary; otherwise label the differing datasets. Preserve last successful freshness during refresh errors and visibly mark stale/partial results.
- For office-aware sources, offer All Offices and supported office selection or comparison. Synchronize that filter across the relevant displays and drilldowns. If the source covers only a subset, label All Offices as all available offices rather than all company offices.
- Derive test/retired office status from an authoritative source field, not names or guessed labels. Production operational views exclude known test offices by default and expose their inclusion explicitly. Current operational views exclude known retired offices by default; historical activity views retain offices relevant to the selected period. Show and explain those inclusion states. Unknown classification remains visibly unknown and is never silently counted as verified active production coverage; when classification is unavailable, disclose that limitation rather than offering a fake filter.
- State the entity grain and distinct-count key. Aggregate one-to-many child records before joining, or use a justified distinct count; reconcile totals so joined rows cannot inflate customers, subscriptions, revenue, or denominators.

## Map the requested features to evidence

For a new dashboard or substantial revision, list the features needed for this user's task before composing it. Map each to a screen, reusable component, expanded state, or test. Keep this small for a small change; do not turn the reference checklist into a requirement to add every chart or control.

Use a compact ledger: **feature | purpose | component/state | evidence | status**. Update it when scope changes. An entry button does not prove the destination state exists, and a note describing hover behavior does not replace a drawn or working hover state. Distinguish designed, implemented, and behavior-verified coverage in the handoff.

For reference-led work, inspect relevant real product screens as well as documentation. Record the specific pattern to borrow and how it answers the user's question. Preserve the product's own visual language. See the [research and critique loop](references/storybook-quality-loop.md#research-and-critique) for scope and evidence.

## Compose the answer before the controls

Use this default hierarchy, removing layers that do not earn their space:

1. Page identity, scope, freshness, and primary action.
2. A few contextual KPIs only when they summarize the user's question.
3. One main analytical view that carries the page's answer.
4. Exceptions, alerts, or work requiring action.
5. Detailed records for verification and follow-through.

Read [Dashboard composition and data display](references/dashboard-composition-and-data.md) when selecting metrics, charts, tables, hierarchy, or layout.

- For graph components, axes, comparisons, tooltips, palette roles, or forecast/missing-data styling, read [Chart system and quality](references/chart-system-and-quality.md).
- For spreadsheet-style reporting, totals, sorting, column controls, exports, or record drilldowns, read [Reporting tables](references/reporting-tables.md).

## Apply the quality floor

- Make the usable dashboard the first screen. Do not lead with a hero, slogan, or ornamental illustration.
- Prefer clear regions, alignment, and whitespace over nested cards. Avoid a card around every element.
- Keep operational layouts compact and calm. Choose type scale, spacing, radii and elevation for the product's density and published design system; avoid treatments that compete with the data.
- Start with a neutral base. Separate categorical series colors, sequential scales, and semantic status colors; a palette alone is not a chart system. Supplement color with labels, stroke, shape, or position.
- Give every number a unit and enough context to interpret it: label, time range, baseline or delta, and freshness where relevant.
- Distinguish zero, missing, unavailable, loading, stale, and error states. They are not interchangeable.
- Keep identity, applied scope, active sorting, View data, and primary actions discoverable. Reveal secondary utilities on hover and focus-within, reserve their space, and keep a visible touch equivalent. Show collapsed control state on its trigger.
- Keep dimensions stable as data loads. Avoid layout shifts, clipped overlays, unreadable axes, and accidental page overflow.
- Use familiar icons with accessible names. Keep important or ambiguous commands labeled.
- Make the next action obvious, especially for exceptions and recoverable failures.

Read [Interaction, states, and accessibility](references/interaction-states-and-accessibility.md) for filters, menus, drawers, responsive behavior, keyboard support, and applicable data states.

## Work through Storybook

For implementation in a Storybook-enabled project, create or update the matching `*.stories.tsx` alongside the component. Cover materially different behavior, not every cosmetic variation. Include realistic dense data and unusually long labels. For design-only work, draw the relevant states and inspect exports; do not create application code merely to satisfy this section.

At minimum, verify the relevant combinations of:

- ready, loading, empty, zero, partial, stale, error, and permission states;
- dense data and long labels;
- narrow viewport and responsive toolbar behavior;
- open popovers, menus, dialogs, or drawers;
- filter, sort, drilldown, retry, and keyboard interactions.

Use play functions for important interactions. Inspect desktop and mobile renders and run checks appropriate to the change. Fix material accessibility, clipping, overflow, and overlay failures before calling the relevant deliverable complete. Static inspection cannot establish keyboard, screen-reader, filtering, or export behavior.

Read [Storybook dashboard quality loop](references/storybook-quality-loop.md) before implementing or validating a dashboard in a Storybook-enabled project.

## Review in decision order

Use the [generic-output versus product-value signals](references/storybook-quality-loop.md#generic-output-versus-product-value) when judging polish or responding to an "AI slop" critique. Evaluate each element's purpose, data meaning, interaction and fit with the product. Do not treat a particular color, card shape or gradient as proof of poor quality.

Review the rendered result from highest to lowest risk:

1. Can the intended user answer the main question quickly?
2. Are the data, comparisons, and freshness truthful and unambiguous?
3. Are exceptions and next actions visible?
4. Do loading, empty, partial, stale, error, and permission states remain useful?
5. Do keyboard, focus, contrast, semantics, and responsive behavior hold up?
6. Does the visual finish feel coherent with the product rather than generically generated?

Do not approve from source code alone. Use a rendered screenshot or live Storybook state as evidence. Reconcile the feature ledger with the final result. For substantial reference-led design work, use an independent critic when requested or authorized, fix concrete findings, and re-review the changed states. State what was inspected and what remains unverified.

## Topline distribution

Treat this as a Topline-owned default skill. The platform creates an approved tenant-local copy and an unpinned binding for every project. When Topline ships changed files, the platform refresh creates a new approved version and existing bindings use it in future coding sessions.

Do not re-import this repository path as a separate customer-owned skill.
