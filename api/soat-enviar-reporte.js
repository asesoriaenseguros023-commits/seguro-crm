import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://cpzjaeurqeeljgsypwsh.supabase.co";
const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Envía por correo el PDF del Reporte IA (ya armado en el navegador con
// jsPDF — acá solo se manda el adjunto). Requiere RESEND_API_KEY en el
// entorno. Usa el remitente de pruebas de Resend por defecto
// (onboarding@resend.dev, funciona sin verificar dominio propio) — se
// puede sobreescribir con RESEND_FROM una vez haya un dominio verificado.
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

  const { to, subject, html, pdfBase64, filename } = req.body || {};
  if (!to || !pdfBase64) return res.status(400).json({ error: "Falta destinatario o el PDF adjunto" });

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || "Reporte IA SOAT <onboarding@resend.dev>",
      to: [to],
      subject: subject || "Reporte IA — Seguimiento SOAT",
      html: html || "<p>Adjunto el Reporte IA de Seguimiento SOAT.</p>",
      attachments: [{ filename: filename || "reporte-ia-soat.pdf", content: pdfBase64 }],
    }),
  });

  if (!resendRes.ok) {
    const detalle = await resendRes.text();
    return res.status(502).json({ error: `No se pudo enviar el correo (${resendRes.status}): ${detalle}` });
  }

  return res.status(200).json({ ok: true });
}
