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
// Spanish (COL)) -- se usa solo para guardar un "ultimo_mensaje" legible en
// whatsapp_conversaciones, Meta no devuelve el texto final en su respuesta.
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

async function enviarPlantilla_({ to, nombre, plantilla }) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    throw new Error("Faltan WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID en las variables de entorno.");
  }

  const resp = await fetch(`https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: plantilla,
        language: { code: "es_CO" },
        // parameter_name: la plantilla "soat_seguimiento_lead" en la cuenta
        // de PRUEBA usa variable nombrada {{nombre}} (la cuenta real exigía
        // parámetros nombrados al crearla; la plantilla original en la
        // cuenta real quedó con {{1}} posicional de antes de ese cambio).
        // Si el día de mañana se envía desde la cuenta real con esa
        // plantilla posicional, hay que quitar parameter_name aquí o volver
        // a someter esa plantilla también con {{nombre}}.
        components: [
          { type: "body", parameters: [{ type: "text", parameter_name: "nombre", text: nombre || "" }] },
        ],
      },
    }),
  });

  const json = await resp.json().catch(() => null);
  if (!resp.ok) {
    const detalle = json?.error?.message || JSON.stringify(json) || `HTTP ${resp.status}`;
    throw new Error(detalle);
  }
  return json;
}

// ── Webhook de Meta (sin auth de agente -- lo llama Meta directo) ──────────
//
// GET: handshake de verificacion (Meta lo llama una vez al configurar el
// webhook en el dashboard, comparando WHATSAPP_WEBHOOK_VERIFY_TOKEN).
// POST: eventos en tiempo real -- "statuses" (entregado/leido/fallido del
// mensaje que mandamos) y "messages" (el lead respondio). Ambos actualizan
// whatsapp_conversaciones, que es lo que leen en vivo SOAT.jsx y
// WhatsApp.jsx (realtime de Supabase) -- por eso no hace falta "sincronizar"
// nada mas: las dos pantallas miran la misma fila.
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

      // Confirmaciones de entrega/lectura/fallo del mensaje que mandamos.
      for (const status of valor.statuses || []) {
        const estado = ESTADO_POR_STATUS_META[status.status];
        if (!estado) continue;
        const patch = { estado, updated_at: new Date().toISOString() };
        if (status.status === "failed") {
          patch.error = status.errors?.[0]?.title || status.errors?.[0]?.message || "Error desconocido";
        }
        await supabase.from("whatsapp_conversaciones").update(patch).eq("wa_message_id", status.id);
      }

      // Respuestas entrantes del lead -- se buscan por telefono (no hay
      // wa_message_id del saliente en este evento) y se marca la fila mas
      // reciente de ese numero como "respondido".
      for (const msg of valor.messages || []) {
        const desde = String(msg.from || "").replace(/[^\d]/g, "");
        if (!desde) continue;
        const texto = msg.text?.body || `[${msg.type}]`;
        const { data: fila } = await supabase.from("whatsapp_conversaciones")
          .select("id").eq("telefono", desde).order("updated_at", { ascending: false }).limit(1).maybeSingle();
        if (fila) {
          await supabase.from("whatsapp_conversaciones")
            .update({ estado: "respondido", ultimo_mensaje: texto, updated_at: new Date().toISOString() })
            .eq("id", fila.id);
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
      await supabase.from("whatsapp_conversaciones").insert({
        cliente_id: clienteId,
        telefono: to,
        nombre,
        plantilla: "soat_seguimiento_lead",
        wa_message_id: waMessageId,
        estado: "enviado",
        ultimo_mensaje: textoPlantillaSoat_(nombre),
      });
      return res.status(200).json({ ok: true, resultado });
    } catch (err) {
      return res.status(502).json({ error: `No se pudo enviar el WhatsApp: ${err.message}` });
    }
  }

  return res.status(400).json({ error: "Acción no reconocida." });
}
