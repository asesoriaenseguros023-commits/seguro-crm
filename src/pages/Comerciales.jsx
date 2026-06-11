import { useState, useEffect } from "react";
import { S, BLUE } from "../constants.js";

const API = "/api/comerciales";

const ComercialPage = ({ showConfirm }) => {
  const [agentes, setAgentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nuevo, setNuevo] = useState("");
  const [saving, setSaving] = useState(false);

  const cargar = async () => {
    const res = await fetch(API);
    const data = await res.json();
    if (Array.isArray(data)) setAgentes(data);
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const add = async () => {
    const nombre = nuevo.trim().toUpperCase();
    if (!nombre || agentes.some(a => a.nombre.toUpperCase() === nombre)) return;
    setSaving(true);
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre }),
    });
    const data = await res.json();
    if (data.error) console.error(data.error);
    await cargar();
    setNuevo(""); setSaving(false);
  };

  const remove = async (id, nombre) => {
    const ok = await showConfirm(`¿Eliminar a ${nombre}?`, "Los leads asignados quedarán como 'Sin asignar'.");
    if (!ok) return;
    await fetch(`${API}?id=${id}`, { method: "DELETE" });
    await cargar();
  };

  const inpS = { background: "#f8faff", border: `1px solid ${BLUE.border}`, borderRadius: 8, padding: "10px 14px", color: BLUE.text, fontSize: 13.5, outline: "none", fontFamily: "inherit", boxSizing: "border-box", width: "100%" };

  return (
    <div>
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>Comerciales</div>
          <div style={S.pageSub}>{agentes.length} agentes registrados</div>
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
          <div style={{ padding: 48, textAlign: "center", color: "#aaa" }}>Sin comerciales registrados. Agrega el primero.</div>
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
              <button onClick={() => remove(a.id, a.nombre)}
                style={{ ...S.btn("danger"), padding: "5px 12px", fontSize: 12 }}>
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ComercialPage;
