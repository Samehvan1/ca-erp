import { FormEvent, useState } from "react";
import { Badge, ConfirmDialog, Empty, ErrorBanner, HistoryButton, ListToolbar, Loading, Modal, Toast, apiReq, useApi, useListFilter } from "../components";

interface Recipe {
  id: number;
  code: string;
  name: string;
  version: number;
  active: boolean;
  type: string;
  projectId: number;
  project: { name: string };
  items: { id: number; itemId: number; brandVariantId: number | null; quantity: number; yieldFactor: number; shrinkagePct: number; item: { code: string; description: string } }[];
}

interface CostLine {
  itemId: number;
  quantity: number;
  yieldFactor: number;
  shrinkagePct: number;
  wac: number;
  lineCost: number;
}

interface Waste {
  id: number;
  quantity: number;
  reason: string;
  status: string;
  warehouseId: number;
  itemId: number;
  brandVariantId: number | null;
  item: { description: string };
  warehouse: { code: string };
  loggedBy: { name: string };
}

interface Variance {
  id: number;
  period: string;
  theoreticalQty: number;
  actualQty: number;
  varianceQty: number;
  variancePct: number;
  item: { description: string };
  warehouse: { code: string };
}

interface Item {
  id: number;
  code: string;
  description: string;
  brandVariants: { id: number; name: string; sku: string }[];
}

interface Warehouse {
  id: number;
  code: string;
  name: string;
  type: string;
}

interface RecipeRow {
  itemId: string;
  brandVariantId: string;
  quantity: string;
  yieldFactor: string;
  shrinkagePct: string;
}

interface MenuMapping {
  id: number;
  posMenuId: string;
  terminalId: number | null;
  itemId: number;
  brandVariantId: number | null;
  item: { code: string; description: string };
  brandVariant: { name: string; sku: string } | null;
  terminal: { code: string; name: string } | null;
}

interface PosTerminal {
  id: number;
  code: string;
  name: string;
  posSystem: string;
  active: boolean;
}

const emptyRow: RecipeRow = { itemId: "", brandVariantId: "", quantity: "", yieldFactor: "", shrinkagePct: "" };

