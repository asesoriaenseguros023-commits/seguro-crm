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

// Catálogo de plantillas de Meta (es_CO). conNombre = el cuerpo lleva la
// variable posicional {{1}} con el nombre del cliente. El texto se guarda en
// whatsapp_mensajes, así que debe coincidir con el aprobado en Meta.
const PLANTILLA_PRIMERA = "soat_seguimiento_lead";
const PLANTILLAS_WA = {
  soat_seguimiento_lead: { conNombre: true, texto: textoPlantillaSoat_ },
  soat_claro_pendientes: { conNombre: true, texto: (n) => `Claro que sí, ${n || ""}. Quedamos pendientes de tu mensaje para ayudarte con tu SOAT.` },
  soat_recordatorio_asesoria: { conNombre: true, texto: (n) => `Este es un recordatorio de Asesoría en Seguros Tocancipá, ${n || ""}: estamos para asesorarte con la compra de tu SOAT. Cuando quieras, escríbenos.` },
  soat_datos_vehiculo: { conNombre: true, texto: (n) => `Por favor indícanos, ${n || ""}, el tipo de vehículo, el cilindraje y el modelo para cotizar tu SOAT.` },
  soat_retomar_conversacion_2: { conNombre: false, texto: () => "¿Desea retomar la conversación?" },
};

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
      ...(PLANTILLAS_WA[plantilla]?.conNombre !== false
        ? { components: [{ type: "body", parameters: [{ type: "text", text: nombre || "" }] }] }
        : {}),
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


// ── Archivos entrantes (foto, audio, video, documento) ─────────────────────
// Meta no manda el archivo en el webhook: manda un id. Hay que pedir su URL
// (que caduca) y bajarlo con el mismo token; se guarda en Supabase Storage
// para poder mostrarlo después. Requiere supabase_whatsapp_media.sql.
const TIPOS_MEDIA = ["image", "audio", "video", "document", "sticker"];
const EXT_POR_MIME = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
  "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "aac", "audio/amr": "amr",
  "video/mp4": "mp4", "video/3gpp": "3gp", "application/pdf": "pdf",
};

async function descargarMedia_({ mediaId, mime, nombre, conversacionId, waMessageId }) {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) throw new Error("falta WHATSAPP_TOKEN");
  const auth = { Authorization: `Bearer ${token}` };

  const meta = await fetch(`https://graph.facebook.com/${WHATSAPP_API_VERSION}/${mediaId}`, { headers: auth });
  const metaJson = await meta.json().catch(() => null);
  if (!meta.ok || !metaJson?.url) throw new Error(metaJson?.error?.message || `Meta respondió ${meta.status}`);

  const archivo = await fetch(metaJson.url, { headers: auth });
  if (!archivo.ok) throw new Error(`descarga ${archivo.status}`);
  const buffer = Buffer.from(await archivo.arrayBuffer());

  // "audio/ogg; codecs=opus" -> "audio/ogg"
  const mimeBase = String(metaJson.mime_type || mime || "application/octet-stream").split(";")[0].trim();
  const ext = EXT_POR_MIME[mimeBase] || mimeBase.split("/")[1] || "bin";
  const path = `${conversacionId}/${waMessageId}.${ext}`;
  const { error } = await supabase.storage.from("whatsapp-media").upload(path, buffer, { contentType: mimeBase, upsert: true });
  if (error) throw new Error(error.message);
  return { media_path: path, media_mime: mimeBase, media_nombre: nombre || null };
}


