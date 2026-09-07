## Purpose

Connects pre-existing third-party POS systems to Capital Agro Holding's central inventory engine via an agnostic integration hub, and manages recipe/BOM costing, yield factors, consumption variance analysis, and waste logging across all F&B brands.

## ADDED Requirements

### Requirement: Multi-POS integration middleware
The system SHALL provide an agnostic REST API and webhook middleware layer that receives sales payloads from any pre-existing POS system, translates SKU codes, and executes real-time stock deduction, with local offline transaction buffering and auto-sync on reconnection.

#### Scenario: Real-time sales deduction
- **WHEN** a POS system pushes a sales payload to the sales-sync endpoint
- **THEN** the system translates the SKU codes and deducts the corresponding stock in real time

#### Scenario: Offline buffering
- **WHEN** a POS terminal loses internet connectivity during sales
- **THEN** the system buffers the sales transactions locally and replays them without data loss upon reconnection

#### Scenario: Menu mapping
- **WHEN** a POS system requests menu mapping
- **THEN** the system returns the mapping between POS menu items and central inventory SKUs

### Requirement: Multi-level recipe and BOM management
The system SHALL support recipe definitions for menu items, prep sub-recipes (sauces, marinades, roasted coffee blends), and finished goods across Fanshy, Osta Rosto, and Spacca.

#### Scenario: Nested recipe
- **WHEN** a menu item recipe references a prep sub-recipe
- **THEN** the system resolves the full ingredient tree including the sub-recipe's ingredients

#### Scenario: Recipe versioning
- **WHEN** a recipe is updated
- **THEN** the system keeps the previous version for historical costing and variance analysis

### Requirement: Yield and shrinkage factors
The system SHALL apply yield and shrinkage factors including butchery loss percentage, cooking shrinkage, and green-to-roasted coffee bean shrinkage.

#### Scenario: Butchery yield
- **WHEN** a butchery recipe consumes raw meat with an 85% usable yield factor
- **THEN** the system calculates the usable output quantity and the corresponding shrinkage loss

#### Scenario: Roasting shrinkage
- **WHEN** green coffee beans are roasted with a defined shrinkage factor
- **THEN** the system applies the shrinkage to compute the roasted bean output quantity

### Requirement: Dynamic brand and item recipe costing
The system SHALL recalculate menu item cost in real time based on the Weighted Average Cost (WAC) of the specific ingredient brands used.

#### Scenario: Cost recalculation on price change
- **WHEN** the WAC of an ingredient brand changes
- **THEN** the system recalculates the affected menu item costs in real time

#### Scenario: Brand-specific costing
- **WHEN** a recipe specifies a particular ingredient brand
- **THEN** the system costs the recipe using that brand's WAC rather than the generic item average

### Requirement: Theoretical vs actual consumption variance
The system SHALL compare theoretical usage (POS sales multiplied by BOM recipe) against physical stock counts to identify shrinkage, portion errors, or unrecorded waste.

#### Scenario: Variance detection
- **WHEN** physical stock count differs from theoretical usage for an item in a period
- **THEN** the system computes the variance and flags items exceeding the configured tolerance

#### Scenario: Variance report
- **WHEN** a cost controller requests the variance report
- **THEN** the system reports theoretical vs actual consumption and waste percentage per brand and outlet

### Requirement: Shift spoilage and waste logging
The system SHALL support mobile/POS waste logging for kitchen drops, barista calibration shots, or expired prep items, with supervisor approval.

#### Scenario: Waste logged
- **WHEN** a staff member logs a kitchen drop or expired prep item as waste
- **THEN** the system records the waste entry and deducts the quantity from stock

#### Scenario: Supervisor approval
- **WHEN** a waste entry exceeds the configured approval threshold
- **THEN** the system requires supervisor approval before the deduction is finalized