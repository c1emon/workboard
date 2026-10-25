# Operation Board Selection

## Purpose

让管理人员在保留多个操作计划的同时，明确选择大屏展示哪一个计划的任务时间轴。展示选择只影响操作区域的数据来源，避免多条时间轴争用有限空间，并保持其他模块稳定。

## ADDED Requirements

### Requirement: Select one operation plan for display
The management interface SHALL allow multiple operation plans to coexist and provide single selection of the plan whose operation instances are displayed on the board.

#### Scenario: Select one of multiple plans
- **GIVEN** operation plans A and B both exist
- **WHEN** the manager selects B for board display
- **THEN** the operation timeline displays B's instances within its time window and excludes A's instances
- **AND** both plans remain available for management

### Requirement: Keep display selection independent from plan enablement
Selecting a plan for display SHALL NOT change its enabled state. Enabling or disabling a plan SHALL NOT automatically select another plan or clear the persisted display selection. Disabled selected plans SHALL use the defined empty display state.

#### Scenario: Disable the selected plan
- **WHEN** the selected operation plan is disabled
- **THEN** its stored display selection remains unchanged and no other plan is automatically selected
- **AND** the operation area displays `无可展示计划`

### Requirement: Select the first plan on initial use
On first-time display-selection initialization, the system SHALL default to the first operation plan in the existing management list order if a plan exists. This initial default SHALL NOT be reapplied to replace a later missing or unavailable selection.

#### Scenario: Initialize with existing plans
- **GIVEN** there is no previously initialized display selection and the operation list contains plans
- **WHEN** display selection is initialized
- **THEN** the first plan in that list order is selected

### Requirement: Show the defined empty state
The operation area SHALL display `无可展示计划` when no plan is selected, the selected plan is disabled or deleted, or it has no displayable instances in the current time window. It SHALL NOT silently switch to another plan.

#### Scenario: The selected plan has no visible instances
- **WHEN** the selected plan has no displayable instances in the board's current time window
- **THEN** the operation area displays `无可展示计划` and the selection is retained

#### Scenario: The selected plan is deleted
- **WHEN** the selected plan is deleted
- **THEN** the operation area displays `无可展示计划` without automatically choosing another plan

#### Scenario: No operation plan exists
- **WHEN** there is no operation plan to select
- **THEN** the operation area displays `无可展示计划`

### Requirement: Persist selection globally and refresh immediately
The display selection SHALL be shared globally across board clients and persist across page reloads and service restarts. Changing the selection SHALL immediately notify connected boards to refresh, rather than waiting for fallback polling.

#### Scenario: Restore the selection
- **WHEN** a page reloads or the service restarts after a plan has been selected
- **THEN** the same global selection is restored

#### Scenario: Switch plans with multiple boards connected
- **WHEN** a manager changes the display selection
- **THEN** all connected boards are immediately notified to refresh using the new selection

### Requirement: Show the saved selection independently of filters
The management interface SHALL display the saved global selection even if date filtering hides that plan from the list. A failed selection save SHALL retain the previous saved selection and show an error rather than announcing a successful switch.

#### Scenario: Filter out the selected plan
- **WHEN** a date filter hides the currently selected plan
- **THEN** the current-selection summary still identifies it and the filter does not initialize a new selection

#### Scenario: Saving a new selection fails
- **WHEN** the server rejects a display-selection change
- **THEN** the management interface retains the previously saved selection and reports the failure

### Requirement: Select plans rather than generation batches
Board selection SHALL identify an operation plan. Regenerating the selected plan SHALL update its future schedule without requiring a separate selection of a generation batch.

#### Scenario: Regenerate the displayed plan
- **WHEN** the selected operation plan receives a new generated schedule
- **THEN** the displayed operation data continues to come from that plan
- **AND** the manager does not need to select a generation batch

### Requirement: Preserve the fixed board layout
The board SHALL display only the selected operation plan's timeline without adding parallel tracks for other plans or rotating through plans. The positions and dimensions of other board modules and their existing scrolling behavior SHALL remain unchanged.

#### Scenario: Change the displayed plan
- **WHEN** the manager switches the displayed operation plan
- **THEN** the board continues to use one operation timeline area
- **AND** the permit, patrol, other, and leave modules retain their existing layout and scrolling behavior

### Requirement: Align operation and patrol management tabs
The management interface SHALL organize operation and patrol management into matching instance and plan tabs, defaulting to task instances. Operation SHALL offer `任务实例` and `操作计划`; patrol SHALL retain `任务实例` and `巡视模板`. Each instance list SHALL query its own task type and keep its show-all state separate from other lists. Operation instances SHALL display exact start and end times in Beijing time.

#### Scenario: Open operation management
- **WHEN** the manager opens the operation module
- **THEN** task instances are initially active with only operation instances and their exact start/end times
- **AND** switching to operation plans exposes the existing plan and board selection controls

#### Scenario: Generate from the operation instance tab
- **WHEN** the manager chooses to regenerate from the operation instance tab
- **THEN** the existing single-plan generation and replacement confirmation workflow opens
- **AND** it does not call the patrol generation workflow
