# Interaction, states, and accessibility

**Aliases:** progressive disclosure, dashboard controls, state design, responsive dashboard, inclusive dashboard
**Components:** filter, sort, toolbar, popover, menu, tooltip, drawer, dialog, tabs, pagination, date range
**Symptoms:** control clutter, hidden filters, hover-only UI, clipped popover, blank empty state, ambiguous loading, mobile overflow
**Tasks:** simplify controls, design filters, add disclosure, handle loading, make responsive, improve accessibility
**Tags:** `interaction` `progressive-disclosure` `filters` `states` `responsive` `keyboard` `a11y` `overlays`

## Use progressive disclosure without hiding state

Place each control at the least prominent level that keeps it discoverable:

1. **Always visible labeled control:** frequent, primary, or high-consequence action.
2. **Visible icon with accessible name:** familiar compact action; add a tooltip when meaning may be unclear.
3. **Popover or menu:** related secondary controls that should stay near context.
4. **Sheet, drawer, or dialog:** multi-step configuration or detail that needs more space.
5. **Contextual reveal:** row or mark actions revealed on hover and focus, with a touch-accessible equivalent.
6. **Shortcut or gesture:** optional accelerator only, never the sole access path.

When controls are collapsed, show their state on the trigger: active filter count, sort direction, selected date range, saved-view name, or warning indicator. Opening a filter or sort control should not navigate away from the dashboard.

Keep an overlay anchored near its trigger, within the viewport, and above surrounding content. Return focus to the trigger when it closes. Support Escape where expected.

For rows and charts, keep identity, applied scope and primary data/action routes visible. Reserve room for supplemental copy, expand and More controls; reveal them on hover or focus-within without shifting surrounding content. Touch gets a persistent visible route. Inspect the same component at rest, on focus/hover, and with its menu open; prose descriptions alone do not show that the states work together.

## Design the full state matrix

Cover the states that can occur in the intended workflow and are affected by the change. This matrix prompts applicability; it does not require every state on every dashboard or a new state inventory for an isolated spacing edit.

| State | Required behavior |
| --- | --- |
| Loading | Preserve page structure; identify what is loading; avoid fake precision and layout shift. |
| Empty | Explain why there is no data and offer a relevant next step. |
| No matches | Show the query/filter scope and a clear or adjust action; do not imply the source has no records. |
| Valid zero | Show `0` plainly; do not use an empty-state illustration. |
| Unavailable/missing | Identify values or periods not received; do not substitute zero or imply collection was complete. |
| Partial | Identify which scope is incomplete and what remains trustworthy. |
| Stale | Show the last successful update and a refresh or recovery path. |
| Error | Keep unaffected content usable; explain impact and offer retry or support context. |
| Permission | Name the unavailable capability and how access can be requested. |
| Offline | Preserve last-known data when safe and label it clearly. |
| Long or dense | Preserve meaning with wrapping, expansion, or intentional truncation. |
| Negative or extreme | Keep scales, signs, units, and semantic direction truthful. |

Do not merge these states into one generic “No data” treatment.

## Make filtering predictable

- Define whether filters apply immediately or after an Apply action; do not mix models.
- Show active filters outside the closed control and make clearing them easy.
- Preserve filters across drilldown and back navigation when the user remains in the same task.
- State filter scope when multiple charts or regions respond differently.
- Show result count or visible impact after a filter changes.
- Provide a sensible default time range and display it explicitly.
- Do not reset user state because background data refreshed.
- Reset or reconcile pagination deliberately when the matching set changes, so a previously valid page does not become an unexplained empty screen.
- When selecting a chart mark filters records, show the selected mark and applied scope, with a clear/reset route. Restore the originating focus and view state when returning from a detail.

## Support keyboard and assistive technology

- Use semantic headings, landmarks, forms, buttons, links, and tables.
- Use native controls before custom interaction primitives.
- Maintain a logical tab order and a visible focus indicator.
- Give icon-only controls accessible names.
- Make pointer targets comfortable and separate destructive actions.
- Pair color with text, shape, icon, position, or pattern.
- Announce meaningful asynchronous status changes without stealing focus.
- Provide a text summary or accessible table for charts when the visual alone is insufficient.
- Respect reduced-motion preferences and avoid gratuitous motion.
- Ensure hover content can also appear on focus and remains dismissible. Keep supplemental hover content available long enough to inspect it and allow the pointer to enter it where appropriate; persistent selected detail closes deliberately.

Treat WCAG 2.2 AA as the baseline unless the project specifies a stronger standard.

## Adapt rather than shrink

At narrow widths:

- Keep the page identity, critical status, and primary action visible.
- Stack analysis regions in decision order.
- Wrap the toolbar or move secondary controls into a labeled sheet.
- Preserve metric labels, units, and comparisons.
- Reduce chart ticks or use a deliberate series/detail view before reducing label text size. Keep the same data accessible through a table or persistent inspector.
- Reduce table columns by priority and provide record details; use bounded horizontal scrolling only when the table relationship must remain intact.
- Keep dialogs, menus, tooltips, and date pickers within the viewport.
- Check 200% zoom, long labels, large numbers, and touch input in addition to a nominal mobile viewport.

## References

- [Dashboard design and progressive disclosure video](https://www.youtube.com/watch?v=Ksx9C2-3yMo)
- [W3C Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/WCAG22/)
- [WAI-ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WAI guidance for status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
