## Context

The system spans a multi-entity structure (Holding, Project/Brand, Warehouse/Branch) and must post stock movements, partial deliveries, POS sales, and waste to the general ledger automatically, with correct valuation and supplier payables tracking partial invoices and installments. See proposal.md - Why for motivation.

## Goals / Non-Goals

**Goals:**
- Real-time automated GL postings from transactional events.
- AP ledger with partial invoices, advances, milestones, and retainage.
- Perpetual WAC and FIFO valuation.
- Cost center accounting at Holding, Project, and Warehouse levels.

**Non-Goals:**
- Full general ledger / ERP replacement (integration with an external GL is expected).
- Tax compliance filings.
- Treasury or cash management.

## Decisions

- **Event-driven GL posting engine**: GRN, POS deduction, waste, and payment events produce GL entries via a posting service. Rationale: the SRS requires real-time posting. Alternative: nightly batch posting — rejected for staleness.
- **Posting to an external GL via integration**: The system generates posting payloads for an external ERP/GL rather than hosting the full ledger. Rationale: Capital Agro Holding likely runs an existing accounting system; this module is the integration layer. Alternative: embedded GL — rejected as a larger scope than the SRS requires.
- **Perpetual WAC with FIFO option**: Valuation is configurable per item; WAC recalculates on receipt, FIFO consumes earliest batches. Rationale: the SRS requires both methods. Alternative: single method — rejected.
- **Cost center hierarchy mirroring the tenant model**: Cost centers are keyed by Holding → Project → Warehouse/Branch. Rationale: the SRS requires segregated P&L and asset tracking at all three levels. Alternative: flat cost centers — rejected.
- **AP ledger as the source of truth for supplier balances**: Partial invoices, advances, milestones, and retainage all post to the AP ledger. Rationale: the SRS requires clear supplier credit ledgers. Alternative: deriving balances from POs — rejected because it cannot represent payments.

## Risks / Trade-offs

- [GL integration mismatches] → Mitigation: posting payload contract with validation and retry; reconciliation reports.
- [WAC vs FIFO inconsistency across modules] → Mitigation: valuation method is enforced per item and consumed consistently by costing and reporting.
- [Double posting on event replay] → Mitigation: idempotent posting keys per source event.

## Migration Plan

1. Define the cost center hierarchy and chart of accounts mapping.
2. Deploy the GL posting engine with idempotent event consumption.
3. Configure valuation methods per item.
4. Migrate AP balances from existing supplier ledgers.
5. Run parallel reconciliation with the existing accounting system before cutover.

## Open Questions

- Which external GL/ERP will receive postings (e.g., Odoo, SAP, Oracle)? Deferrable until implementation, as the posting contract is GL-agnostic.