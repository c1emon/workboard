# Patrol Instance Generation Redesign

## Goal

Redesign patrol administration around generated task instances.

Patrol plans should be template records. The board should display concrete generated instances instead of expanding patrol templates directly at read time. This supports roughly 90-day patrol content cycles, holiday skipping, manual one-off inserts, stable history, and future regeneration without changing board styling.

## Non-Goals

- Do not change the visual style, layout rhythm, colors, typography, or spacing of the board page.
- Do not redesign board modules beyond changing their data source to instances.
- Do not implement completion workflow, approval workflow, or mobile-specific UI in this change.
- Do not automatically split or truncate cross-day task instances at holiday boundaries.
- Do not preserve legacy patrol arrangement behavior for compatibility.
- Do not design production data migration or backfill flows. This is a non-production environment, so local data may be recreated.

## Current Context

The project currently stores planned work in:

- `task_containers`: main task records with type, recurrence, skip rules, and enabled state.
- `task_items`: child task records under a container.
- `holidays`: holiday and adjusted workday records.

The current board snapshot expands `operation`, `patrol`, `permit`, and `other` records from templates at query time. This is workable for simple recurrence, but patrol has a stronger operational-history requirement:

- Daily patrol content may differ.
- The content roughly repeats in a 90-day cycle.
- Holidays should skip generation.
- Template changes should not rewrite past displayed history.
- Managers need to add extra one-off patrol instances.

## Naming Decision

`task_containers` and `task_items` no longer fit the post-refactor semantics. Those records are not board-displayed tasks; they are generation definitions. The refactor should rename the storage and domain language instead of carrying the old names forward.

Use:

- `task_templates` instead of `task_containers`
- `task_template_items` instead of `task_items`
- `template_id` instead of `container_id`
- `source_template_item_id` instead of `source_item_id`
- `templateExpansion` instead of `taskExpansion` for recurrence/template expansion helpers

## Core Model

Replace `task_containers` and `task_items` with clearer template names:

- `task_templates`: plan/template records.
- `task_template_items`: template child records, including patrol cycle-day items.

Because this is not a production migration, create the semantic replacement tables directly:

```sql
task_templates (
  id text primary key,
  type text not null check (type in ('operation', 'permit', 'patrol', 'other')),
  name text not null,
  description text not null default '',
  start_at text not null,
  end_at text not null,
  recurrence_type text not null check (recurrence_type in ('once', 'finite', 'infinite')),
  recurrence_interval_minutes integer,
  recurrence_count integer,
  skip_weekends integer not null default 0,
  skip_holidays integer not null default 0,
  enabled integer not null default 1,
  ext_data_json text not null default '{}',
  created_at text not null,
  updated_at text not null
);

task_template_items (
  id text primary key,
  template_id text not null references task_templates(id) on delete cascade,
  offset_minutes integer not null,
  duration_minutes integer not null,
  content text not null default '',
  ext_data_json text not null default '{}',
  sort_order integer not null default 0
);
```

For a clean non-production reset, schema initialization may explicitly remove old template tables before creating the new names:

```sql
drop table if exists task_items;
drop table if exists task_containers;
```

Patrol plan-level settings live in `task_templates.ext_data_json`:

```json
{
  "cycleLength": 90
}
```

Add generated instance storage:

```sql
task_instances (
  id text primary key,
  type text not null check (type in ('operation', 'permit', 'patrol', 'other')),
  template_id text null references task_templates(id) on delete set null,
  source_template_item_id text null references task_template_items(id) on delete set null,
  source_type text not null check (source_type in ('generated', 'manual', 'override')),
  generation_key text null unique,
  occurrence_date text not null,
  start_at text not null,
  end_at text not null,
  content text not null default '',
  ext_data_json text not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'done', 'cancelled')),
  generated_at text not null,
  updated_at text not null
);
```

Boolean template flags remain stored as SQLite integers:

- `skip_weekends`: `0` or `1`
- `skip_holidays`: `0` or `1`
- `enabled`: `0` or `1`

Backend route and domain types should map these integer fields to booleans at the API boundary.

`template_id` identifies the source template. `source_template_item_id` identifies the specific template item. Display must use instance snapshot fields, not live template joins.

Generated instances intentionally survive template deletion through `on delete set null`. Deleting a template removes future generation rules, but previously generated instances remain as historical display snapshots unless a user explicitly deletes or cancels them from instance management.

Manual instances are supported by setting:

```text
template_id = null
source_template_item_id = null
source_type = manual
generation_key = null
```

## Patrol Template Semantics

For patrol, `task_templates` represents the patrol plan:

- `type = patrol`
- `recurrence_type = infinite`
- `recurrence_interval_minutes = 1440`
- `skip_holidays = true` by default
- `skip_weekends = false` by default
- `enabled = true`
- `ext_data_json.cycleLength = 90` by default

`task_template_items` represents the 90-day cycle content. `ext_data_json` stores patrol-specific template metadata:

