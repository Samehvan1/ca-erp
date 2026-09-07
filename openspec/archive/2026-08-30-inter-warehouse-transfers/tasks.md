## 1. Data Model

- [x] 1.1 Create the transfer document chain schema (requisition, order, dispatch, receipt) and verify migrations and seed scripts run cleanly
- [x] 1.2 Create the in-transit ledger node (TRN-99) and verify ledger movement tests pass

## 2. Transfer Requisitions

- [x] 2.1 Implement outlet-to-project-warehouse transfer requisitions and verify CRUD integration tests pass
- [x] 2.2 Implement group warehouse transfer requisitions with group access validation and verify access tests pass

## 3. Dispatch & In-Transit

- [x] 3.1 Implement transfer dispatch moving stock to in-transit and verify ownership tracking tests pass
- [x] 3.2 Implement destination receipt moving stock out of in-transit and verify ownership transfer tests pass
- [x] 3.3 Implement in-transit aging views and verify stale transfer alerts appear

## 4. Cross-Project Transfers

- [x] 4.1 Implement cross-project transfer creation and verify project scope validation tests pass
- [x] 4.2 Implement inter-company cost accounting at sending warehouse cost and verify inter-company entry tests pass

## 5. Discrepancy & Loss Allocation

- [x] 5.1 Implement receipt discrepancy logging and verify expected vs actual quantity capture
- [x] 5.2 Implement configurable loss allocation rules (sending warehouse, receiving branch, logistics) and verify allocation tests pass

## 6. Integration

- [x] 6.1 Emit transfer events to the finance module and verify GL posting integration tests pass
- [x] 6.2 Feed transfer data to the analytics module and verify transfer-related reporting consumes it