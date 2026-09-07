## Context

The procure-to-pay cycle must support staggered deliveries (multiple GRNs per PO), partial invoice matching, and installment payments across project-isolated and group-consolidated requisitions. The inventory, finance, and analytics modules depend on procurement events. See proposal.md - Why for motivation.

## Goals / Non-Goals

**Goals:**
- Full P2P lifecycle with partial receiving and partial payment as first-class flows.
- DoA approval engine configurable per project, value, cost center, and item category.
- 3-way matching that prevents over-billing on partial deliveries.

**Non-Goals:**
- E-procurement marketplace or supplier bidding.
- Automated payment execution (bank integration deferred).
- Contract lifecycle management beyond price lists.

## Decisions

- **PO as the central document with GRN tranches**: A PO holds ordered quantity and status; each GRN references the PO and records a received tranche. Rationale: directly models the SRS's Ordered / Received-to-Date / Outstanding Balance tracking. Alternative: separate POs per delivery — rejected because it breaks the single PO contract.
- **Status state machine**: Open → Partially Received → Fully Received, with Force Closed as a terminal override. Rationale: explicit, auditable transitions. Alternative: free-form status — rejected for auditability.
- **3-way match at GRN tranche granularity**: Invoices match against specific GRN tranches, not the PO aggregate. Rationale: prevents over-billing while allowing partial approvals. Alternative: PO-level matching — rejected because it cannot handle partial invoices.
- **Landed cost as proportional allocation**: Freight/customs/clearance costs are apportioned across received quantities per shipment. Rationale: matches SRS requirement and keeps valuation accurate per tranche.
- **Event sourcing for P2P state**: PR/PO/GRN/invoice/payment events drive state and feed GL postings. Rationale: enables audit trail and downstream analytics without dual writes.

## Risks / Trade-offs

- [Complex state transitions on partial flows] → Mitigation: explicit state machine with validation rules and Force Closed override.
- [Over-billing on partial invoices] → Mitigation: tranche-level 3-way matching with hard quantity/price validation.
- [Landed cost misallocation] → Mitigation: allocation is proportional to received quantity and recalculated on each new GRN.
- [DoA rule conflicts across projects] → Mitigation: precedence rules (project scope > cost center > value) evaluated deterministically.

## Migration Plan

1. Deploy the P2P data model and state machine.
2. Migrate open POs from legacy records with received-to-date quantities.
3. Configure DoA rules per project and cost center.
4. Enable ROP-triggered requisitions after inventory ROP calculation is live.
5. Backfill AP balances from existing supplier ledgers.

## Open Questions

- Should Force Closed POs allow partial re-opening? Deferrable without spec impact.