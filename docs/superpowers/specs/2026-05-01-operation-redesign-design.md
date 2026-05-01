# Operation Plan Redesign

## Goal

Redesign operation-related admin management while keeping the existing `task_containers` and `task_items` storage model unchanged.

The redesigned experience should make operation plans feel like first-class admin records. A manager should be able to manage an operation main task and maintain multiple child task time ranges inside one visible cycle.

Patrol management keeps its current arrangement-oriented behavior.

## Current Context

The backend already models task planning as:

- `task_containers`: main task container, used by operation and patrol plans.
- `task_items`: child task records attached to one container by `container_id`.

The task expansion domain already supports multiple child tasks, overlapping child tasks, recurrence, holiday/weekend skips, and board-window filtering.

The current admin operation form only creates one operation container and one child task at a time. It does not expose full multi-child operation management.

## Product Behavior

### Operation Plan List

The admin operation section shows operation plans as a list.

By default, the list is filtered by the selected date. It shows enabled and disabled operation plans whose occurrence window can intersect that date.

The page also provides a "show all" mode for managers who need to find older, future, or inactive plans outside the selected date.

Each list row should show enough summary information to choose a plan:

- Plan name
- Start and end time
- Recurrence type
- Child task count
- Enabled status
- Skip weekend and skip holiday indicators

### Operation Plan Detail

Selecting a plan opens its detail view.

The detail view maintains main-task fields:

- Name
- Description
- Start time
- End time
- Recurrence type
- Recurrence interval minutes
- Recurrence count
- Skip weekends
- Skip holidays
- Enabled status

The detail view also contains a child-task editor for one occurrence cycle.

### Child Task Timeline Editor

Child tasks are shown on a single-cycle timeline.

The timeline does not expand all recurrence instances. It maps each child task to the main task's base cycle using:

- `offsetMinutes` for block start
- `durationMinutes` for block width

Supported timeline interactions:

- Mouse wheel zooms the timeline around the mouse position.
- Mouse drag pans the visible time window horizontally.
- Zoom and pan affect only the view state; they do not modify task data.
- Clicking a child task block opens an edit/delete modal.
- Clicking the add button opens a create-child-task modal.

The editor must support long cycles without compressing all children into an unreadable single-screen view. Horizontal panning is the primary way to inspect a zoomed-in portion of the cycle.

### Child Task Modal

The create and edit modal manages child-task fields:

- Content
- Offset minutes
- Duration minutes
- Metadata JSON
- Sort order if needed by the implementation

The modal validates inputs before save and displays backend validation errors.

Deleting a child task requires user confirmation in the UI before calling the backend delete endpoint.

## Backend Design

Keep the existing tables unchanged.

Add operation-specific admin APIs that aggregate the existing `task_containers` and `task_items` records. These APIs are for admin ergonomics only; they should not replace the generic domain model.

### API Endpoints

List operation plans:

```http
GET /api/admin/operation-plans?date=YYYY-MM-DD&scope=date|all
```

When `scope=date`, return enabled and disabled operation containers whose occurrences can intersect the selected date.

When `scope=all`, return operation containers regardless of selected date.

Get one operation plan:

```http
GET /api/admin/operation-plans/:id
```

Return the operation container plus its child task array ordered by `sort_order, offset_minutes`.

Create an operation plan:

```http
POST /api/admin/operation-plans
```

Create a `task_containers` row with `type = 'operation'`.

Update an operation plan:

```http
PUT /api/admin/operation-plans/:id
```

Update only the operation container. Child tasks are managed through child endpoints.

Enable or disable an operation plan:

```http
PATCH /api/admin/operation-plans/:id/enabled
```

Delete an operation plan:

```http
DELETE /api/admin/operation-plans/:id
```

Delete the container. Existing foreign-key cascade deletes child tasks.

Create a child task:

```http
POST /api/admin/operation-plans/:id/items
```

Update a child task:

```http
PUT /api/admin/operation-plans/:id/items/:itemId
```

Delete a child task:

```http
DELETE /api/admin/operation-plans/:id/items/:itemId
```

### Validation

Operation plan validation follows the existing task container validation:

- `endAt` must be after `startAt`.
- Finite and infinite recurrence require a positive recurrence interval.
- Finite recurrence requires a positive recurrence count.

Child task validation follows the existing task item validation:

- `offsetMinutes` must be non-negative.
- `durationMinutes` must be positive.
- `offsetMinutes + durationMinutes` must be less than or equal to the parent occurrence duration.
- Child tasks may overlap.
- Metadata must be a JSON object.

The update endpoint for a child task must verify that the item belongs to the operation plan in the URL.

The child-task endpoints must reject non-operation containers.

### Board Snapshot Compatibility

The board snapshot keeps using the existing task expansion logic.

No board API contract change is required. Existing `operation.items` continues to contain expanded operation child tasks:

- `content`
- `startAt`
- `endAt`
- `metadata`

The redesigned admin APIs should publish board events after successful writes so the board updates through the existing live-refresh path.

## Frontend Design

### Admin Operation Section

Replace the current single operation form with an operation management surface:

- Date toolbar and "show all" toggle.
- Operation plan list.
- Operation plan detail editor.
- Child-task single-cycle timeline editor.
- Child-task create/edit modal.

The page should avoid mixing operation children into the same table as operation plans. A selected plan owns its child-task timeline.

### Timeline View State

Timeline view state is frontend-only:

- `zoomLevel` or visible-duration state
- `visibleStartOffsetMinutes`
- dragging state

The timeline clamps panning so the visible range stays within the parent cycle.

The initial view fits the full parent cycle when the cycle is reasonably short. For long cycles, the UI may still start with a full-cycle overview, but zoom and pan must make individual blocks readable.

### Editing Flow

Creating a plan:

1. User creates or saves the main operation plan.
2. Frontend receives the plan id.
3. User adds child tasks from the timeline section.

Editing a plan:

1. User selects a plan from the list.
2. Frontend loads full plan detail.
3. User edits plan fields or child task blocks independently.

Deleting:

- Deleting a child task removes only that `task_items` row.
- Deleting a plan removes the `task_containers` row and cascades its child tasks.

## Testing

Backend tests should cover:

- Listing operation plans by selected date.
- Listing all operation plans.
- Fetching one plan with multiple child tasks.
- Creating, updating, enabling/disabling, and deleting an operation plan.
- Creating, updating, and deleting operation child tasks.
- Rejecting child tasks that exceed the parent occurrence duration.
- Rejecting child item updates when the item does not belong to the plan.
- Publishing board events after successful operation writes.

Frontend tests should cover:

- Rendering the operation plan list.
- Loading selected plan details.
- Rendering child tasks on the single-cycle timeline from offset and duration.
- Wheel zoom changing timeline view state without mutating task data.
- Drag pan changing timeline view state without mutating task data.
- Opening the edit modal by clicking a task block.
- Creating, editing, and deleting child tasks through API client calls.

## Non-Goals

- Do not change the `task_containers` or `task_items` schema.
- Do not redesign patrol arrangements.
- Do not change the board API response shape.
- Do not implement drag-to-reschedule child tasks in this redesign.
- Do not expand all recurrence instances inside the admin child-task editor.
