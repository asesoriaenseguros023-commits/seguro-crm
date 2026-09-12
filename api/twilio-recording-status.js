import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";
import { analizarGrabacion } from "./_lib/analizarLlamada.js";

const SUPABASE_URL = "https://cpzjaeurqeeljgsypwsh.supabase.co";
const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Vercel: la transcripción + análisis con Claude puede tardar más que el
// límite por defecto — esto es un webhook de fondo de Twilio (no bloquea la
// llamada real), así que unos segundos extra de respuesta no importan.
export const config = { maxDuration: 60 };

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
    const { data: llamada } = await supabase.from("soat_llamadas")
      .select("estado").eq("call_sid", callSid).maybeSingle();
    if (llamada?.estado === "buzon") {
      // Grabación del saludo del buzón / aire muerto: no sirve de nada.
      // Se borra de Twilio y no se guarda el SID.
      try {
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        await client.recordings(recordingSid).remove();
      } catch {
        // Ya pudo haberse borrado o no existir: sin problema.
      }
    } else {
      await supabase.from("soat_llamadas").update({ grabacion_sid: recordingSid }).eq("call_sid", callSid);
      // Pedido del usuario: analizar automáticamente TODA llamada grabada
      // (transcripción + Claude: persona real vs. buzón, resumen, calidad
      // del agente). Se espera a que termine antes de responder — si no,
      // Vercel puede congelar la función a medias y perder el resultado.
      await analizarGrabacion({ recordingSid, callSid, supabase });
    }
  }

  return res.status(200).end();
}
