# Storybook dashboard quality loop

**Aliases:** component workshop, visual QA, interaction testing, dashboard acceptance, UI audit
**Components:** story, play function, viewport, accessibility test, screenshot, design system
**Symptoms:** untested state, app-only component, Storybook drift, broken mobile layout, inaccessible overlay, screenshot mismatch
**Tasks:** inspect components, create stories, test interactions, audit dashboard, validate responsive UI
**Tags:** `storybook` `mcp` `stories` `visual-testing` `interaction-testing` `accessibility` `qa`

## Research and critique

For a substantial new or reference-led design, inspect a small set of relevant real product screens and their documented behavior. Record the exact pattern to borrow, its source, and why it fits this user's question. A generic dashboard screenshot or a palette does not establish that its graph, filter, or drilldown behavior is appropriate. Use the [graph reference shortlist](chart-system-and-quality.md#reference-patterns-to-inspect) when graphs are the focus; browse only the relevant sources.

Keep a feature ledger tied to concrete components and states. Scale it to the request: a single existing KPI adjustment may need one entry and one rendered check. A new reporting kit needs the selected charts, controls, data states and narrow layouts mapped. Do not add unrelated features to satisfy an exhaustive inventory.

For design-only work, inspect the actual design frames and exports. Clearly label synthetic data; check that its values, totals and claims reconcile. If a renderer fails, diagnose it or inspect another faithful export, disclose the inspection route, and state any fidelity limits. Blank output, present text layers, or nominal bounds are not visual approval. Do not infer working behavior from a static drawing.

When an independent critic is requested or authorized for substantial work, provide the brief, current rendered evidence, feature ledger and relevant source data. Ask for concrete findings, impact and the smallest correction. Fix material findings and re-review the changed states. Use this decision order:

1. Purpose, grain, scope, and whether the intended question is answerable.
2. Numerical agreement between marks, totals, comparisons and claims.
3. Appropriate scales, shared geometry, label alignment and honest missing/forecast states.
4. Readable text and necessary data marks, series identification beyond color, and useful density.
5. Discoverable exact values, filtering/drilldown, visible scope and a recovery/return path.
6. Actual rest/hover/focus/touch/overlay specimens and narrow layout.
7. Feature coverage supported by a real destination state, not merely an entry button or note.

Close with remaining actionable findings and the limits of the evidence. Do not restart broad review after relevant fixes pass unless new changes or concerns justify it. A minor preference is not a missing requirement.

## Generic output versus product value

When a request mentions "AI slop," translate that concern into observable design findings. Familiar styling does not establish who made an interface or whether it serves its users. Rounded cards, gradients, large values and bright colors can fit a polished product; judge their purpose, restraint and consistency with the brand.

| Dimension | Signal to investigate | Evidence of product value | Useful correction |
| --- | --- | --- | --- |
| Purpose | Plausible KPIs or widgets that could appear in any business | Each view helps a named user answer a question or make a decision | Remove, combine or defer elements that add no useful information; do not fill space with more metrics. |
| Hierarchy | Every card has equal emphasis; decorative space dominates the analytical view | The main answer is easy to find and supporting evidence follows in a deliberate order | Adjust grouping, reading order and relative emphasis before adding visual effects. |
| Data meaning | Impressive numbers, unexplained deltas, optimistic colors or summaries unsupported by the data | Units, grain, scope, definitions, comparison basis and freshness make claims checkable | Verify the calculation and context; qualify uncertainty and make summary language match the data. |
| Graphs | Chart variety chosen for appearance, attractive palettes over unreadable marks, misaligned labels | The mark type answers the analytical question; axes, labels and exact values agree | Fix chart choice, shared geometry, scale and labeling before changing colors. |
| Interaction | Buttons, filters or info icons suggest features whose destination or result is absent | An action has a clear scope, useful destination, visible result and reliable return path | Depict the missing state for a design proposal; implement and test the outcome for a working UI. |
| Disclosure | A crowded toolbar, hover-only essentials, or controls that make rows shift | Primary routes remain discoverable and secondary utilities work across hover, focus and touch | Reserve space, keep applied state visible, and inspect the actual open control and dismissal path. |
| Resilience | Only tidy fixture rows and the ideal screenshot work | Applicable missing, partial, stale, error, long-label and narrow states stay understandable | Exercise the affected realistic cases; preserve trustworthy content and provide scoped recovery. |
| Visual finish | Arbitrary spacing, oversized numbers, competing accents or repeated containers | Consistent alignment, readable density, controlled emphasis and coherent product styling | Reuse product tokens and shared layout geometry; simplify treatments that obscure information. |

Use these as diagnostic signals, not an aesthetic blacklist or a numeric "slop score." A simple table can be the complete answer; adding chart types or checking more feature boxes is not evidence of greater value. Apply only the dimensions relevant to the requested change.

Write each actionable finding as **observed problem → user impact → smallest correction → acceptance evidence**. Attach it to a specific component or state in the feature ledger. Address misleading data and broken actions before minor visual preferences, and distinguish a static design observation from verified behavior.

