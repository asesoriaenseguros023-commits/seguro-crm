import { useState, useEffect } from "react";
import { supabase } from "../supabase.js";
import { S, BLUE } from "../constants.js";
import { fmt, fmtDate, today, mapInmueble, toInmuebleRow, mapArrendatario, mapPago, toPagoRow, mapArrendador, toArrendadorRow } from "../helpers.js";
import { generarComprobante, METODOS_LABEL } from "../pdfComprobante.js";
import Icon from "../components/Icon.jsx";
import Modal from "../components/Modal.jsx";

const TABS = [
  { id: "inmuebles", label: "Inmuebles" },
  { id: "arrendatarios", label: "Arrendatarios" },
  { id: "pagos", label: "Pagos" },
  { id: "alertas", label: "Alertas" },
  { id: "arrendador", label: "Arrendador" },
  { id: "movimientos", label: "Movimientos", proximamente: true },
];

const INMUEBLE_INIT = { nombre: "", direccion: "", valorCanonBase: "", diaVencimientoPago: 5, activo: true, arrendatarioId: "" };
const ARRENDATARIO_INIT = { nombre: "", telefono: "", documento: "", inmuebleId: "" };
const PAGO_INIT = { inmuebleId: "", arrendatarioId: "", fechaPago: today(), periodoInicio: "", periodoFin: "", valor: "", metodo: "efectivo", estado: "pagado" };
const ARRENDADOR_INIT = { nombre: "", documento: "", telefono: "", direccion: "" };

// Un inmueble está "al día" del mes en curso si existe un pago cuyo período
// cubre el día de vencimiento de este mes. Si no, según cuánto falte/pasó
// esa fecha, el inmueble está "en mora" o "próximo a vencer".
function calcularEstadoPago(inmueble, pagos) {
  if (!inmueble.arrendatarioId) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const anio = hoy.getFullYear(), mes = hoy.getMonth();
  const ultimoDiaMes = new Date(anio, mes + 1, 0).getDate();
  const diaVence = Math.min(inmueble.diaVencimientoPago, ultimoDiaMes);
  const fechaVence = new Date(anio, mes, diaVence);

  const alDia = pagos.some((p) => {
    if (p.inmuebleId !== inmueble.id || !p.periodoInicio || !p.periodoFin) return false;
    const ini = new Date(p.periodoInicio + "T00:00:00"), fin = new Date(p.periodoFin + "T00:00:00");
    return ini <= fechaVence && fin >= fechaVence;
  });
  if (alDia) return null;

  const diasDiff = Math.round((fechaVence - hoy) / 86400000);
  if (diasDiff < 0) return { tipo: "mora", dias: -diasDiff, fechaVence };
  if (diasDiff <= 5) return { tipo: "proximo", dias: diasDiff, fechaVence };
  return null;
}

