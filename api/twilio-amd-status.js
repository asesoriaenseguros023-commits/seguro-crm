import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";

const SUPABASE_URL = "https://cpzjaeurqeeljgsypwsh.supabase.co";
const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Twilio llama esto con el resultado de Answering Machine Detection sobre el
// tramo marcado en twilio-voice.js (<Number machineDetection="Enable">).
// AnsweredBy puede ser: human | machine_start | fax | unknown.
//
// Todo lo que no sea "human" se trata como "no contestó una persona"
// (buzón, celular apagado, silencio): se marca la llamada como buzón y —
// salvo TWILIO_AMD="detect-only" — se cuelga para que el agente no quede
// escuchando aire muerto ni se acumule grabación basura.
//
// Sin sesión de usuario — la única protección es la firma de Twilio, igual
// que en twilio-voice.js / twilio-call-status.js.
const NO_HUMANO = new Set(["machine_start", "fax", "unknown"]);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Método no permitido");

  const signature = req.headers["x-twilio-signature"];
  const url = `https://${req.headers["x-forwarded-host"] || req.headers.host}${req.url}`;
  const valid = twilio.validateRequest(process.env.TWILIO_AUTH_TOKEN, signature, url, req.body || {});
  if (!valid) return res.status(403).send("Firma inválida");

  const clienteId = req.query.clienteId;
  // parentSid es el CallSid del tramo del navegador (lo pasa twilio-voice.js
  // en la query). El CallSid que manda Twilio en el body de este callback es
  // el del tramo hijo (el número marcado) — no sirve para ligarlo a
  // soat_llamadas, que se indexa por el CallSid padre.
  const parentSid = req.query.parentSid;
  const answeredBy = req.body?.AnsweredBy;

  if (clienteId && parentSid && NO_HUMANO.has(answeredBy)) {
    // 1) Marca la llamada como buzón ANTES de colgar, para ganarle la
    //    carrera al callback de fin de <Dial> (twilio-call-status.js), que
    //    si no escribiría "completed" encima.
    await supabase.from("soat_llamadas").upsert({
      cliente_id: clienteId,
      call_sid: parentSid,
      estado: "buzon",
    }, { onConflict: "call_sid" });

    // 2) Cuelga la llamada del agente (tramo padre) — termina todo.
    if (process.env.TWILIO_AMD !== "detect-only") {
      try {
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        await client.calls(parentSid).update({ status: "completed" });
      } catch {
        // La llamada ya pudo haber terminado (el agente colgó antes): sin problema.
      }
    }
  }

  res.setHeader("Content-Type", "text/xml");
  return res.status(200).send("<Response></Response>");
}
