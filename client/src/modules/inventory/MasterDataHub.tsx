import { useState, useMemo, FormEvent } from "react";
import { Category, UnitOfMeasure, UnitConversion, UnitDimension, Item } from "./types";
import { useApi, apiReq, Loading, ErrorBanner, Modal, Toast, ConfirmDialog, ListToolbar, useListFilter } from "../../components";
import { convertUnits, formatUnitQty } from "../../lib/unitConversion";

interface MasterDataHubProps {
  items: Item[];
  onRefreshItems?: () => void;
}

export function MasterDataHub({ items, onRefreshItems }: MasterDataHubProps) {
  const [subTab, setSubTab] = useState<"categories" | "units" | "conversions" | "calculator">("categories");

  // APIs
  const categoriesApi = useApi<Category[]>("/master-data/categories");
  const unitsApi = useApi<UnitOfMeasure[]>("/master-data/units");
  const conversionsApi = useApi<UnitConversion[]>("/master-data/conversions");

  const categories = categoriesApi.data || [];
  const units = unitsApi.data || [];
  const conversions = conversionsApi.data || [];

  // Filter hooks for list views
  const { q: catQ, setQ: setCatQ, filtered: filteredCats } = useListFilter<Category>(categories, ["code", "name"]);
  const { q: unitQ, setQ: setUnitQ, filtered: filteredUnits } = useListFilter<UnitOfMeasure>(units, ["code", "name", "dimension"]);
  const { q: convQ, setQ: setConvQ, filtered: filteredConvs } = useListFilter<UnitConversion>(conversions, ["fromUnit.code", "toUnit.code", "item.code"]);

  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Category Form State
  const [catModal, setCatModal] = useState<{ open: boolean; edit?: Category | null }>({ open: false });
  const [catForm, setCatForm] = useState({
    code: "",
    name: "",
    parentId: null as number | null,
    defaultValuationMethod: "WAC",
    taxRatePct: 0,
  });

  // Unit Form State
  const [unitModal, setUnitModal] = useState<{ open: boolean; edit?: UnitOfMeasure | null }>({ open: false });
  const [unitForm, setUnitForm] = useState<{
    code: string;
    name: string;
    symbol: string;
    dimension: UnitDimension;
    isBaseUnit: boolean;
  }>({
    code: "",
    name: "",
    symbol: "",
    dimension: "MASS",
    isBaseUnit: false,
  });

  // Conversion Form State
  const [convModal, setConvModal] = useState<{ open: boolean; edit?: UnitConversion | null }>({ open: false });
  const [convForm, setConvForm] = useState({
    fromUnitId: 0,
    toUnitId: 0,
    factor: 1,
    itemId: null as number | null,
  });

  // Delete Target Modal
  const [deleteTarget, setDeleteTarget] = useState<{ type: "category" | "unit" | "conversion"; id: number; label: string } | null>(null);

  // Interactive Calculator State
  const [calcQty, setCalcQty] = useState<number>(10);
  const [calcFrom, setCalcFrom] = useState<string>("KG");
  const [calcTo, setCalcTo] = useState<string>("G");
  const [calcItemId, setCalcItemId] = useState<number | null>(null);

  const calcResult = useMemo(() => {
    return convertUnits(calcQty, calcFrom, calcTo, calcItemId, conversions, units);
  }, [calcQty, calcFrom, calcTo, calcItemId, conversions, units]);

  // Refresh all master data
  const refreshAll = () => {
    categoriesApi.reload();
    unitsApi.reload();
    conversionsApi.reload();
    if (onRefreshItems) onRefreshItems();
  };

  // Category Submit
  const handleCatSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (catModal.edit) {
        await apiReq("PATCH", `/master-data/categories/${catModal.edit.id}`, catForm);
        setToast(`Category ${catForm.code} updated`);
      } else {
        await apiReq("POST", "/master-data/categories", catForm);
        setToast(`Category ${catForm.code} created`);
      }
      setCatModal({ open: false });
      categoriesApi.reload();
      if (onRefreshItems) onRefreshItems();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  // Unit Submit
  const handleUnitSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (unitModal.edit) {
        await apiReq("PATCH", `/master-data/units/${unitModal.edit.id}`, unitForm);
        setToast(`Unit ${unitForm.code} updated`);
      } else {
        await apiReq("POST", "/master-data/units", unitForm);
        setToast(`Unit ${unitForm.code} created`);
      }
      setUnitModal({ open: false });
      unitsApi.reload();
      if (onRefreshItems) onRefreshItems();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  // Conversion Submit
  const handleConvSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (convModal.edit) {
        await apiReq("PATCH", `/master-data/conversions/${convModal.edit.id}`, { factor: convForm.factor });
        setToast(`Conversion rule updated`);
      } else {
        await apiReq("POST", "/master-data/conversions", convForm);
        setToast(`Conversion rule created`);
      }
      setConvModal({ open: false });
      conversionsApi.reload();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  // Delete Action
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      if (deleteTarget.type === "category") await apiReq("DELETE", `/master-data/categories/${deleteTarget.id}`);
      else if (deleteTarget.type === "unit") await apiReq("DELETE", `/master-data/units/${deleteTarget.id}`);
      else if (deleteTarget.type === "conversion") await apiReq("DELETE", `/master-data/conversions/${deleteTarget.id}`);
      setToast(`${deleteTarget.label} deleted`);
      setDeleteTarget(null);
      refreshAll();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const loading = categoriesApi.loading || unitsApi.loading || conversionsApi.loading;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
      {(categoriesApi.error || unitsApi.error || conversionsApi.error) && (
        <ErrorBanner message={categoriesApi.error || unitsApi.error || conversionsApi.error || ""} />
      )}

      {/* Modern Subtabs Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: 10 }}>
        <div className="tabs" style={{ display: "flex", gap: 4, margin: 0, border: "none" }}>
          <button
            type="button"
            className={`tab ${subTab === "categories" ? "active" : ""}`}
            onClick={() => setSubTab("categories")}
            style={{
              padding: "8px 14px",
              fontWeight: 600,
              fontSize: 13,
              background: "none",
              border: "none",
              borderBottom: subTab === "categories" ? "3px solid var(--amber)" : "3px solid transparent",
              cursor: "pointer",
              color: subTab === "categories" ? "var(--amber)" : "var(--muted)",
            }}
          >
            🏷️ Item Categories ({categories.length})
          </button>
          <button
            type="button"
            className={`tab ${subTab === "units" ? "active" : ""}`}
            onClick={() => setSubTab("units")}
            style={{
              padding: "8px 14px",
              fontWeight: 600,
              fontSize: 13,
              background: "none",
              border: "none",
              borderBottom: subTab === "units" ? "3px solid var(--amber)" : "3px solid transparent",
              cursor: "pointer",
              color: subTab === "units" ? "var(--amber)" : "var(--muted)",
            }}
          >
            📏 Units of Measure ({units.length})
          </button>
          <button
            type="button"
            className={`tab ${subTab === "conversions" ? "active" : ""}`}
            onClick={() => setSubTab("conversions")}
            style={{
              padding: "8px 14px",
              fontWeight: 600,
              fontSize: 13,
              background: "none",
              border: "none",
              borderBottom: subTab === "conversions" ? "3px solid var(--amber)" : "3px solid transparent",
              cursor: "pointer",
              color: subTab === "conversions" ? "var(--amber)" : "var(--muted)",
            }}
          >
            🔄 Conversion Rules ({conversions.length})
          </button>
          <button
            type="button"
            className={`tab ${subTab === "calculator" ? "active" : ""}`}
            onClick={() => setSubTab("calculator")}
            style={{
              padding: "8px 14px",
              fontWeight: 600,
              fontSize: 13,
              background: "none",
              border: "none",
              borderBottom: subTab === "calculator" ? "3px solid var(--amber)" : "3px solid transparent",
              cursor: "pointer",
              color: subTab === "calculator" ? "var(--amber)" : "var(--muted)",
            }}
          >
            ⚡ Converter Playground
          </button>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn ghost sm" onClick={refreshAll}>
            ↻ Sync
          </button>
          {subTab === "categories" && (
            <button
              type="button"
              className="btn sm"
              onClick={() => {
                setCatForm({ code: "", name: "", parentId: null, defaultValuationMethod: "WAC", taxRatePct: 0 });
                setCatModal({ open: true, edit: null });
              }}
            >
              + New Category
            </button>
          )}
          {subTab === "units" && (
            <button
              type="button"
              className="btn sm"
              onClick={() => {
                setUnitForm({ code: "", name: "", symbol: "", dimension: "MASS", isBaseUnit: false });
                setUnitModal({ open: true, edit: null });
              }}
            >
              + New Unit
            </button>
          )}
          {subTab === "conversions" && (
            <button
              type="button"
              className="btn sm"
              onClick={() => {
                setConvForm({
                  fromUnitId: units[0]?.id || 0,
                  toUnitId: units[1]?.id || 0,
                  factor: 1,
                  itemId: null,
                });
                setConvModal({ open: true, edit: null });
              }}
            >
              + New Conversion Rule
            </button>
          )}
        </div>
      </div>

      {loading && <Loading />}

      {/* ========================================================================= */}
      {/* 1. CATEGORIES SUBTAB */}
      {/* ========================================================================= */}
      {subTab === "categories" && (
        <div className="card" style={{ padding: 16 }}>
          <ListToolbar
            q={catQ}
            setQ={setCatQ}
            rows={filteredCats}
            columns={[
              { key: "code", label: "Category Code" },
              { key: "name", label: "Category Name" },
              { key: "defaultValuationMethod", label: "Valuation" },
            ]}
            filename="item_categories"
          />

          <div className="tbl-wrap" style={{ marginTop: 8 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 140 }}>Code</th>
                  <th>Name</th>
                  <th>Parent Category</th>
                  <th style={{ width: 110 }}>Valuation</th>
                  <th className="num" style={{ width: 100 }}>Tax Rate</th>
                  <th className="num" style={{ width: 100 }}>Items</th>
                  <th style={{ width: 120, textAlign: "right" }}></th>
                </tr>
              </thead>
              <tbody>
                {(filteredCats ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>
                      No categories found. Click "+ New Category" to create one.
                    </td>
                  </tr>
                ) : (
                  (filteredCats ?? []).map((c) => (
                    <tr key={c.id}>
                      <td className="mono" style={{ fontWeight: 600, color: "var(--amber)" }}>
                        {c.code}
                      </td>
                      <td style={{ fontWeight: 500 }}>{c.name}</td>
                      <td>
                        {c.parent ? (
                          <span className="badge gray" style={{ fontSize: 11 }}>
                            ↳ {c.parent.code} - {c.parent.name}
                          </span>
                        ) : (
                          <span style={{ color: "var(--muted)", fontSize: 12 }}>— (Root)</span>
                        )}
                      </td>
                      <td>
                        <span className="badge amber">{c.defaultValuationMethod || "WAC"}</span>
                      </td>
                      <td className="num">{c.taxRatePct > 0 ? `${c.taxRatePct}%` : "0%"}</td>
                      <td className="num">
                        <span className="badge gray">{c._count?.items ?? 0}</span>
                      </td>
                      <td>
                        <div className="row-actions" style={{ justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            className="link"
                            onClick={() => {
                              setCatForm({
                                code: c.code,
                                name: c.name,
                                parentId: c.parentId,
                                defaultValuationMethod: c.defaultValuationMethod || "WAC",
                                taxRatePct: c.taxRatePct,
                              });
                              setCatModal({ open: true, edit: c });
                            }}
                          >
                            edit
                          </button>
                          <button
                            type="button"
                            className="link danger"
                            onClick={() => setDeleteTarget({ type: "category", id: c.id, label: `Category "${c.name}"` })}
                          >
                            delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. UNITS OF MEASURE SUBTAB */}
      {/* ========================================================================= */}
      {subTab === "units" && (
        <div className="card" style={{ padding: 16 }}>
          <ListToolbar
            q={unitQ}
            setQ={setUnitQ}
            rows={filteredUnits}
            columns={[
              { key: "code", label: "Unit Code" },
              { key: "name", label: "Unit Name" },
              { key: "dimension", label: "Dimension" },
            ]}
            filename="units_of_measure"
          />

          <div className="tbl-wrap" style={{ marginTop: 8 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 120 }}>Unit Code</th>
                  <th>Unit Name</th>
                  <th style={{ width: 90 }}>Symbol</th>
                  <th style={{ width: 130 }}>Dimension</th>
                  <th style={{ width: 120 }}>Base Status</th>
                  <th className="num" style={{ width: 100 }}>SKU Usages</th>
                  <th style={{ width: 120, textAlign: "right" }}></th>
                </tr>
              </thead>
              <tbody>
                {(filteredUnits ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>
                      No units defined yet. Click "+ New Unit" to create one.
                    </td>
                  </tr>
                ) : (
                  (filteredUnits ?? []).map((u) => (
                    <tr key={u.id}>
                      <td className="mono" style={{ fontWeight: 600, color: "var(--ink)" }}>
                        {u.code}
                      </td>
                      <td style={{ fontWeight: 500 }}>{u.name}</td>
                      <td className="mono">{u.symbol || u.code.toLowerCase()}</td>
                      <td>
                        <span
                          className={`badge ${
                            u.dimension === "MASS"
                              ? "amber"
                              : u.dimension === "VOLUME"
                              ? "blue"
                              : u.dimension === "COUNT"
                              ? "green"
                              : "gray"
                          }`}
                        >
                          {u.dimension}
                        </span>
                      </td>
                      <td>
                        {u.isBaseUnit ? (
                          <span className="badge green">★ Base Unit</span>
                        ) : (
                          <span style={{ color: "var(--muted)", fontSize: 12 }}>Derived</span>
                        )}
                      </td>
                      <td className="num">
                        <span className="badge gray">
                          {(u._count?.baseItems ?? 0) + (u._count?.purchaseItems ?? 0) + (u._count?.recipeItems ?? 0)}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions" style={{ justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            className="link"
                            onClick={() => {
                              setUnitForm({
                                code: u.code,
                                name: u.name,
                                symbol: u.symbol || "",
                                dimension: u.dimension,
                                isBaseUnit: u.isBaseUnit,
                              });
                              setUnitModal({ open: true, edit: u });
                            }}
                          >
                            edit
                          </button>
                          <button
                            type="button"
                            className="link danger"
                            onClick={() => setDeleteTarget({ type: "unit", id: u.id, label: `Unit "${u.code}"` })}
                          >
                            delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. CONVERSION RULES SUBTAB */}
      {/* ========================================================================= */}
      {subTab === "conversions" && (
        <div className="card" style={{ padding: 16 }}>
          <ListToolbar
            q={convQ}
            setQ={setConvQ}
            rows={filteredConvs}
            columns={[
              { key: "fromUnit.code", label: "From Unit" },
              { key: "toUnit.code", label: "To Unit" },
              { key: "item.code", label: "Item Scope" },
            ]}
            filename="unit_conversions"
          />

          <div className="tbl-wrap" style={{ marginTop: 8 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 220 }}>Scope / Target Item</th>
                  <th style={{ width: 140 }}>From Unit</th>
                  <th style={{ textAlign: "center", width: 180 }}>Conversion Formula</th>
                  <th style={{ width: 140 }}>To Unit</th>
                  <th>Inverse Rate</th>
                  <th style={{ width: 120, textAlign: "right" }}></th>
                </tr>
              </thead>
              <tbody>
                {(filteredConvs ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>
                      No custom conversion rules configured. Standard SI conversions apply automatically.
                    </td>
                  </tr>
                ) : (
                  (filteredConvs ?? []).map((cv) => (
                    <tr key={cv.id}>
                      <td>
                        {cv.item ? (
                          <div>
                            <span className="badge amber" style={{ fontSize: 10, marginRight: 6 }}>
                              SKU PACK
                            </span>
                            <span className="mono" style={{ fontWeight: 600 }}>{cv.item.code}</span>
                            <div style={{ fontSize: 12, color: "var(--muted)" }}>{cv.item.description}</div>
                          </div>
                        ) : (
                          <span className="badge green" style={{ fontSize: 11 }}>
                            🌐 Global Rule
                          </span>
                        )}
                      </td>
                      <td className="mono">
                        <strong>{cv.fromUnit?.code}</strong> <span style={{ color: "var(--muted)", fontSize: 11 }}>({cv.fromUnit?.name})</span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span
                          className="mono"
                          style={{
                            background: "var(--paper-2)",
                            padding: "3px 8px",
                            borderRadius: 4,
                            fontWeight: 700,
                            fontSize: 12.5,
                            border: "1px solid var(--line)",
                          }}
                        >
                          1 {cv.fromUnit?.code} = {cv.factor} {cv.toUnit?.code}
                        </span>
                      </td>
                      <td className="mono">
                        <strong>{cv.toUnit?.code}</strong> <span style={{ color: "var(--muted)", fontSize: 11 }}>({cv.toUnit?.name})</span>
                      </td>
                      <td className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
                        1 {cv.toUnit?.code} = {roundPrecision(1 / cv.factor)} {cv.fromUnit?.code}
                      </td>
                      <td>
                        <div className="row-actions" style={{ justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            className="link"
                            onClick={() => {
                              setConvForm({
                                fromUnitId: cv.fromUnitId,
                                toUnitId: cv.toUnitId,
                                factor: cv.factor,
                                itemId: cv.itemId ?? null,
                              });
                              setConvModal({ open: true, edit: cv });
                            }}
                          >
                            edit
                          </button>
                          <button
                            type="button"
                            className="link danger"
                            onClick={() =>
                              setDeleteTarget({
                                type: "conversion",
                                id: cv.id,
                                label: `Rule (1 ${cv.fromUnit?.code} = ${cv.factor} ${cv.toUnit?.code})`,
                              })
                            }
                          >
                            delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. SMART CONVERSION PLAYGROUND */}
      {/* ========================================================================= */}
      {subTab === "calculator" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div className="card">
            <h2>⚡ Interactive Unit Converter</h2>
            <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>
              Test real-time unit conversions across standard mass, volume, and custom item packaging factors (e.g. 1 Box of Milk = 12 Liters).
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="field">
                <label>Item Context (Optional for custom pack ratios):</label>
                <select
                  value={calcItemId ?? ""}
                  onChange={(e) => setCalcItemId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">-- No specific item (Global / Dimension rule) --</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.code} - {it.description} ({it.uom})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="field">
                  <label>Quantity:</label>
                  <input
                    type="number"
                    value={calcQty}
                    onChange={(e) => setCalcQty(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="field">
                  <label>From Unit:</label>
                  <select value={calcFrom} onChange={(e) => setCalcFrom(e.target.value)}>
                    {units.map((u) => (
                      <option key={u.id} value={u.code}>
                        {u.code} ({u.name} - {u.dimension})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "center" }}>
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => {
                    const temp = calcFrom;
                    setCalcFrom(calcTo);
                    setCalcTo(temp);
                  }}
                  title="Swap units"
                >
                  ⇅ Swap Direction
                </button>
              </div>

              <div className="field">
                <label>Target Unit (To):</label>
                <select value={calcTo} onChange={(e) => setCalcTo(e.target.value)}>
                  {units.map((u) => (
                    <option key={u.id} value={u.code}>
                      {u.code} ({u.name} - {u.dimension})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div
            className="card"
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              textAlign: "center",
              background: "linear-gradient(135deg, var(--card) 0%, var(--paper-2) 100%)",
            }}
          >
            <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)", fontWeight: 600 }}>
              Calculated Equivalent
            </span>
            <div style={{ fontFamily: "var(--serif)", fontSize: 36, fontWeight: 700, color: "var(--amber)", margin: "14px 0" }}>
              {formatUnitQty(calcResult.convertedQty, calcTo, 4)}
            </div>
            <div
              className={`badge ${calcResult.success ? "green" : "red"}`}
              style={{ fontSize: 13, padding: "4px 12px", marginBottom: 14 }}
            >
              {calcResult.explanation}
            </div>
            <div className="mono" style={{ fontSize: 12, color: "var(--muted)", maxWidth: 320 }}>
              {calcQty} {calcFrom} × {calcResult.factor} = {calcResult.convertedQty} {calcTo}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* Category Modal */}
      {catModal.open && (
        <Modal title={catModal.edit ? `Edit Category: ${catModal.edit.name}` : "New Item Category"} onClose={() => setCatModal({ open: false })}>
          <form onSubmit={handleCatSubmit}>
            <div className="field">
              <label>Category Code *</label>
              <input
                type="text"
                required
                value={catForm.code}
                onChange={(e) => setCatForm({ ...catForm, code: e.target.value.toUpperCase() })}
                placeholder="e.g. CAT-DAIRY"
              />
            </div>
            <div className="field">
              <label>Category Name *</label>
              <input
                type="text"
                required
                value={catForm.name}
                onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                placeholder="e.g. Dairy & Eggs"
              />
            </div>
            <div className="field">
              <label>Parent Category (Hierarchy)</label>
              <select
                value={catForm.parentId ?? ""}
                onChange={(e) => setCatForm({ ...catForm, parentId: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">-- No Parent (Root Category) --</option>
                {categories
                  .filter((c) => !catModal.edit || c.id !== catModal.edit.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} - {c.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="form-row">
              <div className="field">
                <label>Default Valuation</label>
                <select
                  value={catForm.defaultValuationMethod}
                  onChange={(e) => setCatForm({ ...catForm, defaultValuationMethod: e.target.value })}
                >
                  <option value="WAC">Weighted Average Cost (WAC)</option>
                  <option value="FIFO">First-In First-Out (FIFO)</option>
                </select>
              </div>
              <div className="field">
                <label>Tax Rate (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={catForm.taxRatePct}
                  onChange={(e) => setCatForm({ ...catForm, taxRatePct: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button type="button" className="btn ghost" onClick={() => setCatModal({ open: false })}>
                Cancel
              </button>
              <button type="submit" className="btn" disabled={busy}>
                {busy ? "Saving..." : "Save Category"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Unit Modal */}
      {unitModal.open && (
        <Modal title={unitModal.edit ? `Edit Unit: ${unitModal.edit.code}` : "New Unit of Measure"} onClose={() => setUnitModal({ open: false })}>
          <form onSubmit={handleUnitSubmit}>
            <div className="form-row">
              <div className="field">
                <label>Unit Code *</label>
                <input
                  type="text"
                  required
                  value={unitForm.code}
                  onChange={(e) => setUnitForm({ ...unitForm, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. KG, ML, BOX"
                />
              </div>
              <div className="field">
                <label>Symbol</label>
                <input
                  type="text"
                  value={unitForm.symbol}
                  onChange={(e) => setUnitForm({ ...unitForm, symbol: e.target.value })}
                  placeholder="e.g. kg, ml, bx"
                />
              </div>
            </div>
            <div className="field">
              <label>Unit Name *</label>
              <input
                type="text"
                required
                value={unitForm.name}
                onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
                placeholder="e.g. Kilogram, Milliliter, Master Box"
              />
            </div>
            <div className="field">
              <label>Physical Dimension *</label>
              <select
                value={unitForm.dimension}
                onChange={(e) => setUnitForm({ ...unitForm, dimension: e.target.value as UnitDimension })}
              >
                <option value="MASS">MASS (kg, g, mg, lb, ton)</option>
                <option value="VOLUME">VOLUME (L, ml, cl, gallon)</option>
                <option value="COUNT">COUNT (pcs, each, dozen, pack, box)</option>
                <option value="LENGTH">LENGTH (m, cm, mm)</option>
                <option value="AREA">AREA (sqm, sqft)</option>
              </select>
            </div>
            <div className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
              <input
                type="checkbox"
                id="isBaseUnitCheck"
                checked={unitForm.isBaseUnit}
                onChange={(e) => setUnitForm({ ...unitForm, isBaseUnit: e.target.checked })}
              />
              <label htmlFor="isBaseUnitCheck" style={{ margin: 0, cursor: "pointer", textTransform: "none", fontSize: 13, color: "var(--ink)" }}>
                Set as Base Unit for this Dimension
              </label>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button type="button" className="btn ghost" onClick={() => setUnitModal({ open: false })}>
                Cancel
              </button>
              <button type="submit" className="btn" disabled={busy}>
                {busy ? "Saving..." : "Save Unit"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Conversion Modal */}
      {convModal.open && (
        <Modal
          title={convModal.edit ? "Edit Conversion Factor" : "New Unit Conversion Rule"}
          onClose={() => setConvModal({ open: false })}
        >
          <form onSubmit={handleConvSubmit}>
            <div className="field">
              <label>Target Item (Leave blank for global dimension conversion):</label>
              <select
                value={convForm.itemId ?? ""}
                onChange={(e) => setConvForm({ ...convForm, itemId: e.target.value ? Number(e.target.value) : null })}
                disabled={!!convModal.edit}
              >
                <option value="">-- Global Rule (Applies ERP-wide) --</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.code} - {it.description}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <div className="field">
                <label>From Unit *</label>
                <select
                  value={convForm.fromUnitId}
                  onChange={(e) => setConvForm({ ...convForm, fromUnitId: Number(e.target.value) })}
                  disabled={!!convModal.edit}
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.code} ({u.name})
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>To Unit *</label>
                <select
                  value={convForm.toUnitId}
                  onChange={(e) => setConvForm({ ...convForm, toUnitId: Number(e.target.value) })}
                  disabled={!!convModal.edit}
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.code} ({u.name})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label>Factor (Multiplier: 1 From Unit = ? To Units) *</label>
              <input
                type="number"
                required
                step="any"
                min="0.000001"
                value={convForm.factor}
                onChange={(e) => setConvForm({ ...convForm, factor: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button type="button" className="btn ghost" onClick={() => setConvModal({ open: false })}>
                Cancel
              </button>
              <button type="submit" className="btn" disabled={busy}>
                {busy ? "Saving..." : "Save Rule"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Confirm Delete */}
      {deleteTarget && (
        <ConfirmDialog
          title={`Delete ${deleteTarget.label}?`}
          message={`Are you sure you want to delete this ${deleteTarget.type}? This action cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

function roundPrecision(val: number, decimals = 4): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * multiplier) / multiplier;
}
