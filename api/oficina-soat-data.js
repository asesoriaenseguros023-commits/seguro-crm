import { createClient } from "@supabase/supabase-js";
import { sheetsClient, fetchSheetValues, toNumber, rowsFromMatrixGeneric } from "./_lib/googleSheets.js";

const SUPABASE_URL = "https://cpzjaeurqeeljgsypwsh.supabase.co";
const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Mismo origen que el artefacto "Oficina SOAT": una hoja con 3 pestañas
// (ventas, gastos, caja del negocio de venta de SOAT) — ver [[project-pulso-primas]]
// para el patrón general (mismo tipo de puerto que Pulso de Primas y
// Certificados Escolares).
const SHEET_ID = "11XaNCkjmRONiu5pPiJ8XP7bSFNIqrCLEBpvxNBVe9Uw";
const TAB_SOAT = "Histórico SOAT";
const TAB_GASTOS = "GASTOS";
const TAB_CAJA = "CAJA";

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

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Google Sheets (UNFORMATTED_VALUE) entrega las fechas como número serial
// de Excel/Sheets (días desde 1899-12-30) — misma conversión que usaba el
// artefacto original.
function excelSerialToISO(serial) {
  const n = Number(serial);
  if (!isFinite(n)) return null;
  const ms = Math.round((n - 25569) * 86400 * 1000);
  const d = new Date(ms);
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, dd = d.getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

// Misma clasificación de tipo de vehículo que el artefacto original.
function normalizarTipo(tRaw) {
  const t = (tRaw || "").toUpperCase();
  if (/MOTO|MTO|NOTO|CICLOMOTOR|CUATRIMOTO/.test(t)) return "Moto";
  if (/CAMPER|CAMIONETA|CAMONETA|CAMIOENTA|JEEP/.test(t)) return "Camioneta/Campero";
  if (/VOLQUETA/.test(t)) return "Otros";
  if (/TRACTOMULA|TRACTOCAMION|TRACTO/.test(t)) return "Otros";
  if (/CAMION|TURBO/.test(t)) return "Camión";
  if (/BUS|MICROBUS|INTERMUNICIPAL/.test(t)) return "Bus/Buseta";
  if (/TAXI/.test(t)) return "Taxi";
  if (/CARGA/.test(t)) return "Carga";
  if (/AUTO|CARRO|VEHICULO|PUBLICO/.test(t)) return "Automóvil";
  return "Otros";
}

// Mismo agrupador de categorías de gasto que el artefacto original.
const GASTOS_GRUPO = {
  "Salario": "Personal", "Transporte": "Personal", "Transporte Mincha": "Personal", "Comisiones": "Personal",
  "Luz": "Servicios", "Agua": "Servicios", "Internet": "Servicios", "Arriendo": "Servicios",
  "Aseo y Dulces": "Operativos", "Papel": "Operativos", "Tonner": "Operativos", "Refrigerios": "Operativos",
  "Adicionales": "Operativos", "Recibos Mincha": "Operativos",
  "Depreciaciones": "Depreciaciones",
};

function parseHistoricoSOAT(matrix, hoyIso) {
  const filas = rowsFromMatrixGeneric(matrix, {
    fecha: ["fecha"],
    nombre: ["nombre y apellidos"],
    tipo: ["tipo vehiculo"],
    valor: ["valor cobrado"],
  });
  const out = [];
  filas.forEach((r) => {
    if (r.fecha == null || r.fecha === "") return;
    const fecha = excelSerialToISO(r.fecha);
    if (!fecha || fecha > hoyIso) return;
    const nombre = String(r.nombre || "").trim().toUpperCase();
    if (!nombre) return;
    const tipoRaw = String(r.tipo || "").trim();
    out.push({ fecha, nombre, tipo: tipoRaw ? normalizarTipo(tipoRaw) : "Otros", valor: Math.round(toNumber(r.valor)) });
  });
  return out;
}

function parseGastos(matrix, hoyIso) {
  const filas = rowsFromMatrixGeneric(matrix, { fecha: ["fecha"], categoria: ["categoria"], monto: ["monto"] });
  const out = [];
  filas.forEach((r) => {
    if (r.fecha == null || r.fecha === "") return;
    const fecha = excelSerialToISO(r.fecha);
    if (!fecha || fecha > hoyIso) return;
    const categoria = String(r.categoria || "").trim() || "SIN CATEGORIA";
    const monto = Math.round(toNumber(r.monto));
    if (!monto) return;
    out.push({ fecha, categoria, grupo: GASTOS_GRUPO[categoria] || "Sin categoría", monto });
  });
  return out;
}

function parseCaja(matrix, hoyIso) {
  const filas = rowsFromMatrixGeneric(matrix, {
    fecha: ["fecha"], movimiento: ["movimiento"], monto: ["monto"], saldo: ["saldo"], detalle: ["detalle"],
  });
  const out = [];
  filas.forEach((r) => {
    if (r.fecha == null || r.fecha === "") return;
    const fecha = excelSerialToISO(r.fecha);
    if (!fecha || fecha > hoyIso) return;
    out.push({
      fecha,
      movimiento: String(r.movimiento || "").trim(),
      monto: Math.round(toNumber(r.monto)),
      saldo: Math.round(toNumber(r.saldo)),
      detalle: String(r.detalle || "").trim(),
    });
  });
  return out;
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

  const [rSoat, rGastos, rCaja] = await Promise.allSettled([
    fetchSheetValues(client, SHEET_ID, TAB_SOAT),
    fetchSheetValues(client, SHEET_ID, TAB_GASTOS),
    fetchSheetValues(client, SHEET_ID, TAB_CAJA),
  ]);

  const hoyIso = hoyISO();
  const soat = rSoat.status === "fulfilled" ? parseHistoricoSOAT(rSoat.value, hoyIso) : [];
  const gastos = rGastos.status === "fulfilled" ? parseGastos(rGastos.value, hoyIso) : [];
  const caja = rCaja.status === "fulfilled" ? parseCaja(rCaja.value, hoyIso) : [];

  res.status(200).json({
    generatedAt: new Date().toISOString(),
    soat, gastos, caja,
    errors: {
      soat: rSoat.status === "rejected" ? String(rSoat.reason?.message || rSoat.reason) : null,
      gastos: rGastos.status === "rejected" ? String(rGastos.reason?.message || rGastos.reason) : null,
      caja: rCaja.status === "rejected" ? String(rCaja.reason?.message || rCaja.reason) : null,
    },
  });
}
