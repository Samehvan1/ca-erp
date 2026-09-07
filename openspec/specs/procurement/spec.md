# Procurement Specification

## Purpose

Implements the complete procure-to-pay cycle for Capital Agro Holding with native support for staggered partial deliveries, per-shipment QC inspection, 3-way invoice matching, partial payments, and landed cost allocation.

## Requirements

### Requirement: Purchase requisitions
The system SHALL support purchase requisitions triggered manually or automatically by Reorder Point (ROP) logic, and SHALL support both project-isolated and group-consolidated requisitions.

#### Scenario: Manual requisition
- **WHEN** a user creates a purchase requisition for a project-isolated item
- **THEN** the system records the requisition scoped to that project and routes it to the approval workflow

#### Scenario: ROP-triggered requisition
- **WHEN** an item's projected stock falls below its reorder point in a warehouse
- **THEN** the system automatically generates a purchase requisition for the reorder quantity

#### Scenario: Group-consolidated requisition
- **WHEN** multiple projects request the same cross-project shared item
- **THEN** the system can consolidate the demands into a single group-level requisition

### Requirement: DoA approval workflow
The system SHALL enforce a multi-tier Delegation of Authority approval workflow based on PR value, project scope, cost center, and item category.

#### Scenario: Approval within authority
- **WHEN** a requisition value is within the requester's approval authority
- **THEN** the system approves the requisition without escalation

#### Scenario: Escalation above authority
- **WHEN** a requisition value exceeds the requester's approval authority
- **THEN** the system escalates the requisition to the next approval tier and blocks purchase order creation until approved

### Requirement: Partial goods receiving
The system SHALL allow vendors to deliver purchase order items across multiple shipments over time, tracking Ordered Quantity, Received-to-Date Quantity, Outstanding Balance Quantity, and status (Open, Partially Received, Fully Received, Force Closed).

#### Scenario: First partial delivery
- **WHEN** a vendor delivers part of a purchase order quantity
- **THEN** the system creates a GRN for the delivered quantity, updates Received-to-Date, and sets the PO status to Partially Received

#### Scenario: Final delivery
- **WHEN** the cumulative received quantity equals the ordered quantity
- **THEN** the system sets the PO status to Fully Received and closes the outstanding balance

#### Scenario: Force close
- **WHEN** an authorized user force-closes a PO with an outstanding balance
- **THEN** the system sets the status to Force Closed and records the remaining balance as cancelled

### Requirement: QC and partial inspection
The system SHALL apply QC checks per GRN shipment, accepting sound goods, quarantining damaged or expired portions, and auto-generating partial return debit notes.

#### Scenario: Accepted goods
- **WHEN** a GRN shipment passes QC inspection
- **THEN** the system accepts the sound quantity into inventory

#### Scenario: Quarantined portion
- **WHEN** part of a GRN shipment fails QC inspection
- **THEN** the system quarantines the rejected quantity and generates a partial return debit note for the vendor

### Requirement: 3-way invoice matching for partial deliveries
The system SHALL match supplier invoices against specific GRN tranches, preventing over-billing while allowing partial invoice approvals.

#### Scenario: Invoice matches a GRN tranche
- **WHEN** a supplier invoice references a specific GRN tranche with matching quantity and price
- **THEN** the system approves the invoice for that tranche and records it against the PO

#### Scenario: Over-billing attempt
- **WHEN** an invoice quantity exceeds the outstanding receivable quantity for the referenced GRN tranche
- **THEN** the system rejects the excess and flags the invoice for review

### Requirement: Partial payment and installment workflow
The system SHALL support down payments, milestone payments, and partial tranche payments against unfulfilled or partially received POs and invoices, maintaining clear supplier credit ledgers.

#### Scenario: Down payment
- **WHEN** a user records a down payment against a purchase order
- **THEN** the system posts the payment to the supplier credit ledger and reduces the outstanding payable

#### Scenario: Milestone payment
- **WHEN** a milestone defined on a PO is reached
- **THEN** the system allows a milestone payment and records it against the PO

#### Scenario: Partial tranche payment
- **WHEN** a user pays a portion of an approved invoice
- **THEN** the system records the partial payment and keeps the remaining balance outstanding on the supplier credit ledger

### Requirement: Landed cost allocation per shipment
The system SHALL apportion freight, customs, and clearance costs proportionally across each partial GRN shipment.

#### Scenario: Landed cost on partial shipment
- **WHEN** freight and customs costs are recorded against a PO with multiple GRN shipments
- **THEN** the system apportions the costs proportionally across the received quantities of each shipment

#### Scenario: Valuation impact
- **WHEN** landed costs are allocated to a GRN shipment
- **THEN** the system adds the allocated costs to the inventory valuation of the received goods