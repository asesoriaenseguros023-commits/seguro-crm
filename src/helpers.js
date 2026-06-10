// ─── HELPERS ─────────────────────────────────────────────────────────────────
import { ROL_ADMIN } from "./constants.js";

export const fmt = (n) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

export const fmtDate = (s) => {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};

export const diasParaVencer = (fechaFin) => {
  if (!fechaFin) return 9999;
  const fin = new Date(fechaFin + "T00:00:00");
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((fin - hoy) / 86400000);
};

export const estadoColor = (e) =>
  ({ Activa: "#16a34a", Vencida: "#dc2626", Cancelada: "#6b7280" }[e] || "#6b7280");

export const esAdmin = (rol) => rol === ROL_ADMIN;

export const today = () => new Date().toISOString().split("T")[0];

// ─── MAPPERS ─────────────────────────────────────────────────────────────────
export const mapCliente = (c) => ({
  ...c,
  agenteId: c.agente_id,
  fechaAlta: c.fecha_alta,
});

export const mapInteresado = (i) => ({
  ...i,
  agenteId: i.agente_id,
  tipoSeguro: i.tipo_seguro,
  tipoPersona: i.tipo_persona,
  documentosChecklist: i.documentos_checklist
    ? (typeof i.documentos_checklist === "string"
        ? JSON.parse(i.documentos_checklist)
        : i.documentos_checklist)
    : {},
  numeroContrato: i.numero_contrato,
  envioOficina: i.envio_oficina,
  fechaRegistro: i.fecha_registro,
  clienteId: i.cliente_id,
});

export const mapCotizacion = (c) => ({
  ...c,
  interesadoId: c.interesado_id,
  leadId: c.lead_id,
  agenteId: c.agente_id,
  sumaAsegurada: c.suma_asegurada,
  fechaCotizacion: c.fecha_cotizacion,
  numeroPoliza: c.numero_poliza,
  clienteNombre: c.cliente_nombre,
  clienteTelefono: c.cliente_telefono,
  accion: c.accion || "En Curso",
  numeroPolizaEmitida: c.numero_poliza_emitida,
  aseguradoraEmitida: c.aseguradora_emitida,
  primaEmitida: c.prima_emitida,
  ivaEmitida: c.iva_emitida,
  gastosEmitida: c.gastos_emitida,
  totalPagoEmitida: c.total_pago_emitida,
});

export const mapPoliza = (p) => ({
  ...p,
  cotizacionId: p.cotizacion_id,
  clienteId: p.cliente_id,
  agenteId: p.agente_id,
  sumaAsegurada: p.suma_asegurada,
  vigenciaInicio: p.vigencia_inicio,
  vigenciaFin: p.vigencia_fin,
  fechaEmision: p.fecha_emision,
  ramoId: p.ramo_id,
  decisionRenovacion: p.decision_renovacion || "",
});

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
  fase: c.fase,
  agente: c.agente,
  intentos: c.intentos || 0,
  proxima_accion: c.proximaAccion,
  fecha_proxima: c.fechaProxima,
  motivo_no_compra: c.motivoNoCompra,
  notas: c.notas,
  historial: c.historial || [],
});

// Color helpers for cotizaciones
export const accionColor = (a) =>
  ({ "En Curso": "#f59e0b", "Cliente Rechaza": "#dc2626", "Póliza Emitida": "#16a34a" }[a] || "#6b7280");

export const estadoCotColor2 = (e) =>
  ({ "Corrección SARLAFT": "#f59e0b", "Corrección Contrato": "#d97706", "Cotización Completada": "#16a34a", Pendiente: "#6b7280" }[e] || "#6b7280");
