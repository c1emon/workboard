## Why

The web board currently uses a dark dashboard presentation with compact fixed-height rows, which makes longer task text hard to read and does not match the requested lighter “work log” presentation. This change improves readability for operations staff by moving the board toward a light visual style, emphasizing task content, and allowing task text to wrap instead of being truncated.

## What Changes

- Rename the board title from `工作任务看板` to `变电运维工作日志`.
- Change the board page from a dark dashboard theme to a light, low-contrast work-log theme.
- Reduce the visual height of the top time/header card while keeping the date/time readable and centered.
- Reduce the operation timeline card height so it fits its content more tightly.
- Increase the width allocation for `任务` columns in dense board tables and compress less important columns.
- Allow overflowing task text to wrap and expand row height instead of truncating with ellipsis.
- Preserve the existing board data flow, refresh behavior, and connection status behavior.

## Capabilities

### New Capabilities
- `board-log-presentation`: Covers the visual and layout requirements for presenting the web board as a readable light-themed substation operation work log.

### Modified Capabilities

None.

## Impact

- Affected frontend view/component files:
  - `web/src/views/BoardView.vue`
  - `web/src/components/DenseRows.vue`
  - `web/src/components/OperationTimeline.vue`
  - `web/src/components/SideLabel.vue`
  - potentially `web/src/styles.css`
- Affected tests:
  - `web/tests/BoardView.test.ts`
  - `web/tests/DenseRows.test.ts`
- No backend API, database, or dependency changes are expected.
