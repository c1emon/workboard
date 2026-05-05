# Operation Cycle Model Redesign

## Goal

Align operation plan generation with the same cycle-based mental model used by patrol templates: a template has a start point, a set of relative child items, and a recurrence mode that rolls the complete item set into actual `task_instances`.

## Scope

This change is limited to operation plans and the shared template expansion logic needed by operation generation. It must not redesign unrelated admin modules or change the patrol template interface while this work is in progress.

## Product Model

An operation plan contains a group of child tasks. The plan `startAt` is the zero point for one complete operation cycle.

Each child task is defined by:

- `offsetMinutes`: when the child starts relative to the cycle start.
- `durationMinutes`: how long the child lasts.
- `content`, `extData`, and `sortOrder`: existing child-task display and ordering fields.

The complete cycle duration is derived from the child task that ends latest:

```text
cycleDurationMinutes = max(child.offsetMinutes + child.durationMinutes)
```

This explicitly handles the case where the child with the largest offset is not the child with the latest end time.

## Recurrence Semantics

### Once

`recurrenceType = "once"` expands exactly one complete cycle.

The user does not need to maintain a plan end time for once plans. The effective operation window is:

```text
startAt <= child instance time <= startAt + cycleDurationMinutes
```

### Finite

`recurrenceType = "finite"` expands complete cycles starting at `startAt` until the plan's actual end window is reached.

For finite plans, `endAt` means the plan's actual window end. It is not the end of one cycle.

Only child task instances fully contained in the plan window should be produced:

```text
childStart >= planStart
childEnd <= planEnd
```

The generated cycles are still filtered by the requested refresh window before insertion.

### Infinite

`recurrenceType = "infinite"` rolls the complete child-task cycle forward indefinitely from `startAt`.

There is no product-level plan end time. The generator only creates instances that overlap the current refresh window, so infinite plans do not generate unbounded rows in one run.

## Data Model

The existing tables remain in place:

- `task_templates`
- `task_template_items`
- `task_instances`

Operation plans continue to use `task_templates.type = 'operation'`.

The API should treat `endAt` as required only for finite operation plans. For once and infinite operation plans, the frontend should send `endAt: null`, and the backend may store a compatibility value if needed by the current schema. That stored value must not be used as the operation cycle duration.

The authoritative operation cycle duration is always derived from operation child items.

## Backend Behavior

The shared template expansion logic must stop treating `template.endAt - template.startAt` as the cycle duration for operation plans.

Instead it should:

1. Compute cycle duration from the latest child task end.
2. For `once`, expand one cycle.
3. For `finite`, expand repeated cycles but discard child tasks outside the plan's `startAt` / `endAt` window.
4. For `infinite`, expand repeated cycles only as far as the requested refresh window requires.
5. Preserve holiday/weekend skipping behavior.

Validation and generation should enforce:

- Empty operation plans may exist as admin drafts, but they must not generate actual records because no child task defines a cycle.
- Every child task has `offsetMinutes >= 0`.
- Every child task has `durationMinutes > 0`.
- Finite operation plans require `endAt > startAt`.
- Once and infinite operation plans do not require a user-provided `endAt`.

## Frontend Behavior

Keep the operation plan UI structure stable. Only adjust fields necessary to reflect the corrected model.

The operation plan modal should show:

- Recurrence type.
- Start time.
- End time only when recurrence type is finite.
- Existing child-task timeline and child-task modal.

Once and infinite operation plans should not expose an editable operation end time. Any displayed derived timing should be read-only and clearly tied to child tasks.

The frontend must continue deriving:

```text
cycleDurationMinutes = max(offsetMinutes + durationMinutes)
```

When saving:

- `once`: send `endAt: null`, `recurrenceIntervalMinutes: null`, `recurrenceCount: null`.
- `finite`: send the finite window `endAt`, `recurrenceIntervalMinutes` as the derived cycle duration, and `recurrenceCount` as the number of complete cycles implied by the finite window.
- `infinite`: send `endAt: null`, `recurrenceIntervalMinutes` as the derived cycle duration, and `recurrenceCount: null`.

## Testing

Backend tests should cover:

- Once operation plans generate a single derived cycle.
- Finite operation plans use `endAt` as the plan window and do not generate child tasks outside that window.
- Infinite operation plans roll cycles through the requested refresh window.
- Cycle duration is based on `max(offset + duration)`, not max offset.
- API validation allows null `endAt` for once and infinite but requires it for finite.

Frontend tests should cover:

- Operation plan payloads send `endAt: null` for once and infinite.
- Finite operation plan payloads keep an explicit end time.
- The operation modal hides the end time for once and infinite and shows it for finite.

## Non-Goals

- Do not redesign the operation admin visual layout beyond the required end-time field behavior.
- Do not modify patrol template UI in this change.
- Do not change board snapshot response contracts.
- Do not rewrite storage around new tables.

## TODO

- Consider scheduled instance refresh for infinite operation plans. Current generation is manual and bounded by the selected refresh window; a future background job could periodically generate upcoming instances, for example refreshing the next N days every night.
