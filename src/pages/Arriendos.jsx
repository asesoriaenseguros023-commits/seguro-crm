import { useState, useEffect } from "react";
import { supabase } from "../supabase.js";
import { S, BLUE } from "../constants.js";
import { fmt, fmtDate, today, mapInmueble, toInmuebleRow, mapArrendatario, mapPago, toPagoRow, mapArrendador, toArrendadorRow, mapCuentaCobro, toCuentaCobroRow } from "../helpers.js";
import { generarComprobante, generarCuentaCobro, siguienteNumeroComprobante, calcularEstadoCuentaCobro, METODOS_LABEL } from "../pdfComprobante.js";
import Icon from "../components/Icon.jsx";
import Modal from "../components/Modal.jsx";

const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "inmuebles", label: "Inmuebles" },
  { id: "arrendatarios", label: "Arrendatarios" },
  { id: "pagos", label: "Pagos" },
  { id: "alertas", label: "Alertas" },
  { id: "arrendadores", label: "Arrendadores" },
];

const INMUEBLE_INIT = { nombre: "", direccion: "", valorCanonBase: "", diaVencimientoPago: 5, activo: true, arrendatarioId: "", arrendadorId: "", tieneAdministracion: false, valorAdministracion: "", fechaInicioArriendo: "" };
const ARRENDATARIO_INIT = { nombre: "", telefono: "", documento: "", inmuebleId: "", activo: true, fechaInicioArriendo: "" };
const PAGO_INIT = { inmuebleId: "", arrendatarioId: "", fechaPago: today(), periodoInicio: "", periodoFin: "", valor: "", valorAdministracion: "", metodo: "efectivo", estado: "pagado" };
const ARRENDADOR_INIT = { nombre: "", documento: "", telefono: "", direccion: "", cuentaBancaria: "", responsableIva: false };

// Las tablas de columnas fijas (grid) se aplastan en pantallas angostas —
// mismo umbral que usa App.jsx para su propio layout mobile. Por debajo,
// cada tab con tabla cambia a una lista de tarjetas apiladas.
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

const cardS = { background: "#fff", borderRadius: 12, padding: "14px 16px", marginBottom: 10, border: `1px solid ${BLUE.border}`, boxShadow: "0 1px 6px rgba(26,86,219,0.06)" };
const cardRowS = { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 };
const cardLabelS = { fontSize: 11, color: "#9aa8c7" };

// Un inmueble está "al día" del mes en curso si existe un pago cuyo período
// cubre el día de vencimiento de este mes. Si no, según cuánto falte/pasó
// esa fecha, el inmueble está "en mora" o "próximo a vencer".
function calcularEstadoPago(inmueble, pagos) {
  if (!inmueble.arrendatarioId) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);

  const pagosInmueble = pagos.filter((p) => p.inmuebleId === inmueble.id && p.periodoFin);
  let fechaVence, ultimoPago = null;
  if (pagosInmueble.length > 0) {
    // Ya pagó alguna vez: lo próximo que vence es el día en que se acaba la
    // cobertura del pago más reciente (no un día fijo del calendario).
    ultimoPago = pagosInmueble.reduce((max, p) => (p.periodoFin > max.periodoFin ? p : max), pagosInmueble[0]);
    fechaVence = new Date(ultimoPago.periodoFin + "T00:00:00");
  } else if (inmueble.fechaInicioArriendo) {
    // Nunca ha pagado pero sabemos desde cuándo arrienda: el primer
    // vencimiento es un mes después de esa fecha (mismo criterio que
    // calcularEstadoCuentaCobro). Sin esto, un arrendatario recién llegado
    // se marcaba como atrasado apenas pasaba el día de pago del mes en curso.
    fechaVence = new Date(inmueble.fechaInicioArriendo + "T00:00:00");
    fechaVence.setDate(fechaVence.getDate() - 1);
    fechaVence.setMonth(fechaVence.getMonth() + 1);
  } else {
    // Sin fecha de inicio y sin pagos: no hay forma de saber desde cuándo
    // debe. Usa el día de pago del mes en curso, pero nunca uno que ya
    // pasó, para no marcar como atrasado un arriendo que quizás ni ha
    // empezado.
    const anio = hoy.getFullYear(), mes = hoy.getMonth();
    const diaVence = Math.min(inmueble.diaVencimientoPago, new Date(anio, mes + 1, 0).getDate());
    fechaVence = new Date(anio, mes, diaVence);
    if (fechaVence < hoy) {
      const diaVenceSig = Math.min(inmueble.diaVencimientoPago, new Date(anio, mes + 2, 0).getDate());
      fechaVence = new Date(anio, mes + 1, diaVenceSig);
    }
  }

  const diasDiff = Math.round((fechaVence - hoy) / 86400000);
  if (diasDiff < 0) {
    const dias = -diasDiff;
    // Cada 30 días de atraso suma un mes más de canon a la mora total.
    const meses = Math.max(1, Math.ceil(dias / 30));
    return { tipo: "mora", dias, meses, valorTotal: meses * (inmueble.valorCanonBase || 0), fechaVence, ultimoPago };
  }
  if (diasDiff <= 5) return { tipo: "proximo", dias: diasDiff, fechaVence, ultimoPago };
  return null;
}

