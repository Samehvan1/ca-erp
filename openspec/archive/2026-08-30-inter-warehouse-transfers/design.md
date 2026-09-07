## Context

Stock moves between outlets, project central warehouses, and the optional group central warehouse, including cross-project borrowing. The SRS defines a virtual In-Transit node (TRN-99) and requires automated inter-company cost accounting and discrepancy loss allocation. See proposal.md - Why for motivation.

## Goals / Non-Goals

**Goals:**
- Formal transfer workflow: requisition → approval → dispatch → in-transit → receipt.
- Cross-project transfers with automated inter-company accounting.
- Discrepancy and transit loss allocation with configurable responsibility rules.

**Non-Goals:**
- Third-party logistics (3PL) integration or carrier tracking.
- Route optimization or delivery scheduling.
- Physical transport management.

## Decisions

- **Transfer as a document chain**: `transfer_requisition` → `transfer_order` → `transfer_dispatch` → `transfer_receipt`. Rationale: mirrors the procurement document chain and keeps each stage auditable. Alternative: single transfer document — rejected because it cannot represent in-transit state.
- **In-transit as a real ledger node**: Dispatched stock moves to the TRN-99 node with the sending warehouse as financial owner. Rationale: matches the SRS requirement that financial ownership remains tracked until destination receipt. Alternative: flag on the transfer record only — rejected because it breaks stock ledger continuity.
- **Inter-company pricing at sending warehouse cost**: Cross-project transfers value stock at the sending warehouse's cost and generate inter-company charge entries. Rationale: simple, auditable, and matches the SRS. Alternative: transfer price with markup — rejected as out of scope.
- **Configurable loss allocation rules**: Discrepancy responsibility (sending warehouse, receiving branch, or logistics transport) is configurable per transfer type. Rationale: the SRS requires auto-assignment without prescribing a single rule. Alternative: hard-coded allocation — rejected for inflexibility.

## Risks / Trade-offs

- [In-transit stock is invisible to normal operations] → Mitigation: dedicated in-transit views and aging alerts for stale transfers.
- [Inter-company disputes on valuation] → Mitigation: valuation at sending cost is deterministic and auditable.
- [Discrepancy disputes] → Mitigation: discrepancy records capture expected vs actual quantities and the allocation rule applied.

## Migration Plan

1. Deploy the transfer document chain and in-transit node.
2. Configure inter-company cost centers per project pair.
3. Configure loss allocation rules per transfer type.
4. Migrate open in-transit shipments from legacy records.

## Open Questions

- Should cross-project transfers require group-level approval above a value threshold? Deferrable without spec impact.