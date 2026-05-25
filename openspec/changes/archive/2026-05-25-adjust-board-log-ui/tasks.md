## 1. Board Header and Light Theme

- [x] 1.1 Update `BoardView.vue` title text from `工作任务看板` to `变电运维工作日志`.
- [x] 1.2 Convert `BoardView.vue` page, header, module, status, and leave-section styling from dark dashboard colors to a light work-log theme.
- [x] 1.3 Reduce the header/time card vertical size while keeping the formatted time centered and readable.
- [x] 1.4 Update `SideLabel.vue` styling so module labels fit the light board theme.

## 2. Operation Timeline Compact Styling

- [x] 2.1 Remove unnecessary operation-module reserved height in `BoardView.vue`.
- [x] 2.2 Reduce `OperationTimeline.vue` padding and timeline viewport height while preserving operation item readability.
- [x] 2.3 Update operation timeline axis, grid, item, and server-time marker colors for the light theme.

## 3. Dense Table Layout and Wrapping

- [x] 3.1 Update `DenseRows.vue` column-template generation so `任务` columns receive wider flexible width than lower-priority non-time columns.
- [x] 3.2 Compress time, personnel, vehicle, other, and similar non-task columns while preserving readability.
- [x] 3.3 Allow task cell text to wrap and expand row height instead of using nowrap ellipsis.
- [x] 3.4 Verify or adjust dense-row auto-scroll behavior so wrapped rows do not create misleading or broken scrolling.
- [x] 3.5 Update dense table header, row, empty-state, muted-cell, and time-tag colors for the light theme.

## 4. Tests and Verification

- [x] 4.1 Update `BoardView.test.ts` expectations for the new title and preserved header time behavior.
- [x] 4.2 Update `DenseRows.test.ts` expectations for task-priority column sizing and wrapping behavior.
- [x] 4.3 Run the relevant web test suite and fix regressions caused by the presentation change.
- [x] 4.4 Manually review the board page with representative long task text to confirm wrapping, row height, compact cards, and light-theme readability.
