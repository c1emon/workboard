## ADDED Requirements

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

### Requirement: Task text wraps and expands rows
The system SHALL allow overflowing task text in dense board tables to wrap instead of being truncated with ellipsis, expanding row height as needed for readability.

#### Scenario: Task text exceeds column width
- **WHEN** a dense board row contains task text longer than the available task column width
- **THEN** the task text wraps onto additional lines
- **THEN** the row height expands enough to display the wrapped task text

### Requirement: Existing board behavior is preserved
The system SHALL preserve the existing board data fetching, update subscription, fallback refresh, empty-state, and connection status behavior.

#### Scenario: Board data refreshes
- **WHEN** the board fetches snapshots, receives update notifications, or uses fallback refresh
- **THEN** the existing data loading and connection status behavior remains unchanged