// ─── Inmuebles ────────────────────────────────────────────────────────────
const InmueblesTab = ({ inmuebles, arrendatarios, onAdd, onEdit, onDelete }) => {
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [delItem, setDelItem] = useState(null);
  const [form, setForm] = useState(INMUEBLE_INIT);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const nombreArrendatario = (id) => arrendatarios.find((a) => a.id === id)?.nombre || "";

  const abrirNuevo = () => { setEditItem(null); setForm(INMUEBLE_INIT); setShowForm(true); };
  const abrirEditar = (i) => {
    setEditItem(i);
    setForm({ nombre: i.nombre, direccion: i.direccion, valorCanonBase: i.valorCanonBase, diaVencimientoPago: i.diaVencimientoPago, activo: i.activo, arrendatarioId: i.arrendatarioId || "" });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    const payload = { ...form, valorCanonBase: Number(form.valorCanonBase) || 0, diaVencimientoPago: Number(form.diaVencimientoPago) };
    if (editItem) await onEdit({ id: editItem.id, ...payload });
    else await onAdd(payload);
    setSaving(false);
    setShowForm(false);
    setEditItem(null);
  };

  return (
    <div>
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>Inmuebles</div>
          <div style={S.pageSub}>{inmuebles.length} inmuebles registrados</div>
        </div>
        <button style={S.btn("primary")} onClick={abrirNuevo}>
          <Icon name="plus" size={16} />Nuevo inmueble
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
        {inmuebles.map((i) => (
          <div key={i.id} style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 6px rgba(26,86,219,0.08)", border: `1px solid ${BLUE.border}`, borderTop: `3px solid ${BLUE.primary}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: BLUE.text }}>{i.nombre}</div>
                {i.direccion && <div style={{ fontSize: 12, color: "#6b87b0", marginTop: 2 }}>{i.direccion}</div>}
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <button style={S.btn("ghost")} onClick={() => abrirEditar(i)}><Icon name="edit" size={14} /></button>
                <button style={{ ...S.btn("ghost"), color: "#dc2626" }} onClick={() => setDelItem(i)}><Icon name="trash" size={14} /></button>
              </div>
            </div>
            <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: BLUE.primary }}>{fmt(i.valorCanonBase)}</div>
                <div style={{ fontSize: 11, color: "#6b87b0" }}>Paga el día {i.diaVencimientoPago}</div>
              </div>
              <span style={S.chip(i.activo ? "#16a34a" : "#6b7280")}>{i.activo ? "Activo" : "Inactivo"}</span>
            </div>
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${BLUE.border}` }}>
              {i.arrendatarioId ? (
                <span style={S.chip(BLUE.primary)}>Arrendado a {nombreArrendatario(i.arrendatarioId)}</span>
              ) : (
                <span style={S.chip("#6b7280")}>Vacante</span>
              )}
            </div>
          </div>
        ))}
        {inmuebles.length === 0 && (
          <div style={{ color: "#aaa", fontSize: 13, padding: 20 }}>No hay inmuebles. Agrega el primero.</div>
        )}
      </div>

      {showForm && (
        <Modal
          title={editItem ? "Editar inmueble" : "Nuevo inmueble"}
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
            <input style={S.input} value={form.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Ej. Local 1, Piso 2" autoFocus />
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>Dirección</label>
            <input style={S.input} value={form.direccion} onChange={(e) => set("direccion", e.target.value)} placeholder="Ej. Cra 5 # 10-20" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={S.formGroup}>
              <label style={S.label}>Canon base *</label>
              <input style={S.input} type="number" value={form.valorCanonBase} onChange={(e) => set("valorCanonBase", e.target.value)} placeholder="0" />
            </div>
            <div style={S.formGroup}>
              <label style={S.label}>Día de pago *</label>
              <input style={S.input} type="number" min={1} max={31} value={form.diaVencimientoPago} onChange={(e) => set("diaVencimientoPago", e.target.value)} />
            </div>
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>Arrendatario</label>
            <select style={S.select} value={form.arrendatarioId} onChange={(e) => set("arrendatarioId", e.target.value)}>
              <option value="">— Vacante —</option>
              {arrendatarios.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={form.activo} onChange={(e) => set("activo", e.target.checked)} style={{ width: 16, height: 16, accentColor: BLUE.primary }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: BLUE.text }}>Inmueble activo</span>
          </div>
        </Modal>
      )}

      {delItem && (
        <Modal
          title="Eliminar inmueble"
          onClose={() => setDelItem(null)}
          footer={
            <>
              <button style={S.btn("secondary")} onClick={() => setDelItem(null)}>Cancelar</button>
              <button style={S.btn("danger")} onClick={async () => { await onDelete(delItem.id); setDelItem(null); }}>Eliminar</button>
            </>
          }
        >
          <p style={{ fontSize: 14, color: "#555" }}>¿Eliminar <strong>{delItem.nombre}</strong>? Esto solo es posible si no tiene contratos asociados.</p>
        </Modal>
      )}
    </div>
  );
};

// ─── Arrendatarios ────────────────────────────────────────────────────────
const ArrendatariosTab = ({ arrendatarios, inmuebles, onAdd, onEdit, onDelete, onAsignarInmueble }) => {
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [delItem, setDelItem] = useState(null);
  const [form, setForm] = useState(ARRENDATARIO_INIT);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const inmuebleDe = (arrendatarioId) => inmuebles.find((i) => i.arrendatarioId === arrendatarioId);

  const abrirNuevo = () => { setEditItem(null); setForm(ARRENDATARIO_INIT); setShowForm(true); };
  const abrirEditar = (a) => {
    setEditItem(a);
    setForm({ nombre: a.nombre, telefono: a.telefono, documento: a.documento, inmuebleId: inmuebleDe(a.id)?.id || "" });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    const { inmuebleId, ...datos } = form;
    let id = editItem?.id;
    if (editItem) await onEdit({ id: editItem.id, ...datos });
    else id = await onAdd(datos);
    if (id) await onAsignarInmueble(id, inmuebleId);
    setSaving(false);
    setShowForm(false);
    setEditItem(null);
  };

  return (
    <div>
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>Arrendatarios</div>
          <div style={S.pageSub}>{arrendatarios.length} arrendatarios registrados</div>
        </div>
        <button style={S.btn("primary")} onClick={abrirNuevo}>
          <Icon name="plus" size={16} />Nuevo arrendatario
        </button>
      </div>

      <div style={S.tableWrap}>
        <div style={{ ...S.tableHead, gridTemplateColumns: "1.3fr 1fr 1fr 1.2fr 90px" }}>
          <div>Nombre</div><div>Teléfono</div><div>Documento</div><div>Inmueble</div><div></div>
        </div>
        {arrendatarios.map((a) => (
          <div key={a.id} style={{ ...S.tableRow, gridTemplateColumns: "1.3fr 1fr 1fr 1.2fr 90px" }}>
            <div style={{ fontWeight: 600, color: BLUE.text }}>{a.nombre}</div>
            <div>{a.telefono || "—"}</div>
            <div>{a.documento || "—"}</div>
            <div>
              {inmuebleDe(a.id) ? <span style={S.chip(BLUE.primary)}>{inmuebleDe(a.id).nombre}</span> : <span style={{ color: "#aaa" }}>Sin inmueble</span>}
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <button style={S.btn("ghost")} onClick={() => abrirEditar(a)}><Icon name="edit" size={14} /></button>
              <button style={{ ...S.btn("ghost"), color: "#dc2626" }} onClick={() => setDelItem(a)}><Icon name="trash" size={14} /></button>
            </div>
          </div>
        ))}
        {arrendatarios.length === 0 && (
          <div style={{ padding: 20, color: "#aaa", fontSize: 13 }}>No hay arrendatarios. Agrega el primero.</div>
        )}
      </div>

      {showForm && (
        <Modal
          title={editItem ? "Editar arrendatario" : "Nuevo arrendatario"}
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
            <input style={S.input} value={form.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Nombre completo" autoFocus />
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>Teléfono</label>
            <input style={S.input} value={form.telefono} onChange={(e) => set("telefono", e.target.value)} placeholder="Ej. 3001234567" />
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>Documento</label>
            <input style={S.input} value={form.documento} onChange={(e) => set("documento", e.target.value)} placeholder="Cédula / NIT" />
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>Inmueble que arrienda</label>
            <select style={S.select} value={form.inmuebleId} onChange={(e) => set("inmuebleId", e.target.value)}>
              <option value="">— Ninguno —</option>
              {inmuebles.map((i) => <option key={i.id} value={i.id}>{i.nombre}{i.direccion ? ` — ${i.direccion}` : ""}</option>)}
            </select>
          </div>
        </Modal>
      )}

      {delItem && (
        <Modal
          title="Eliminar arrendatario"
          onClose={() => setDelItem(null)}
          footer={
            <>
              <button style={S.btn("secondary")} onClick={() => setDelItem(null)}>Cancelar</button>
              <button style={S.btn("danger")} onClick={async () => { await onDelete(delItem.id); setDelItem(null); }}>Eliminar</button>
            </>
          }
        >
          <p style={{ fontSize: 14, color: "#555" }}>¿Eliminar <strong>{delItem.nombre}</strong>? Esto solo es posible si no tiene contratos asociados.</p>
        </Modal>
      )}
    </div>
  );
};

// ─── Pagos ────────────────────────────────────────────────────────────────
const PagosTab = ({ pagos, inmuebles, arrendatarios, arrendador, onAdd, onDelete }) => {
  const [showForm, setShowForm] = useState(false);
  const [delItem, setDelItem] = useState(null);
  const [form, setForm] = useState(PAGO_INIT);
  const [saving, setSaving] = useState(false);
  const [errForm, setErrForm] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const nombreInmueble = (id) => inmuebles.find((i) => i.id === id)?.nombre || "—";
  const nombreArr = (id) => arrendatarios.find((a) => a.id === id)?.nombre || "—";

  const abrirNuevo = () => { setForm(PAGO_INIT); setErrForm(""); setShowForm(true); };

  // Al elegir el inmueble, precarga el arrendatario y el canon que tiene
  // asignados hoy (se pueden editar igual si el pago fue distinto).
  const seleccionarInmueble = (id) => {
    const inm = inmuebles.find((i) => i.id === id);
    setForm((f) => ({ ...f, inmuebleId: id, arrendatarioId: inm?.arrendatarioId || "", valor: inm?.valorCanonBase || "" }));
  };

  const handleSave = async () => {
    if (!form.inmuebleId) { setErrForm("Elige el inmueble"); return; }
    if (!form.arrendatarioId) { setErrForm("Elige el arrendatario"); return; }
    if (!form.periodoInicio || !form.periodoFin) { setErrForm("Elige la fecha de inicio y fin del período"); return; }
    if (form.periodoFin < form.periodoInicio) { setErrForm("La fecha fin no puede ser antes que la fecha inicio"); return; }
    if (!form.valor) { setErrForm("Escribe el valor"); return; }
    setSaving(true);
    setErrForm("");
    await onAdd(form);
    setSaving(false);
    setShowForm(false);
  };

  const generar = (pago) => {
    generarComprobante({
      pago,
      inmueble: inmuebles.find((i) => i.id === pago.inmuebleId),
      arrendatario: arrendatarios.find((a) => a.id === pago.arrendatarioId),
      arrendador,
    });
  };

  return (
    <div>
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>Pagos</div>
          <div style={S.pageSub}>{pagos.length} pagos registrados</div>
        </div>
        <button style={S.btn("primary")} onClick={abrirNuevo}>
          <Icon name="plus" size={16} />Registrar pago
        </button>
      </div>

      <div style={S.tableWrap}>
        <div style={{ ...S.tableHead, gridTemplateColumns: "1.2fr 1fr 1.3fr 1fr 1fr 130px" }}>
          <div>Inmueble</div><div>Arrendatario</div><div>Período</div><div>Valor</div><div>Medio</div><div></div>
        </div>
        {pagos.map((p) => (
          <div key={p.id} style={{ ...S.tableRow, gridTemplateColumns: "1.2fr 1fr 1.3fr 1fr 1fr 130px" }}>
            <div style={{ fontWeight: 600, color: BLUE.text }}>{nombreInmueble(p.inmuebleId)}</div>
            <div>{nombreArr(p.arrendatarioId)}</div>
            <div style={{ fontSize: 12.5 }}>{fmtDate(p.periodoInicio)} – {fmtDate(p.periodoFin)}</div>
            <div>{fmt(p.valor)}</div>
            <div>{METODOS_LABEL[p.metodo] || p.metodo}</div>
            <div style={{ display: "flex", gap: 4 }}>
              <button style={S.btn("secondary")} onClick={() => generar(p)}>Generar</button>
              <button style={{ ...S.btn("ghost"), color: "#dc2626" }} onClick={() => setDelItem(p)}><Icon name="trash" size={14} /></button>
            </div>
          </div>
        ))}
        {pagos.length === 0 && (
          <div style={{ padding: 20, color: "#aaa", fontSize: 13 }}>No hay pagos registrados todavía.</div>
        )}
      </div>

      {showForm && (
        <Modal
          title="Registrar pago"
          onClose={() => setShowForm(false)}
          footer={
            <>
              <button style={S.btn("secondary")} onClick={() => setShowForm(false)}>Cancelar</button>
              <button style={{ ...S.btn("primary"), opacity: saving ? 0.6 : 1 }} onClick={handleSave} disabled={saving}>
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </>
          }
        >
          <div style={S.formGroup}>
            <label style={S.label}>Inmueble *</label>
            <select style={S.select} value={form.inmuebleId} onChange={(e) => seleccionarInmueble(e.target.value)}>
              <option value="">Selecciona…</option>
              {inmuebles.map((i) => <option key={i.id} value={i.id}>{i.nombre}{i.direccion ? ` — ${i.direccion}` : ""}</option>)}
            </select>
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>Arrendatario *</label>
            <select style={S.select} value={form.arrendatarioId} onChange={(e) => set("arrendatarioId", e.target.value)}>
              <option value="">Selecciona…</option>
              {arrendatarios.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={S.formGroup}>
              <label style={S.label}>Período — inicio *</label>
              <input style={S.input} type="date" value={form.periodoInicio} onChange={(e) => set("periodoInicio", e.target.value)} />
            </div>
            <div style={S.formGroup}>
              <label style={S.label}>Período — fin *</label>
              <input style={S.input} type="date" value={form.periodoFin} onChange={(e) => set("periodoFin", e.target.value)} />
            </div>
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>Fecha de pago *</label>
            <input style={S.input} type="date" value={form.fechaPago} onChange={(e) => set("fechaPago", e.target.value)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={S.formGroup}>
              <label style={S.label}>Valor *</label>
              <input style={S.input} type="number" value={form.valor} onChange={(e) => set("valor", e.target.value)} placeholder="0" />
            </div>
            <div style={S.formGroup}>
              <label style={S.label}>Medio de pago</label>
              <select style={S.select} value={form.metodo} onChange={(e) => set("metodo", e.target.value)}>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="pse">PSE</option>
              </select>
            </div>
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>Estado</label>
            <select style={S.select} value={form.estado} onChange={(e) => set("estado", e.target.value)}>
              <option value="pagado">Pagado</option>
              <option value="parcial">Pago parcial</option>
              <option value="pendiente">Pendiente</option>
            </select>
          </div>
          {errForm && <p style={{ color: "#dc2626", fontSize: 13 }}>{errForm}</p>}
        </Modal>
      )}

      {delItem && (
        <Modal
          title="Eliminar pago"
          onClose={() => setDelItem(null)}
          footer={
            <>
              <button style={S.btn("secondary")} onClick={() => setDelItem(null)}>Cancelar</button>
              <button style={S.btn("danger")} onClick={async () => { await onDelete(delItem.id); setDelItem(null); }}>Eliminar</button>
            </>
          }
        >
          <p style={{ fontSize: 14, color: "#555" }}>¿Eliminar este pago de {nombreInmueble(delItem.inmuebleId)}?</p>
        </Modal>
      )}
    </div>
  );
};

// ─── Arrendador ───────────────────────────────────────────────────────────
const ArrendadorTab = ({ arrendador, onSave }) => {
  const [form, setForm] = useState(arrendador || ARRENDADOR_INIT);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div>
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>Datos del arrendador</div>
          <div style={S.pageSub}>Aparecen en cada comprobante de pago que generes</div>
        </div>
      </div>
      <div style={{ background: "#fff", borderRadius: 12, padding: 24, maxWidth: 460, boxShadow: "0 1px 6px rgba(26,86,219,0.08)" }}>
        <div style={S.formGroup}>
          <label style={S.label}>Nombre *</label>
          <input style={S.input} value={form.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Nombre completo" />
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>Documento</label>
          <input style={S.input} value={form.documento} onChange={(e) => set("documento", e.target.value)} placeholder="Cédula / NIT" />
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>Teléfono</label>
          <input style={S.input} value={form.telefono} onChange={(e) => set("telefono", e.target.value)} placeholder="Ej. 3001234567" />
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>Dirección</label>
          <input style={S.input} value={form.direccion} onChange={(e) => set("direccion", e.target.value)} placeholder="Dirección de contacto" />
        </div>
        <button style={{ ...S.btn("primary"), opacity: saving ? 0.6 : 1 }} onClick={handleSave} disabled={saving}>
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
};

// ─── Alertas ──────────────────────────────────────────────────────────────
const AlertasTab = ({ inmuebles, arrendatarios, pagos }) => {
  const nombreArr = (id) => arrendatarios.find((a) => a.id === id)?.nombre || "—";

  const calculadas = inmuebles
    .map((i) => ({ inmueble: i, estado: calcularEstadoPago(i, pagos) }))
    .filter((x) => x.estado);

  const enMora = calculadas.filter((x) => x.estado.tipo === "mora").sort((a, b) => b.estado.dias - a.estado.dias);
  const proximos = calculadas.filter((x) => x.estado.tipo === "proximo").sort((a, b) => a.estado.dias - b.estado.dias);

  return (
    <div>
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>Alertas</div>
          <div style={S.pageSub}>En mora y próximos vencimientos, calculado contra el día de pago de cada inmueble</div>
        </div>
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: "#dc2626", marginBottom: 10 }}>En mora ({enMora.length})</div>
      <div style={{ ...S.tableWrap, marginBottom: 24 }}>
        <div style={{ ...S.tableHead, gridTemplateColumns: "1.2fr 1fr 1fr 1fr" }}>
          <div>Inmueble</div><div>Arrendatario</div><div>Valor adeudado</div><div>Días en mora</div>
        </div>
        {enMora.map(({ inmueble, estado }) => (
          <div key={inmueble.id} style={{ ...S.tableRow, gridTemplateColumns: "1.2fr 1fr 1fr 1fr" }}>
            <div style={{ fontWeight: 600, color: BLUE.text }}>{inmueble.nombre}</div>
            <div>{nombreArr(inmueble.arrendatarioId)}</div>
            <div>{fmt(inmueble.valorCanonBase)}</div>
            <div><span style={S.chip("#dc2626")}>{estado.dias} día{estado.dias === 1 ? "" : "s"}</span></div>
          </div>
        ))}
        {enMora.length === 0 && <div style={{ padding: 20, color: "#aaa", fontSize: 13 }}>Nadie en mora ahora mismo.</div>}
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b", marginBottom: 10 }}>Próximos vencimientos — 5 días o menos ({proximos.length})</div>
      <div style={S.tableWrap}>
        <div style={{ ...S.tableHead, gridTemplateColumns: "1.2fr 1fr 1fr 1fr" }}>
          <div>Inmueble</div><div>Arrendatario</div><div>Valor</div><div>Vence en</div>
        </div>
        {proximos.map(({ inmueble, estado }) => (
          <div key={inmueble.id} style={{ ...S.tableRow, gridTemplateColumns: "1.2fr 1fr 1fr 1fr" }}>
            <div style={{ fontWeight: 600, color: BLUE.text }}>{inmueble.nombre}</div>
            <div>{nombreArr(inmueble.arrendatarioId)}</div>
            <div>{fmt(inmueble.valorCanonBase)}</div>
            <div><span style={S.chip("#f59e0b")}>{estado.dias === 0 ? "Hoy" : `${estado.dias} día${estado.dias === 1 ? "" : "s"}`}</span></div>
          </div>
        ))}
        {proximos.length === 0 && <div style={{ padding: 20, color: "#aaa", fontSize: 13 }}>Nada por vencer en los próximos 5 días.</div>}
      </div>
    </div>
  );
};

// ─── Página raíz del módulo ───────────────────────────────────────────────
const ArriendosPage = () => {
  const [tab, setTab] = useState("inmuebles");
  const [inmuebles, setInmuebles] = useState([]);
  const [arrendatarios, setArrendatarios] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [arrendador, setArrendador] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("inmuebles").select("*").order("nombre"),
      supabase.from("arrendatarios").select("*").order("nombre"),
      supabase.from("pagos").select("*").order("periodo_inicio", { ascending: false }),
      supabase.from("arrendador_config").select("*").limit(1).maybeSingle(),
    ]).then(([{ data: inm }, { data: arr }, { data: pgs }, { data: arrd }]) => {
      if (inm) setInmuebles(inm.map(mapInmueble));
      if (arr) setArrendatarios(arr.map(mapArrendatario));
      if (pgs) setPagos(pgs.map(mapPago));
      if (arrd) setArrendador(mapArrendador(arrd));
      setLoading(false);
    });

    const channel = supabase.channel("arriendos-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "inmuebles" }, (payload) => {
        if (payload.eventType === "INSERT") setInmuebles((p) => p.some((x) => x.id === payload.new.id) ? p : [...p, mapInmueble(payload.new)].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        if (payload.eventType === "UPDATE") setInmuebles((p) => p.map((x) => x.id === payload.new.id ? mapInmueble(payload.new) : x));
        if (payload.eventType === "DELETE") setInmuebles((p) => p.filter((x) => x.id !== payload.old.id));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "arrendatarios" }, (payload) => {
        if (payload.eventType === "INSERT") setArrendatarios((p) => p.some((x) => x.id === payload.new.id) ? p : [...p, mapArrendatario(payload.new)].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        if (payload.eventType === "UPDATE") setArrendatarios((p) => p.map((x) => x.id === payload.new.id ? mapArrendatario(payload.new) : x));
        if (payload.eventType === "DELETE") setArrendatarios((p) => p.filter((x) => x.id !== payload.old.id));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pagos" }, (payload) => {
        if (payload.eventType === "INSERT") setPagos((p) => p.some((x) => x.id === payload.new.id) ? p : [mapPago(payload.new), ...p]);
        if (payload.eventType === "UPDATE") setPagos((p) => p.map((x) => x.id === payload.new.id ? mapPago(payload.new) : x));
        if (payload.eventType === "DELETE") setPagos((p) => p.filter((x) => x.id !== payload.old.id));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "arrendador_config" }, (payload) => {
        if (payload.eventType === "DELETE") setArrendador(null);
        else setArrendador(mapArrendador(payload.new));
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const addInmueble = async (f) => {
    const { data, error } = await supabase.from("inmuebles").insert([toInmuebleRow(f)]).select().single();
    if (error) { console.error("addInmueble error:", error); return; }
    if (data) setInmuebles((p) => [...p, mapInmueble(data)].sort((a, b) => a.nombre.localeCompare(b.nombre)));
  };
  const editInmueble = async (f) => {
    const { error } = await supabase.from("inmuebles").update(toInmuebleRow(f)).eq("id", f.id);
    if (error) { console.error("editInmueble error:", error); return; }
    setInmuebles((p) => p.map((x) => x.id === f.id ? { ...x, ...f } : x));
  };
  const deleteInmueble = async (id) => {
    const { error } = await supabase.from("inmuebles").delete().eq("id", id);
    if (error) { console.error("deleteInmueble error:", error); return; }
    setInmuebles((p) => p.filter((x) => x.id !== id));
  };

  const addArrendatario = async (f) => {
    const { data, error } = await supabase.from("arrendatarios").insert([f]).select().single();
    if (error) { console.error("addArrendatario error:", error); return null; }
    if (data) setArrendatarios((p) => [...p, mapArrendatario(data)].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    return data?.id || null;
  };

  // Liga/libera el inmueble de un arrendatario. Solo toca la columna
  // arrendatario_id (no usa toInmuebleRow) para no arriesgar pisar el resto
  // de campos del inmueble con un objeto a medias.
  const setInmuebleArrendatario = async (inmuebleId, arrendatarioId) => {
    const { error } = await supabase.from("inmuebles").update({ arrendatario_id: arrendatarioId || null }).eq("id", inmuebleId);
    if (error) { console.error("setInmuebleArrendatario error:", error); return; }
    setInmuebles((p) => p.map((x) => x.id === inmuebleId ? { ...x, arrendatarioId: arrendatarioId || "" } : x));
  };

  const asignarInmuebleAArrendatario = async (arrendatarioId, nuevoInmuebleId) => {
    const inmuebleAnterior = inmuebles.find((i) => i.arrendatarioId === arrendatarioId);
    if (inmuebleAnterior && inmuebleAnterior.id !== nuevoInmuebleId) {
      await setInmuebleArrendatario(inmuebleAnterior.id, "");
    }
    if (nuevoInmuebleId) await setInmuebleArrendatario(nuevoInmuebleId, arrendatarioId);
  };
  const editArrendatario = async (f) => {
    const { error } = await supabase.from("arrendatarios").update({ nombre: f.nombre, telefono: f.telefono, documento: f.documento }).eq("id", f.id);
    if (error) { console.error("editArrendatario error:", error); return; }
    setArrendatarios((p) => p.map((x) => x.id === f.id ? { ...x, ...f } : x));
  };
  const deleteArrendatario = async (id) => {
    const { error } = await supabase.from("arrendatarios").delete().eq("id", id);
    if (error) { console.error("deleteArrendatario error:", error); return; }
    setArrendatarios((p) => p.filter((x) => x.id !== id));
  };

  const addPago = async (f) => {
    const { data, error } = await supabase.from("pagos").insert([toPagoRow(f)]).select().single();
    if (error) { console.error("addPago error:", error); return; }
    if (data) setPagos((p) => [mapPago(data), ...p]);
  };
  const deletePago = async (id) => {
    const { error } = await supabase.from("pagos").delete().eq("id", id);
    if (error) { console.error("deletePago error:", error); return; }
    setPagos((p) => p.filter((x) => x.id !== id));
  };

  const saveArrendador = async (f) => {
    if (arrendador?.id) {
      const { error } = await supabase.from("arrendador_config").update(toArrendadorRow(f)).eq("id", arrendador.id);
      if (error) { console.error("saveArrendador error:", error); return; }
      setArrendador({ ...arrendador, ...f });
    } else {
      const { data, error } = await supabase.from("arrendador_config").insert([toArrendadorRow(f)]).select().single();
      if (error) { console.error("saveArrendador error:", error); return; }
      if (data) setArrendador(mapArrendador(data));
    }
  };

  if (loading) return <div style={{ padding: 40, color: "#6b87b0", fontSize: 13 }}>Cargando…</div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => !t.proximamente && setTab(t.id)}
            disabled={t.proximamente}
            style={{
              padding: "9px 18px", borderRadius: 8, border: "none", fontWeight: 600, fontSize: 13, cursor: t.proximamente ? "default" : "pointer",
              background: tab === t.id ? BLUE.primary : "#fff", color: tab === t.id ? "#fff" : t.proximamente ? "#bbb" : "#555",
              boxShadow: "0 1px 4px rgba(26,86,219,0.08)",
            }}
          >
            {t.label}{t.proximamente ? " (próximamente)" : ""}
          </button>
        ))}
      </div>

      {tab === "inmuebles" && <InmueblesTab inmuebles={inmuebles} arrendatarios={arrendatarios} onAdd={addInmueble} onEdit={editInmueble} onDelete={deleteInmueble} />}
      {tab === "arrendatarios" && <ArrendatariosTab arrendatarios={arrendatarios} inmuebles={inmuebles} onAdd={addArrendatario} onEdit={editArrendatario} onDelete={deleteArrendatario} onAsignarInmueble={asignarInmuebleAArrendatario} />}
      {tab === "pagos" && <PagosTab pagos={pagos} inmuebles={inmuebles} arrendatarios={arrendatarios} arrendador={arrendador} onAdd={addPago} onDelete={deletePago} />}
      {tab === "alertas" && <AlertasTab inmuebles={inmuebles} arrendatarios={arrendatarios} pagos={pagos} />}
      {tab === "arrendador" && <ArrendadorTab key={arrendador?.id || "nuevo"} arrendador={arrendador} onSave={saveArrendador} />}
    </div>
  );
};

export default ArriendosPage;
