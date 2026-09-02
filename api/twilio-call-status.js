import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";

const SUPABASE_URL = "https://cpzjaeurqeeljgsypwsh.supabase.co";
const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Twilio llama esto al terminar el tramo marcado por <Dial> (contestada,
// ocupado, no contestó, falló). Sin sesión de usuario — la única
// protección es la firma de Twilio, igual que en twilio-voice.js.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Método no permitido");

  const signature = req.headers["x-twilio-signature"];
  const url = `https://${req.headers["x-forwarded-host"] || req.headers.host}${req.url}`;
  const valid = twilio.validateRequest(process.env.TWILIO_AUTH_TOKEN, signature, url, req.body || {});
  if (!valid) return res.status(403).send("Firma inválida");

  const clienteId = req.query.clienteId;
  // CallSid (no DialCallSid) es el de la llamada padre (el tramo del
  // navegador) — es el mismo que reporta luego recordingStatusCallback,
  // porque la grabación se configuró a nivel de <Dial>, no del hijo.
  const callSid = req.body?.CallSid;
  if (clienteId && callSid) {
    await supabase.from("soat_llamadas").upsert({
      cliente_id: clienteId,
      call_sid: callSid,
      estado: req.body?.DialCallStatus || null,
      duracion_seg: req.body?.DialCallDuration ? Number(req.body.DialCallDuration) : null,
    }, { onConflict: "call_sid" });
  }

  res.setHeader("Content-Type", "text/xml");
  return res.status(200).send("<Response></Response>");
}