// Texto legible de los mensajes entrantes que no son texto ni archivo.
function textoDeMensaje_(msg) {
  switch (msg.type) {
    case "text": return msg.text?.body || "";
    case "location": {
      const l = msg.location || {};
      return `📍 Ubicación${l.name ? `: ${l.name}` : ""} https://www.google.com/maps?q=${l.latitude},${l.longitude}`;
    }
    case "contacts": return `👤 Contacto: ${(msg.contacts || []).map(c => c.name?.formatted_name).filter(Boolean).join(", ") || "sin nombre"}`;
    case "button": return msg.button?.text || "[botón]";
    case "interactive": return msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || "[respuesta]";
    default: return `[${msg.type}]`;
  }
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


// Conversación para un número que escribe sin tener conversación previa.
// Busca al cliente por sus últimos 10 dígitos; si no está en soat_clientes lo
// crea como cliente nuevo (en gestión, sin asignar) con el nombre del perfil de
// WhatsApp. Devuelve { id, cliente_id } o null si algo falla.
async function crearConversacionEntrante_(desde, nombrePerfil) {
  try {
    const ultimos10 = desde.slice(-10);
    let { data: encontrados } = await supabase.from("soat_clientes")
      .select("id, nombre").ilike("telefono", `%${ultimos10}%`).order("created_at", { ascending: false }).limit(1);
    let cliente = encontrados?.[0];
    if (!cliente) {
      const hoy = new Date();
      const { data: nuevo, error } = await supabase.from("soat_clientes").insert({
        nombre: (nombrePerfil || "Contacto WhatsApp").toUpperCase(), telefono: ultimos10, placa: "",
        anio_mes: `${String(hoy.getMonth() + 1).padStart(2, "0")}-${hoy.getFullYear()}`,
        fecha_compra: "", fecha_vencimiento: "", fase: "en_gestion", agente: "Sin asignar", intentos: 0,
        notas: "Escribió por WhatsApp sin estar en la base.", historial: [],
      }).select("id, nombre").single();
      if (error) throw new Error(error.message);
      cliente = nuevo;
    }
    const { data: existente } = await supabase.from("whatsapp_conversaciones")
      .select("id, cliente_id").eq("cliente_id", cliente.id).maybeSingle();
    if (existente) return existente;
    const { data: conv, error: convError } = await supabase.from("whatsapp_conversaciones")
      .insert({ cliente_id: cliente.id, telefono: desde, nombre: cliente.nombre }).select("id, cliente_id").single();
    if (convError) throw new Error(convError.message);
    return conv;
  } catch (err) {
    console.error("WhatsApp: no se pudo crear la conversación entrante", err.message);
    return null;
  }
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
        // Reacción (👍, ❤️…) a un mensaje: no es un mensaje nuevo, se pega en la
        // burbuja a la que reaccionó. Emoji vacío = el cliente quitó su reacción.
        // Requiere supabase_whatsapp_reaccion.sql.
        if (msg.type === "reaction") {
          const { error: reError } = await supabase.from("whatsapp_mensajes")
            .update({ reaccion: msg.reaction?.emoji || null }).eq("wa_message_id", msg.reaction?.message_id || "");
          if (reError) console.error("WhatsApp: no se pudo guardar la reacción", reError.message);
          continue;
        }

        const esMedia = TIPOS_MEDIA.includes(msg.type);
        const datosMedia = esMedia ? msg[msg.type] || {} : null;
        const texto = esMedia ? (datosMedia.caption || "") : textoDeMensaje_(msg);
        let { data: conversacion } = await supabase.from("whatsapp_conversaciones")
          .select("id, cliente_id").eq("telefono", desde).order("updated_at", { ascending: false }).limit(1).maybeSingle();
        // Escribe alguien a quien nunca le habíamos escrito (esté o no en la base):
        // antes el mensaje se perdía en silencio. Ahora se crea la conversación,
        // y el cliente si no existe, para que aparezca en el módulo WhatsApp.
        if (!conversacion) {
          const perfil = (valor.contacts || []).find(c => String(c.wa_id || "").replace(/[^\d]/g, "") === desde)?.profile?.name || "";
          conversacion = await crearConversacionEntrante_(desde, perfil);
        }
        if (conversacion) {
          const ahora = new Date().toISOString();
          const fila = {
            conversacion_id: conversacion.id,
            direccion: "entrante",
            tipo: esMedia ? (msg.type === "sticker" ? "image" : msg.type) : "texto",
            contenido: texto,
            wa_message_id: msg.id || null,
          };
          if (esMedia) {
            try {
              Object.assign(fila, await descargarMedia_({
                mediaId: datosMedia.id, mime: datosMedia.mime_type, nombre: datosMedia.filename,
                conversacionId: conversacion.id, waMessageId: msg.id || datosMedia.id,
              }));
            } catch (err) {
              console.error("WhatsApp: no se pudo descargar el archivo entrante", msg.type, err.message);
              fila.contenido = [texto, `[${msg.type}: no se pudo descargar el archivo (${err.message})]`].filter(Boolean).join("\n");
            }
          }
          const { error: insError } = await supabase.from("whatsapp_mensajes").insert(fila);
          // 23505 = Meta reenvió el mismo evento (wa_message_id ya existe): ignorar.
          if (insError?.code === "23505") continue;
          if (insError && esMedia) {
            // Si falta correr supabase_whatsapp_media.sql (columnas nuevas), guardar al menos el aviso.
            console.error("WhatsApp: no se pudo guardar el archivo entrante", insError.message);
            await supabase.from("whatsapp_mensajes").insert({
              conversacion_id: conversacion.id, direccion: "entrante", tipo: "texto",
              contenido: `[${msg.type}] ${texto}`.trim(),
            });
          }
          await supabase.from("whatsapp_conversaciones")
            .update({ ultima_entrante_at: ahora, updated_at: ahora })
            .eq("id", conversacion.id);
          // Por defecto, si el cliente respondió pasa de "Pendiente" a "En gestión"
          // (no se toca si ya está en otra fase: interesado, compró, etc.).
          if (conversacion.cliente_id) {
            await supabase.from("soat_clientes").update({ fase: "en_gestion" })
              .eq("id", conversacion.cliente_id).in("fase", ["pendiente", "contactado_whatsapp"]);
          }
        }
      }
    }
  }
  return res.status(200).json({ ok: true });
}

