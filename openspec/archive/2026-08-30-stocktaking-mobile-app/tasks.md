## 1. Count Scheduling

- [x] 1.1 Implement full count scheduling and verify count sheet generation covers all warehouse items
- [x] 1.2 Implement cycle count scheduling by item scope and ABC classification and verify filtered count sheets
- [x] 1.3 Implement daily rolling cycle cadence and verify the scheduler triggers counts as configured

## 2. Mobile Scanner App

- [x] 2.1 Build the iOS/Android scanner app shell and verify it builds for both platforms
- [x] 2.2 Implement barcode/QR scanning for stocktakes and verify scanned quantities record against count sheets
- [x] 2.3 Implement scanning for receiving and transfer dispatch and verify validation against GRN/dispatch lists
- [x] 2.4 Implement offline buffering and sync and verify entries reconcile without loss

## 3. Reconciliation & Adjustments

- [x] 3.1 Implement count reconciliation against system stock and verify variance computation tests pass
- [x] 3.2 Implement the adjustment workflow with threshold-based approvals and verify escalation tests pass
- [x] 3.3 Verify approved adjustments update stock and emit audit trail entries

## 4. Integration

- [x] 4.1 Feed count variance to the recipe-costing variance engine and verify variance report integration tests pass
- [x] 4.2 Emit adjustment events to the finance module and verify waste write-off GL posting integration tests pass