// ─── Inmuebles ────────────────────────────────────────────────────────────
const InmueblesTab = ({ inmuebles, arrendatarios, arrendadores, onAdd, onEdit, onDelete }) => {
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [delItem, setDelItem] = useState(null);
  const [form, setForm] = useState(INMUEBLE_INIT);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const nombreArrendatario = (id) => arrendatarios.find((a) => a.id === id)?.nombre || "";
  const nombreArrendador = (id) => arrendadores.find((a) => a.id === id)?.nombre || "";

  const abrirNuevo = () => { setEditItem(null); setForm(INMUEBLE_INIT); setShowForm(true); };
  const abrirEditar = (i) => {
    setEditItem(i);
    setForm({ nombre: i.nombre, direccion: i.direccion, valorCanonBase: i.valorCanonBase, diaVencimientoPago: i.diaVencimientoPago, activo: i.activo, arrendatarioId: i.arrendatarioId || "", arrendadorId: i.arrendadorId || "", tieneAdministracion: i.tieneAdministracion, valorAdministracion: i.valorAdministracion || "", fechaInicioArriendo: i.fechaInicioArriendo || "" });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    // La fecha de inicio del arriendo se edita desde Arrendatarios, no aquí.
    // Si desde este formulario cambian a un arrendatario distinto del que
    // ya tenía, no tiene sentido arrastrar la fecha del inquilino anterior.
    const fechaInicioArriendo = (editItem && form.arrendatarioId === editItem.arrendatarioId) ? form.fechaInicioArriendo : "";
    const payload = { ...form, fechaInicioArriendo, valorCanonBase: Number(form.valorCanonBase) || 0, diaVencimientoPago: Number(form.diaVencimientoPago), valorAdministracion: Number(form.valorAdministracion) || 0 };
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
        {inmuebles.map((i, idx) => (
          <div key={i.id} style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 6px rgba(26,86,219,0.08)", border: `1px solid ${BLUE.border}`, borderTop: `3px solid ${BLUE.primary}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: BLUE.text }}><span style={{ color: "#aaa", fontWeight: 400 }}>{idx + 1}. </span>{i.nombre}</div>
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
                {i.tieneAdministracion && <div style={{ fontSize: 11, color: "#7c3aed" }}>+ administración {fmt(i.valorAdministracion)}</div>}
              </div>
              <span style={S.chip(i.activo ? "#16a34a" : "#6b7280")}>{i.activo ? "Activo" : "Inactivo"}</span>
            </div>
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${BLUE.border}`, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {i.arrendatarioId ? (
                <span style={S.chip(BLUE.primary)}>Arrendado a {nombreArrendatario(i.arrendatarioId)}</span>
              ) : (
                <span style={S.chip("#6b7280")}>Vacante</span>
              )}
              {i.arrendadorId ? (
                <span style={S.chip("#7c3aed")}>Arrendador: {nombreArrendador(i.arrendadorId)}</span>
              ) : (
                <span style={S.chip("#dc2626")}>Sin arrendador</span>
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
          <div style={{ ...S.formGroup, display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" id="tieneAdministracion" checked={form.tieneAdministracion} onChange={(e) => set("tieneAdministracion", e.target.checked)} />
            <label htmlFor="tieneAdministracion" style={{ ...S.label, marginBottom: 0 }}>¿Tiene administración?</label>
          </div>
          {form.tieneAdministracion && (
            <div style={S.formGroup}>
              <label style={S.label}>Valor administración *</label>
              <input style={S.input} type="number" value={form.valorAdministracion} onChange={(e) => set("valorAdministracion", e.target.value)} placeholder="0" />
            </div>
          )}
          <div style={S.formGroup}>
            <label style={S.label}>Arrendador</label>
            <select style={S.select} value={form.arrendadorId} onChange={(e) => set("arrendadorId", e.target.value)}>
              <option value="">— Sin asignar —</option>
              {arrendadores.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>Arrendatario</label>
            <select style={S.select} value={form.arrendatarioId} onChange={(e) => set("arrendatarioId", e.target.value)}>
              <option value="">— Vacante —</option>
              {arrendatarios.filter((a) => a.activo).map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
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
const ArrendatariosTab = ({ arrendatarios, inmuebles, pagos, arrendadores, cuentasCobro, onAdd, onEdit, onDelete, onAsignarInmueble, onToggleActivo, onAgregarCuentaCobro }) => {
  const isMobile = useIsMobile();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [delItem, setDelItem] = useState(null);
  const [form, setForm] = useState(ARRENDATARIO_INIT);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const inmuebleDe = (arrendatarioId) => inmuebles.find((i) => i.arrendatarioId === arrendatarioId);

  // Genera (o reutiliza, si ya existe para ese período) la cuenta de cobro:
  // número consecutivo propio y saldo anterior = todo lo facturado a este
  // arrendatario menos todo lo que ha pagado, antes de sumar el cobro nuevo.
  const generarCuenta = async (a) => {
    const inmueble = inmuebleDe(a.id);
    // Un solo barrido: `periodoActual` (el que se cobra ahora) y
    // `periodosAdeudados` (lo que ya venció sin pagar) salen del mismo
    // recorrido continuo, así que nunca pueden coincidir en el mismo mes.
    // Siempre en vivo contra los pagos reales, para que la cuenta muestre la
    // deuda de hoy (no un saldo congelado de cuando se generó la primera vez).
    const { periodosAdeudados, periodoActual: periodo } = calcularEstadoCuentaCobro(inmueble, a.id, pagos);
    const valorAdministracion = inmueble?.tieneAdministracion ? (inmueble.valorAdministracion || 0) : 0;
    const valor = (inmueble?.valorCanonBase || 0) + valorAdministracion;
    const saldoAnterior = periodosAdeudados.reduce((s, p) => s + p.valor, 0);

    let cuenta = cuentasCobro.find((c) => c.arrendatarioId === a.id && c.periodoInicio === periodo.inicio && c.periodoFin === periodo.fin);
    if (!cuenta) {
      const numero = Math.max(0, ...cuentasCobro.map((c) => c.numero)) + 1;
      cuenta = await onAgregarCuentaCobro({
        numero, arrendatarioId: a.id, inmuebleId: inmueble?.id || "",
        periodoInicio: periodo.inicio, periodoFin: periodo.fin,
        valor, valorAdministracion, saldoAnterior, fechaEmision: today(), fechaVencimiento: periodo.fin,
      });
    }
    if (!cuenta) return;

    generarCuentaCobro({
      numero: cuenta.numero, arrendatario: a, inmueble,
      arrendador: arrendadores.find((ar) => ar.id === inmueble?.arrendadorId),
      periodo: { inicio: cuenta.periodoInicio, fin: cuenta.periodoFin },
      valor: cuenta.valor, valorAdministracion: cuenta.valorAdministracion, periodosAdeudados, fechaEmision: cuenta.fechaEmision,
    });
  };

  const abrirNuevo = () => { setEditItem(null); setForm(ARRENDATARIO_INIT); setShowForm(true); };
  const abrirEditar = (a) => {
    setEditItem(a);
    const inm = inmuebleDe(a.id);
    setForm({ nombre: a.nombre, telefono: a.telefono, documento: a.documento, inmuebleId: inm?.id || "", activo: a.activo, fechaInicioArriendo: inm?.fechaInicioArriendo || "" });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    const { inmuebleId, fechaInicioArriendo, ...datos } = form;
    let id = editItem?.id;
    if (editItem) await onEdit({ id: editItem.id, ...datos });
    else id = await onAdd(datos);
    if (id) await onAsignarInmueble(id, inmuebleId, fechaInicioArriendo);
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

      {isMobile ? (
        <div>
          {arrendatarios.map((a, idx) => (
            <div key={a.id} style={cardS}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ fontWeight: 700, color: BLUE.text, fontSize: 14 }}><span style={{ color: "#aaa", fontWeight: 400 }}>{idx + 1}. </span>{a.nombre}</div>
                <button
                  onClick={() => onToggleActivo(a)}
                  style={{ ...S.chip(a.activo ? "#16a34a" : "#9ca3af"), border: "none", cursor: "pointer", fontWeight: 700, flexShrink: 0 }}
                >
                  {a.activo ? "Activo" : "Inactivo"}
                </button>
              </div>
              {(a.telefono || a.documento) && (
                <div style={{ fontSize: 12.5, color: "#6b87b0", marginTop: 4 }}>
                  {[a.telefono, a.documento].filter(Boolean).join(" · ")}
                </div>
              )}
              <div style={{ marginTop: 8 }}>
                {inmuebleDe(a.id) ? <span style={S.chip(BLUE.primary)}>{inmuebleDe(a.id).nombre}</span> : <span style={{ fontSize: 12.5, color: "#ccc" }}>Sin inmueble</span>}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${BLUE.border}` }}>
                {inmuebleDe(a.id) && (
                  <button style={{ ...S.btn("secondary"), flex: 1 }} onClick={() => generarCuenta(a)}>Generar</button>
                )}
                <button style={S.btn("ghost")} onClick={() => abrirEditar(a)}><Icon name="edit" size={14} /></button>
                <button style={{ ...S.btn("ghost"), color: "#dc2626" }} onClick={() => setDelItem(a)}><Icon name="trash" size={14} /></button>
              </div>
            </div>
          ))}
          {arrendatarios.length === 0 && (
            <div style={{ color: "#aaa", fontSize: 13, padding: 20 }}>No hay arrendatarios. Agrega el primero.</div>
          )}
        </div>
      ) : (
      <div style={S.tableWrap}>
        <div style={{ ...S.tableHead, gridTemplateColumns: "40px 1.3fr 0.9fr 0.9fr 1.1fr 230px" }}>
          <div>#</div><div>Nombre</div><div>Teléfono</div><div>Documento</div><div>Inmueble</div><div></div>
        </div>
        {arrendatarios.map((a, idx) => (
          <div key={a.id} style={{ ...S.tableRow, gridTemplateColumns: "40px 1.3fr 0.9fr 0.9fr 1.1fr 230px" }}>
            <div style={{ color: "#aaa", fontSize: 12 }}>{idx + 1}</div>
            <div style={{ fontWeight: 600, color: BLUE.text }}>{a.nombre}</div>
            <div style={{ color: a.telefono ? "inherit" : "#ccc" }}>{a.telefono || "—"}</div>
            <div style={{ color: a.documento ? "inherit" : "#ccc" }}>{a.documento || "—"}</div>
            <div>
              {inmuebleDe(a.id) ? <span style={S.chip(BLUE.primary)}>{inmuebleDe(a.id).nombre}</span> : <span style={{ color: "#ccc" }}>Sin inmueble</span>}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "flex-end" }}>
              <button
                onClick={() => onToggleActivo(a)}
                title={a.activo ? "Clic para desactivar" : "Clic para activar"}
                style={{ ...S.chip(a.activo ? "#16a34a" : "#9ca3af"), border: "none", cursor: "pointer", fontWeight: 700 }}
              >
                {a.activo ? "Activo" : "Inactivo"}
              </button>
              {inmuebleDe(a.id) && <button style={S.btn("secondary")} onClick={() => generarCuenta(a)}>Generar</button>}
              <button style={S.btn("ghost")} onClick={() => abrirEditar(a)}><Icon name="edit" size={14} /></button>
              <button style={{ ...S.btn("ghost"), color: "#dc2626" }} onClick={() => setDelItem(a)}><Icon name="trash" size={14} /></button>
            </div>
          </div>
        ))}
        {arrendatarios.length === 0 && (
          <div style={{ padding: 20, color: "#aaa", fontSize: 13 }}>No hay arrendatarios. Agrega el primero.</div>
        )}
      </div>
      )}

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
          {form.inmuebleId && (
            <div style={S.formGroup}>
              <label style={S.label}>Fecha de inicio del arriendo</label>
              <input style={S.input} type="date" value={form.fechaInicioArriendo} onChange={(e) => set("fechaInicioArriendo", e.target.value)} />
              <div style={{ fontSize: 11, color: "#9aa8c7", marginTop: 4 }}>Evita que se marque como atrasado si todavía no hace su primer pago.</div>
            </div>
          )}
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
// Helpers de fecha en hora local (nunca `new Date(isoString)` directo: en
// UTC-5 eso corre la fecha un día para atrás al leer getMonth()/getDate()).
const parseISO = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const sumarDias = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
// Fin de un período que arranca en `iso` y dura exactamente un mes calendario.
const finDeUnMes = (iso) => { const d = parseISO(iso); d.setMonth(d.getMonth() + 1); d.setDate(d.getDate() - 1); return toISO(d); };