For example:

- A histogram's largest interval contains 35%, but its title says "Most services take 30–44 minutes." Change it to "Most common duration: 30–44 min" and verify that the wording still matches the filtered distribution. A color change would not resolve the misleading claim.
- Heatmap weekday labels do not align with their cells. Give the header and data rows the same column grid, then inspect date/value lookup at desktop and narrow widths. A more attractive palette would not resolve the ambiguous mapping.

For a substantial dashboard review, follow one representative path: identify the scope, explain a value or change, inspect its evidence, take the intended action and return. Record where the interface fails to support that path. Use a real user walkthrough when available; otherwise describe this as a reviewer check, not usability-test evidence.

## Inspect before editing

For implementation in a Storybook-enabled project, inspect the relevant published or local story. A design-only brief can use supplied rendered references without launching a server.

1. When local live inspection is needed, start or reuse Storybook on the project's exact configured port. In Topline, run `npm run storybook` from the repository root and use `http://127.0.0.1:6006`.
2. Use Storybook MCP before source exploration:
   - `list-all-documentation` to find existing components and stories;
   - `get-documentation` for component usage, props, and examples;
   - `get-documentation-for-story` for a known story.
3. Read the customer's published brand description and inspect its rendered stories. Use them as the reference for visual character, hierarchy, density, typography, color, spacing, imagery, interaction, and voice.
4. Inspect the nearest product screen and its stories.
5. Reuse design-system components and tokens. In a Topline coding harness, prefer `src/design-system/` and do not install replacements for components that already exist.

Storybook is not only a testing surface. In Topline it is also where a customer can express and publish its brand direction for later application work. Use the published reference, not an unpublished draft or another tenant's stories. If it is unavailable, state the limitation and use the project's established defaults instead of inventing customer-specific brand rules.

## Keep stories aligned with the app

For Topline frontend changes, update the matching `*.stories.tsx` with the implementation. A story should represent a materially different state or interaction, not merely a different sentence of copy.

Reuse an existing matching story for the changed component rather than adding a cosmetic duplicate. For a spacing-only change, its rendered state can supply the before/after evidence. Follow explicit repository requirements for same-change story updates; adjust relevant documentation or checks when needed without inventing a new variant.

Choose the smallest useful set from:

- `Ready` with credible domain data;
- `Loading` with stable structure;
- `Empty` and valid `Zero` when both can occur;
- `PartialOrStale` with freshness context;
- `Error` or `PermissionDenied` with recovery guidance;
- `DenseData` with long labels, large numbers, and outliers;
- `NarrowViewport` for responsive behavior;
- `OverlayOpen` for filters, menus, dialogs, or drawers.

Build shared fixtures only when several stories truly use the same data shape.

## Test behavior in the story

Use play functions for important workflows:

- apply and clear filters;
- change sort or time range;
- open and dismiss progressive disclosure;
- drill into a record and return without losing context;
- retry a failed or stale request;
- navigate controls by keyboard and close overlays with Escape;
- inspect a chart value by the supported keyboard/touch path and reach the same underlying data;
- export the requested row/series/date scope, including comparison dates, and recover from a failed export when supported.

Assert observable user outcomes: labels, values, selected state, focus, and visible results. Avoid tests coupled to internal component state.

## Inspect the rendered result

Check a desktop viewport around `1440x1000` and a narrow viewport around `390x844`, plus any product-specific breakpoint. Look for:

- a clear question and reading order;
- realistic density, long labels, large and negative values;
- clipped text, accidental horizontal page overflow, and unstable heights;
- unreadable chart labels, missing units, and misleading scales;
- popovers, menus, dialogs, and tooltips escaping or clipping;
- focus visibility, target size, contrast, and color-only meaning;
- loading, empty, partial, stale, error, and permission behavior.

Do not approve from the story source alone. Capture or inspect rendered evidence.

## Run proportionate validation

For an implementation, run the relevant focused tests and the repository's required checks. From the Topline repository root, pass the changed surface's test path after `--` to `npm test -w @platform/web`. Use the UI audit when its surface checks apply:

```powershell
npm run storybook:audit-ui
```

Run `npm run build-storybook -w @platform/web` when changing Storybook configuration, shared decorators, or enough stories to justify the broader build check.

For generated artifact applications, run the package's focused tests and smoke checks, deploy only a draft when requested by the workflow, inspect a screenshot, and validate the request. Do not publish automatically.

Design-only handoffs report inspected frames and relevant static checks. Implementation handoffs distinguish those from passing interaction tests, data validation, and any release status. Preserve the user's existing authorization; a critique result does not authorize publication.

## References

- [Storybook MCP overview](https://storybook.js.org/docs/ai/mcp/overview)
- [Storybook MCP API](https://storybook.js.org/docs/ai/mcp/api)
- [Storybook interaction testing](https://storybook.js.org/docs/writing-tests/interaction-testing)
- [Storybook accessibility testing](https://storybook.js.org/docs/writing-tests/accessibility-testing)
