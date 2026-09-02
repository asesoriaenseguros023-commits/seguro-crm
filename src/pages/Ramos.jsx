import { useState } from "react";
import { S, BLUE } from "../constants.js";
import Icon from "../components/Icon.jsx";
import Modal from "../components/Modal.jsx";

const claveDoc = (nombre, tp) => (tp === "Natural" ? nombre : `J_${nombre}`);

const RamosPage = ({ ramos, onAdd, onEdit, onDelete, documentosCatalogo, onToggleDocumento, onAddDocumento, onDeleteDocumento }) => {
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [delItem, setDelItem] = useState(null);
  const [form, setForm] = useState({ nombre: "", descripcion: "", activo: true });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Panel de documentos: guarda solo el id, no una copia del ramo — así, al
  // marcar/desmarcar, siempre lee el estado más reciente desde `ramos`.
  const [docsPanelId, setDocsPanelId] = useState(null);
  const [tipoPersona, setTipoPersona] = useState("Natural");
  const [nuevoDoc, setNuevoDoc] = useState("");
  const docsPanelRamo = ramos.find((r) => r.id === docsPanelId) || null;

  const handleSave = async () => {
    if (!form.nombre.trim()) { setFormError("El nombre del ramo es obligatorio."); return; }
    setFormError("");
    setSaving(true);
    const res = editItem ? await onEdit({ ...editItem, ...form }) : await onAdd({ ...form, documentos: {} });
    setSaving(false);
    if (res?.error) { setFormError(res.error); return; }
    setEditItem(null); setShowForm(false); setForm({ nombre: "", descripcion: "", activo: true });
  };

  const contarDocs = (r, tp) => {
    const total = documentosCatalogo.filter((d) => d.tipo_persona === tp).length;
    const marcados = documentosCatalogo.filter((d) => d.tipo_persona === tp && r.documentos?.[claveDoc(d.nombre, tp)]).length;
    return `${marcados}/${total}`;
  };

  const agregarDocGlobal = () => {
    const d = nuevoDoc.trim();
    if (!d) return;
    const yaExiste = documentosCatalogo.some((x) => x.tipo_persona === tipoPersona && x.nombre.toLowerCase() === d.toLowerCase());
    if (!yaExiste) onAddDocumento(d, tipoPersona);
    setNuevoDoc("");
  };

  const btnTP = (tp) => ({
    padding: "7px 18px", borderRadius: 8,
    border: `1.5px solid ${tipoPersona === tp ? BLUE.primary : BLUE.border}`,
    background: tipoPersona === tp ? BLUE.primary : "#fff",
    color: tipoPersona === tp ? "#fff" : BLUE.text,
    fontSize: 13, fontWeight: 600, cursor: "pointer",
  });

  const docsDelTipo = documentosCatalogo.filter((d) => d.tipo_persona === tipoPersona);

  return (
    <div>
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>Ramos de Seguros</div>
          <div style={S.pageSub}>{ramos.length} ramos · clic en "Documentos" para elegir qué exige cada uno</div>
        </div>
        <button
          style={S.btn("primary")}
          onClick={() => { setShowForm(true); setEditItem(null); setForm({ nombre: "", descripcion: "", activo: true }); setFormError(""); }}
        >
          <Icon name="plus" size={16} />Nuevo Ramo
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
        {ramos.map((r) => (
          <div
            key={r.id}
            style={{
              background: "#fff", borderRadius: 12, padding: 18,
              boxShadow: "0 1px 6px rgba(26,86,219,0.08)",
              border: `1px solid ${BLUE.border}`, borderTop: `3px solid ${BLUE.primary}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: BLUE.text }}>{r.nombre}</div>
              <span style={S.chip(r.activo !== false ? "#16a34a" : "#6b7280")}>
                {r.activo !== false ? "Activo" : "Inactivo"}
              </span>
            </div>
            {r.descripcion && <div style={{ fontSize: 12, color: "#6b87b0", marginTop: 4 }}>{r.descripcion}</div>}
            <div style={{ fontSize: 11.5, color: "#9aa8c7", marginTop: 10 }}>
              Documentos: {contarDocs(r, "Natural")} Natural · {contarDocs(r, "Jurídica")} Jurídica
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
              <button
                style={{ ...S.btn("secondary"), flex: 1, justifyContent: "center" }}
                onClick={() => { setDocsPanelId(r.id); setTipoPersona("Natural"); }}
              >
                <Icon name="document" size={14} />Documentos
              </button>
              <button
                style={S.btn("ghost")} title="Editar"
                onClick={() => { setEditItem(r); setForm({ nombre: r.nombre, descripcion: r.descripcion || "", activo: r.activo !== false }); setShowForm(true); setFormError(""); }}
              >
                <Icon name="edit" size={14} />
              </button>
              <button style={{ ...S.btn("ghost"), color: "#dc2626" }} title="Eliminar" onClick={() => setDelItem(r)}>
                <Icon name="trash" size={14} />
              </button>
            </div>
          </div>
        ))}
        {ramos.length === 0 && (
          <div style={{ color: "#aaa", fontSize: 13, padding: 20 }}>
            No hay ramos. Agrega el primero.
          </div>
        )}
      </div>

      {/* ─── Panel de documentos de un ramo ─── */}
      {docsPanelRamo && (
        <Modal
          title={`Documentos — ${docsPanelRamo.nombre}`}
          onClose={() => setDocsPanelId(null)}
          footer={<button style={S.btn("secondary")} onClick={() => setDocsPanelId(null)}>Cerrar</button>}
        >
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button style={btnTP("Natural")} onClick={() => setTipoPersona("Natural")}>Persona Natural</button>
            <button style={btnTP("Jurídica")} onClick={() => setTipoPersona("Jurídica")}>Persona Jurídica</button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
            {docsDelTipo.length === 0 && (
              <div style={{ fontSize: 13, color: "#aaa", padding: "8px 0" }}>Sin documentos en el catálogo todavía.</div>
            )}
            {docsDelTipo.map((doc) => {
              const marcado = !!docsPanelRamo.documentos?.[claveDoc(doc.nombre, tipoPersona)];
              return (
                <div
                  key={doc.id}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                    background: marcado ? "#f0fdf4" : BLUE.light,
                    border: `1px solid ${marcado ? "#bbf7d0" : BLUE.border}`,
                    borderRadius: 10, padding: "10px 14px", cursor: "pointer",
                  }}
                  onClick={() => onToggleDocumento(docsPanelRamo, claveDoc(doc.nombre, tipoPersona))}
                >
                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flex: 1 }}>
                    <input type="checkbox" readOnly checked={marcado} style={{ width: 17, height: 17, accentColor: "#16a34a" }} />
                    <span style={{ fontSize: 13.5, fontWeight: marcado ? 600 : 400, color: marcado ? "#166534" : BLUE.text }}>{doc.nombre}</span>
                  </label>
                  <button
                    title="Quitar del catálogo (afecta a todos los ramos)"
                    onClick={(e) => { e.stopPropagation(); onDeleteDocumento(doc.id); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 13, fontWeight: 700, padding: 2 }}
                  >
                    x
                  </button>
                </div>
              );
            })}
          </div>

          <div style={{ borderTop: `1px solid ${BLUE.border}`, paddingTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: BLUE.primary, letterSpacing: 0.5, marginBottom: 8 }}>
              AGREGAR DOCUMENTO NUEVO AL CATÁLOGO ({tipoPersona.toUpperCase()})
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                style={{ ...S.input, fontSize: 13 }}
                value={nuevoDoc}
                onChange={(e) => setNuevoDoc(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && agregarDocGlobal()}
                placeholder={`Nuevo documento para ${tipoPersona}…`}
              />
              <button style={S.btn("secondary")} onClick={agregarDocGlobal}>Agregar</button>
            </div>
          </div>
        </Modal>
      )}

      {showForm && (
        <Modal
          title={editItem ? `Editar — ${editItem.nombre}` : "Nuevo Ramo"}
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
          {formError && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#dc2626", marginBottom: 14 }}>
              {formError}
            </div>
          )}
          <div style={S.formGroup}>
            <label style={S.label}>Nombre del Ramo *</label>
            <input style={S.input} value={form.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Ej. SOAT, Vida, Automóvil" autoFocus />
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>Descripción</label>
            <input style={S.input} value={form.descripcion} onChange={(e) => set("descripcion", e.target.value)} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={form.activo} onChange={(e) => set("activo", e.target.checked)} style={{ width: 16, height: 16, accentColor: BLUE.primary }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: BLUE.text }}>Ramo activo</span>
          </div>
          {!editItem && (
            <p style={{ fontSize: 12, color: "#6b87b0", marginTop: 16 }}>
              Los documentos que exige este ramo se eligen después, desde el botón "Documentos".
            </p>
          )}
        </Modal>
      )}

      {delItem && (
        <Modal
          title="Eliminar Ramo"
          onClose={() => setDelItem(null)}
          footer={
            <>
              <button style={S.btn("secondary")} onClick={() => setDelItem(null)}>Cancelar</button>
              <button style={S.btn("danger")} onClick={async () => { await onDelete(delItem.id); setDelItem(null); }}>Eliminar</button>
            </>
          }
        >
          <p style={{ fontSize: 14, color: "#555" }}>
            ¿Eliminar el ramo <strong>{delItem.nombre}</strong>? Esta acción no se puede deshacer.
          </p>
        </Modal>
      )}
    </div>
  );
};

export default RamosPage;
