import { FormEvent, useState } from "react";
import { Badge, ConfirmDialog, Empty, ErrorBanner, HistoryButton, ListToolbar, Loading, Modal, Toast, apiReq, useApi, useListFilter } from "../components";

interface Vendor {
  id: number;
  code: string;
  name: string;
  registrationNo: string | null;
  taxId: string | null;
  bankDetails: string | null;
  approvalStatus: string;
  active: boolean;
  paymentTerms: string;
  supplyCategories: string[];
  taxType: string | null;
  taxRate: number;
  _count: { priceLists: number; purchaseOrders: number };
}

interface PriceList {
  id: number;
  unitPrice: number;
  validFrom: string;
  validTo: string | null;
  moq: number | null;
  vendor: { id: number; name: string };
  brandVariant: { id: number; name: string; item: { code: string; description: string } };
  tiers: { minQty: number; discountPct: number }[];
}

interface Sla {
  id: number;
  periodStart: string;
  periodEnd: string;
  otifRate: number;
  priceVarianceRate: number;
  qcRejectionRate: number;
  docAccuracyRate: number;
  vendor: { name: string };
}

interface Item {
  id: number;
  code: string;
  description: string;
  brandVariants: { id: number; name: string; sku: string }[];
}

const EMPTY_VENDOR = { code: "", name: "", registrationNo: "", taxId: "", bankDetails: "", paymentTerms: "NET_30", supplyCategories: "", taxType: "", taxRate: "" };
const EMPTY_PRICE = { vendorId: "", brandVariantId: "", unitPrice: "", validFrom: "", validTo: "", moq: "" };

