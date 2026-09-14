import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const fmtFechaHora = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const PERSONA_LABEL = { si: "Persona real", no: "No era persona", incierto: "Incierto" };

// Reporte de análisis IA de llamadas (Seguimiento SOAT): estadísticas del
// periodo, comentario consolidado de Claude, y detalle por llamada. Mismo
// estilo autoTable/helvetica que generarCuentaCobro en pdfComprobante.js.
// Construye el documento (compartido entre "abrir en pestaña" y "enviar por
// correo" — no se genera dos veces con lógica separada).
function construirInformeIA({ desde, hasta, estadisticas, consolidado, llamadas }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const marginX = 15;
  const contentW = W - marginX * 2;
  let y = 20;

  const checkPageBreak = (extra = 20) => {
    if (y + extra > H - 15) { doc.addPage(); y = 20; }
  };

  // ── Encabezado ────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Reporte IA — Seguimiento SOAT", marginX, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Periodo: ${desde} al ${hasta}  ·  Generado: ${new Date().toLocaleString("es-CO")}`, marginX, y);
  y += 8;

  // ── Estadísticas ─────────────────────────────────────────────────────
  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    theme: "grid",
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2.5, halign: "center" },
    head: [["Total", "Persona real", "No era persona", "Incierto", "Cortesía buena", "Cortesía regular", "Cortesía mala"]],
    headStyles: { fillColor: [26, 86, 219], textColor: 255, fontStyle: "bold" },
    body: [[
      estadisticas.total, estadisticas.personaReal, estadisticas.noPersona, estadisticas.incierto,
      estadisticas.cortesiaBuena, estadisticas.cortesiaRegular, estadisticas.cortesiaMala,
    ]],
  });
  y = doc.lastAutoTable.finalY + 8;

  // ── Comentario consolidado ──────────────────────────────────────────
  if (consolidado) {
    checkPageBreak(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Comentario consolidado", marginX, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    const resumenLineas = doc.splitTextToSize(consolidado.resumen_ejecutivo || "", contentW);
    checkPageBreak(resumenLineas.length * 4.5 + 4);
    doc.text(resumenLineas, marginX, y);
    y += resumenLineas.length * 4.5 + 5;

    if (consolidado.hallazgos?.length) {
      checkPageBreak(10);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.text("Hallazgos", marginX, y);
      y += 5.5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      consolidado.hallazgos.forEach((h) => {
        const lineas = doc.splitTextToSize(`• ${h}`, contentW);
        checkPageBreak(lineas.length * 4.5 + 2);
        doc.text(lineas, marginX, y);
        y += lineas.length * 4.5 + 2;
      });
      y += 3;
    }

    if (consolidado.recomendaciones?.length) {
      checkPageBreak(10);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.text("Recomendaciones", marginX, y);
      y += 5.5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      consolidado.recomendaciones.forEach((r) => {
        const lineas = doc.splitTextToSize(`• ${r}`, contentW);
        checkPageBreak(lineas.length * 4.5 + 2);
        doc.text(lineas, marginX, y);
        y += lineas.length * 4.5 + 2;
      });
      y += 3;
    }
  }

  // ── Detalle por llamada ──────────────────────────────────────────────
  checkPageBreak(14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Detalle por llamada", marginX, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    theme: "striped",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 2, valign: "top" },
    headStyles: { fillColor: [26, 86, 219], textColor: 255, fontStyle: "bold" },
    head: [["Cliente", "Fecha", "¿Persona?", "Resumen", "Oportunidades perdidas / Observación"]],
    columnStyles: {
      0: { cellWidth: 26 }, 1: { cellWidth: 22 }, 2: { cellWidth: 20 },
      3: { cellWidth: 45 }, 4: { cellWidth: "auto" },
    },
    body: llamadas.map(l => [
      l.cliente,
      fmtFechaHora(l.fecha),
      PERSONA_LABEL[l.persona_real] || l.persona_real,
      l.resumen,
      [...(l.oportunidades_perdidas || []), l.observaciones].filter(Boolean).join(" · "),
    ]),
  });

  return doc;
}

export function generarInformeIA(datos) {
  const doc = construirInformeIA(datos);
  const blobUrl = doc.output("bloburl");
  window.open(blobUrl, "_blank");
}

// Para adjuntar por correo: el mismo PDF, como base64 puro (sin el prefijo
// "data:application/pdf;base64,") — así lo pide el API de Resend.
export function informeIABase64(datos) {
  const doc = construirInformeIA(datos);
  const dataUri = doc.output("datauristring");
  return dataUri.split(",")[1];
}
