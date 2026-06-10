import { useState } from "react";
import { S, BLUE, ROL_ADMIN, ROL_AGENTE } from "../constants.js";
import { fmt, esAdmin } from "../helpers.js";
import Icon from "../components/Icon.jsx";
import Modal from "../components/Modal.jsx";

const ConfiguracionPage = ({ agentes, polizas, onAdd, onEdit, onDelete }) => {
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [delItem, setDelItem] = useState(null);
  const [form, setForm] = useState({ nombre: "", email: "", rol: ROL_AGENTE });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    if (editItem) { await onEdit({ ...editItem, ...form }); setEditItem(null); }
    else { await onAdd(form); setShowForm(false); setForm({ nombre: "", email: "", rol: ROL_AGENTE }); }
    setSaving(false);
  };

  return (
    <div>
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>Usuarios</div>
          <div style={S.pageSub}>Gestión de usuarios del sistema</div>
        </div>
        <button style={S.btn("primary")} onClick={() => setShowForm(true)}>
          <Icon name="plus" size={16} />Nuevo Usuario
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {agentes.map((a) => {
          const nPolizas = polizas.filter((p) => p.agenteId === a.id && p.estado === "Activa").length;
          const prima = polizas.filter((p) => p.agenteId === a.id && p.estado === "Activa").reduce((s, p) => s + Number(p.prima || 0), 0);
          const initials = a.nombre.split(" ").slice(0, 2).map((w) => w[0]).join("");
          const rolColor = a.rol === ROL_ADMIN ? "#7c3aed" : BLUE.primary;
          return (
            <div
              key={a.id}
              style={{ background: "#fff", borderRadius: 12, padding: 22, boxShadow: "0 1px 6px rgba(26,86,219,0.08)", border: `1px solid ${BLUE.border}` }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                <div style={{ width: 46, height: 46, borderRadius: "50%", background: `linear-gradient(135deg,${rolColor},${rolColor}88)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 16 }}>
                  {initials}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{a.nombre}</div>
                  <div style={{ fontSize: 12, color: "#888" }}>{a.email}</div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button style={S.btn("ghost")} onClick={() => { setEditItem(a); setForm({ nombre: a.nombre, email: a.email, rol: a.rol }); }}>
                    <Icon name="edit" size={14} />
                  </button>
                  <button style={{ ...S.btn("ghost"), color: "#dc2626" }} onClick={() => setDelItem(a)}>
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={S.chip(rolColor)}>{a.rol}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, borderTop: `1px solid ${BLUE.border}`, paddingTop: 12 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{nPolizas}</div>
                  <div style={{ fontSize: 11, color: "#aaa" }}>Pólizas Activas</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{fmt(prima)}</div>
                  <div style={{ fontSize: 11, color: "#aaa" }}>Prima</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {(showForm || editItem) && (
        <Modal
          title={editItem ? "Editar Usuario" : "Nuevo Usuario"}
          onClose={() => { setShowForm(false); setEditItem(null); }}
          footer={
            <>
              <button style={S.btn("secondary")} onClick={() => { setShowForm(false); setEditItem(null); }}>Cancelar</button>
              <button style={{ ...S.btn("primary"), opacity: saving ? 0.6 : 1 }} onClick={handleSave} disabled={saving}>
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </>
          }
        >
          <div style={S.formGroup}>
            <label style={S.label}>Nombre *</label>
            <input style={S.input} value={form.nombre} onChange={(e) => set("nombre", e.target.value)} />
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>Email *</label>
            <input style={S.input} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>Rol</label>
            <select style={S.select} value={form.rol} onChange={(e) => set("rol", e.target.value)}>
              <option value={ROL_ADMIN}>Admin</option>
              <option value={ROL_AGENTE}>Agente</option>
            </select>
          </div>
          <div style={{ background: BLUE.light, borderRadius: 8, padding: "10px 14px", fontSize: 12.5, color: BLUE.primary }}>
            Crea el usuario en Supabase Authentication con el mismo email.
          </div>
        </Modal>
      )}

      {delItem && (
        <Modal
          title="Confirmar eliminación"
          onClose={() => setDelItem(null)}
          footer={
            <>
              <button style={S.btn("secondary")} onClick={() => setDelItem(null)}>Cancelar</button>
              <button style={S.btn("danger")} onClick={async () => { await onDelete(delItem.id); setDelItem(null); }}>Eliminar</button>
            </>
          }
        >
          <p style={{ fontSize: 14, color: "#555" }}>
            ¿Eliminar al usuario <strong>{delItem.nombre}</strong>?
          </p>
        </Modal>
      )}
    </div>
  );
};

export default ConfiguracionPage;
