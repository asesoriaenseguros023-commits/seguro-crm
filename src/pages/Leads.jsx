import { useState, useMemo, useEffect } from "react";
import { S, BLUE } from "../constants.js";
import { fmt, fmtDate, today, esAdmin } from "../helpers.js";
import Icon from "../components/Icon.jsx";
import Modal from "../components/Modal.jsx";

// ─── INTERESADO FORM ──────────────────────────────────────────────────────────
export const InteresadoForm = ({ initial, agentes, ramos, clientes, onSave, onClose }) => {
  const [form, setForm] = useState(
    initial || {
      clienteId: "", tipoSeguro: "", documentosChecklist: {},
      envioOficina: false, notas: "", estado: "Lead", fechaRegistro: today(),
    }
  );
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setDoc = (nombre, val) =>
    setForm((f) => ({ ...f, documentosChecklist: { ...f.documentosChecklist, [nombre]: val } }));

  const clienteSeleccionado = clientes.find((c) => c.id === form.clienteId);
  const ramoSeleccionado = ramos.find((r) => r.nombre === form.tipoSeguro);

  const docsDelRamo = useMemo(() => {
    if (!ramoSeleccionado?.documentos) return [];
    const esJuridica = clienteSeleccionado?.tipo_persona === "Jurídica";
    if (esJuridica) {
      return Object.entries(ramoSeleccionado.documentos)
        .filter(([k, v]) => v && k.startsWith("J_"))
        .map(([k]) => k.slice(2));
    } else {
      return Object.entries(ramoSeleccionado.documentos)
        .filter(([k, v]) => v && !k.startsWith("J_"))
        .map(([k]) => k);
    }
  }, [ramoSeleccionado, clienteSeleccionado]);

  const valid = form.clienteId && form.tipoSeguro;
  const handleSave = async () => { setSaving(true); await onSave(form); setSaving(false); };

  const infoStyle = {
    background: "#f8faff", borderRadius: 8, padding: "10px 14px",
    fontSize: 13, color: BLUE.text, border: `1px solid ${BLUE.border}`,
  };

  return (
    <Modal
      title={initial?.id ? "Editar Lead" : "Nuevo Lead"}
      onClose={onClose}
      wide
      footer={
        <>
          <button style={S.btn("secondary")} onClick={onClose}>Cancelar</button>
          <button
            style={{ ...S.btn("primary"), opacity: valid && !saving ? 1 : 0.5 }}
            onClick={handleSave}
            disabled={!valid || saving}
          >
            {saving ? "Guardando…" : "Guardar Lead"}
          </button>
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
        <div style={{ ...S.formGroup, gridColumn: "1/-1" }}>
          <label style={S.label}>Cliente *</label>
          <select style={S.select} value={form.clienteId} onChange={(e) => set("clienteId", e.target.value)}>
            <option value="">— Selecciona un cliente —</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>

        {clienteSeleccionado && (
          <div style={{ ...S.formGroup, gridColumn: "1/-1" }}>
            <div style={{ ...infoStyle, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div><span style={{ fontSize: 11, color: "#aaa", display: "block" }}>TIPO DE PERSONA</span><strong>{clienteSeleccionado.tipo_persona || "Natural"}</strong></div>
              <div><span style={{ fontSize: 11, color: "#aaa", display: "block" }}>DOCUMENTO</span>{clienteSeleccionado.rfc || clienteSeleccionado.documento || "—"}</div>
              <div><span style={{ fontSize: 11, color: "#aaa", display: "block" }}>CORREO</span>{clienteSeleccionado.email || "—"}</div>
              <div><span style={{ fontSize: 11, color: "#aaa", display: "block" }}>TELÉFONO</span>{clienteSeleccionado.telefono || clienteSeleccionado.celular || "—"}</div>
              {clienteSeleccionado.tipo_persona === "Jurídica" && (
                <>
                  <div><span style={{ fontSize: 11, color: "#aaa", display: "block" }}>CONTACTO</span>{clienteSeleccionado.nombre_contacto || "—"}</div>
                  <div><span style={{ fontSize: 11, color: "#aaa", display: "block" }}>TEL. CONTACTO</span>{clienteSeleccionado.telefono_contacto || "—"}</div>
                </>
              )}
            </div>
          </div>
        )}

        <div style={S.formGroup}>
          <label style={S.label}>Fecha de Registro</label>
          <input style={{ ...S.input, background: "#f8faff", color: "#6b87b0" }} type="date" value={form.fechaRegistro} readOnly />
        </div>

        <div style={S.formGroup}>
          <label style={S.label}>Tipo de Seguro *</label>
          <select style={S.select} value={form.tipoSeguro} onChange={(e) => { set("tipoSeguro", e.target.value); set("documentosChecklist", {}); }}>
            <option value="">— Selecciona —</option>
            {ramos.map((r) => <option key={r.id} value={r.nombre}>{r.nombre}</option>)}
          </select>
        </div>

        {form.tipoSeguro && docsDelRamo.length > 0 && (
          <div style={{ gridColumn: "1/-1", background: "#f8faff", border: `1px solid ${BLUE.border}`, borderRadius: 10, padding: "16px 18px", marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: BLUE.text, marginBottom: 12 }}>
              Documentos — {form.tipoSeguro}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {docsDelRamo.map((doc) => (
                <label
                  key={doc}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    background: form.documentosChecklist[doc] === "Sí" ? "#f0fdf4" : "#fff",
                    border: `1px solid ${form.documentosChecklist[doc] === "Sí" ? "#bbf7d0" : BLUE.border}`,
                    borderRadius: 8, padding: "10px 14px", cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.documentosChecklist[doc] === "Sí"}
                    onChange={(e) => setDoc(doc, e.target.checked ? "Sí" : "No")}
                    style={{ width: 17, height: 17, accentColor: "#16a34a", cursor: "pointer" }}
                  />
                  <span style={{
                    fontSize: 13.5,
                    color: form.documentosChecklist[doc] === "Sí" ? "#16a34a" : BLUE.text,
                    fontWeight: form.documentosChecklist[doc] === "Sí" ? 600 : 400,
                  }}>
                    {doc}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {form.tipoSeguro && docsDelRamo.length === 0 && (
          <div style={{ gridColumn: "1/-1", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#92400e" }}>
            <Icon name="warning" size={14} /> Este ramo no tiene documentos configurados. Ve a <strong>Ramos de Seguros</strong> para agregarlos.
          </div>
        )}

        <div style={{ ...S.formGroup, gridColumn: "1/-1" }}>
          <label style={S.label}>Notas</label>
          <textarea style={{ ...S.input, minHeight: 60, resize: "vertical" }} value={form.notas} onChange={(e) => set("notas", e.target.value)} />
        </div>

        {(() => {
          const ramoObj = ramos.find((r) => r.nombre === form.tipoSeguro);
          const docsRamo = ramoObj?.documentos
            ? Object.entries(ramoObj.documentos).filter(([, v]) => v).map(([k]) => k)
            : [];
          const todosCompletos = docsRamo.length > 0 && docsRamo.every((d) => form.documentosChecklist[d] === "Sí");
          const bloqueado = docsRamo.length > 0 && !todosCompletos;
          return (
            <div style={{
              gridColumn: "1/-1", display: "flex", alignItems: "center", gap: 12,
              background: form.envioOficina ? "#f0fdf4" : bloqueado ? "#fafafa" : BLUE.light,
              border: `1px solid ${form.envioOficina ? "#bbf7d0" : bloqueado ? "#e5e7eb" : BLUE.border}`,
              borderRadius: 10, padding: "12px 16px", opacity: bloqueado ? 0.6 : 1,
            }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: bloqueado ? "not-allowed" : "pointer", flex: 1 }}>
                <input
                  type="checkbox"
                  checked={form.envioOficina}
                  onChange={(e) => !bloqueado && set("envioOficina", e.target.checked)}
                  disabled={bloqueado}
                  style={{ width: 18, height: 18, accentColor: "#16a34a", cursor: bloqueado ? "not-allowed" : "pointer" }}
                />
                <div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: form.envioOficina ? "#16a34a" : bloqueado ? "#aaa" : BLUE.text }}>
                    {form.envioOficina ? "Enviado a cotización" : "Enviado a cotización"}
                  </span>
                  {bloqueado && (
                    <div style={{ fontSize: 11.5, color: "#f59e0b", marginTop: 2 }}>
                      <Icon name="warning" size={12} /> Completa todos los documentos primero
                    </div>
                  )}
                </div>
              </label>
            </div>
          );
        })()}
      </div>
    </Modal>
  );
};

// ─── COTIZACION FORM ──────────────────────────────────────────────────────────
export const CotizacionForm = ({ interesado, initial, agentes, ramos, onSave, onClose }) => {
  const [form, setForm] = useState(
    initial || {
      interesadoId: interesado?.id || "",
      agenteId: interesado?.agenteId || agentes[0]?.id || "",
      ramo: interesado?.tipoSeguro || ramos[0]?.nombre || "",
      aseguradora: "", sumaAsegurada: "", prima: "", iva: "",
      gastosExpedicion: "", numeroPoliza: "", fechaCotizacion: today(),
      notas: "", estado: "Pendiente",
    }
  );
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.aseguradora && form.prima && form.fechaCotizacion;
  const totalCotizacion = (Number(form.prima) || 0) + (Number(form.iva) || 0) + (Number(form.gastosExpedicion) || 0);
  const handleSave = async () => { setSaving(true); await onSave(form); setSaving(false); };

  return (
    <Modal
      title={initial?.id ? "Editar Cotización" : `Nueva Cotización — ${interesado?.nombre || ""}`}
      onClose={onClose}
      wide
      footer={
        <>
          <button style={S.btn("secondary")} onClick={onClose}>Cancelar</button>
          <button
            style={{ ...S.btn("primary"), opacity: valid && !saving ? 1 : 0.5 }}
            onClick={handleSave}
            disabled={!valid || saving}
          >
            {saving ? "Guardando…" : "Guardar Cotización"}
          </button>
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
        <div style={S.formGroup}>
          <label style={S.label}>Ramo</label>
          <select style={S.select} value={form.ramo} onChange={(e) => set("ramo", e.target.value)}>
            {ramos.map((r) => <option key={r.id} value={r.nombre}>{r.nombre}</option>)}
          </select>
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>Aseguradora *</label>
          <input style={S.input} value={form.aseguradora} onChange={(e) => set("aseguradora", e.target.value)} placeholder="Ej. Sura, Bolivar, Allianz" />
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>Suma Asegurada</label>
          <input style={S.input} type="number" value={form.sumaAsegurada} onChange={(e) => set("sumaAsegurada", e.target.value)} />
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>Prima *</label>
          <input style={S.input} type="number" value={form.prima} onChange={(e) => set("prima", e.target.value)} />
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>IVA</label>
          <input style={S.input} type="number" value={form.iva} onChange={(e) => set("iva", e.target.value)} />
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>Gastos de Expedición</label>
          <input style={S.input} type="number" value={form.gastosExpedicion} onChange={(e) => set("gastosExpedicion", e.target.value)} />
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>N° Póliza (si aplica)</label>
          <input style={S.input} value={form.numeroPoliza} onChange={(e) => set("numeroPoliza", e.target.value)} />
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>Fecha de Cotización *</label>
          <input style={S.input} type="date" value={form.fechaCotizacion} onChange={(e) => set("fechaCotizacion", e.target.value)} />
        </div>
        <div style={{ ...S.formGroup, gridColumn: "1/-1" }}>
          <label style={S.label}>Notas</label>
          <textarea style={{ ...S.input, minHeight: 60, resize: "vertical" }} value={form.notas} onChange={(e) => set("notas", e.target.value)} />
        </div>
        {totalCotizacion > 0 && (
          <div style={{ gridColumn: "1/-1", background: BLUE.light, borderRadius: 10, padding: "12px 16px", border: `1px solid ${BLUE.border}` }}>
            <div style={{ fontSize: 12, color: BLUE.primary, fontWeight: 700, marginBottom: 6 }}>RESUMEN DE COTIZACIÓN</div>
            <div style={{ display: "flex", gap: 24, fontSize: 13 }}>
              <span>Prima: <strong>{fmt(Number(form.prima) || 0)}</strong></span>
              <span>IVA: <strong>{fmt(Number(form.iva) || 0)}</strong></span>
              <span>Gastos: <strong>{fmt(Number(form.gastosExpedicion) || 0)}</strong></span>
              <span style={{ color: BLUE.primary, fontWeight: 700 }}>Total: <strong>{fmt(totalCotizacion)}</strong></span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

// ─── EMISION FORM ─────────────────────────────────────────────────────────────
export const EmisionForm = ({ cotizacion, interesado, ramos, onSave, onClose }) => {
  const [form, setForm] = useState({
    fechaEmision: today(), vigenciaInicio: today(), vigenciaFin: "",
    ramoId: ramos.find((r) => r.nombre === cotizacion?.ramo)?.id || ramos[0]?.id || "",
    notas: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.fechaEmision && form.vigenciaInicio && form.vigenciaFin;
  const handleSave = async () => { setSaving(true); await onSave(form); setSaving(false); };

  return (
    <Modal
      title={`Emitir Póliza — ${interesado?.nombre || ""}`}
      onClose={onClose}
      footer={
        <>
          <button style={S.btn("secondary")} onClick={onClose}>Cancelar</button>
          <button
            style={{ ...S.btn("success"), opacity: valid && !saving ? 1 : 0.5 }}
            onClick={handleSave}
            disabled={!valid || saving}
          >
            {saving ? "Emitiendo…" : "Emitir Póliza"}
          </button>
        </>
      }
    >
      <div style={{ background: BLUE.light, borderRadius: 10, padding: "12px 16px", marginBottom: 20, border: `1px solid ${BLUE.border}` }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: BLUE.primary, marginBottom: 8 }}>DATOS DE LA COTIZACIÓN</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 13 }}>
          <span>Ramo: <strong>{cotizacion?.ramo}</strong></span>
          <span>Aseguradora: <strong>{cotizacion?.aseguradora}</strong></span>
          <span>Prima: <strong>{fmt(cotizacion?.prima || 0)}</strong></span>
          <span>N° Póliza: <strong>{cotizacion?.numeroPoliza || "—"}</strong></span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
        <div style={S.formGroup}>
          <label style={S.label}>Ramo de Seguros *</label>
          <select style={S.select} value={form.ramoId} onChange={(e) => set("ramoId", e.target.value)}>
            {ramos.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>Fecha de Emisión *</label>
          <input style={S.input} type="date" value={form.fechaEmision} onChange={(e) => set("fechaEmision", e.target.value)} />
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>Vigencia Inicio *</label>
          <input style={S.input} type="date" value={form.vigenciaInicio} onChange={(e) => set("vigenciaInicio", e.target.value)} />
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>Vigencia Fin *</label>
          <input style={S.input} type="date" value={form.vigenciaFin} onChange={(e) => set("vigenciaFin", e.target.value)} />
        </div>
        <div style={{ ...S.formGroup, gridColumn: "1/-1" }}>
          <label style={S.label}>Notas adicionales</label>
          <textarea style={{ ...S.input, minHeight: 60, resize: "vertical" }} value={form.notas} onChange={(e) => set("notas", e.target.value)} />
        </div>
      </div>
    </Modal>
  );
};

// ─── POLIZA EMITIDA MODAL ─────────────────────────────────────────────────────
export const PolizaEmitidaModal = ({ cot, aseguradoras, onSave, onClose }) => {
  const [form, setForm] = useState({
    numeroPolizaEmitida: cot.numeroPolizaEmitida || "",
    aseguradoraEmitida: cot.aseguradoraEmitida || "",
    primaEmitida: cot.primaEmitida || "",
    ivaEmitida: cot.ivaEmitida || "",
    gastosEmitida: cot.gastosEmitida || "",
    totalPagoEmitida: cot.totalPagoEmitida || "",
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const total = (parseFloat(form.primaEmitida) || 0) + (parseFloat(form.ivaEmitida) || 0) + (parseFloat(form.gastosEmitida) || 0);
    setForm((f) => ({ ...f, totalPagoEmitida: total || "" }));
  }, [form.primaEmitida, form.ivaEmitida, form.gastosEmitida]);

  const handleSave = async () => { setSaving(true); await onSave(form); setSaving(false); };

  return (
    <Modal
      title="Registrar Póliza Emitida"
      onClose={onClose}
      footer={
        <>
          <button style={S.btn("secondary")} onClick={onClose}>Cancelar</button>
          <button style={{ ...S.btn("success"), opacity: saving ? 0.6 : 1 }} onClick={handleSave} disabled={saving}>
            {saving ? "Guardando…" : "Guardar Póliza"}
          </button>
        </>
      }
    >
      <div style={{ background: BLUE.light, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
        <strong>{cot.clienteNombre}</strong> · {cot.ramo}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
        <div style={{ ...S.formGroup, gridColumn: "1/-1" }}>
          <label style={S.label}>N° Póliza *</label>
          <input style={S.input} value={form.numeroPolizaEmitida} onChange={(e) => set("numeroPolizaEmitida", e.target.value)} placeholder="Número de póliza" />
        </div>
        <div style={{ ...S.formGroup, gridColumn: "1/-1" }}>
          <label style={S.label}>Aseguradora *</label>
          <select style={S.select} value={form.aseguradoraEmitida} onChange={(e) => set("aseguradoraEmitida", e.target.value)}>
            <option value="">— Selecciona aseguradora —</option>
            {(aseguradoras || []).filter((a) => a.activo !== false).map((a) => <option key={a.id} value={a.nombre}>{a.nombre}</option>)}
          </select>
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>Prima</label>
          <input style={S.input} type="number" value={form.primaEmitida} onChange={(e) => set("primaEmitida", e.target.value)} placeholder="0" />
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>IVA</label>
          <input style={S.input} type="number" value={form.ivaEmitida} onChange={(e) => set("ivaEmitida", e.target.value)} placeholder="0" />
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>Gastos</label>
          <input style={S.input} type="number" value={form.gastosEmitida} onChange={(e) => set("gastosEmitida", e.target.value)} placeholder="0" />
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>Total Pago</label>
          <input style={{ ...S.input, background: "#f0fdf4", fontWeight: 700, color: "#16a34a" }} type="number" value={form.totalPagoEmitida} readOnly />
        </div>
      </div>
    </Modal>
  );
};

// ─── INTERESADOS PAGE ─────────────────────────────────────────────────────────
const InteresadosPage = ({
  interesados, cotizaciones, polizas, agentes, ramos, clientes,
  onAddInteresado, onEditInteresado, onDeleteInteresado,
  onAddCotizacion, onEditCotizacion, onEmitirPoliza,
  userRol, agenteActualId,
}) => {
  const [q, setQ] = useState("");
  const [showFormInteresado, setShowFormInteresado] = useState(false);
  const [editInteresado, setEditInteresado] = useState(null);
  const [delInteresado, setDelInteresado] = useState(null);
  const [showCotizacion, setShowCotizacion] = useState(null);
  const [editCotizacion, setEditCotizacion] = useState(null);
  const [showEmision, setShowEmision] = useState(null);

  const interesadosFiltrados = useMemo(() => {
    const base = esAdmin(userRol)
      ? interesados
      : interesados.filter((i) => i.agenteId === agenteActualId);
    return base.filter(
      (i) =>
        !q ||
        i.nombre?.toLowerCase().includes(q.toLowerCase()) ||
        i.telefono?.includes(q) ||
        i.email?.toLowerCase().includes(q.toLowerCase())
    );
  }, [interesados, q, userRol, agenteActualId]);

  const handleSaveInteresado = async (form) => {
    if (editInteresado) { await onEditInteresado({ ...editInteresado, ...form }); setEditInteresado(null); }
    else { await onAddInteresado(form); setShowFormInteresado(false); }
  };

  const handleSaveCotizacion = async (form) => {
    if (editCotizacion) { await onEditCotizacion({ ...editCotizacion, ...form }); setEditCotizacion(null); }
    else { await onAddCotizacion(form); setShowCotizacion(null); }
  };

  const handleEmitir = async (form) => {
    await onEmitirPoliza({ cotizacion: showEmision.cotizacion, interesado: showEmision.interesado, ...form });
    setShowEmision(null);
  };

  return (
    <div>
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>Leads</div>
          <div style={S.pageSub}>{interesadosFiltrados.length} leads registrados</div>
        </div>
        <button style={S.btn("primary")} onClick={() => setShowFormInteresado(true)}>
          <Icon name="plus" size={16} />Nuevo Lead
        </button>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div style={S.searchBar}>
          <Icon name="search" size={16} />
          <input style={S.searchInput} placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div style={S.tableWrap}>
        <div style={{ ...S.tableHead, gridTemplateColumns: "40px 100px 1.6fr 1fr 140px 150px 1fr" }}>
          <span>#</span><span>Fecha</span><span>Cliente</span><span>Tipo Seguro</span>
          <span>Estado Docs</span><span>Enviado a Cotización</span><span>Acciones</span>
        </div>
        {interesadosFiltrados.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#aaa" }}>
            No hay leads registrados
          </div>
        ) : (
          interesadosFiltrados.map((i, idx) => {
            const cliente = clientes.find((c) => c.id === i.clienteId);
            const ramoObj = ramos.find((r) => r.nombre === i.tipoSeguro);
            const docsDelRamo = ramoObj?.documentos
              ? Object.entries(ramoObj.documentos).filter(([, v]) => v).map(([k]) => k)
              : [];
            const checklist = i.documentosChecklist || {};
            const todosCompletos = docsDelRamo.length > 0 && docsDelRamo.every((d) => checklist[d] === "Sí");
            const estadoDocs = docsDelRamo.length === 0 ? null : todosCompletos ? "Completos" : "Incompletos";
            const docColor = todosCompletos ? "#16a34a" : "#f59e0b";

            return (
              <div
                key={i.id}
                style={{ ...S.tableRow, gridTemplateColumns: "40px 100px 1.6fr 1fr 140px 150px 1fr" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = BLUE.light)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "")}
              >
                <div style={{ fontWeight: 700, color: "#aaa", fontSize: 13 }}>{idx + 1}</div>
                <div style={{ fontSize: 13, color: "#555" }}>{fmtDate(i.fechaRegistro)}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{cliente?.nombre || i.nombre || "—"}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>{cliente?.email || ""}</div>
                  <div style={{ fontSize: 11, color: "#6b87b0" }}>
                    {cliente?.tipo_persona === "Jurídica"
                      ? (cliente?.telefono_contacto || cliente?.nombre_contacto || "")
                      : (cliente?.celular || cliente?.telefono || "")}
                  </div>
                </div>
                <span style={S.chip(BLUE.primary)}>{i.tipoSeguro || "—"}</span>
                <div>
                  {estadoDocs ? (
                    <span style={S.badge(docColor)}>
                      {estadoDocs === "Completos" ? "Completos" : "Incompletos"}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: "#ccc" }}>—</span>
                  )}
                </div>
                <div>
                  {i.envioOficina
                    ? <span style={S.badge("#16a34a")}>Si</span>
                    : <span style={S.badge("#6b7280")}>No</span>}
                </div>
                <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                  <button style={S.btn("ghost")} onClick={() => setEditInteresado(i)}>
                    <Icon name="edit" size={14} />
                  </button>
                  {esAdmin(userRol) && (
                    <button style={{ ...S.btn("ghost"), color: "#dc2626" }} onClick={() => setDelInteresado(i)}>
                      <Icon name="trash" size={14} />
                    </button>
                  )}
                  {i.envioOficina ? (
                    <span style={{ ...S.badge("#16a34a"), fontSize: 11.5, whiteSpace: "nowrap" }}>En Cotización</span>
                  ) : docsDelRamo.length === 0 ? (
                    <span style={{ ...S.badge(BLUE.primary), fontSize: 11.5, whiteSpace: "nowrap" }}>Llamar al Cliente</span>
                  ) : !todosCompletos ? (
                    <span style={{ ...S.badge("#f59e0b"), fontSize: 11.5, whiteSpace: "nowrap" }}>Pendiente Docs</span>
                  ) : (
                    <span style={{ ...S.badge("#16a34a"), fontSize: 11.5, whiteSpace: "nowrap" }}>Listo</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {(showFormInteresado || editInteresado) && (
        <InteresadoForm
          initial={editInteresado}
          agentes={agentes}
          ramos={ramos}
          clientes={clientes}
          onSave={handleSaveInteresado}
          onClose={() => { setShowFormInteresado(false); setEditInteresado(null); }}
        />
      )}
      {showCotizacion && (
        <CotizacionForm
          interesado={showCotizacion}
          agentes={agentes}
          ramos={ramos}
          onSave={async (form) => { await onAddCotizacion(form); setShowCotizacion(null); }}
          onClose={() => setShowCotizacion(null)}
        />
      )}
      {delInteresado && (
        <Modal
          title="Confirmar eliminación"
          onClose={() => setDelInteresado(null)}
          footer={
            <>
              <button style={S.btn("secondary")} onClick={() => setDelInteresado(null)}>Cancelar</button>
              <button style={S.btn("danger")} onClick={async () => { await onDeleteInteresado(delInteresado.id); setDelInteresado(null); }}>Eliminar</button>
            </>
          }
        >
          <p style={{ fontSize: 14, color: "#555" }}>
            ¿Eliminar al lead <strong>{delInteresado.nombre}</strong>? Sus cotizaciones también serán eliminadas.
          </p>
        </Modal>
      )}
    </div>
  );
};

export default InteresadosPage;
