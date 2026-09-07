## Why

Capital Agro Holding's procure-to-pay cycle must support staggered deliveries (multiple GRNs per PO) and milestone/installment payments against partially received goods and invoices. Current workflows cannot track outstanding balances per PO, match invoices to specific delivery tranches, or prevent over-billing on partial deliveries.

## What Changes

- Add purchase requisitions triggered manually or by Reorder Point (ROP) logic, supporting project-isolated and group-consolidated requisitions.
- Add a Delegation of Authority (DoA) approval workflow with multi-tier rules based on PR value, project scope, cost center, and item category.
- Add partial goods receiving with staggered GRNs tracking Ordered, Received-to-Date, Outstanding Balance, and statuses (Open, Partially Received, Fully Received, Force Closed).
- Add QC & partial inspection per GRN shipment: accept sound goods, quarantine damaged/expired portions, and auto-generate partial return debit notes.
- Add 3-way invoice matching against specific GRN tranches, preventing over-billing while allowing partial invoice approvals.
- Add partial payment & installment workflows: down payments, milestone payments, and partial tranche payments with supplier credit ledgers.
- Add landed cost allocation per shipment, apportioning freight, customs, and clearance costs across each partial GRN.

## Capabilities

### New Capabilities
- `procurement`: Full procure-to-pay cycle with requisitions, DoA approvals, staggered partial receiving, QC inspection, 3-way matching, partial payments, and landed cost allocation.

### Modified Capabilities
- (none — no existing specs)

## Impact

- New procurement data model (PR, PO, GRN, invoice, payment) shared with inventory, finance/AP, and analytics modules.
- GRN events drive inventory stock-in and GL postings; invoice matching drives AP ledger entries.
- ROP trigger integrates with the inventory module's reorder point calculation.
- Landed cost allocation feeds inventory valuation (WAC/FIFO) in the finance module.