# SOC 2 Readiness — Control Checklist

Capital Agro Holding — Enterprise Stock Control & Purchases System
Assessment date: 2026-08-30 · Scope: Trust Services Criteria (TSC) — Security, Availability, Confidentiality

Legend: ✅ Implemented in code · 🟡 Partially implemented (deployment-level) · ⬜ Not yet implemented

## CC Series — Common Criteria (Security)

| Control | Status | Evidence / Implementation |
|---|---|---|
| CC1.1 Board/management establishes tone regarding integrity | 🟡 | Admin role separation; group executive oversight of consolidated views |
| CC2.1 Information system objectives linked to entity objectives | ✅ | 9 SRS modules mapped to OpenSpec changes; module routers per domain |
| CC3.1 Management establishes realistic plans to meet objectives | ✅ | OpenSpec change workflow with tasks.md per module |
| CC4.1 Policies regarding integrity, ethical values | 🟡 | Role-based access policy documented in RBAC middleware |
| CC5.1 Entity selects and develops control activities | ✅ | `requireRole`, `requireGroupAccess`, `scopeWhere` in `server/src/middleware/rbac.ts` |
| CC5.2 Entity also selects and develops general control activities | ✅ | Centralized error handler, zod input validation on every route |
| CC5.3 Entity deploys control activities through policies | ✅ | Route-level `requireRole` on all mutating endpoints |
| CC6.1 Entity restricts access to authorized users | ✅ | JWT auth (`requireAuth`), bcrypt password hashing, per-route roles |
| CC6.2 Users are identified and authenticated | ✅ | `POST /auth/login` issues signed JWT; password hashes never returned; change/forgot/reset password flow (`/auth/change-password`, `/forgot-password`, `/reset-password`) with hash-only reset tokens |
| CC6.3 Entity restricts access to authorized roles | ✅ | 8 roles enforced; `REPORT_ACCESS` map restricts financial reports |
| CC6.4 Entity restricts physical access | 🟡 | Deployment-level (cloud provider IAM) |
| CC6.5 Entity restricts logical access to assets | ✅ | Project data isolation: `scopeWhere` + `canAccessProject` |
| CC6.6 Entity restricts access to information via authorization | ✅ | Cross-project queries return no data (verified in E2E + api tests) |
| CC6.7 Entity restricts access to non-essential functions | ✅ | Group roles only for user management (`requireGroupAccess`) |
| CC7.1 Entity detects and responds to security events | ✅ | Audit log captures user, IP, action, before/after for all mutations; rate limiting on `/auth/login` (10/15 min, failures only) + API surface (600/15 min); password reset tokens expire in 1 h |
| CC7.2 Entity analyzes and communicates security events | 🟡 | Deployment-level (SIEM integration); audit chain verification endpoint `GET /security/audit/verify` |
| CC7.3 Entity evaluates and responds to security events | ✅ | Incident response runbook in `docs/incident-response.md` (S1–S3 severities, escalation path) |
| CC7.4 Entity identifies and responds to incidents | ✅ | Runbook + post-incident checklist; audit trail records all response actions |
| CC8.1 Entity protects against malicious software | 🟡 | `helmet` headers active; dependency scanning in CI (`npm audit --audit-level=high`, 0 vulnerabilities in both workspaces) |
| CC9.1 Entity restricts business information use | ✅ | Project-scoped data access; audit trail of all reads of sensitive reports |

## A Series — Availability

| Control | Status | Evidence / Implementation |
|---|---|---|
| A1.1 Entity maintains availability for normal operations | ✅ | Stateless API (JWT) — horizontally scalable; PostgreSQL via `DATABASE_URL`; automated backup/restore scripts (`npm run db:backup` / `db:restore`, pg_dump custom format, 14-backup retention) |
| A1.2 Entity evaluates availability commitments | ✅ | SLOs + error budget in `docs/slo-retention.md` (99.5% availability, per-service targets) |
| A1.3 Entity monitors availability | ✅ | `/health` endpoint; morgan request logging; scheduler job logging (`[scheduler]` lines); SLO alerting thresholds documented |

## C Series — Confidentiality

| Control | Status | Evidence / Implementation |
|---|---|---|
| C1.1 Entity identifies and maintains confidential information | ✅ | Supplier AP, cost data restricted to ADMIN/CFO/COST_CONTROLLER |
| C1.2 Entity disposes of confidential information | ✅ | Retention policy in `docs/slo-retention.md` (per-data-class retention + disposition); password reset tokens auto-expire in 1 h |

## Additional Technical Controls (mapped to SRS Security module)

| Control | Status | Evidence / Implementation |
|---|---|---|
| TLS 1.3 transport encryption | 🟡 | Config template in `docs/deployment-security.md`; app is TLS-termination ready |
| AES-256 at-rest encryption | 🟡 | Config template in `docs/deployment-security.md`; DB-agnostic schema |
| Immutable audit trail | ✅ | Hash-chained `AuditLog`; `verifyAuditChain()` detects tampering (tested) |
| Tamper evidence | ✅ | `tests/audit.test.ts` — tampering `after` field breaks chain |
| Password storage | ✅ | bcrypt (cost 10); never returned by API |
| Session integrity | ✅ | Signed JWT (HS256); token in `Authorization: Bearer` |
| Input validation | ✅ | zod schemas on all 90+ routes |
| Data isolation | ✅ | `tests/api.test.ts` — BRANCH_MANAGER sees only own project |
| Role-based report access | ✅ | `REPORT_ACCESS` — verified BRANCH_MANAGER denied SUPPLIER-AP |
| Rate limiting (credential stuffing) | ✅ | `express-rate-limit` — 10 failed logins / 15 min on `/auth/login` (`skipSuccessfulRequests`), 600 req / 15 min on `/api/v1`; verified 429 on 12th failure |
| Password reset security | ✅ | 32-byte random token, stored as SHA-256 hash only, 1 h expiry, no user enumeration, single-use (transaction) |
| Scheduled jobs (availability) | ✅ | `src/lib/scheduler.ts` — report delivery, expiration alerts (60/30/15/7-day tiers), ROP recalculation, daily ABC cycle counts; 5-min tick, idempotent, `DISABLE_SCHEDULER` opt-out |
| Backup & restore | ✅ | `server/scripts/backup.ps1` + `restore.ps1`; tested end-to-end (dump → restore → row count) |

## Verification commands

```bash
# Audit chain integrity (runtime)
curl -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/v1/security/audit/verify
# → {"intact": true}

# Test suite (includes tamper detection, RBAC, isolation)
cd server && npx vitest run
# → 14 tests passing

# OpenSpec validation
npx openspec validate --all --strict
```

## Gaps to close before formal SOC 2 audit

1. Deploy behind TLS 1.3-terminating load balancer / reverse proxy (see `docs/deployment-security.md`)
2. Enable AES-256 at-rest encryption on the database volume and backups
3. Add SIEM log shipping for the audit trail (audit chain verification endpoint is ready: `GET /security/audit/verify`)
4. Schedule automated backups (cron/CI) — script is ready (`npm run db:backup`), retention 14 daily + 12 monthly
5. Archive audit logs to immutable/append-only storage (7-year retention per `docs/slo-retention.md`)