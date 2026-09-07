## Why

Capital Agro Holding requires zero stock shrinkage and complete financial transparency, which depends on accurate physical counts. Store managers and warehouse staff need a mobile scanning workflow for receiving, stocktakes, and transfer dispatches, with controlled adjustment approvals to prevent unauthorized write-offs.

## What Changes

- Add full & cycle counting: periodic full counts and daily rolling cycle counts by item scope or ABC classification.
- Add a mobile scanner app (iOS/Android) for barcode/QR scanning during receiving, stocktakes, and transfer dispatches.
- Add multi-level adjustment approval: stock adjustments for waste, damage, or theft require manager sign-off based on financial thresholds.

## Capabilities

### New Capabilities
- `stocktaking`: Physical stocktaking with full/cycle counting, mobile barcode scanning, and threshold-based adjustment approvals.

### Modified Capabilities
- (none — no existing specs)

## Impact

- New stocktake and adjustment data model shared with inventory and finance modules.
- Count reconciliation produces variance data consumed by the Theoretical vs Actual Variance report.
- Approved adjustments trigger GL postings (waste write-offs) in the finance module.
- Mobile app integrates with the inventory module's item and warehouse data.