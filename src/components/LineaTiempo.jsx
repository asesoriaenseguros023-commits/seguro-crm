import { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabase.js";
import { BLUE, FM_SOAT } from "../constants.js";

// Línea de tiempo única del cliente: junta en una sola lista las llamadas de
// Twilio (soat_llamadas), los registros que anota el asesor (historial de
// soat_clientes) y los mensajes de WhatsApp (whatsapp_mensajes). Solo lee, no
// cambia ningún dato. Se usa en la ficha de Seguimiento SOAT y en el chat.

const ESTADO_LLAMADA = { "no-answer": "No contestó", buzon: "Buzón de voz", completed: "Llamada contestada", failed: "La llamada falló", busy: "Ocupado", canceled: "Cancelada" };

const parseFechaManual = (s) => {
  const p = String(s || "").split("/");
  if (p.length !== 3) return null;
  const d = new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]), 23, 59, 59);
  return isNaN(d) ? null : d;
};
const fmtMin = (seg) => `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, "0")}`;
const fmtHora = (d) => d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
const fmtDia = (d) => {
  const hoy = new Date(); const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
  if (d.toDateString() === hoy.toDateString()) return "Hoy";
  if (d.toDateString() === ayer.toDateString()) return "Ayer";
  const t = d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: d.getFullYear() !== hoy.getFullYear() ? "numeric" : undefined });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const COLOR = { llamada: BLUE.primary, registro: "#d97706", whatsapp: "#0e7c63" };
const ETIQUETA = { llamada: "Llamada", registro: "Registro del asesor", whatsapp: "WhatsApp" };

const LineaTiempo = ({ clienteId, historial = [], incluirWhatsapp = true, altoMax = 420 }) => {
  const [llamadas, setLlamadas] = useState([]);
  const [mensajes, setMensajes] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!clienteId) return;
    let cancelado = false;
    async function cargar() {
      const { data: ll } = await supabase.from("soat_llamadas").select("id, estado, duracion_seg, created_at").eq("cliente_id", clienteId);
      let ms = [];
      if (incluirWhatsapp) {
        const { data: cv } = await supabase.from("whatsapp_conversaciones").select("id").eq("cliente_id", clienteId).maybeSingle();
        if (cv?.id) {
          const r = await supabase.from("whatsapp_mensajes").select("id, direccion, tipo, contenido, estado, created_at, media_path").eq("conversacion_id", cv.id);
          ms = r.data || [];
        }
      }
      if (cancelado) return;
      setLlamadas(ll || []); setMensajes(ms); setCargando(false);
    }
    cargar();
    const id = setInterval(cargar, 20000);
    return () => { cancelado = true; clearInterval(id); };
  }, [clienteId, incluirWhatsapp]);

  const eventos = useMemo(() => {
    const out = [];
    llamadas.forEach(l => {
      const e = ESTADO_LLAMADA[l.estado] || l.estado || "Llamada";
      out.push({ k: "l" + l.id, tipo: "llamada", fecha: new Date(l.created_at), hora: true,
        titulo: l.estado === "completed" && l.duracion_seg ? `${e} · ${fmtMin(l.duracion_seg)}` : e });
    });
    (historial || []).forEach((h, i) => {
      const f = parseFechaManual(h.fecha); if (!f) return;
      const partes = [FM_SOAT[h.resultado]?.label || h.resultado];
      if (h.motivo || h.motivoIloc) partes.push(h.motivo || h.motivoIloc);
      out.push({ k: "h" + i, tipo: "registro", fecha: f, hora: false, titulo: partes.filter(Boolean).join(" · "),
        detalle: [h.nota ? `"${h.nota}"` : "", h.proximaAccion ? `Acción: ${h.proximaAccion}${h.fechaProxima ? ` el ${h.fechaProxima}` : ""}` : ""].filter(Boolean).join("  ·  "), quien: h.agente });
    });
    mensajes.forEach(m => {
      const saliente = m.direccion === "saliente";
      const texto = m.contenido || (m.media_path ? "Archivo adjunto" : "");
      out.push({ k: "m" + m.id, tipo: "whatsapp", fecha: new Date(m.created_at), hora: true,
        titulo: m.tipo === "plantilla" ? "Plantilla enviada" : saliente ? "Mensaje enviado" : "El cliente escribió",
        detalle: texto.length > 160 ? texto.slice(0, 160) + "…" : texto, estado: saliente ? m.estado : null });
    });
    out.sort((a, b) => b.fecha - a.fecha);
    return out.map((ev, i) => ({ ...ev, cabecera: i === 0 || out[i - 1].fecha.toDateString() !== ev.fecha.toDateString() }));
  }, [llamadas, mensajes, historial]);

  if (cargando) return <div style={{ padding: 24, textAlign: "center", color: "#aaa", fontSize: 13 }}>Cargando…</div>;
  if (eventos.length === 0) return <div style={{ padding: 24, textAlign: "center", color: "#aaa", fontSize: 13.5 }}>Todavía no hay contactos con este cliente.</div>;

  return (
    <div style={{ maxHeight: altoMax, overflowY: "auto", textAlign: "left", paddingRight: 4 }}>
      {eventos.map(ev => {
        return (
          <div key={ev.k}>
            {ev.cabecera && <div style={{ fontSize: 11.5, fontWeight: 700, color: "#7b8794", margin: "12px 0 6px" }}>{fmtDia(ev.fecha)}</div>}
            <div style={{ display: "flex", gap: 10, padding: "6px 0" }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: COLOR[ev.tipo], marginTop: 5, flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1f2a37" }}>{ev.titulo}</div>
                  <div style={{ fontSize: 11.5, color: "#9aa5b1", flexShrink: 0 }}>{ev.hora ? fmtHora(ev.fecha) : ""}</div>
                </div>
                <div style={{ fontSize: 11.5, color: COLOR[ev.tipo], fontWeight: 600 }}>
                  {ETIQUETA[ev.tipo]}{ev.quien ? ` · ${ev.quien}` : ""}{ev.estado ? ` · ${ev.estado}` : ""}
                </div>
                {ev.detalle && <div style={{ fontSize: 12.5, color: "#52606d", marginTop: 2, wordBreak: "break-word" }}>{ev.detalle}</div>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default LineaTiempo;
