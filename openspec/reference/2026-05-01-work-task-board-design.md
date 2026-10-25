# Work Task Board MVP Design

## Goal

Build a single-user work task board system for managers to maintain plans and tasks in an admin page, with a large-screen board page that automatically displays the latest information.

The MVP prioritizes a complete data loop:

- Admin can maintain operation plans, patrol plans, other arrangements, leave personnel, and holidays.
- Board page renders the current state automatically.
- Board page updates through SSE after admin changes, with polling as a fallback.
- Backend remains simple and local-friendly, using SQLite.

## Technology

### Repository Structure

Frontend and backend live in the same project directory.

Proposed structure:

```text
server/
  src/
  db/
  tests/
web/
  src/
  tests/
docs/
```

### Backend

- Runtime: Node.js with TypeScript.
- Framework: Fastify.
- Database: SQLite.
- Database access: a lightweight query layer such as `better-sqlite3`.
- Concurrency: not a design concern for MVP. The app is intended for one manager editing data.
- Initial/base data: inserted externally into SQLite through scripts or manual DB tools, not hard-coded in the main server program.

### Frontend

- Vue 3 + TypeScript + Vite.
- Board page and admin page are separate routes in the same frontend app.
- Operation timeline uses `vis-timeline`.
- Board data sync uses SSE plus periodic fallback refresh.

## Pages

### Board Page

Route: `/board`

The board is optimized for a 16:9 large screen. It uses a compact dark operational style with high information density.

Vertical layout from top to bottom:

1. Basic information
2. Operation arrangements
3. Permit arrangements
4. Patrol arrangements
5. Other arrangements
6. Leave personnel

Basic information stays at the top edge and should not consume the main visual area. It includes title, current time, date, and weekday.

Module labels are intentionally low-emphasis: narrow, subdued left-side labels. The content rows are the primary visual focus.

Each board module uses a narrow left-side vertical label to save vertical space:

- `操作`
- `许可`
- `巡视`
- `其他`
- `休假`

The labels are displayed as two Chinese characters stacked in one vertical column.

### Operation Arrangements

Operation arrangements are generated from operation main tasks and their child tasks.

The visible module label is `操作`. The board does not show an additional operation container name.

The board renders them as a `vis-timeline` timeline:

- The timeline center is always the current time.
- The current time has a clear vertical marker and label, such as `当前 15:42`.
- Each timeline point shows the task start or end time below the line.
- Each time range displays the task content representing that period, such as `A、B 操作`.
- The timeline should show the current period and adjacent periods when possible.
- Cross-day ranges are supported, for example `16:00-次日 08:00`.

The timeline is compact. It should not dominate the board height.

### Permit Arrangements

Permit arrangements are plain display records, not main-task plans.

The permit module sits between operation arrangements and patrol arrangements. It uses the same dense list style as patrol arrangements.

The board displays exactly six visible permit rows. If more than six rows exist, the list auto-scrolls.

Rows use five aligned columns:

1. Time tag
2. Permit/task
3. Personnel
4. Area/location
5. Other

Time tag values and sort order match patrol arrangements:

1. `全天`
2. `上午`
3. `下午`

### Patrol Arrangements

Patrol arrangements are generated from patrol main tasks and their child tasks.

The board displays exactly two visible rows. If more than two rows are active, the list auto-scrolls.

Rows use five aligned columns:

1. Time tag
2. Patrol target
3. Personnel
4. Vehicle
5. Other

Time tag values for MVP:

- `全天`
- `上午`
- `下午`

Rows are sorted by fixed time-tag order:

1. `全天`
2. `上午`
3. `下午`

The patrol list keeps internal bottom spacing so the last visible row does not touch the module boundary.

### Other Arrangements

Other arrangements are plain display records, not main-task plans.

Rows use five aligned columns:

1. Time tag
2. Task
3. Personnel
4. Vehicle
5. Other

Time tag values and sort order match patrol arrangements:

1. `全天`
2. `上午`
3. `下午`

The module occupies the remaining vertical space after operation, permit, patrol, and leave modules. If records exceed the visible range, the list auto-scrolls.

The bottom spacing rule matches patrol arrangements so list rhythm is consistent.

### Leave Personnel

Leave personnel are displayed as a single bottom row.

Only names are shown. If the list is too long, MVP truncates with ellipsis.

## Admin Page

Route: `/admin`

The admin page manages the same six board areas plus holidays.

Recommended admin sections:

