## Context

Capital Agro Holding requires zero stock shrinkage and complete financial transparency, which depends on accurate physical counts. Warehouse staff and store managers need mobile scanning for receiving, stocktakes, and transfer dispatches, and adjustments must be controlled by financial thresholds. See proposal.md - Why for motivation.

## Goals / Non-Goals

**Goals:**
- Full and cycle counting with ABC-class scheduling.
- Mobile barcode/QR scanning for receiving, stocktakes, and transfer dispatches.
- Threshold-based multi-level adjustment approvals.

**Non-Goals:**
- RFID hardware integration.
- Automated counting devices or drones.
- Inventory forecasting.

## Decisions

- **Count sheets as scheduled documents**: Full counts and cycle counts generate count sheets filtered by item scope or ABC class. Rationale: matches the SRS requirement for periodic full and daily rolling cycle counts. Alternative: ad-hoc counts only — rejected because it cannot enforce the daily cycle cadence.
- **Mobile-first scanning with offline support**: The mobile app scans barcodes/QR codes and buffers entries offline, syncing when connectivity returns. Rationale: warehouses and kitchens may have poor connectivity. Alternative: online-only scanning — rejected for operational resilience.
- **Adjustment approval as a threshold workflow**: Adjustments route to manager sign-off based on financial thresholds, escalating above the manager's authority. Rationale: the SRS requires multi-level approval by financial threshold. Alternative: single-level approval — rejected as insufficient control.
- **Reconciliation against theoretical usage**: Count results feed the variance engine in the recipe-costing module. Rationale: the SRS ties physical counts to theoretical vs actual variance. Alternative: isolated counts — rejected because variance analysis depends on them.

## Risks / Trade-offs

- [Count errors from manual entry] → Mitigation: barcode scanning with quantity confirmation prompts.
- [Offline sync conflicts] → Mitigation: per-device entry IDs with server-side reconciliation.
- [Adjustment abuse] → Mitigation: threshold escalation plus immutable audit trail.

## Migration Plan

1. Deploy count sheet scheduling and ABC classification.
2. Release the mobile scanner app for iOS/Android.
3. Configure adjustment approval thresholds per role and project.
4. Pilot full counts in one warehouse before rolling out.

## Open Questions

- Should cycle counts be weighted by item value (ABC) or by shrinkage history? Deferrable without spec impact.