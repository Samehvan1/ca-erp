# Session Handoff — Capital Agro ERP

Handoff for the next session. Last updated: 2026-09-07.

## Current State

**All planned work is complete.** The OpenSpec lifecycle finished (9 specs validated, 9 changes archived), P3 enhancements (dashboard KPIs, search/filter/export, version history) are implemented, and the **Template Document Fields** feature (UOM, warehouse address, vendor tax, PO totals breakdown + createdBy, transfer acceptedQty/comments) is implemented, type-checked, built, and verified. The audit-chain race condition was found and fixed.

## How to Run

```powershell
# Server (port 4000) — from server/
npx tsx watch src/index.ts

# Client (port 5173, proxies /api → :4000) — from client/
npm run dev

# Tests (server) — 14 tests, 4 files, all passing
npm test

# Type checks
npx tsc --noEmit   # in both server/ and client/

# Client production build
npm run build      # in client/
```

Seed credentials: `admin@capitalagro.com` / `Admin@123` (see `server/prisma/seed.ts` for all roles).

## What Was Done This Session

### P3 Enhancements (all complete)
1. **P3a — Dashboard KPIs**
   - New `server/src/modules/dashboard/routes.ts`: `GET /dashboard/summary` → 8 KPIs (stock value WAC, low stock, open POs, pending approvals, AP balance, expiring ≤30d, in-transit + stale, pending stocktakes)
   - `client/src/views/Dashboard.tsx` rebuilt as 8-card KPI grid
2. **P3b — Search / filter / export**
   - `client/src/components.tsx`: `useListFilter` (dot-path keys via `getPath`), `ListToolbar` (search + CSV export with BOM), `ExportColumn`
   - Applied to all tables in all 11 data views (Procurement finished last — 5 tabs)
3. **P3c — Version history**
   - `server/src/modules/security/routes.ts`: audit endpoint accepts `entityType`/`entityId` filters
   - `HistoryButton`/`HistoryModal` on every record row (19 buttons across views, all entityType strings verified against server `audit()` calls)

### Audit Chain Race Fix (important)
- **Symptom**: "Verify chain integrity" reported `CHAIN BROKEN — tampering detected`
- **Root cause**: NOT tampering — `audit()` did `findFirst` + `create` non-atomically; concurrent requests read the same last entry and forked the chain (3 of 58 entries had stale `prevHash`)
- **Fix**: `server/src/lib/audit.ts` — writes serialized through a promise queue (`writeQueue`); `audit()` now returns `Promise<unknown>` (no caller uses the return value — verified)
- **Repair**: recomputed broken links (cascade to 33 entries); chain verified intact; stress-tested with 10 concurrent logins; DB restored to 58 entries
- **Note**: the mutex is in-process only — if the server ever runs multi-process (PM2 cluster), it needs a DB-level lock (`SELECT … FOR UPDATE` in a transaction)

### Template Document Fields (complete)
- **Schema** (`server/prisma/schema.prisma`): `Item.uom`; `Warehouse.address/city/country`; `Vendor.taxType/taxRate`; `PurchaseOrder.subTotal/vatAmount/discountAmount/feesAmount/createdById`; `PurchaseOrderItem.taxPct/discountPct`; `TransferItem.acceptedQty/comments`. Applied via `npx prisma db push` (no migration files).
- **Relation fix**: disambiguated `User`→`PurchaseOrder` with relation names `"ApprovedBy"`/`"CreatedBy"` (fixed P1012 ambiguous-relation error).
- **Server routes**: `inventory` (uom + warehouse address), `supplier` (taxType/taxRate), `procurement` (per-line tax/discount, fees/discount, `createdById`, server-computed totals breakdown), `transfers` (acceptedQty defaults to receivedQty + comments).
- **Client UI**: `Inventory.tsx`, `Suppliers.tsx`, `Procurement.tsx` (totals breakdown + Created By column), `Transfers.tsx` (accepted qty + comments).
- **Seed/backfill**: `seed.ts` updated for fresh DBs; `server/prisma/backfill-template-fields.ts` backfills nullable fields on existing records (7 warehouses, 8 vendors updated).
- **Note**: the seed is NOT fully idempotent — `createMany` for vendor-item mappings / price lists / recipes / batches / reorder points fails on a populated DB. Use the backfill script instead of re-running the seed on existing data.

## Key Files

| Area | Files |
|---|---|
| Server routes | `server/src/modules/{auth,security,inventory,procurement,transfers,stocktaking,recipe,finance,supplier,analytics,dashboard}/routes.ts` |
| Server libs | `server/src/lib/{audit,stock,gl,reports,scheduler,errors,prisma}.ts` |
| Client views | `client/src/views/*.tsx` (12 views) |
| Shared components | `client/src/components.tsx` (useApi, useListFilter, ListToolbar, HistoryButton/Modal, etc.) |
| Styles | `client/src/styles.css` (`.list-toolbar`, `.history-*`, KPI classes) |
| Schema/seed | `server/prisma/schema.prisma`, `server/prisma/seed.ts`, `server/prisma/backfill-template-fields.ts` |
| Tests | `server/tests/{api,stock,gl,audit}.test.ts` |
| Specs | `openspec/specs/*/spec.md` (9 main specs), `openspec/archive/2026-08-30-*` (9 archived changes) |
| Docs | `docs/{deployment-security,soc2-control-checklist,slo-retention,incident-response}.md`, `FEATURES.md` |

## Environment Notes

- **Windows / PowerShell**: quote `@eN` refs in agent-browser commands (`agent-browser click "@e9"`); `fill ""` does NOT fire React onChange (use `press Control+a` + `press Backspace` to clear inputs)
- **agent-browser**: auto-launch fails on this machine — start Chrome manually with `--remote-debugging-port=9222 --user-data-dir=...`, then `agent-browser connect 9222`
- **`task` tool is broken** (all calls Error) — use `subtask` for delegation or work directly
- **Not a git repo** — no version control; be careful with destructive edits
- **`openspec archive` CLI is irreversible** — archive via PowerShell `Move-Item` if needed
- **DB cleanliness**: browser/API verification creates audit LOGIN entries — delete test entries after checks (tail deletion keeps chain valid)
- **Seed is not idempotent**: re-running `seed.ts` on a populated DB fails on `createMany` (vendor-item mappings, price lists, recipes, batches, reorder points). To populate new fields on existing data, run `npx tsx prisma/backfill-template-fields.ts` instead.
- Server runs via `tsx watch` (auto-reloads on edit); health check at `http://localhost:4000/health`

## Suggested Next Steps (in priority order)

1. **Ask the user what's next** — all planned work is done. Candidate directions:
   - **Product backlog** (see FEATURES.md "Remaining"): notifications, PO approvals, barcode/mobile stocktaking, multi-currency, pagination, rate limiting
   - **Quality**: client tests, E2E suite, CI/CD pipeline
   - **Deployment**: Docker + production config (TLS docs already written)
2. If starting new work, use the OpenSpec workflow: `openspec-new-change` → propose → apply → verify → archive
3. If the user reports "CHAIN BROKEN" again: run the chain diagnostic (recompute hashes in id order, find mismatches) — if `prevHash` mismatches are the cause, the race fix should have prevented new ones; check for multiple server processes first

## Open Questions for User

- Priority for the next phase: product features vs. quality/CI vs. deployment?
- Is the POS integration real (external system) or will it stay simulated?
- Should the stocktaking "mobile app" become an actual mobile client, or is the responsive web UI sufficient?
- Any production timeline / hosting target (affects Docker, secrets, monitoring work)?