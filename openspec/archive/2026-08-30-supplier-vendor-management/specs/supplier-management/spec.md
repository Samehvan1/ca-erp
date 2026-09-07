## Purpose

Manages Capital Agro Holding's vendor master data, dual-level supplier-item-brand mappings, contracted multi-brand price lists, and vendor SLA scorecards across all F&B projects.

## ADDED Requirements

### Requirement: Vendor master profile
The system SHALL maintain a vendor master profile for each supplier containing commercial registration, tax IDs, banking details, payment terms (COD, Net 30/60/90), and authorized supply categories.

#### Scenario: Create vendor profile
- **WHEN** a procurement officer creates a vendor with registration, tax, banking, and payment term data
- **THEN** the system stores the vendor profile and assigns it a unique vendor identifier

#### Scenario: Update payment terms
- **WHEN** an authorized user updates a vendor's payment terms from Net 30 to Net 60
- **THEN** the system records the new terms and logs the change in the audit trail

### Requirement: Dual-level supplier mapping
The system SHALL allow a supplier to be linked at the generic item master level and/or at the specific brand variant level, so that a supplier can supply a category of items or be the exclusive distributor of a specific brand variant.

#### Scenario: Link supplier to generic item
- **WHEN** a user links Supplier A to the generic item "Full Cream Milk 1L"
- **THEN** Supplier A becomes an approved supplier for all brand variants of that generic item unless overridden

#### Scenario: Link supplier to brand variant
- **WHEN** a user links Supplier B as the exclusive distributor for the brand variant "Dina Farms Full Cream Milk 1L"
- **THEN** the system records Supplier B as the sole approved source for that specific brand variant

### Requirement: Multi-brand price lists
The system SHALL maintain contracted price lists per supplier and per item brand variant, each with effective start/end dates, minimum order quantities (MOQ), and volume tier discounts.

#### Scenario: Price list effective during purchase
- **WHEN** a purchase order line is priced for a brand variant with an active price list entry
- **THEN** the system applies the contracted unit price and any applicable volume tier discount

#### Scenario: Price list expired
- **WHEN** a purchase order is created for a brand variant whose price list has passed its effective end date
- **THEN** the system flags the line for price confirmation and does not silently apply the expired price

### Requirement: Vendor SLA scorecard
The system SHALL compute and maintain a vendor SLA scorecard tracking Order Fulfillment Rate (OTIF), price variance compliance, QC rejection rates at GRN, and document accuracy.

#### Scenario: OTIF computation
- **WHEN** a vendor completes deliveries against purchase orders in a period
- **THEN** the system computes the On-Time In-Full fulfillment rate and updates the vendor's SLA scorecard

#### Scenario: QC rejection impact
- **WHEN** a GRN shipment from a vendor records QC rejections
- **THEN** the system updates the vendor's QC rejection rate on the SLA scorecard

#### Scenario: Price variance flag
- **WHEN** an invoiced price exceeds the contracted price list price for a vendor
- **THEN** the system records a price variance compliance exception on the vendor's SLA scorecard