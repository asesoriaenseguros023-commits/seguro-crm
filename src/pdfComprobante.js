import jsPDF from "jspdf";
import { montoEnLetras } from "./numeroALetras.js";

const fmtMoney = (n) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);

const fmtFecha = (s) => {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};

const fmtPeriodo = (inicio, fin) => {
  if (!inicio || !fin) return "—";
  const [, mi, di] = inicio.split("-");
  const [yf, mf, df] = fin.split("-");
  return `${di}/${mi} al ${df}/${mf}/${yf.slice(2)}`;
};

// Días entre el fin del período cubierto (cuando vencía este pago) y la
// fecha en que efectivamente se pagó. Positivo = pago tardío.
const diasAtraso = (pago) => {
  if (!pago.periodoFin || !pago.fechaPago) return 0;
  const vence = new Date(pago.periodoFin + "T00:00:00");
  const pagado = new Date(pago.fechaPago + "T00:00:00");
  return Math.round((pagado - vence) / 86400000);
};

export const METODOS_LABEL = { efectivo: "Efectivo", transferencia: "Transferencia", pse: "PSE" };
export const ESTADOS_PAGO_LABEL = { pagado: "PAGADO", parcial: "PAGO PARCIAL", pendiente: "PENDIENTE" };

// Siguiente número consecutivo de comprobante para el año del pago, del
// estilo "2026-0034", a partir de los números ya usados en `pagos`.
export function siguienteNumeroComprobante(pagos, fechaPago) {
  const anio = new Date((fechaPago || "") + "T00:00:00").getFullYear() || new Date().getFullYear();
  const prefijo = `${anio}-`;
  const usados = pagos.filter((p) => p.numeroComprobante?.startsWith(prefijo)).length;
  return `${prefijo}${String(usados + 1).padStart(4, "0")}`;
}

function dashedLine(doc, x1, y, x2) {
  doc.setLineDashPattern([0.8, 0.8], 0);
  doc.setLineWidth(0.2);
  doc.line(x1, y, x2, y);
  doc.setLineDashPattern([], 0);
}

// Fila etiqueta (izquierda) / valor en negrita (derecha). Envuelve el valor
// si no cabe y devuelve cuánto creció el bloque en el eje Y.
function row(doc, x, y, w, label, value) {
  const valueW = w * 0.58;
  doc.setFont("courier", "normal");
  doc.setFontSize(9.5);
  doc.text(label, x, y);
  doc.setFont("courier", "bold");
  const lineas = doc.splitTextToSize(String(value ?? "—"), valueW);
  doc.text(lineas, x + w, y, { align: "right" });
  return Math.max(1, lineas.length) * 4.2;
}

function sectionLabel(doc, x, y, texto) {
  doc.setFont("courier", "bold");
  doc.setFontSize(9.5);
  doc.text(texto, x, y);
}

