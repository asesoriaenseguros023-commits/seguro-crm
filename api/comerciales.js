import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://cpzjaeurqeeljgsypwsh.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("agentes").select("id, nombre, created_at")
      .eq("rol", "Comercial").order("nombre");
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === "POST") {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: "nombre requerido" });
    const email = `comercial.${nombre.toLowerCase().replace(/\s+/g, ".")}@crm.local`;
    const { data, error } = await supabase
      .from("agentes").insert({ nombre: nombre.toUpperCase(), rol: "Comercial", email })
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "id requerido" });
    const { error } = await supabase.from("agentes").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Método no permitido" });
}