- Operation plans
- Permit arrangements
- Patrol plans
- Other arrangements
- Leave personnel
- Holidays

### Operation Plan Management

Managers can create and edit operation main tasks. A main task is a container. Its child tasks define the actual operation time ranges.

Fields:

- Task type: `operation`
- Name
- Start time
- End time
- Description
- Recurrence type: `once`, `finite`, or `infinite`
- Recurrence interval minutes
- Recurrence count, used only for finite recurrence
- Skip weekends: boolean
- Skip holidays: boolean
- Enabled: boolean

Each operation main task contains child tasks.

Child task fields:

- Offset minutes from the main task start time
- Duration minutes
- Content/personnel
- Preserved extData object, not exposed as a raw JSON editor
- Sort order

Rules:

- A child task's latest end time must not exceed the main task's end time for a single occurrence.
- Child task time ranges may overlap.
- Child task offsets are relative to the main task start point, not absolute dates.

This supports schedules like:

- Main task starts at `2026-05-01 08:00`, ends at `2026-05-02 08:00`, repeats every 24 hours.
- Child task offset `0`, duration `480`: `A、B 操作`.
- Child task offset `480`, duration `960`: `C、D 操作`.

### Patrol Plan Management

Patrol plans use the same main task and child task model as operation plans.

Fields:

- Task type: `patrol`
- Name
- Start time
- End time
- Description
- Recurrence type: `once`, `finite`, or `infinite`
- Recurrence interval minutes
- Recurrence count, used only for finite recurrence
- Skip weekends: boolean
- Skip holidays: boolean
- Enabled: boolean

Patrol child tasks contain:

- Offset minutes from the main task start time
- Duration minutes
- Time tag: `全天`, `上午`, or `下午`
- Patrol target
- Personnel
- Vehicle
- Other
- Preserved extData object, not exposed as a raw JSON editor
- Sort order

### Permit Arrangement Management

Permit arrangements are simple display records.

Fields:

- Date
- Time tag: `全天`, `上午`, or `下午`
- Permit/task
- Personnel
- Area/location
- Other
- Enabled
- Sort order

MVP can show records for the current date only.

### Other Arrangement Management

Other arrangements are simple display records.

Fields:

- Date
- Time tag: `全天`, `上午`, or `下午`
- Task
- Personnel
- Vehicle
- Other
- Enabled
- Sort order

MVP can show records for the current date only.

### Leave Personnel Management

Fields:

- Date
- Name
- Enabled
- Sort order

MVP can show leave personnel for the current date only.

### Holiday Management

Holidays are manually maintained in SQLite through the admin page.

Fields:

- Date
- Name or note

Main task expansion skips these dates when the corresponding task container has `skipHolidays` enabled.

## Data Model

### Tables

`task_containers`

- `id`
- `type`: `operation` or `patrol`
- `name`
- `description`
- `start_at`
- `end_at`
- `recurrence_type`: `once`, `finite`, or `infinite`
- `recurrence_interval_minutes`
- `recurrence_count`
- `skip_weekends`
- `skip_holidays`
- `enabled`
- `created_at`
- `updated_at`

`task_items`

- `id`
- `container_id`
- `offset_minutes`
- `duration_minutes`
- `content`, used by operation child tasks
- `time_tag`, used by patrol child tasks
- `target`, used by patrol child tasks
- `personnel`
- `vehicle`, used by patrol child tasks
- `other`, used by patrol child tasks
- `ext_data_json`, JSON text for dynamic extension fields
- `sort_order`

`permit_arrangements`

- `id`
- `date`
- `time_tag`
- `permit`
- `personnel`
- `area`
- `other`
- `enabled`
- `sort_order`

`other_arrangements`

- `id`
- `date`
- `time_tag`
- `task`
- `personnel`
- `vehicle`
- `other`
- `enabled`
- `sort_order`

`leave_people`

- `id`
- `date`
- `name`
- `enabled`
- `sort_order`

`holidays`

- `id`
- `date`
- `name`

## Main Task And Child Task Calculation

Operation and patrol plans use the same two-layer model.

- Main task: the container that defines name, start time, end time, description, recurrence, and skip rules.
- Child task: the concrete task extData plus an offset from the main task start point and a duration.
- Recurrence type can be once, finite, or infinite.
- Optional weekend skipping.
- Optional manually maintained holiday skipping.

Validation rules:

