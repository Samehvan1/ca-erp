# Finance Specification

## Purpose

Automates general ledger postings for stock movements, partial deliveries, POS sales, and waste write-offs; tracks accounts payable with partial payments; and provides WAC/FIFO valuation with multi-level cost center accounting across the holding.

## Requirements

### Requirement: Automated GL postings
The system SHALL post accounting entries in real time for Goods Receipt (Inventory Dr / GRNI Cr), partial deliveries, POS sales deduction (COGS Dr / Inventory Cr), and waste write-offs.

#### Scenario: Goods receipt posting
- **WHEN** a GRN is confirmed
- **THEN** the system posts Inventory Dr and GRNI Cr for the received quantity at valuation cost

#### Scenario: POS sales deduction posting
- **WHEN** a POS sales payload deducts stock
- **THEN** the system posts COGS Dr and Inventory Cr for the consumed quantity

#### Scenario: Waste write-off posting
- **WHEN** an approved waste adjustment is finalized
- **THEN** the system posts the waste write-off to the appropriate expense account

### Requirement: AP and partial payments
The system SHALL track supplier partial invoices, advance payments, milestone tranches, and retainage balances per PO/GRN.

#### Scenario: Partial invoice tracking
- **WHEN** a supplier invoice is partially approved against a GRN tranche
- **THEN** the system records the partial invoice amount in the supplier's AP ledger

#### Scenario: Retainage balance
- **WHEN** a retainage percentage is configured on a PO
- **THEN** the system holds the retainage amount and tracks it as a separate balance until release

### Requirement: Valuation methods
The system SHALL support perpetual Weighted Average Costing (WAC) and FIFO valuation.

#### Scenario: WAC recalculation
- **WHEN** a new stock receipt occurs at a different unit cost
- **THEN** the system recalculates the weighted average cost of the item

#### Scenario: FIFO consumption
- **WHEN** an item is valued using FIFO and stock is consumed
- **THEN** the system consumes the cost of the earliest received batch first

### Requirement: Cost center accounting
The system SHALL segregate P&L and asset tracking by Holding, Project/Brand, and individual Warehouse/Branch location.

#### Scenario: Project-level P&L
- **WHEN** a finance user views a project's P&L
- **THEN** the system reports revenues and costs segregated to that project's cost centers

#### Scenario: Warehouse-level tracking
- **WHEN** a finance user views a warehouse's asset value
- **THEN** the system reports inventory asset value attributed to that warehouse's cost center