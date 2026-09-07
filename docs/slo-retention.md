# Service Level Objectives & Data Retention

## Service Level Objectives (SLOs)

Measured monthly. Target: **99.5% availability** (≈ 3.6 h downtime/month allowed).

| Service | SLO | Measurement |
|---------|-----|-------------|
| API availability | 99.5% | `/health` 200 responses / total probes |
| Login (P95) | < 500 ms | server-side timing on `/auth/login` |
| Read endpoints (P95) | < 300 ms | morgan response time, excluding reports |
| Scheduled reports | 99% delivered on time | `ReportSnapshot` created within 5 min of due time |
| Expiration alerts | 99% within tier window | `ExpirationAlert` created ≤ 24 h before tier expiry |
| POS sales sync | 99% processed < 1 min | `PosTransaction` BUFFERED → PROCESSED latency |
| Backup success | 100% of scheduled runs | backup script exit code + file presence |

### Error budget

- 0.5% monthly error budget ≈ 3.6 h. Exhausting the budget freezes non-critical deploys until the following month.
- SLO breaches trigger an S2 incident and a post-incident review.

## Scheduled jobs (operational SLOs)

| Job | Cadence | Due check | Idempotency |
|-----|---------|-----------|-------------|
| Report delivery | daily/weekly/monthly per schedule | last `ReportSnapshot` per schedule | skip if snapshot exists for period |
| Expiration alerts | 5-min tick | tiers 60/30/15/7 days | one ACTIVE alert per batch+tier |
| ROP recalculation | 5-min tick | 30-day consumption velocity | recompute is deterministic |
| Cycle counts | daily A/B/C rotation | one class per day | skip if class already counted today |

## Data retention policy

| Data class | Retention | Disposition |
|------------|-----------|-------------|
| Audit log (tamper-evident chain) | 7 years | archive to immutable/SIEM storage; never delete from chain |
| GL postings / AP ledger | 7 years (statutory) | archive; read-only |
| Purchase orders / GRNs / invoices | 7 years | archive |
| Stock ledger (batch history) | 5 years | archive |
| POS transactions | 3 years | archive |
| Password reset tokens | 1 h (expiry) | auto-expire; hash-only storage |
| Expiration alerts | 2 years | archive |
| Scheduled report snapshots | 2 years | archive |
| Backups | 14 daily (rolling) + 12 monthly | offsite encrypted copy (AES-256) |
| Server logs (morgan) | 90 days | rotate; ship to SIEM |
| Session tokens (JWT) | 8 h (expiry) | stateless; no server storage |

### Backup schedule

- **Daily**: `npm run db:backup` (custom-format pg_dump, compressed) — keep 14.
- **Monthly**: promote one daily backup to monthly archive — keep 12.
- **Restore test**: quarterly, restore latest backup to scratch DB and verify row counts + audit chain.
- **Encryption**: backups encrypted at rest (AES-256); offsite copies via `gpg --symmetric --cipher-algo AES256`.

## Monitoring & alerting

- `/health` probe every 60 s (external uptime check).
- Alert on: SLO breach, backup failure, scheduler job failure (log line `[scheduler] ERROR`), rate-limit exhaustion (429 rate > 1% of requests), audit chain verification failure.
- SIEM: ship audit logs + auth failures (401/429 on `/auth/login`) to immutable storage.