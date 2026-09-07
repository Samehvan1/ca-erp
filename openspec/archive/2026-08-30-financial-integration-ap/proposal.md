## Why

Capital Agro Holding needs complete financial transparency across its multi-entity structure (Holding, Project/Brand, Warehouse/Branch). Stock movements, partial deliveries, POS sales, and waste must post automatically to the general ledger with correct valuation, and supplier payables must track partial invoices and installment payments.

## What Changes

- Add automated GL postings: real-time posting for Goods Receipt (Inventory Dr / GRNI Cr), partial deliveries, POS sales deduction (COGS Dr / Inventory Cr), and waste write-offs.
- Add AP & partial payments: supplier partial invoices, advance payments, milestone tranches, and retainage balances per PO/GRN.
- Add valuation methods: perpetual Weighted Average Costing (WAC) and FIFO.
- Add cost center accounting: segregated P&L and asset tracking by Holding, Project/Brand, and individual Warehouse/Branch location.

## Capabilities

### New Capabilities
- `finance`: Automated GL postings, accounts payable with partial payments, WAC/FIFO valuation, and multi-level cost center accounting.

### Modified Capabilities
- (none — no existing specs)

## Impact

- New GL posting engine consuming events from procurement (GRN, invoices), inventory (stock movements), recipe costing (POS deductions), and stocktaking (adjustments).
- AP ledger integrates with the procurement module's partial payment workflow.
- Valuation (WAC/FIFO) feeds recipe costing and the Project Stock Valuation Ledger report.
- Cost center structure mirrors the multi-tenant hierarchy (Holding, Project, Warehouse).