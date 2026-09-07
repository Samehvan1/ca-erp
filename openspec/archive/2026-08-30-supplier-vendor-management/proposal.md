## Why

Capital Agro Holding's F&B brands (Fanshy, Osta Rosto, Spacca) procure from a complex vendor network where suppliers are linked both to generic items and to specific brand variants, with contracted price lists per brand. Without a unified vendor master and SLA tracking, the holding cannot enforce negotiated pricing, measure vendor reliability, or consolidate procurement leverage.

## What Changes

- Introduce a vendor master profile capturing commercial registration, tax IDs, banking details, payment terms (COD, Net 30/60/90), and authorized supply categories.
- Add dual-level supplier mapping: suppliers linkable at the generic item master level and/or at the specific brand variant level (e.g., exclusive distributor for "Dina Farms Full Cream Milk 1L").
- Add multi-brand price lists per supplier with effective start/end dates, minimum order quantities (MOQ), and volume tier discounts.
- Add a vendor SLA scorecard tracking Order Fulfillment Rate (OTIF), price variance compliance, QC rejection rates at GRN, and document accuracy.

## Capabilities

### New Capabilities
- `supplier-management`: Vendor master data, dual-level supplier-item-brand mapping, contracted multi-brand price lists, and vendor SLA scorecard.

### Modified Capabilities
- (none — no existing specs)

## Impact

- New vendor master and supplier mapping data model shared with procurement, GRN/QC, and analytics modules.
- Price list data consumed by purchase order pricing and landed cost calculations.
- SLA scorecard feeds the Vendor SLA & Performance report in the analytics module.
- No changes to existing POS systems; vendor data is internal to the enterprise system.