const PagosTab = ({ pagos, inmuebles, arrendatarios, arrendadores, onAdd, onEdit, onDelete, onAsignarNumero }) => {
  const isMobile = useIsMobile();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [delItem, setDelItem] = useState(null);
  const [form, setForm] = useState(PAGO_INIT);
  const [saving, setSaving] = useState(false);
  const [errForm, setErrForm] = useState("");
  const [ordenFecha, setOrdenFecha] = useState("desc");
  const [filtroArrendatario, setFiltroArrendatario] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const pagosOrdenados = [...pagos]
    .filter((p) => !filtroArrendatario || p.arrendatarioId === filtroArrendatario)
    .sort((a, b) =>
      ordenFecha === "desc" ? b.fechaPago.localeCompare(a.fechaPago) : a.fechaPago.localeCompare(b.fechaPago)
    );

  const arrendatariosOrdenados = [...arrendatarios].sort((a, b) => a.nombre.localeCompare(b.nombre));

  const nombreInmueble = (id) => inmuebles.find((i) => i.id === id)?.nombre || "—";
  const nombreArr = (id) => arrendatarios.find((a) => a.id === id)?.nombre || "—";

  const abrirNuevo = () => { setEditItem(null); setForm(PAGO_INIT); setErrForm(""); setShowForm(true); };
  const abrirEditar = (p) => {
    setEditItem(p);
    setForm({
      inmuebleId: p.inmuebleId, arrendatarioId: p.arrendatarioId, fechaPago: p.fechaPago,
      periodoInicio: p.periodoInicio, periodoFin: p.periodoFin, valor: p.valor, valorAdministracion: p.valorAdministracion || "", metodo: p.metodo, estado: p.estado,
    });
    setErrForm("");
    setShowForm(true);
  };

  // Al elegir el arrendatario: si ya tiene pagos registrados, sugiere el
  // período siguiente al del último (el que cubre la fecha más reciente),
  // sin importar el orden en que se hayan capturado. Si es su primer pago,
  // usa el día de vencimiento del inmueble para armar el período del mes en
  // curso, como antes. Todo queda editable, incluido el monto.
  const seleccionarArrendatario = (arrendatarioId) => {
    const inm = inmuebles.find((i) => i.arrendatarioId === arrendatarioId);
    const pagosArr = pagos.filter((p) => p.arrendatarioId === arrendatarioId);
    const ultimoPago = pagosArr.length
      ? pagosArr.reduce((mas, p) => (p.periodoFin > mas.periodoFin ? p : mas))
      : null;

    let periodoInicio = "", periodoFin = "";
    if (ultimoPago) {
      periodoInicio = sumarDias(ultimoPago.periodoFin, 1);
      periodoFin = finDeUnMes(periodoInicio);
    } else if (inm?.diaVencimientoPago) {
      const hoy = new Date();
      const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
      const diaVence = Math.min(inm.diaVencimientoPago, ultimoDiaMes);
      const fin = new Date(hoy.getFullYear(), hoy.getMonth(), diaVence);
      const inicio = new Date(fin.getFullYear(), fin.getMonth() - 1, fin.getDate() + 1);
      periodoInicio = toISO(inicio);
      periodoFin = toISO(fin);
    }
    const admin = inm?.tieneAdministracion ? (inm.valorAdministracion || 0) : 0;
    const valorSugerido = (inm?.valorCanonBase || 0) + admin;
    setForm((f) => ({ ...f, arrendatarioId, inmuebleId: inm?.id || "", valor: valorSugerido || "", valorAdministracion: admin || "", periodoInicio, periodoFin }));
  };

  const handleSave = async () => {
    if (!form.arrendatarioId) { setErrForm("Elige el arrendatario"); return; }
    if (!form.inmuebleId) { setErrForm("Este arrendatario no tiene un inmueble asignado. Asígnalo primero en Arrendatarios."); return; }
    if (!form.periodoInicio || !form.periodoFin) { setErrForm("Elige la fecha de inicio y fin del período"); return; }
    if (form.periodoFin < form.periodoInicio) { setErrForm("La fecha fin no puede ser antes que la fecha inicio"); return; }
    if (form.periodoFin < finDeUnMes(form.periodoInicio)) { setErrForm("El período no puede ser menor a un mes"); return; }
    const seCruza = pagos.some((p) =>
      p.arrendatarioId === form.arrendatarioId &&
      (!editItem || p.id !== editItem.id) &&
      form.periodoInicio <= p.periodoFin && p.periodoInicio <= form.periodoFin
    );
    if (seCruza) { setErrForm("Ese período se cruza con un pago que ya está registrado para este arrendatario"); return; }
    if (!form.valor) { setErrForm("Escribe el valor"); return; }
    setSaving(true);
    setErrForm("");
    if (editItem) await onEdit({ id: editItem.id, ...form });
    else await onAdd(form);
    setSaving(false);
    setShowForm(false);
    setEditItem(null);
  };

  const generar = async (pago) => {
    let numeroComprobante = pago.numeroComprobante;
    if (!numeroComprobante) {
      numeroComprobante = siguienteNumeroComprobante(pagos, pago.fechaPago);
      await onAsignarNumero(pago.id, numeroComprobante);
    }
    const inmueble = inmuebles.find((i) => i.id === pago.inmuebleId);
    generarComprobante({
      pago,
      numeroComprobante,
      inmueble,
      arrendatario: arrendatarios.find((a) => a.id === pago.arrendatarioId),
      arrendador: arrendadores.find((a) => a.id === inmueble?.arrendadorId),
    });
  };

  return (
    <div>
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>Pagos</div>
          <div style={S.pageSub}>
            {filtroArrendatario ? `${pagosOrdenados.length} de ${pagos.length} pagos` : `${pagos.length} pagos registrados`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={S.btn("secondary")} onClick={() => setOrdenFecha((o) => (o === "desc" ? "asc" : "desc"))}>
            Fecha de pago {ordenFecha === "desc" ? "↓ recientes primero" : "↑ antiguos primero"}
          </button>
          <button style={S.btn("primary")} onClick={abrirNuevo}>
            <Icon name="plus" size={16} />Registrar pago
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#6b87b0" }}>Arrendatario:</span>
        <select style={{ ...S.select, width: 220 }} value={filtroArrendatario} onChange={(e) => setFiltroArrendatario(e.target.value)}>
          <option value="">Todos</option>
          {arrendatariosOrdenados.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </select>
        {filtroArrendatario && (
          <button style={S.btn("ghost")} onClick={() => setFiltroArrendatario("")}>Quitar filtro</button>
        )}
      </div>

      {isMobile ? (
        <div>
          {pagosOrdenados.map((p, idx) => (
            <div key={p.id} style={cardS}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, color: BLUE.text, fontSize: 14 }}><span style={{ color: "#aaa", fontWeight: 400 }}>{idx + 1}. </span>{nombreInmueble(p.inmuebleId)}</div>
                  <div style={{ fontSize: 12.5, color: "#6b87b0" }}>{nombreArr(p.arrendatarioId)}</div>
                </div>
                <div style={{ fontWeight: 700, color: BLUE.primary, fontSize: 15 }}>{fmt(p.valor)}</div>
              </div>
              <div style={cardRowS}>
                <span style={cardLabelS}>Fecha de pago</span>
                <span style={{ fontSize: 12.5 }}>{fmtDate(p.fechaPago)}</span>
              </div>
              <div style={cardRowS}>
                <span style={cardLabelS}>Período</span>
                <span style={{ fontSize: 12.5 }}>{fmtDate(p.periodoInicio)} – {fmtDate(p.periodoFin)}</span>
              </div>
              <div style={cardRowS}>
                <span style={cardLabelS}>Medio de pago</span>
                <span style={{ fontSize: 12.5 }}>{METODOS_LABEL[p.metodo] || p.metodo}</span>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${BLUE.border}` }}>
                <button style={{ ...S.btn("secondary"), flex: 1 }} onClick={() => generar(p)}>Generar</button>
                <button style={S.btn("ghost")} onClick={() => abrirEditar(p)}><Icon name="edit" size={14} /></button>
                <button style={{ ...S.btn("ghost"), color: "#dc2626" }} onClick={() => setDelItem(p)}><Icon name="trash" size={14} /></button>
              </div>
            </div>
          ))}
          {pagosOrdenados.length === 0 && (
            <div style={{ color: "#aaa", fontSize: 13, padding: 20 }}>
              {filtroArrendatario ? "Este arrendatario no tiene pagos registrados." : "No hay pagos registrados todavía."}
            </div>
          )}
        </div>
      ) : (
      <div style={{ ...S.tableWrap, overflowX: "auto" }}>
        <div style={{ ...S.tableHead, gridTemplateColumns: "36px 1.1fr 0.9fr 0.9fr 1.2fr 0.9fr 0.9fr 170px", minWidth: 900 }}>
          <div>#</div><div>Inmueble</div><div>Arrendatario</div><div>Fecha de pago</div><div>Período</div><div>Valor</div><div>Medio</div><div></div>
        </div>
        {pagosOrdenados.map((p, idx) => (
          <div key={p.id} style={{ ...S.tableRow, gridTemplateColumns: "36px 1.1fr 0.9fr 0.9fr 1.2fr 0.9fr 0.9fr 170px", minWidth: 900 }}>
            <div style={{ color: "#aaa", fontSize: 12 }}>{idx + 1}</div>
            <div style={{ fontWeight: 600, color: BLUE.text }}>{nombreInmueble(p.inmuebleId)}</div>
            <div>{nombreArr(p.arrendatarioId)}</div>
            <div style={{ fontSize: 12.5 }}>{fmtDate(p.fechaPago)}</div>
            <div style={{ fontSize: 12.5 }}>{fmtDate(p.periodoInicio)} – {fmtDate(p.periodoFin)}</div>
            <div>{fmt(p.valor)}</div>
            <div>{METODOS_LABEL[p.metodo] || p.metodo}</div>
            <div style={{ display: "flex", gap: 4 }}>
              <button style={S.btn("secondary")} onClick={() => generar(p)}>Generar</button>
              <button style={S.btn("ghost")} onClick={() => abrirEditar(p)}><Icon name="edit" size={14} /></button>
              <button style={{ ...S.btn("ghost"), color: "#dc2626" }} onClick={() => setDelItem(p)}><Icon name="trash" size={14} /></button>
            </div>
          </div>
        ))}
        {pagosOrdenados.length === 0 && (
          <div style={{ padding: 20, color: "#aaa", fontSize: 13 }}>
            {filtroArrendatario ? "Este arrendatario no tiene pagos registrados." : "No hay pagos registrados todavía."}
          </div>
        )}
      </div>
      )}

      {showForm && (
        <Modal
          title={editItem ? "Editar pago" : "Registrar pago"}
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
            <label style={S.label}>Arrendatario *</label>
            <select style={S.select} value={form.arrendatarioId} onChange={(e) => seleccionarArrendatario(e.target.value)}>
              <option value="">Selecciona…</option>
              {arrendatarios.filter((a) => a.activo).map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>Inmueble</label>
            {form.arrendatarioId ? (
              form.inmuebleId ? (
                <div style={{ ...S.input, background: "#f8faff", color: BLUE.text, fontWeight: 600, display: "flex", alignItems: "center" }}>
                  {nombreInmueble(form.inmuebleId)}
                </div>
              ) : (
                <div style={{ ...S.input, background: "#fef2f2", color: "#dc2626", fontSize: 12.5, display: "flex", alignItems: "center", border: "1px solid #fecaca" }}>
                  Este arrendatario no tiene inmueble asignado
                </div>
              )
            ) : (
              <div style={{ ...S.input, background: "#f8faff", color: "#aaa", display: "flex", alignItems: "center" }}>
                Elige primero el arrendatario
              </div>
            )}
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
          {inmuebles.find((i) => i.id === form.inmuebleId)?.tieneAdministracion && (
            <div style={S.formGroup}>
              <label style={S.label}>De los cuales, administración</label>
              <input style={S.input} type="number" value={form.valorAdministracion} onChange={(e) => set("valorAdministracion", e.target.value)} placeholder="0" />
            </div>
          )}
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

// ─── Arrendadores ─────────────────────────────────────────────────────────
const ArrendadoresTab = ({ arrendadores, inmuebles, onAdd, onEdit, onDelete }) => {
  const isMobile = useIsMobile();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [delItem, setDelItem] = useState(null);
  const [form, setForm] = useState(ARRENDADOR_INIT);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const cantidadInmuebles = (arrendadorId) => inmuebles.filter((i) => i.arrendadorId === arrendadorId).length;

  const abrirNuevo = () => { setEditItem(null); setForm(ARRENDADOR_INIT); setShowForm(true); };
  const abrirEditar = (a) => {
    setEditItem(a);
    setForm({ nombre: a.nombre, documento: a.documento, telefono: a.telefono, direccion: a.direccion, cuentaBancaria: a.cuentaBancaria, responsableIva: a.responsableIva });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    if (editItem) await onEdit({ id: editItem.id, ...form });
    else await onAdd(form);
    setSaving(false);
    setShowForm(false);
    setEditItem(null);
  };

  return (
    <div>
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>Arrendadores</div>
          <div style={S.pageSub}>{arrendadores.length} registrados — cada inmueble elige a cuál pertenece</div>
        </div>
        <button style={S.btn("primary")} onClick={abrirNuevo}>
          <Icon name="plus" size={16} />Nuevo arrendador
        </button>
      </div>

      {isMobile ? (
        <div>
          {arrendadores.map((a, idx) => (
            <div key={a.id} style={cardS}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, color: BLUE.text, fontSize: 14 }}><span style={{ color: "#aaa", fontWeight: 400 }}>{idx + 1}. </span>{a.nombre}</div>
                  {(a.telefono || a.documento) && <div style={{ fontSize: 12.5, color: "#6b87b0" }}>{[a.telefono, a.documento].filter(Boolean).join(" · ")}</div>}
                </div>
                <span style={S.chip(BLUE.primary)}>{cantidadInmuebles(a.id)} inmueble{cantidadInmuebles(a.id) === 1 ? "" : "s"}</span>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${BLUE.border}` }}>
                <button style={{ ...S.btn("secondary"), flex: 1 }} onClick={() => abrirEditar(a)}><Icon name="edit" size={14} />Editar</button>
                <button style={{ ...S.btn("danger"), flex: 1 }} onClick={() => setDelItem(a)}><Icon name="trash" size={14} />Eliminar</button>
              </div>
            </div>
          ))}
          {arrendadores.length === 0 && (
            <div style={{ color: "#aaa", fontSize: 13, padding: 20 }}>No hay arrendadores. Agrega el primero.</div>
          )}
        </div>
      ) : (
      <div style={S.tableWrap}>
        <div style={{ ...S.tableHead, gridTemplateColumns: "40px 1.2fr 0.9fr 0.9fr 100px 100px" }}>
          <div>#</div><div>Nombre</div><div>Teléfono</div><div>Documento</div><div>Inmuebles</div><div></div>
        </div>
        {arrendadores.map((a, idx) => (
          <div key={a.id} style={{ ...S.tableRow, gridTemplateColumns: "40px 1.2fr 0.9fr 0.9fr 100px 100px" }}>
            <div style={{ color: "#aaa", fontSize: 12 }}>{idx + 1}</div>
            <div style={{ fontWeight: 600, color: BLUE.text }}>{a.nombre}</div>
            <div style={{ color: a.telefono ? "inherit" : "#ccc" }}>{a.telefono || "—"}</div>
            <div style={{ color: a.documento ? "inherit" : "#ccc" }}>{a.documento || "—"}</div>
            <div><span style={S.chip(BLUE.primary)}>{cantidadInmuebles(a.id)}</span></div>
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <button style={S.btn("ghost")} onClick={() => abrirEditar(a)}><Icon name="edit" size={14} /></button>
              <button style={{ ...S.btn("ghost"), color: "#dc2626" }} onClick={() => setDelItem(a)}><Icon name="trash" size={14} /></button>
            </div>
          </div>
        ))}
        {arrendadores.length === 0 && (
          <div style={{ padding: 20, color: "#aaa", fontSize: 13 }}>No hay arrendadores. Agrega el primero.</div>
        )}
      </div>
      )}

      {showForm && (
        <Modal
          title={editItem ? "Editar arrendador" : "Nuevo arrendador"}
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
          <div style={S.formGroup}>
            <label style={S.label}>Cuenta bancaria</label>
            <input style={S.input} value={form.cuentaBancaria} onChange={(e) => set("cuentaBancaria", e.target.value)} placeholder="Ej. cuenta de ahorros Bancolombia No. 123456 o llave @usuario" />
          </div>
          <div style={{ ...S.formGroup, display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" id="responsableIva" checked={form.responsableIva} onChange={(e) => set("responsableIva", e.target.checked)} />
            <label htmlFor="responsableIva" style={{ ...S.label, marginBottom: 0 }}>Responsable de IVA</label>
          </div>
        </Modal>
      )}

      {delItem && (
        <Modal
          title="Eliminar arrendador"
          onClose={() => setDelItem(null)}
          footer={
            <>
              <button style={S.btn("secondary")} onClick={() => setDelItem(null)}>Cancelar</button>
              <button style={S.btn("danger")} onClick={async () => { await onDelete(delItem.id); setDelItem(null); }}>Eliminar</button>
            </>
          }
        >
          <p style={{ fontSize: 14, color: "#555" }}>¿Eliminar <strong>{delItem.nombre}</strong>? Los inmuebles que le pertenecen quedarán sin arrendador asignado.</p>
        </Modal>
      )}
    </div>
  );
};

