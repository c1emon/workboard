# Operation Cycle Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make operation plan generation use child-task-derived cycle duration and treat `endAt` as a finite-plan window end instead of a single-cycle duration source.

**Architecture:** Keep the current `task_templates`, `task_template_items`, and `task_instances` tables. Update backend validation and template expansion so operation cycles are derived from child items, then update the operation admin form/payload logic to send `endAt` only for finite plans. Frontend visual changes must be limited to the existing operation modal's end-time field behavior.

**Tech Stack:** Fastify, SQLite via `better-sqlite3`, Zod, Vitest, Vue 3 Composition API, Vue Test Utils, TypeScript.

---

## File Structure

- Modify `server/src/domain/templateExpansion.ts`: derive cycle duration from child task ends and apply finite plan-window filtering.
- Modify `server/src/routes/admin.ts`: allow `endAt: null` for once/infinite operation inputs and keep finite validation strict.
- Modify `server/src/domain/taskInstanceGeneration.ts`: pass item context into expansion as needed and keep generated snapshot shape unchanged.
- Modify `server/tests/taskInstanceGeneration.test.ts`: cover once, finite, infinite, and max offset-plus-duration semantics.
- Modify `server/tests/adminRoutes.test.ts`: cover operation API validation for null/finite `endAt`.
- Modify `web/src/api/client.ts`: make `OperationPlanInput.endAt` nullable.
- Modify `web/src/composables/admin/useOperationAdmin.ts`: keep finite `endAt`, send null for once/infinite, and derive cycle interval from child tasks.
- Modify `web/src/components/admin/OperationPlanModal.vue`: show the end-time field only for finite plans; do not change unrelated operation UI layout.
- Modify `web/tests/AdminView.test.ts` and focused operation tests as needed: assert payload shape and field visibility.

Do not modify `web/src/components/admin/PatrolPlanManager.vue` or other patrol UI files for this task.

---

## Task 1: Backend Tests For Operation Cycle Semantics

**Files:**
- Modify: `server/tests/taskInstanceGeneration.test.ts`
- Modify: `server/tests/adminRoutes.test.ts`

- [ ] **Step 1: Add a task generation test for derived cycle duration**

Add a test that creates one operation template with two children:

```ts
insertTemplate(db, {
  id: "operation-derived-cycle",
  type: "operation",
  startAt: "2026-05-01T08:00:00+08:00",
  endAt: "2026-05-01T08:01:00+08:00",
  recurrenceType: "infinite",
  recurrenceIntervalMinutes: 170
});
insertItem(db, { id: "late-offset", templateId: "operation-derived-cycle", offsetMinutes: 120, durationMinutes: 10, content: "偏移最大" });
insertItem(db, { id: "late-end", templateId: "operation-derived-cycle", offsetMinutes: 90, durationMinutes: 80, content: "结束最晚" });
```

Run generation for `2026-05-01` and assert the second cycle starts 170 minutes after `08:00`, proving the generator uses `max(offset + duration)` rather than `endAt - startAt` or max offset.

- [ ] **Step 2: Add a finite-window generation test**

Add a test where an operation plan starts at `08:00`, has cycle duration 120 minutes, and has finite `endAt = 11:00`.

Children:

```ts
insertItem(db, { id: "first", templateId: "operation-finite", offsetMinutes: 0, durationMinutes: 60, content: "完整第一项" });
insertItem(db, { id: "second", templateId: "operation-finite", offsetMinutes: 90, durationMinutes: 60, content: "越过窗口项" });
```

Expected generated contents:

```ts
["完整第一项"]
```

The child from `09:30` to `10:30` is valid in the first cycle, but the second cycle child from `10:00` to `11:00` is the last valid one depending on the exact chosen fixture. The test should explicitly assert no generated item has `end_at` after the finite plan `endAt`.

- [ ] **Step 3: Add operation route validation tests**

In `server/tests/adminRoutes.test.ts`, add assertions that:

- `POST /api/admin/operation-plans` accepts `endAt: null` with `recurrenceType: "once"` when an item is present.
- `POST /api/admin/operation-plans` accepts `endAt: null` with `recurrenceType: "infinite"` and positive `recurrenceIntervalMinutes`.
- `POST /api/admin/operation-plans` rejects `recurrenceType: "finite"` with `endAt: null`.
- `POST /api/admin/operation-plans` rejects finite `endAt` before or equal to `startAt`.

- [ ] **Step 4: Run backend tests and record failures**

Run:

```bash
npm --prefix server test -- taskInstanceGeneration.test.ts adminRoutes.test.ts
```

Expected before implementation: validation failures for nullable `endAt`, and generation assertions showing the old duration behavior.

---

## Task 2: Backend Operation Cycle Implementation

**Files:**
- Modify: `server/src/domain/templateExpansion.ts`
- Modify: `server/src/routes/admin.ts`
- Modify if needed: `server/src/domain/taskInstanceGeneration.ts`
- Test: `server/tests/taskInstanceGeneration.test.ts`
- Test: `server/tests/adminRoutes.test.ts`

- [ ] **Step 1: Make operation route input accept nullable `endAt`**

Change operation plan validation so `endAt` is `dateTimeSchema.nullable().optional()`.

Validation rules:

```ts
if (input.recurrenceType === "finite" && !input.endAt) {
  issue path ["endAt"], message "endAt is required for finite recurrence"
}
if (input.endAt && new Date(input.endAt).getTime() <= new Date(input.startAt).getTime()) {
  issue path ["endAt"], message "endAt must be after startAt"
}
```