- `end_at` must be after `start_at`.
- `recurrence_interval_minutes` is required for finite and infinite recurrence.
- `recurrence_count` is required for finite recurrence.
- For each child task, `offset_minutes + duration_minutes` must be less than or equal to the main task occurrence duration.
- Child tasks may overlap each other.
- For finite recurrence, `recurrence_count` means the number of eligible displayed occurrences. Weekend or holiday skips do not consume the count.
- `ext_data_json` must be valid JSON when present. MVP treats it as an object and defaults it to `{}`.
- Core board fields stay as explicit columns. `ext_data_json` is for dynamic attributes that are not yet stable enough to become schema columns.

For a given current time:

1. Select enabled main tasks whose occurrence window can intersect the board display window.
2. Expand each main task into occurrences:
   - `once`: one occurrence from `start_at` to `end_at`.
   - `finite`: up to `recurrence_count` eligible occurrences separated by `recurrence_interval_minutes`.
   - `infinite`: occurrences separated by `recurrence_interval_minutes` until the board display window is covered.
3. Skip an occurrence if its occurrence start date is a weekend and `skip_weekends` is enabled.
4. Skip an occurrence if its occurrence start date is in `holidays` and `skip_holidays` is enabled.
5. Expand child tasks within each remaining occurrence:
   - `child_start = occurrence_start + offset_minutes`.
   - `child_end = child_start + duration_minutes`.
6. Return child tasks whose time range intersects the board display window.

Child tasks may cross midnight as long as they remain within the main task occurrence window.

The board API should include adjacent operation child tasks so the timeline can show context before and after current time.

## API

### Board Data

`GET /api/board`

Returns the complete board snapshot:

```json
{
  "serverTime": "2026-05-01T15:42:18+08:00",
  "operation": {
    "items": [
      {
        "content": "A、B 操作",
        "startAt": "2026-05-01T08:00:00+08:00",
        "endAt": "2026-05-01T16:00:00+08:00",
        "extData": {}
      }
    ]
  },
  "permits": [
    {
      "timeTag": "全天",
      "permit": "动火许可",
      "personnel": "张三",
      "area": "A区",
      "other": "已审批"
    }
  ],
  "patrols": [
    {
      "timeTag": "全天",
      "target": "目标二",
      "personnel": "王五",
      "vehicle": "2 号车",
      "other": "携带记录表",
      "extData": {}
    }
  ],
  "others": [],
  "leavePeople": []
}
```

### SSE

`GET /api/events`

Sends a board-change event after admin changes.

Event shape:

```text
event: board:update
data: {"version":12}
```

Frontend behavior:

- On SSE update, refetch `/api/board`.
- If SSE disconnects, browser retries automatically.
- A fallback interval refreshes the board periodically, such as every 30 seconds.

### Admin CRUD

MVP can expose straightforward CRUD endpoints for:

- `/api/admin/task-containers`
- `/api/admin/task-items`
- `/api/admin/permit-arrangements`
- `/api/admin/other-arrangements`
- `/api/admin/leave-people`
- `/api/admin/holidays`

After any create, update, or delete, the backend increments a board version and publishes an SSE event.

## Error Handling

Board page:

- If data fetch fails, keep showing the last successful snapshot.
- Show a low-emphasis connection state indicator.
- Retry automatically through fallback polling.

Admin page:

- Show validation errors inline.
- Confirm destructive deletes at the UI level.
- Show save success or failure messages.

Backend:

- Validate required fields.
- Validate time tags against `全天`, `上午`, `下午`.
- Validate time strings.
- Validate child task offset and duration against the parent main task window.
- Validate child task extData as JSON object data.
- Return structured error responses.

## Testing

Backend tests:

- Main task expansion for once, finite, and infinite recurrence.
- Weekend skipping.
- Holiday skipping.
- Cross-day operation child task handling.
- Child task overlap is allowed.
- Child task latest end cannot exceed main task occurrence end.
- Child task extData accepts valid object data at the API boundary and rejects invalid JSON payloads.
- Time-tag sorting order.

Frontend tests:

- Board snapshot rendering.
- Permit list shows six visible rows and supports overflow behavior.
- Patrol list shows two visible rows and supports overflow behavior.
- Other arrangement sorting by time tag.
- SSE update triggers board refetch.

Manual visual verification:

- Large-screen board at 16:9 desktop viewport.
- Dense data cases with more patrol and other arrangement rows than visible area.
- Timeline centered on current time with a visible current-time marker.

## Out of Scope For MVP

- Multi-user login and permissions.
- Cloud deployment.
- Concurrent editing behavior.
- Third-party holiday API.
- Import/export.
- Complex audit history.
