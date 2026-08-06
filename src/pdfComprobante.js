import jsPDF from "jspdf";

const fmtMoney = (n) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);

const fmtFecha = (s) => {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};

export const METODOS_LABEL = { efectivo: "Efectivo", transferencia: "Transferencia", pse: "PSE" };
export const ESTADOS_PAGO_LABEL = { pagado: "Pagado", parcial: "Pago parcial", pendiente: "Pendiente" };

// Genera el PDF en memoria y lo abre en una pestaña nueva con el visor nativo
// del navegador (que ya trae su propio botón de descarga/impresión).
export function generarComprobante({ pago, inmueble, arrendatario, arrendador }) {
  const doc = new jsPDF({ unit: "mm", format: "a5" });
  const W = doc.internal.pageSize.getWidth();
  const marginX = 14;
  let y = 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("COMPROBANTE DE PAGO", W / 2, y, { align: "center" });
  y += 12;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Arrendador", marginX, y);
  doc.setFont("helvetica", "normal");
  doc.text(arrendador?.nombre || "—", marginX + 28, y);
  y += 6;
  if (arrendador?.documento) {
    doc.setFont("helvetica", "bold");
    doc.text("Documento", marginX, y);
    doc.setFont("helvetica", "normal");
    doc.text(arrendador.documento, marginX + 28, y);
    y += 6;
  }
  y += 4;

  doc.setFont("helvetica", "bold");
  doc.text("Arrendatario", marginX, y);
  doc.setFont("helvetica", "normal");
  doc.text(arrendatario?.nombre || "—", marginX + 28, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Inmueble", marginX, y);
  doc.setFont("helvetica", "normal");
  const inmuebleTxt = `${inmueble?.nombre || "—"}${inmueble?.direccion ? " - " + inmueble.direccion : ""}`;
  doc.text(doc.splitTextToSize(inmuebleTxt, W - marginX * 2 - 28), marginX + 28, y);
  y += 12;

  // Caja de detalle del pago
  const boxX = marginX, boxW = W - marginX * 2, rowH = 9;
  const boxY = y;
  const filas = [
    ["Valor", fmtMoney(pago.valor)],
    ["Período", `${fmtFecha(pago.periodoInicio)} - ${fmtFecha(pago.periodoFin)}`],
    ["Medio de pago", METODOS_LABEL[pago.metodo] || pago.metodo],
    ["Fecha de pago", fmtFecha(pago.fechaPago)],
    ["Estado", ESTADOS_PAGO_LABEL[pago.estado] || pago.estado],
  ];
  doc.setDrawColor(26, 86, 219);
  doc.rect(boxX, boxY, boxW, rowH * filas.length);
  filas.forEach(([label, value], i) => {
    const rowY = boxY + rowH * i;
    if (i > 0) doc.line(boxX, rowY, boxX + boxW, rowY);
    doc.setFont("helvetica", "bold");
    doc.text(label, boxX + 4, rowY + rowH / 2 + 3);
    doc.setFont("helvetica", "normal");
    doc.text(String(value), boxX + boxW - 4, rowY + rowH / 2 + 3, { align: "right" });
  });
  y = boxY + rowH * filas.length + 24;

  doc.setLineWidth(0.2);
  doc.line(boxX, y, boxX + 70, y);
  doc.setFontSize(9);
  doc.text("Firma Arrendador", boxX, y + 5);

  const blobUrl = doc.output("bloburl");
  window.open(blobUrl, "_blank");
}
