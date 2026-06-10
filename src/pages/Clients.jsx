import { useState, useMemo } from "react";
import { S, BLUE } from "../constants.js";
import { esAdmin } from "../helpers.js";
import Icon from "../components/Icon.jsx";
import Modal from "../components/Modal.jsx";

const FORM_VACIO = {
  tipoPersona: "Natural", nombre: "", email: "", celular: "",
  documento: "", tipoDocumento: "CC", ciudad: "", direccion: "",
  notas: "", nombreContacto: "", telefonoContacto: "",
};

const ClientesPage = ({ clientes, onAdd, onEdit, onDelete, userRol }) => {
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [delItem, setDelItem] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const clientesFiltrados = useMemo(
    () =>
      clientes.filter(
        (c) =>
          !q ||
          c.nombre?.toLowerCase().includes(q.toLowerCase()) ||
          c.email?.toLowerCase().includes(q.toLowerCase()) ||
          c.documento?.includes(q) ||
          c.celular?.includes(q)
      ),
    [clientes, q]
  );

  const resetForm = () => { setForm(FORM_VACIO); setShowForm(false); setEditItem(null); };

  const handleSave = async () => {
    if (!form.nombre) return;
    setSaving(true);
    if (editItem) { await onEdit({ ...editItem, ...form }); setEditItem(null); }
    else { await onAdd(form); resetForm(); }
    setSaving(false);
  };

  const downloadTemplate = () => {
    const headers = ["tipo_persona","nombre","email","celular","tipo_documento","documento","ciudad","direccion","nombre_contacto","telefono_contacto","notas"];
    const ejemplo1 = ["Natural","Juan Pérez García","juan@email.com","3001234567","CC","12345678","Bogotá","Calle 123","","","Cliente ejemplo"];
    const ejemplo2 = ["Jurídica","Empresa S.A.S","empresa@email.com","3009876543","NIT","900123456-1","Medellín","Av. Principal 45","María López","3112223344","Empresa ejemplo"];
    const csvContent = [headers, ejemplo1, ejemplo2].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "template_clientes.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true); setImportMsg("");
    const text = await file.text();
    const lines = text.trim().split("\n");
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\r/g, ""));
    let ok = 0, errors = 0;
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(",").map((v) => v.trim().replace(/\r/g, ""));
      const row = {};
      headers.forEach((h, idx) => { row[h] = vals[idx] || ""; });
      if (!row.nombre) { errors++; continue; }
      try {
        await onAdd({
          tipoPersona: row.tipo_persona || "Natural",
          nombre: row.nombre, email: row.email, celular: row.celular,
          tipoDocumento: row.tipo_documento || "CC", documento: row.documento,
          ciudad: row.ciudad, direccion: row.direccion,
          nombreContacto: row.nombre_contacto, telefonoContacto: row.telefono_contacto,
          notas: row.notas,
        });
        ok++;
      } catch { errors++; }
    }
    setImportMsg(`${ok} importados${errors > 0 ? ` · ${errors} errores` : ""}`);
    setImporting(false);
    e.target.value = "";
  };

  const openEdit = (c) => {
    setEditItem(c);
    setForm({
      tipoPersona: c.tipoPersona || "Natural", nombre: c.nombre || "",
      email: c.email || "", celular: c.celular || "", documento: c.documento || "",
      tipoDocumento: c.tipoDocumento || "CC", ciudad: c.ciudad || "",
      direccion: c.direccion || "", notas: c.notas || "",
      nombreContacto: c.nombreContacto || "", telefonoContacto: c.telefonoContacto || "",
    });
  };

  return (
    <div>
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>Clientes</div>
          <div style={S.pageSub}>{clientesFiltrados.length} clientes registrados</div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label style={{ ...S.btn("secondary"), cursor: "pointer" }}>
            Importar .CSV
            <input type="file" accept=".csv,.xlsx" style={{ display: "none" }} onChange={handleImport} disabled={importing} />
          </label>
          <button style={S.btn("secondary")} onClick={downloadTemplate}>Bajar Template</button>
          <button style={S.btn("primary")} onClick={() => setShowForm(true)}>
            <Icon name="plus" size={16} />Nuevo Cliente
          </button>
        </div>
      </div>

      {importMsg && (
        <div style={{ ...S.alertBox("#16a34a"), marginBottom: 16 }}>
          <span style={{ fontSize: 13.5, color: "#16a34a", fontWeight: 600 }}>{importMsg}</span>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div style={S.searchBar}>
          <Icon name="search" size={16} />
          <input
            style={S.searchInput}
            placeholder="Buscar por nombre, email, documento, celular…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div style={S.tableWrap}>
        <div style={{ ...S.tableHead, gridTemplateColumns: "0.7fr 1.8fr 1.2fr 1fr 1fr 0.8fr 100px" }}>
          <span>Tipo</span><span>Nombre</span><span>Celular / Email</span>
          <span>Documento</span><span>Ciudad</span><span>Contacto</span><span>Acciones</span>
        </div>
        {clientesFiltrados.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#aaa" }}>
            No hay clientes registrados
          </div>
        ) : (
          clientesFiltrados.map((c) => (
            <div
              key={c.id}
              style={{ ...S.tableRow, gridTemplateColumns: "0.7fr 1.8fr 1.2fr 1fr 1fr 0.8fr 100px" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = BLUE.light)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "")}
            >
              <span style={S.chip(c.tipoPersona === "Jurídica" ? "#7c3aed" : BLUE.primary)}>
                {c.tipoPersona === "Jurídica" ? "J" : "N"}
              </span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{c.nombre}</div>
                {c.tipoPersona === "Jurídica" && c.nombreContacto && (
                  <div style={{ fontSize: 11.5, color: "#888" }}>Cto: {c.nombreContacto}</div>
                )}
              </div>
              <div>
                <div style={{ fontSize: 13 }}>{c.celular || c.telefono || "—"}</div>
                {c.tipoPersona === "Jurídica" && c.telefonoContacto && (
                  <div style={{ fontSize: 11.5, color: "#7c3aed" }}>Cto: {c.telefonoContacto}</div>
                )}
                <div style={{ fontSize: 11.5, color: "#888" }}>{c.email || ""}</div>
              </div>
              <div style={{ fontSize: 13 }}>{c.tipoDocumento}: {c.documento || "—"}</div>
              <div style={{ fontSize: 13, color: "#555" }}>{c.ciudad || "—"}</div>
              <div style={{ fontSize: 12.5, color: "#555" }}>
                {c.tipoPersona === "Jurídica" ? (c.telefonoContacto || "—") : "—"}
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <button style={S.btn("ghost")} onClick={() => openEdit(c)}>
                  <Icon name="edit" size={14} />
                </button>
                {esAdmin(userRol) && (
                  <button
                    style={{ ...S.btn("ghost"), color: "#dc2626" }}
                    onClick={() => setDelItem(c)}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {(showForm || editItem) && (
        <Modal
          title={editItem ? "Editar Cliente" : "Nuevo Cliente"}
          onClose={resetForm}
          wide
          footer={
            <>
              <button style={S.btn("secondary")} onClick={resetForm}>Cancelar</button>
              <button
                style={{ ...S.btn("primary"), opacity: form.nombre && !saving ? 1 : 0.5 }}
                onClick={handleSave}
                disabled={!form.nombre || saving}
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </>
          }
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
            <div style={{ ...S.formGroup, gridColumn: "1/-1" }}>
              <label style={S.label}>Tipo de Persona *</label>
              <div style={{ display: "flex", gap: 10 }}>
                {["Natural", "Jurídica"].map((tp) => (
                  <button
                    key={tp}
                    onClick={() => set("tipoPersona", tp)}
                    style={{
                      flex: 1, padding: "10px 20px", borderRadius: 10,
                      border: `2px solid ${form.tipoPersona === tp ? BLUE.primary : BLUE.border}`,
                      background: form.tipoPersona === tp ? BLUE.primary : "#fff",
                      color: form.tipoPersona === tp ? "#fff" : BLUE.text,
                      fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
                    }}
                  >
                    {tp === "Natural" ? "Persona Natural" : "Persona Jurídica"}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ ...S.formGroup, gridColumn: "1/-1" }}>
              <label style={S.label}>{form.tipoPersona === "Jurídica" ? "Razón Social *" : "Nombre Completo *"}</label>
              <input
                style={S.input}
                value={form.nombre}
                onChange={(e) => set("nombre", e.target.value)}
                placeholder={form.tipoPersona === "Jurídica" ? "Empresa S.A.S" : "Nombre completo"}
              />
            </div>

            <div style={S.formGroup}>
              <label style={S.label}>Tipo Documento</label>
              <select style={S.select} value={form.tipoDocumento} onChange={(e) => set("tipoDocumento", e.target.value)}>
                {(form.tipoPersona === "Jurídica" ? ["NIT","RUT"] : ["CC","CE","Pasaporte"]).map(
                  (t) => <option key={t}>{t}</option>
                )}
              </select>
            </div>
            <div style={S.formGroup}>
              <label style={S.label}>N° Documento</label>
              <input style={S.input} value={form.documento} onChange={(e) => set("documento", e.target.value)} />
            </div>
            <div style={S.formGroup}>
              <label style={S.label}>Celular</label>
              <input style={S.input} value={form.celular} onChange={(e) => set("celular", e.target.value)} placeholder="3001234567" />
            </div>
            <div style={S.formGroup}>
              <label style={S.label}>Correo Electrónico</label>
              <input style={S.input} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div style={S.formGroup}>
              <label style={S.label}>Ciudad</label>
              <input style={S.input} value={form.ciudad} onChange={(e) => set("ciudad", e.target.value)} />
            </div>
            <div style={S.formGroup}>
              <label style={S.label}>Dirección</label>
              <input style={S.input} value={form.direccion} onChange={(e) => set("direccion", e.target.value)} />
            </div>

            {form.tipoPersona === "Jurídica" && (
              <>
                <div style={S.formGroup}>
                  <label style={S.label}>Nombre Contacto</label>
                  <input style={S.input} value={form.nombreContacto} onChange={(e) => set("nombreContacto", e.target.value)} placeholder="Nombre del contacto principal" />
                </div>
                <div style={S.formGroup}>
                  <label style={S.label}>Teléfono Contacto</label>
                  <input style={S.input} value={form.telefonoContacto} onChange={(e) => set("telefonoContacto", e.target.value)} placeholder="3001234567" />
                </div>
              </>
            )}

            <div style={{ ...S.formGroup, gridColumn: "1/-1" }}>
              <label style={S.label}>Notas</label>
              <textarea style={{ ...S.input, minHeight: 60, resize: "vertical" }} value={form.notas} onChange={(e) => set("notas", e.target.value)} />
            </div>
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
            ¿Eliminar al cliente <strong>{delItem.nombre}</strong>?
          </p>
        </Modal>
      )}
    </div>
  );
};

export default ClientesPage;
