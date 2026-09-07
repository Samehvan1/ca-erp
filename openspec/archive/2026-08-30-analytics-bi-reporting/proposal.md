## Why

Holding-level consolidation and project autonomy both require timely, accurate reporting across finance, procurement, inventory, and F&B operations. Executives, cost controllers, and warehouse managers need role-targeted reports with real-time and scheduled delivery, in English and Arabic, without manual spreadsheet assembly.

## What Changes

- Add the Project Stock Valuation Ledger report (CFO/Project Finance): inventory asset value per project warehouse, WAC pricing, brand breakdown; real-time/monthly.
- Add the Theoretical vs Actual Variance report (F&B Leads/Cost Controller): POS theoretical usage vs physical stock count, waste % per brand/outlet; daily/weekly.
- Add the PO Open Balance & Partial Receipts report (Procurement Manager): staggered GRN receipts, open PO quantities, pending deliveries by vendor; real-time.
- Add the Supplier AP & Partial Payments report (AP Lead): invoices matched, partial payments made, outstanding supplier balances; weekly/monthly.
- Add the Stock Aging & Expiration Risk report (Warehouse/Store Managers): items near expiry (7/15/30 days), slow-moving stock, dead stock; daily alert.
- Add the Vendor SLA & Performance report (Procurement Manager): OTIF rate, price variance, partial delivery compliance per vendor; monthly.
- Add the Menu Item Margin & Recipe Cost report (Brand Managers): live food/beverage cost % per item, brand ingredient cost breakdown; real-time.
- Enforce report performance (bulk stock reports < 2 seconds) and bilingual (English/Arabic) output.

## Capabilities

### New Capabilities
- `analytics`: Enterprise BI reporting suite with role-targeted reports, scheduled delivery, performance guarantees, and bilingual output.

### Modified Capabilities
- (none — no existing specs)

## Impact

- New reporting engine consuming data from procurement, inventory, transfers, recipe costing, stocktaking, finance, and supplier management modules.
- Scheduled delivery and daily alerts require a scheduler and notification service.
- Bilingual output affects report rendering and localization infrastructure.