import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://cpzjaeurqeeljgsypwsh.supabase.co";
const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Las grabaciones de Twilio exigen Basic Auth (Account SID + Auth Token) —
// nunca se le puede dar al navegador un link directo. Este endpoint, ya
// autenticado como agente del CRM, hace de puente y sirve el mp3.
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

  const sid = req.query.sid;
  if (!sid) return res.status(400).json({ error: "Falta sid" });

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Recordings/${sid}.mp3`;
  const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
  const upstream = await fetch(twilioUrl, { headers: { Authorization: `Basic ${auth}` } });
  if (!upstream.ok) return res.status(upstream.status).json({ error: "No se pudo obtener la grabación" });

  res.setHeader("Content-Type", "audio/mpeg");
  const buf = Buffer.from(await upstream.arrayBuffer());
  return res.status(200).send(buf);
}
