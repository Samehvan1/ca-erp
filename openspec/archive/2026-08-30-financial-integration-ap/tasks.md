## 1. Cost Centers & Chart of Accounts

- [x] 1.1 Create the cost center hierarchy (Holding, Project, Warehouse/Branch) and verify migrations and seed scripts run cleanly
- [x] 1.2 Create the chart of accounts mapping and verify account mapping tests pass

## 2. GL Posting Engine

- [x] 2.1 Implement the GL posting engine consuming GRN events and verify Inventory Dr / GRNI Cr posting tests pass
- [x] 2.2 Implement POS sales deduction postings and verify COGS Dr / Inventory Cr tests pass
- [x] 2.3 Implement waste write-off postings and verify expense account posting tests pass
- [x] 2.4 Implement idempotent posting keys and verify duplicate event replay does not double-post

## 3. Valuation

- [x] 3.1 Implement perpetual WAC recalculation and verify WAC tests pass on receipt
- [x] 3.2 Implement FIFO consumption and verify earliest-batch cost consumption tests pass
- [x] 3.3 Verify valuation feeds recipe costing and the stock valuation ledger

## 4. AP Ledger & Partial Payments

- [x] 4.1 Implement the AP ledger with partial invoices and verify partial invoice posting tests pass
- [x] 4.2 Implement advance, milestone, and retainage tracking and verify balance tests pass
- [x] 4.3 Implement retainage release and verify release posting tests pass

## 5. Integration & Reconciliation

- [x] 5.1 Integrate with the external GL/ERP posting contract and verify payload contract tests pass
- [x] 5.2 Implement GL reconciliation reports and verify reconciliation matches source events
- [x] 5.3 Feed AP data to the analytics module and verify the Supplier AP report consumes it