// Genera el PDF en memoria y lo abre en una pestaña nueva con el visor nativo
// del navegador (que ya trae su propio botón de descarga/impresión).
export function generarComprobante({ pago, inmueble, arrendatario, arrendador, numeroComprobante }) {
  const doc = new jsPDF({ unit: "mm", format: "a5" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const marginX = 12;
  const contentW = W - marginX * 2;
  let y = 16;

  const checkPageBreak = (extra = 20) => {
    if (y + extra > H - 10) { doc.addPage(); y = 16; }
  };

  // ── Encabezado ────────────────────────────────────────────────────────
  doc.setFont("courier", "bold");
  doc.setFontSize(14);
  doc.text("COMPROBANTE DE PAGO", W / 2, y, { align: "center" });
  y += 6;
  doc.text("ARRENDAMIENTO", W / 2, y, { align: "center" });
  y += 6;

  doc.setFont("courier", "normal");
  doc.setFontSize(9);
  const inmuebleTxt = [inmueble?.nombre, inmueble?.direccion].filter(Boolean).join(" - ") || "—";
  doc.text(inmuebleTxt, W / 2, y, { align: "center" });
  y += 5;

  const numero = numeroComprobante || pago.numeroComprobante || "";
  doc.setFontSize(8.5);
  doc.text(`${numero ? `No. ${numero} · ` : ""}Emitido ${fmtFecha(new Date().toISOString().slice(0, 10))}`, W / 2, y, { align: "center" });
  y += 6;

  dashedLine(doc, marginX, y, W - marginX);
  y += 5;

  // ── Arrendador / Arrendatario ────────────────────────────────────────
  sectionLabel(doc, marginX, y, "ARRENDADOR");
  y += 5;
  y += row(doc, marginX, y, contentW, "Nombre", arrendador?.nombre);
  if (arrendador?.documento) y += row(doc, marginX, y, contentW, "C.C.", arrendador.documento);
  y += 3;

  sectionLabel(doc, marginX, y, "ARRENDATARIO");
  y += 5;
  y += row(doc, marginX, y, contentW, "Nombre", arrendatario?.nombre);
  if (arrendatario?.documento) y += row(doc, marginX, y, contentW, "C.C.", arrendatario.documento);
  if (arrendatario?.telefono) y += row(doc, marginX, y, contentW, "Telefono", arrendatario.telefono);
  y += 2;

  dashedLine(doc, marginX, y, W - marginX);
  y += 5;

  // ── Detalle del pago ──────────────────────────────────────────────────
  y += row(doc, marginX, y, contentW, "Concepto", "Canon arrendamiento");
  y += row(doc, marginX, y, contentW, "Periodo", fmtPeriodo(pago.periodoInicio, pago.periodoFin));
  if (inmueble?.diaVencimientoPago) y += row(doc, marginX, y, contentW, "Vence el", `dia ${inmueble.diaVencimientoPago} c/mes`);
  y += row(doc, marginX, y, contentW, "Medio de pago", METODOS_LABEL[pago.metodo] || pago.metodo);
  y += row(doc, marginX, y, contentW, "Fecha de pago", fmtFecha(pago.fechaPago));
  y += row(doc, marginX, y, contentW, "Estado", ESTADOS_PAGO_LABEL[pago.estado] || pago.estado);
  y += 2;

  dashedLine(doc, marginX, y, W - marginX);
  y += 7;

  // ── Total ─────────────────────────────────────────────────────────────
  doc.setFont("courier", "bold");
  doc.setFontSize(9.5);
  doc.text("TOTAL", marginX, y);
  doc.setFontSize(15);
  doc.text(fmtMoney(pago.valor), W - marginX, y, { align: "right" });
  y += 6;

  doc.setFont("courier", "normal");
  doc.setFontSize(8.5);
  const sonLineas = doc.splitTextToSize(`Son: ${montoEnLetras(pago.valor)}`, contentW);
  doc.text(sonLineas, marginX, y);
  y += sonLineas.length * 4.2 + 3;

  dashedLine(doc, marginX, y, W - marginX);
  y += 6;

  // ── Notas ─────────────────────────────────────────────────────────────
  const notas = [];
  const atraso = diasAtraso(pago);
  if (atraso > 0 && inmueble?.diaVencimientoPago) {
    notas.push(`Pago recibido el ${fmtFecha(pago.fechaPago)}, ${atraso} dias despues del vencimiento (dia ${inmueble.diaVencimientoPago} c/mes). Se agradece cumplir el plazo en los proximos periodos.`);
  }
  if (!arrendador?.responsableIva) {
    notas.push("Arrendador persona natural no responsable de IVA (Art. 437, Par. 3, Estatuto Tributario).");
  }
  if (arrendador?.telefono) {
    notas.push(`Enviar comprobantes de pago al ${arrendador.telefono}.`);
  }
  if (arrendador?.cuentaBancaria) {
    notas.push(`Pagos a ${arrendador.cuentaBancaria}.`);
  }

  if (notas.length > 0) {
    checkPageBreak(14 + notas.length * 7);
    doc.setFont("courier", "bold");
    doc.setFontSize(9.5);
    doc.text("NOTAS", marginX, y);
    y += 5;

    doc.setFontSize(8.3);
    notas.forEach((texto, i) => {
      doc.setFont("courier", "normal");
      const lineas = doc.splitTextToSize(`${i + 1}. ${texto}`, contentW);
      checkPageBreak(lineas.length * 3.7 + 3);
      doc.text(lineas, marginX, y);
      y += lineas.length * 3.7 + 2;
    });
  }

  checkPageBreak(14);
  dashedLine(doc, marginX, y, W - marginX);
  y += 6;

  doc.setFont("courier", "normal");
  doc.setFontSize(8.5);
  doc.text("Conserve este comprobante", W / 2, y, { align: "center" });
  y += 4.5;
  doc.text("para sus registros", W / 2, y, { align: "center" });

  const blobUrl = doc.output("bloburl");
  window.open(blobUrl, "_blank");
}
