// ─── HELPERS ─────────────────────────────────────────────────────────────────
import { ROL_ADMIN } from "./constants.js";
import { supabase } from "./supabase.js";

// Token de la sesión activa de Supabase, para llamar endpoints de /api/*.js
// que exigen autenticación (comerciales, twilio-token, etc.).
export const authHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
};

export const fmt = (n) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

export const fmtDate = (s) => {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};

export const esAdmin = (rol) => rol === ROL_ADMIN;

// Fecha de hoy en hora LOCAL, no UTC. toISOString() usa UTC — en Bogotá
// (UTC-5), entre las 7pm y medianoche ya cae en el día siguiente, así que
// cualquier fecha por defecto (registro, cotización, vigencia) quedaba
// adelantada un día durante esas horas.
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// ─── SOAT helpers ─────────────────────────────────────────────────────────────
export const parseDateSoat = (str) => {
  if (!str) return null;
  const s = str.trim();
  const p = s.split(/[-/]/);
  if (p.length !== 3) return null;
  try {
    return new Date(p[0].length === 4 ? s : `${p[2]}-${p[1]}-${p[0]}`);
  } catch {
    return null;
  }
};

export const diasRenSoat = (fc) => {
  const f = parseDateSoat(fc);
  if (!f) return null;
  const r = new Date(f);
  r.setFullYear(r.getFullYear() + 1);
  return Math.ceil((r - new Date()) / 86400000);
};

export const mapSoat = (r) => ({
  id: r.id,
  nombre: r.nombre || "",
  telefono: r.telefono || "",
  placa: r.placa || "",
  anioMes: r.anio_mes || "",
  fechaCompra: r.fecha_compra || "",
  fechaVencimiento: r.fecha_vencimiento || "",
  fase: r.fase || "pendiente",
  agente: r.agente || "Sin asignar",
  intentos: r.intentos || 0,
  proximaAccion: r.proxima_accion || "",
  fechaProxima: r.fecha_proxima || "",
  motivoNoCompra: r.motivo_no_compra || "",
  notas: r.notas || "",
  historial: r.historial || [],
});

export const toSoatRow = (c) => ({
  nombre: c.nombre,
  telefono: c.telefono,
  placa: c.placa,
  anio_mes: c.anioMes,
  fecha_compra: c.fechaCompra,
  fecha_vencimiento: c.fechaVencimiento || "",
  fase: c.fase,
  agente: c.agente,
  intentos: c.intentos || 0,
  proxima_accion: c.proximaAccion,
  fecha_proxima: c.fechaProxima,
  motivo_no_compra: c.motivoNoCompra,
  notas: c.notas,
  historial: c.historial || [],
});

// ─── Arriendos helpers ─────────────────────────────────────────────────────
export const mapInmueble = (r) => ({
  id: r.id,
  nombre: r.nombre || "",
  direccion: r.direccion || "",
  valorCanonBase: r.valor_canon_base || 0,
  diaVencimientoPago: r.dia_vencimiento_pago || 1,
  activo: r.activo !== false,
  arrendatarioId: r.arrendatario_id || "",
  arrendadorId: r.arrendador_id || "",
  tieneAdministracion: r.tiene_administracion === true,
  valorAdministracion: r.valor_administracion || 0,
  fechaInicioArriendo: r.fecha_inicio_arriendo || "",
});

export const toInmuebleRow = (f) => ({
  nombre: f.nombre,
  direccion: f.direccion,
  valor_canon_base: f.valorCanonBase || 0,
  dia_vencimiento_pago: f.diaVencimientoPago,
  activo: f.activo !== false,
  arrendatario_id: f.arrendatarioId || null,
  arrendador_id: f.arrendadorId || null,
  tiene_administracion: f.tieneAdministracion === true,
  valor_administracion: Number(f.valorAdministracion) || 0,
  fecha_inicio_arriendo: f.fechaInicioArriendo || null,
});

export const mapArrendatario = (r) => ({
  id: r.id,
  nombre: r.nombre || "",
  telefono: r.telefono || "",
  documento: r.documento || "",
  activo: r.activo !== false,
});

export const mapPago = (r) => ({
  id: r.id,
  inmuebleId: r.inmueble_id,
  arrendatarioId: r.arrendatario_id,
  fechaPago: r.fecha_pago,
  periodoInicio: r.periodo_inicio,
  periodoFin: r.periodo_fin,
  valor: r.valor || 0,
  valorAdministracion: r.valor_administracion || 0,
  metodo: r.metodo || "efectivo",
  estado: r.estado || "pagado",
  numeroComprobante: r.numero_comprobante || "",
});

export const toPagoRow = (f) => ({
  inmueble_id: f.inmuebleId,
  arrendatario_id: f.arrendatarioId,
  fecha_pago: f.fechaPago,
  periodo_inicio: f.periodoInicio,
  periodo_fin: f.periodoFin,
  valor: Number(f.valor) || 0,
  valor_administracion: Number(f.valorAdministracion) || 0,
  metodo: f.metodo,
  estado: f.estado,
});

export const mapArrendador = (r) => ({
  id: r.id,
  nombre: r.nombre || "",
  documento: r.documento || "",
  telefono: r.telefono || "",
  direccion: r.direccion || "",
  cuentaBancaria: r.cuenta_bancaria || "",
  responsableIva: r.responsable_iva === true,
});

export const toArrendadorRow = (f) => ({
  nombre: f.nombre,
  documento: f.documento,
  telefono: f.telefono,
  direccion: f.direccion,
  cuenta_bancaria: f.cuentaBancaria || null,
  responsable_iva: f.responsableIva === true,
});

export const mapCuentaCobro = (r) => ({
  id: r.id,
  numero: r.numero,
  arrendatarioId: r.arrendatario_id,
  inmuebleId: r.inmueble_id,
  periodoInicio: r.periodo_inicio,
  periodoFin: r.periodo_fin,
  valor: r.valor || 0,
  valorAdministracion: r.valor_administracion || 0,
  saldoAnterior: r.saldo_anterior || 0,
  fechaEmision: r.fecha_emision,
  fechaVencimiento: r.fecha_vencimiento,
});

export const toCuentaCobroRow = (f) => ({
  numero: f.numero,
  arrendatario_id: f.arrendatarioId,
  inmueble_id: f.inmuebleId || null,
  periodo_inicio: f.periodoInicio,
  periodo_fin: f.periodoFin,
  valor: Number(f.valor) || 0,
  valor_administracion: Number(f.valorAdministracion) || 0,
  saldo_anterior: Number(f.saldoAnterior) || 0,
  fecha_emision: f.fechaEmision,
  fecha_vencimiento: f.fechaVencimiento,
});
