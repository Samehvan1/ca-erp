import { FormEvent, useEffect, useState } from "react";
import { Drawer } from "../../components/Drawer";
import { Item, Category, UnitOfMeasure } from "./types";
import { apiReq, useApi } from "../../components";

export interface ItemDrawerProps {
  open: boolean;
  onClose: () => void;
  editItem?: Item | null;
  onSuccess: (msg: string) => void;
}

interface ProjectOption {
  id: number;
  code: string;
  name: string;
  isGroup?: boolean;
}

export function ItemDrawer({ open, onClose, editItem, onSuccess }: ItemDrawerProps) {
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState("PROJECT_ISOLATED");
  const [categoryId, setCategoryId] = useState<string>("");
  const [category, setCategory] = useState("");
  const [valuationMethod, setValuationMethod] = useState("WAC");
  const [abcClass, setAbcClass] = useState("A");
  const [uom, setUom] = useState("Each");
  const [baseUnitId, setBaseUnitId] = useState<string>("");
  const [purchaseUnitId, setPurchaseUnitId] = useState<string>("");
  const [recipeUnitId, setRecipeUnitId] = useState<string>("");
  const [packRatio, setPackRatio] = useState<number>(1);
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const projectsApi = useApi<ProjectOption[]>("/inventory/projects");
  const categoriesApi = useApi<Category[]>("/master-data/categories");
  const unitsApi = useApi<UnitOfMeasure[]>("/master-data/units");

  const projects = projectsApi.data || [];
  const categories = categoriesApi.data || [];
  const units = unitsApi.data || [];

  useEffect(() => {
    if (editItem) {
      setCode(editItem.code || "");
      setDescription(editItem.description || "");
      setScope(editItem.scope || "PROJECT_ISOLATED");
      setCategoryId(editItem.categoryId ? String(editItem.categoryId) : "");
      setCategory(editItem.category || "");
      setValuationMethod(editItem.valuationMethod || "WAC");
      setAbcClass(editItem.abcClass || "A");
      setUom(editItem.uom || "Each");
      setBaseUnitId(editItem.baseUnitId ? String(editItem.baseUnitId) : "");
      setPurchaseUnitId(editItem.purchaseUnitId ? String(editItem.purchaseUnitId) : "");
      setRecipeUnitId(editItem.recipeUnitId ? String(editItem.recipeUnitId) : "");
      setProjectId(editItem.projectId ? String(editItem.projectId) : "");

      // If item has conversion rule
      const itemConv = editItem.unitConversions?.[0];
      if (itemConv) {
        setPackRatio(itemConv.factor);
      } else {
        setPackRatio(1);
      }
    } else {
      setCode("");
      setDescription("");
      setScope("PROJECT_ISOLATED");
      setCategoryId(categories.length > 0 ? String(categories[0].id) : "");
      setCategory("");
      setValuationMethod("WAC");
      setAbcClass("A");
      setUom("Each");
      setBaseUnitId(units.length > 0 ? String(units[0].id) : "");
      setPurchaseUnitId(units.length > 0 ? String(units[0].id) : "");
      setRecipeUnitId(units.length > 0 ? String(units[0].id) : "");
      setPackRatio(1);
      setProjectId(projects.length > 0 ? String(projects[0].id) : "");
    }
    setErr(null);
  }, [open, editItem, projects.length, categories.length, units.length]);

  // If scope is PROJECT_ISOLATED and no projectId is set yet, auto-select first project
  useEffect(() => {
    if (scope === "PROJECT_ISOLATED" && !projectId && projects.length > 0) {
      setProjectId(String(projects[0].id));
    }
  }, [scope, projectId, projects]);

  // Sync category string name when categoryId changes
  const handleCategorySelect = (idStr: string) => {
    setCategoryId(idStr);
    const selected = categories.find((c) => String(c.id) === idStr);
    if (selected) {
      setCategory(selected.name);
      if (selected.defaultValuationMethod) {
        setValuationMethod(selected.defaultValuationMethod);
      }
    }
  };

  // Sync UOM string when baseUnitId changes
  const handleBaseUnitSelect = (idStr: string) => {
    setBaseUnitId(idStr);
    const selected = units.find((u) => String(u.id) === idStr);
    if (selected) {
      setUom(selected.code);
      if (!purchaseUnitId) setPurchaseUnitId(idStr);
      if (!recipeUnitId) setRecipeUnitId(idStr);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const selectedBaseUnit = units.find((u) => String(u.id) === baseUnitId);
      const body: Record<string, unknown> = {
        code,
        description,
        scope,
        categoryId: categoryId ? Number(categoryId) : null,
        category: category || (categoryId ? categories.find((c) => String(c.id) === categoryId)?.name : null),
        valuationMethod,
        abcClass: abcClass || null,
        uom: selectedBaseUnit ? selectedBaseUnit.code : (uom || "Each"),
        baseUnitId: baseUnitId ? Number(baseUnitId) : null,
        purchaseUnitId: purchaseUnitId ? Number(purchaseUnitId) : null,
        recipeUnitId: recipeUnitId ? Number(recipeUnitId) : null,
      };

      if (scope === "PROJECT_ISOLATED") {
        if (!projectId && projects.length > 0) {
          body.projectId = projects[0].id;
        } else if (projectId) {
          body.projectId = Number(projectId);
        }
      } else {
        body.projectId = null;
      }

      let savedItem: Item;
      if (editItem) {
        savedItem = await apiReq("PATCH", `/inventory/items/${editItem.id}`, body);
        onSuccess("Item updated successfully.");
      } else {
        savedItem = await apiReq("POST", "/inventory/items", body);
        onSuccess("Item created successfully.");
      }

      // If purchase unit is different from base unit, save / update item conversion
      if (purchaseUnitId && baseUnitId && purchaseUnitId !== baseUnitId && packRatio > 0 && savedItem?.id) {
        try {
          await apiReq("POST", "/master-data/conversions", {
            fromUnitId: Number(purchaseUnitId),
            toUnitId: Number(baseUnitId),
            factor: packRatio,
            itemId: savedItem.id,
          });
        } catch {
          // Rule might already exist or be updated
        }
      }

      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save item");
    } finally {
      setBusy(false);
    }
  };

  const selectedPurchaseUnit = units.find((u) => String(u.id) === purchaseUnitId);
  const selectedBaseUnit = units.find((u) => String(u.id) === baseUnitId);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={editItem ? `Edit Master Item ${editItem.code}` : "New Master Item"}
      subtitle="Define catalog items, category hierarchy, UOMs, and packaging ratios"
      width="md"
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={handleSubmit} disabled={busy}>
            {busy ? "Saving…" : editItem ? "Update Item" : "Create Item"}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        {err && <div className="error-banner" style={{ marginBottom: 16 }}>{err}</div>}

        <div className="form-row">
          <div className="field">
            <label>Item Code *</label>
            <input
              type="text"
              placeholder="e.g. ITM-001"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
              disabled={Boolean(editItem)}
            />
          </div>
          <div className="field">
            <label>Category *</label>
            <select
              value={categoryId}
              onChange={(e) => handleCategorySelect(e.target.value)}
              required
            >
              <option value="">Select Category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} - {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label>Description *</label>
          <input
            type="text"
            placeholder="e.g. Full Cream Milk 1L Carton"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>

        <div className="form-row">
          <div className="field">
            <label>Scope *</label>
            <select value={scope} onChange={(e) => setScope(e.target.value)} required>
              <option value="PROJECT_ISOLATED">Project Isolated (Single Brand)</option>
              <option value="CROSS_PROJECT">Cross-Project Shared (Group Catalog)</option>
            </select>
          </div>
          {scope === "PROJECT_ISOLATED" && (
            <div className="field">
              <label>Target Project / Brand *</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                required
              >
                <option value="">Select Project / Brand…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* UOM Architecture */}
        <div style={{ background: "var(--surface)", padding: 14, borderRadius: 8, border: "1px solid var(--line)", margin: "14px 0" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "var(--amber)", display: "flex", alignItems: "center", gap: 6 }}>
            <span>📏 Units of Measure & Pack Ratio</span>
          </div>

          <div className="form-row" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            <div className="field">
              <label style={{ fontSize: 11 }}>Base Stock UOM *</label>
              <select value={baseUnitId} onChange={(e) => handleBaseUnitSelect(e.target.value)} required>
                <option value="">Select Base Unit…</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code} ({u.dimension})
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label style={{ fontSize: 11 }}>Purchasing UOM</label>
              <select value={purchaseUnitId} onChange={(e) => setPurchaseUnitId(e.target.value)}>
                <option value="">Same as Base</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code} ({u.dimension})
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label style={{ fontSize: 11 }}>Recipe / BOM UOM</label>
              <select value={recipeUnitId} onChange={(e) => setRecipeUnitId(e.target.value)}>
                <option value="">Same as Base</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code} ({u.dimension})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {purchaseUnitId && baseUnitId && purchaseUnitId !== baseUnitId && (
            <div style={{ marginTop: 10, padding: 10, borderRadius: 6, background: "rgba(245, 158, 11, 0.1)", border: "1px dashed var(--amber)" }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--amber)", display: "block", marginBottom: 4 }}>
                📦 Pack Packaging Ratio:
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>1 {selectedPurchaseUnit?.code || "Pack"} =</span>
                <input
                  type="number"
                  step="any"
                  min="0.0001"
                  value={packRatio}
                  onChange={(e) => setPackRatio(parseFloat(e.target.value) || 1)}
                  style={{ width: 100, padding: 6, borderRadius: 4, border: "1px solid var(--line)" }}
                />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{selectedBaseUnit?.code || "Base Units"}</span>
              </div>
            </div>
          )}
        </div>

        <div className="form-row">
          <div className="field">
            <label>Valuation Method *</label>
            <select value={valuationMethod} onChange={(e) => setValuationMethod(e.target.value)} required>
              <option value="WAC">Weighted Average Cost (WAC)</option>
              <option value="FIFO">First-In First-Out (FIFO)</option>
            </select>
          </div>
          <div className="field">
            <label>ABC Classification</label>
            <select value={abcClass} onChange={(e) => setAbcClass(e.target.value)}>
              <option value="A">Class A (High Value / High Velocity)</option>
              <option value="B">Class B (Medium Value)</option>
              <option value="C">Class C (Low Value / Bulk)</option>
            </select>
          </div>
        </div>
      </form>
    </Drawer>
  );
}
