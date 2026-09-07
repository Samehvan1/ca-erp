## Purpose

Controls stock movements across Capital Agro Holding's project central warehouses, group central warehouse, and branch sub-warehouses with item scope rules, multi-brand variants, batch/lot FEFO control, expiration alerts, and dynamic reorder points.

## ADDED Requirements

### Requirement: Item scope control
The system SHALL flag each master item as Project-Isolated (restricted to a single project's catalog) or Cross-Project Shared (accessible to multiple projects).

#### Scenario: Project-isolated item access
- **WHEN** a user from another project attempts to use a Project-Isolated item
- **THEN** the system denies access and does not expose the item in that project's catalog

#### Scenario: Cross-project shared item access
- **WHEN** a user from any project searches for a Cross-Project Shared item
- **THEN** the system exposes the item to all projects with access to it

### Requirement: Multi-brand hierarchy under item master
The system SHALL allow a generic item to contain multiple brand child records, and SHALL track stock at the generic item level or at the specific brand variant level.

#### Scenario: Stock at brand variant level
- **WHEN** a warehouse receives a specific brand variant of a generic item
- **THEN** the system records the stock against that brand variant and rolls it up to the generic item level

#### Scenario: Generic level tracking
- **WHEN** an item is configured to track stock only at the generic level
- **THEN** the system aggregates all brand variant stock under the generic item and reports a single quantity

### Requirement: Warehouse node model
The system SHALL model the warehouse topology including project central warehouses (PCW), an optional group central warehouse (GCW), branch sub-warehouses (kitchen stores, barista stations, prep units), and a virtual in-transit node.

#### Scenario: Branch sub-warehouse stock
- **WHEN** a branch kitchen store receives stock from its project central warehouse
- **THEN** the system records the stock at the branch sub-warehouse node within the project's scope

#### Scenario: Group central warehouse
- **WHEN** a group central warehouse is configured for shared stock
- **THEN** the system allows cross-project access to stock held at the group node

### Requirement: Batch and lot FEFO control
The system SHALL enforce First-Expired-First-Out (FEFO) picking across all warehouses and prep kitchens, preventing issuance of near-expiry or expired batches.

#### Scenario: FEFO picking order
- **WHEN** a picking request is issued for an item with multiple batches
- **THEN** the system selects the batch with the earliest expiry date first

#### Scenario: Expired batch blocked
- **WHEN** a picking request references an expired batch
- **THEN** the system blocks issuance of that batch and requires an authorized disposition action

### Requirement: Automated expiration alerts
The system SHALL generate multi-tier expiration notifications at 60-day, 30-day, 15-day, and 7-day thresholds, triggering stock transfers, promotional menu discounts, or vendor returns.

#### Scenario: 30-day alert
- **WHEN** a batch's expiry date is 30 days away
- **THEN** the system notifies the responsible warehouse manager with the batch details

#### Scenario: 7-day alert with action
- **WHEN** a batch's expiry date is 7 days away
- **THEN** the system escalates the alert and suggests transfer, promotional discount, or vendor return actions

### Requirement: Dynamic safety stock and ROP
The system SHALL calculate reorder points per warehouse based on historical consumption velocity and vendor lead time.

#### Scenario: ROP recalculation
- **WHEN** consumption velocity or vendor lead time changes for an item in a warehouse
- **THEN** the system recalculates the safety stock and reorder point for that item and warehouse

#### Scenario: ROP triggers requisition
- **WHEN** projected stock falls below the calculated reorder point
- **THEN** the system triggers an automatic purchase requisition for the reorder quantity