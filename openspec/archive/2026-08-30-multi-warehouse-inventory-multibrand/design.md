## Context

Capital Agro Holding uses a decentralized hybrid warehouse topology: each project may run its own central warehouse, an optional group central warehouse holds shared bulk commodities, and branch sub-warehouses (kitchen stores, barista stations, prep units) sit below projects. Items are shared across projects or isolated to one project, and stock is tracked at generic and brand-variant levels with strict expiry control. See proposal.md - Why for motivation.

## Goals / Non-Goals

**Goals:**
- Warehouse node model supporting PCW, GCW, branch sub-warehouses, and the in-transit node.
- Item scope enforcement (Project-Isolated vs Cross-Project Shared).
- Multi-brand hierarchy with stock at generic or variant level.
- FEFO picking and expiration alerting across all nodes.

**Non-Goals:**
- Physical warehouse management (bin locations, putaway optimization).
- Demand forecasting beyond ROP calculation.
- Cold-chain or temperature monitoring.

## Decisions

- **Hierarchical warehouse node model**: `warehouse` records with `type` (project_central, group_central, branch, transit) and `project_id` (nullable for group/transit). Rationale: mirrors the SRS topology table (PCW-FSH, GCW-01, FSH-KIT-01, TRN-99). Alternative: flat warehouse list — rejected because it cannot express project scope or the transit node.
- **Item scope as a hard constraint**: Project-Isolated items carry `project_id`; Cross-Project Shared items are visible to all projects. Enforcement happens in the catalog service, not just the UI. Rationale: prevents cross-project data leakage. Alternative: UI-only filtering — rejected as insecure.
- **Generic item + brand variant child records**: `item` (generic) with `item_brand_variant` children; stock ledger rows reference either level. Rationale: supports the SRS example (Full Cream Milk 1L with Juhayna/Dina-Farms/Lamar variants). Alternative: flat SKU list — rejected because it loses the generic/brand hierarchy.
- **FEFO as a picking engine rule**: Batch selection always orders by expiry date ascending; expired batches are blocked. Rationale: enforces the SRS requirement across all warehouses. Alternative: FIFO by receipt — rejected because it ignores expiry.
- **ROP as a per-warehouse calculation service**: Consumption velocity and vendor lead time feed a scheduled recalculation. Rationale: ROP differs per warehouse (project central vs branch). Alternative: single global ROP — rejected.

## Risks / Trade-offs

- [Shared items create cross-project contention] → Mitigation: group central warehouse as the shared stock pool with project-level allocations.
- [FEFO blocking may stall operations] → Mitigation: authorized override with audit trail for exceptional picks.
- [Brand variant proliferation] → Mitigation: variant records require a parent generic item; orphan variants are rejected.
- [Expiration alert noise] → Mitigation: tiered alerts with per-warehouse action routing.

## Migration Plan

1. Create the warehouse node hierarchy from the SRS topology table.
2. Import the item master with scope flags and brand variant records.
3. Load existing batch/lot data with expiry dates.
4. Enable FEFO picking and expiration alerts.
5. Calibrate ROP calculations with 90 days of consumption history.

## Open Questions

- Should branch sub-warehouses be able to hold Cross-Project Shared items directly, or only via their project central warehouse? Deferrable without spec impact.