import { createClient } from "@supabase/supabase-js";
import { sheetsClient, fetchSheetValues, toNumber } from "./_lib/googleSheets.js";

const SUPABASE_URL = "https://cpzjaeurqeeljgsypwsh.supabase.co";
const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Mismas hojas que lee el artefacto "Pulso de Primas" — ver [[project-pulso-primas]].
const FILE_2026 = "1JYZVhq_uefnQYDPgcbfqBs9E2lpZGCSdLUPVMRvYjnw";
const TAB_2026 = "Base 2026";
const FILE_2025 = "192-u8FiQmoj7B-XCVvwbH40h1hYun6bl4lDYKD_bfS4";
const TAB_2025 = "Base 2025";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

async function requireAgente(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return false;
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user?.email) return false;
  const { data: agente } = await supabase
    .from("agentes").select("id").eq("email", userData.user.email).maybeSingle();
  return !!agente;
}

function normMesIdx(s) {
  if (!s) return null;
  const up = String(s).trim().toUpperCase();
  const i = MESES.findIndex((m) => m.toUpperCase() === up);
  return i === -1 ? null : i;
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

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Método no permitido" });
  if (!(await requireAgente(req))) return res.status(401).json({ error: "No autorizado" });

  res.setHeader("Cache-Control", "no-store");

  let client;
  try {
    client = sheetsClient();
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  const [r2026, r2025] = await Promise.allSettled([
    fetchSheetValues(client, FILE_2026, TAB_2026),
    fetchSheetValues(client, FILE_2025, TAB_2025),
  ]);

  const rows2026 = r2026.status === "fulfilled" ? rowsFromMatrix(r2026.value) : [];
  const rows2025 = r2025.status === "fulfilled" ? rowsFromMatrix(r2025.value) : [];

  unificarRamo(rows2026, rows2025);
  normalizarTomadores(rows2026, rows2025);

  res.status(200).json({
    generatedAt: new Date().toISOString(),
    rows2026,
    rows2025,
    errors: {
      base2026: r2026.status === "rejected" ? String(r2026.reason?.message || r2026.reason) : null,
      base2025: r2025.status === "rejected" ? String(r2025.reason?.message || r2025.reason) : null,
    },
  });
}