// ─── Alertas ──────────────────────────────────────────────────────────────
const AlertasTab = ({ inmuebles, arrendatarios, pagos }) => {
  const isMobile = useIsMobile();
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
      {isMobile ? (
        <div style={{ marginBottom: 24 }}>
          {enMora.map(({ inmueble, estado }, idx) => (
            <div key={inmueble.id} style={{ ...cardS, borderLeft: "3px solid #dc2626" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, color: BLUE.text, fontSize: 14 }}><span style={{ color: "#aaa", fontWeight: 400 }}>{idx + 1}. </span>{inmueble.nombre}</div>
                  <div style={{ fontSize: 12.5, color: "#6b87b0" }}>{nombreArr(inmueble.arrendatarioId)}</div>
                </div>
                <span style={S.chip("#dc2626")}>{estado.dias} día{estado.dias === 1 ? "" : "s"}</span>
              </div>
              <div style={cardRowS}>
                <span style={cardLabelS}>Canon mensual</span>
                <span style={{ fontSize: 12.5, color: "#888" }}>{fmt(inmueble.valorCanonBase)}</span>
              </div>
              <div style={cardRowS}>
                <span style={cardLabelS}>Mora total{estado.meses > 1 ? ` (${estado.meses} meses)` : ""}</span>
                <span style={{ fontWeight: 700, color: "#dc2626" }}>{fmt(estado.valorTotal)}</span>
              </div>
              <div style={cardRowS}>
                <span style={cardLabelS}>Fecha último pago</span>
                <span style={{ fontSize: 12.5 }}>{estado.ultimoPago ? fmtDate(estado.ultimoPago.fechaPago) : "Nunca ha pagado"}</span>
              </div>
              {estado.ultimoPago && (
                <div style={cardRowS}>
                  <span style={cardLabelS}>Período del último pago</span>
                  <span style={{ fontSize: 12.5 }}>{fmtDate(estado.ultimoPago.periodoInicio)} – {fmtDate(estado.ultimoPago.periodoFin)}</span>
                </div>
              )}
            </div>
          ))}
          {enMora.length === 0 && <div style={{ ...cardS, color: "#aaa", fontSize: 13 }}>Nadie en mora ahora mismo.</div>}
        </div>
      ) : (
      <div style={{ ...S.tableWrap, marginBottom: 24, overflowX: "auto" }}>
        <div style={{ ...S.tableHead, gridTemplateColumns: "36px 1.1fr 0.9fr 0.9fr 0.9fr 0.9fr 1fr 1.2fr", minWidth: 1000 }}>
          <div>#</div><div>Inmueble</div><div>Arrendatario</div><div>Canon mensual</div><div>Mora total</div><div>Días en mora</div><div>Fecha último pago</div><div>Período del último pago</div>
        </div>
        {enMora.map(({ inmueble, estado }, idx) => (
          <div key={inmueble.id} style={{ ...S.tableRow, gridTemplateColumns: "36px 1.1fr 0.9fr 0.9fr 0.9fr 0.9fr 1fr 1.2fr", minWidth: 1000 }}>
            <div style={{ color: "#aaa", fontSize: 12 }}>{idx + 1}</div>
            <div style={{ fontWeight: 600, color: BLUE.text }}>{inmueble.nombre}</div>
            <div>{nombreArr(inmueble.arrendatarioId)}</div>
            <div style={{ color: "#888" }}>{fmt(inmueble.valorCanonBase)}</div>
            <div style={{ fontWeight: 700, color: "#dc2626" }}>{fmt(estado.valorTotal)}</div>
            <div>
              <span style={S.chip("#dc2626")}>{estado.dias} día{estado.dias === 1 ? "" : "s"}</span>
              {estado.meses > 1 && <span style={{ marginLeft: 6, fontSize: 11, color: "#888" }}>({estado.meses} meses)</span>}
            </div>
            <div style={{ fontSize: 12.5 }}>{estado.ultimoPago ? fmtDate(estado.ultimoPago.fechaPago) : "Nunca ha pagado"}</div>
            <div style={{ fontSize: 12.5 }}>{estado.ultimoPago ? `${fmtDate(estado.ultimoPago.periodoInicio)} – ${fmtDate(estado.ultimoPago.periodoFin)}` : "—"}</div>
          </div>
        ))}
        {enMora.length === 0 && <div style={{ padding: 20, color: "#aaa", fontSize: 13 }}>Nadie en mora ahora mismo.</div>}
      </div>
      )}

      <div style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b", marginBottom: 10 }}>Próximos vencimientos — 5 días o menos ({proximos.length})</div>
      {isMobile ? (
        <div>
          {proximos.map(({ inmueble, estado }, idx) => (
            <div key={inmueble.id} style={{ ...cardS, borderLeft: "3px solid #f59e0b" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, color: BLUE.text, fontSize: 14 }}><span style={{ color: "#aaa", fontWeight: 400 }}>{idx + 1}. </span>{inmueble.nombre}</div>
                  <div style={{ fontSize: 12.5, color: "#6b87b0" }}>{nombreArr(inmueble.arrendatarioId)}</div>
                </div>
                <span style={S.chip("#f59e0b")}>{estado.dias === 0 ? "Hoy" : `${estado.dias} día${estado.dias === 1 ? "" : "s"}`}</span>
              </div>
              <div style={cardRowS}>
                <span style={cardLabelS}>Valor</span>
                <span style={{ fontSize: 12.5 }}>{fmt(inmueble.valorCanonBase)}</span>
              </div>
              <div style={cardRowS}>
                <span style={cardLabelS}>Fecha último pago</span>
                <span style={{ fontSize: 12.5 }}>{estado.ultimoPago ? fmtDate(estado.ultimoPago.fechaPago) : "Nunca ha pagado"}</span>
              </div>
              {estado.ultimoPago && (
                <div style={cardRowS}>
                  <span style={cardLabelS}>Período del último pago</span>
                  <span style={{ fontSize: 12.5 }}>{fmtDate(estado.ultimoPago.periodoInicio)} – {fmtDate(estado.ultimoPago.periodoFin)}</span>
                </div>
              )}
            </div>
          ))}
          {proximos.length === 0 && <div style={{ ...cardS, color: "#aaa", fontSize: 13 }}>Nada por vencer en los próximos 5 días.</div>}
        </div>
      ) : (
      <div style={{ ...S.tableWrap, overflowX: "auto" }}>
        <div style={{ ...S.tableHead, gridTemplateColumns: "36px 1.1fr 0.9fr 0.9fr 0.9fr 1fr 1.2fr", minWidth: 900 }}>
          <div>#</div><div>Inmueble</div><div>Arrendatario</div><div>Valor</div><div>Vence en</div><div>Fecha último pago</div><div>Período del último pago</div>
        </div>
        {proximos.map(({ inmueble, estado }, idx) => (
          <div key={inmueble.id} style={{ ...S.tableRow, gridTemplateColumns: "36px 1.1fr 0.9fr 0.9fr 0.9fr 1fr 1.2fr", minWidth: 900 }}>
            <div style={{ color: "#aaa", fontSize: 12 }}>{idx + 1}</div>
            <div style={{ fontWeight: 600, color: BLUE.text }}>{inmueble.nombre}</div>
            <div>{nombreArr(inmueble.arrendatarioId)}</div>
            <div>{fmt(inmueble.valorCanonBase)}</div>
            <div><span style={S.chip("#f59e0b")}>{estado.dias === 0 ? "Hoy" : `${estado.dias} día${estado.dias === 1 ? "" : "s"}`}</span></div>
            <div style={{ fontSize: 12.5 }}>{estado.ultimoPago ? fmtDate(estado.ultimoPago.fechaPago) : "Nunca ha pagado"}</div>
            <div style={{ fontSize: 12.5 }}>{estado.ultimoPago ? `${fmtDate(estado.ultimoPago.periodoInicio)} – ${fmtDate(estado.ultimoPago.periodoFin)}` : "—"}</div>
          </div>
        ))}
        {proximos.length === 0 && <div style={{ padding: 20, color: "#aaa", fontSize: 13 }}>Nada por vencer en los próximos 5 días.</div>}
      </div>
      )}
    </div>
  );
};

