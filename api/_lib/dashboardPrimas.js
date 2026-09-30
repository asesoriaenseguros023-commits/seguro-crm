import { fetchSheetValues, toNumber } from "./googleSheets.js";

// Mismas hojas que lee el artefacto "Pulso de Primas" — ver [[project-pulso-primas]].
const FILE_2026 = "1JYZVhq_uefnQYDPgcbfqBs9E2lpZGCSdLUPVMRvYjnw";
const TAB_2026 = "Base 2026";
const FILE_2025 = "192-u8FiQmoj7B-XCVvwbH40h1hYun6bl4lDYKD_bfS4";
const TAB_2025 = "Base 2025";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function normMesIdx(s) {
  if (!s) return null;
  const up = String(s).trim().toUpperCase();
  const i = MESES.findIndex((m) => m.toUpperCase() === up);
  return i === -1 ? null : i;
}

// La columna Fecha en ambas hojas mezcla celdas de tipo fecha real (Sheets
// las devuelve como numero serial con valueRenderOption=UNFORMATTED_VALUE —
// dias desde 1899-12-30, mismo epoch que Excel) con celdas cargadas a mano
// como texto plano ("03-09-2026"). Confirmado con datos reales 2026-09-30:
// el serial 45705 = 17/02/2025 y 46227 = 24/07/2026, ambos coincidiendo
// exacto con las fechas ya conocidas de esas polizas — sin esto, el modal de
// detalle de Pulso de Primas mostraba el numero crudo (ej. "45705") en vez
// de una fecha legible.
function formatFechaCelda(v) {
  if (v == null || v === "") return "";
  if (typeof v === "number") {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `${dd}-${mm}-${d.getUTCFullYear()}`;
  }
  return String(v).trim();
}

function rowsFromMatrix(matrix) {
  if (!matrix.length) return [];
  const header = matrix[0].map((h) => String(h || "").trim().toLowerCase());
  const idx = {};
  header.forEach((h, i) => { idx[h] = i; });
  function get(row, names) {
    for (const n of names) {
      const col = idx[n];
      if (col != null && row[col] != null) return row[col];
    }
    return "";
  }
  return matrix.slice(1).map((row) => ({
    poliza: String(get(row, ["poliza"]) || "").trim(),
    tomador: String(get(row, ["tomador"]) || "").trim(),
    fecha: formatFechaCelda(get(row, ["fecha"])),
    prima: toNumber(get(row, ["prima"])),
    mesIdx: normMesIdx(get(row, ["mes"])),
    iva: toNumber(get(row, ["iva"])),
    gastos: toNumber(get(row, ["gastos"])),
    total: toNumber(get(row, ["total pago"])),
    compania: String(get(row, ["compañia"]) || get(row, ["compania"]) || "").trim(),
    ramo: String(get(row, ["ramo"]) || "").trim(),
  })).filter((r) => r.poliza);
}

// Mismas correcciones de datos que el artefacto "Pulso de Primas" (mantener
// ambas copias en sync si se agrega un caso nuevo — ver [[project-pulso-primas]]).
const RAMO_ALIAS = {
  "responsabilidad civil": "Cumplimiento",
  "cumplimiento": "Cumplimiento",
  "salida": "Eventos",
  "eventos": "Eventos",
};

function unificarRamo(rows2026, rows2025) {
  const canon = {};
  [...rows2026, ...rows2025].forEach((r) => {
    if (!r.ramo) return;
    const key = r.ramo.trim().toLowerCase();
    if (RAMO_ALIAS[key]) { canon[key] = RAMO_ALIAS[key]; return; }
    if (!canon[key]) canon[key] = r.ramo.trim();
  });
  rows2026.forEach((r) => { if (r.ramo) r.ramo = canon[r.ramo.trim().toLowerCase()]; });
  rows2025.forEach((r) => { if (r.ramo) r.ramo = canon[r.ramo.trim().toLowerCase()]; });
}

const TOMADOR_ALIAS = {
  "institucion educativa departamental san juan": "INSTITUCION EDUCATIVA DEPARTAMENTAL SAN JUAN BOSCO",
  "neidy forero bejarano": "NEYDY DANELLY FORERO BEJARANO",
  "fredy forero": "FREDY FRANCISCO FORERO BEJARANO",
  // Pedido explícito 2026-09-30: "FORESTAR CIMITARRA" (typo, así aparece
  // SIEMPRE en Base 2025 — Mundial, Previsora y HDI) es la misma empresa que
  // "FORESTAL CIMITARRA SA" en Base 2026. Confirmado contra las 7 filas
  // reales de 2025 antes de aplicar el alias.
  "forestar cimitarra": "FORESTAL CIMITARRA SA",
  // Revision de pares de nombres 2026-09-30 (el usuario confirmo estos 3, y
  // descarto el resto de candidatos por ser personas/entidades distintas —
  // ver [[project-pulso-primas]]): "NIDIA"/"NIDYA" y "MELISA"/"MELISSA" son
  // errores de digitacion en 2025, y la Parroquia difiere solo por la tilde
  // en la Ñ (2025 SI la trae, el OCR de 2026 no). Canonico = como lo escribe
  // el pipeline de 2026 en los 3 casos.
  "torres lozano nidia": "TORRES LOZANO NIDYA SOFIA",
  "parroquia nuestra señora de los dolores": "PARROQUIA NUESTRA SENORA DE LOS DOLORES",
  "monica melisa castellanos": "CASTELLANOS FLORIAN MONICA MELISSA",
};

function normalizarTomadores(rows2026, rows2025) {
  [...rows2026, ...rows2025].forEach((r) => {
    if (!r.tomador) return;
    if (r.tomador.indexOf(",") !== -1) {
      r.tomador = r.tomador.replace(/,\s*/g, " ").replace(/\s+/g, " ").trim();
    }
    const key = r.tomador.trim().toLowerCase();
    if (TOMADOR_ALIAS[key]) r.tomador = TOMADOR_ALIAS[key];
  });
}

export async function obtenerPrimas(client) {
  const [r2026, r2025] = await Promise.allSettled([
    fetchSheetValues(client, FILE_2026, TAB_2026),
    fetchSheetValues(client, FILE_2025, TAB_2025),
  ]);

  const rows2026 = r2026.status === "fulfilled" ? rowsFromMatrix(r2026.value) : [];
  const rows2025 = r2025.status === "fulfilled" ? rowsFromMatrix(r2025.value) : [];

  unificarRamo(rows2026, rows2025);
  normalizarTomadores(rows2026, rows2025);

  return {
    generatedAt: new Date().toISOString(),
    rows2026,
    rows2025,
    errors: {
      base2026: r2026.status === "rejected" ? String(r2026.reason?.message || r2026.reason) : null,
      base2025: r2025.status === "rejected" ? String(r2025.reason?.message || r2025.reason) : null,
    },
  };
}
