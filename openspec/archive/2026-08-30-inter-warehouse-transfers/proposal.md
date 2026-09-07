## Why

Stock moves continuously between outlets, project central warehouses, and the optional group central warehouse, including cross-project borrowing (e.g., Spacca borrowing milk from Fanshy Central). Without a formal transfer workflow with in-transit tracking and loss allocation, ownership and cost responsibility become unclear and shrinkage cannot be attributed.

## What Changes

- Add transfer requisitions: outlets request stock from their project central warehouse or from a group central warehouse.
- Add project-to-project transfers with automated inter-company cost accounting.
- Add an in-transit holding hub: stock moves to a virtual In-Transit status during transit, keeping financial ownership tracked until destination receipt.
- Add discrepancy & transit loss allocation: discrepancies logged upon receipt auto-assign cost loss to the sending warehouse, receiving branch, or logistics transport.

## Capabilities

### New Capabilities
- `transfers`: Inter-warehouse transfer requisitions, cross-project transfers with inter-company accounting, in-transit stock tracking, and discrepancy/loss allocation.

### Modified Capabilities
- (none — no existing specs)

## Impact

- New transfer data model (requisition, dispatch, in-transit, receipt) shared with inventory and finance modules.
- In-transit status integrates with the inventory module's warehouse node model (TRN-99 transit node).
- Inter-company cost accounting drives GL postings in the finance module.
- Discrepancy allocation feeds variance analysis and stocktaking reconciliation.