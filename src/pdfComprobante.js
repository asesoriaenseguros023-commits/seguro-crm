import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { montoEnLetras } from "./numeroALetras.js";

const fmtMoney = (n) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);

const fmtFecha = (s) => {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};

const fmtFechaCorta = (s) => {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y.slice(2)}`;
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
    notas.push(`Pago recibido el ${fmtFechaCorta(pago.fechaPago)}, ${atraso} dias despues del vencimiento (dia ${inmueble.diaVencimientoPago} c/mes). Se agradece cumplir el plazo en los proximos periodos.`);
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

const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Próximo período a cobrar: si ya hubo pagos, el mes siguiente al último
// período cubierto; si nunca ha pagado, el mes en curso según el día de
// vencimiento del inmueble (mismo criterio que calcularEstadoPago).
export function siguientePeriodo(inmueble, pagos) {
  if (!inmueble?.diaVencimientoPago) return { inicio: "", fin: "" };
  const pagosInmueble = pagos.filter((p) => p.inmuebleId === inmueble.id && p.periodoFin);

  if (pagosInmueble.length > 0) {
    const ultimo = pagosInmueble.reduce((max, p) => (p.periodoFin > max.periodoFin ? p : max), pagosInmueble[0]);
    const finAnterior = new Date(ultimo.periodoFin + "T00:00:00");
    const inicio = new Date(finAnterior); inicio.setDate(inicio.getDate() + 1);
    const fin = new Date(finAnterior); fin.setMonth(fin.getMonth() + 1);
    return { inicio: toISO(inicio), fin: toISO(fin) };
  }

  const hoy = new Date();
  const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  const diaVence = Math.min(inmueble.diaVencimientoPago, ultimoDiaMes);
  const fin = new Date(hoy.getFullYear(), hoy.getMonth(), diaVence);
  const inicio = new Date(fin.getFullYear(), fin.getMonth() - 1, fin.getDate() + 1);
  return { inicio: toISO(inicio), fin: toISO(fin) };
}

// Períodos ya vencidos (fin <= hoy) para este arrendatario que no tienen
// ningún pago registrado que los cubra, caminando mes a mes desde su último
// pago. Si nunca ha pagado no hay forma de saber desde cuándo debe (no se
// guarda fecha de inicio de contrato), así que no se listan atrasos.
export function calcularPeriodosAdeudados(inmueble, arrendatarioId, pagos, hoy = new Date()) {
  if (!inmueble?.diaVencimientoPago) return [];
  const pagosArr = pagos.filter((p) => p.arrendatarioId === arrendatarioId && p.periodoFin);
  if (pagosArr.length === 0) return [];

  let cursorFin = pagosArr.reduce((max, p) => (p.periodoFin > max ? p.periodoFin : max), pagosArr[0].periodoFin);
  const periodos = [];

  while (true) {
    const cursorDate = new Date(cursorFin + "T00:00:00");
    const inicio = new Date(cursorDate); inicio.setDate(inicio.getDate() + 1);
    const fin = new Date(cursorDate); fin.setMonth(fin.getMonth() + 1);
    if (fin > hoy) break;

    const finISO = toISO(fin);
    const cubierto = pagosArr.some((p) => p.periodoFin === finISO);
    if (!cubierto) {
      periodos.push({ periodoInicio: toISO(inicio), periodoFin: finISO, valor: inmueble.valorCanonBase || 0 });
    }
    cursorFin = finISO;
  }
  return periodos;
}

// Cuenta de cobro: solicitud de pago del próximo período, antes de que el
// arrendatario pague (a diferencia del comprobante, que confirma un pago ya
// recibido). Formato de factura con tablas con bordes — visual distinto al
// comprobante a propósito, según el formato de referencia del usuario.
// `numero`, `periodo` y `fechaEmision` los calcula quien llama
// (Arrendatarios.jsx), porque también necesita persistirlos en
// `cuentas_cobro` antes de generar el PDF. `periodosAdeudados` (si hay) se
// recalcula siempre en vivo contra los pagos reales, para que la cuenta
// refleje la deuda real de hoy y no un saldo congelado.
export function generarCuentaCobro({ numero, arrendatario, inmueble, arrendador, periodo, valor, periodosAdeudados, fechaEmision }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const marginX = 15;
  const atrasados = periodosAdeudados || [];
  const totalAtrasado = atrasados.reduce((s, p) => s + (p.valor || 0), 0);
  const total = (valor || 0) + totalAtrasado;
  let y = 20;

  // ── Encabezado ────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(arrendador?.nombre || "—", marginX, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let yIzq = y + 6;
  if (arrendador?.documento) { doc.text(`C.C./NIT ${arrendador.documento}`, marginX, yIzq); yIzq += 5; }
  if (arrendador?.direccion) { doc.text(arrendador.direccion, marginX, yIzq); yIzq += 5; }
  if (arrendador?.telefono) { doc.text(`Tel. ${arrendador.telefono}`, marginX, yIzq); yIzq += 5; }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("CUENTA DE COBRO", W - marginX, y, { align: "right" });
  doc.setFontSize(20);
  doc.text(`No. ${numero}`, W - marginX, y + 9, { align: "right" });

  y = Math.max(yIzq, y + 14) + 6;

  // ── Datos del arrendatario / inmueble / fechas ──────────────────────────
  const grisClaro = [242, 243, 246];
  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    theme: "grid",
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2.3, textColor: [30, 30, 30] },
    body: [
      [
        { content: "ARRENDATARIO", styles: { fontStyle: "bold", fillColor: grisClaro } }, arrendatario?.nombre || "—",
        { content: "FECHA EMISION", styles: { fontStyle: "bold", fillColor: grisClaro } }, fmtFecha(fechaEmision),
      ],
      [
        { content: "C.C.", styles: { fontStyle: "bold", fillColor: grisClaro } }, arrendatario?.documento || "—",
        { content: "FECHA VENCIMIENTO", styles: { fontStyle: "bold", fillColor: grisClaro } }, fmtFecha(periodo.fin),
      ],
      [
        { content: "INMUEBLE", styles: { fontStyle: "bold", fillColor: grisClaro } },
        { content: [inmueble?.nombre, inmueble?.direccion].filter(Boolean).join(" - ") || "—", colSpan: 3 },
      ],
    ],
    columnStyles: { 0: { cellWidth: 32 }, 2: { cellWidth: 38 } },
  });
  y = doc.lastAutoTable.finalY + 6;

  // ── Detalle y total ──────────────────────────────────────────────────────
  // Cada período atrasado va como su propia fila (en rojo, para que se
  // distinga de un vistazo del cobro del período actual).
  const rojo = [180, 35, 35];
  const filasAtrasadas = atrasados.map((p) => [
    { content: "Canon arrendamiento (atrasado)", styles: { textColor: rojo } },
    { content: fmtPeriodo(p.periodoInicio, p.periodoFin), styles: { textColor: rojo } },
    { content: fmtMoney(p.valor), styles: { textColor: rojo } },
  ]);
  const filas = [...filasAtrasadas, ["Canon de arrendamiento", fmtPeriodo(periodo.inicio, periodo.fin), fmtMoney(valor)]];

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    theme: "grid",
    head: [["Descripcion", "Periodo", "Valor"]],
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [26, 86, 219], textColor: 255, fontStyle: "bold" },
    columnStyles: { 2: { halign: "right", cellWidth: 35 } },
    body: filas,
    foot: [[
      { content: "TOTAL A PAGAR", colSpan: 2, styles: { fontStyle: "bold", halign: "right" } },
      { content: fmtMoney(total), styles: { fontStyle: "bold" } },
    ]],
    footStyles: { fillColor: grisClaro, textColor: [20, 20, 20] },
  });
  y = doc.lastAutoTable.finalY + 8;

  // ── Valor en letras ────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Valor en letras:", marginX, y);
  doc.setFont("helvetica", "normal");
  const sonLineas = doc.splitTextToSize(montoEnLetras(total), W - marginX * 2 - 32);
  doc.text(sonLineas, marginX + 32, y);
  y += sonLineas.length * 4.5 + 9;

  // ── Notas ─────────────────────────────────────────────────────────────
  const notas = [
    "El arriendo se cobra mes adelante: este cobro corresponde al periodo que esta por comenzar, no al que ya paso.",
  ];
  if (!arrendador?.responsableIva) {
    notas.push("Arrendador persona natural no responsable de IVA (Art. 437, Par. 3, Estatuto Tributario).");
  }
  if (arrendador?.telefono) {
    notas.push(`Enviar comprobantes de pago al ${arrendador.telefono}.`);
  }
  if (arrendador?.cuentaBancaria) {
    notas.push(`Pagos a ${arrendador.cuentaBancaria}.`);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("NOTAS", marginX, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.3);
  notas.forEach((texto, i) => {
    const lineas = doc.splitTextToSize(`${i + 1}. ${texto}`, W - marginX * 2);
    doc.text(lineas, marginX, y);
    y += lineas.length * 4 + 2.5;
  });

  const blobUrl = doc.output("bloburl");
  window.open(blobUrl, "_blank");
}
