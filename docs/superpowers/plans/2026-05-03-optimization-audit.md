# Optimization Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the `optimize.md` suggestions into a verified, low-risk optimization backlog.

**Architecture:** Keep the existing Fastify, SQLite, Vue, and Vitest structure. Prioritize real correctness and query behavior fixes first, then low-risk deduplication; reject or defer suggestions whose proposed fix would break current date/time semantics or public types.

**Tech Stack:** Fastify, SQLite via `better-sqlite3`, Zod, Vitest, Vue 3 Composition API, Vue Test Utils, TypeScript.

---

## Audit Verdict

| # | Verdict | Reason |
|---|---|---|
| 1 | Adopt with correction | The in-memory filter is real, but direct ISO string comparison is only safe after enforcing canonical `+08:00` storage. Current APIs accept arbitrary parseable datetimes. |
| 2 | Adopt | `mapOperationItemRow` can throw on corrupt JSON; use the safe parser. |
| 3 | Adopt with correction | The double request is real. However `createOperationPlanItem` alone does not refresh parent derived fields, and the inline `item` field cannot append safely without backend changes. |
| 4 | Adopt | Patrol plan list has N+1 item queries through `mapPlanRow -> maxItemCycleDay -> listPlanItems`. |
| 5 | Adopt | `validateAdminPayload` is duplicated in three route files. |
| 6 | Defer until datetime canonicalization | Replacing `julianday()` with string comparison would break currently tested non-`+08:00` datetimes. |
| 7 | Adopt, low priority | extData string/time-tag helpers are duplicated; split server and web utilities. |
| 8 | Adopt, low priority | China-date/time formatting helpers are duplicated; split server and web utilities. |
| 9 | Adopt with correction | `inLieuDays` is ignored, but it should be merged into holidays, not treated as adjusted workdays. `workdays` are adjusted workdays. |
| 10 | Adopt | `task_template_items.template_id` is queried and joined frequently and lacks an index. |
| 11 | Reject as stated | Operation child items define the cycle duration; importing `validateTaskItem(parentDurationMinutes, item)` would conflict with the current operation model. Keep offset/duration validation only, and validate finite window behavior separately if needed. |
| 12 | Adopt | extData shape validation should stay at API/client boundaries; the frontend should not expose raw JSON editing. |
| 13 | Adopt partially | Share the generic safe extData parser. Preserve board snapshot warning behavior through an optional warning wrapper if still desired. |
| 14 | Adopt only if still useful after #1/#6 | The overlap helpers duplicate logic, but SQL filtering may make one or both unnecessary. |
| 15 | Defer | extData shape validation is valuable but broad and should be a separate schema-design task. |
| 16 | Adopt partially | `dateQuerySchema` is unused. Form interfaces in `types.ts` are duplicate/unreferenced. `BoardUpdateConnectionHandlers` is used by `subscribeBoardUpdates`, so do not remove blindly. |
| 17 | Reject | `PermitArrangementRecord` and `OtherArrangementRecord` are not identical; permit has `target` plus `task`, other does not. |
| 18 | Defer | Removing the `FileReader` fallback is tiny cleanup with negligible value. |
| 19 | Adopt | `importChineseDaysHolidays` can use `postAdminFor`. |

## File Structure

- Modify `server/src/domain/taskInstances.ts`: shared safe extData parser, optional warning wrapper if needed.
- Modify `server/src/domain/boardSnapshot.ts`: SQL window filtering only after canonical datetime support, or leave exact `Date` overlap behavior intact.
- Modify `server/src/routes/admin.ts`: safe operation item parsing, shared payload validation, holiday `inLieuDays` import fix, item endpoint parent-derived field updates if chosen, low-risk cleanup.
- Modify `server/src/routes/taskInstances.ts`: shared payload validation; keep `julianday()` until datetime canonicalization exists.
- Modify `server/src/routes/patrolPlans.ts`: shared payload validation and eager cycle-length calculation for list route.
- Modify `server/src/db/schema.ts`: add `task_template_items(template_id)` index.
- Modify `web/src/api/client.ts`: use `postAdminFor` for holiday import; keep `BoardUpdateConnectionHandlers`.
- Modify `web/src/composables/admin/useOperationAdmin.ts`: remove double request by using transactional item endpoint behavior; preserve extData without exposing a raw JSON editor.
- Modify `web/src/composables/admin/useHolidayAdmin.ts`: keep normalized `inLieuDays` payload.
- Add `server/src/routes/validation.ts`: shared `validateAdminPayload`.
- Add `server/src/domain/dateTime.ts` and `web/src/composables/admin/dateTime.ts` only when doing the date helper cleanup batch.
- Add or modify focused tests in `server/tests/adminRoutes.test.ts`, `server/tests/boardSnapshot.test.ts`, `server/tests/schema.test.ts`, and `web/tests/AdminView.test.ts`.

## Execution Spec

1. Preserve current datetime correctness. Any SQL string comparison over `start_at` / `end_at` must either prove stored values are canonical `+08:00` or be deferred.
2. Do not change board snapshot, task instance, or admin API response shapes.
3. Keep operation item create/edit/delete behavior transactional from the user's perspective: one save action must not leave parent recurrence/count fields stale.
4. Treat `chinese-days.inLieuDays` as holiday dates. Treat `chinese-days.workdays` as adjusted workdays.
5. Keep public client types unless a test proves the export is truly dead.
6. Each adopted backend behavior must have a focused route/domain/schema test before implementation.
7. Each adopted frontend behavior must have a focused composable/component/API test before implementation.

## Task 1: Safe Backend Fixes

