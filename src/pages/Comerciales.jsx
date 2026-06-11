import { useState, useEffect } from "react";
import { supabase } from "../supabase.js";
import { S, BLUE } from "../constants.js";

const ComercialPage = ({ showConfirm }) => {
  const [agentes, setAgentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nuevo, setNuevo] = useState("");
  const [saving, setSaving] = useState(false);

  const cargar = async () => {
    const { data } = await supabase.from("soat_agentes").select("*").order("created_at", { ascending: true });
    if (data) setAgentes(data);
    setLoading(false);
  };

  useEffect(() => {
    cargar();
    const ch = supabase.channel("comerciales-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "soat_agentes" }, cargar)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const add = async () => {
    const nombre = nuevo.trim().toUpperCase();
    if (!nombre || agentes.some(a => a.nombre.toUpperCase() === nombre)) return;
    setSaving(true);
    await supabase.from("soat_agentes").insert({ nombre });
    setNuevo(""); setSaving(false);
  };

  const remove = async (id, nombre) => {
    const ok = await showConfirm(`¿Eliminar a ${nombre}?`, "Los leads asignados a este comercial quedarán como 'Sin asignar'.");
    if (!ok) return;
    await supabase.from("soat_agentes").delete().eq("id", id);
  };

  const inpS = { background: "#f8faff", border: `1px solid ${BLUE.border}`, borderRadius: 8, padding: "10px 14px", color: BLUE.text, fontSize: 13.5, outline: "none", fontFamily: "inherit", boxSizing: "border-box", width: "100%" };

  return (
    <div>
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>Comerciales</div>
          <div style={S.pageSub}>{agentes.filter(a => a.nombre !== "Sin asignar").length} agentes registrados</div>
        </div>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${BLUE.border}`, borderRadius: 12, padding: "20px 24px", marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: BLUE.text, marginBottom: 14 }}>Agregar nuevo comercial</div>
        <div style={{ display: "flex", gap: 12 }}>
          <input
            value={nuevo}
            onChange={e => setNuevo(e.target.value)}
            onKeyDown={e => e.key === "Enter" && add()}
            placeholder="Nombre del comercial (ej: CAROLINA PEREZ)"
            style={{ ...inpS, flex: 1 }}
          />
          <button onClick={add} disabled={saving || !nuevo.trim()}
            style={{ ...S.btn("primary"), opacity: nuevo.trim() ? 1 : 0.4, whiteSpace: "nowrap" }}>
            + Agregar
          </button>
        </div>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${BLUE.border}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(26,86,219,0.06)" }}>
        <div style={{ ...S.tableHead, display: "grid", gridTemplateColumns: "1fr 180px 100px" }}>
          <span>Nombre</span>
          <span>Fecha de registro</span>
          <span></span>
        </div>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "#aaa" }}>Cargando...</div>
        ) : agentes.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "#aaa" }}>Sin comerciales registrados.</div>
        ) : agentes.map((a, i) => (
          <div key={a.id}
            style={{ ...S.tableRow, display: "grid", gridTemplateColumns: "1fr 180px 100px" }}
            onMouseEnter={e => e.currentTarget.style.background = BLUE.light}
            onMouseLeave={e => e.currentTarget.style.background = ""}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: `hsl(${(i * 67) % 360},60%,55%)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                {a.nombre.split(" ").slice(0, 2).map(w => w[0]).join("")}
              </div>
              <span style={{ fontWeight: 600, color: BLUE.text }}>{a.nombre}</span>
            </div>
            <div style={{ fontSize: 12.5, color: "#888" }}>
              {a.created_at ? new Date(a.created_at).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" }) : "—"}
            </div>
            <div>
              {a.nombre !== "Sin asignar" && (
                <button onClick={() => remove(a.id, a.nombre)}
                  style={{ ...S.btn("danger"), padding: "5px 12px", fontSize: 12 }}>
                  Eliminar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ComercialPage;
