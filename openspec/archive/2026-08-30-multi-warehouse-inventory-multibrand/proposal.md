## Why

Capital Agro Holding operates a decentralized, hybrid warehouse topology (project central warehouses, an optional group central warehouse, and branch sub-warehouses) with items that are either shared across projects or isolated to a single brand. Stock must be tracked at both generic item and brand variant levels with strict expiry control, which current systems cannot support.

## What Changes

- Add item scope control: master items flagged as Project-Isolated (e.g., Fanshy Secret Spice Mix) or Cross-Project Shared (e.g., Sugar, Cooking Oil, Milk).
- Add a multi-brand hierarchy under the item master: a generic item (e.g., Full Cream Milk 1L) contains brand child records (Juhayna, Dina-Farms, Lamar), with stock tracked at generic or brand variant level.
- Add the warehouse node model: project central warehouses (PCW), optional group central warehouse (GCW), and branch sub-warehouses (kitchen stores, barista stations, prep units).
- Add batch/lot & FEFO control enforcing First-Expired-First-Out picking across all warehouses, preventing issuance of near-expiry or expired batches.
- Add automated expiration alerts at 60/30/15/7-day tiers triggering stock transfers, promotional discounts, or vendor returns.
- Add dynamic safety stock & ROP per warehouse based on historical consumption velocity and vendor lead time.

## Capabilities

### New Capabilities
- `inventory`: Multi-warehouse item master with scope control, multi-brand variants, batch/lot & FEFO control, expiration alerts, and dynamic reorder points.

### Modified Capabilities
- (none — no existing specs)

## Impact

- New item master and warehouse hierarchy consumed by procurement, transfers, recipe costing, stocktaking, and analytics modules.
- FEFO picking rules affect POS deduction and transfer dispatch behavior.
- ROP calculation feeds the procurement module's automatic requisition trigger.
- Expiration alerts surface in the Stock Aging & Expiration Risk report.