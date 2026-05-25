## Context

The current web board is implemented primarily in `web/src/views/BoardView.vue`, with dense tabular sections rendered by `web/src/components/DenseRows.vue`, the operation section rendered by `web/src/components/OperationTimeline.vue`, and vertical module labels rendered by `web/src/components/SideLabel.vue`.

The current presentation is optimized for a dark, fixed-height dashboard:

```
BoardView.vue
├─ dark board page and card styling
├─ fixed-ish header height
├─ operation module with fixed minimum height
└─ DenseRows.vue
   ├─ fixed row-height variable
   ├─ fixed visible-row body height
   ├─ all non-time columns share equal width
   └─ cell text is nowrap + ellipsis
```

The requested presentation is closer to a readable work log: light background, compact cards, wider task columns, and wrapping task text.

## Goals / Non-Goals

**Goals:**

- Re-theme the board route to a light visual treatment while preserving the current information hierarchy.
- Make the board title read `变电运维工作日志`.
- Reduce the visual height of the top header/time card.
- Reduce the operation timeline section height and avoid unnecessary empty vertical space.
- Prioritize task readability in dense tables by widening `任务` columns.
- Allow task text to wrap and increase row height when needed.
- Keep non-task columns compact and readable.
- Update existing tests to describe the new presentation behavior.

**Non-Goals:**

- No backend, API, snapshot schema, database, or polling/SSE behavior changes.
- No redesign of the admin pages.
- No new UI framework or external dependency.
- No semantic change to how board data is fetched, transformed, or refreshed.

## Decisions

### Decision 1: Use a light theme scoped to the board presentation

The implementation should update the board page, modules, table rows, side labels, and operation timeline styling to use light backgrounds and darker text. The scope should stay within the board route and shared board-only components where possible.

Alternatives considered:
- Keep dark cards on a light page: lower effort, but visually inconsistent.
- Introduce full theme tokens: useful long term, but too broad for this targeted UI change.

### Decision 2: Treat the operation timeline as compact fixed-content, not fully fluid height

`vis-timeline` works best with an explicit rendered height. The operation module should remove unnecessary module-level minimum height and reduce timeline padding/height, but the timeline viewport itself should retain a deliberate compact height.

Alternatives considered:
- Fully auto-height timeline: risks unstable rendering because the timeline library expects measurable space.
- Leave timeline height unchanged: does not satisfy the requested height reduction.

### Decision 3: Give task columns explicit priority in `DenseRows`

`DenseRows` should generate grid template columns using column semantics:

```
timeTag → compact fixed width
task    → widest flexible column
target  → medium/narrow flexible column
others  → compact flexible columns
```

This avoids per-view CSS hacks and keeps the behavior consistent across permit and other tables.

Alternatives considered:
- Hard-code column templates in `BoardView.vue`: precise per-section control but leaks layout concerns into the view.
- Keep all non-time columns equal: preserves old behavior but does not improve task readability.

### Decision 4: Allow wrapping primarily through cell styles, with caution around auto-scroll

Task text should wrap using normal whitespace and overflow wrapping. Because the existing auto-scroll animation assumes fixed row height, implementation should either:

1. keep row heights bounded enough for the current scroll animation to remain acceptable, or
2. disable/adjust looping behavior when variable-height wrapping would make scrolling inaccurate.

The preferred first implementation is conservative: enable wrapping, use minimum row heights, and verify that overflow tables remain visually acceptable. If variable heights break seamless scrolling, prioritize readable non-truncated text over seamless looping.

Alternatives considered:
- Keep nowrap/ellipsis: simplest but conflicts with the core requirement.
- Rebuild scrolling using measured DOM heights: more robust but larger than this UI refinement needs.

## Risks / Trade-offs

- Variable-height rows can conflict with the current fixed-distance auto-scroll animation → verify overflow tables manually and adjust/disable looping if it becomes visually incorrect.
- Light theme changes may reduce contrast for timeline items or status pills → verify text contrast after styling.
- Compressing non-task columns can make personnel/vehicle/other text wrap more often → keep compact columns readable and prioritize task content as requested.
- Header height reduction can crowd title, time, and status on narrow screens → preserve responsive behavior with flexible grid columns and nowrap where appropriate for the time string.
