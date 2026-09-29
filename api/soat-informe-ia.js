import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { analizarGrabacion } from "./_lib/analizarLlamada.js";

const SUPABASE_URL = "https://cpzjaeurqeeljgsypwsh.supabase.co";
const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const anthropic = new Anthropic();

// "Reporte IA": agrega el análisis individual (ver _lib/analizarLlamada.js)
// de todas las llamadas de un periodo y le pide a Claude un comentario
// consolidado — patrones que se repiten, no una lista repetida. Sesión de
// agente autenticado requerida (dispara llamadas pagas a OpenAI/Anthropic).
//
// Pedido explícito del usuario (2026-09-29): antes CADA llamada se
// transcribía/analizaba apenas quedaba grabada (ver twilio-recording-status.js,
// ya no lo hace) — eso gastaba tokens en llamadas que nadie termina
// revisando. Ahora el análisis es perezoso: se dispara aquí mismo, solo para
// las llamadas del rango pedido que todavía no tengan análisis, justo antes
// de armar el reporte.
//
// Un tope fijo de "hasta N llamadas" no tiene sentido — un reporte semanal
// puede traer 50 llamadas sin problema, uno diario puede traer 3. Lo que sí
// es un límite real (y no se puede subir sin pasar a Vercel Pro) es que la
// función entera tiene que responder en maxDuration=60s. Por eso esto no
// tope por CANTIDAD sino por TIEMPO: procesa en lotes de a
// CONCURRENCIA_ANALISIS en paralelo hasta acercarse al presupuesto, dejando
// margen para la consulta final + el comentario consolidado de Claude. Si el
// rango no alcanzó a completarse, "pendientesRestantes" en la respuesta dice
// exactamente cuántas faltan (no solo un booleano) para volver a generar el
// reporte y completarlas — mismo patrón de "seguir corriendo hasta terminar"
// que ya usaba soat-backfill-analisis.js para su propio backlog.
export const config = { maxDuration: 60 };
const PRESUPUESTO_ANALISIS_MS = 45000; // deja ~15s para el resto del reporte
const CONCURRENCIA_ANALISIS = 6;

async function analizarPendientesDelRango(desde, hasta) {
  const inicio = Date.now();
  const { data: pendientes } = await supabase.from("soat_llamadas")
    .select("call_sid, grabacion_sid")
    .gte("created_at", `${desde}T00:00:00-05:00`)
    .lte("created_at", `${hasta}T23:59:59-05:00`)
    .not("grabacion_sid", "is", null)
    .is("analizado_en", null)
    .order("created_at", { ascending: true });
  if (!pendientes?.length) return { analizadas: 0, pendientesRestantes: 0 };

  let analizadas = 0;
  for (let i = 0; i < pendientes.length; i += CONCURRENCIA_ANALISIS) {
    if (Date.now() - inicio > PRESUPUESTO_ANALISIS_MS) break;
    const lote = pendientes.slice(i, i + CONCURRENCIA_ANALISIS);
    await Promise.all(lote.map((row) => analizarGrabacion({ recordingSid: row.grabacion_sid, callSid: row.call_sid, supabase })));
    analizadas += lote.length;
  }
  return { analizadas, pendientesRestantes: pendientes.length - analizadas };
}

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

const ConsolidadoSchema = z.object({
  resumen_ejecutivo: z.string().describe("2-4 frases de alto nivel sobre el desempeño comercial del equipo en el periodo."),
  hallazgos: z.array(z.string()).describe(
    "Patrones que se REPITEN entre varias llamadas, con frecuencia (ej: 'en 6 de 10 " +
    "llamadas donde el cliente dijo que lo pensaría, el agente no agendó fecha de " +
    "seguimiento'). No es una lista de observaciones sueltas, es el patrón sistemático."
  ),
  recomendaciones: z.array(z.string()).describe("Acciones concretas y accionables para el equipo — no genéricas."),
});

