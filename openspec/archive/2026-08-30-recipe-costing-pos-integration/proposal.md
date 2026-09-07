## Why

Fanshy, Osta Rosto, and Spacca run pre-existing, independently developed POS systems that must connect to a central inventory engine for real-time stock deduction and recipe-based costing. The holding needs an agnostic integration layer that plugs into any POS without replacing it, plus accurate recipe costing that reflects actual ingredient brands and yields.

## What Changes

- Add a multi-POS integration middleware: agnostic REST API and webhook layer receiving sales payloads, translating SKU codes, and executing real-time stock deduction, with local offline transaction buffering and auto-sync on reconnect.
- Add multi-level recipe & BOM management for menu items, prep sub-recipes (sauces, marinades, roasted coffee blends), and finished goods.
- Add yield & shrinkage factors: butchery loss %, cooking shrinkage, and green-to-roasted coffee bean shrinkage.
- Add dynamic brand/item recipe costing: menu item cost recalculates in real time from the Weighted Average Cost (WAC) of the specific ingredient brands used.
- Add theoretical vs actual consumption variance analysis comparing POS sales × BOM recipe against physical stock counts.
- Add shift spoilage & waste logging via mobile/POS with supervisor approval.

## Capabilities

### New Capabilities
- `recipe-costing`: POS integration middleware, recipe/BOM management, yield factors, dynamic recipe costing, consumption variance analysis, and waste logging.

### Modified Capabilities
- (none — no existing specs)

## Impact

- New POS integration endpoints (`/api/v1/pos/sales-sync`, `/api/v1/pos/menu-mapping`) consumed by third-party POS systems.
- Stock deduction events feed the inventory module; COGS postings feed the finance module.
- Recipe costing consumes WAC valuation from the finance module.
- Variance analysis feeds the Theoretical vs Actual Variance report in analytics.