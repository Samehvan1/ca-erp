## Context

The system spans multiple independent business units with isolated P&L ledgers and project-specific data. Every transactional module (procurement, inventory, transfers, recipe costing, stocktaking, finance, analytics) must enforce role-based access, project data isolation, and immutable audit logging, and the deployment must meet TLS 1.3, AES-256, and SOC2 expectations. See proposal.md - Why for motivation.

## Goals / Non-Goals

**Goals:**
- Granular RBAC with the SRS-defined roles.
- Project data isolation enforced at the data layer, not just the UI.
- Immutable, tamper-evident audit trail across all modules.
- TLS 1.3, AES-256 at rest, SOC2-aligned controls.

**Non-Goals:**
- External identity provider (SSO/SAML/OIDC) integration (deferred).
- Physical security or data residency certification.
- Penetration testing program (operational, not build-time).

## Decisions

- **Centralized authorization service**: All modules check permissions through a single authorization service rather than embedding role checks per module. Rationale: consistent enforcement and a single place to audit. Alternative: per-module checks — rejected for inconsistency.
- **Data isolation via tenant scoping**: Every query carries a project/warehouse scope derived from the authenticated principal; the data layer filters by scope. Rationale: prevents cross-project leakage even if a UI bug exposes data. Alternative: UI-level filtering — rejected as insecure.
- **Append-only audit log with hash chaining**: Audit entries are append-only with a hash chain for tamper evidence. Rationale: the SRS requires an immutable trail with before/after values. Alternative: mutable log table — rejected.
- **Encryption at the platform layer**: TLS 1.3 terminated at the load balancer; AES-256 at rest via storage encryption. Rationale: standard, auditable approach. Alternative: application-level encryption — rejected for complexity and key management burden.

## Risks / Trade-offs

- [Centralized auth becomes a bottleneck] → Mitigation: cached permission sets with short TTL and a fast authorization path.
- [Hash-chained audit log performance] → Mitigation: batched chaining with periodic anchor points.
- [Tenant scoping bugs] → Mitigation: automated cross-tenant access tests in CI.

## Migration Plan

1. Deploy the authorization service and role definitions.
2. Add tenant scoping to all data access paths.
3. Enable the append-only audit log across modules.
4. Configure TLS 1.3 and at-rest encryption on the deployment platform.
5. Run a SOC2 readiness assessment.

## Open Questions

- Should roles be extendable per project (custom roles) or fixed to the SRS list? Deferrable without spec impact.