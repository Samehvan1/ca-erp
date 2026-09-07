# Stocktaking Specification

## Purpose

Provides physical stocktaking with full and cycle counting, a mobile barcode/QR scanning app for receiving, stocktakes, and transfer dispatches, and threshold-based multi-level adjustment approvals across all warehouses.

## Requirements

### Requirement: Full and cycle counting
The system SHALL support periodic full counts and daily rolling cycle counts by item scope or ABC classification.

#### Scenario: Full count
- **WHEN** a full stocktake is scheduled for a warehouse
- **THEN** the system generates a count sheet covering all items in that warehouse

#### Scenario: Cycle count by ABC class
- **WHEN** a cycle count is scheduled for an ABC class of items
- **THEN** the system generates a count sheet covering only the items in that class

### Requirement: Mobile scanner app
The system SHALL provide an iOS/Android mobile app allowing store managers and warehouse staff to scan barcodes/QR codes during receiving, stocktakes, and transfer dispatches.

#### Scenario: Scan during stocktake
- **WHEN** a staff member scans an item's barcode during a stocktake
- **THEN** the system records the scanned quantity against the count sheet line

#### Scenario: Scan during receiving
- **WHEN** a staff member scans items during goods receiving
- **THEN** the system validates the scanned items against the GRN and records received quantities

#### Scenario: Scan during transfer dispatch
- **WHEN** a staff member scans items during a transfer dispatch
- **THEN** the system validates the scanned items against the dispatch list and records dispatched quantities

### Requirement: Multi-level adjustment approval
The system SHALL require manager sign-off for stock adjustments for waste, damage, or theft, based on financial thresholds.

#### Scenario: Adjustment within threshold
- **WHEN** an adjustment value is within the manager's approval threshold
- **THEN** the system applies the adjustment after single-level manager approval

#### Scenario: Adjustment above threshold
- **WHEN** an adjustment value exceeds the manager's approval threshold
- **THEN** the system escalates the adjustment to the next approval level and blocks the stock change until approved