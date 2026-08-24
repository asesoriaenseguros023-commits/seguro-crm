import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://cpzjaeurqeeljgsypwsh.supabase.co";
const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Antes este endpoint no verificaba nada: cualquiera en internet, sin
// loguearse, podía leer/crear/borrar filas de "agentes" con la
// service_role key (que salta RLS por completo). Ahora exige un token de
// sesión de Supabase válido y que ese usuario tenga rol Admin en la tabla
// agentes — igual que ya exige la interfaz para mostrar esta pantalla.
async function requireAdmin(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return false;
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user?.email) return false;
  const { data: agente } = await supabase
    .from("agentes").select("rol").eq("email", userData.user.email).maybeSingle();
  return agente?.rol === "Admin";
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (!(await requireAdmin(req))) {
    return res.status(401).json({ error: "No autorizado" });
  }

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
    // Alcance limitado a rol=Comercial: este endpoint es solo para
    // Comerciales, no debe poder borrar cuentas Admin/Agente aunque
    // alguien adivine o filtre un id ajeno.
    const { error } = await supabase.from("agentes").delete().eq("id", id).eq("rol", "Comercial");
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Método no permitido" });
}
