import { createClient } from "@supabase/supabase-js";
import { sheetsClient, fetchSheetValues, toNumber, rowsFromMatrixGeneric } from "./_lib/googleSheets.js";

const SUPABASE_URL = "https://cpzjaeurqeeljgsypwsh.supabase.co";
const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Mismo origen que el artefacto "Control de Certificados Escolares": una
// sola hoja ("Control Ejecutivo Colegios"), dos pestañas ya calculadas por
// consolidarDatos() en Apps Script — este endpoint no recalcula nada nuevo,
// solo lee lo que ese script ya dejó listo.
const SHEET_ID = "1da-824I5POoccPLE9BGeFnzacv5oPDMQ3Z5NbuMZYyQ";
const TAB_RESUMEN = "ResumenVentas";
const TAB_CERTIFICADOS = "Certificados";

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
  }).filter((r) => r.colegio != null && String(r.colegio).trim() !== "");

  return filas.map((r) => ({
    colegio: String(r.colegio).trim(),
    aseguradora: r.aseguradora || "",
    certificado: r.certificado != null ? String(r.certificado) : "",
    cantidadEstudiantes: Math.trunc(toNumber(r.cantidadEstudiantes)),
    montoCertificado: toNumber(r.montoCertificado),
    estadoPago: String(r.estadoPago || "SIN ESTADO").trim().toUpperCase(),
  }));
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

  const [rResumen, rCert] = await Promise.allSettled([
    fetchSheetValues(client, SHEET_ID, TAB_RESUMEN),
    fetchSheetValues(client, SHEET_ID, TAB_CERTIFICADOS),
  ]);

  const resumenVentas = rResumen.status === "fulfilled" ? parseResumen(rResumen.value) : [];
  const certificados = rCert.status === "fulfilled" ? parseCertificados(rCert.value) : [];

  res.status(200).json({
    generatedAt: new Date().toISOString(),
    resumenVentas,
    certificados,
    errors: {
      resumen: rResumen.status === "rejected" ? String(rResumen.reason?.message || rResumen.reason) : null,
      certificados: rCert.status === "rejected" ? String(rCert.reason?.message || rCert.reason) : null,
    },
  });
}
