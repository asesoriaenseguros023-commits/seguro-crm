import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";

const SUPABASE_URL = "https://cpzjaeurqeeljgsypwsh.supabase.co";
const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// A diferencia de requireAdmin en comerciales.js, aquí cualquier fila en
// "agentes" (sin importar el rol) puede pedir un token de llamada — todos
// los comerciales necesitan poder llamar, no solo Admin. Devuelve la fila
// completa (no un booleano) para usar su email como identity del token,
// resuelto en servidor a partir de la sesión validada — nunca confiando en
// un valor que mande el cliente.
async function requireAgente(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user?.email) return null;
  const { data: agente } = await supabase
    .from("agentes").select("id, nombre, email").eq("email", userData.user.email).maybeSingle();
  return agente || null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "GET") return res.status(405).json({ error: "Método no permitido" });

  const agente = await requireAgente(req);
  if (!agente) return res.status(401).json({ error: "No autorizado" });

  const { TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, TWILIO_TWIML_APP_SID } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_API_KEY_SID || !TWILIO_API_KEY_SECRET || !TWILIO_TWIML_APP_SID) {
    return res.status(500).json({ error: "Twilio no está configurado (faltan variables de entorno)" });
  }

  const identity = agente.email.replace(/[^a-zA-Z0-9_-]/g, "_");

  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;
  const accessToken = new AccessToken(TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, {
    identity,
    ttl: 3600,
  });
  accessToken.addGrant(new VoiceGrant({ outgoingApplicationSid: TWILIO_TWIML_APP_SID }));

  return res.status(200).json({ token: accessToken.toJwt(), identity });
}
