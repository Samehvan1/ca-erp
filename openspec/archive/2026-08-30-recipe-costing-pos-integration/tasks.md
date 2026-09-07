## 1. POS Integration Middleware

- [x] 1.1 Implement the sales-sync endpoint (`/api/v1/pos/sales-sync`) and verify payload ingestion integration tests pass
- [x] 1.2 Implement the menu-mapping endpoint (`/api/v1/pos/menu-mapping`) and verify SKU translation tests pass
- [x] 1.3 Implement idempotent transaction handling and verify duplicate payloads do not double-deduct stock
- [x] 1.4 Implement offline buffering and replay and verify no-data-loss tests pass on reconnect

## 2. Recipe & BOM Management

- [x] 2.1 Implement multi-level recipe/BOM management and verify nested sub-recipe resolution tests pass
- [x] 2.2 Implement recipe versioning and verify historical version retrieval tests pass
- [x] 2.3 Implement yield and shrinkage factors (butchery, cooking, roasting) and verify output quantity tests pass

## 3. Recipe Costing

- [x] 3.1 Implement WAC-based recipe costing and verify cost recalculation on WAC change
- [x] 3.2 Implement brand-specific ingredient costing and verify brand WAC is used over generic average

## 4. Variance & Waste

- [x] 4.1 Implement theoretical vs actual consumption variance calculation and verify variance tests pass
- [x] 4.2 Implement variance flagging above tolerance and verify flag tests pass
- [x] 4.3 Implement shift spoilage and waste logging with supervisor approval and verify approval workflow tests pass

## 5. Integration

- [x] 5.1 Emit POS deduction events to the inventory and finance modules and verify stock deduction and COGS posting integration tests pass
- [x] 5.2 Feed variance data to the analytics module and verify the Theoretical vs Actual Variance report consumes it