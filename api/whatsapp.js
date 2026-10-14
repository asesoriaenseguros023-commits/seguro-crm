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
const WHATSAPP_API_VERSION = "v21.0";

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
        components: [
          { type: "body", parameters: [{ type: "text", text: nombre || "" }] },
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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
  if (!(await requireAgente(req))) return res.status(401).json({ error: "No autorizado" });

  const { action } = req.query;

  if (action === "enviar-seguimiento-soat") {
    const { telefono, nombre } = req.body || {};
    const to = normalizarTelefonoCO_(telefono);
    if (!to) return res.status(400).json({ error: "Falta el teléfono del lead o no es válido." });

    try {
      const resultado = await enviarPlantilla_({ to, nombre, plantilla: "soat_seguimiento_lead" });
      return res.status(200).json({ ok: true, resultado });
    } catch (err) {
      return res.status(502).json({ error: `No se pudo enviar el WhatsApp: ${err.message}` });
    }
  }

  return res.status(400).json({ error: "Acción no reconocida." });
}
