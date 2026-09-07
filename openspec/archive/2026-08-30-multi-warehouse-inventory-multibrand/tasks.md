## 1. Warehouse Topology

- [x] 1.1 Create the warehouse node model (project_central, group_central, branch, transit) and verify migrations and seed scripts run cleanly
- [x] 1.2 Seed the SRS topology (PCW-FSH, PCW-OST, PCW-SPC, GCW-01, FSH-KIT-01, SPC-BAR-01, TRN-99) and verify the seed test passes

## 2. Item Master & Scope

- [x] 2.1 Create the item master schema with scope flags and verify scope enforcement tests pass
- [x] 2.2 Implement Project-Isolated vs Cross-Project Shared enforcement in the catalog service and verify cross-project access is denied
- [x] 2.3 Create the brand variant child records model and verify variant rollup to generic item tests pass
- [x] 2.4 Implement stock tracking at generic and brand variant levels and verify ledger tests pass

## 3. Batch/Lot & FEFO

- [x] 3.1 Create batch/lot tracking with expiry dates and verify batch creation tests pass
- [x] 3.2 Implement FEFO picking (earliest expiry first) and verify picking order tests pass
- [x] 3.3 Implement expired batch blocking and verify blocked issuance tests pass

## 4. Expiration Alerts

- [x] 4.1 Implement the expiration alert scheduler (60/30/15/7-day tiers) and verify alert generation tests pass
- [x] 4.2 Implement alert action routing (transfer, promo discount, vendor return) and verify routing tests pass

## 5. Reorder Points

- [x] 5.1 Implement consumption velocity calculation and verify velocity tests pass
- [x] 5.2 Implement per-warehouse ROP calculation with vendor lead time and verify ROP recalculation tests pass
- [x] 5.3 Verify ROP triggers automatic requisitions in the procurement module

## 6. Integration

- [x] 6.1 Expose item and warehouse data to transfers, recipe costing, and stocktaking modules and verify integration tests pass
- [x] 6.2 Feed expiration data to the analytics module and verify the Stock Aging report consumes it