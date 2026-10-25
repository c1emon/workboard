# Plan File Exchange

## Purpose

为操作与巡视计划提供可供用户下载的导出能力，并让操作计划能够像现有巡视周期项导入一样，覆盖指定已有计划的明细。文件交换与实例生成分开，避免导入意外改写实际执行安排。

## ADDED Requirements

### Requirement: Export operation and patrol plans
The system SHALL export one selected operation or patrol plan at a time as an `.xlsx` workbook. Each export SHALL contain that plan's basic information and all child task or cycle item details, excluding generated task instances and execution states. Global and multi-plan batch export SHALL NOT be provided by this capability.

#### Scenario: Export an operation plan
- **WHEN** the user exports an operation plan
- **THEN** one `.xlsx` workbook containing that plan's basic information and all child task details is available for download
- **AND** other plans and generated instances are not included

#### Scenario: Export a patrol plan
- **WHEN** the user exports a patrol plan
- **THEN** one `.xlsx` workbook containing that plan's basic information and all cycle item details is available for download
- **AND** other plans and generated instances are not included

### Requirement: Use XLSX for plan imports
Operation child detail import and patrol cycle item import SHALL use `.xlsx` workbooks. Imported data SHALL be validated before any existing detail set is replaced; invalid data SHALL leave the original details intact.

#### Scenario: Import a valid workbook
- **WHEN** the user supplies a valid `.xlsx` workbook for a selected existing plan
- **THEN** the system validates its import data before asking for confirmation and replacing details

#### Scenario: Workbook data is invalid
- **WHEN** the workbook is invalid or its required fields fail validation
- **THEN** the import fails and the plan's existing details remain intact

### Requirement: Append extension fields after fixed detail columns
Exported extension fields SHALL be listed as named columns after the fixed child task or cycle item columns. They SHALL NOT displace the fixed fields or be collapsed into a single raw extension-data column.

#### Scenario: Export details with extension fields
- **GIVEN** child details include extension keys `zone` and `remark`
- **WHEN** the plan is exported
- **THEN** columns for `zone` and `remark` appear after the fixed detail columns with the corresponding values

### Requirement: Import into a selected existing plan
Operation plan import SHALL replace all child details of a user-selected existing plan after validation and confirmation. It SHALL NOT create plans, append details, or merge by name. Patrol cycle item import SHALL retain replacement behavior. Import/export layouts should align where practical; direct reimport of exported workbooks is not required.

#### Scenario: Replace operation child details
- **GIVEN** an existing operation plan has child tasks
- **WHEN** the user selects it and confirms importing a validated file
- **THEN** its child task details are replaced with the imported details
- **AND** no additional plan is created

#### Scenario: Continue using patrol cycle item replacement
- **WHEN** a user imports cycle items into an existing patrol plan
- **THEN** the imported items replace that plan's previous cycle item set

### Requirement: Preserve plan information and generated instances on import
Detail import SHALL preserve the selected plan's name, description, stored start time, and other basic plan information. It SHALL leave already generated task instances unchanged; changing those instances requires a separate generation operation.

#### Scenario: Import new details into an existing plan
- **WHEN** the user imports replacement child task details
- **THEN** the plan's basic information remains unchanged
- **AND** previously generated instances and their execution states remain unchanged

### Requirement: Preview the import target and replacement scope
Before replacing details, the interface SHALL identify the selected plan, file name, current detail count, and validated import count, and offer a bounded detail preview. It SHALL validate all imported rows before enabling confirmation, regardless of preview size. Selecting another file SHALL invalidate the previous preview and validation result.

#### Scenario: Confirm a valid replacement
- **WHEN** the complete workbook has passed validation
- **THEN** the user sees the target plan, old and new detail counts, and a limited preview before explicitly confirming replacement
- **AND** the notice states that plan information and generated instances will remain unchanged

#### Scenario: Choose another workbook
- **WHEN** the user chooses a different workbook or reselects a corrected file
- **THEN** the previous preview and validation result are cleared and the new file is validated again
