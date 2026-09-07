## Context

Capital Agro Holding operates three F&B brands (Fanshy, Osta Rosto, Spacca) plus optional group-level warehouses, each with existing POS systems and independent procurement practices. There is currently no unified vendor master; supplier relationships exist informally at both generic-item and brand-variant levels. See proposal.md - Why for motivation.

## Goals / Non-Goals

**Goals:**
- Single vendor master shared across all projects with dual-level supplier mapping.
- Effective-dated, versioned price lists per supplier and brand variant.
- Automated SLA scorecard computation from procurement and GRN events.

**Non-Goals:**
- Supplier self-service portal (deferred).
- Contract negotiation or e-sourcing workflows.
- Vendor payment execution (handled by finance module).

## Decisions

- **Normalized vendor-item-brand mapping tables**: A `vendor` table plus `vendor_item` (generic level) and `vendor_brand_variant` (variant level) link tables. Rationale: supports the SRS dual-level mapping directly and avoids denormalized supplier lists on items. Alternative considered: embedding supplier arrays on item records — rejected because it cannot express exclusive brand-variant distributorships.
- **Effective-dated price lists**: Price list entries carry `valid_from`/`valid_to`, MOQ, and tiered discount rows. Rationale: enables historical pricing for landed cost and variance analysis. Alternative: overwriting current price — rejected because it loses audit history.
- **Event-driven SLA computation**: SLA metrics (OTIF, price variance, QC rejection, document accuracy) are computed from procurement/GRN events rather than periodic batch jobs. Rationale: real-time scorecards with no separate ETL. Alternative: nightly batch — rejected for staleness.
- **Shared data model with procurement module**: Vendor and price data are owned by this capability and consumed via service API by procurement. Rationale: avoids duplicate vendor records across modules.

## Risks / Trade-offs

- [Duplicate vendor records across projects] → Mitigation: group-level vendor registry with project-level visibility flags.
- [Price list drift vs negotiated contracts] → Mitigation: effective-date validation on PO pricing and price variance flags on the scorecard.
- [SLA scorecard gaming by vendors] → Mitigation: scorecard inputs are derived only from immutable GRN/invoice events.

## Migration Plan

1. Load existing vendor spreadsheets into the vendor master with a data import task.
2. Map existing supplier-item relationships to the dual-level mapping tables.
3. Import current contracted price lists with effective dates.
4. Backfill SLA scorecards from the last 90 days of GRN/invoice history where available.

## Open Questions

- Should vendor banking data be masked by role (e.g., only AP and CFO see full IBAN)? This can be decided during implementation without changing the spec.