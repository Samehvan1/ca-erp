## Why

The system spans multiple independent business units with isolated P&L ledgers and project-specific data. Branch and project managers must only access their own project/warehouse data while group executives see consolidated views, and every stock movement, PO update, or recipe change must be traceable for audit and SOC2 compliance.

## What Changes

- Add granular Role-Based Access Control (RBAC) with predefined roles: Procurement Officers, Project Warehouse Managers, Branch Managers, Head Chefs, Head Baristas, Cost Controllers, and CFO.
- Add project data isolation: branch/project managers access only their project/warehouse data; group executives access consolidated holding views.
- Add an immutable audit trail: full transaction log recording user ID, timestamp, IP address, and before/after values for every stock movement, PO update, or recipe change.
- Enforce security standards: HTTPS TLS 1.3, AES-256 at rest, and SOC2 compliance.

## Capabilities

### New Capabilities
- `security`: Role-based access control, project data isolation, immutable audit trail, and transport/at-rest encryption compliance.

### Modified Capabilities
- (none — no existing specs)

## Impact

- RBAC and data isolation apply across all modules (procurement, inventory, transfers, recipe costing, stocktaking, finance, analytics).
- Audit trail events are emitted by every transactional module.
- Encryption and compliance requirements affect deployment infrastructure and API design.