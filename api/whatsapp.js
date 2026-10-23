import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://cpzjaeurqeeljgsypwsh.supabase.co";
const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// WhatsApp Business Cloud API (Meta) -- WHATSAPP_TOKEN (del usuario del
// sistema "Employee", sin caducidad) y WHATSAPP_PHONE_NUMBER_ID, ambos en
// las env vars de Vercel. Mientras la verificación de la empresa en Meta
// siga pendiente, WHATSAPP_PHONE_NUMBER_ID debe apuntar al numero de PRUEBA
// (Test WhatsApp Business Account) -- solo entrega a los numeros que se
// hayan agregado ahi como destinatarios de prueba. Cuando se registre el
// numero real del negocio, basta con actualizar esa env var.
//
// Las dos acciones de este archivo (envio y webhook) estan en el mismo
// archivo a proposito, para no sumar otra funcion de Vercel (tope de 12 en
// el plan Hobby -- ver [[project-seguro-crm]]).
const WHATSAPP_API_VERSION = "v21.0";

// Cuerpo real de la plantilla aprobada "soat_seguimiento_lead" (Marketing,
// Spanish (COL)) -- se usa para guardar el texto legible del mensaje en
// whatsapp_mensajes, Meta no devuelve el texto final en su respuesta.
// Si el dia de mañana se edita la plantilla en Meta, hay que actualizar
// esto tambien para que coincida.
function textoPlantillaSoat_(nombre) {
  return `Hola ${nombre || ""}, somos Asesoría en Seguros Tocancipá. Vimos que tienes pendiente la renovación de tu SOAT. ¿Quieres que te ayudemos a cotizarlo?`;
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

// El campo "telefono" de los leads se guarda a 10 digitos, sin indicativo
// de pais (igual que Nova lo maneja para Colombia) -- aqui se antepone 57
// si hace falta, y se limpian espacios/guiones/parentesis.
function normalizarTelefonoCO_(telefono) {
  const limpio = String(telefono || "").replace(/[^\d]/g, "");
  if (!limpio) return null;
  if (limpio.startsWith("57") && limpio.length === 12) return limpio;
  if (limpio.length === 10) return "57" + limpio;
  return limpio;
}

async function enviarAMeta_(phoneNumberId, token, body) {
  const resp = await fetch(`https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = await resp.json().catch(() => null);
  if (!resp.ok) {
    const detalle = json?.error?.message || JSON.stringify(json) || `HTTP ${resp.status}`;
    throw new Error(detalle);
  }
  return json;
}

async function enviarPlantilla_({ to, nombre, plantilla }) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    throw new Error("Faltan WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID en las variables de entorno.");
  }
  return enviarAMeta_(phoneNumberId, token, {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: plantilla,
      language: { code: "es_CO" },
      // La plantilla "soat_seguimiento_lead" de la cuenta REAL (aprobada, es_CO)
      // usa la variable posicional {{1}}: se manda sin parameter_name. Solo la
      // cuenta de prueba la tenía con variable nombrada {{nombre}}.
      components: [
        { type: "body", parameters: [{ type: "text", text: nombre || "" }] },
      ],
    },
  });
}

async function enviarTexto_({ to, texto }) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    throw new Error("Faltan WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID en las variables de entorno.");
  }
  return enviarAMeta_(phoneNumberId, token, {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: texto },
  });
}

// La API de WhatsApp Business solo deja mandar texto libre (fuera de
// plantilla) dentro de las 24h siguientes al último mensaje ENTRANTE del
// cliente -- fuera de esa ventana hay que volver a mandar una plantilla
// aprobada. Se valida acá, en el servidor, para no depender solo del
// chequeo del lado del cliente (WhatsApp.jsx hace el mismo chequeo para no
// mostrar la caja de texto, pero esto es lo que de verdad lo hace cumplir).
const VENTANA_24H_MS = 24 * 60 * 60 * 1000;
function ventanaAbierta_(conversacion) {
  if (!conversacion?.ultima_entrante_at) return false;
  return Date.now() - new Date(conversacion.ultima_entrante_at).getTime() < VENTANA_24H_MS;
}

// ── Webhook de Meta (sin auth de agente -- lo llama Meta directo) ──────────
//
// GET: handshake de verificacion (Meta lo llama una vez al configurar el
// webhook en el dashboard, comparando WHATSAPP_WEBHOOK_VERIFY_TOKEN).
// POST: eventos en tiempo real -- "statuses" (entregado/leido/fallido de un
// mensaje saliente, actualiza whatsapp_mensajes) y "messages" (el lead
// respondió, inserta en whatsapp_mensajes y marca ultima_entrante_at en
// whatsapp_conversaciones). Ambas tablas se leen en vivo desde SOAT.jsx y
// WhatsApp.jsx (realtime de Supabase) -- por eso no hace falta "sincronizar"
// nada mas, las pantallas miran las mismas filas.
async function manejarWebhookGet_(req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.status(403).send("Verificación fallida");
}

const ESTADO_POR_STATUS_META = { sent: "enviado", delivered: "entregado", read: "leido", failed: "fallido" };

async function manejarWebhookPost_(req, res) {
  const entradas = req.body?.entry || [];
  for (const entrada of entradas) {
    for (const cambio of entrada.changes || []) {
      const valor = cambio.value || {};

      // Confirmaciones de entrega/lectura/fallo de un mensaje saliente que
      // mandamos -- ahora vive por-mensaje en whatsapp_mensajes, no en la
      // conversación.
      for (const status of valor.statuses || []) {
        const estado = ESTADO_POR_STATUS_META[status.status];
        if (!estado) continue;
        const patch = { estado };
        if (status.status === "failed") {
          patch.error = status.errors?.[0]?.title || status.errors?.[0]?.message || "Error desconocido";
        }
        await supabase.from("whatsapp_mensajes").update(patch).eq("wa_message_id", status.id);
      }

      // Respuestas entrantes del lead -- se buscan por telefono (no hay
      // wa_message_id del saliente en este evento, Meta solo manda el
      // numero) y se asocian a la conversación más reciente de ese numero.
      // Nota: si dos clientes distintos comparten el mismo teléfono, esto
      // puede asociar el mensaje a la conversación equivocada -- no hay
      // forma de distinguir solo con lo que manda Meta, limitación conocida.
      for (const msg of valor.messages || []) {
        const desde = String(msg.from || "").replace(/[^\d]/g, "");
        if (!desde) continue;
        const texto = msg.text?.body || `[${msg.type}]`;
        const { data: conversacion } = await supabase.from("whatsapp_conversaciones")
          .select("id").eq("telefono", desde).order("updated_at", { ascending: false }).limit(1).maybeSingle();
        if (conversacion) {
          const ahora = new Date().toISOString();
          await supabase.from("whatsapp_mensajes").insert({
            conversacion_id: conversacion.id,
            direccion: "entrante",
            tipo: "texto",
            contenido: texto,
          });
          await supabase.from("whatsapp_conversaciones")
            .update({ ultima_entrante_at: ahora, updated_at: ahora })
            .eq("id", conversacion.id);
        }
      }
    }
  }
  return res.status(200).json({ ok: true });
}

export default async function handler(req, res) {
  const { action } = req.query;

  if (action === "webhook") {
    if (req.method === "GET") return manejarWebhookGet_(req, res);
    if (req.method === "POST") return manejarWebhookPost_(req, res);
    return res.status(405).json({ error: "Método no permitido" });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
  if (!(await requireAgente(req))) return res.status(401).json({ error: "No autorizado" });

  if (action === "enviar-seguimiento-soat") {
    const { telefono, nombre, clienteId } = req.body || {};
    const to = normalizarTelefonoCO_(telefono);
    if (!to) return res.status(400).json({ error: "Falta el teléfono del lead o no es válido." });
    if (!clienteId) return res.status(400).json({ error: "Falta el ID del cliente." });

    try {
      const resultado = await enviarPlantilla_({ to, nombre, plantilla: "soat_seguimiento_lead" });
      const waMessageId = resultado?.messages?.[0]?.id || null;
      const { data: conversacion, error: convError } = await supabase.from("whatsapp_conversaciones")
        .upsert({ cliente_id: clienteId, telefono: to, nombre }, { onConflict: "cliente_id" })
        .select("id").single();
      if (convError) throw new Error(convError.message);
      await supabase.from("whatsapp_mensajes").insert({
        conversacion_id: conversacion.id,
        direccion: "saliente",
        tipo: "plantilla",
        contenido: textoPlantillaSoat_(nombre),
        wa_message_id: waMessageId,
        estado: "enviado",
      });
      return res.status(200).json({ ok: true, resultado });
    } catch (err) {
      return res.status(502).json({ error: `No se pudo enviar el WhatsApp: ${err.message}` });
    }
  }

  if (action === "enviar-mensaje") {
    const { conversacionId, texto } = req.body || {};
    if (!conversacionId) return res.status(400).json({ error: "Falta el ID de la conversación." });
    if (!texto || !texto.trim()) return res.status(400).json({ error: "El mensaje no puede estar vacío." });

    const { data: conversacion } = await supabase.from("whatsapp_conversaciones")
      .select("id, telefono, ultima_entrante_at").eq("id", conversacionId).maybeSingle();
    if (!conversacion) return res.status(404).json({ error: "Conversación no encontrada." });
    if (!ventanaAbierta_(conversacion)) {
      return res.status(409).json({ error: "La ventana de 24 horas está cerrada — hay que reenviar la plantilla de seguimiento." });
    }

    try {
      const resultado = await enviarTexto_({ to: conversacion.telefono, texto: texto.trim() });
      const waMessageId = resultado?.messages?.[0]?.id || null;
      await supabase.from("whatsapp_mensajes").insert({
        conversacion_id: conversacion.id,
        direccion: "saliente",
        tipo: "texto",
        contenido: texto.trim(),
        wa_message_id: waMessageId,
        estado: "enviado",
      });
      await supabase.from("whatsapp_conversaciones").update({ updated_at: new Date().toISOString() }).eq("id", conversacion.id);
      return res.status(200).json({ ok: true, resultado });
    } catch (err) {
      return res.status(502).json({ error: `No se pudo enviar el mensaje: ${err.message}` });
    }
  }

  return res.status(400).json({ error: "Acción no reconocida." });
}
