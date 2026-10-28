import { useState, useEffect } from "react";
import { supabase } from "../supabase.js";

// Aviso en la barra superior: mensajes de WhatsApp que el cliente envió y nadie
// ha respondido, solo mientras su ventana de 24 horas sigue abierta. Se ve en
// todos los módulos; al tocarlo abre el chat de esa persona.
const VENTANA_MS = 24 * 60 * 60 * 1000;
const RECIENTE_MS = 15 * 60 * 1000;

const fmtRestante = (ms) => {
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
};

const AvisoWhatsapp = ({ onAbrir, compacto }) => {
  const [pendientes, setPendientes] = useState([]);
  const [ahora, setAhora] = useState(null);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      const desde = new Date(Date.now() - VENTANA_MS).toISOString();
      const { data: cvs } = await supabase.from("whatsapp_conversaciones")
        .select("id, cliente_id, nombre, ultima_entrante_at, desmarcada_at, soat_clientes(nombre)")
        .gte("ultima_entrante_at", desde);
      if (cancelado) return;
      if (!cvs || cvs.length === 0) { setPendientes([]); setAhora(Date.now()); return; }
      const { data: ms } = await supabase.from("whatsapp_mensajes")
        .select("conversacion_id, direccion, created_at").in("conversacion_id", cvs.map(c => c.id))
        .order("created_at", { ascending: false });
      if (cancelado) return;
      const ultimo = new Map();
      (ms || []).forEach(m => { if (!ultimo.has(m.conversacion_id)) ultimo.set(m.conversacion_id, m); });
      const lista = cvs.map(c => {
        const u = ultimo.get(c.id);
        if (!u || u.direccion !== "entrante") return null;
        if (c.desmarcada_at && new Date(c.desmarcada_at) >= new Date(u.created_at)) return null;
        return { clienteId: c.cliente_id, nombre: c.soat_clientes?.nombre || c.nombre || "Cliente", recibido: new Date(u.created_at).getTime(), cierra: new Date(c.ultima_entrante_at).getTime() + VENTANA_MS };
      }).filter(Boolean).sort((a, b) => a.cierra - b.cierra);
      setPendientes(lista); setAhora(Date.now());
    }
    cargar();
    const id = setInterval(cargar, 20000);
    const canal = supabase.channel("aviso-whatsapp")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_mensajes" }, cargar)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "whatsapp_conversaciones" }, cargar)
      .subscribe();
    return () => { cancelado = true; clearInterval(id); supabase.removeChannel(canal); };
  }, []);

  const vigentes = ahora ? pendientes.filter(p => p.cierra > ahora) : [];
  if (vigentes.length === 0) return null;
  const urgente = vigentes[0];
  const reciente = vigentes.length === 1 && ahora - urgente.recibido < RECIENTE_MS;
  const texto = vigentes.length === 1
    ? (reciente ? `Nuevo mensaje de ${urgente.nombre}` : `Mensaje sin responder de ${urgente.nombre}`)
    : `${vigentes.length} mensajes sin responder`;
  const detalle = vigentes.length === 1
    ? `quedan ${fmtRestante(urgente.cierra - ahora)} para responder`
    : `más urgente: ${urgente.nombre} · quedan ${fmtRestante(urgente.cierra - ahora)}`;

  return (
    <button onClick={() => onAbrir(urgente.clienteId)} title={`${texto} (${detalle})`}
      style={{ display: "flex", alignItems: "center", gap: 8, background: "#e7fce3", border: "1.5px solid #25d366", color: "#0b5c43", borderRadius: 22, padding: compacto ? "4px 10px" : "6px 14px", cursor: "pointer", fontFamily: "inherit", maxWidth: compacto ? 170 : 420, minWidth: 0, textAlign: "left" }}>
      <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#25d366", flexShrink: 0, boxShadow: "0 0 0 4px rgba(37,211,102,0.25)" }} />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: compacto ? 11.5 : 13, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{texto}</span>
        {!compacto && <span style={{ display: "block", fontSize: 11, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{detalle}</span>}
      </span>
    </button>
  );
};

export default AvisoWhatsapp;