**Files:**
- Modify: `server/src/domain/taskInstances.ts`
- Modify: `server/src/routes/admin.ts`
- Modify: `server/src/db/schema.ts`
- Test: `server/tests/adminRoutes.test.ts`
- Test: `server/tests/schema.test.ts`

- [ ] Add a test that inserts an operation plan item with invalid `ext_data_json`, calls `GET /api/admin/operation-plans/:id`, and expects `200` with `extData: {}`.
- [ ] Replace `JSON.parse(row.ext_data_json)` in `mapOperationItemRow` with `parseExtDataJson(row.ext_data_json)`.
- [ ] Add a schema test asserting `pragma index_list('task_template_items')` contains `task_template_items_template_id_idx`.
- [ ] Add `create index if not exists task_template_items_template_id_idx on task_template_items (template_id);` to `schemaSql`.
- [ ] Run `npm --prefix server test -- adminRoutes.test.ts schema.test.ts`.

## Task 2: Holiday Import Semantics

**Files:**
- Modify: `server/src/routes/admin.ts`
- Test: `server/tests/adminRoutes.test.ts`

- [ ] Add a route test where `inLieuDays` contains a date not present in `holidays`; expect it to be returned as `{ type: "holiday" }`.
- [ ] Update import logic to merge sorted `holidays` and `inLieuDays` into holiday rows, de-duplicating by date before inserting.
- [ ] Keep `workdays` as `adjusted_workday` rows.
- [ ] Run `npm --prefix server test -- adminRoutes.test.ts`.

## Task 3: Route Validation Deduplication

**Files:**
- Add: `server/src/routes/validation.ts`
- Modify: `server/src/routes/admin.ts`
- Modify: `server/src/routes/taskInstances.ts`
- Modify: `server/src/routes/patrolPlans.ts`
- Test: existing route tests

- [ ] Create `validation.ts` exporting the existing `validateAdminPayload` return shape and `"Invalid admin payload"` message.
- [ ] Replace the three local copies with imports.
- [ ] Run `npm --prefix server test -- adminRoutes.test.ts`.

## Task 4: Patrol Plan List N+1 Query

**Files:**
- Modify: `server/src/routes/patrolPlans.ts`
- Test: `server/tests/adminRoutes.test.ts`

- [ ] Add a patrol plan list test with multiple plans and multiple items, asserting each returned `cycleLength` is correct.
- [ ] Load all list-route patrol items in one query for the returned plan IDs.
- [ ] Pass a `Map<planId, cycleLength>` into list-row mapping instead of calling `maxItemCycleDay` per row.
- [ ] Keep `GET /api/admin/patrol-plans/:id` using `listPlanItems` for detail.
- [ ] Run `npm --prefix server test -- adminRoutes.test.ts`.

## Task 5: Operation Item Save Contract

**Files:**
- Modify: `server/src/routes/admin.ts`
- Modify: `web/src/composables/admin/useOperationAdmin.ts`
- Test: `server/tests/adminRoutes.test.ts`
- Test: `web/tests/AdminView.test.ts`

- [ ] Add backend tests proving POST, PUT, and DELETE item endpoints update or preserve parent recurrence extData consistently.
- [ ] Make item endpoints update parent derived fields in the same request, or add a dedicated transactional endpoint that saves parent fields and item mutation together.
- [ ] Change `saveOperationItem` to use the chosen single-request contract for create/edit/delete.
- [ ] Run `npm --prefix server test -- adminRoutes.test.ts` and `npm --prefix web test -- AdminView.test.ts`.

## Task 6: Frontend extData Preservation UX

**Files:**
- Modify: `web/src/composables/admin/useOperationAdmin.ts`
- Modify if needed: `web/src/components/admin/OperationItemModal.vue`
- Test: `web/tests/AdminView.test.ts` or `web/tests/AdminModals.test.ts`

- [ ] Preserve existing item extData while saving without exposing a raw JSON editor.
- [ ] Keep extData parse fallback behavior in the API/client boundary tests.
- [ ] Assert the operation item modal does not render a raw extData editor or error state.
- [ ] Run `npm --prefix web test -- AdminView.test.ts AdminModals.test.ts`.

## Task 7: Deferred Datetime Performance Batch

**Files:**
- Modify later: `server/src/routes/taskInstances.ts`
- Modify later: `server/src/domain/boardSnapshot.ts`
- Test later: `server/tests/adminRoutes.test.ts`, `server/tests/boardSnapshot.test.ts`

- [ ] First decide whether all write paths must canonicalize datetimes to `+08:00`.
- [ ] Add tests covering UTC/Z input and canonical `+08:00` input.
- [ ] Only after canonicalization, replace `julianday()` and in-memory overlap filters with indexed string comparisons.
- [ ] Run full server tests and inspect `EXPLAIN QUERY PLAN` for `task_instances_time_idx`.

## Task 8: Low-Risk Cleanup Batch

**Files:**
- Modify: `web/src/api/client.ts`
- Modify: `server/src/routes/admin.ts`
- Modify: `web/src/composables/admin/types.ts`
- Optional add: server/web date and extData helper modules

- [ ] Replace raw holiday import `fetch` with `postAdminFor<ChineseDaysPayload, HolidayImportResult>("holidays/import", input)`.
- [ ] Remove `dateQuerySchema`.
- [ ] Remove unused duplicate form interfaces from `web/src/composables/admin/types.ts` only after confirming imports still compile.
- [ ] Extract date/extData helpers in small server-only and web-only modules.
- [ ] Run `npm run build` and `npm test`.

## Verification

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] For datetime performance changes only, run `EXPLAIN QUERY PLAN` before and after to confirm index usage.
- [ ] Manually smoke test admin operation item create/edit/delete and holiday import.