// ─── Dashboard ────────────────────────────────────────────────────────────
const StatCard = ({ label, value, color, sub }) => (
  <div style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", border: `1px solid ${BLUE.border}`, boxShadow: "0 1px 6px rgba(26,86,219,0.06)" }}>
    <div style={{ fontSize: 11, color: "#9aa8c7", marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 18, fontWeight: 700, color: color || BLUE.text }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: "#9aa8c7", marginTop: 3 }}>{sub}</div>}
  </div>
);

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const toISODash = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const ESTADO_MES_INFO = {
  a_tiempo: { label: "Pagó a tiempo", color: "#16a34a" },
  tarde: { label: "Pagó tarde", color: "#d97706" },
  no_pagado: { label: "No ha pagado", color: "#dc2626" },
  no_vence: { label: "Aún no vence", color: "#9aa8c7" },
};

// Estado del inmueble frente a SU vencimiento dentro del mes en curso (no el
// ciclo de mora general, que puede venir de meses atrás): a tiempo, tarde,
// sin pagar, o el vencimiento todavía no llega este mes.
function estadoMesActual(inmueble, pagos, hoy) {
  if (!inmueble.arrendatarioId || !inmueble.diaVencimientoPago) return null;
  const anio = hoy.getFullYear(), mes = hoy.getMonth();
  const ultimoDiaMes = new Date(anio, mes + 1, 0).getDate();
  const diaVence = Math.min(inmueble.diaVencimientoPago, ultimoDiaMes);
  const vencimiento = new Date(anio, mes, diaVence);
  const vencimientoISO = toISODash(vencimiento);

  const pagoDelMes = pagos.find((p) => p.inmuebleId === inmueble.id && p.periodoFin === vencimientoISO);

  if (vencimiento > hoy) return { tipo: "no_vence", vencimiento };
  if (!pagoDelMes) return { tipo: "no_pagado", vencimiento };
  if (pagoDelMes.fechaPago <= pagoDelMes.periodoFin) return { tipo: "a_tiempo", vencimiento, pago: pagoDelMes };
  return { tipo: "tarde", vencimiento, pago: pagoDelMes };
}