export default function Suppliers() {
  const [tab, setTab] = useState<"vendors" | "prices" | "slas">("vendors");
  const vendors = useApi<Vendor[]>("/suppliers/vendors");
  const prices = useApi<PriceList[]>("/suppliers/price-lists");
  const slas = useApi<Sla[]>("/suppliers/slas");
  const items = useApi<Item[]>("/inventory/items");

  const vendorFilter = useListFilter<Vendor>(vendors.data, ["code", "name", "approvalStatus"]);
  const priceFilter = useListFilter<PriceList>(prices.data, ["unitPrice"]);

  const [showVendor, setShowVendor] = useState(false);
  const [showPrice, setShowPrice] = useState(false);
  const [approveTarget, setApproveTarget] = useState<Vendor | null>(null);
  const [viewVendor, setViewVendor] = useState<Vendor | null>(null);
  const [editVendor, setEditVendor] = useState<Vendor | null>(null);
  const [deleteVendor, setDeleteVendor] = useState<Vendor | null>(null);
  const [viewPrice, setViewPrice] = useState<PriceList | null>(null);
  const [editPrice, setEditPrice] = useState<PriceList | null>(null);
  const [deletePrice, setDeletePrice] = useState<PriceList | null>(null);
  const [vendorForm, setVendorForm] = useState(EMPTY_VENDOR);
  const [priceForm, setPriceForm] = useState(EMPTY_PRICE);
  const [tiers, setTiers] = useState<{ minQty: string; discountPct: string }[]>([]);
  const [approveComment, setApproveComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const brandOptions = (items.data ?? []).flatMap((it) =>
    it.brandVariants.map((bv) => ({ id: bv.id, label: `${it.code} · ${it.description} — ${bv.name}` }))
  );

  const submitVendor = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = {
        code: vendorForm.code.trim(),
        name: vendorForm.name.trim(),
        paymentTerms: vendorForm.paymentTerms,
        supplyCategories: vendorForm.supplyCategories.split(",").map((s) => s.trim()).filter(Boolean),
      };
      if (vendorForm.registrationNo.trim()) body.registrationNo = vendorForm.registrationNo.trim();
      if (vendorForm.taxId.trim()) body.taxId = vendorForm.taxId.trim();
      if (vendorForm.bankDetails.trim()) body.bankDetails = vendorForm.bankDetails.trim();
      if (vendorForm.taxType.trim()) body.taxType = vendorForm.taxType.trim();
      if (vendorForm.taxRate !== "") body.taxRate = Number(vendorForm.taxRate);
      if (editVendor) {
        await apiReq("PATCH", `/suppliers/vendors/${editVendor.id}`, body);
        setMsg("Vendor updated");
      } else {
        await apiReq("POST", "/suppliers/vendors", body);
        setMsg("Vendor created");
      }
      setVendorForm(EMPTY_VENDOR);
      setEditVendor(null);
      setShowVendor(false);
      vendors.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const submitApprove = async (approve: boolean) => {
    if (!approveTarget) return;
    setBusy(true);
    setErr(null);
    try {
      await apiReq("POST", `/suppliers/vendors/${approveTarget.id}/approve`, {
        approve,
        comment: approveComment.trim() || undefined,
      });
      setApproveTarget(null);
      setApproveComment("");
      setMsg(approve ? "Vendor approved" : "Vendor rejected");
      vendors.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const submitPrice = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = {
        vendorId: Number(priceForm.vendorId),
        brandVariantId: Number(priceForm.brandVariantId),
        unitPrice: Number(priceForm.unitPrice),
        validFrom: priceForm.validFrom,
      };
      if (priceForm.validTo) body.validTo = priceForm.validTo;
      if (priceForm.moq.trim()) body.moq = Number(priceForm.moq);
      const cleanTiers = tiers
        .map((t) => ({ minQty: Number(t.minQty), discountPct: Number(t.discountPct) }))
        .filter((t) => !Number.isNaN(t.minQty) && !Number.isNaN(t.discountPct));
      if (cleanTiers.length) body.tiers = cleanTiers;
      if (editPrice) {
        await apiReq("PATCH", `/suppliers/price-lists/${editPrice.id}`, body);
        setMsg("Price list updated");
      } else {
        await apiReq("POST", "/suppliers/price-lists", body);
        setMsg("Price list created");
      }
      setPriceForm(EMPTY_PRICE);
      setTiers([]);
      setEditPrice(null);
      setShowPrice(false);
      prices.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const startEditVendor = (v: Vendor) => {
    setErr(null);
    setVendorForm({
      code: v.code,
      name: v.name,
      registrationNo: v.registrationNo ?? "",
      taxId: v.taxId ?? "",
      bankDetails: v.bankDetails ?? "",
      paymentTerms: v.paymentTerms,
      supplyCategories: v.supplyCategories.join(", "),
      taxType: v.taxType ?? "",
      taxRate: v.taxRate != null ? String(v.taxRate) : "",
    });
    setEditVendor(v);
    setShowVendor(true);
  };

  const startEditPrice = (p: PriceList) => {
    setErr(null);
    setPriceForm({
      vendorId: String(p.vendor.id),
      brandVariantId: String(p.brandVariant.id),
      unitPrice: String(p.unitPrice),
      validFrom: p.validFrom.slice(0, 10),
      validTo: p.validTo ? p.validTo.slice(0, 10) : "",
      moq: p.moq != null ? String(p.moq) : "",
    });
    setTiers(p.tiers.map((t) => ({ minQty: String(t.minQty), discountPct: String(t.discountPct) })));
    setEditPrice(p);
    setShowPrice(true);
  };

  const confirmDeleteVendor = async () => {
    if (!deleteVendor) return;
    setBusy(true);
    setErr(null);
    try {
      await apiReq("DELETE", `/suppliers/vendors/${deleteVendor.id}`);
      setDeleteVendor(null);
      setMsg("Vendor deleted");
      vendors.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const confirmDeletePrice = async () => {
    if (!deletePrice) return;
    setBusy(true);
    setErr(null);
    try {
      await apiReq("DELETE", `/suppliers/price-lists/${deletePrice.id}`);
      setDeletePrice(null);
      setMsg("Price list deleted");
      prices.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const addTier = () => setTiers((ts) => [...ts, { minQty: "", discountPct: "" }]);
  const removeTier = (i: number) => setTiers((ts) => ts.filter((_, idx) => idx !== i));
  const updateTier = (i: number, key: "minQty" | "discountPct", value: string) =>
    setTiers((ts) => ts.map((t, idx) => (idx === i ? { ...t, [key]: value } : t)));

  return (
    <>
      <div className="topbar">
        <h1>Suppliers</h1>
        <div className="crumb">Vendors · Price Lists · SLA</div>
      </div>

      <div className="tabs">
        <button
          className={tab === "vendors" ? "active" : ""}
          onClick={() => setTab("vendors")}
          title="Vendors: Supplier master records, tax & commercial registration, contact persons, and bank details"
        >
          Vendors ({vendors.data?.length ?? 0})
        </button>
        <button
          className={tab === "prices" ? "active" : ""}
          onClick={() => setTab("prices")}
          title="Price lists: Vendor price agreements, unit rates, minimum order quantities (MOQ), and contract validity periods"
        >
          Price lists ({prices.data?.length ?? 0})
        </button>
        <button
          className={tab === "slas" ? "active" : ""}
          onClick={() => setTab("slas")}
          title="SLA scorecards: Supplier delivery reliability, lead time compliance, fulfillment rates, and quality scorecards"
        >
          SLA scorecards ({slas.data?.length ?? 0})
        </button>
      </div>

      {tab === "vendors" && (
        <div className="card">
          <div className="toolbar">
            <div className="spacer" />
            <button className="btn amber" onClick={() => { setErr(null); setShowVendor(true); }}>
              + New vendor
            </button>
          </div>
          <ListToolbar
            q={vendorFilter.q}
            setQ={vendorFilter.setQ}
            rows={vendorFilter.filtered}
            columns={[
              { key: "code", label: "Code" },
              { key: "name", label: "Name" },
              { key: "approvalStatus", label: "Approval" },
            ]}
            filename="vendors"
          />
          {vendors.error && <ErrorBanner message={vendors.error} />}
          {vendors.loading ? (
            <Loading />
          ) : !vendors.data?.length ? (
            <Empty />
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Terms</th>
                    <th>Categories</th>
                    <th>Price lists</th>
                    <th>POs</th>
                    <th>Approval</th>
                    <th>Active</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(vendorFilter.filtered ?? []).map((v) => (
                    <tr key={v.id}>
                      <td className="mono">{v.code}</td>
                      <td>{v.name}</td>
                      <td className="mono">{v.paymentTerms.replace(/_/g, " ")}</td>
                      <td>{v.supplyCategories.join(", ") || "—"}</td>
                      <td className="num">{v._count.priceLists}</td>
                      <td className="num">{v._count.purchaseOrders}</td>
                      <td>
                        <Badge status={v.approvalStatus} />
                      </td>
                      <td>
                        <Badge status={v.active ? "ACTIVE" : "INACTIVE"} />
                      </td>
                      <td>
                        <div className="row-actions">
                          <HistoryButton entityType="Vendor" entityId={v.id} />
                          <button className="link" onClick={() => { setErr(null); setViewVendor(v); }}>
                            view
                          </button>
                          <button className="link" onClick={() => startEditVendor(v)}>
                            edit
                          </button>
                          <button className="link danger" onClick={() => { setErr(null); setDeleteVendor(v); }}>
                            delete
                          </button>
                          {v.approvalStatus === "PENDING" && (
                            <button
                              className="link"
                              onClick={() => { setErr(null); setApproveComment(""); setApproveTarget(v); }}
                            >
                              approve
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "prices" && (
        <div className="card">
          <div className="toolbar">
            <div className="spacer" />
            <button className="btn amber" onClick={() => { setErr(null); setShowPrice(true); }}>
              + New price list
            </button>
          </div>
          <ListToolbar
            q={priceFilter.q}
            setQ={priceFilter.setQ}
            rows={priceFilter.filtered}
            columns={[{ key: "unitPrice", label: "Unit price" }]}
            filename="price-lists"
          />
          {prices.error && <ErrorBanner message={prices.error} />}
          {prices.loading ? (
            <Loading />
          ) : !prices.data?.length ? (
            <Empty text="No price lists configured." />
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Vendor</th>
                    <th>Item</th>
                    <th>Variant</th>
                    <th>Unit price</th>
                    <th>MOQ</th>
                    <th>Valid from</th>
                    <th>Valid to</th>
                    <th>Tiers</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(priceFilter.filtered ?? []).map((p) => (
                    <tr key={p.id}>
                      <td>{p.vendor.name}</td>
                      <td>
                        {p.brandVariant.item.code} · {p.brandVariant.item.description}
                      </td>
                      <td>{p.brandVariant.name}</td>
                      <td className="num">{p.unitPrice.toFixed(2)}</td>
                      <td className="num">{p.moq ?? "—"}</td>
                      <td className="mono">{new Date(p.validFrom).toLocaleDateString("en-GB")}</td>
                      <td className="mono">{p.validTo ? new Date(p.validTo).toLocaleDateString("en-GB") : "—"}</td>
                      <td className="num">{p.tiers.length}</td>
                      <td>
                        <div className="row-actions">
                          <button className="link" onClick={() => { setErr(null); setViewPrice(p); }}>
                            view
                          </button>
                          <button className="link" onClick={() => startEditPrice(p)}>
                            edit
                          </button>
                          <button className="link danger" onClick={() => { setErr(null); setDeletePrice(p); }}>
                            delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "slas" && (
        <div className="card">
          {slas.error && <ErrorBanner message={slas.error} />}
          {slas.loading ? (
            <Loading />
          ) : !slas.data?.length ? (
            <Empty text="No SLA scorecards yet. Compute one from vendor history." />
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Vendor</th>
                    <th>Period</th>
                    <th>OTIF</th>
                    <th>Price variance</th>
                    <th>QC rejection</th>
                    <th>Doc accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {slas.data.map((s) => (
                    <tr key={s.id}>
                      <td>{s.vendor.name}</td>
                      <td className="mono">
                        {new Date(s.periodStart).toLocaleDateString("en-GB")} → {new Date(s.periodEnd).toLocaleDateString("en-GB")}
                      </td>
                      <td className="num">{s.otifRate.toFixed(1)}%</td>
                      <td className="num">{s.priceVarianceRate.toFixed(1)}%</td>
                      <td className="num">{s.qcRejectionRate.toFixed(1)}%</td>
                      <td className="num">{s.docAccuracyRate.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showVendor && (
        <Modal title={editVendor ? "Edit Vendor" : "New Vendor"} onClose={() => { setShowVendor(false); setEditVendor(null); }}>
          <form onSubmit={submitVendor}>
            {err && <ErrorBanner message={err} />}
            <div className="form-row">
              <div className="field">
                <label>Code</label>
                <input value={vendorForm.code} onChange={(e) => setVendorForm({ ...vendorForm, code: e.target.value })} required />
              </div>
              <div className="field">
                <label>Name</label>
                <input value={vendorForm.name} onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })} required />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>Registration No (optional)</label>
                <input value={vendorForm.registrationNo} onChange={(e) => setVendorForm({ ...vendorForm, registrationNo: e.target.value })} />
              </div>
              <div className="field">
                <label>Tax ID (optional)</label>
                <input value={vendorForm.taxId} onChange={(e) => setVendorForm({ ...vendorForm, taxId: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>Payment terms</label>
                <select value={vendorForm.paymentTerms} onChange={(e) => setVendorForm({ ...vendorForm, paymentTerms: e.target.value })}>
                  <option value="COD">COD</option>
                  <option value="NET_30">NET 30</option>
                  <option value="NET_60">NET 60</option>
                  <option value="NET_90">NET 90</option>
                </select>
              </div>
              <div className="field">
                <label>Supply categories (comma-separated)</label>
                <input value={vendorForm.supplyCategories} onChange={(e) => setVendorForm({ ...vendorForm, supplyCategories: e.target.value })} placeholder="e.g. Produce, Dairy" />
              </div>
            </div>
<div className="field">
               <label>Bank details (optional)</label>
               <input value={vendorForm.bankDetails} onChange={(e) => setVendorForm({ ...vendorForm, bankDetails: e.target.value })} />
             </div>
            <div className="form-row">
              <div className="field">
                <label>Tax Type (optional)</label>
                <select value={vendorForm.taxType} onChange={(e) => setVendorForm({ ...vendorForm, taxType: e.target.value })}>
                  <option value="">None</option>
                  <option value="No Tax">No Tax</option>
                  <option value="VAT">VAT</option>
                </select>
              </div>
              <div className="field">
                <label>Tax Rate %</label>
                <input type="number" min="0" max="100" step="0.01" value={vendorForm.taxRate} onChange={(e) => setVendorForm({ ...vendorForm, taxRate: e.target.value })} />
              </div>
            </div>
            <div className="modal-actions">
              <div className="spacer" />
              <button type="button" className="btn ghost" onClick={() => { setShowVendor(false); setEditVendor(null); }}>
                Cancel
              </button>
              <button type="submit" className="btn" disabled={busy}>
                {busy ? "Saving…" : editVendor ? "Save" : "Create"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {approveTarget && (
        <Modal title={`Approve ${approveTarget.name}`} onClose={() => setApproveTarget(null)}>
          {err && <ErrorBanner message={err} />}
          <div className="field">
            <label>Comment (optional)</label>
            <textarea value={approveComment} onChange={(e) => setApproveComment(e.target.value)} rows={3} />
          </div>
          <div className="modal-actions">
            <div className="spacer" />
            <button type="button" className="btn ghost" onClick={() => setApproveTarget(null)}>
              Cancel
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => submitApprove(false)}>
              Reject
            </button>
            <button type="button" className="btn amber" disabled={busy} onClick={() => submitApprove(true)}>
              Approve
            </button>
          </div>
        </Modal>
      )}

      {showPrice && (
        <Modal title={editPrice ? "Edit Price List" : "New Price List"} onClose={() => { setShowPrice(false); setEditPrice(null); }} wide>
          <form onSubmit={submitPrice}>
            {err && <ErrorBanner message={err} />}
            <div className="form-row">
              <div className="field">
                <label>Vendor</label>
                <select value={priceForm.vendorId} onChange={(e) => setPriceForm({ ...priceForm, vendorId: e.target.value })} required>
                  <option value="">Select vendor…</option>
                  {(vendors.data ?? []).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.code} · {v.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Brand variant</label>
                <select value={priceForm.brandVariantId} onChange={(e) => setPriceForm({ ...priceForm, brandVariantId: e.target.value })} required>
                  <option value="">Select variant…</option>
                  {brandOptions.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>Unit price</label>
                <input type="number" min="0" step="0.01" value={priceForm.unitPrice} onChange={(e) => setPriceForm({ ...priceForm, unitPrice: e.target.value })} required />
              </div>
              <div className="field">
                <label>MOQ (optional)</label>
                <input type="number" min="0" value={priceForm.moq} onChange={(e) => setPriceForm({ ...priceForm, moq: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>Valid from</label>
                <input type="date" value={priceForm.validFrom} onChange={(e) => setPriceForm({ ...priceForm, validFrom: e.target.value })} required />
              </div>
              <div className="field">
                <label>Valid to (optional)</label>
                <input type="date" value={priceForm.validTo} onChange={(e) => setPriceForm({ ...priceForm, validTo: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>Tiers (optional)</label>
              {tiers.map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                  <input type="number" min="0" placeholder="Min qty" value={t.minQty} onChange={(e) => updateTier(i, "minQty", e.target.value)} />
                  <input type="number" min="0" placeholder="Discount %" value={t.discountPct} onChange={(e) => updateTier(i, "discountPct", e.target.value)} />
                  <button type="button" className="btn ghost sm" onClick={() => removeTier(i)}>
                    ×
                  </button>
                </div>
              ))}
              <button type="button" className="btn ghost sm" onClick={addTier}>
                + Add tier
              </button>
            </div>
            <div className="modal-actions">
              <div className="spacer" />
              <button type="button" className="btn ghost" onClick={() => { setShowPrice(false); setEditPrice(null); }}>
                Cancel
              </button>
              <button type="submit" className="btn" disabled={busy}>
                {busy ? "Saving…" : editPrice ? "Save" : "Create"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {viewVendor && (
        <Modal title={`Vendor · ${viewVendor.code}`} onClose={() => setViewVendor(null)}>
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">Code</span>
              <span className="mono">{viewVendor.code}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Name</span>
              <span>{viewVendor.name}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Registration No</span>
              <span>{viewVendor.registrationNo || "—"}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Tax ID</span>
              <span>{viewVendor.taxId || "—"}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Bank details</span>
              <span>{viewVendor.bankDetails || "—"}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Payment terms</span>
              <span className="mono">{viewVendor.paymentTerms.replace(/_/g, " ")}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Supply categories</span>
              <span>{viewVendor.supplyCategories.join(", ") || "—"}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Approval</span>
              <Badge status={viewVendor.approvalStatus} />
            </div>
            <div className="detail-item">
              <span className="detail-label">Active</span>
              <Badge status={viewVendor.active ? "ACTIVE" : "INACTIVE"} />
            </div>
            <div className="detail-item">
              <span className="detail-label">Price lists</span>
              <span className="num">{viewVendor._count.priceLists}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Purchase orders</span>
              <span className="num">{viewVendor._count.purchaseOrders}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Tax Type</span>
              <span>{viewVendor.taxType || "—"}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Tax Rate</span>
              <span className="num">{viewVendor.taxRate}%</span>
            </div>
          </div>
          <div className="modal-actions">
            <div className="spacer" />
            <button type="button" className="btn ghost" onClick={() => setViewVendor(null)}>
              Close
            </button>
          </div>
        </Modal>
      )}

      {viewPrice && (
        <Modal title="Price List" onClose={() => setViewPrice(null)}>
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">Vendor</span>
              <span>{viewPrice.vendor.name}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Item</span>
              <span>
                {viewPrice.brandVariant.item.code} · {viewPrice.brandVariant.item.description}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Variant</span>
              <span>{viewPrice.brandVariant.name}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Unit price</span>
              <span className="num">{viewPrice.unitPrice.toFixed(2)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">MOQ</span>
              <span className="num">{viewPrice.moq ?? "—"}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Valid from</span>
              <span className="mono">{new Date(viewPrice.validFrom).toLocaleDateString("en-GB")}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Valid to</span>
              <span className="mono">{viewPrice.validTo ? new Date(viewPrice.validTo).toLocaleDateString("en-GB") : "—"}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Tiers</span>
              <span className="num">{viewPrice.tiers.length}</span>
            </div>
          </div>
          {viewPrice.tiers.length > 0 && (
            <table className="tbl" style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Min qty</th>
                  <th>Discount %</th>
                </tr>
              </thead>
              <tbody>
                {viewPrice.tiers.map((t, i) => (
                  <tr key={i}>
                    <td className="num">{t.minQty}</td>
                    <td className="num">{t.discountPct}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="modal-actions">
            <div className="spacer" />
            <button type="button" className="btn ghost" onClick={() => setViewPrice(null)}>
              Close
            </button>
          </div>
        </Modal>
      )}

      {deleteVendor && (
        <ConfirmDialog
          title="Delete vendor"
          message={`Delete ${deleteVendor.name} (${deleteVendor.code})? This cannot be undone.`}
          busy={busy}
          error={err}
          onConfirm={confirmDeleteVendor}
          onCancel={() => { setDeleteVendor(null); setErr(null); }}
        />
      )}

      {deletePrice && (
        <ConfirmDialog
          title="Delete price list"
          message={`Delete this price list for ${deletePrice.vendor.name}? This cannot be undone.`}
          busy={busy}
          error={err}
          onConfirm={confirmDeletePrice}
          onCancel={() => { setDeletePrice(null); setErr(null); }}
        />
      )}

      <Toast message={msg} onDone={() => setMsg(null)} />
    </>
  );
}