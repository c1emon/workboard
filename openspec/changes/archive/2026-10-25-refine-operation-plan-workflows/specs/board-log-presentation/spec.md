# Board Log Presentation Delta

## REMOVED Requirements

### Requirement: Task text wraps and expands rows
**Reason**: The user explicitly chose to retain the existing fixed-height rows, two-line task text limit, and current scrolling behavior so long text does not squeeze other board modules.
**Migration**: Use the bounded text requirement below; no board layout redesign or row-height expansion is introduced.

## ADDED Requirements

### Requirement: Task text uses bounded wrapping in fixed-height rows
Dense board task cells SHALL keep the existing fixed row height and wrap task text to at most two visible lines, truncating additional text. The existing whole-table scrolling behavior SHALL remain unchanged. Long text SHALL NOT increase module height or squeeze other board modules.

#### Scenario: A task exceeds the visible two-line limit
- **WHEN** task text exceeds two lines in its board table cell
- **THEN** the row retains its existing height and additional text is truncated
- **AND** other module positions and dimensions remain unchanged

#### Scenario: Rows exceed the visible table capacity
- **WHEN** a dense board table has more rows than its visible capacity
- **THEN** it continues using the existing whole-table scrolling behavior
