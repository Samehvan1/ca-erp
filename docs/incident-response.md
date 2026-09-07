# Incident Response Runbook

Severity-graded response procedures for Capital Agro ERP. Roles: **On-call Engineer (OCE)**, **Security Lead**, **DB Admin**, **Communications Lead**.

## Severity definitions

| Sev | Impact | Response time | Example |
|-----|--------|---------------|---------|
| S1 | Production down / data loss / breach | 15 min | API unavailable, DB corruption, unauthorized access |
| S2 | Major feature degraded, no workaround | 2 h | Scheduled reports not delivering, POS sync failing |
| S3 | Minor issue, workaround exists | 1 business day | Cosmetic UI bug, non-critical report delay |

## S1 — Critical

1. **Declare**: OCE pages Security Lead + DB Admin; open incident channel; start timer.
2. **Contain**:
   - Suspected breach → rotate `JWT_SECRET`, revoke sessions (bump token version), disable affected users.
   - DB issue → fail over to replica or restore latest backup (`npm run db:restore`).
   - API down → check `/health`, restart service, review `server.log` tail.
3. **Assess**: 
   - Verify audit chain integrity: `GET /api/v1/security/audit/verify` (must be `{"intact":true}`).
   - Check rate-limit counters and auth logs for credential stuffing.
   - Check scheduler log lines for job failures (expiration alerts, ROP, cycle counts).
4. **Mitigate**: apply hotfix behind feature flag or roll back to last known-good build.
5. **Recover**: restore service, confirm `/health` + login + one write path (e.g., GRN).
6. **Post-incident (within 5 business days)**: root-cause analysis, timeline, evidence preserved, corrective actions tracked to closure.

## S2 — Major

1. OCE triages within 2 h; escalate to S1 if blast radius grows.
2. Common S2 playbooks:
   - **Scheduled reports not delivered**: verify scheduler tick in logs (`runDueReports`), check `ReportSnapshot` rows, confirm SMTP hook configured.
   - **Expiration alerts missing**: check `ExpirationAlert` ACTIVE rows and tier thresholds (60/30/15/7).
   - **POS sync failing**: check `PosTransaction` BUFFERED rows; replay is idempotent by `transactionId`.
   - **Rate limiting false positives**: confirm `skipSuccessfulRequests` behavior; raise `apiLimiter` limit if legitimate traffic exceeds 600/15 min.
3. Communicate status to stakeholders; no data loss expected.

## S3 — Minor

1. Log ticket with repro steps; fix in normal cycle.
2. No paging; no comms required.

## Communication

- S1: status update every 30 min to stakeholders; final summary within 24 h.
- S2: update at resolution.
- All incidents logged in the audit trail (entity `Incident`, action `CREATE`/`UPDATE`) for SOC2 evidence.

## Escalation path

OCE → Security Lead → DB Admin → Group Executive. If no response in 10 min (S1), escalate one level up.

## Post-incident checklist

- [ ] Root cause identified and documented
- [ ] Audit chain re-verified intact
- [ ] Backups verified restorable (test restore on scratch DB)
- [ ] Corrective action owner + due date assigned
- [ ] Runbook updated with lessons learned