import { createClient } from "@supabase/supabase-js";
import { sheetsClient } from "./_lib/googleSheets.js";
import { obtenerPrimas } from "./_lib/dashboardPrimas.js";
import { obtenerCertificados } from "./_lib/dashboardCertificados.js";
import { obtenerOficinaSoat } from "./_lib/dashboardOficinaSoat.js";

// Un solo endpoint para los 3 dashboards que leen Google Sheets (Pulso de
// Primas, Certificados Escolares, Oficina SOAT), seleccionado por
// ?tipo=primas|certificados|oficina-soat. Antes eran 3 archivos separados
// bajo api/ (primas-data.js, certificados-data.js, oficina-soat-data.js) —
// se unieron el 2026-09-29 porque el plan Hobby de Vercel tope a 12
// funciones serverless por deployment y agregar Oficina SOAT como cuarto
// archivo lo pasaba a 13, tumbando el deploy (error
// exceeded_serverless_functions_per_deployment). La lógica de cada uno vive
// intacta en api/_lib/dashboard*.js — este archivo solo autentica y
// despacha. Ver [[project-seguro-crm]].
const SUPABASE_URL = "https://cpzjaeurqeeljgsypwsh.supabase.co";
const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

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

const OBTENER_POR_TIPO = {
  "primas": obtenerPrimas,
  "certificados": obtenerCertificados,
  "oficina-soat": obtenerOficinaSoat,
};

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Método no permitido" });
  if (!(await requireAgente(req))) return res.status(401).json({ error: "No autorizado" });

  const tipo = req.query.tipo;
  const obtener = OBTENER_POR_TIPO[tipo];
  if (!obtener) return res.status(400).json({ error: `Parámetro "tipo" inválido o faltante (recibí "${tipo}").` });

  res.setHeader("Cache-Control", "no-store");

  let client;
  try {
    client = sheetsClient();
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  try {
    const data = await obtener(client);
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
}
