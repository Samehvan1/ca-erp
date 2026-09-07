# Capital Agro ERP — Feature Inventory

Status tracking for the Capital Agro ERP (stock control & purchases) system.
Last updated: 2026-09-07.

## Stack

| Layer | Tech |
|---|---|
| Client | React 18 + Vite 6, TypeScript, react-router, plain CSS |
| Server | Express, TypeScript, Prisma ORM, PostgreSQL |
| Auth | JWT (Bearer), bcrypt, role-based access control |
| Tests | Vitest + supertest (server), 14 tests / 4 files |
| Workflow | OpenSpec (9 specs, all archived) |

## Architecture

- **Server** (`server/src/modules/`): 11 route modules + 7 libs
  - Modules: `auth`, `security`, `inventory`, `procurement`, `transfers`, `stocktaking`, `recipe`, `finance`, `supplier`, `analytics`, `dashboard`
  - Libs: `audit` (hash-chained trail), `stock` (FEFO/WAC), `gl` (double-entry), `reports` (7 generators), `scheduler` (scheduled reports), `errors`, `prisma`
- **Client** (`client/src/views/`): 12 views — Login, Dashboard, Inventory, Procurement, Transfers, Stocktaking, Recipes, Finance, Suppliers, Users, Reports, Audit
- **Shared client components** (`components.tsx`): `useApi`, `useListFilter` (dot-path search), `ListToolbar` (search + CSV export), `HistoryButton`/`HistoryModal` (per-record audit history), `Modal`, `Badge`, `ConfirmDialog`, `Toast`, `Empty`, `ErrorBanner`, `Loading`

## Developed Features

### 1. Security — RBAC + Audit Trail (`security`, `auth`)
- JWT login, password change/reset, 9 roles (ADMIN, CFO, GROUP_EXECUTIVE, PROCUREMENT_OFFICER, PROJECT_WAREHOUSE_MANAGER, BRANCH_MANAGER, HEAD_CHEF, HEAD_BARISTA, COST_CONTROLLER)
- Group/project access control (`requireGroupAccess`)
- **Hash-chained audit log**: every entry = sha256(prevHash + action + entityType + entityId + before/after JSON + ip + timestamp); `GET /security/audit/verify` recomputes the whole chain
- Audit filters: `entityType`, `entityId` (used by per-record history)
- Audit Trail view with chain-verify button, search, CSV export

### 2. Inventory — Multi-Warehouse, Multi-Brand (`inventory`)
- Warehouses, items (PROJECT_ISOLATED / CROSS_PROJECT scope), brand variants (SKU)
- Batches with FEFO picking, expiry alerts (≤30 days), stock movements
- Reorder points (ROP) with auto-requisition trigger
- Valuation: WAC (weighted avg cost) and FIFO; adjustments with approval
- Stock value / low-stock KPIs feed the dashboard

### 3. Procurement — Partial Receiving + Payments (`procurement`)
- Requisitions: manual + ROP-triggered, multi-level approval, consolidation
- Purchase orders (OPEN → PARTIALLY_RECEIVED → FULLY_RECEIVED / FORCE_CLOSED)
- GRNs with partial receiving and quarantine quantities
- Invoices (PENDING → PAID), payments (cash/credit/transfer), landed costs
- AP balance feeds the dashboard

### 4. Transfers — Inter-Warehouse (`transfers`)
- Transfer requisitions with approval workflow
- Transfer orders: DISPATCHED → IN_TRANSIT → RECEIVED lifecycle, cross-project support
- In-transit aging tracked on dashboard

### 5. Stocktaking (`stocktaking`)
- Stocktakes: SCHEDULED → IN_PROGRESS → COMPLETED
- Count entry, variance adjustments with approve/reject workflow

### 6. Recipe Costing + POS Integration (`recipe`)
- Recipes with versioning, menu mappings, ingredient costing
- POS transaction deductions (FEFO), waste logs with approval

### 7. Finance — GL + AP (`finance`)
- GL accounts, cost centers, double-entry journal postings (`lib/gl.ts`)
- AP ledger per vendor, supplier balances

### 8. Supplier Management (`supplier`)
- Vendors with approval workflow, vendor-item / vendor-brand-variant mappings
- Price lists, **SLA scorecard** (OTIF, price variance, QC rejection rate)

### 9. Analytics / BI (`analytics`, `lib/reports.ts`)
- 7 report generators (stock movements, customizations, etc.) via `REPORT_CODES`/`REPORT_ACCESS`
- Report snapshots (hash-chained), scheduled reports (`lib/scheduler.ts`)

