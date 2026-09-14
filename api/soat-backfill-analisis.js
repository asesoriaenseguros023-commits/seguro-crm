import { createClient } from "@supabase/supabase-js";
import { analizarGrabacion } from "./_lib/analizarLlamada.js";

const SUPABASE_URL = "https://cpzjaeurqeeljgsypwsh.supabase.co";
const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Backfill único: analiza grabaciones de soat_llamadas que quedaron de antes
// de que existiera el análisis con IA (grabacion_sid presente, analizado_en
// vacío). Procesa un lote por invocación (?limit=, default 5) para no
// exceder el tiempo máximo de la función — se llama repetido hasta que
// "restantes" llegue a 0. Mismo patrón de auth que twilio-recording-audio.js:
// solo un agente autenticado del CRM puede dispararlo (dispara llamadas
// pagas a OpenAI/Anthropic).
export const config = { maxDuration: 60 };

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

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Método no permitido" });
  if (!(await requireAgente(req))) return res.status(401).json({ error: "No autorizado" });

  const limit = Math.min(Number(req.query.limit) || 5, 20);
  const { data: pendientes, error } = await supabase.from("soat_llamadas")
    .select("call_sid, grabacion_sid")
    .not("grabacion_sid", "is", null)
    .is("analizado_en", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) return res.status(500).json({ error: error.message });

  for (const row of pendientes) {
    await analizarGrabacion({ recordingSid: row.grabacion_sid, callSid: row.call_sid, supabase });
  }

  const { count: restantes } = await supabase.from("soat_llamadas")
    .select("id", { count: "exact", head: true })
    .not("grabacion_sid", "is", null)
    .is("analizado_en", null);

  return res.status(200).json({ procesados: pendientes.length, restantes: restantes ?? 0 });
}
