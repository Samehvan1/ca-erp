## 1. Data Model & State Machine

- [x] 1.1 Create the P2P schema (PR, PO, GRN, invoice, payment) and verify migrations and seed scripts run cleanly
- [x] 1.2 Implement the PO status state machine (Open, Partially Received, Fully Received, Force Closed) and verify transition validation tests pass
- [x] 1.3 Implement ordered/received-to-date/outstanding balance tracking and verify balance calculation tests pass

## 2. Requisitions & Approvals

- [x] 2.1 Implement manual purchase requisition creation and verify CRUD integration tests pass
- [x] 2.2 Implement ROP-triggered requisitions and verify the trigger fires when projected stock falls below reorder point
- [x] 2.3 Implement group-consolidated requisitions and verify consolidation tests pass
- [x] 2.4 Implement the DoA approval workflow (value, project scope, cost center, item category) and verify escalation tests pass

## 3. Partial Receiving & QC

- [x] 3.1 Implement staggered GRN creation against a PO and verify received-to-date updates correctly
- [x] 3.2 Implement QC inspection per GRN shipment (accept, quarantine) and verify quarantine tests pass
- [x] 3.3 Implement auto-generated partial return debit notes and verify debit note creation on QC rejection
- [x] 3.4 Implement Force Closed handling and verify the terminal state blocks further receiving

## 4. Invoice Matching & Payments

- [x] 4.1 Implement 3-way matching at GRN tranche granularity and verify over-billing rejection tests pass
- [x] 4.2 Implement partial invoice approval and verify partial approvals post correctly to AP
- [x] 4.3 Implement down payment, milestone, and partial tranche payments and verify supplier credit ledger tests pass

## 5. Landed Cost

- [x] 5.1 Implement proportional landed cost allocation across partial GRNs and verify allocation math tests pass
- [x] 5.2 Verify landed costs flow into inventory valuation and GL postings

## 6. Integration

- [x] 6.1 Emit GRN/invoice/payment events to the finance module and verify GL posting integration tests pass
- [x] 6.2 Feed PO open balance data to the analytics module and verify the PO Open Balance report consumes it