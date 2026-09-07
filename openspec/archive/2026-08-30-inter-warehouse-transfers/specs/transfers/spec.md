## Purpose

Manages stock movement between Capital Agro Holding's outlets, project central warehouses, and group central warehouse, including cross-project transfers with inter-company accounting, in-transit tracking, and discrepancy loss allocation.

## ADDED Requirements

### Requirement: Transfer requisitions
The system SHALL allow outlets to request stock from their respective project central warehouse or from a group central warehouse.

#### Scenario: Outlet to project warehouse request
- **WHEN** a Fanshy outlet requests stock from the Fanshy Central Depot
- **THEN** the system creates a transfer requisition scoped to the Fanshy project

#### Scenario: Group warehouse request
- **WHEN** an outlet requests stock from the group central warehouse
- **THEN** the system creates a transfer requisition against the group node and validates group access

### Requirement: Project-to-project transfers
The system SHALL allow cross-project stock transfers with automated inter-company cost accounting.

#### Scenario: Cross-project borrowing
- **WHEN** Spacca requests milk from the Fanshy Central Depot
- **THEN** the system creates a cross-project transfer and generates inter-company cost accounting entries between the two projects

#### Scenario: Inter-company valuation
- **WHEN** a cross-project transfer is completed
- **THEN** the system values the transferred stock at the sending warehouse's cost and records the inter-company charge

### Requirement: In-transit holding hub
The system SHALL move transferred stock into a virtual In-Transit status during transit, keeping financial ownership tracked until destination receipt.

#### Scenario: Dispatch to in-transit
- **WHEN** a transfer is dispatched from the sending warehouse
- **THEN** the system moves the stock to the In-Transit node and records the sending warehouse as financial owner

#### Scenario: Receipt at destination
- **WHEN** the destination warehouse confirms receipt of the in-transit stock
- **THEN** the system moves the stock from In-Transit to the destination warehouse and transfers financial ownership

### Requirement: Discrepancy and transit loss allocation
The system SHALL log discrepancies upon receipt and auto-assign cost loss to the sending warehouse, receiving branch, or logistics transport.

#### Scenario: Receiving discrepancy
- **WHEN** the received quantity differs from the dispatched quantity
- **THEN** the system logs the discrepancy and allocates the cost loss according to configured responsibility rules

#### Scenario: Transit loss attribution
- **WHEN** a transit loss is attributed to the logistics transport
- **THEN** the system records the loss against the transport party and updates the sending warehouse's stock accordingly