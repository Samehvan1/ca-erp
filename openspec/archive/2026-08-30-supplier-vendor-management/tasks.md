## 1. Data Model

- [x] 1.1 Create the vendor master schema (registration, tax IDs, banking, payment terms, supply categories) and verify migration and seed scripts run cleanly
- [x] 1.2 Create the dual-level mapping tables (vendor_item, vendor_brand_variant) and verify referential integrity tests pass
- [x] 1.3 Create the price list schema (valid_from/valid_to, MOQ, volume tier discounts) and verify effective-date validation tests pass

## 2. API Surface

- [x] 2.1 Implement vendor CRUD endpoints and verify create/update/delete integration tests pass
- [x] 2.2 Implement supplier mapping endpoints (generic item and brand variant levels) and verify mapping constraint tests pass
- [x] 2.3 Implement price list endpoints with effective-date and MOQ validation and verify API tests cover expired and tiered pricing

## 3. Workflows

- [x] 3.1 Implement vendor approval/onboarding workflow and verify the workflow transitions are covered by tests
- [x] 3.2 Implement payment terms enforcement on purchase orders and verify PO pricing uses the active contracted price

## 4. SLA Scorecard

- [x] 4.1 Implement OTIF computation from GRN and PO events and verify scorecard unit tests pass
- [x] 4.2 Implement price variance compliance tracking and verify variance flags appear on the scorecard
- [x] 4.3 Implement QC rejection rate and document accuracy metrics and verify scorecard aggregation tests pass

## 5. Integration & Reporting

- [x] 5.1 Expose vendor data to the procurement module via service API and verify procurement can price POs from contracted lists
- [x] 5.2 Feed SLA metrics to the analytics module and verify the Vendor SLA report consumes scorecard data
- [x] 5.3 Add vendor master import tooling and verify a sample import round-trips without data loss