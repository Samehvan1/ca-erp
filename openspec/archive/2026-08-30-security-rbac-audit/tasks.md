## 1. Authentication & RBAC

- [x] 1.1 Implement authentication and verify login/logout integration tests pass
- [x] 1.2 Create the role definitions (Procurement Officer, Project Warehouse Manager, Branch Manager, Head Chef, Head Barista, Cost Controller, CFO) and verify role seed tests pass
- [x] 1.3 Implement the centralized authorization service and verify permission enforcement tests pass across modules

## 2. Project Data Isolation

- [x] 2.1 Implement tenant scoping in the data access layer and verify cross-project queries return no data
- [x] 2.2 Implement group executive consolidated views and verify consolidation tests pass
- [x] 2.3 Add automated cross-tenant access tests to CI and verify they run in the pipeline

## 3. Audit Trail

- [x] 3.1 Implement the append-only audit log with user ID, timestamp, IP, and before/after values and verify entry capture tests pass
- [x] 3.2 Implement hash chaining for tamper evidence and verify tamper detection tests pass
- [x] 3.3 Wire audit logging into stock movements, PO updates, and recipe changes and verify integration tests pass

## 4. Security Hardening

- [x] 4.1 Configure TLS 1.3 on the deployment platform and verify non-compliant connections are rejected
- [x] 4.2 Configure AES-256 at-rest encryption and verify storage encryption is active
- [x] 4.3 Run a SOC2 readiness assessment and verify the control checklist is complete

## 5. Audit Review Tooling

- [x] 5.1 Build audit review views and verify authorized users can search audit entries
- [x] 5.2 Verify audit data is excluded from normal data isolation scoping for compliance users