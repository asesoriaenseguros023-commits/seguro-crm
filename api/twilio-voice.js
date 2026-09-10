import twilio from "twilio";

// Los teléfonos en soat_clientes son celulares colombianos de 10 dígitos
// sin indicativo (confirmado con el usuario). Whitelist a propósito: si
// un token de llamada se filtrara, esta normalización solo puede producir
// un número colombiano válido, nunca uno internacional/premium.
function toE164Co(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length === 10) return `+57${digits}`;
  if (digits.length === 12 && digits.startsWith("57")) return `+${digits}`;
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Método no permitido");

  const signature = req.headers["x-twilio-signature"];
  const url = `https://${req.headers["x-forwarded-host"] || req.headers.host}${req.url}`;
  const valid = twilio.validateRequest(process.env.TWILIO_AUTH_TOKEN, signature, url, req.body || {});
  if (!valid) return res.status(403).send("Firma inválida");

  const twiml = new twilio.twiml.VoiceResponse();
  const e164 = toE164Co(req.body?.To);

  if (!e164) {
    twiml.say({ language: "es-MX" }, "No se pudo determinar el número a marcar.");
  } else {
    // El navegador manda ClienteId como parámetro de device.connect() — se
    // reenvía en la query de los callbacks para poder ligar el resultado
    // técnico (estado/duración/grabación) al cliente correcto en soat_llamadas.
    const base = `https://${req.headers["x-forwarded-host"] || req.headers.host}`;
    const clienteId = encodeURIComponent(req.body?.ClienteId || "");
    const parentSid = encodeURIComponent(req.body?.CallSid || "");
    const dial = twiml.dial({
      callerId: process.env.TWILIO_CALLER_ID,
      timeout: 30,
      // Graba desde que el cliente contesta (no timbrado), un canal por
      // lado (agente/cliente separados) — pedido explícito del usuario.
      record: "record-from-answer-dual",
      recordingStatusCallback: `${base}/api/twilio-recording-status?clienteId=${clienteId}`,
      recordingStatusCallbackEvent: "completed",
      action: `${base}/api/twilio-call-status?clienteId=${clienteId}`,
      method: "POST",
    });

    // Detección de contestador (AMD). La operadora manda "answered" también
    // cuando la llamada cae a buzón o el celular está apagado / sin señal —
    // por eso salían llamadas "Contestadas" con grabación donde nadie habló.
    // AMD escucha los primeros segundos y, si contestó una máquina o hubo
    // silencio, avisa a twilio-amd-status.js para marcar la llamada como
    // buzón y colgarla. Interruptor por env var TWILIO_AMD:
    //   "off"         → sin AMD (comportamiento viejo, no cobra AMD)
    //   "detect-only" → marca buzón pero no cuelga
    //   otro / vacío  → marca buzón y cuelga
    if (process.env.TWILIO_AMD === "off") {
      dial.number(e164);
    } else {
      dial.number({
        machineDetection: "Enable",
        machineDetectionSilenceTimeout: 5000,
        machineDetectionTimeout: 20,
        amdStatusCallback: `${base}/api/twilio-amd-status?clienteId=${clienteId}&parentSid=${parentSid}`,
        amdStatusCallbackMethod: "POST",
      }, e164);
    }
  }

  res.setHeader("Content-Type", "text/xml");
  return res.status(200).send(twiml.toString());
}