const DashboardTab = ({ inmuebles, arrendatarios, pagos }) => {
  const isMobile = useIsMobile();
  const [filtroInmueble, setFiltroInmueble] = useState("");
  const [filtroArrendatario, setFiltroArrendatario] = useState("");

  const nombreArr = (id) => arrendatarios.find((a) => a.id === id)?.nombre || "—";

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const inicioMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;
  const mesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const inicioMesAnterior = toISODash(mesAnterior);
  const finMesAnterior = toISODash(new Date(hoy.getFullYear(), hoy.getMonth(), 0));

  const inmueblesActivos = inmuebles.filter((i) => i.activo);
  const canonMensual = inmueblesActivos.reduce((s, i) => s + (i.valorCanonBase || 0) + (i.tieneAdministracion ? (i.valorAdministracion || 0) : 0), 0);
  const recaudadoMes = pagos.filter((p) => p.fechaPago >= inicioMes).reduce((s, p) => s + (p.valor || 0), 0);
  const recaudadoMesAnterior = pagos.filter((p) => p.fechaPago >= inicioMesAnterior && p.fechaPago <= finMesAnterior).reduce((s, p) => s + (p.valor || 0), 0);
  const variacionMes = recaudadoMesAnterior > 0 ? Math.round(((recaudadoMes - recaudadoMesAnterior) / recaudadoMesAnterior) * 100) : null;

  const estadosCiclo = inmueblesActivos.filter((i) => i.arrendatarioId).map((i) => ({ inmueble: i, estado: calcularEstadoPago(i, pagos) }));
  const carteraMora = estadosCiclo.filter((x) => x.estado?.tipo === "mora").reduce((s, x) => s + (x.estado.valorTotal || 0), 0);

  const estadosMes = inmueblesActivos
    .map((i) => ({ inmueble: i, estado: estadoMesActual(i, pagos, hoy) }))
    .filter((x) => x.estado);
  const conteoMes = { a_tiempo: 0, tarde: 0, no_pagado: 0, no_vence: 0 };
  estadosMes.forEach((x) => conteoMes[x.estado.tipo]++);
  const ordenUrgencia = { no_pagado: 0, tarde: 1, a_tiempo: 2, no_vence: 3 };
  const estadosMesOrdenados = [...estadosMes].sort((a, b) => ordenUrgencia[a.estado.tipo] - ordenUrgencia[b.estado.tipo]);

  // El filtro de arrendatario ancla también su inmueble actual, para poder
  // mostrar el estado (mora/próximo/al día) igual que si filtraras por inmueble.
  const inmuebleDelArrendatario = filtroArrendatario ? inmuebles.find((i) => i.arrendatarioId === filtroArrendatario) : null;
  const inmuebleParaEstado = filtroInmueble ? inmuebles.find((i) => i.id === filtroInmueble) : inmuebleDelArrendatario;
  const estadoFiltroCiclo = inmuebleParaEstado ? calcularEstadoPago(inmuebleParaEstado, pagos) : null;

  const pagosFiltrados = pagos
    .filter((p) => (!filtroInmueble || p.inmuebleId === filtroInmueble) && (!filtroArrendatario || p.arrendatarioId === filtroArrendatario))
    .sort((a, b) => b.fechaPago.localeCompare(a.fechaPago));
  const totalFiltrado = pagosFiltrados.reduce((s, p) => s + (p.valor || 0), 0);
  const promedioFiltrado = pagosFiltrados.length ? totalFiltrado / pagosFiltrados.length : 0;
  const hayFiltro = filtroInmueble || filtroArrendatario;
  const LIMITE = 20;

  return (
    <div>
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>Dashboard</div>
          <div style={S.pageSub}>Resumen general de arriendos</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 24 }}>
        <StatCard label="Canon mensual esperado" value={fmt(canonMensual)} />
        <StatCard
          label="Recaudado este mes"
          value={fmt(recaudadoMes)}
          color={variacionMes === null ? undefined : variacionMes >= 0 ? "#16a34a" : "#dc2626"}
          sub={variacionMes === null ? "sin dato del mes anterior" : `${variacionMes >= 0 ? "↑" : "↓"} ${Math.abs(variacionMes)}% vs. mes anterior`}
        />
        <StatCard label="Cartera en mora" value={fmt(carteraMora)} color={carteraMora > 0 ? "#dc2626" : "#16a34a"} sub="acumulado, ciclos vencidos" />
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: BLUE.text, marginBottom: 4 }}>
        Este mes de {MESES[hoy.getMonth()]}
      </div>
      <div style={{ fontSize: 12, color: "#9aa8c7", marginBottom: 10 }}>
        Estado de cada inmueble frente a su día de vencimiento de {MESES[hoy.getMonth()]}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 16 }}>
        {Object.entries(ESTADO_MES_INFO).map(([tipo, info]) => (
          <StatCard key={tipo} label={info.label} value={conteoMes[tipo]} color={info.color} />
        ))}
      </div>

      {isMobile ? (
        <div style={{ marginBottom: 24 }}>
          {estadosMesOrdenados.map(({ inmueble, estado }) => (
            <div key={inmueble.id} style={{ ...cardS, borderLeft: `3px solid ${ESTADO_MES_INFO[estado.tipo].color}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, color: BLUE.text, fontSize: 14 }}>{inmueble.nombre}</div>
                  <div style={{ fontSize: 12.5, color: "#6b87b0" }}>{nombreArr(inmueble.arrendatarioId)}</div>
                </div>
                <span style={S.chip(ESTADO_MES_INFO[estado.tipo].color)}>{ESTADO_MES_INFO[estado.tipo].label}</span>
              </div>
              <div style={cardRowS}>
                <span style={cardLabelS}>Vence este mes</span>
                <span style={{ fontSize: 12.5 }}>{fmtDate(toISODash(estado.vencimiento))}</span>
              </div>
              {estado.pago && (
                <div style={cardRowS}>
                  <span style={cardLabelS}>Fecha de pago</span>
                  <span style={{ fontSize: 12.5 }}>{fmtDate(estado.pago.fechaPago)}</span>
                </div>
              )}
            </div>
          ))}
          {estadosMesOrdenados.length === 0 && <div style={{ ...cardS, color: "#aaa", fontSize: 13 }}>No hay inmuebles activos con arrendatario.</div>}
        </div>
      ) : (
        <div style={{ ...S.tableWrap, marginBottom: 24, overflowX: "auto" }}>
          <div style={{ ...S.tableHead, gridTemplateColumns: "1.2fr 1fr 1fr 1fr 1fr", minWidth: 700 }}>
            <div>Inmueble</div><div>Arrendatario</div><div>Vence este mes</div><div>Estado</div><div>Fecha de pago</div>
          </div>
          {estadosMesOrdenados.map(({ inmueble, estado }) => (
            <div key={inmueble.id} style={{ ...S.tableRow, gridTemplateColumns: "1.2fr 1fr 1fr 1fr 1fr", minWidth: 700 }}>
              <div style={{ fontWeight: 600, color: BLUE.text }}>{inmueble.nombre}</div>
              <div>{nombreArr(inmueble.arrendatarioId)}</div>
              <div style={{ fontSize: 12.5 }}>{fmtDate(toISODash(estado.vencimiento))}</div>
              <div><span style={S.chip(ESTADO_MES_INFO[estado.tipo].color)}>{ESTADO_MES_INFO[estado.tipo].label}</span></div>
              <div style={{ fontSize: 12.5 }}>{estado.pago ? fmtDate(estado.pago.fechaPago) : "—"}</div>
            </div>
          ))}
          {estadosMesOrdenados.length === 0 && <div style={{ padding: 20, color: "#aaa", fontSize: 13 }}>No hay inmuebles activos con arrendatario.</div>}
        </div>
      )}

      <div style={{ fontSize: 13, fontWeight: 700, color: BLUE.text, marginBottom: 10 }}>Detalle por inmueble o arrendatario</div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <select style={{ ...S.select, maxWidth: 240 }} value={filtroInmueble} onChange={(e) => { setFiltroInmueble(e.target.value); setFiltroArrendatario(""); }}>
          <option value="">Filtrar por inmueble…</option>
          {inmuebles.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
        </select>
        <select style={{ ...S.select, maxWidth: 240 }} value={filtroArrendatario} onChange={(e) => { setFiltroArrendatario(e.target.value); setFiltroInmueble(""); }}>
          <option value="">Filtrar por arrendatario…</option>
          {arrendatarios.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </select>
        {hayFiltro && (
          <button style={S.btn("ghost")} onClick={() => { setFiltroInmueble(""); setFiltroArrendatario(""); }}>Limpiar filtros</button>
        )}
      </div>

      {hayFiltro && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 }}>
            <StatCard label="Total recaudado" value={fmt(totalFiltrado)} />
            <StatCard label="Pagos registrados" value={pagosFiltrados.length} />
            <StatCard label="Promedio por pago" value={fmt(promedioFiltrado)} />
            {estadoFiltroCiclo ? (
              <StatCard
                label="Estado actual"
                value={estadoFiltroCiclo.tipo === "mora" ? `En mora (${estadoFiltroCiclo.dias} d)` : `Vence en ${estadoFiltroCiclo.dias} d`}
                color={estadoFiltroCiclo.tipo === "mora" ? "#dc2626" : "#f59e0b"}
              />
            ) : (
              <StatCard label="Estado actual" value="Al día" color="#16a34a" />
            )}
          </div>

          {pagosFiltrados.slice(0, LIMITE).map((p) => (
            <div key={p.id} style={{ ...cardS, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12.5, color: BLUE.text }}>{fmtDate(p.periodoInicio)} – {fmtDate(p.periodoFin)}</span>
              <span style={{ fontWeight: 700, color: BLUE.primary, fontSize: 13, whiteSpace: "nowrap" }}>
                {fmt(p.valor)} <span style={{ fontWeight: 400, color: "#9aa8c7", fontSize: 11.5 }}>· {fmtDate(p.fechaPago)}</span>
              </span>
            </div>
          ))}
          {pagosFiltrados.length === 0 && <div style={{ color: "#aaa", fontSize: 13, padding: 20 }}>No hay pagos para este filtro.</div>}
          {pagosFiltrados.length > LIMITE && (
            <div style={{ fontSize: 12, color: "#999", marginTop: 8 }}>Mostrando los {LIMITE} más recientes de {pagosFiltrados.length}.</div>
          )}
        </>
      )}
    </div>
  );
};

// ─── Página raíz del módulo ───────────────────────────────────────────────
const ArriendosPage = () => {
  const [tab, setTab] = useState("dashboard");
  const [inmuebles, setInmuebles] = useState([]);
  const [arrendatarios, setArrendatarios] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [arrendadores, setArrendadores] = useState([]);
  const [cuentasCobro, setCuentasCobro] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("inmuebles").select("*").order("nombre"),
      supabase.from("arrendatarios").select("*").order("nombre"),
      supabase.from("pagos").select("*").order("periodo_inicio", { ascending: false }),
      supabase.from("arrendador_config").select("*").order("nombre"),
      supabase.from("cuentas_cobro").select("*").order("numero", { ascending: false }),
    ]).then(([{ data: inm }, { data: arr }, { data: pgs }, { data: arrd }, { data: cc }]) => {
      if (inm) setInmuebles(inm.map(mapInmueble));
      if (arr) setArrendatarios(arr.map(mapArrendatario));
      if (pgs) setPagos(pgs.map(mapPago));
      if (arrd) setArrendadores(arrd.map(mapArrendador));
      if (cc) setCuentasCobro(cc.map(mapCuentaCobro));
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
        if (payload.eventType === "INSERT") setArrendadores((p) => p.some((x) => x.id === payload.new.id) ? p : [...p, mapArrendador(payload.new)].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        if (payload.eventType === "UPDATE") setArrendadores((p) => p.map((x) => x.id === payload.new.id ? mapArrendador(payload.new) : x));
        if (payload.eventType === "DELETE") setArrendadores((p) => p.filter((x) => x.id !== payload.old.id));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "cuentas_cobro" }, (payload) => {
        if (payload.eventType === "INSERT") setCuentasCobro((p) => p.some((x) => x.id === payload.new.id) ? p : [mapCuentaCobro(payload.new), ...p]);
        if (payload.eventType === "UPDATE") setCuentasCobro((p) => p.map((x) => x.id === payload.new.id ? mapCuentaCobro(payload.new) : x));
        if (payload.eventType === "DELETE") setCuentasCobro((p) => p.filter((x) => x.id !== payload.old.id));
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

  // Liga/libera el inmueble de un arrendatario. Solo toca arrendatario_id (y
  // fecha_inicio_arriendo al ligar) — no usa toInmuebleRow, para no
  // arriesgar pisar el resto de campos del inmueble con un objeto a medias.
  const setInmuebleArrendatario = async (inmuebleId, arrendatarioId, fechaInicioArriendo) => {
    const cambios = { arrendatario_id: arrendatarioId || null };
    if (arrendatarioId) cambios.fecha_inicio_arriendo = fechaInicioArriendo || null;
    const { error } = await supabase.from("inmuebles").update(cambios).eq("id", inmuebleId);
    if (error) { console.error("setInmuebleArrendatario error:", error); return; }
    setInmuebles((p) => p.map((x) => x.id === inmuebleId ? { ...x, arrendatarioId: arrendatarioId || "", ...(arrendatarioId ? { fechaInicioArriendo: fechaInicioArriendo || "" } : {}) } : x));
  };

  const asignarInmuebleAArrendatario = async (arrendatarioId, nuevoInmuebleId, fechaInicioArriendo) => {
    const inmuebleAnterior = inmuebles.find((i) => i.arrendatarioId === arrendatarioId);
    if (inmuebleAnterior && inmuebleAnterior.id !== nuevoInmuebleId) {
      await setInmuebleArrendatario(inmuebleAnterior.id, "");
    }
    if (nuevoInmuebleId) await setInmuebleArrendatario(nuevoInmuebleId, arrendatarioId, fechaInicioArriendo);
  };
  const editArrendatario = async (f) => {
    const { error } = await supabase.from("arrendatarios").update({ nombre: f.nombre, telefono: f.telefono, documento: f.documento, activo: f.activo !== false }).eq("id", f.id);
    if (error) { console.error("editArrendatario error:", error); return; }
    setArrendatarios((p) => p.map((x) => x.id === f.id ? { ...x, ...f, activo: f.activo !== false } : x));
  };
  const deleteArrendatario = async (id) => {
    const { error } = await supabase.from("arrendatarios").delete().eq("id", id);
    if (error) { console.error("deleteArrendatario error:", error); return; }
    setArrendatarios((p) => p.filter((x) => x.id !== id));
  };
  const toggleActivoArrendatario = async (arrendatario) => {
    const { error } = await supabase.from("arrendatarios").update({ activo: !arrendatario.activo }).eq("id", arrendatario.id);
    if (error) { console.error("toggleActivoArrendatario error:", error); return; }
    setArrendatarios((p) => p.map((x) => x.id === arrendatario.id ? { ...x, activo: !arrendatario.activo } : x));
  };

  const addPago = async (f) => {
    const { data, error } = await supabase.from("pagos").insert([toPagoRow(f)]).select().single();
    if (error) { console.error("addPago error:", error); return; }
    if (data) setPagos((p) => [mapPago(data), ...p]);
  };
  const editPago = async (f) => {
    const { error } = await supabase.from("pagos").update(toPagoRow(f)).eq("id", f.id);
    if (error) { console.error("editPago error:", error); return; }
    setPagos((p) => p.map((x) => x.id === f.id ? { ...x, ...f } : x));
  };
  const deletePago = async (id) => {
    const { error } = await supabase.from("pagos").delete().eq("id", id);
    if (error) { console.error("deletePago error:", error); return; }
    setPagos((p) => p.filter((x) => x.id !== id));
  };
  const asignarNumeroComprobante = async (pagoId, numeroComprobante) => {
    const { error } = await supabase.from("pagos").update({ numero_comprobante: numeroComprobante }).eq("id", pagoId);
    if (error) { console.error("asignarNumeroComprobante error:", error); return; }
    setPagos((p) => p.map((x) => x.id === pagoId ? { ...x, numeroComprobante } : x));
  };

  const addArrendador = async (f) => {
    const { data, error } = await supabase.from("arrendador_config").insert([toArrendadorRow(f)]).select().single();
    if (error) { console.error("addArrendador error:", error); return; }
    if (data) setArrendadores((p) => [...p, mapArrendador(data)].sort((a, b) => a.nombre.localeCompare(b.nombre)));
  };
  const editArrendador = async (f) => {
    const { error } = await supabase.from("arrendador_config").update(toArrendadorRow(f)).eq("id", f.id);
    if (error) { console.error("editArrendador error:", error); return; }
    setArrendadores((p) => p.map((x) => x.id === f.id ? { ...x, ...f } : x));
  };
  const deleteArrendador = async (id) => {
    const { error } = await supabase.from("arrendador_config").delete().eq("id", id);
    if (error) { console.error("deleteArrendador error:", error); return; }
    setArrendadores((p) => p.filter((x) => x.id !== id));
  };

  const addCuentaCobro = async (f) => {
    const { data, error } = await supabase.from("cuentas_cobro").insert([toCuentaCobroRow(f)]).select().single();
    if (error) { console.error("addCuentaCobro error:", error); return null; }
    if (!data) return null;
    const cuenta = mapCuentaCobro(data);
    setCuentasCobro((p) => [cuenta, ...p]);
    return cuenta;
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
              display: "flex", alignItems: "center", gap: 6,
              padding: "9px 18px", borderRadius: 8, border: "none", fontWeight: 600, fontSize: 13, cursor: t.proximamente ? "default" : "pointer",
              background: tab === t.id ? BLUE.primary : t.proximamente ? "transparent" : "#fff",
              color: tab === t.id ? "#fff" : t.proximamente ? "#bbb" : "#555",
              boxShadow: t.proximamente ? "none" : "0 1px 4px rgba(26,86,219,0.08)",
            }}
          >
            {t.label}
            {t.proximamente && (
              <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: "#c7ccd6", border: "1px solid #e2e5ea", borderRadius: 20, padding: "1px 6px" }}>
                Pronto
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "dashboard" && <DashboardTab inmuebles={inmuebles} arrendatarios={arrendatarios} pagos={pagos} />}
      {tab === "inmuebles" && <InmueblesTab inmuebles={inmuebles} arrendatarios={arrendatarios} arrendadores={arrendadores} onAdd={addInmueble} onEdit={editInmueble} onDelete={deleteInmueble} />}
      {tab === "arrendatarios" && <ArrendatariosTab arrendatarios={arrendatarios} inmuebles={inmuebles} pagos={pagos} arrendadores={arrendadores} cuentasCobro={cuentasCobro} onAdd={addArrendatario} onEdit={editArrendatario} onDelete={deleteArrendatario} onAsignarInmueble={asignarInmuebleAArrendatario} onToggleActivo={toggleActivoArrendatario} onAgregarCuentaCobro={addCuentaCobro} />}
      {tab === "pagos" && <PagosTab pagos={pagos} inmuebles={inmuebles} arrendatarios={arrendatarios} arrendadores={arrendadores} onAdd={addPago} onEdit={editPago} onDelete={deletePago} onAsignarNumero={asignarNumeroComprobante} />}
      {tab === "alertas" && <AlertasTab inmuebles={inmuebles} arrendatarios={arrendatarios} pagos={pagos} />}
      {tab === "arrendadores" && <ArrendadoresTab arrendadores={arrendadores} inmuebles={inmuebles} onAdd={addArrendador} onEdit={editArrendador} onDelete={deleteArrendador} />}
    </div>
  );
};

export default ArriendosPage;
