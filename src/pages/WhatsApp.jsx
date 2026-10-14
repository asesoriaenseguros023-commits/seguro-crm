import { useState, useEffect } from "react";
import { supabase } from "../supabase.js";
import { S, BLUE, FM_WHATSAPP, ESTADOS_WHATSAPP } from "../constants.js";

const COLUMNS = "2fr 1.1fr 2.5fr 1.2fr 1.3fr";

const fmtFecha = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

// Lista las conversaciones de WhatsApp iniciadas desde Seguimiento SOAT
// (tabla whatsapp_conversaciones, ver supabase_whatsapp.sql). Misma fuente
// de datos que el indicador de estado en SOAT.jsx -- esta pantalla y esa no
// se "sincronizan" entre sí con código propio: ambas leen/escriben la misma
// tabla en tiempo real, así que un cambio en cualquiera de las dos aparece
// solo en la otra.
const WhatsAppPage = () => {
  const [conversaciones, setConversaciones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("whatsapp_conversaciones")
      .select("*, soat_clientes(nombre, placa, fase)")
      .order("updated_at", { ascending: false })
      .then(({ data }) => { if (data) setConversaciones(data); setLoading(false); });

    const channel = supabase.channel("whatsapp-conversaciones")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversaciones" }, (payload) => {
        if (payload.eventType === "INSERT")
          setConversaciones(p => p.some(x => x.id === payload.new.id) ? p : [payload.new, ...p]);
        if (payload.eventType === "UPDATE")
          setConversaciones(p => p.map(x => x.id === payload.new.id ? { ...x, ...payload.new } : x));
        if (payload.eventType === "DELETE")
          setConversaciones(p => p.filter(x => x.id !== payload.old.id));
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const updateEstado = async (id, estado) => {
    setConversaciones(p => p.map(c => c.id === id ? { ...c, estado } : c));
    await supabase.from("whatsapp_conversaciones").update({ estado }).eq("id", id);
  };

  return (
    <div>
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>WhatsApp</div>
          <div style={S.pageSub}>Conversaciones iniciadas desde Seguimiento SOAT</div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: "center", color: "#aaa" }}>Cargando…</div>
      ) : conversaciones.length === 0 ? (
        <div style={{ ...S.tableWrap, padding: 48, textAlign: "center", color: "#aaa", fontSize: 14 }}>
          Todavía no se ha enviado ningún WhatsApp. Usa el ícono verde en Seguimiento SOAT para empezar.
        </div>
      ) : (
        <div style={S.tableWrap}>
          <div style={{ ...S.tableHead, gridTemplateColumns: COLUMNS }}>
            <div>Cliente</div>
            <div>Teléfono</div>
            <div>Último mensaje</div>
            <div>Estado</div>
            <div>Actualizado</div>
          </div>
          {conversaciones.map((c) => {
            const estado = FM_WHATSAPP[c.estado] || ESTADOS_WHATSAPP[0];
            return (
              <div key={c.id} style={{ ...S.tableRow, gridTemplateColumns: COLUMNS }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: BLUE.primary }}>{c.soat_clientes?.nombre || c.nombre || "—"}</div>
                  {c.soat_clientes?.placa && <div style={{ fontSize: 11, color: "#888" }}>{c.soat_clientes.placa}</div>}
                </div>
                <div style={{ fontSize: 12.5, color: "#555" }}>{c.telefono}</div>
                <div style={{ fontSize: 12.5, color: "#555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.ultimo_mensaje}>
                  {c.ultimo_mensaje || "—"}
                  {c.error && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 2 }}>{c.error}</div>}
                </div>
                <div>
                  <select value={c.estado} onChange={(e) => updateEstado(c.id, e.target.value)}
                    style={{ fontSize: 11.5, padding: "4px 8px", borderRadius: 6, border: `1.5px solid ${estado.color}`, background: estado.bg, color: estado.text, cursor: "pointer", outline: "none", fontWeight: 700 }}>
                    {ESTADOS_WHATSAPP.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                  </select>
                </div>
                <div style={{ fontSize: 11.5, color: "#999" }}>{fmtFecha(c.updated_at)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WhatsAppPage;
