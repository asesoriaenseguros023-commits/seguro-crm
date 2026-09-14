import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

// El API de Mensajes de Claude no acepta audio (solo texto/imagen/PDF), así
// que la grabación se transcribe primero con OpenAI (gpt-4o-transcribe,
// ~$0.006/min — la transcripción propia de Twilio sale ~4x más cara, desde
// $0.024/min) y luego se le manda el texto a Claude para el análisis.
const anthropic = new Anthropic(); // ANTHROPIC_API_KEY del entorno

async function descargarGrabacion(recordingSid) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Recordings/${recordingSid}.mp3`;
  const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  if (!res.ok) throw new Error(`No se pudo descargar la grabación de Twilio (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

async function transcribir(mp3Buffer) {
  const form = new FormData();
  form.append("file", new Blob([mp3Buffer], { type: "audio/mpeg" }), "llamada.mp3");
  form.append("model", "gpt-4o-transcribe");
  form.append("language", "es");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Transcripción falló (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return data.text || "";
}

export const AnalisisSchema = z.object({
  persona_real: z.enum(["si", "no", "incierto"]),
  razon: z.string().describe("Señal concreta de la transcripción en la que se basa (ej: conversación con turnos naturales, vs. mensaje grabado repetitivo o silencio sin habla)."),
  resumen: z.string().describe("Resumen breve de qué se habló en la llamada."),
  calidad_agente: z.object({
    cortesia: z.enum(["buena", "regular", "mala", "no_aplica"]),
    informacion_correcta: z.enum(["si", "no", "no_aplica"]),
    oportunidades_perdidas: z.array(z.string()).describe(
      "Fallas comerciales CONCRETAS y con nombre propio — no genéricas. Ej: " +
      "'Aceptó el \"lo pienso\" sin preguntar qué lo detiene', 'No fijó fecha/hora " +
      "exacta de la próxima llamada, quedó en el aire', 'No manejó la objeción de " +
      "precio, se quedó callado', 'No mencionó el descuento disponible'. Lista vacía " +
      "solo si el agente de verdad no dejó nada sobre la mesa."
    ),
    observaciones: z.string().describe(
      "Evaluación directa y retadora, como un coach de ventas exigente — nunca genérica " +
      "ni condescendiente. Nombra la falla comercial específica en vez de decir 'podría " +
      "mejorar' o 'buena atención'. Si hizo un buen cierre o manejo de objeción, " +
      "reconócelo con el mismo nivel de detalle concreto."
    ),
  }),
});

async function analizarConClaude(transcripcion) {
  const response = await anthropic.messages.parse({
    model: "claude-opus-5",
    max_tokens: 2048,
    system:
      "Eres un coach de ventas EXIGENTE que audita llamadas de un call center de seguros " +
      "en Colombia (Seguimiento SOAT). No seas condescendiente ni genérico: si el agente " +
      "se conformó con un 'te llamo después', 'lo pienso' o 'no tengo tiempo ahora' sin " +
      "fijar fecha/hora concreta de seguimiento, sin manejar la objeción, o sin intentar " +
      "cerrar un compromiso real, DILO explícitamente y con nombre propio del error — no " +
      "lo suavices. Evita frases vacías como 'podría mejorar' o 'buena atención' sin " +
      "sustancia: señala la falla comercial concreta. Si el agente sí hizo un buen " +
      "trabajo cerrando o manejando objeciones, reconócelo también con el mismo nivel de " +
      "detalle concreto — no minimices lo que hizo bien.\n\n" +
      "A partir de la transcripción, determina también si de verdad contestó una persona " +
      "real (no un buzón de voz, un mensaje grabado, o silencio/ruido sin habla humana " +
      "interactiva) y resume brevemente la llamada. Si la transcripción es demasiado " +
      "corta o ambigua para decidir con confianza sobre 'persona_real', usa 'incierto' " +
      "en vez de adivinar — pero la evaluación comercial, cuando sí hubo conversación, " +
      "debe ser siempre firme y específica, nunca genérica.",
    output_config: { effort: "low", format: zodOutputFormat(AnalisisSchema) },
    messages: [{ role: "user", content: `Transcripción de la llamada:\n\n${transcripcion || "(sin habla detectada — transcripción vacía)"}` }],
  });
  return response.parsed_output;
}

// Transcribe + analiza una grabación y guarda el resultado en soat_llamadas.
// Nunca lanza — un fallo acá no debe tumbar el webhook de Twilio que la
// invoca; el error queda guardado en analisis_ia para poder diagnosticarlo.
export async function analizarGrabacion({ recordingSid, callSid, supabase }) {
  try {
    const { data: previa } = await supabase.from("soat_llamadas")
      .select("analizado_en").eq("call_sid", callSid).maybeSingle();
    if (previa?.analizado_en) return; // ya analizada (reintento del webhook de Twilio)

    const mp3 = await descargarGrabacion(recordingSid);
    const transcripcion = await transcribir(mp3);
    const analisis = await analizarConClaude(transcripcion);
    await supabase.from("soat_llamadas").update({
      transcripcion,
      analisis_ia: analisis,
      analizado_en: new Date().toISOString(),
    }).eq("call_sid", callSid);
  } catch (err) {
    console.error("[analizarGrabacion] falló:", err);
    await supabase.from("soat_llamadas").update({
      analisis_ia: { error: String(err?.message || err) },
      analizado_en: new Date().toISOString(),
    }).eq("call_sid", callSid);
  }
}
