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
  // DEBUG temporal: quitar una vez se confirme por qué falla la firma.
  console.log("twilio-voice debug", JSON.stringify({
    valid, url, hasSignature: !!signature, host: req.headers.host,
    xForwardedHost: req.headers["x-forwarded-host"], reqUrl: req.url,
    bodyType: typeof req.body, bodyKeys: req.body ? Object.keys(req.body) : null,
    hasAuthToken: !!process.env.TWILIO_AUTH_TOKEN,
  }));
  if (!valid) return res.status(403).send("Firma inválida");

  const twiml = new twilio.twiml.VoiceResponse();
  const e164 = toE164Co(req.body?.To);

  if (!e164) {
    twiml.say({ language: "es-MX" }, "No se pudo determinar el número a marcar.");
  } else {
    twiml.dial({ callerId: process.env.TWILIO_CALLER_ID, timeout: 30 }).number(e164);
  }

  res.setHeader("Content-Type", "text/xml");
  return res.status(200).send(twiml.toString());
}