```json
{
  "cycleDay": 1,
  "timeTag": "上午",
  "target": "罐区",
  "personnel": "张三",
  "vehicle": "1号车",
  "other": "携带测温仪"
}
```

`cycleDay` is required for patrol cycle templates. The valid range is `1..cycleLength`. The default cycle length is `90`.

A cycle day may contain one or more patrol items. Within one patrol plan, the API should reject duplicate `sort_order` values for the same `cycleDay` so generated display order is deterministic.

Patrol cycle item time ranges are resolved from `timeTag`, not from `offset_minutes` and `duration_minutes`. Use `timeRangeForDateTag(date, timeTag)` from `server/src/domain/timeTags.ts`:

- `全天`: `00:00:00+08:00` to `23:59:59+08:00`
- `上午`: `08:00:00+08:00` to `12:00:00+08:00`
- `下午`: `12:00:00+08:00` to `17:00:00+08:00`

The patrol plan API may still write derived `offset_minutes` and `duration_minutes` for storage consistency, but patrol cycle generation must treat `timeTag` as the source of truth for `start_at` and `end_at`.

## Generation Rules

The generator creates instances for a target date range, typically today through the next 30 days.

For each enabled template:

1. Determine candidate occurrence dates.
2. If `skip_holidays = true` and the occurrence start date exists in `holidays` with `type = holiday`, skip it.
3. Adjusted workdays do not count as holidays.
4. If `skip_weekends = true`, skip Saturday and Sunday unless that date exists in `holidays` with `type = adjusted_workday`.
5. For normal simple recurrence, expand `task_template_items` using the existing offset and duration semantics.
6. For patrol cycle templates, calculate the effective patrol day index by counting eligible generated patrol dates from the template start date, excluding skipped holidays and skipped weekends.
7. Resolve `cycleDay = ((effectiveDayIndex - 1) % cycleLength) + 1`.
8. Generate instances only from patrol `task_template_items` whose metadata `cycleDay` matches the resolved cycle day.
9. For matched patrol items, resolve `start_at` and `end_at` from `timeTag` and the occurrence date using `timeRangeForDateTag`.
10. Copy template content and metadata into `task_instances`.

Holiday skipping happens during generation. The board does not apply holiday skipping itself.

The generator loads holiday data internally from `holidays`. It should treat `type = holiday` and `type = adjusted_workday` differently as described above.

## Instance Metadata Contract

`task_instances.ext_data_json` is the board-facing metadata snapshot.

Patrol instances must include:

```json
{
  "timeTag": "上午",
  "target": "罐区",
  "personnel": "张三",
  "vehicle": "1号车",
  "other": "携带测温仪",
  "cycleDay": 17
}
```

Permit instances must include:

```json
{
  "timeTag": "上午",
  "target": "A区",
  "personnel": "张三",
  "vehicle": "1号车",
  "other": "监护"
}
```

Other instances must include:

```json
{
  "timeTag": "全天",
  "target": "清点物资",
  "personnel": "李四",
  "vehicle": "",
  "other": ""
}
```

Operation instances keep their operation child metadata as an object and use `content`, `start_at`, and `end_at` for timeline display.

## Cross-Day And Multi-Day Items

Holiday skip policy applies to the occurrence start date.

If the occurrence start date is a holiday and `skip_holidays = true`, the whole occurrence is skipped.

If the occurrence start date is not a holiday, generated instances may cross midnight or overlap a later holiday. They remain intact. The system does not split, truncate, or cancel them automatically.

This keeps generation deterministic and matches the current expansion behavior.

## One-Time Tasks

One-time tasks use the same generated instance model:

- `recurrence_type = once`
- Generate at most once.
- If `skip_holidays = true`, apply the same occurrence-start-date holiday check.
- Prefer representing display content through a default `task_item` that spans the full container duration.

Updating generated pending instances after a one-time template edit is deferred. In this redesign, managers should either regenerate the future range explicitly or edit the generated instance directly.

## Manual Instances

Managers can insert extra instances directly from instance management.

Manual instances:

- Are not linked to a template.
- Are not deleted by regeneration.
- Are shown by the board the same way as generated instances.
- Can be edited or cancelled independently.

Regeneration must only replace generated instances in the selected future range unless the user explicitly chooses to include overrides.

## Admin Product Design

The admin page should separate template management from instance management.

Recommended navigation inside existing modules:

```text
巡视
  今日实例
  巡视模板

操作
  今日实例
  操作模板
```

This keeps module names familiar while making the distinction clear:

- Template management changes future generation rules.
- Instance management changes actual displayed work.

### Patrol Template Management

Patrol template management should show:

- Plan name
- Start date
- Cycle length, default 90
- Holiday skip toggle
- Enabled toggle
- 90-day cycle item table

Each cycle row should manage:

- Cycle day
- Time tag
- Target
- Personnel
- Vehicle
- Other
- Sort order

Saving a template does not rewrite existing instances. After saving, show an action to regenerate future instances from a selected date.

