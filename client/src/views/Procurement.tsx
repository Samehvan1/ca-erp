import { FormEvent, useState, type ReactNode } from "react";
import { Badge, ConfirmDialog, Empty, ErrorBanner, HistoryButton, ListToolbar, Loading, Modal, Toast, apiReq, useApi, useListFilter } from "../components";
import { getUser } from "../api";

interface Requisition {
  id: number;
  number: string;
  type: string;
  status: string;
  totalValue: number;
  createdAt: string;
  costCenterId: number | null;
  project: { id: number; name: string };
  requestedBy: { name: string } | null;
  items: { id: number; quantity: number; unitPrice: number; brandVariantId: number | null; item: { id: number; code: string; description: string } }[];
}

interface Po {
  id: number;
  number: string;
  status: string;
  orderedQty: number;
  receivedQty: number;
  outstandingQty: number;
  totalValue: number;
  createdAt: string;
  vendor: { id: number; name: string };
  project: { id: number; name: string };
  items: { id: number; orderedQty: number; receivedQty: number; unitPrice: number; taxPct: number; discountPct: number; brandVariantId: number | null; item: { id: number; code: string } }[];
  subTotal: number;
  vatAmount: number;
  discountAmount: number;
  feesAmount: number;
  createdBy: { name: string } | null;
}

interface Grn {
  id: number;
  number: string;
  status: string;
  receivedAt: string;
  po: { id: number };
  items: { id: number; poItemId: number; receivedQty: number; acceptedQty: number; quarantinedQty: number; item: { code: string } }[];
}

interface Invoice {
  id: number;
  number: string;
  status: string;
  amount: number;
  createdAt: string;
  vendor: { id: number; name: string };
  po: { id: number; number: string };
  items: { grnItemId: number; quantity: number; unitPrice: number }[];
}

interface Payment {
  id: number;
  number: string;
  type: string;
  amount: number;
  paidAt: string;
  vendor: { id: number; name: string };
  po: { id: number; number: string } | null;
  invoice: { id: number; number: string } | null;
}

interface Item {
  id: number;
  code: string;
  description: string;
  brandVariants: { id: number; name: string; sku: string }[];
}

interface Vendor {
  id: number;
  code: string;
  name: string;
}

interface CostCenter {
  id: number;
  code: string;
  name: string;
}

interface ReqItemRow {
  itemId: string;
  brandVariantId: string;
  quantity: string;
  unitPrice: string;
}

interface PoItemRow {
  itemId: string;
  brandVariantId: string;
  orderedQty: string;
  unitPrice: string;
  taxPct: string;
  discountPct: string;
}

interface GrnItemRow {
  poItemId: string;
  receivedQty: string;
  acceptedQty: string;
  quarantinedQty: string;
  batchNo: string;
  expiryDate: string;
  unitCost: string;
}

interface InvItemRow {
  grnItemId: string;
  quantity: string;
  unitPrice: string;
}

function ViewField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ fontSize: 14, padding: "6px 0" }}>{children}</div>
    </div>
  );
}

const myProjectId = getUser()?.projectId ?? "";

