# operation-instance-generation Specification

## Purpose

让管理人员使用某个操作子任务的实际开始时间定位本次周期生成，并以新结果替换该计划尚未开始的自动安排，同时保留正在执行、已经执行和人工维护的数据。

## Requirements

### Requirement: Generate from a selected child task
For finite or infinite operation cycles, the system SHALL let users select a starting child task and that child's actual start time. It SHALL start generation there and continue cycling without an elapsed-time offset or a manually calculated cycle zero point. Both dense and non-dense cycles SHALL support this input.

#### Scenario: Start generation from operation B
- **WHEN** the user selects child B and enters October 25 at 10:30 as its start time
- **THEN** the generated B begins at 10:30 and generation continues through subsequent cycle tasks
- **AND** 10:30 is not interpreted as a time partway through B

### Requirement: Generate one-time plans from cycle zero only
One-time operation plans SHALL be generated only from the cycle zero point. Their entered generation start time SHALL locate cycle zero, and the interface SHALL NOT offer an arbitrary child task as the starting position.

#### Scenario: Generate a one-time plan with overlapping children
- **GIVEN** a one-time plan has child A starting before child B and overlapping B
- **WHEN** the user generates the plan at a specified time
- **THEN** that time locates cycle zero and the complete one-time cycle is considered for generation
- **AND** the user cannot choose B as a partial-cycle starting position

### Requirement: Omit earlier children from the initial partial cycle
When a recurring plan starts generation at child B, the initial partial cycle SHALL include only child tasks whose start times are at or after B's start time. A child starting earlier SHALL NOT be included merely because it overlaps B. Subsequent cycles SHALL continue normally.

#### Scenario: An earlier child overlaps the starting child
- **GIVEN** recurring child A starts before B and ends after B starts
- **WHEN** generation starts at B
- **THEN** the initial partial cycle excludes A and includes B and other children starting at or after B
- **AND** A remains eligible in subsequent complete cycles

### Requirement: Preserve gaps in non-dense cycles
Generation SHALL preserve the relative time gaps between child tasks in a non-dense cycle. Selecting a child as the starting position SHALL NOT compress those gaps or concatenate separated tasks.

#### Scenario: Two tasks have a gap
- **GIVEN** child C begins two hours after B ends in the plan
- **WHEN** a new recurring schedule is generated from B
- **THEN** the generated C still begins two hours after the generated B ends

### Requirement: Apply the cutoff to task start times
A generated task's start time SHALL be strictly earlier than the requested generation cutoff. An eligible task SHALL retain its full duration even if its end exceeds the cutoff. Tasks starting at or after the cutoff SHALL NOT be generated.

#### Scenario: A task crosses the cutoff
- **WHEN** a task begins at 10:00 and ends at 12:00 and the generation cutoff is 11:00
- **THEN** the task is generated with its full 10:00 to 12:00 interval

#### Scenario: A task starts at or after the cutoff
- **WHEN** a task begins at or after the generation cutoff
- **THEN** the task is not generated

### Requirement: Preserve existing calendar skipping semantics
Generation SHALL retain the existing weekend, holiday, and adjusted-workday skipping rules. Selecting a new starting child or time SHALL NOT introduce different skip units, holiday-boundary truncation, or adjusted-workday behavior.

#### Scenario: Apply the plan's calendar settings
- **WHEN** a recurring operation plan is generated using a selected child and start time
- **THEN** the existing occurrence-based weekend and holiday decisions are applied at the resulting cycle positions
- **AND** adjusted workdays retain their existing effect on weekend skipping

### Requirement: Preserve the plan definition during generation
Generation SHALL leave the plan's stored start time and child task definitions unchanged. The selected child and actual start time SHALL locate this generation operation only.

#### Scenario: Use a different start time for generation
- **WHEN** a user generates instances using a child and an actual time different from the plan's original cycle start
- **THEN** the plan's basic information, child offsets, durations, and ordering remain unchanged

### Requirement: Replace the plan's unstarted generated schedule
Regeneration SHALL remove all old automatically generated instances of the selected operation plan that are pending and not started, then insert the new schedule. Removal SHALL include eligible old instances outside the newly requested generation window.

#### Scenario: Shorten the generated date range
- **GIVEN** a plan has unstarted pending generated instances for seven upcoming days
- **WHEN** the user regenerates the plan for only the next three days
- **THEN** the old eligible instances across all seven days are removed
- **AND** only the new three-day generated schedule is inserted

### Requirement: Preserve protected instances
Regeneration SHALL preserve in-progress, done, cancelled, manually entered, and manually adjusted instances. A single future schedule SHALL NOT require removing protected history or protected ongoing work.

#### Scenario: Regenerate a plan with protected records
- **WHEN** a plan is regenerated while it has in-progress, done, cancelled, manual, or manually adjusted instances
- **THEN** those instances remain unchanged

### Requirement: Preserve identity deduplication without prohibiting time overlap
Generation SHALL avoid inserting a duplicate of a preserved instance with the same generation identity. It SHALL NOT reject new instances solely because their time intervals overlap a preserved instance, and SHALL NOT remove protected instances to resolve time overlap.

#### Scenario: A protected instance has the same generation identity
- **WHEN** a generated candidate matches a preserved instance's generation identity
- **THEN** the existing instance remains unchanged and no duplicate is inserted

#### Scenario: A new instance overlaps protected work
- **WHEN** a generated candidate has a different generation identity but overlaps a preserved in-progress instance
- **THEN** overlap alone does not reject generation or remove the protected instance

### Requirement: Replace schedules atomically
Removal of old eligible instances and insertion of the new schedule SHALL succeed or fail together. If generation fails, the previous schedule SHALL remain intact.

#### Scenario: New schedule cannot be saved
- **WHEN** regeneration fails while replacing the schedule
- **THEN** the previously stored instances remain intact and no partial new schedule is saved

### Requirement: Explain whole-plan replacement
The management interface SHALL clearly state that regeneration replaces all unstarted automatically generated arrangements of the selected plan, including eligible arrangements outside the requested generation window. Before confirmation it SHALL show the target plan, starting position, actual start time, cutoff, and protected-instance notice.

#### Scenario: Confirm regeneration
- **WHEN** the user is asked to confirm regeneration
- **THEN** the notice identifies whole-plan replacement rather than describing the operation as a date-range-only supplement

### Requirement: Keep generation feedback accurate
The interface SHALL prevent duplicate submission while generation is pending and show actual removal and insertion results after success. A confirmed rollback SHALL preserve the entered form and report the old schedule intact. An indeterminate network outcome SHALL be identified as unconfirmed and SHALL NOT trigger an automatic write retry.

#### Scenario: Generation succeeds with no new instances
- **WHEN** regeneration removes old eligible instances but creates zero new ones
- **THEN** the interface shows both the actual removal count and zero insertions without describing the operation as a failed or harmless no-op

#### Scenario: The request outcome is unknown
- **WHEN** the network disconnects before the client can determine the generation result
- **THEN** the interface reports that the result is unconfirmed and does not claim successful rollback or automatically resubmit