// Al enviar un WhatsApp (plantilla o texto) el cliente deja de estar en "Pendiente" y pasa a
// "Contactado por WhatsApp". Solo si sigue en "Pendiente": no pisa otras fases (interesado, compró...).
async function marcarContactadoWhatsapp_(clienteId) {
  if (!clienteId) return;
  await supabase.from("soat_clientes").update({ fase: "contactado_whatsapp" })
    .eq("id", clienteId).eq("fase", "pendiente");
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
    const plantilla = req.body?.plantilla || PLANTILLA_PRIMERA;
    if (!PLANTILLAS_WA[plantilla]) return res.status(400).json({ error: "Plantilla desconocida." });
    const to = normalizarTelefonoCO_(telefono);
    if (!to) return res.status(400).json({ error: "Falta el teléfono del lead o no es válido." });
    if (!clienteId) return res.status(400).json({ error: "Falta el ID del cliente." });

    // La plantilla se manda UNA sola vez por cliente (Meta penaliza la insistencia:
    // "healthy ecosystem"). Solo se permite otro intento si todos los anteriores fallaron.
    const { data: convPrevia } = await supabase.from("whatsapp_conversaciones")
      .select("id").eq("cliente_id", clienteId).maybeSingle();
    if (convPrevia) {
      const { data: previas } = await supabase.from("whatsapp_mensajes")
        .select("estado, plantilla").eq("conversacion_id", convPrevia.id).eq("direccion", "saliente").eq("tipo", "plantilla");
      // Cada plantilla se manda una sola vez; las antiguas sin nombre cuentan como la primera.
      if ((previas || []).some(m => m.estado !== "fallido" && (m.plantilla || PLANTILLA_PRIMERA) === plantilla)) {
        return res.status(409).json({ error: "A este cliente ya se le envió esa plantilla. Cada una se manda una sola vez." });
      }
    }

    try {
      const resultado = await enviarPlantilla_({ to, nombre, plantilla });
      const waMessageId = resultado?.messages?.[0]?.id || null;
      const { data: conversacion, error: convError } = await supabase.from("whatsapp_conversaciones")
        .upsert({ cliente_id: clienteId, telefono: to, nombre }, { onConflict: "cliente_id" })
        .select("id").single();
      if (convError) throw new Error(convError.message);
      await supabase.from("whatsapp_mensajes").insert({
        conversacion_id: conversacion.id,
        direccion: "saliente",
        tipo: "plantilla",
        contenido: PLANTILLAS_WA[plantilla].texto(nombre),
        plantilla,
        wa_message_id: waMessageId,
        estado: "enviado",
      });
      await marcarContactadoWhatsapp_(clienteId);
      return res.status(200).json({ ok: true, resultado });
    } catch (err) {
      return res.status(502).json({ error: `No se pudo enviar el WhatsApp: ${err.message}` });
    }
  }

  // Reaccionar (👍 ❤️ …) a un mensaje del cliente. emoji vacío = quitar la reacción.
  // Requiere supabase_whatsapp_reaccion.sql (columna reaccion_agente).
  if (action === "enviar-reaccion") {
    const { mensajeId, emoji } = req.body || {};
    if (!mensajeId) return res.status(400).json({ error: "Falta el ID del mensaje." });
    const { data: mensaje } = await supabase.from("whatsapp_mensajes")
      .select("id, direccion, wa_message_id, conversacion_id").eq("id", mensajeId).maybeSingle();
    if (!mensaje) return res.status(404).json({ error: "Mensaje no encontrado." });
    if (mensaje.direccion !== "entrante" || !mensaje.wa_message_id) {
      return res.status(409).json({ error: "Solo se puede reaccionar a mensajes recientes del cliente." });
    }
    const { data: conversacion } = await supabase.from("whatsapp_conversaciones")
      .select("telefono").eq("id", mensaje.conversacion_id).maybeSingle();
    if (!conversacion) return res.status(404).json({ error: "Conversación no encontrada." });

    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneNumberId) return res.status(500).json({ error: "Faltan WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID." });
    try {
      await enviarAMeta_(phoneNumberId, token, {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: conversacion.telefono,
        type: "reaction",
        reaction: { message_id: mensaje.wa_message_id, emoji: emoji || "" },
      });
      await supabase.from("whatsapp_mensajes").update({ reaccion_agente: emoji || null }).eq("id", mensaje.id);
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(502).json({ error: `No se pudo enviar la reacción: ${err.message}` });
    }
  }

  if (action === "enviar-mensaje") {
    const { conversacionId, texto } = req.body || {};
    if (!conversacionId) return res.status(400).json({ error: "Falta el ID de la conversación." });
    if (!texto || !texto.trim()) return res.status(400).json({ error: "El mensaje no puede estar vacío." });

    const { data: conversacion } = await supabase.from("whatsapp_conversaciones")
      .select("id, cliente_id, telefono, ultima_entrante_at").eq("id", conversacionId).maybeSingle();
    if (!conversacion) return res.status(404).json({ error: "Conversación no encontrada." });
    if (!ventanaAbierta_(conversacion)) {
      return res.status(409).json({ error: "La ventana de 24 horas está cerrada — hay que reenviar la plantilla de seguimiento." });
    }

    try {
      const resultado = await enviarTexto_({ to: conversacion.telefono, texto: texto.trim() });
      const waMessageId = resultado?.messages?.[0]?.id || null;
      const { data: mensaje } = await supabase.from("whatsapp_mensajes").insert({
        conversacion_id: conversacion.id,
        direccion: "saliente",
        tipo: "texto",
        contenido: texto.trim(),
        wa_message_id: waMessageId,
        estado: "enviado",
      }).select().single();
      await supabase.from("whatsapp_conversaciones").update({ updated_at: new Date().toISOString() }).eq("id", conversacion.id);
      await marcarContactadoWhatsapp_(conversacion.cliente_id);
      return res.status(200).json({ ok: true, resultado, mensaje });
    } catch (err) {
      return res.status(502).json({ error: `No se pudo enviar el mensaje: ${err.message}` });
    }
  }

  return res.status(400).json({ error: "Acción no reconocida." });
}