Keep positive interval validation for finite and infinite. Keep positive count validation for finite if the API still accepts count.

- [ ] **Step 2: Store a compatibility `end_at` without using it as cycle duration**

Because the current schema has `task_templates.end_at text not null`, insert/update operation plans with:

```ts
const storedEndAt = input.endAt ?? input.startAt;
```

This value is only a persistence compatibility value for once/infinite plans. Generation must not treat it as cycle duration.

- [ ] **Step 3: Derive cycle duration inside template expansion**

In `server/src/domain/templateExpansion.ts`, compute:

```ts
function cycleDurationMinutes(items: TaskTemplateItemInput[]): number {
  const latestItemEnd = items.reduce((latest, item) => Math.max(latest, item.offsetMinutes + item.durationMinutes), 0);
  if (latestItemEnd > 0) return latestItemEnd;
  return 0;
}
```

Use this derived duration in occurrence stepping instead of `end - start`. If the derived duration is `0`, return no generated records because the operation plan has no child-defined cycle yet.

- [ ] **Step 4: Apply finite operation window filtering**

For finite templates, treat `template.endAt` as the plan window end. When expanding child items, discard generated child instances where:

```ts
childStart < templateStart || childEnd > finitePlanEnd
```

For once, only expand the first cycle. For infinite, expand until the refresh window end.

- [ ] **Step 5: Keep route list date filtering compatible**

Update operation plan list date-scope SQL so infinite operation plans are not hidden after the compatibility `end_at` date, and once plans whose derived child cycle crosses midnight are visible on the covered date. The date-scope predicate should include:

```sql
and (
  c.recurrence_type = 'infinite'
  or (
    c.recurrence_type = 'once'
    and julianday(c.start_at) + coalesce((
      select max(child.offset_minutes + child.duration_minutes)
      from task_template_items child
      where child.template_id = c.id
    ), 0) / 1440.0 >= julianday(?)
  )
  or (
    c.recurrence_type = 'finite'
    and julianday(c.end_at) >= julianday(?)
  )
)
```

Keep `julianday(c.start_at) <= julianday(?)`.

- [ ] **Step 6: Run backend verification**

Run:

```bash
npm --prefix server test -- taskInstanceGeneration.test.ts adminRoutes.test.ts templateExpansion.test.ts
npm run build --workspace server
```

Expected: all pass.

---

## Task 3: Frontend Operation Payload And Modal Behavior

**Files:**
- Modify: `web/src/api/client.ts`
- Modify: `web/src/composables/admin/useOperationAdmin.ts`
- Modify: `web/src/components/admin/OperationPlanModal.vue`
- Modify tests as needed: `web/tests/AdminView.test.ts`, `web/tests/AdminModals.test.ts`

- [ ] **Step 1: Make operation input nullable**

Change:

```ts
export interface OperationPlanInput {
  endAt: string;
}
```

to:

```ts
export interface OperationPlanInput {
  endAt: string | null;
}
```

- [ ] **Step 2: Track finite end time separately from derived cycle end**

In `useOperationAdmin.ts`, keep `operationForm.endAt` as the finite plan window field. Do not use computed child-cycle end as payload `endAt` for once/infinite.

Payload rules:

```ts
endAt: operationForm.recurrenceType === "finite" ? normalizeDateTime(operationForm.endAt) : null
recurrenceIntervalMinutes: operationForm.recurrenceType === "once" ? null : cycleDurationForItems(items)
recurrenceCount: operationForm.recurrenceType === "finite" ? recurrenceCountForFiniteWindow(items) : null
```

The recurrence count for finite plans should be derived from the finite window length divided by cycle duration.

- [ ] **Step 3: Adjust modal end-time visibility**

In `OperationPlanModal.vue`, show the editable end-time input only when:

```ts
form.recurrenceType === "finite"
```

Do not alter the modal's surrounding layout, timeline placement, or unrelated labels.

- [ ] **Step 4: Preserve existing detail loading behavior**

When opening an existing operation plan:

- If detail `recurrenceType` is finite, populate `operationForm.endAt` from `detail.endAt`.
- If detail is once or infinite, keep a safe local fallback for the hidden field but do not expose it or send it as the payload.

- [ ] **Step 5: Run frontend verification**

Run:

```bash
npm --prefix web test -- AdminView.test.ts AdminModals.test.ts
npm run build --workspace web
```

Expected: all pass.

---

## Task 4: Full Verification

**Files:**
- No new implementation files.

- [ ] **Step 1: Run focused test suites**

Run:

```bash
npm --prefix server test -- taskInstanceGeneration.test.ts adminRoutes.test.ts templateExpansion.test.ts
npm --prefix web test -- AdminView.test.ts AdminModals.test.ts
```

- [ ] **Step 2: Run full build**

Run:

```bash
npm run build
```

- [ ] **Step 3: Manual browser check**

Open `http://127.0.0.1:5173/admin`, go to 操作, and verify:

- Once hides operation end time.
- Finite shows operation end time.
- Infinite hides operation end time.
- No patrol template UI changed as part of this task.

---

## Self-Review

Spec coverage:

- Child-derived cycle duration: Tasks 1 and 2.
- Once/finite/infinite semantics: Tasks 1, 2, and 3.
- Frontend payload behavior: Task 3.
- Avoid unrelated patrol UI changes: File structure and Task 4.

Placeholder scan: no TODO/TBD placeholders remain.

Type consistency: `endAt: string | null` is used consistently for operation API payloads while existing records can keep `endAt: string` for persisted compatibility values.