async function generarConsolidado(llamadas) {
  if (llamadas.length === 0) return null;
  const texto = llamadas.map((l, i) =>
    `${i + 1}. ${l.cliente} — ${new Date(l.fecha).toLocaleString("es-CO", { timeZone: "America/Bogota" })} — persona_real: ${l.persona_real}\n` +
    `   Resumen: ${l.resumen}\n` +
    `   Cortesía: ${l.cortesia} · Info correcta: ${l.informacion_correcta}\n` +
    (l.oportunidades_perdidas?.length ? `   Oportunidades perdidas: ${l.oportunidades_perdidas.join("; ")}\n` : "") +
    `   Observación: ${l.observaciones}`
  ).join("\n\n");

  const response = await anthropic.messages.parse({
    model: "claude-opus-5",
    max_tokens: 4096,
    system:
      "Eres un director comercial EXIGENTE revisando el desempeño de un equipo de call " +
      "center de seguros en Colombia (Seguimiento SOAT) a partir del análisis individual " +
      "de varias llamadas. Identifica patrones que se REPITEN entre llamadas (no repitas " +
      "la lista, busca lo sistemático), nombra las fallas comerciales concretas con " +
      "frecuencia, y da recomendaciones accionables para el equipo — nunca genéricas ni " +
      "condescendientes. Sé directo.",
    output_config: { effort: "medium", format: zodOutputFormat(ConsolidadoSchema) },
    messages: [{ role: "user", content: `Análisis individual de ${llamadas.length} llamadas del periodo:\n\n${texto}` }],
  });
  return response.parsed_output;
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Método no permitido" });
  if (!(await requireAgente(req))) return res.status(401).json({ error: "No autorizado" });

  const desde = req.query.desde;
  const hasta = req.query.hasta;
  if (!desde || !hasta) return res.status(400).json({ error: "Faltan fechas desde/hasta" });

  const { analizadas, pendientesRestantes } = await analizarPendientesDelRango(desde, hasta);

  // Colombia es UTC-5 fijo, sin horario de verano — desde/hasta vienen como
  // fecha de calendario en Bogotá (el date picker), así que se ancla el
  // rango con ese offset explícito. Sin esto, Postgres las interpretaba en
  // UTC y el rango quedaba corrido hasta 5 horas.
  const { data: filas, error } = await supabase
    .from("soat_llamadas")
    .select("id, created_at, analisis_ia, grabacion_sid, soat_clientes(nombre, telefono, placa)")
    .gte("created_at", `${desde}T00:00:00-05:00`)
    .lte("created_at", `${hasta}T23:59:59-05:00`)
    .not("analisis_ia", "is", null)
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  const todas = (filas || [])
    .filter((f) => f.analisis_ia && !f.analisis_ia.error)
    .map((f) => ({
      id: f.id,
      fecha: f.created_at,
      cliente: f.soat_clientes?.nombre || "—",
      telefono: f.soat_clientes?.telefono || "",
      placa: f.soat_clientes?.placa || "",
      grabacionSid: f.grabacion_sid,
      persona_real: f.analisis_ia.persona_real,
      razon: f.analisis_ia.razon,
      resumen: f.analisis_ia.resumen,
      cortesia: f.analisis_ia.calidad_agente?.cortesia,
      informacion_correcta: f.analisis_ia.calidad_agente?.informacion_correcta,
      oportunidades_perdidas: f.analisis_ia.calidad_agente?.oportunidades_perdidas || [],
      observaciones: f.analisis_ia.calidad_agente?.observaciones,
    }));

  // Estadísticas sobre TODAS (da el panorama: cuántas de las contactadas
  // fueron efectivas). El detalle y el consolidado, en cambio, solo con
  // llamadas efectivas (persona_real="si") — pedido explícito del usuario:
  // revisar buzón/no contestadas no aporta nada comercial y es gasto de
  // tiempo revisando algo que ya no se puede accionar.
  const estadisticas = {
    total: todas.length,
    personaReal: todas.filter((l) => l.persona_real === "si").length,
    noPersona: todas.filter((l) => l.persona_real === "no").length,
    incierto: todas.filter((l) => l.persona_real === "incierto").length,
    cortesiaBuena: todas.filter((l) => l.cortesia === "buena").length,
    cortesiaRegular: todas.filter((l) => l.cortesia === "regular").length,
    cortesiaMala: todas.filter((l) => l.cortesia === "mala").length,
  };

  const llamadas = todas.filter((l) => l.persona_real === "si");
  const consolidado = await generarConsolidado(llamadas);

  return res.status(200).json({
    llamadas, estadisticas, consolidado,
    analisisEnEsteReporte: analizadas,
    pendientesRestantes,
  });
}
