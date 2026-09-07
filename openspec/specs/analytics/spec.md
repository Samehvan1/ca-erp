# Analytics Specification

## Purpose

Delivers the enterprise BI reporting suite for Capital Agro Holding with role-targeted reports on stock valuation, consumption variance, procurement balances, supplier payables, stock aging, vendor SLA, and menu margins, with scheduled delivery and bilingual output.

## Requirements

### Requirement: Project Stock Valuation Ledger report
The system SHALL provide a Project Stock Valuation Ledger report for CFO and Project Finance audiences showing inventory asset value per project warehouse, WAC pricing, and brand breakdown, available in real time and monthly.

#### Scenario: Real-time valuation view
- **WHEN** a CFO requests the stock valuation ledger
- **THEN** the system returns inventory asset value per project warehouse with WAC pricing and brand breakdown

#### Scenario: Monthly valuation snapshot
- **WHEN** the monthly valuation snapshot is generated
- **THEN** the system produces the ledger for the completed month and delivers it to the finance audience

### Requirement: Theoretical vs Actual Variance report
The system SHALL provide a Theoretical vs Actual Variance report for F&B Leads and Cost Controllers showing POS theoretical usage versus physical stock count and waste percentage per brand/outlet, available daily and weekly.

#### Scenario: Daily variance report
- **WHEN** the daily variance report is generated
- **THEN** the system reports theoretical vs actual consumption and waste percentage per brand and outlet for the previous day

### Requirement: PO Open Balance and Partial Receipts report
The system SHALL provide a PO Open Balance & Partial Receipts report for Procurement Managers showing staggered GRN receipts, open PO quantities, and pending deliveries by vendor, in real time.

#### Scenario: Open PO view
- **WHEN** a procurement manager requests open PO balances
- **THEN** the system returns open PO quantities, received-to-date, and pending deliveries grouped by vendor

### Requirement: Supplier AP and Partial Payments report
The system SHALL provide a Supplier AP & Partial Payments report for the Accounts Payable Lead showing invoices matched, partial payments made, and outstanding supplier balances, available weekly and monthly.

#### Scenario: Weekly AP report
- **WHEN** the weekly AP report is generated
- **THEN** the system reports matched invoices, partial payments, and outstanding balances per supplier

### Requirement: Stock Aging and Expiration Risk report
The system SHALL provide a Stock Aging & Expiration Risk report for Warehouse and Store Managers showing items near expiry (7/15/30 days), slow-moving stock, and dead stock, with a daily alert.

#### Scenario: Daily expiration alert
- **WHEN** the daily expiration check runs
- **THEN** the system alerts warehouse and store managers about items within the 7/15/30-day expiry windows

#### Scenario: Aging breakdown
- **WHEN** a warehouse manager requests the aging report
- **THEN** the system returns slow-moving and dead stock items with their aging buckets

### Requirement: Vendor SLA and Performance report
The system SHALL provide a Vendor SLA & Performance report for Procurement Managers showing OTIF rate, price variance, and partial delivery compliance per vendor, available monthly.

#### Scenario: Monthly vendor SLA report
- **WHEN** the monthly vendor SLA report is generated
- **THEN** the system reports OTIF rate, price variance compliance, and partial delivery compliance per vendor

### Requirement: Menu Item Margin and Recipe Cost report
The system SHALL provide a Menu Item Margin & Recipe Cost report for Brand Managers showing live food/beverage cost percentage per item and brand ingredient cost breakdown, in real time.

#### Scenario: Live margin view
- **WHEN** a brand manager requests menu margins
- **THEN** the system returns live food/beverage cost percentage per menu item with brand ingredient cost breakdown

### Requirement: Report performance and bilingual output
The system SHALL generate bulk stock reports in under 2 seconds and SHALL render all reports in both English and Arabic.

#### Scenario: Bulk report performance
- **WHEN** a bulk stock report is requested
- **THEN** the system returns the report in under 2 seconds

#### Scenario: Bilingual rendering
- **WHEN** a user requests a report in Arabic
- **THEN** the system renders the report with Arabic labels and content