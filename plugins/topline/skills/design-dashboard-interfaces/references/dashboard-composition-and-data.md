# Dashboard composition and data display

**Aliases:** dashboard layout, information hierarchy, KPI design, data visualization, chart selection, data table
**Components:** page header, KPI, metric, chart, table, alert, activity feed, timeline, map
**Symptoms:** card soup, chart junk, rainbow dashboard, unexplained number, unreadable table, weak hierarchy, too many KPIs
**Tasks:** choose a chart, organize a dashboard, design a KPI, improve a table, show trends, show exceptions
**Tags:** `dashboard` `layout` `hierarchy` `metrics` `kpi` `charts` `tables` `data-viz` `density`

## Start from the question

Do not begin with a widget inventory. Write the question the page must answer, the comparison needed to answer it, and the action that follows. Add a view only when it contributes to that chain.

Prefer an answer-first title such as “Renewals at risk this month” over a container label such as “Renewal Dashboard.” Keep the title truthful when filters change.

## Choose the display by analytical relationship

| User need | Default display | Notes |
| --- | --- | --- |
| Look up exact values or compare records | Table | Preserve scanning, sorting, and row context. |
| Understand one current value | KPI | Pair it with time, unit, baseline, and freshness. |
| See change over time | Line or column chart | Use consistent intervals and reveal missing periods. |
| Compare or rank categories | Ordered bar chart | Begin at zero when bar length encodes magnitude. |
| Inspect a distribution | Histogram, box plot, or dot plot | Show spread and outliers, not only the average. |
| Compare parts of a whole | Stacked bar | Use few stable categories; provide totals when useful. |
| Inspect correlation | Scatter plot | Do not imply causation; identify important outliers. |
| Compare activity across categories and time | Heatmap | Align headers with cells and use a shared sequential scale with exact values available. |
| Compare many similar series | Small multiples | Share scales when the comparison depends on absolute magnitude. |
| Follow status or event history | Timeline | Preserve sequence, timestamps, actor, and outcome. |
| Understand location as a cause or constraint | Map | Do not use a map when a ranked list answers better. |

Avoid gauges, 3D charts, decorative pies, and dual axes unless the relationship cannot be shown more plainly.

## Build hierarchy with meaning

Use a small number of visual levels:

1. **Scope:** title, entity, time range, freshness, and primary action.
2. **Summary:** only metrics that change the user's understanding.
3. **Analysis:** the primary comparison or trend.
4. **Action:** exceptions and work queues.
5. **Evidence:** detailed records, methodology, and supporting context.

Use alignment, spacing, typography, and background changes before adding borders or cards. Group by task and meaning, not merely by matching component type.

## Design honest KPIs

Every KPI should answer: what, when, compared with what, and whether the direction is good or bad.

- Include a unit and descriptive label.
- Show the relevant time window.
- Pair the value with a target, prior period, or other justified baseline.
- State whether the delta is absolute or relative.
- Distinguish percentage points from relative percent change, and avoid division by a zero or missing baseline.
- Define the numerator, denominator, inclusion rules, and date basis. Aggregate rates from the underlying counts rather than averaging displayed percentages.
- Use directional language or symbols in addition to color.
- Show freshness once at the nearest shared scope rather than repeating it noisily.
- Do not animate values or use oversized numbers merely to create drama.

If the metric has no meaningful comparison or action, it may belong in the detail view rather than the summary row.

## Make charts readable without interaction

Keep the title, scope, units, useful scale and series identification visible. A tooltip supplements this reading; it does not supply information required to recognize the main pattern. Give the user a discoverable exact-value path and useful source context.

Use [Chart system and quality](chart-system-and-quality.md) for the graph's geometry, styling roles, comparisons, interaction states, uncertainty and real-product reference patterns.

## Make tables operational

Put identifiers first, keep comparison columns aligned, and make scope and applied sorting visible. Use status chips for a bounded vocabulary, not every cell. Decide whether the task is read-only reporting or includes operational actions before adding controls.

Use [Reporting tables](reporting-tables.md) for search, sorting, column behavior, totals, pagination, copy/export, disclosure, and responsive drilldowns.

## Visual finish

- Use a neutral surface and one clear content plane.
- Use semantic accents for status, selection, and important series, not decoration.
- Keep shadows subtle and reserve them for true elevation such as overlays.
- Use consistent corner radii from the product system; choose region boundaries and elevation for meaningful grouping, not to put every element in a card.
- Use compact type with strong label/value contrast, not landing-page display sizes.
- Align titles, controls, chart plots, and table edges to a shared grid.
- Prefer useful whitespace to empty spectacle; dense does not mean cramped.

## References

- [Financial Times Visual Vocabulary](https://github.com/Financial-Times/chart-doctor/blob/main/visual-vocabulary/README.md)
- [Dashboard design and progressive disclosure video](https://www.youtube.com/watch?v=Ksx9C2-3yMo)
- [Nielsen Norman Group: Visual Hierarchy in UX](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/)