export default function Recipes() {
  const [tab, setTab] = useState<"recipes" | "waste" | "variances" | "mappings">("recipes");
  const [costId, setCostId] = useState<number | null>(null);
  const recipes = useApi<Recipe[]>("/recipes/recipes");
  const cost = useApi<{ code: string; name: string; version: number; totalCost: number; lines: CostLine[] } | null>(costId ? `/recipes/recipes/${costId}/cost` : null, [costId]);
  const waste = useApi<Waste[]>("/recipes/waste");
  const variances = useApi<Variance[]>("/recipes/variances");
  const mappings = useApi<MenuMapping[]>("/recipes/menu-mappings");
  const terminals = useApi<PosTerminal[]>("/recipes/pos-terminals");
  const items = useApi<Item[]>("/inventory/items");
  const warehouses = useApi<Warehouse[]>("/inventory/warehouses");

  const recipeFilter = useListFilter<Recipe>(recipes.data, ["code", "name", "type"]);
  const mappingFilter = useListFilter<MenuMapping>(mappings.data, ["posMenuId", "item", "terminal"]);

  const [showRecipe, setShowRecipe] = useState(false);
  const [showWaste, setShowWaste] = useState(false);
  const [showMapping, setShowMapping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [viewRecipe, setViewRecipe] = useState<Recipe | null>(null);
  const [editRecipe, setEditRecipe] = useState<Recipe | null>(null);
  const [deleteRecipe, setDeleteRecipe] = useState<Recipe | null>(null);
  const [viewWaste, setViewWaste] = useState<Waste | null>(null);
  const [editWaste, setEditWaste] = useState<Waste | null>(null);
  const [deleteWaste, setDeleteWaste] = useState<Waste | null>(null);

  const [recipeForm, setRecipeForm] = useState({ code: "", name: "", projectId: "", type: "MENU_ITEM" });
  const [recipeItems, setRecipeItems] = useState<RecipeRow[]>([emptyRow]);
  const [wasteForm, setWasteForm] = useState({ warehouseId: "", itemId: "", brandVariantId: "", quantity: "", reason: "" });
  const [mappingForm, setMappingForm] = useState({ posMenuId: "", terminalId: "", itemId: "", brandVariantId: "" });

  const updateRecipeRow = (i: number, key: keyof RecipeRow, value: string) => {
    setRecipeItems((rows) => rows.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  };
  const addRecipeRow = () => setRecipeItems((rows) => [...rows, emptyRow]);
  const removeRecipeRow = (i: number) => setRecipeItems((rows) => rows.filter((_, idx) => idx !== i));

  const submitRecipe = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const rows = recipeItems.filter((r) => r.itemId && r.quantity);
      if (!rows.length) throw new Error("Add at least one item with a quantity");
      const body: Record<string, unknown> = {
        code: recipeForm.code,
        name: recipeForm.name,
        projectId: Number(recipeForm.projectId),
        type: recipeForm.type,
        items: rows.map((r) => {
          const line: Record<string, unknown> = { itemId: Number(r.itemId), quantity: Number(r.quantity) };
          if (r.brandVariantId) line.brandVariantId = Number(r.brandVariantId);
          if (r.yieldFactor) line.yieldFactor = Number(r.yieldFactor);
          if (r.shrinkagePct) line.shrinkagePct = Number(r.shrinkagePct);
          return line;
        }),
      };
      if (editRecipe) {
        await apiReq("PUT", `/recipes/recipes/${editRecipe.id}`, body);
        setMsg("Saved");
      } else {
        await apiReq("POST", "/recipes/recipes", body);
        setMsg("Created");
      }
      recipes.reload();
      setShowRecipe(false);
      setEditRecipe(null);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const openEditRecipe = (r: Recipe) => {
    setErr(null);
    setRecipeForm({ code: r.code, name: r.name, projectId: String(r.projectId), type: r.type });
    setRecipeItems(
      r.items.map((it) => ({
        itemId: String(it.itemId),
        brandVariantId: it.brandVariantId ? String(it.brandVariantId) : "",
        quantity: String(it.quantity),
        yieldFactor: String(it.yieldFactor),
        shrinkagePct: String(it.shrinkagePct),
      }))
    );
    setEditRecipe(r);
    setShowRecipe(true);
  };

  const confirmDeleteRecipe = async () => {
    if (!deleteRecipe) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await apiReq("DELETE", `/recipes/recipes/${deleteRecipe.id}`);
      setDeleteRecipe(null);
      setMsg("Deleted");
      recipes.reload();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Delete failed");
      setDeleteRecipe(null);
    } finally {
      setBusy(false);
    }
  };

  const submitWaste = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {
        warehouseId: Number(wasteForm.warehouseId),
        itemId: Number(wasteForm.itemId),
        quantity: Number(wasteForm.quantity),
        reason: wasteForm.reason,
      };
      if (wasteForm.brandVariantId) body.brandVariantId = Number(wasteForm.brandVariantId);
      if (editWaste) {
        await apiReq("PATCH", `/recipes/waste/${editWaste.id}`, body);
        setMsg("Saved");
      } else {
        await apiReq("POST", "/recipes/waste", body);
        setMsg("Created");
      }
      waste.reload();
      setShowWaste(false);
      setEditWaste(null);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const openEditWaste = (w: Waste) => {
    setErr(null);
    setWasteForm({
      warehouseId: String(w.warehouseId),
      itemId: String(w.itemId),
      brandVariantId: w.brandVariantId ? String(w.brandVariantId) : "",
      quantity: String(w.quantity),
      reason: w.reason,
    });
    setEditWaste(w);
    setShowWaste(true);
  };

  const confirmDeleteWaste = async () => {
    if (!deleteWaste) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await apiReq("DELETE", `/recipes/waste/${deleteWaste.id}`);
      setDeleteWaste(null);
      setMsg("Deleted");
      waste.reload();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Delete failed");
      setDeleteWaste(null);
    } finally {
      setBusy(false);
    }
  };

  const submitMapping = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {
        posMenuId: mappingForm.posMenuId,
        itemId: Number(mappingForm.itemId),
      };
      if (mappingForm.terminalId) body.terminalId = Number(mappingForm.terminalId);
      if (mappingForm.brandVariantId) body.brandVariantId = Number(mappingForm.brandVariantId);
      await apiReq("POST", "/recipes/menu-mappings", body);
      setMsg("Mapping created");
      mappings.reload();
      setShowMapping(false);
      setMappingForm({ posMenuId: "", terminalId: "", itemId: "", brandVariantId: "" });
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="topbar">
        <h1>Recipes &amp; Costing</h1>
        <div className="crumb">Recipes · Waste · Variance · Menu Mappings</div>
      </div>

      <div className="tabs">
        <button className={tab === "recipes" ? "active" : ""} onClick={() => setTab("recipes")}>
          Recipes ({recipes.data?.length ?? 0})
        </button>
        <button className={tab === "waste" ? "active" : ""} onClick={() => setTab("waste")}>
          Waste ({waste.data?.length ?? 0})
        </button>
        <button className={tab === "variances" ? "active" : ""} onClick={() => setTab("variances")}>
          Variances ({variances.data?.length ?? 0})
        </button>
        <button className={tab === "mappings" ? "active" : ""} onClick={() => setTab("mappings")}>
          Menu Mappings ({mappings.data?.length ?? 0})
        </button>
      </div>

      {tab === "recipes" && (
        <div className="card">
          <div className="toolbar">
            <div className="spacer" />
            <button className="btn amber" onClick={() => setShowRecipe(true)}>
              + New recipe
            </button>
          </div>
          <ListToolbar
            q={recipeFilter.q}
            setQ={recipeFilter.setQ}
            rows={recipeFilter.filtered}
            columns={[
              { key: "code", label: "Code" },
              { key: "name", label: "Name" },
              { key: "type", label: "Type" },
            ]}
            filename="recipes"
          />
          {recipes.error && <ErrorBanner message={recipes.error} />}
          {recipes.loading ? (
            <Loading />
          ) : !recipes.data?.length ? (
            <Empty />
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Project</th>
                    <th>Type</th>
                    <th>Version</th>
                    <th>Ingredients</th>
                    <th>Status</th>
                    <th>Cost</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(recipeFilter.filtered ?? []).map((r) => (
                    <tr key={r.id}>
                      <td className="mono">{r.code}</td>
                      <td>{r.name}</td>
                      <td>{r.project.name}</td>
                      <td>{r.type.replace(/_/g, " ")}</td>
                      <td className="num">v{r.version}</td>
                      <td className="num">{r.items.length}</td>
                      <td>
                        <Badge status={r.active ? "ACTIVE" : "INACTIVE"} />
                      </td>
                      <td>
                        <button className="link" onClick={() => setCostId(costId === r.id ? null : r.id)}>
                          {costId === r.id ? "hide" : "cost"}
                        </button>
                      </td>
                      <td>
                        <div className="row-actions">
                          <HistoryButton entityType="Recipe" entityId={r.id} />
                          <button className="link" onClick={() => setViewRecipe(r)}>
                            view
                          </button>
                          <button className="link" onClick={() => openEditRecipe(r)}>
                            edit
                          </button>
                          <button
                            className="link danger"
                            onClick={() => {
                              setErr(null);
                              setDeleteRecipe(r);
                            }}
                          >
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
          {costId && (
            <div className="sub-card">
              {cost.loading ? (
                <Loading />
              ) : cost.error ? (
                <ErrorBanner message={cost.error} />
              ) : cost.data ? (
                <>
                  <div className="sub-head">
                    <strong>
                      {cost.data.code} · {cost.data.name} (v{cost.data.version})
                    </strong>
                    <span className="num">
                      Total cost: <strong>{cost.data.totalCost.toFixed(2)}</strong>
                    </span>
                  </div>
                  <div className="tbl-wrap">
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Qty</th>
                          <th>Yield</th>
                          <th>Shrink %</th>
                          <th>WAC</th>
                          <th>Line cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cost.data.lines.map((l, i) => (
                          <tr key={i}>
                            <td className="mono">{l.itemId}</td>
                            <td className="num">{l.quantity}</td>
                            <td className="num">{l.yieldFactor}</td>
                            <td className="num">{l.shrinkagePct}</td>
                            <td className="num">{l.wac.toFixed(2)}</td>
                            <td className="num">{l.lineCost.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>
      )}

      {tab === "waste" && (
        <div className="card">
          <div className="toolbar">
            <div className="spacer" />
            <button className="btn amber" onClick={() => setShowWaste(true)}>
              + Log waste
            </button>
          </div>
          {waste.error && <ErrorBanner message={waste.error} />}
          {waste.loading ? (
            <Loading />
          ) : !waste.data?.length ? (
            <Empty text="No waste logged." />
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Warehouse</th>
                    <th>Qty</th>
                    <th>Reason</th>
                    <th>Logged by</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {waste.data.map((w) => (
                    <tr key={w.id}>
                      <td>{w.item.description}</td>
                      <td className="mono">{w.warehouse.code}</td>
                      <td className="num">{w.quantity}</td>
                      <td>{w.reason}</td>
                      <td>{w.loggedBy.name}</td>
                      <td>
                        <Badge status={w.status} />
                      </td>
                      <td>
                        <div className="row-actions">
                          <button className="link" onClick={() => setViewWaste(w)}>
                            view
                          </button>
                          <button className="link" onClick={() => openEditWaste(w)}>
                            edit
                          </button>
                          {w.status === "PENDING" && (
                            <button
                              className="link danger"
                              onClick={() => {
                                setErr(null);
                                setDeleteWaste(w);
                              }}
                            >
                              delete
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

      {tab === "variances" && (
        <div className="card">
          {variances.error && <ErrorBanner message={variances.error} />}
          {variances.loading ? (
            <Loading />
          ) : !variances.data?.length ? (
            <Empty text="No variance records yet." />
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Item</th>
                    <th>Warehouse</th>
                    <th>Theoretical</th>
                    <th>Actual</th>
                    <th>Variance</th>
                    <th>%</th>
                  </tr>
                </thead>
                <tbody>
                  {variances.data.map((v) => (
                    <tr key={v.id}>
                      <td className="mono">{v.period}</td>
                      <td>{v.item.description}</td>
                      <td className="mono">{v.warehouse.code}</td>
                      <td className="num">{v.theoreticalQty}</td>
                      <td className="num">{v.actualQty}</td>
                      <td className="num">{v.varianceQty}</td>
                      <td className="num">{v.variancePct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "mappings" && (
        <div className="card">
          <div className="toolbar">
            <div className="spacer" />
            <button className="btn amber" onClick={() => setShowMapping(true)}>
              + New mapping
            </button>
          </div>
          <ListToolbar
            q={mappingFilter.q}
            setQ={mappingFilter.setQ}
            rows={mappingFilter.filtered}
            columns={[
              { key: "posMenuId", label: "POS Menu ID" },
              { key: "item", label: "Item" },
              { key: "terminal", label: "Terminal" },
            ]}
            filename="menu-mappings"
          />
          {mappings.error && <ErrorBanner message={mappings.error} />}
          {mappings.loading ? (
            <Loading />
          ) : !mappings.data?.length ? (
            <Empty text="No menu mappings yet. Map POS menu ids to inventory items." />
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>POS Menu ID</th>
                    <th>Item</th>
                    <th>Brand Variant</th>
                    <th>Terminal</th>
                  </tr>
                </thead>
                <tbody>
                  {(mappingFilter.filtered ?? []).map((m) => (
                    <tr key={m.id}>
                      <td className="mono">{m.posMenuId}</td>
                      <td>
                        {m.item.code} · {m.item.description}
                      </td>
                      <td>{m.brandVariant ? `${m.brandVariant.name} (${m.brandVariant.sku})` : "—"}</td>
                      <td className="mono">{m.terminal ? `${m.terminal.code} · ${m.terminal.name}` : "All terminals"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    {showRecipe && (
        <Modal title={editRecipe ? `Edit Recipe · ${editRecipe.code}` : "New Recipe"} onClose={() => { setShowRecipe(false); setEditRecipe(null); }} wide>
          <form onSubmit={submitRecipe}>
            {err && <ErrorBanner message={err} />}
            <div className="form-row">
              <div className="field">
                <label>Code</label>
                <input value={recipeForm.code} onChange={(e) => setRecipeForm({ ...recipeForm, code: e.target.value })} required />
              </div>
              <div className="field">
                <label>Name</label>
                <input value={recipeForm.name} onChange={(e) => setRecipeForm({ ...recipeForm, name: e.target.value })} required />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>Project ID</label>
                <input type="number" value={recipeForm.projectId} onChange={(e) => setRecipeForm({ ...recipeForm, projectId: e.target.value })} required />
              </div>
              <div className="field">
                <label>Type</label>
                <select value={recipeForm.type} onChange={(e) => setRecipeForm({ ...recipeForm, type: e.target.value })}>
                  <option value="MENU_ITEM">Menu Item</option>
                  <option value="PREP">Prep</option>
                  <option value="FINISHED_GOOD">Finished Good</option>
                </select>
              </div>
            </div>
            <div className="sub-head">
              <strong>Items</strong>
            </div>
            {recipeItems.map((row, i) => (
              <div className="form-row" key={i}>
                <div className="field">
                  <label>Item</label>
                  <select value={row.itemId} onChange={(e) => updateRecipeRow(i, "itemId", e.target.value)} required>
                    <option value="">Select item…</option>
                    {(items.data ?? []).map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.code} · {it.description}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Qty</label>
                  <input type="number" min="0.01" step="0.01" value={row.quantity} onChange={(e) => updateRecipeRow(i, "quantity", e.target.value)} required />
                </div>
                <div className="field">
                  <label>Brand Variant</label>
                  <select value={row.brandVariantId} onChange={(e) => updateRecipeRow(i, "brandVariantId", e.target.value)}>
                    <option value="">None</option>
                    {(items.data ?? [])
                      .flatMap((it) => it.brandVariants.map((v) => ({ ...v, itemCode: it.code })))
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.itemCode} · {v.name} ({v.sku})
                        </option>
                      ))}
                  </select>
                </div>
                <div className="field">
                  <label>Yield</label>
                  <input type="number" min="0.01" step="0.01" value={row.yieldFactor} onChange={(e) => updateRecipeRow(i, "yieldFactor", e.target.value)} />
                </div>
                <div className="field">
                  <label>Shrink %</label>
                  <input type="number" min="0" step="0.01" value={row.shrinkagePct} onChange={(e) => updateRecipeRow(i, "shrinkagePct", e.target.value)} />
                </div>
                <button type="button" className="btn ghost sm" onClick={() => removeRecipeRow(i)}>
                  Remove
                </button>
              </div>
            ))}
            <button type="button" className="btn ghost sm" onClick={addRecipeRow}>
              + Add item
            </button>
            <div className="modal-actions">
              <div className="spacer" />
              <button type="button" className="btn ghost" onClick={() => { setShowRecipe(false); setEditRecipe(null); }}>
                Cancel
              </button>
              <button type="submit" className="btn" disabled={busy}>
                {busy ? "Saving…" : editRecipe ? "Save" : "Create"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showWaste && (
        <Modal title={editWaste ? "Edit Waste" : "Log Waste"} onClose={() => { setShowWaste(false); setEditWaste(null); }}>
          <form onSubmit={submitWaste}>
            {err && <ErrorBanner message={err} />}
            <div className="form-row">
              <div className="field">
                <label>Warehouse</label>
                <select value={wasteForm.warehouseId} onChange={(e) => setWasteForm({ ...wasteForm, warehouseId: e.target.value })} required>
                  <option value="">Select warehouse…</option>
                  {(warehouses.data ?? []).map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code} · {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Item</label>
                <select value={wasteForm.itemId} onChange={(e) => setWasteForm({ ...wasteForm, itemId: e.target.value })} required>
                  <option value="">Select item…</option>
                  {(items.data ?? []).map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.code} · {it.description}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>Brand Variant</label>
                <select value={wasteForm.brandVariantId} onChange={(e) => setWasteForm({ ...wasteForm, brandVariantId: e.target.value })}>
                  <option value="">None</option>
                  {(items.data ?? [])
                    .flatMap((it) => it.brandVariants.map((v) => ({ ...v, itemCode: it.code })))
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.itemCode} · {v.name} ({v.sku})
                      </option>
                    ))}
                </select>
              </div>
              <div className="field">
                <label>Quantity</label>
                <input type="number" min="0.01" step="0.01" value={wasteForm.quantity} onChange={(e) => setWasteForm({ ...wasteForm, quantity: e.target.value })} required />
              </div>
            </div>
            <div className="field">
              <label>Reason</label>
              <input value={wasteForm.reason} onChange={(e) => setWasteForm({ ...wasteForm, reason: e.target.value })} required />
            </div>
            <div className="modal-actions">
              <div className="spacer" />
              <button type="button" className="btn ghost" onClick={() => { setShowWaste(false); setEditWaste(null); }}>
                Cancel
              </button>
              <button type="submit" className="btn" disabled={busy}>
                {busy ? "Saving…" : editWaste ? "Save" : "Log waste"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showMapping && (
        <Modal title="New Menu Mapping" onClose={() => setShowMapping(false)}>
          <form onSubmit={submitMapping}>
            {err && <ErrorBanner message={err} />}
            <div className="form-row">
              <div className="field">
                <label>POS Menu ID</label>
                <input value={mappingForm.posMenuId} onChange={(e) => setMappingForm({ ...mappingForm, posMenuId: e.target.value })} placeholder="e.g. 1001" required />
              </div>
              <div className="field">
                <label>Terminal</label>
                <select value={mappingForm.terminalId} onChange={(e) => setMappingForm({ ...mappingForm, terminalId: e.target.value })}>
                  <option value="">All terminals</option>
                  {(terminals.data ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.code} · {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>Item</label>
                <select value={mappingForm.itemId} onChange={(e) => setMappingForm({ ...mappingForm, itemId: e.target.value })} required>
                  <option value="">Select item…</option>
                  {(items.data ?? []).map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.code} · {it.description}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Brand Variant</label>
                <select value={mappingForm.brandVariantId} onChange={(e) => setMappingForm({ ...mappingForm, brandVariantId: e.target.value })}>
                  <option value="">None</option>
                  {(items.data ?? [])
                    .flatMap((it) => it.brandVariants.map((v) => ({ ...v, itemCode: it.code })))
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.itemCode} · {v.name} ({v.sku})
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <div className="spacer" />
              <button type="button" className="btn ghost" onClick={() => setShowMapping(false)}>
                Cancel
              </button>
              <button type="submit" className="btn" disabled={busy}>
                {busy ? "Saving…" : "Create mapping"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {viewRecipe && (
        <Modal title={`${viewRecipe.code} · ${viewRecipe.name}`} onClose={() => setViewRecipe(null)} wide>
          <div className="detail-grid">
            <div className="field">
              <label>Code</label>
              <div className="mono">{viewRecipe.code}</div>
            </div>
            <div className="field">
              <label>Name</label>
              <div>{viewRecipe.name}</div>
            </div>
            <div className="field">
              <label>Project</label>
              <div>{viewRecipe.project.name}</div>
            </div>
            <div className="field">
              <label>Type</label>
              <div>{viewRecipe.type.replace(/_/g, " ")}</div>
            </div>
            <div className="field">
              <label>Version</label>
              <div className="num">v{viewRecipe.version}</div>
            </div>
            <div className="field">
              <label>Status</label>
              <div>
                <Badge status={viewRecipe.active ? "ACTIVE" : "INACTIVE"} />
              </div>
            </div>
          </div>
          <div className="sub-head">
            <strong>Ingredients</strong>
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Yield</th>
                  <th>Shrink %</th>
                </tr>
              </thead>
              <tbody>
                {viewRecipe.items.map((it) => (
                  <tr key={it.id}>
                    <td className="mono">
                      {it.item.code} · {it.item.description}
                    </td>
                    <td className="num">{it.quantity}</td>
                    <td className="num">{it.yieldFactor}</td>
                    <td className="num">{it.shrinkagePct}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="modal-actions">
            <div className="spacer" />
            <button type="button" className="btn ghost" onClick={() => setViewRecipe(null)}>
              Close
            </button>
          </div>
        </Modal>
      )}

      {viewWaste && (
        <Modal title="Waste Log" onClose={() => setViewWaste(null)}>
          <div className="detail-grid">
            <div className="field">
              <label>Item</label>
              <div>{viewWaste.item.description}</div>
            </div>
            <div className="field">
              <label>Warehouse</label>
              <div className="mono">{viewWaste.warehouse.code}</div>
            </div>
            <div className="field">
              <label>Quantity</label>
              <div className="num">{viewWaste.quantity}</div>
            </div>
            <div className="field">
              <label>Reason</label>
              <div>{viewWaste.reason}</div>
            </div>
            <div className="field">
              <label>Logged by</label>
              <div>{viewWaste.loggedBy.name}</div>
            </div>
            <div className="field">
              <label>Status</label>
              <div>
                <Badge status={viewWaste.status} />
              </div>
            </div>
          </div>
          <div className="modal-actions">
            <div className="spacer" />
            <button type="button" className="btn ghost" onClick={() => setViewWaste(null)}>
              Close
            </button>
          </div>
        </Modal>
      )}

      {deleteRecipe && (
        <ConfirmDialog
          title="Delete recipe"
          message={`Delete ${deleteRecipe.code} · ${deleteRecipe.name}? This cannot be undone.`}
          confirmLabel="Delete"
          busy={busy}
          onConfirm={confirmDeleteRecipe}
          onCancel={() => setDeleteRecipe(null)}
        />
      )}

      {deleteWaste && (
        <ConfirmDialog
          title="Delete waste log"
          message={`Delete this waste log (${deleteWaste.item.description}, qty ${deleteWaste.quantity})? This cannot be undone.`}
          confirmLabel="Delete"
          busy={busy}
          onConfirm={confirmDeleteWaste}
          onCancel={() => setDeleteWaste(null)}
        />
      )}

      {err && !showRecipe && !showWaste && !showMapping && !deleteRecipe && !deleteWaste && <ErrorBanner message={err} />}
      <Toast message={msg} onDone={() => setMsg(null)} />
    </>
  );
}