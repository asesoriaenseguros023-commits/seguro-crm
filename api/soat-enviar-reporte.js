import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://cpzjaeurqeeljgsypwsh.supabase.co";
const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Envía por correo el PDF del Reporte IA (ya armado en el navegador con
// jsPDF — acá solo se manda el adjunto). Reusa la Edge Function de correo
// que ya existe en pos-tocancipa (supabase/functions/send-email — Gmail
// SMTP vía nodemailer, EMAIL_USER/EMAIL_PASS en ESE proyecto) en vez de
// montar un proveedor nuevo — pedido explícito del usuario. Mismo shape de
// petición que ya usa Certificados.jsx -> enviarCorreo() ahí: {to, subject,
// html, text, attachmentBase64, attachmentName}. Sin Authorization: la
// función no exige JWT (confirmado — responde 200 a una petición sin auth).
const SEND_EMAIL_URL = "https://rxjyxkkzpowufejfejil.supabase.co/functions/v1/send-email";

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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
  if (!(await requireAgente(req))) return res.status(401).json({ error: "No autorizado" });

  const { to, subject, html, text, pdfBase64, filename } = req.body || {};
  if (!to || !pdfBase64) return res.status(400).json({ error: "Falta destinatario o el PDF adjunto" });

  const sendRes = await fetch(SEND_EMAIL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to,
      subject: subject || "Reporte IA — Seguimiento SOAT",
      html: html || "<p>Adjunto el Reporte IA de Seguimiento SOAT.</p>",
      text: text || "Adjunto el Reporte IA de Seguimiento SOAT.",
      attachmentBase64: pdfBase64,
      attachmentName: filename || "reporte-ia-soat.pdf",
    }),
  });

  if (!sendRes.ok) {
    const detalle = await sendRes.text();
    return res.status(502).json({ error: `No se pudo enviar el correo (${sendRes.status}): ${detalle}` });
  }

  return res.status(200).json({ ok: true });
}
