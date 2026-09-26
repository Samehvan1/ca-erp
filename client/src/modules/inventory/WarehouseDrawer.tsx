import { FormEvent, useEffect, useState } from "react";
import { Drawer } from "../../components/Drawer";
import { Warehouse } from "./types";
import { apiReq } from "../../components";

export interface WarehouseDrawerProps {
  open: boolean;
  onClose: () => void;
  editWarehouse?: Warehouse | null;
  onSuccess: (msg: string) => void;
}

export function WarehouseDrawer({ open, onClose, editWarehouse, onSuccess }: WarehouseDrawerProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("PROJECT_CENTRAL");
  const [owner, setOwner] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("Egypt");
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (editWarehouse) {
      setCode(editWarehouse.code || "");
      setName(editWarehouse.name || "");
      setType(editWarehouse.type || "PROJECT_CENTRAL");
      setOwner(editWarehouse.owner || "");
      setAddress(editWarehouse.address || "");
      setCity(editWarehouse.city || "");
      setCountry(editWarehouse.country || "Egypt");
      setProjectId(editWarehouse.projectId ? String(editWarehouse.projectId) : "");
    } else {
      setCode("");
      setName("");
      setType("PROJECT_CENTRAL");
      setOwner("");
      setAddress("");
      setCity("");
      setCountry("Egypt");
      setProjectId("");
    }
    setErr(null);
  }, [open, editWarehouse]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = {
        code,
        name,
        type,
        owner: owner || null,
        address: address || null,
        city: city || null,
        country: country || "Egypt",
      };
      if (projectId) body.projectId = Number(projectId);

      if (editWarehouse) {
        await apiReq("PATCH", `/inventory/warehouses/${editWarehouse.id}`, body);
        onSuccess("Warehouse updated successfully.");
      } else {
        await apiReq("POST", "/inventory/warehouses", body);
        onSuccess("Warehouse created successfully.");
      }
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save warehouse");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={editWarehouse ? `Edit Warehouse ${editWarehouse.code}` : "New Warehouse Node"}
      subtitle="Configure central depots, kitchens, or branch storage stations"
      width="md"
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={handleSubmit} disabled={busy}>
            {busy ? "Saving…" : editWarehouse ? "Update Warehouse" : "Create Warehouse"}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        {err && <div className="error-banner" style={{ marginBottom: 16 }}>{err}</div>}

        <div className="form-row">
          <div className="field">
            <label>Warehouse Code *</label>
            <input
              type="text"
              placeholder="e.g. WH-CAIRO"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              disabled={Boolean(editWarehouse)}
            />
          </div>
          <div className="field">
            <label>Warehouse Name *</label>
            <input
              type="text"
              placeholder="e.g. Central Kitchen Depot"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="field">
            <label>Node Type *</label>
            <select value={type} onChange={(e) => setType(e.target.value)} required>
              <option value="PROJECT_CENTRAL">Project Central (Main Brand Hub)</option>
              <option value="GROUP_CENTRAL">Group Central (Shared Holding Hub)</option>
              <option value="BRANCH">Branch (Store / Kitchen Sub-Store)</option>
              <option value="TRANSIT">Transit (Virtual Route Node)</option>
            </select>
          </div>
          <div className="field">
            <label>Responsible Manager / Owner</label>
            <input
              type="text"
              placeholder="e.g. Head Chef / Storekeeper"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label>Address</label>
          <input
            type="text"
            placeholder="e.g. Building 12, Industrial Area"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>

        <div className="form-row">
          <div className="field">
            <label>City</label>
            <input
              type="text"
              placeholder="e.g. Cairo, Giza, Alexandria"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Country</label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
          </div>
        </div>
      </form>
    </Drawer>
  );
}
