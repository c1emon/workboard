# board-log-presentation Specification

## Purpose
规定变电运维工作日志大屏的标题、浅色视觉呈现、紧凑布局、任务列宽和固定行高文字截断规则，并保持原有数据刷新、连接状态及整表滚动行为。
## Requirements
### Requirement: Board uses work log title
The system SHALL display the board page title as `变电运维工作日志`.

#### Scenario: Board header renders
- **WHEN** the web board page loads
- **THEN** the header title is `变电运维工作日志`

### Requirement: Board uses light work log presentation
The system SHALL present the web board using a light background and light card treatment suitable for a readable work log.

#### Scenario: Board page renders with light presentation
- **WHEN** the web board page loads
- **THEN** the page, header, modules, side labels, dense tables, and operation timeline use light-themed backgrounds with readable dark text or accessible accent colors

### Requirement: Header time card is compact
The system SHALL reduce the top header/time card height while keeping the date/time centered and readable.

#### Scenario: Header renders compact time area
- **WHEN** the board header is displayed with server time
- **THEN** the formatted date/time remains centered in the header
- **THEN** the header uses less vertical space than the previous dark dashboard presentation

### Requirement: Operation card is compact
The system SHALL display the operation timeline card with reduced vertical padding and height while preserving operation item visibility.

#### Scenario: Operation module renders compact timeline
- **WHEN** operation items are present on the board
- **THEN** the operation timeline remains visible and readable
- **THEN** the operation module does not reserve unnecessary empty vertical space beyond the compact timeline content

### Requirement: Task columns have priority width
The system SHALL allocate more horizontal width to `任务` columns than to lower-priority non-time columns in dense board tables.

#### Scenario: Dense table contains task column
- **WHEN** a dense board table includes a `任务` column
- **THEN** the generated column layout gives the `任务` column a wider flexible allocation than personnel, vehicle, and other columns

### Requirement: Task text uses bounded wrapping in fixed-height rows
Dense board task cells SHALL keep the existing fixed row height and wrap task text to at most two visible lines, truncating additional text. The existing whole-table scrolling behavior SHALL remain unchanged. Long text SHALL NOT increase module height or squeeze other board modules.

#### Scenario: A task exceeds the visible two-line limit
- **WHEN** task text exceeds two lines in its board table cell
- **THEN** the row retains its existing height and additional text is truncated
- **AND** other module positions and dimensions remain unchanged

#### Scenario: Rows exceed the visible table capacity
- **WHEN** a dense board table has more rows than its visible capacity
- **THEN** it continues using the existing whole-table scrolling behavior

### Requirement: Existing board behavior is preserved
The system SHALL preserve the existing board data fetching, update subscription, fallback refresh, empty-state, and connection status behavior.

#### Scenario: Board data refreshes
- **WHEN** the board fetches snapshots, receives update notifications, or uses fallback refresh
- **THEN** the existing data loading and connection status behavior remains unchanged
