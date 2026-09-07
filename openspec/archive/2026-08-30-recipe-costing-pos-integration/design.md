## Context

Fanshy, Osta Rosto, and Spacca run pre-existing, independently developed POS systems that must connect to a central inventory engine without replacement. Recipe costing must reflect actual ingredient brands, yields, and shrinkage, and variance analysis must compare theoretical vs actual consumption. See proposal.md - Why for motivation.

## Goals / Non-Goals

**Goals:**
- Agnostic POS integration middleware with offline buffering and replay.
- Multi-level recipe/BOM management with yield factors.
- Real-time WAC-based recipe costing.
- Theoretical vs actual variance analysis and waste logging.

**Non-Goals:**
- Replacing or modifying third-party POS software.
- Menu engineering or pricing recommendations.
- Kitchen display system (KDS) integration.

## Decisions

- **Agnostic REST/webhook middleware with SKU translation**: POS systems push sales payloads to `/api/v1/pos/sales-sync`; the middleware translates POS SKUs to central SKUs via `/api/v1/pos/menu-mapping`. Rationale: the SRS explicitly requires this architecture. Alternative: per-POS adapters — rejected because it couples the system to each POS vendor.
- **Outbox pattern for offline buffering**: POS terminals buffer transactions locally and replay them on reconnect; the server accepts idempotent payloads with transaction IDs. Rationale: guarantees no data loss and no double deduction. Alternative: server-side polling — rejected because POS terminals may be offline for extended periods.
- **Recipe tree with sub-recipes**: Menu items reference prep sub-recipes (sauces, marinades, roasted blends) which reference ingredients. Rationale: matches the SRS multi-level BOM requirement. Alternative: flat ingredient lists — rejected because it cannot model prep stages.
- **Yield factors as recipe attributes**: Butchery loss %, cooking shrinkage, and roasting shrinkage are stored per recipe step and applied to output quantities. Rationale: the SRS requires these factors explicitly. Alternative: manual output quantities — rejected because it loses shrinkage visibility.
- **WAC-driven costing service**: Recipe cost is computed from the WAC of specified ingredient brands, recalculated on WAC changes. Rationale: the SRS requires real-time recalculation. Alternative: periodic cost refresh — rejected for staleness.
- **Variance engine**: Theoretical usage = POS sales × BOM recipe; compared against physical counts from stocktaking. Rationale: the SRS defines this comparison explicitly.

## Risks / Trade-offs

- [POS payload format variance across vendors] → Mitigation: schema validation with per-POS field mapping and clear rejection errors.
- [Offline replay causing double deduction] → Mitigation: idempotent transaction IDs and deduplication on the server.
- [Recipe cost volatility from WAC changes] → Mitigation: cost history snapshots for variance analysis.
- [Yield factor misuse] → Mitigation: yield factors are validated ranges per item category.

## Migration Plan

1. Deploy the POS middleware endpoints and SKU mapping tables.
2. Import existing POS menu mappings for Fanshy, Osta Rosto, and Spacca.
3. Build the recipe/BOM tree from current menu recipes.
4. Configure yield factors per item category.
5. Enable offline buffering on POS terminals incrementally.
6. Calibrate variance tolerances with 30 days of data.

## Open Questions

- Should POS sales payloads include employee/table identifiers for deeper analytics? Deferrable without spec impact.