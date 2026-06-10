import { useState } from "react";
import { S, BLUE } from "../constants.js";
import Icon from "../components/Icon.jsx";
import Modal from "../components/Modal.jsx";

const DOCS_NATURAL_DEFAULT = ["Cédula","SARLAFT","RUT","Contrato","Carta de Autorización"];
const DOCS_JURIDICA_DEFAULT = ["Cámara de Comercio","RUT Empresa","SARLAFT","Estados Financieros","Cédula Rep. Legal","Contrato","Carta de Autorización"];
const DOCS_KEY_NAT = "docs_natural_v2";
const DOCS_KEY_JUR = "docs_juridica_v2";

const initDocs = (key, defaults) => {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored);
    localStorage.setItem(key, JSON.stringify(defaults));
    return defaults;
  } catch { return defaults; }
};

const RamosPage = ({ ramos, onAdd, onEdit, onDelete }) => {
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [delItem, setDelItem] = useState(null);
  const [form, setForm] = useState({ nombre: "", descripcion: "", activo: true, documentos: {} });
  const [nuevoDoc, setNuevoDoc] = useState("");
  const [tipoPersona, setTipoPersona] = useState("Natural");
  const [docsNatural, setDocsNatural] = useState(() => initDocs(DOCS_KEY_NAT, DOCS_NATURAL_DEFAULT));
  const [docsJuridica, setDocsJuridica] = useState(() => initDocs(DOCS_KEY_JUR, DOCS_JURIDICA_DEFAULT));
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleDoc = (doc, tp) =>
    setForm((f) => {
      const key = tp === "Natural" ? doc : `J_${doc}`;
      return { ...f, documentos: { ...f.documentos, [key]: !f.documentos[key] } };
    });

  const docsMostrar = tipoPersona === "Natural" ? docsNatural : docsJuridica;

  const agregarDocGlobal = () => {
    const d = nuevoDoc.trim();
    if (!d) { setNuevoDoc(""); return; }
    if (tipoPersona === "Natural") {
      if (docsNatural.includes(d)) { setNuevoDoc(""); return; }
      const nuevos = [...docsNatural, d];
      setDocsNatural(nuevos);
      localStorage.setItem(DOCS_KEY_NAT, JSON.stringify(nuevos));
    } else {
      if (docsJuridica.includes(d)) { setNuevoDoc(""); return; }
      const nuevos = [...docsJuridica, d];
      setDocsJuridica(nuevos);
      localStorage.setItem(DOCS_KEY_JUR, JSON.stringify(nuevos));
    }
    setNuevoDoc("");
  };

  const eliminarDoc = (doc) => {
    if (tipoPersona === "Natural") {
      const nuevos = docsNatural.filter((d) => d !== doc);
      setDocsNatural(nuevos);
      localStorage.setItem(DOCS_KEY_NAT, JSON.stringify(nuevos));
    } else {
      const nuevos = docsJuridica.filter((d) => d !== doc);
      setDocsJuridica(nuevos);
      localStorage.setItem(DOCS_KEY_JUR, JSON.stringify(nuevos));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    if (editItem) { await onEdit({ ...editItem, ...form }); setEditItem(null); setShowForm(false); }
    else { await onAdd(form); setShowForm(false); setForm({ nombre: "", descripcion: "", activo: true, documentos: {} }); }
    setSaving(false);
  };

  const thStyle = { padding: "11px 14px", textAlign: "center", fontWeight: 700, color: BLUE.primary, fontSize: 11.5, borderBottom: `1px solid ${BLUE.border}`, minWidth: 110, whiteSpace: "nowrap", letterSpacing: 0.3 };
  const tdStyle = (idx) => ({ textAlign: "center", borderBottom: `1px solid ${BLUE.border}`, padding: "10px 8px", background: idx % 2 === 0 ? "#fff" : "#f8faff" });
  const ramoTieneDoc = (r, doc) => tipoPersona === "Natural" ? r.documentos?.[doc] : r.documentos?.[`J_${doc}`];
  const btnTP = (tp) => ({
    padding: "7px 18px", borderRadius: 8,
    border: `1.5px solid ${tipoPersona === tp ? BLUE.primary : BLUE.border}`,
    background: tipoPersona === tp ? BLUE.primary : "#fff",
    color: tipoPersona === tp ? "#fff" : BLUE.text,
    fontSize: 13, fontWeight: 600, cursor: "pointer",
  });

  return (
    <div>
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>Ramos de Seguros</div>
          <div style={S.pageSub}>Configura qué documentos requiere cada ramo</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              style={{ ...S.input, width: 200, padding: "8px 12px", fontSize: 13 }}
              value={nuevoDoc}
              onChange={(e) => setNuevoDoc(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && agregarDocGlobal()}
              placeholder={`+ Doc ${tipoPersona}…`}
            />
            <button style={S.btn("secondary")} onClick={agregarDocGlobal}>Agregar</button>
          </div>
          <button
            style={S.btn("primary")}
            onClick={() => { setShowForm(true); setEditItem(null); setForm({ nombre: "", descripcion: "", activo: true, documentos: {} }); }}
          >
            <Icon name="plus" size={16} />Nuevo Ramo
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#6b87b0", marginRight: 4 }}>Ver documentos para:</span>
        <button style={btnTP("Natural")} onClick={() => setTipoPersona("Natural")}>Persona Natural</button>
        <button style={btnTP("Jurídica")} onClick={() => setTipoPersona("Jurídica")}>Persona Jurídica</button>
      </div>

      <div style={{ overflowX: "auto", marginBottom: 24 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 12, boxShadow: "0 1px 6px rgba(26,86,219,0.08)", fontSize: 13 }}>
          <thead>
            <tr style={{ background: BLUE.light }}>
              <th style={{ ...thStyle, minWidth: 80 }}>ACCIONES</th>
              <th style={{ ...thStyle, textAlign: "left", minWidth: 180, position: "sticky", left: 0, background: BLUE.light, zIndex: 2 }}>RAMO</th>
              {docsMostrar.map((doc) => (
                <th key={doc} style={thStyle}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                    <span>{doc}</span>
                    <button
                      title="Eliminar documento"
                      onClick={() => eliminarDoc(doc)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 13, lineHeight: 1, padding: "0 2px", fontWeight: 700 }}
                    >
                      x
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ramos.length === 0 && (
              <tr>
                <td colSpan={docsMostrar.length + 2} style={{ padding: 40, textAlign: "center", color: "#aaa" }}>
                  No hay ramos. Agrega el primero.
                </td>
              </tr>
            )}
            {ramos.map((r, idx) => (
              <tr key={r.id}>
                <td style={tdStyle(idx)}>
                  <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                    <button
                      style={S.btn("ghost")}
                      title="Editar"
                      onClick={() => {
                        setEditItem(r);
                        setForm({ nombre: r.nombre, descripcion: r.descripcion || "", activo: r.activo !== false, documentos: { ...(r.documentos || {}) } });
                        setShowForm(true);
                      }}
                    >
                      <Icon name="edit" size={14} />
                    </button>
                    <button style={{ ...S.btn("ghost"), color: "#dc2626" }} title="Eliminar" onClick={() => setDelItem(r)}>
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </td>
                <td style={{ ...tdStyle(idx), textAlign: "left", padding: "12px 16px", fontWeight: 600, color: BLUE.text, position: "sticky", left: 0, zIndex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {r.nombre}
                    <span style={S.chip(r.activo !== false ? "#16a34a" : "#6b7280")}>
                      {r.activo !== false ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                </td>
                {docsMostrar.map((doc) => (
                  <td key={doc} style={tdStyle(idx)}>
                    {ramoTieneDoc(r, doc)
                      ? <span style={{ color: "#16a34a", fontSize: 18, fontWeight: 700 }}>✓</span>
                      : <span style={{ color: "#d1d5db" }}>—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal
          title={editItem ? `Editar — ${editItem.nombre}` : "Nuevo Ramo"}
          onClose={() => { setShowForm(false); setEditItem(null); }}
          wide
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
            <label style={S.label}>Nombre del Ramo *</label>
            <input style={S.input} value={form.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Ej. SOAT, Vida, Automóvil" />
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>Descripción</label>
            <input style={S.input} value={form.descripcion} onChange={(e) => set("descripcion", e.target.value)} />
          </div>
          <div style={{ ...S.formGroup, display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <input type="checkbox" checked={form.activo} onChange={(e) => set("activo", e.target.checked)} style={{ width: 16, height: 16, accentColor: BLUE.primary }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: BLUE.text }}>Ramo activo</span>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: BLUE.primary, letterSpacing: 0.5, marginBottom: 8 }}>DOCUMENTOS PERSONA NATURAL</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {docsNatural.map((doc) => (
                <label key={doc} style={{ display: "flex", alignItems: "center", gap: 8, background: form.documentos[doc] ? "#f0fdf4" : BLUE.light, border: `1px solid ${form.documentos[doc] ? "#bbf7d0" : BLUE.border}`, borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}>
                  <input type="checkbox" checked={!!form.documentos[doc]} onChange={() => toggleDoc(doc, "Natural")} style={{ width: 15, height: 15, accentColor: "#16a34a" }} />
                  <span style={{ fontSize: 12.5, color: form.documentos[doc] ? "#16a34a" : BLUE.text, fontWeight: form.documentos[doc] ? 600 : 400 }}>{doc}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed", letterSpacing: 0.5, marginBottom: 8 }}>DOCUMENTOS PERSONA JURÍDICA</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {docsJuridica.map((doc) => (
                <label key={doc} style={{ display: "flex", alignItems: "center", gap: 8, background: form.documentos[`J_${doc}`] ? "#faf5ff" : BLUE.light, border: `1px solid ${form.documentos[`J_${doc}`] ? "#e9d5ff" : BLUE.border}`, borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}>
                  <input type="checkbox" checked={!!form.documentos[`J_${doc}`]} onChange={() => toggleDoc(doc, "Jurídica")} style={{ width: 15, height: 15, accentColor: "#7c3aed" }} />
                  <span style={{ fontSize: 12.5, color: form.documentos[`J_${doc}`] ? "#7c3aed" : BLUE.text, fontWeight: form.documentos[`J_${doc}`] ? 600 : 400 }}>{doc}</span>
                </label>
              ))}
            </div>
          </div>
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
