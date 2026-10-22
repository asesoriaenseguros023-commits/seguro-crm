import { fetchSheetValues, toNumber, rowsFromMatrixGeneric } from "./googleSheets.js";

// Mismo origen que el artefacto "Control de Certificados Escolares": una
// sola hoja ("Control Ejecutivo Colegios"), dos pestañas ya calculadas por
// consolidarDatos() en Apps Script — esto no recalcula nada nuevo, solo lee
// lo que ese script ya dejó listo.
const SHEET_ID = "1da-824I5POoccPLE9BGeFnzacv5oPDMQ3Z5NbuMZYyQ";
const TAB_RESUMEN = "ResumenVentas";
const TAB_CERTIFICADOS = "Certificados";
const TAB_ESTUDIANTES = "Estudiantes";
// Seguros 2026 (la misma hoja que lee Pulso de Primas): se usa para comparar
// los certificados de cada colegio contra lo que quedó registrado como póliza.
const SEGUROS_2026_ID = "1JYZVhq_uefnQYDPgcbfqBs9E2lpZGCSdLUPVMRvYjnw";
const TAB_BASE_2026 = "Base 2026";

function parseResumen(matrix) {
  const filas = rowsFromMatrixGeneric(matrix, {
    colegio: ["colegio"],
    aseguradora: ["aseguradora"],
    totalBaseFilas: ["totalbasefilas"],
    anulados: ["anulados"],
    estudiantesAsegurados: ["estudiantesasegurados"],
    valorVendido: ["valorvendido"],
    duplicados: ["duplicados"],
    valorDuplicados: ["valorduplicados"],
    fechaCarga: ["fechacarga"],
  }).filter((r) => r.colegio != null && String(r.colegio).trim() !== "");

  return filas.map((r) => {
    const totalBaseFilas = Math.trunc(toNumber(r.totalBaseFilas));
    const anulados = Math.trunc(toNumber(r.anulados));
    const estudiantesAsegurados = Math.trunc(toNumber(r.estudiantesAsegurados));
    const valorVendido = toNumber(r.valorVendido);
    const polizasVendidas = Math.max(0, totalBaseFilas - anulados);
    return {
      colegio: String(r.colegio).trim(),
      aseguradora: r.aseguradora || "",
      totalBaseFilas, anulados, estudiantesAsegurados, valorVendido,
      duplicados: Math.trunc(toNumber(r.duplicados)),
      valorDuplicados: toNumber(r.valorDuplicados),
      fechaCarga: r.fechaCarga || "",
      polizasVendidas,
      // Tarifa implícita: el sheet no expone una tarifa explícita por
      // colegio todavía, así que se deriva del valor vendido histórico
      // (mismo criterio que usaba el artefacto original).
      tarifa: estudiantesAsegurados > 0 ? valorVendido / estudiantesAsegurados : 0,
    };
  });
}

function parseCertificados(matrix) {
  const filas = rowsFromMatrixGeneric(matrix, {
    colegio: ["colegio"],
    aseguradora: ["aseguradora"],
    certificado: ["certificado"],
    cantidadEstudiantes: ["cantidadestudiantes"],
    montoCertificado: ["montocertificado"],
    estadoPago: ["estadopago"],
    observaciones: ["observaciones"],
    archivo: ["archivo"],
  }).filter((r) => r.colegio != null && String(r.colegio).trim() !== "");

  return filas.map((r) => ({
    colegio: String(r.colegio).trim(),
    aseguradora: r.aseguradora || "",
    certificado: r.certificado != null ? String(r.certificado) : "",
    cantidadEstudiantes: Math.trunc(toNumber(r.cantidadEstudiantes)),
    montoCertificado: toNumber(r.montoCertificado),
    estadoPago: String(r.estadoPago || "SIN ESTADO").trim().toUpperCase(),
    observaciones: String(r.observaciones || "").trim(),
    // SI / NO si el certificado ya está archivado. Vacío = la hoja maestra
    // todavía no trae la columna (falta actualizar consolidarDatos()).
    archivo: String(r.archivo || "").trim().toUpperCase(),
  }));
}

// Estudiantes de la base de cada colegio. Solo se devuelven los que NO tienen
// certificado asignado (y no están anulados); del resto basta el conteo.
function parseEstudiantes(matrix) {
  const filas = rowsFromMatrixGeneric(matrix, {
    colegio: ["colegio"], certificado: ["certificado"], documento: ["documento"],
    nombre: ["nombrecompleto"], duplicado: ["duplicado"],
  }).filter((r) => r.colegio != null && String(r.colegio).trim() !== "");

  const porColegio = {};
  const sinCertificado = [];
  filas.forEach((r) => {
    if (String(r.duplicado || "").toUpperCase() === "ANULADO") return;
    const colegio = String(r.colegio).trim();
    porColegio[colegio] = (porColegio[colegio] || 0) + 1;
    if (!String(r.certificado ?? "").trim()) {
      sinCertificado.push({ colegio, documento: String(r.documento ?? "").trim(), nombre: String(r.nombre || "").trim() });
    }
  });
  return { porColegio, sinCertificado };
}

// Solo las pólizas de Accidentes Escolares de Seguros 2026.
function parseBase2026(matrix) {
  const filas = rowsFromMatrixGeneric(matrix, {
    poliza: ["poliza"], tomador: ["tomador"], prima: ["prima"], compania: ["compañia", "compania"], ramo: ["ramo"],
  });
  return filas
    .filter((r) => String(r.ramo || "").toUpperCase().includes("ESCOLAR") && r.poliza != null && String(r.poliza).trim() !== "")
    .map((r) => ({
      poliza: String(r.poliza).trim(),
      tomador: String(r.tomador || "").trim(),
      prima: Math.round(toNumber(r.prima)),
      compania: String(r.compania || "").trim(),
    }));
}

export async function obtenerCertificados(client) {
  const [rResumen, rCert, rEst, rBase] = await Promise.allSettled([
    fetchSheetValues(client, SHEET_ID, TAB_RESUMEN),
    fetchSheetValues(client, SHEET_ID, TAB_CERTIFICADOS),
    fetchSheetValues(client, SHEET_ID, TAB_ESTUDIANTES),
    fetchSheetValues(client, SEGUROS_2026_ID, TAB_BASE_2026),
  ]);

  const resumenVentas = rResumen.status === "fulfilled" ? parseResumen(rResumen.value) : [];
  const certificados = rCert.status === "fulfilled" ? parseCertificados(rCert.value) : [];
  const estudiantes = rEst.status === "fulfilled" ? parseEstudiantes(rEst.value) : { porColegio: {}, sinCertificado: [] };
  const base2026 = rBase.status === "fulfilled" ? parseBase2026(rBase.value) : [];

  return {
    generatedAt: new Date().toISOString(),
    resumenVentas,
    certificados,
    estudiantesPorColegio: estudiantes.porColegio,
    estudiantesSinCertificado: estudiantes.sinCertificado,
    base2026,
    errors: {
      resumen: rResumen.status === "rejected" ? String(rResumen.reason?.message || rResumen.reason) : null,
      certificados: rCert.status === "rejected" ? String(rCert.reason?.message || rCert.reason) : null,
      estudiantes: rEst.status === "rejected" ? String(rEst.reason?.message || rEst.reason) : null,
      base2026: rBase.status === "rejected" ? String(rBase.reason?.message || rBase.reason) : null,
    },
  };
}
