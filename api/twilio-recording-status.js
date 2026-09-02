import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";

const SUPABASE_URL = "https://cpzjaeurqeeljgsypwsh.supabase.co";
const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Twilio llama esto cuando la grabación del <Dial> ya está lista. Guarda
// solo el SID (no la URL directa de Twilio, que exige Basic Auth) — el
// audio se sirve después a través de twilio-recording-audio.js.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Método no permitido");

  const signature = req.headers["x-twilio-signature"];
  const url = `https://${req.headers["x-forwarded-host"] || req.headers.host}${req.url}`;
  const valid = twilio.validateRequest(process.env.TWILIO_AUTH_TOKEN, signature, url, req.body || {});
  if (!valid) return res.status(403).send("Firma inválida");

  const callSid = req.body?.CallSid;
  const recordingSid = req.body?.RecordingSid;
  if (callSid && recordingSid) {
    await supabase.from("soat_llamadas").update({ grabacion_sid: recordingSid }).eq("call_sid", callSid);
  }

  return res.status(200).end();
}