### 10. Dashboard KPIs (P3a)
- `GET /dashboard/summary` → 8 KPIs: stock value (WAC), low-stock count, open POs, pending approvals, AP balance, expiring-soon batches, in-transit orders (+stale), pending stocktakes
- Dashboard view renders the KPI grid + in-transit aging + latest audit activity

### 11. Search / Filter / Export (P3b)
- `useListFilter` — client-side text filter with **dot-path keys** (e.g. `vendor.name`, `po.number`)
- `ListToolbar` — search box + CSV export (UTF-8 BOM, Excel-friendly), export disabled when no rows
- Applied to every table in all 11 data views

### 12. Version History (P3c)
- `HistoryButton` on every record row → `HistoryModal` fetching `/security/audit?entityType&entityId`
- Renders per-entry action badge, timestamp, user, hash, and before→after diff table

### 13. Template Document Fields (2026-09-07)
- **Item UOM**: `Item.uom` (default "Each") — shown on PO + Transfer lines
- **Warehouse address**: `Warehouse.address`/`city`/`country` (default "Egypt") — PO "Ship To", Transfer From/To
- **Vendor tax**: `Vendor.taxType`/`taxRate` — PO "Tax Type"
- **PO totals breakdown + createdBy**: `PurchaseOrder.subTotal`/`vatAmount`/`discountAmount`/`feesAmount` + `createdById` relation; `PurchaseOrderItem.taxPct`/`discountPct` per line. Server computes `subTotal = Σ(lineSubTotal)`, `vatAmount`, `discountAmount`, `feesAmount`, `totalValue = subTotal + vatAmount − discountAmount + feesAmount`
- **Transfer accepted qty + comments**: `TransferItem.acceptedQty` (defaults to `receivedQty` on receive) + `comments`
- Backward compatible — all new fields optional/defaulted; existing behavior unchanged
- Backfill script `server/prisma/backfill-template-fields.ts` populates nullable fields on existing records (warehouse address/city, vendor taxType)

## Quality / Reliability

- **Audit chain race fix** (2026-08-30): `audit()` writes serialized via promise queue — concurrent requests previously forked the chain (false "tampering" detection). Verified intact under 10 concurrent writes.
- **Template document fields** (2026-09-07): UOM, warehouse address, vendor tax, PO totals breakdown + createdBy, transfer acceptedQty/comments — see feature #13 above.
- **Tests**: 14 passing (api 5, stock 4, gl 3, audit 2) — `npm test` in `server/`
- **Type checks**: client + server `tsc --noEmit` clean; client production build passes
- **Docs**: `docs/deployment-security.md`, `docs/soc2-control-checklist.md`, `docs/slo-retention.md`, `docs/incident-response.md`

## Remaining / Not Done

### Testing & Quality
- [ ] No client-side tests (only server tests exist)
- [ ] No E2E test suite (browser flows verified manually via agent-browser)
- [ ] No CI/CD pipeline (lint/typecheck/test/build automation)
- [ ] No load/performance testing

### Deployment & Ops
- [ ] No production deployment — TLS/at-rest encryption docs exist but not applied
- [ ] No Docker/containerization or orchestration setup
- [ ] No environment config management (`.env` handling, secrets vault)
- [ ] No monitoring/alerting integration (SLO/incident docs are templates only)
- [ ] No backup automation beyond `scripts/backup.ps1` / `restore.ps1`

### Product Gaps (candidate backlog)
- [ ] No real POS integration — POS deductions are API-simulated
- [ ] No barcode scanning / mobile stocktaking app (spec named "mobile app" but implemented as web UI)
- [ ] No notifications (email/SMS) for approvals, ROP triggers, expiring batches
- [ ] No i18n/localization (UI is English-only)
- [ ] No multi-currency support (EGP only)
- [ ] No purchase order approval workflow (only requisitions have approvals)
- [ ] No supplier contract / purchase agreement management
- [ ] No batch traceability reports (lot genealogy)
- [ ] No user activity dashboard beyond raw audit trail
- [ ] No soft-delete / recycle bin for deleted records
- [ ] No pagination on large list endpoints (audit capped at 200, others unbounded)
- [ ] No rate limiting on auth endpoints (brute-force protection)
- [ ] No refresh-token rotation (single JWT with 12h expiry)

### OpenSpec
- [ ] All 9 changes archived; no active changes. New work should start via `openspec-new-change` / `openspec-propose`