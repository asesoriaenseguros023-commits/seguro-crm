import { useState } from "react";
import { S, BLUE } from "../constants.js";
import Icon from "../components/Icon.jsx";
import Modal from "../components/Modal.jsx";

const AseguradorasPage = ({ aseguradoras, onAdd, onEdit, onDelete }) => {
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [delItem, setDelItem] = useState(null);
  const [form, setForm] = useState({ nombre: "", activo: true });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    if (editItem) { await onEdit({ ...editItem, ...form }); setEditItem(null); setShowForm(false); }
    else { await onAdd(form); setShowForm(false); setForm({ nombre: "", activo: true }); }
    setSaving(false);
  };

  return (
    <div>
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>Aseguradoras</div>
          <div style={S.pageSub}>{aseguradoras.length} aseguradoras configuradas</div>
        </div>
        <button
          style={S.btn("primary")}
          onClick={() => { setShowForm(true); setEditItem(null); setForm({ nombre: "", activo: true }); }}
        >
          <Icon name="plus" size={16} />Nueva Aseguradora
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
        {aseguradoras.map((a) => (
          <div
            key={a.id}
            style={{
              background: "#fff", borderRadius: 12, padding: 18,
              boxShadow: "0 1px 6px rgba(26,86,219,0.08)",
              border: `1px solid ${BLUE.border}`, borderTop: `3px solid ${BLUE.primary}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: BLUE.text }}>{a.nombre}</div>
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  style={S.btn("ghost")}
                  onClick={() => { setEditItem(a); setForm({ nombre: a.nombre, activo: a.activo !== false }); setShowForm(true); }}
                >
                  <Icon name="edit" size={14} />
                </button>
                <button style={{ ...S.btn("ghost"), color: "#dc2626" }} onClick={() => setDelItem(a)}>
                  <Icon name="trash" size={14} />
                </button>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <span style={S.chip(a.activo !== false ? "#16a34a" : "#6b7280")}>
                {a.activo !== false ? "Activa" : "Inactiva"}
              </span>
            </div>
          </div>
        ))}
        {aseguradoras.length === 0 && (
          <div style={{ color: "#aaa", fontSize: 13, padding: 20 }}>
            No hay aseguradoras. Agrega la primera.
          </div>
        )}
      </div>

      {showForm && (
        <Modal
          title={editItem ? "Editar Aseguradora" : "Nueva Aseguradora"}
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
            <input style={S.input} value={form.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Ej. Seguros del Estado" autoFocus />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={form.activo} onChange={(e) => set("activo", e.target.checked)} style={{ width: 16, height: 16, accentColor: BLUE.primary }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: BLUE.text }}>Aseguradora activa</span>
          </div>
        </Modal>
      )}

      {delItem && (
        <Modal
          title="Eliminar Aseguradora"
          onClose={() => setDelItem(null)}
          footer={
            <>
              <button style={S.btn("secondary")} onClick={() => setDelItem(null)}>Cancelar</button>
              <button style={S.btn("danger")} onClick={async () => { await onDelete(delItem.id); setDelItem(null); }}>Eliminar</button>
            </>
          }
        >
          <p style={{ fontSize: 14, color: "#555" }}>
            ¿Eliminar <strong>{delItem.nombre}</strong>?
          </p>
        </Modal>
      )}
    </div>
  );
};

export default AseguradorasPage;
