# Web Notes

The web app is a Vue 3 + Vite client. It provides the board view for daily execution and the admin view for managing schedules, templates, generated instances, leave, and holidays.

## Run

```bash
pnpm dev:web
```

API requests default to same-origin `/api` URLs. During development, Vite proxies them to `http://127.0.0.1:4000`; in the default Compose deployment, Nginx proxies them to `http://server:4000`. Other computers can open the frontend using the host's LAN address without changing API configuration.

For a separately hosted API, set `VITE_API_BASE` to its browser-accessible origin before starting Vite or building the frontend. The value does not include `/api` and is embedded at build time.

## Patrol Excel Import

The `周期项` worksheet (or the only detail worksheet) must start with these headers: `周期第几天`, `时间`, `目标`, `人员`, `车辆`, `其他`. Columns may be reordered, surrounding header whitespace is ignored, and extra columns are ignored. Missing required headers or duplicate named headers are rejected. Empty optional values are preserved as empty strings, blank rows are skipped, and validation errors use the worksheet's original row numbers.

## Main Areas

- `src/views/BoardView.vue`: execution board page.
- `src/views/AdminView.vue`: admin shell and module switching.
- `src/components/admin/`: admin forms, tables, dialogs, and module panels.
- `src/composables/admin/`: admin state and workflow logic.
- `src/api/client.ts`: typed API calls shared by the views and composables.

Keep UI state in composables when it is shared across controls or modals. Keep presentational details inside components and shared admin CSS files.

## Verification

```bash
pnpm --filter ./web test
pnpm --filter ./web build
```

## Operation and Plan Workflows

Operation and patrol management both default to a task-instance tab. Operation uses `任务实例 / 操作计划`; patrol uses `任务实例 / 巡视模板`. Operation instances display exact Beijing start/end datetimes, and manual pending instances can be created and edited with those times. Instance filters are separate for each task type and from plan filters. The operation plan tab shows the globally saved board plan above its date filter. Choosing a disabled plan keeps that selection and displays `无可展示计划` on the board. Disabling or deleting the selected plan never selects another plan automatically.

Use **更多 → 重新生成实例** for a row, or the button on the operation task-instance tab to choose from all saved plans. Recurring plans require a child task and its actual start time; one-time plans start at cycle zero. All times are Beijing time. The cutoff is exclusive on task start, and eligible tasks keep their full duration. Confirmation replaces all of that plan's unstarted generated pending instances, including old arrangements outside the new range. In-progress, completed, cancelled, manual and adjusted instances are protected. A network failure can leave the write outcome unknown; inspect the saved result before retrying.

**导入子任务 / 导入周期项** validates the entire XLSX before showing a preview of at most five rows. Confirm once to replace the selected existing plan's details. Basic plan information and generated instance content/status are preserved; regenerate separately if needed. Existing foreign-key links to removed template items are cleared by SQLite, while generation keys and instance snapshots remain intact.

Operation imports require `任务内容`, `开始偏移（分钟）`, `持续时间（分钟）`; optional `序号` controls ordering, otherwise file order is used. Offsets are nonnegative integer minutes and durations are positive integer minutes. Additional uniquely named columns preserve scalar extension values. Patrol imports retain the six business columns described above. A named `子任务` or `周期项` sheet takes precedence; a single detail sheet is also accepted. `计划信息` is never interpreted as details. Duplicate headers, including optional or extension columns, are rejected.

**导出计划 XLSX** downloads one saved plan definition with `计划信息` and all `子任务` or `周期项`, including an empty detail sheet for empty plans. Extension fields follow fixed columns; colliding names receive an `扩展：` prefix. Generated instances and their execution states are excluded. Downloadable import templates contain headers only.