export default function Procurement() {
  const [tab, setTab] = useState<"req" | "po" | "grn" | "inv">("req");
  const reqs = useApi<Requisition[]>("/procurement/requisitions");
  const pos = useApi<Po[]>("/procurement/purchase-orders");
  const grns = useApi<Grn[]>("/procurement/grns");
  const invs = useApi<Invoice[]>("/procurement/invoices");
  const pays = useApi<Payment[]>("/procurement/payments");
  const items = useApi<Item[]>("/inventory/items");
  const vendors = useApi<Vendor[]>("/suppliers/vendors");
  const costCenters = useApi<CostCenter[]>("/finance/cost-centers");

  // Search/filter state per table
  const reqFilter = useListFilter<Requisition>(reqs.data, ["number", "type", "status", "project.name", "requestedBy.name", "totalValue"]);
  const poFilter = useListFilter<Po>(pos.data, ["number", "status", "vendor.name", "project.name", "totalValue"]);
  const grnFilter = useListFilter<Grn>(grns.data, ["number", "status"]);
  const invFilter = useListFilter<Invoice>(invs.data, ["number", "status", "vendor.name", "po.number", "amount"]);
  const payFilter = useListFilter<Payment>(pays.data, ["number", "type", "vendor.name", "po.number", "invoice.number", "amount"]);

  // Modal visibility
  const [showReq, setShowReq] = useState(false);
  const [showPo, setShowPo] = useState(false);
  const [showGrn, setShowGrn] = useState(false);
  const [showInv, setShowInv] = useState(false);
  const [showPay, setShowPay] = useState(false);

  // Row actions: edit / view / delete targets
  const [editingReq, setEditingReq] = useState<Requisition | null>(null);
  const [editingPo, setEditingPo] = useState<Po | null>(null);
  const [editingGrn, setEditingGrn] = useState<Grn | null>(null);
  const [editingInv, setEditingInv] = useState<Invoice | null>(null);
  const [editingPay, setEditingPay] = useState<Payment | null>(null);
  const [viewingReq, setViewingReq] = useState<Requisition | null>(null);
  const [viewingPo, setViewingPo] = useState<Po | null>(null);
  const [viewingGrn, setViewingGrn] = useState<Grn | null>(null);
  const [viewingInv, setViewingInv] = useState<Invoice | null>(null);
  const [viewingPay, setViewingPay] = useState<Payment | null>(null);
  const [deletingReq, setDeletingReq] = useState<Requisition | null>(null);
  const [deletingPo, setDeletingPo] = useState<Po | null>(null);
  const [deletingGrn, setDeletingGrn] = useState<Grn | null>(null);
  const [deletingInv, setDeletingInv] = useState<Invoice | null>(null);
  const [deletingPay, setDeletingPay] = useState<Payment | null>(null);
  const [delErr, setDelErr] = useState<string | null>(null);
  const [approveFor, setApproveFor] = useState<Requisition | null>(null);
  const [approveComment, setApproveComment] = useState("");

  // Shared form state
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Requisition form
  const [reqForm, setReqForm] = useState({ projectId: String(myProjectId), type: "", costCenterId: "" });
  const [reqItems, setReqItems] = useState<ReqItemRow[]>([{ itemId: "", brandVariantId: "", quantity: "", unitPrice: "" }]);

  // PO form
  const [poForm, setPoForm] = useState({ requisitionId: "", vendorId: "", projectId: String(myProjectId), feesAmount: "", discountAmount: "" });
  const [poItems, setPoItems] = useState<PoItemRow[]>([{ itemId: "", brandVariantId: "", orderedQty: "", unitPrice: "", taxPct: "", discountPct: "" }]);

  // GRN form
  const [grnForm, setGrnForm] = useState({ poId: "" });
  const [grnItems, setGrnItems] = useState<GrnItemRow[]>([{ poItemId: "", receivedQty: "", acceptedQty: "", quarantinedQty: "", batchNo: "", expiryDate: "", unitCost: "" }]);

  // Invoice form
  const [invForm, setInvForm] = useState({ vendorId: "", poId: "", amount: "" });
  const [invItems, setInvItems] = useState<InvItemRow[]>([{ grnItemId: "", quantity: "", unitPrice: "" }]);

  // Payment form
  const [payForm, setPayForm] = useState({ vendorId: "", poId: "", invoiceId: "", type: "DOWN_PAYMENT", amount: "" });

  // ---- Requisition item rows ----
  const addReqItem = () => setReqItems([...reqItems, { itemId: "", brandVariantId: "", quantity: "", unitPrice: "" }]);
  const updReqItem = (i: number, patch: Partial<ReqItemRow>) => setReqItems(reqItems.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const delReqItem = (i: number) => setReqItems(reqItems.filter((_, idx) => idx !== i));

  // ---- PO item rows ----
  const addPoItem = () => setPoItems([...poItems, { itemId: "", brandVariantId: "", orderedQty: "", unitPrice: "", taxPct: "", discountPct: "" }]);
  const updPoItem = (i: number, patch: Partial<PoItemRow>) => setPoItems(poItems.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const delPoItem = (i: number) => setPoItems(poItems.filter((_, idx) => idx !== i));

  // ---- GRN item rows ----
  const addGrnItem = () => setGrnItems([...grnItems, { poItemId: "", receivedQty: "", acceptedQty: "", quarantinedQty: "", batchNo: "", expiryDate: "", unitCost: "" }]);
  const updGrnItem = (i: number, patch: Partial<GrnItemRow>) => setGrnItems(grnItems.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const delGrnItem = (i: number) => setGrnItems(grnItems.filter((_, idx) => idx !== i));

  // ---- Invoice item rows ----
  const addInvItem = () => setInvItems([...invItems, { grnItemId: "", quantity: "", unitPrice: "" }]);
  const updInvItem = (i: number, patch: Partial<InvItemRow>) => setInvItems(invItems.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const delInvItem = (i: number) => setInvItems(invItems.filter((_, idx) => idx !== i));

  // ---- Open edit: prefill forms from an existing row ----
  const openEditReq = (r: Requisition) => {
    setErr(null);
    setReqForm({ projectId: String(r.project.id), type: r.type, costCenterId: r.costCenterId ? String(r.costCenterId) : "" });
    setReqItems(r.items.map((i) => ({ itemId: String(i.item.id), brandVariantId: i.brandVariantId ? String(i.brandVariantId) : "", quantity: String(i.quantity), unitPrice: i.unitPrice ? String(i.unitPrice) : "" })));
    setEditingReq(r);
    setShowReq(true);
  };

  const openEditPo = (p: Po) => {
    setErr(null);
    setPoForm({ requisitionId: "", vendorId: String(p.vendor.id), projectId: String(p.project.id), feesAmount: p.feesAmount != null ? String(p.feesAmount) : "", discountAmount: p.discountAmount != null ? String(p.discountAmount) : "" });
    setPoItems(p.items.map((i) => ({ itemId: String(i.item.id), brandVariantId: i.brandVariantId ? String(i.brandVariantId) : "", orderedQty: String(i.orderedQty), unitPrice: String(i.unitPrice), taxPct: i.taxPct != null ? String(i.taxPct) : "", discountPct: i.discountPct != null ? String(i.discountPct) : "" })));
    setEditingPo(p);
    setShowPo(true);
  };

  const openEditGrn = (g: Grn) => {
    setErr(null);
    setGrnForm({ poId: String(g.po.id) });
    setGrnItems(g.items.map((i) => ({ poItemId: String(i.poItemId), receivedQty: String(i.receivedQty), acceptedQty: String(i.acceptedQty), quarantinedQty: String(i.quarantinedQty), batchNo: "", expiryDate: "", unitCost: "" })));
    setEditingGrn(g);
    setShowGrn(true);
  };

  const openEditInv = (i: Invoice) => {
    setErr(null);
    setInvForm({ vendorId: String(i.vendor.id), poId: String(i.po.id), amount: String(i.amount) });
    setInvItems(i.items.map((it) => ({ grnItemId: String(it.grnItemId), quantity: String(it.quantity), unitPrice: String(it.unitPrice) })));
    setEditingInv(i);
    setShowInv(true);
  };

  const openEditPay = (p: Payment) => {
    setErr(null);
    setPayForm({ vendorId: String(p.vendor.id), poId: p.po ? String(p.po.id) : "", invoiceId: p.invoice ? String(p.invoice.id) : "", type: p.type, amount: String(p.amount) });
    setEditingPay(p);
    setShowPay(true);
  };

  // Selected PO's items (for GRN) and GRN items (for invoice)
  const selectedPo = (pos.data ?? []).find((p) => String(p.id) === grnForm.poId);
  const invPoGrnItems = (grns.data ?? []).filter((g) => String(g.po.id) === invForm.poId).flatMap((g) => g.items);

  const submitReq = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {
        projectId: Number(reqForm.projectId),
        items: reqItems.map((r) => {
          const it: Record<string, unknown> = { itemId: Number(r.itemId), quantity: Number(r.quantity) };
          if (r.brandVariantId) it.brandVariantId = Number(r.brandVariantId);
          if (r.unitPrice !== "") it.unitPrice = Number(r.unitPrice);
          return it;
        }),
      };
      if (reqForm.type) body.type = reqForm.type;
      if (reqForm.costCenterId) body.costCenterId = Number(reqForm.costCenterId);
      if (editingReq) {
        await apiReq("PATCH", `/procurement/requisitions/${editingReq.id}`, body);
        setMsg("Requisition updated");
      } else {
        await apiReq("POST", "/procurement/requisitions", body);
        setMsg("Requisition created");
      }
      reqs.reload();
      setShowReq(false);
      setEditingReq(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const submitPo = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {
        vendorId: Number(poForm.vendorId),
        projectId: Number(poForm.projectId),
        items: poItems.map((r) => {
          const it: Record<string, unknown> = { itemId: Number(r.itemId), orderedQty: Number(r.orderedQty), unitPrice: Number(r.unitPrice) };
          if (r.brandVariantId) it.brandVariantId = Number(r.brandVariantId);
          if (r.taxPct !== "") it.taxPct = Number(r.taxPct);
          if (r.discountPct !== "") it.discountPct = Number(r.discountPct);
          return it;
        }),
      };
      if (poForm.requisitionId) body.requisitionId = Number(poForm.requisitionId);
      if (poForm.feesAmount !== "") body.feesAmount = Number(poForm.feesAmount);
      if (poForm.discountAmount !== "") body.discountAmount = Number(poForm.discountAmount);
      if (editingPo) {
        await apiReq("PATCH", `/procurement/purchase-orders/${editingPo.id}`, body);
        setMsg("Purchase order updated");
      } else {
        await apiReq("POST", "/procurement/purchase-orders", body);
        setMsg("Purchase order created");
      }
      pos.reload();
      setShowPo(false);
      setEditingPo(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const submitGrn = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {
        poId: Number(grnForm.poId),
        items: grnItems.map((r) => {
          const it: Record<string, unknown> = { poItemId: Number(r.poItemId), receivedQty: Number(r.receivedQty), acceptedQty: Number(r.acceptedQty), quarantinedQty: Number(r.quarantinedQty) };
          if (r.batchNo) it.batchNo = r.batchNo;
          if (r.expiryDate) it.expiryDate = r.expiryDate;
          if (r.unitCost !== "") it.unitCost = Number(r.unitCost);
          return it;
        }),
      };
      if (editingGrn) {
        await apiReq("PATCH", `/procurement/grns/${editingGrn.id}`, body);
        setMsg("GRN updated");
      } else {
        await apiReq("POST", "/procurement/grns", body);
        setMsg("GRN created");
      }
      grns.reload();
      pos.reload();
      setShowGrn(false);
      setEditingGrn(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const submitInv = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {
        vendorId: Number(invForm.vendorId),
        poId: Number(invForm.poId),
        amount: Number(invForm.amount),
        items: invItems.map((r) => ({ grnItemId: Number(r.grnItemId), quantity: Number(r.quantity), unitPrice: Number(r.unitPrice) })),
      };
      if (editingInv) {
        await apiReq("PATCH", `/procurement/invoices/${editingInv.id}`, body);
        setMsg("Invoice updated");
      } else {
        await apiReq("POST", "/procurement/invoices", body);
        setMsg("Invoice created");
      }
      invs.reload();
      setShowInv(false);
      setEditingInv(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const submitPay = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {
        vendorId: Number(payForm.vendorId),
        type: payForm.type,
        amount: Number(payForm.amount),
      };
      if (payForm.poId) body.poId = Number(payForm.poId);
      if (payForm.invoiceId) body.invoiceId = Number(payForm.invoiceId);
      if (editingPay) {
        await apiReq("PATCH", `/procurement/payments/${editingPay.id}`, body);
        setMsg("Payment updated");
      } else {
        await apiReq("POST", "/procurement/payments", body);
        setMsg("Payment created");
      }
      pays.reload();
      setShowPay(false);
      setEditingPay(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  // ---- Delete handlers ----
  const confirmDeleteReq = async () => {
    if (!deletingReq) return;
    setBusy(true);
    setDelErr(null);
    try {
      await apiReq("DELETE", `/procurement/requisitions/${deletingReq.id}`);
      setMsg("Requisition deleted");
      setDeletingReq(null);
      reqs.reload();
    } catch (e) {
      setDelErr(e instanceof Error ? e.message : "Delete failed");
      setDeletingReq(null);
    } finally {
      setBusy(false);
    }
  };

  const confirmDeletePo = async () => {
    if (!deletingPo) return;
    setBusy(true);
    setDelErr(null);
    try {
      await apiReq("DELETE", `/procurement/purchase-orders/${deletingPo.id}`);
      setMsg("Purchase order deleted");
      setDeletingPo(null);
      pos.reload();
    } catch (e) {
      setDelErr(e instanceof Error ? e.message : "Delete failed");
      setDeletingPo(null);
    } finally {
      setBusy(false);
    }
  };

  const confirmDeleteGrn = async () => {
    if (!deletingGrn) return;
    setBusy(true);
    setDelErr(null);
    try {
      await apiReq("DELETE", `/procurement/grns/${deletingGrn.id}`);
      setMsg("GRN deleted");
      setDeletingGrn(null);
      grns.reload();
      pos.reload();
    } catch (e) {
      setDelErr(e instanceof Error ? e.message : "Delete failed");
      setDeletingGrn(null);
    } finally {
      setBusy(false);
    }
  };

  const confirmDeleteInv = async () => {
    if (!deletingInv) return;
    setBusy(true);
    setDelErr(null);
    try {
      await apiReq("DELETE", `/procurement/invoices/${deletingInv.id}`);
      setMsg("Invoice deleted");
      setDeletingInv(null);
      invs.reload();
    } catch (e) {
      setDelErr(e instanceof Error ? e.message : "Delete failed");
      setDeletingInv(null);
    } finally {
      setBusy(false);
    }
  };

  const confirmDeletePay = async () => {
    if (!deletingPay) return;
    setBusy(true);
    setDelErr(null);
    try {
      await apiReq("DELETE", `/procurement/payments/${deletingPay.id}`);
      setMsg("Payment deleted");
      setDeletingPay(null);
      pays.reload();
    } catch (e) {
      setDelErr(e instanceof Error ? e.message : "Delete failed");
      setDeletingPay(null);
    } finally {
      setBusy(false);
    }
  };

  const submitApprove = async (approve: boolean) => {
    if (!approveFor) return;
    setBusy(true);
    setErr(null);
    try {
      await apiReq("POST", `/procurement/requisitions/${approveFor.id}/approve`, {
        approve,
        ...(approveComment.trim() ? { comment: approveComment.trim() } : {}),
      });
      reqs.reload();
      setApproveFor(null);
      setApproveComment("");
      setMsg(approve ? "Requisition approved" : "Requisition rejected");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="topbar">
        <h1>Procurement</h1>
        <div className="crumb">Requisitions · Purchase Orders · GRN · Invoices</div>
      </div>

      <div className="tabs">
        <button className={tab === "req" ? "active" : ""} onClick={() => setTab("req")}>
          Requisitions ({reqs.data?.length ?? 0})
        </button>
        <button className={tab === "po" ? "active" : ""} onClick={() => setTab("po")}>
          Purchase orders ({pos.data?.length ?? 0})
        </button>
        <button className={tab === "grn" ? "active" : ""} onClick={() => setTab("grn")}>
          GRNs ({grns.data?.length ?? 0})
        </button>
        <button className={tab === "inv" ? "active" : ""} onClick={() => setTab("inv")}>
          Invoices ({invs.data?.length ?? 0})
        </button>
      </div>

      {delErr && <ErrorBanner message={delErr} />}

      {tab === "req" && (
        <div className="card">
          <div className="toolbar">
            <div className="spacer" />
            <button className="btn amber" onClick={() => setShowReq(true)}>
              + New requisition
            </button>
          </div>
          {reqs.error && <ErrorBanner message={reqs.error} />}
          {reqs.loading ? (
            <Loading />
          ) : !reqs.data?.length ? (
            <Empty />
          ) : (
            <>
              <ListToolbar
                q={reqFilter.q}
                setQ={reqFilter.setQ}
                rows={reqFilter.filtered}
                columns={[
                  { key: "number", label: "Number" },
                  { key: "type", label: "Type" },
                  { key: "project.name", label: "Project" },
                  { key: "totalValue", label: "Value" },
                  { key: "status", label: "Status" },
                ]}
                filename="requisitions"
              />
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Number</th>
                      <th>Type</th>
                      <th>Project</th>
                      <th>Items</th>
                      <th>Value</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(reqFilter.filtered ?? []).map((r) => (
                      <tr key={r.id}>
                        <td className="mono">{r.number}</td>
                        <td>
                          <Badge status={r.type.replace(/_/g, " ")} />
                        </td>
                        <td>{r.project.name}</td>
                        <td className="mono">{r.items.reduce((s, i) => s + i.quantity, 0)}</td>
                        <td className="num">{r.totalValue.toLocaleString()}</td>
                        <td>
                          <Badge status={r.status} />
                        </td>
                        <td className="mono">{new Date(r.createdAt).toLocaleDateString("en-GB")}</td>
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <HistoryButton entityType="Requisition" entityId={r.id} />
                            <button className="btn ghost sm" onClick={() => setViewingReq(r)}>
                              View
                            </button>
                            <button className="btn ghost sm" onClick={() => openEditReq(r)}>
                              Edit
                            </button>
                            {r.status === "PENDING_APPROVAL" && (
                              <button className="btn sm" onClick={() => { setApproveFor(r); setApproveComment(""); setErr(null); }}>
                                Approve
                              </button>
                            )}
                            {(r.status === "DRAFT" || r.status === "PENDING_APPROVAL") && (
                              <button className="btn danger sm" onClick={() => setDeletingReq(r)}>
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "po" && (
        <div className="card">
          <div className="toolbar">
            <div className="spacer" />
            <button className="btn amber" onClick={() => setShowPo(true)}>
              + New PO
            </button>
          </div>
          {pos.error && <ErrorBanner message={pos.error} />}
          {pos.loading ? (
            <Loading />
          ) : !pos.data?.length ? (
            <Empty />
          ) : (
            <>
              <ListToolbar
                q={poFilter.q}
                setQ={poFilter.setQ}
                rows={poFilter.filtered}
                columns={[
                  { key: "number", label: "PO" },
                  { key: "vendor.name", label: "Vendor" },
                  { key: "project.name", label: "Project" },
                  { key: "totalValue", label: "Value" },
                  { key: "status", label: "Status" },
                ]}
                filename="purchase-orders"
              />
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>PO</th>
                      <th>Vendor</th>
                      <th>Project</th>
                      <th>Ordered</th>
                      <th>Received</th>
                      <th>Outstanding</th>
                      <th>Value</th>
<th>Status</th>
                      <th>Created By</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(poFilter.filtered ?? []).map((p) => (
                      <tr key={p.id}>
                        <td className="mono">{p.number}</td>
                        <td>{p.vendor.name}</td>
                        <td>{p.project.name}</td>
                        <td className="num">{p.orderedQty}</td>
                        <td className="num">{p.receivedQty}</td>
                        <td className="num">{p.outstandingQty}</td>
                        <td className="num">{p.totalValue.toLocaleString()}</td>
                        <td>
                          <Badge status={p.status} />
                        </td>
                        <td>{p.createdBy?.name ?? "—"}</td>
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <HistoryButton entityType="PurchaseOrder" entityId={p.id} />
                            <button className="btn ghost sm" onClick={() => setViewingPo(p)}>
                              View
                            </button>
                            <button className="btn ghost sm" onClick={() => openEditPo(p)}>
                              Edit
                            </button>
                            {p.status === "OPEN" && (
                              <button className="btn danger sm" onClick={() => setDeletingPo(p)}>
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "grn" && (
        <div className="card">
          <div className="toolbar">
            <div className="spacer" />
            <button className="btn amber" onClick={() => setShowGrn(true)}>
              + New GRN
            </button>
          </div>
          {grns.error && <ErrorBanner message={grns.error} />}
          {grns.loading ? (
            <Loading />
          ) : !grns.data?.length ? (
            <Empty />
          ) : (
            <>
              <ListToolbar
                q={grnFilter.q}
                setQ={grnFilter.setQ}
                rows={grnFilter.filtered}
                columns={[
                  { key: "number", label: "GRN" },
                  { key: "status", label: "Status" },
                ]}
                filename="grns"
              />
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>GRN</th>
                      <th>Lines</th>
                      <th>Received</th>
                      <th>Accepted</th>
                      <th>Quarantined</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(grnFilter.filtered ?? []).map((g) => (
                      <tr key={g.id}>
                        <td className="mono">{g.number}</td>
                        <td className="mono">{g.items.length}</td>
                        <td className="num">{g.items.reduce((s, i) => s + i.receivedQty, 0)}</td>
                        <td className="num">{g.items.reduce((s, i) => s + i.acceptedQty, 0)}</td>
                        <td className="num">{g.items.reduce((s, i) => s + i.quarantinedQty, 0)}</td>
                        <td>
                          <Badge status={g.status} />
                        </td>
                        <td className="mono">{new Date(g.receivedAt).toLocaleDateString("en-GB")}</td>
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <HistoryButton entityType="Grn" entityId={g.id} />
                            <button className="btn ghost sm" onClick={() => setViewingGrn(g)}>
                              View
                            </button>
                            <button className="btn ghost sm" onClick={() => openEditGrn(g)}>
                              Edit
                            </button>
                            {g.status === "RECEIVED" && (
                              <button className="btn danger sm" onClick={() => setDeletingGrn(g)}>
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "inv" && (
        <div className="card">
          <div className="toolbar">
            <div className="spacer" />
            <button className="btn amber" onClick={() => setShowInv(true)}>
              + New invoice
            </button>
            <button className="btn ghost" onClick={() => setShowPay(true)}>
              + New payment
            </button>
          </div>
          {invs.error && <ErrorBanner message={invs.error} />}
          {invs.loading ? (
            <Loading />
          ) : !invs.data?.length ? (
            <Empty />
          ) : (
            <>
              <ListToolbar
                q={invFilter.q}
                setQ={invFilter.setQ}
                rows={invFilter.filtered}
                columns={[
                  { key: "number", label: "Invoice" },
                  { key: "vendor.name", label: "Vendor" },
                  { key: "po.number", label: "PO" },
                  { key: "amount", label: "Amount" },
                  { key: "status", label: "Status" },
                ]}
                filename="invoices"
              />
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Vendor</th>
                      <th>PO</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(invFilter.filtered ?? []).map((i) => (
                      <tr key={i.id}>
                        <td className="mono">{i.number}</td>
                        <td>{i.vendor.name}</td>
                        <td className="mono">{i.po.number}</td>
                        <td className="num">{i.amount.toLocaleString()}</td>
                        <td>
                          <Badge status={i.status} />
                        </td>
                        <td className="mono">{new Date(i.createdAt).toLocaleDateString("en-GB")}</td>
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <HistoryButton entityType="Invoice" entityId={i.id} />
                            <button className="btn ghost sm" onClick={() => setViewingInv(i)}>
                              View
                            </button>
                            <button className="btn ghost sm" onClick={() => openEditInv(i)}>
                              Edit
                            </button>
                            {i.status === "PENDING" && (
                              <button className="btn danger sm" onClick={() => setDeletingInv(i)}>
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <h3 style={{ margin: "22px 0 10px", fontFamily: "var(--serif)", fontSize: 16 }}>Payments</h3>
          {pays.error && <ErrorBanner message={pays.error} />}
          {pays.loading ? (
            <Loading />
          ) : !pays.data?.length ? (
            <Empty />
          ) : (
            <>
              <ListToolbar
                q={payFilter.q}
                setQ={payFilter.setQ}
                rows={payFilter.filtered}
                columns={[
                  { key: "number", label: "Payment" },
                  { key: "vendor.name", label: "Vendor" },
                  { key: "type", label: "Type" },
                  { key: "po.number", label: "PO" },
                  { key: "invoice.number", label: "Invoice" },
                  { key: "amount", label: "Amount" },
                ]}
                filename="payments"
              />
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Payment</th>
                      <th>Vendor</th>
                      <th>Type</th>
                      <th>PO</th>
                      <th>Invoice</th>
                      <th>Amount</th>
                      <th>Paid</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(payFilter.filtered ?? []).map((p) => (
                      <tr key={p.id}>
                        <td className="mono">{p.number}</td>
                        <td>{p.vendor.name}</td>
                        <td>
                          <Badge status={p.type.replace(/_/g, " ")} />
                        </td>
                        <td className="mono">{p.po?.number ?? "—"}</td>
                        <td className="mono">{p.invoice?.number ?? "—"}</td>
                        <td className="num">{p.amount.toLocaleString()}</td>
                        <td className="mono">{new Date(p.paidAt).toLocaleDateString("en-GB")}</td>
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <HistoryButton entityType="Payment" entityId={p.id} />
                            <button className="btn ghost sm" onClick={() => setViewingPay(p)}>
                              View
                            </button>
                            <button className="btn ghost sm" onClick={() => openEditPay(p)}>
                              Edit
                            </button>
                            <button className="btn danger sm" onClick={() => setDeletingPay(p)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* New / edit requisition */}
      {showReq && (
        <Modal title={editingReq ? "Edit requisition" : "New requisition"} onClose={() => { setShowReq(false); setEditingReq(null); }} wide>
          <form onSubmit={submitReq}>
            {err && <ErrorBanner message={err} />}
            <div className="form-row">
              <div className="field">
                <label>Project</label>
                <select value={reqForm.projectId} onChange={(e) => setReqForm({ ...reqForm, projectId: e.target.value })} required>
                  <option value="">Select project</option>
                  {editingReq && <option value={editingReq.project.id}>{editingReq.project.name}</option>}
                  {myProjectId !== "" && <option value={myProjectId}>My project</option>}
                </select>
              </div>
              <div className="field">
                <label>Type</label>
                <select value={reqForm.type} onChange={(e) => setReqForm({ ...reqForm, type: e.target.value })}>
                  <option value="">Manual</option>
                  <option value="MANUAL">Manual</option>
                  <option value="ROP">ROP</option>
                  <option value="GROUP_CONSOLIDATED">Group consolidated</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>Cost center</label>
              <select value={reqForm.costCenterId} onChange={(e) => setReqForm({ ...reqForm, costCenterId: e.target.value })}>
                <option value="">None</option>
                {(costCenters.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Items</label>
              {reqItems.map((r, i) => (
                <div key={i} className="form-row">
                  <div className="field">
                    <label>Item</label>
                    <select value={r.itemId} onChange={(e) => updReqItem(i, { itemId: e.target.value })} required>
                      <option value="">Select item</option>
                      {(items.data ?? []).map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.code} — {it.description}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Brand variant</label>
                    <select value={r.brandVariantId} onChange={(e) => updReqItem(i, { brandVariantId: e.target.value })}>
                      <option value="">None</option>
                      {(items.data ?? []).find((it) => String(it.id) === r.itemId)?.brandVariants.map((bv) => (
                        <option key={bv.id} value={bv.id}>
                          {bv.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Quantity</label>
                    <input type="number" min="1" value={r.quantity} onChange={(e) => updReqItem(i, { quantity: e.target.value })} required />
                  </div>
                  <div className="field">
                    <label>Unit price</label>
                    <input type="number" min="0" value={r.unitPrice} onChange={(e) => updReqItem(i, { unitPrice: e.target.value })} />
                  </div>
                  <button type="button" className="btn ghost sm" onClick={() => delReqItem(i)}>
                    Remove
                  </button>
                </div>
              ))}
              <button type="button" className="btn ghost sm" onClick={addReqItem}>
                + Add item
              </button>
            </div>
            <div className="modal-actions">
              <div className="spacer" />
              <button type="button" className="btn ghost" onClick={() => { setShowReq(false); setEditingReq(null); }}>
                Cancel
              </button>
              <button type="submit" className="btn amber" disabled={busy}>
                {busy ? (editingReq ? "Saving…" : "Creating…") : editingReq ? "Save" : "Create"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* New / edit PO */}
      {showPo && (
        <Modal title={editingPo ? "Edit purchase order" : "New purchase order"} onClose={() => { setShowPo(false); setEditingPo(null); }} wide>
          <form onSubmit={submitPo}>
            {err && <ErrorBanner message={err} />}
            <div className="form-row">
              <div className="field">
                <label>Vendor</label>
                <select value={poForm.vendorId} onChange={(e) => setPoForm({ ...poForm, vendorId: e.target.value })} required>
                  <option value="">Select vendor</option>
                  {(vendors.data ?? []).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.code} — {v.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Project</label>
                <select value={poForm.projectId} onChange={(e) => setPoForm({ ...poForm, projectId: e.target.value })} required>
                  <option value="">Select project</option>
                  {editingPo && <option value={editingPo.project.id}>{editingPo.project.name}</option>}
                  {myProjectId !== "" && <option value={myProjectId}>My project</option>}
                </select>
              </div>
            </div>
            <div className="field">
              <label>Requisition (optional)</label>
              <select value={poForm.requisitionId} onChange={(e) => setPoForm({ ...poForm, requisitionId: e.target.value })}>
                <option value="">None</option>
                {(reqs.data ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.number} ({r.status})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <div className="field">
                <label>Fees Amount</label>
                <input type="number" min="0" step="0.01" value={poForm.feesAmount} onChange={(e) => setPoForm({ ...poForm, feesAmount: e.target.value })} />
              </div>
              <div className="field">
                <label>Discount Amount</label>
                <input type="number" min="0" step="0.01" value={poForm.discountAmount} onChange={(e) => setPoForm({ ...poForm, discountAmount: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>Items</label>
              {poItems.map((r, i) => (
                <div key={i} className="form-row">
                  <div className="field">
                    <label>Item</label>
                    <select value={r.itemId} onChange={(e) => updPoItem(i, { itemId: e.target.value })} required>
                      <option value="">Select item</option>
                      {(items.data ?? []).map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.code} — {it.description}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Brand variant</label>
                    <select value={r.brandVariantId} onChange={(e) => updPoItem(i, { brandVariantId: e.target.value })}>
                      <option value="">None</option>
                      {(items.data ?? []).find((it) => String(it.id) === r.itemId)?.brandVariants.map((bv) => (
                        <option key={bv.id} value={bv.id}>
                          {bv.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Ordered qty</label>
                    <input type="number" min="1" value={r.orderedQty} onChange={(e) => updPoItem(i, { orderedQty: e.target.value })} required />
                  </div>
                  <div className="field">
                    <label>Unit price</label>
                    <input type="number" min="0" value={r.unitPrice} onChange={(e) => updPoItem(i, { unitPrice: e.target.value })} required />
                  </div>
                  <div className="field">
                    <label>Tax %</label>
                    <input type="number" min="0" max="100" value={r.taxPct} onChange={(e) => updPoItem(i, { taxPct: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Discount %</label>
                    <input type="number" min="0" max="100" value={r.discountPct} onChange={(e) => updPoItem(i, { discountPct: e.target.value })} />
                  </div>
                  <button type="button" className="btn ghost sm" onClick={() => delPoItem(i)}>
                    Remove
                  </button>
                </div>
              ))}
              <button type="button" className="btn ghost sm" onClick={addPoItem}>
                + Add item
              </button>
            </div>
            <div className="modal-actions">
              <div className="spacer" />
              <button type="button" className="btn ghost" onClick={() => { setShowPo(false); setEditingPo(null); }}>
                Cancel
              </button>
              <button type="submit" className="btn amber" disabled={busy}>
                {busy ? (editingPo ? "Saving…" : "Creating…") : editingPo ? "Save" : "Create"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* New / edit GRN */}
      {showGrn && (
        <Modal title="New GRN" onClose={() => setShowGrn(false)} wide>
          <form onSubmit={submitGrn}>
            {err && <ErrorBanner message={err} />}
            <div className="field">
              <label>Purchase order</label>
              <select value={grnForm.poId} onChange={(e) => setGrnForm({ ...grnForm, poId: e.target.value })} required>
                <option value="">Select PO</option>
                {(pos.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.number} — {p.vendor.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Items</label>
              {grnItems.map((r, i) => (
                <div key={i} className="form-row">
                  <div className="field">
                    <label>PO item</label>
                    <select value={r.poItemId} onChange={(e) => updGrnItem(i, { poItemId: e.target.value })} required>
                      <option value="">Select PO item</option>
                      {(selectedPo?.items ?? []).map((pi) => (
                        <option key={pi.id} value={pi.id}>
                          {pi.item.code} (ordered {pi.orderedQty})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Received</label>
                    <input type="number" min="1" value={r.receivedQty} onChange={(e) => updGrnItem(i, { receivedQty: e.target.value })} required />
                  </div>
                  <div className="field">
                    <label>Accepted</label>
                    <input type="number" min="0" value={r.acceptedQty} onChange={(e) => updGrnItem(i, { acceptedQty: e.target.value })} required />
                  </div>
                  <div className="field">
                    <label>Quarantined</label>
                    <input type="number" min="0" value={r.quarantinedQty} onChange={(e) => updGrnItem(i, { quarantinedQty: e.target.value })} required />
                  </div>
                  <div className="field">
                    <label>Batch no</label>
                    <input type="text" value={r.batchNo} onChange={(e) => updGrnItem(i, { batchNo: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Expiry date</label>
                    <input type="date" value={r.expiryDate} onChange={(e) => updGrnItem(i, { expiryDate: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Unit cost</label>
                    <input type="number" min="0" value={r.unitCost} onChange={(e) => updGrnItem(i, { unitCost: e.target.value })} />
                  </div>
                  <button type="button" className="btn ghost sm" onClick={() => delGrnItem(i)}>
                    Remove
                  </button>
                </div>
              ))}
              <button type="button" className="btn ghost sm" onClick={addGrnItem}>
                + Add item
              </button>
            </div>
            <div className="modal-actions">
              <div className="spacer" />
              <button type="button" className="btn ghost" onClick={() => setShowGrn(false)}>
                Cancel
              </button>
              <button type="submit" className="btn amber" disabled={busy}>
                {busy ? "Creating…" : "Create"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* New invoice */}
      {showInv && (
        <Modal title="New invoice" onClose={() => setShowInv(false)} wide>
          <form onSubmit={submitInv}>
            {err && <ErrorBanner message={err} />}
            <div className="form-row">
              <div className="field">
                <label>Vendor</label>
                <select value={invForm.vendorId} onChange={(e) => setInvForm({ ...invForm, vendorId: e.target.value })} required>
                  <option value="">Select vendor</option>
                  {(vendors.data ?? []).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.code} — {v.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>PO</label>
                <select value={invForm.poId} onChange={(e) => setInvForm({ ...invForm, poId: e.target.value })} required>
                  <option value="">Select PO</option>
                  {(pos.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.number} — {p.vendor.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label>Amount</label>
              <input type="number" min="0" step="0.01" value={invForm.amount} onChange={(e) => setInvForm({ ...invForm, amount: e.target.value })} required />
            </div>
            <div className="field">
              <label>Items</label>
              {invItems.map((r, i) => (
                <div key={i} className="form-row">
                  <div className="field">
                    <label>GRN item</label>
                    <select value={r.grnItemId} onChange={(e) => updInvItem(i, { grnItemId: e.target.value })} required>
                      <option value="">Select GRN item</option>
                      {invPoGrnItems.map((gi) => (
                        <option key={gi.id} value={gi.id}>
                          {gi.item.code} (accepted {gi.acceptedQty})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Quantity</label>
                    <input type="number" min="1" value={r.quantity} onChange={(e) => updInvItem(i, { quantity: e.target.value })} required />
                  </div>
                  <div className="field">
                    <label>Unit price</label>
                    <input type="number" min="0" value={r.unitPrice} onChange={(e) => updInvItem(i, { unitPrice: e.target.value })} required />
                  </div>
                  <button type="button" className="btn ghost sm" onClick={() => delInvItem(i)}>
                    Remove
                  </button>
                </div>
              ))}
              <button type="button" className="btn ghost sm" onClick={addInvItem}>
                + Add item
              </button>
            </div>
            <div className="modal-actions">
              <div className="spacer" />
              <button type="button" className="btn ghost" onClick={() => setShowInv(false)}>
                Cancel
              </button>
              <button type="submit" className="btn amber" disabled={busy}>
                {busy ? "Creating…" : "Create"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* New payment */}
      {showPay && (
        <Modal title="New payment" onClose={() => setShowPay(false)}>
          <form onSubmit={submitPay}>
            {err && <ErrorBanner message={err} />}
            <div className="field">
              <label>Vendor</label>
              <select value={payForm.vendorId} onChange={(e) => setPayForm({ ...payForm, vendorId: e.target.value })} required>
                <option value="">Select vendor</option>
                {(vendors.data ?? []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.code} — {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Type</label>
              <select value={payForm.type} onChange={(e) => setPayForm({ ...payForm, type: e.target.value })} required>
                <option value="DOWN_PAYMENT">Down payment</option>
                <option value="MILESTONE">Milestone</option>
                <option value="TRANCH">Tranch</option>
                <option value="RETAINAGE_RELEASE">Retainage release</option>
              </select>
            </div>
            <div className="form-row">
              <div className="field">
                <label>PO (optional)</label>
                <select value={payForm.poId} onChange={(e) => setPayForm({ ...payForm, poId: e.target.value })}>
                  <option value="">None</option>
                  {(pos.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.number}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Invoice (optional)</label>
                <select value={payForm.invoiceId} onChange={(e) => setPayForm({ ...payForm, invoiceId: e.target.value })}>
                  <option value="">None</option>
                  {(invs.data ?? []).map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.number}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label>Amount</label>
              <input type="number" min="0" step="0.01" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} required />
            </div>
            <div className="modal-actions">
              <div className="spacer" />
              <button type="button" className="btn ghost" onClick={() => setShowPay(false)}>
                Cancel
              </button>
              <button type="submit" className="btn amber" disabled={busy}>
                {busy ? "Creating…" : "Create"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* View requisition */}
      {viewingReq && (
        <Modal title={`Requisition · ${viewingReq.number}`} onClose={() => setViewingReq(null)} wide>
          <ViewField label="Number">{viewingReq.number}</ViewField>
          <ViewField label="Type">{viewingReq.type.replace(/_/g, " ")}</ViewField>
          <ViewField label="Status">{viewingReq.status.replace(/_/g, " ")}</ViewField>
          <ViewField label="Project">{viewingReq.project.name}</ViewField>
          <ViewField label="Requested by">{viewingReq.requestedBy?.name ?? "—"}</ViewField>
          <ViewField label="Total value">{viewingReq.totalValue.toLocaleString()}</ViewField>
          <ViewField label="Created">{new Date(viewingReq.createdAt).toLocaleDateString("en-GB")}</ViewField>
          <ViewField label="Items">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Unit price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {viewingReq.items.map((it) => (
                  <tr key={it.id}>
                    <td>
                      {it.item.code} · {it.item.description}
                    </td>
                    <td>{it.quantity}</td>
                    <td>{it.unitPrice}</td>
                    <td>{(it.quantity * it.unitPrice).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ViewField>
        </Modal>
      )}

      {/* View purchase order */}
      {viewingPo && (
        <Modal title={`Purchase order · ${viewingPo.number}`} onClose={() => setViewingPo(null)} wide>
          <ViewField label="Number">{viewingPo.number}</ViewField>
          <ViewField label="Status">{viewingPo.status.replace(/_/g, " ")}</ViewField>
          <ViewField label="Vendor">{viewingPo.vendor.name}</ViewField>
          <ViewField label="Project">{viewingPo.project.name}</ViewField>
          <ViewField label="Ordered / Received / Outstanding">
            {viewingPo.orderedQty} / {viewingPo.receivedQty} / {viewingPo.outstandingQty}
          </ViewField>
          <ViewField label="Total value">{viewingPo.totalValue.toLocaleString()}</ViewField>
          <ViewField label="Sub-Total">{viewingPo.subTotal?.toLocaleString() ?? "—"}</ViewField>
          <ViewField label="VAT">{viewingPo.vatAmount?.toLocaleString() ?? "—"}</ViewField>
          <ViewField label="Discount">{viewingPo.discountAmount?.toLocaleString() ?? "—"}</ViewField>
          <ViewField label="Fees">{viewingPo.feesAmount?.toLocaleString() ?? "—"}</ViewField>
          <ViewField label="Created by">{viewingPo.createdBy?.name ?? "—"}</ViewField>
          <ViewField label="Created">{new Date(viewingPo.createdAt).toLocaleDateString("en-GB")}</ViewField>
          <ViewField label="Items">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Ordered</th>
                  <th>Received</th>
                  <th>Unit price</th>
                </tr>
              </thead>
              <tbody>
                {viewingPo.items.map((it) => (
                  <tr key={it.id}>
                    <td>{it.item.code}</td>
                    <td>{it.orderedQty}</td>
                    <td>{it.receivedQty}</td>
                    <td>{it.unitPrice}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ViewField>
        </Modal>
      )}

      {/* View GRN */}
      {viewingGrn && (
        <Modal title={`GRN · ${viewingGrn.number}`} onClose={() => setViewingGrn(null)} wide>
          <ViewField label="Number">{viewingGrn.number}</ViewField>
          <ViewField label="Status">{viewingGrn.status.replace(/_/g, " ")}</ViewField>
          <ViewField label="PO">#{viewingGrn.po.id}</ViewField>
          <ViewField label="Received at">{new Date(viewingGrn.receivedAt).toLocaleDateString("en-GB")}</ViewField>
          <ViewField label="Items">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Received</th>
                  <th>Accepted</th>
                  <th>Quarantined</th>
                </tr>
              </thead>
              <tbody>
                {viewingGrn.items.map((it) => (
                  <tr key={it.id}>
                    <td>{it.item.code}</td>
                    <td>{it.receivedQty}</td>
                    <td>{it.acceptedQty}</td>
                    <td>{it.quarantinedQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ViewField>
        </Modal>
      )}

      {/* View invoice */}
      {viewingInv && (
        <Modal title={`Invoice · ${viewingInv.number}`} onClose={() => setViewingInv(null)} wide>
          <ViewField label="Number">{viewingInv.number}</ViewField>
          <ViewField label="Status">{viewingInv.status.replace(/_/g, " ")}</ViewField>
          <ViewField label="Vendor">{viewingInv.vendor.name}</ViewField>
          <ViewField label="PO">{viewingInv.po.number}</ViewField>
          <ViewField label="Amount">{viewingInv.amount.toLocaleString()}</ViewField>
          <ViewField label="Created">{new Date(viewingInv.createdAt).toLocaleDateString("en-GB")}</ViewField>
          <ViewField label="Items">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Qty</th>
                  <th>Unit price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {viewingInv.items.map((it, i) => (
                  <tr key={i}>
                    <td>{it.quantity}</td>
                    <td>{it.unitPrice}</td>
                    <td>{(it.quantity * it.unitPrice).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ViewField>
        </Modal>
      )}

      {/* View payment */}
      {viewingPay && (
        <Modal title={`Payment · ${viewingPay.number}`} onClose={() => setViewingPay(null)}>
          <ViewField label="Number">{viewingPay.number}</ViewField>
          <ViewField label="Type">{viewingPay.type.replace(/_/g, " ")}</ViewField>
          <ViewField label="Vendor">{viewingPay.vendor.name}</ViewField>
          <ViewField label="PO">{viewingPay.po?.number ?? "—"}</ViewField>
          <ViewField label="Invoice">{viewingPay.invoice?.number ?? "—"}</ViewField>
          <ViewField label="Amount">{viewingPay.amount.toLocaleString()}</ViewField>
          <ViewField label="Paid at">{new Date(viewingPay.paidAt).toLocaleDateString("en-GB")}</ViewField>
        </Modal>
      )}

      {deletingReq && (
        <ConfirmDialog
          title="Delete Requisition"
          message={`Delete requisition "${deletingReq.number}"? This cannot be undone.`}
          busy={busy}
          error={delErr ?? undefined}
          onConfirm={confirmDeleteReq}
          onCancel={() => setDeletingReq(null)}
        />
      )}

      {deletingPo && (
        <ConfirmDialog
          title="Delete Purchase Order"
          message={`Delete purchase order "${deletingPo.number}"? This cannot be undone.`}
          busy={busy}
          error={delErr ?? undefined}
          onConfirm={confirmDeletePo}
          onCancel={() => setDeletingPo(null)}
        />
      )}

      {deletingGrn && (
        <ConfirmDialog
          title="Delete GRN"
          message={`Delete GRN "${deletingGrn.number}"? This cannot be undone.`}
          busy={busy}
          error={delErr ?? undefined}
          onConfirm={confirmDeleteGrn}
          onCancel={() => setDeletingGrn(null)}
        />
      )}

      {deletingInv && (
        <ConfirmDialog
          title="Delete Invoice"
          message={`Delete invoice "${deletingInv.number}"? This cannot be undone.`}
          busy={busy}
          error={delErr ?? undefined}
          onConfirm={confirmDeleteInv}
          onCancel={() => setDeletingInv(null)}
        />
      )}

      {deletingPay && (
        <ConfirmDialog
          title="Delete Payment"
          message={`Delete payment "${deletingPay.number}"? This cannot be undone.`}
          busy={busy}
          error={delErr ?? undefined}
          onConfirm={confirmDeletePay}
          onCancel={() => setDeletingPay(null)}
        />
      )}

      {approveFor && (
        <Modal title={`Approve ${approveFor.number}`} onClose={() => setApproveFor(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitApprove(true);
            }}
          >
            <div className="field">
              <label>Comment (optional)</label>
              <textarea rows={3} value={approveComment} onChange={(e) => setApproveComment(e.target.value)} placeholder="Approval note…" />
            </div>
            {err && <ErrorBanner message={err} />}
            <div className="modal-actions">
              <span className="spacer" />
              <button type="button" className="btn ghost" onClick={() => submitApprove(false)} disabled={busy}>
                Reject
              </button>
              <button type="submit" className="btn amber" disabled={busy}>
                {busy ? "Saving…" : "Approve"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      <Toast message={msg} onDone={() => setMsg(null)} />
    </>
  );
}