### Instance Management

Instance management should show records by selected date and type:

- Time tag or time range
- Content or target
- Personnel
- Vehicle
- Other
- Source type
- Status

Supported actions:

- Add manual instance.
- Edit pending generated instance as an override.
- Cancel an instance.
- Regenerate generated future instances for a selected date range.

## Board Behavior

The board snapshot should read from `task_instances` for display.

The board response contract should preserve the current frontend data shapes:

- `operation.items`
- `permits`
- `patrols`
- `others`
- `leavePeople`

The board UI style must not change in this refactor. Any changes to `BoardView.vue`, board components, or shared board CSS must be limited to data mapping required by the new source.

Board query windows remain type-specific:

- Operation instances use the current operation context window: `now - 24h` through `now + 24h`.
- Permit, patrol, and other instances use the selected China date window: `00:00:00+08:00` through `23:59:59.999+08:00`.

The generator must create enough future operation instances for the board's operation window, not just the calendar date being displayed.

## API Design

Add instance-oriented admin APIs:

```http
GET /api/admin/task-instances?date=YYYY-MM-DD&type=patrol
POST /api/admin/task-instances
PUT /api/admin/task-instances/:id
PATCH /api/admin/task-instances/:id/status
DELETE /api/admin/task-instances/:id
POST /api/admin/task-instances/generate
```

Add patrol template APIs:

```http
GET /api/admin/patrol-plans
GET /api/admin/patrol-plans/:id
POST /api/admin/patrol-plans
PUT /api/admin/patrol-plans/:id
PATCH /api/admin/patrol-plans/:id/enabled
DELETE /api/admin/patrol-plans/:id

POST /api/admin/patrol-plans/:id/items
PUT /api/admin/patrol-plans/:id/items/:itemId
DELETE /api/admin/patrol-plans/:id/items/:itemId
```

Operation plan APIs should keep their plan-oriented surface but use template storage internally:

```http
GET /api/admin/operation-plans
GET /api/admin/operation-plans/:id
POST /api/admin/operation-plans
PUT /api/admin/operation-plans/:id
PATCH /api/admin/operation-plans/:id/enabled
DELETE /api/admin/operation-plans/:id

POST /api/admin/operation-plans/:id/items
PUT /api/admin/operation-plans/:id/items/:itemId
DELETE /api/admin/operation-plans/:id/items/:itemId
```

Operation child item endpoints replace the old generic `POST /api/admin/task-items` and `DELETE /api/admin/task-items/:id` APIs. `PUT /api/admin/operation-plans/:id/items/:itemId` is a new explicit operation-item editing capability and should verify that the item belongs to the operation plan in the URL.

Replace the old patrol arrangement admin path with `patrol-plans` and `task-instances`. Do not add compatibility wrappers for `patrol-arrangements`.

Remove old generic task template mutation APIs from the admin surface:

```http
POST /api/admin/task-containers
POST /api/admin/task-items
DELETE /api/admin/task-items/:id
```

Template mutations should go through domain-specific plan APIs such as `operation-plans` and `patrol-plans`.

## Idempotency

Generated instances need stable generation keys:

```text
generation_key = templateId + ":" + templateItemId + ":" + occurrenceStartAt
```

The key is opaque and must not be parsed. ISO timestamps contain `:`, so future code should compare the complete string only.

The generator must use upsert-like behavior:

- If no matching generated instance exists, insert one.
- If a matching generated instance is pending and still generated, refresh its snapshot when regeneration is requested.
- If a matching instance is manual, override, done, in_progress, or cancelled, do not overwrite it unless explicitly requested.

## Data Reset

This project is not in production. The implementation does not need to migrate or preserve existing local task data.

The implementation may:

1. Add or reshape tables directly in `schemaSql`.
2. Replace old patrol arrangement semantics with patrol templates and instances.
3. Seed or manually recreate development data after the schema change.
4. Remove compatibility paths when the new admin flow is in place.

The only preservation requirement is source-code safety: do not remove unrelated modules or board styling while making the data-model change.

## Testing

Backend tests should cover:

- Schema creation for `task_templates`, `task_template_items`, and `task_instances`.
- One-time task generation.
- Simple infinite recurrence generation.
- 90-day patrol cycle generation.
- Patrol `timeTag` to instance time range mapping.
- Holiday skip without consuming patrol cycle day.
- Weekend skip behavior, including adjusted workday override.
- Adjusted workday not skipped.
- Cross-day item generated intact when occurrence start is not holiday.
- Idempotent generation.
- Manual instances not overwritten by regeneration.
- Disabled templates generate nothing.
- Templates with no matching patrol `cycleDay` item generate nothing for that date.
- Templates starting after the requested generation window generate nothing.
- Generation works across month and year boundaries.
- Board snapshot reads instances.

Frontend tests should cover:

- Patrol template list and 90-day item editing.
- Instance list by selected date.
- Manual instance creation.
- Regeneration action confirmation.
- Board view output preserves existing display expectations.
