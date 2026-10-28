import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../supabase.js";
import { S, FM_MENSAJE_WA, FM_SOAT, FASES_SOAT, ACCIONES_SOAT, PLANTILLAS_WA } from "../constants.js";
import { authHeaders } from "../helpers.js";
import Icon from "../components/Icon.jsx";
import Cotizador from "../components/Cotizador.jsx";

const REACCIONES = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
const EMOJIS = [
  "😀","😃","😄","😁","😊","🙂","😉","😍","🥰","😘","😎","🤗","🤝","👍","👌","🙏","👏","💪","🙌","👋",
  "😂","🤣","😅","😇","🤔","😮","😢","😭","😡","🤦","🙄","😴","❤️","💙","💚","🔥","✨","🎉","✅","❌",
  "🚗","🏍️","🚙","🛵","📄","📋","📅","⏰","📞","💰","💳","🏦","📍","⚠️","ℹ️","⭐"
];

const VENTANA_24H_MS = 24 * 60 * 60 * 1000;

// Paleta propia de este módulo -- a diferencia de los otros dashboards
// (unificados a BLUE.primary, ver [[project-seguro-crm]]), acá el usuario
// pidió explícitamente que se vea y se sienta como la app real de WhatsApp,
// con sus verdes característicos.
const WA = {
  header: "#008069",
  panel: "#f0f2f5",
  tick: "#53bdeb",
  bubbleOut: "#d9fdd3",
  bubbleOutBorder: "#bbf0ae",
  bubbleIn: "#ffffff",
  bubbleInBorder: "#e9e9e9",
  chatBg: "#efeae2",
  accent: "#25d366",
  accentDark: "#1da851",
  listSelected: "#f0f2f5",
  textMuted: "#667781",
};

const fmtHora = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const hoy = new Date();
  const esHoy = d.toDateString() === hoy.toDateString();
  return esHoy
    ? d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit" });
};

// ✓ enviado, ✓✓ entregado, ✓✓ (azul) leído, ⚠ fallido -- mismo mapeo de
// color que FM_MENSAJE_WA (constants.js), aplicado por mensaje saliente.
const TickMensaje = ({ estado, error }) => {
  const fm = FM_MENSAJE_WA[estado];
  if (estado === "fallido") return <span title={error || "Falló"} style={{ color: fm?.color, fontSize: 11 }}>⚠ Falló</span>;
  const marca = estado === "enviado" ? "✓" : "✓✓";
  return <span title={fm?.label || estado} style={{ color: estado === "leido" ? WA.tick : WA.textMuted, fontSize: 12, fontWeight: estado === "leido" ? 700 : 400 }}>{marca}</span>;
};

// Archivo adjunto de un mensaje (foto, audio, video, documento). El bucket
// "whatsapp-media" es privado: se pide un link firmado de una hora. Los
// audios de WhatsApp son OGG/Opus: Chrome, Edge y Firefox los reproducen; en
// Safari puede no sonar, por eso siempre se deja el link para abrir/descargar.
const ETIQUETA_MEDIA = { image: "📷 Foto", audio: "🎤 Audio", video: "🎥 Video", document: "📄 Documento" };

const MediaMensaje = ({ m }) => {
  const [url, setUrl] = useState(null);
  const [fallo, setFallo] = useState(false);
  useEffect(() => {
    let cancelado = false;
    async function pedir() {
      const { data, error } = await supabase.storage.from("whatsapp-media").createSignedUrl(m.media_path, 3600);
      if (cancelado) return;
      if (error || !data?.signedUrl) setFallo(true); else setUrl(data.signedUrl);
    }
    pedir();
    return () => { cancelado = true; };
  }, [m.media_path]);

  if (fallo) return <div style={{ fontSize: 12.5, color: "#dc2626" }}>No se pudo cargar el archivo.</div>;
  if (!url) return <div style={{ fontSize: 12.5, color: WA.textMuted }}>Cargando archivo…</div>;
  const enlace = <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: WA.header }}>Abrir / descargar</a>;
  if (m.tipo === "image") return <div><a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Foto recibida" style={{ maxWidth: 260, maxHeight: 300, borderRadius: 6, display: "block" }} /></a></div>;
  if (m.tipo === "video") return <div><video src={url} controls preload="metadata" style={{ maxWidth: 280, borderRadius: 6, display: "block" }} />{enlace}</div>;
  if (m.tipo === "audio") return <div><audio src={url} controls preload="metadata" style={{ width: 240, display: "block" }} />{enlace}</div>;
  return <div style={{ fontSize: 13 }}>📄 {m.media_nombre || "Documento"} · {enlace}</div>;
};

// Chat real del módulo WhatsApp: lista de conversaciones a la izquierda,
// hilo de whatsapp_mensajes + caja de texto a la derecha (ver
// supabase_whatsapp_chat.sql y api/whatsapp.js). whatsapp_conversaciones es
// una fila por cliente; el hilo completo vive en whatsapp_mensajes.

const fmtDia = (iso) => {
  const d = new Date(iso); const hoy = new Date();
  const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
  if (d.toDateString() === hoy.toDateString()) return "Hoy";
  if (d.toDateString() === ayer.toDateString()) return "Ayer";
  return d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
};
const COLORES_AVATAR = ["#6b7cff", "#e5733b", "#2aa876", "#c2559e", "#3b8fd9", "#b68a1f", "#7d5fd0", "#d1495b"];
const iniciales = (nombre) => (String(nombre || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0] || "").join("") || "?").toUpperCase();
const colorAvatar = (nombre) => { let h = 0; for (const ch of String(nombre || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return COLORES_AVATAR[h % COLORES_AVATAR.length]; };
const Avatar = ({ nombre, size = 46 }) => (
  <div style={{ width: size, height: size, borderRadius: "50%", background: colorAvatar(nombre), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: size * 0.36, flexShrink: 0 }}>{iniciales(nombre)}</div>
);

const WhatsAppPage = ({ clienteIdInicial }) => {
  const [conversaciones, setConversaciones] = useState([]);
  const [mensajes, setMensajes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seleccionadaId, setSeleccionadaId] = useState(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState("");
  const [cotizando, setCotizando] = useState(false);
  const [hoverMsg, setHoverMsg] = useState(null);       // burbuja bajo el cursor
  const [pickerMsg, setPickerMsg] = useState(null);     // burbuja con el selector de reacción abierto
  const [mostrarEmojis, setMostrarEmojis] = useState(false);
  const textareaRef = useRef(null);
  // "ahora" en state (no Date.now() directo en el render, que es impuro) --
  // se refresca cada minuto para que la ventana de 24h se cierre sola en
  // pantalla sin que el agente tenga que recargar.
  const [ahora, setAhora] = useState(null);
  const [filtroResp, setFiltroResp] = useState("todos");
  const [busqueda, setBusqueda] = useState("");   // todos | respondieron | nunca

  useEffect(() => {
    // Carga completa. Se repite cada 15 s, al volver a la pestaña y cuando el
    // canal en vivo falla: el realtime a veces se queda dormido (pestaña
    // inactiva, red) y sin esto los mensajes nuevos no aparecían hasta recargar.
    let cancelado = false;
    async function cargar() {
      const [convRes, msgRes] = await Promise.all([
        supabase.from("whatsapp_conversaciones").select("*, soat_clientes(nombre, placa, tipo_vehiculo, fase, fecha_vencimiento, proxima_accion, fecha_proxima)").order("updated_at", { ascending: false }),
        supabase.from("whatsapp_mensajes").select("*").order("created_at", { ascending: true }),
      ]);
      if (cancelado) return;
      if (convRes.data) setConversaciones(convRes.data);
      if (msgRes.data) setMensajes(msgRes.data);
      setLoading(false);
    }
    cargar();
    const intervalo = setInterval(cargar, 15000);
    const alVolver = () => { if (document.visibilityState === "visible") cargar(); };
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", alVolver);

    const channel = supabase.channel("whatsapp-chat")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversaciones" }, (payload) => {
        if (payload.eventType === "INSERT") setConversaciones(p => p.some(x => x.id === payload.new.id) ? p : [payload.new, ...p]);
        if (payload.eventType === "UPDATE") setConversaciones(p => p.map(x => x.id === payload.new.id ? { ...x, ...payload.new } : x));
        if (payload.eventType === "DELETE") setConversaciones(p => p.filter(x => x.id !== payload.old.id));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "soat_clientes" }, (payload) => {
        const n = payload.new;
        setConversaciones(p => p.map(x => x.cliente_id === n.id ? { ...x, soat_clientes: { ...x.soat_clientes, fase: n.fase, nombre: n.nombre, placa: n.placa, tipo_vehiculo: n.tipo_vehiculo, fecha_vencimiento: n.fecha_vencimiento, proxima_accion: n.proxima_accion, fecha_proxima: n.fecha_proxima } } : x));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_mensajes" }, (payload) => {
        if (payload.eventType === "INSERT") setMensajes(p => p.some(x => x.id === payload.new.id) ? p : [...p, payload.new]);
        if (payload.eventType === "UPDATE") setMensajes(p => p.map(x => x.id === payload.new.id ? { ...x, ...payload.new } : x));
        if (payload.eventType === "DELETE") setMensajes(p => p.filter(x => x.id !== payload.old.id));
      })
      .subscribe((estado) => {
        if (estado === "CHANNEL_ERROR" || estado === "TIMED_OUT" || estado === "CLOSED") cargar();
      });

    return () => {
      cancelado = true;
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", alVolver);
      supabase.removeChannel(channel);
    };
  }, []);

  // Al entrar desde el ícono de WhatsApp en Seguimiento SOAT (App.jsx pasa
  // el cliente_id de donde se hizo clic) -- selecciona esa conversación una
  // vez que ya cargaron.
  useEffect(() => {
    function seleccionarInicial() {
      if (!clienteIdInicial || seleccionadaId) return;
      const conv = conversaciones.find(c => c.cliente_id === clienteIdInicial);
      if (conv) setSeleccionadaId(conv.id);
    }
    seleccionarInicial();
  }, [clienteIdInicial, conversaciones, seleccionadaId]);

  useEffect(() => {
    function tick() { setAhora(Date.now()); }
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  const ultimoPorConversacion = useMemo(() => {
    const map = {};
    mensajes.forEach(m => {
      const prev = map[m.conversacion_id];
      if (!prev || new Date(m.created_at) > new Date(prev.created_at)) map[m.conversacion_id] = m;
    });
    return map;
  }, [mensajes]);

  // Arriba van las conversaciones SIN RESPONDER (el último mensaje es del
  // cliente y nadie le ha contestado), las más recientes primero; después el
  // resto, también por el mensaje más reciente.
  const listaOrdenada = useMemo(() => {
    const t = (c) => new Date(ultimoPorConversacion[c.id]?.created_at || c.updated_at || 0).getTime();
    return conversaciones
      .map(c => {
        const ult = ultimoPorConversacion[c.id];
        // Sin responder = el último mensaje es del cliente y nadie lo ha desmarcado
        // después de ese mensaje (un mensaje nuevo suyo lo vuelve a marcar).
        const desmarcada = !!c.desmarcada_at && !!ult && new Date(c.desmarcada_at) >= new Date(ult.created_at);
        return { c, sinResponder: ult?.direccion === "entrante" && !desmarcada };
      })
      .sort((a, b) => (a.sinResponder === b.sinResponder ? t(b.c) - t(a.c) : a.sinResponder ? -1 : 1));
  }, [conversaciones, ultimoPorConversacion]);
  const totalSinResponder = listaOrdenada.filter(x => x.sinResponder).length;

  // Conversaciones donde el cliente escribió alguna vez (cualquier mensaje entrante) vs. las que nunca respondió.
  const conRespuesta = useMemo(() => {
    const ids = new Set();
    mensajes.forEach(m => { if (m.direccion === "entrante") ids.add(m.conversacion_id); });
    return ids;
  }, [mensajes]);
  const totalRespondieron = conversaciones.filter(c => conRespuesta.has(c.id)).length;
  const totalNunca = conversaciones.length - totalRespondieron;
  const q = busqueda.trim().toLowerCase();
  const listaVisible = listaOrdenada.filter(({ c }) =>
    (filtroResp === "todos" ? true : filtroResp === "respondieron" ? conRespuesta.has(c.id) : !conRespuesta.has(c.id))
    && (!q || (c.soat_clientes?.nombre || c.nombre || "").toLowerCase().includes(q) || (c.telefono || "").includes(q) || (c.soat_clientes?.placa || "").toLowerCase().includes(q)));

  const seleccionada = conversaciones.find(c => c.id === seleccionadaId) || null;
  const mensajesSeleccionados = useMemo(
    () => mensajes.filter(m => m.conversacion_id === seleccionadaId),
    [mensajes, seleccionadaId]
  );
  const ventanaAbierta = !!seleccionada?.ultima_entrante_at && !!ahora
    && ahora - new Date(seleccionada.ultima_entrante_at).getTime() < VENTANA_24H_MS;

  // Segundo contacto: plantillas aprobadas que a este cliente aún no se le han
  // enviado (cada una se manda una sola vez; las fallidas no cuentan).
  const [plantillaElegida, setPlantillaElegida] = useState("");
  const plantillasDisponibles = useMemo(() => {
    const usadas = new Set(mensajesSeleccionados
      .filter(m => m.direccion === "saliente" && m.tipo === "plantilla" && m.estado !== "fallido")
      .map(m => m.plantilla || "soat_seguimiento_lead"));
    return PLANTILLAS_WA.filter(p => p.aprobada && !usadas.has(p.id));
  }, [mensajesSeleccionados]);
  const plantillaActual = plantillasDisponibles.some(p => p.id === plantillaElegida) ? plantillaElegida : (plantillasDisponibles[0]?.id || "");

  const enviarPlantillaElegida = async () => {
    if (!seleccionada || !plantillaActual || enviando) return;
    setEnviando(true); setErrorEnvio("");
    try {
      const res = await fetch("/api/whatsapp?action=enviar-seguimiento-soat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ telefono: seleccionada.telefono, nombre: seleccionada.nombre || seleccionada.soat_clientes?.nombre, clienteId: seleccionada.cliente_id, plantilla: plantillaActual }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Error al enviar");
    } catch (err) {
      setErrorEnvio(err.message);
    }
    setEnviando(false);
  };

  // Mismo campo (soat_clientes.fase) y mismas reglas que Seguimiento SOAT:
  // "Compró" y "No interesado" limpian la próxima acción. Seguimiento SOAT se
  // entera solo por realtime, y viceversa (suscripción más abajo).
  const cambiarEstado = async (conv, fase) => {
    const antes = conv.soat_clientes?.fase;
    setConversaciones(p => p.map(x => x.id === conv.id ? { ...x, soat_clientes: { ...x.soat_clientes, fase } } : x));
    const patch = { fase, ...(["compro", "no_interes"].includes(fase) ? { proxima_accion: "", fecha_proxima: "" } : {}) };
    const { error } = await supabase.from("soat_clientes").update(patch).eq("id", conv.cliente_id);
    if (error) {
      setConversaciones(p => p.map(x => x.id === conv.id ? { ...x, soat_clientes: { ...x.soat_clientes, fase: antes } } : x));
      setErrorEnvio(`No se pudo cambiar el estado: ${error.message}`);
    }
  };

  // Próxima acción y fecha: mismos campos que en Seguimiento SOAT (soat_clientes).
  const cambiarProximaAccion = async (conv, campo, valor) => {
    const previo = conv.soat_clientes?.[campo] ?? "";
    setConversaciones(p => p.map(x => x.id === conv.id ? { ...x, soat_clientes: { ...x.soat_clientes, [campo]: valor } } : x));
    const { error } = await supabase.from("soat_clientes").update({ [campo]: valor }).eq("id", conv.cliente_id);
    if (error) {
      setConversaciones(p => p.map(x => x.id === conv.id ? { ...x, soat_clientes: { ...x.soat_clientes, [campo]: previo } } : x));
      setErrorEnvio(`No se pudo guardar: ${error.message}`);
    }
  };

  // Quita la marca de "sin responder" sin contestar (queda guardado en la
  // conversación; si el cliente vuelve a escribir, se marca otra vez).
  // Requiere supabase_whatsapp_desmarcar.sql.
  const desmarcarConversacion = async (conv) => {
    const ahoraIso = new Date().toISOString();
    const previo = conv.desmarcada_at || null;
    setConversaciones(p => p.map(x => x.id === conv.id ? { ...x, desmarcada_at: ahoraIso } : x));
    const { error } = await supabase.from("whatsapp_conversaciones").update({ desmarcada_at: ahoraIso }).eq("id", conv.id);
    if (error) {
      setConversaciones(p => p.map(x => x.id === conv.id ? { ...x, desmarcada_at: previo } : x));
      setErrorEnvio(`No se pudo desmarcar: ${error.message}`);
    }
  };

  const reaccionar = async (m, emoji) => {
    setPickerMsg(null); setErrorEnvio("");
    const nuevo = m.reaccion_agente === emoji ? "" : emoji;   // mismo emoji otra vez = quitarla
    setMensajes(p => p.map(x => x.id === m.id ? { ...x, reaccion_agente: nuevo || null } : x));
    try {
      const res = await fetch("/api/whatsapp?action=enviar-reaccion", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ mensajeId: m.id, emoji: nuevo }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Error al reaccionar");
    } catch (err) {
      setMensajes(p => p.map(x => x.id === m.id ? { ...x, reaccion_agente: m.reaccion_agente || null } : x));
      setErrorEnvio(err.message);
    }
  };

  const insertarEmoji = (emoji) => {
    const el = textareaRef.current;
    const ini = el?.selectionStart ?? texto.length, fin = el?.selectionEnd ?? texto.length;
    setTexto(texto.slice(0, ini) + emoji + texto.slice(fin));
    setTimeout(() => { if (el) { el.focus(); const pos = ini + emoji.length; el.setSelectionRange(pos, pos); } }, 0);
  };

  const enviarMensaje = async () => {
    if (!texto.trim() || !seleccionada || enviando) return;
    setEnviando(true); setErrorEnvio("");
    try {
      const res = await fetch("/api/whatsapp?action=enviar-mensaje", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ conversacionId: seleccionada.id, texto: texto.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Error al enviar");
      setTexto("");
      // Mostrar el mensaje de una vez, sin esperar al canal en vivo.
      if (json.mensaje) setMensajes(p => p.some(x => x.id === json.mensaje.id) ? p : [...p, json.mensaje]);
    } catch (err) {
      setErrorEnvio(err.message);
    }
    setEnviando(false);
  };


  return (
    <div style={{ textAlign: "left" }}>
      <div style={S.pageHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: WA.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0 }}>
            <Icon name="whatsapp" size={20} />
          </div>
          <div>
            <div style={S.pageTitle}>WhatsApp</div>
            <div style={S.pageSub}>Conversaciones iniciadas desde Seguimiento SOAT</div>
          </div>
        </div>
        <button style={S.btn("primary")} onClick={() => setCotizando(true)}>Cotizar SOAT</button>
      </div>
      {cotizando && <Cotizador onClose={() => setCotizando(false)} />}

      {loading ? (
        <div style={{ padding: 48, textAlign: "center", color: "#aaa" }}>Cargando…</div>
      ) : conversaciones.length === 0 ? (
        <div style={{ ...S.tableWrap, padding: 48, textAlign: "center", color: "#aaa", fontSize: 14 }}>
          Todavía no se ha enviado ningún WhatsApp. Usa el ícono verde en Seguimiento SOAT para empezar.
        </div>
      ) : (
        <div style={{ ...S.tableWrap, display: "flex", height: "calc(100vh - 170px)", minHeight: 440, overflow: "hidden", borderRadius: 10 }}>
          {/* ─── Lista de conversaciones ─── */}
          <div style={{ width: 360, flexShrink: 0, borderRight: "1px solid #e9e9e9", overflowY: "auto", background: "#fff" }}>
            <div style={{ padding: "8px 12px", background: "#fff", position: "sticky", top: 0, zIndex: 2 }}>
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre, teléfono o placa"
                style={{ width: "100%", boxSizing: "border-box", border: "none", background: WA.panel, borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
            </div>
            <div style={{ display: "flex", gap: 6, padding: "4px 12px 10px", borderBottom: "1px solid #e9e9e9", flexWrap: "wrap" }}>
              {[["todos", "Todos", conversaciones.length], ["respondieron", "Respondieron", totalRespondieron], ["nunca", "Nunca respondieron", totalNunca]].map(([id, etiqueta, n]) => (
                <button key={id} onClick={() => setFiltroResp(id)}
                  style={{ border: `1px solid ${WA.accent}`, background: filtroResp === id ? WA.accent : "#fff", color: filtroResp === id ? "#fff" : WA.header, borderRadius: 14, padding: "3px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
                  {etiqueta} ({n})
                </button>
              ))}
            </div>
            {totalSinResponder > 0 && (
              <div style={{ padding: "8px 16px", background: "#e7fce3", color: WA.header, fontSize: 12, fontWeight: 700, borderBottom: "1px solid #d4efcd" }}>
                {totalSinResponder} sin responder
              </div>
            )}
            {listaVisible.length === 0 && (
              <div style={{ padding: 24, textAlign: "center", color: "#aaa", fontSize: 13 }}>No hay conversaciones en este filtro.</div>
            )}
            {listaVisible.map(({ c, sinResponder }) => {
              const ultimo = ultimoPorConversacion[c.id];
              const activa = c.id === seleccionadaId;
              return (
                <div key={c.id} onClick={() => setSeleccionadaId(c.id)}
                  style={{ display: "flex", gap: 12, padding: "10px 14px", alignItems: "center", cursor: "pointer", background: activa ? WA.listSelected : "#fff", borderBottom: "1px solid #f3f3f3" }}>
                  <Avatar nombre={c.soat_clientes?.nombre || c.nombre} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                      <div style={{ fontWeight: sinResponder ? 700 : 500, fontSize: 15, color: "#111b21", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.soat_clientes?.nombre || c.nombre || "—"}
                      </div>
                      <div style={{ fontSize: 11.5, color: sinResponder ? WA.accentDark : WA.textMuted, fontWeight: sinResponder ? 700 : 400, flexShrink: 0 }}>{fmtHora(ultimo?.created_at || c.updated_at)}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                      <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: sinResponder ? "#111b21" : WA.textMuted, fontWeight: sinResponder ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {ultimo ? `${ultimo.direccion === "saliente" ? "Tú: " : ""}${ultimo.contenido || ETIQUETA_MEDIA[ultimo.tipo] || ""}` : "—"}
                      </div>
                      {sinResponder && (
                        <>
                          <span title="Sin responder" style={{ flexShrink: 0, background: WA.accent, width: 12, height: 12, borderRadius: "50%" }} />
                          <button onClick={(e) => { e.stopPropagation(); desmarcarConversacion(c); }} title="Quitar la marca sin responder (no envía nada)"
                            style={{ flexShrink: 0, border: `1px solid ${WA.accent}`, background: "#fff", color: WA.header, borderRadius: 10, padding: "0 7px", fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}>Desmarcar</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ─── Hilo + composer ─── */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            {!seleccionada ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", fontSize: 14 }}>
                Selecciona una conversación
              </div>
            ) : (
              <>
                <div style={{ background: WA.panel, borderBottom: "1px solid #e1e4e8" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px" }}>
                    <Avatar nombre={seleccionada.soat_clientes?.nombre || seleccionada.nombre} size={40} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 16, color: "#111b21", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{seleccionada.soat_clientes?.nombre || seleccionada.nombre || "—"}</div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12.5, color: WA.textMuted }}>
                        <span>{seleccionada.telefono}</span>
                        {seleccionada.soat_clientes?.placa && <span>Placa {seleccionada.soat_clientes.placa}</span>}
                        {seleccionada.soat_clientes?.tipo_vehiculo && <span>{seleccionada.soat_clientes.tipo_vehiculo}</span>}
                        {seleccionada.soat_clientes?.fecha_vencimiento && <span>Vence {seleccionada.soat_clientes.fecha_vencimiento}</span>}
                      </div>
                    </div>
                  </div>
                  {seleccionada.soat_clientes && (
                    <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", padding: "6px 16px 10px", fontSize: 12, color: WA.textMuted }}>
                      {(() => {
                        const f = FM_SOAT[seleccionada.soat_clientes.fase] || FM_SOAT.pendiente;
                        return (
                          <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <span>Estado</span>
                            <select value={seleccionada.soat_clientes.fase || "pendiente"} onChange={(e) => cambiarEstado(seleccionada, e.target.value)}
                              style={{ fontSize: 12, padding: "2px 8px", borderRadius: 12, border: `1.5px solid ${f.color}`, background: f.bg, color: f.text, fontWeight: 700, cursor: "pointer", outline: "none" }}>
                              {FASES_SOAT.map(x => <option key={x.id} value={x.id} disabled={x.id === "ilocalizable"} title={x.id === "ilocalizable" ? "Se marca automático tras 6 llamadas sin respuesta" : undefined}>{x.label}</option>)}
                            </select>
                          </label>
                        );
                      })()}
                      {!["compro", "no_interes"].includes(seleccionada.soat_clientes.fase) && (
                        <>
                          <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <span>Próxima acción</span>
                            <select value={seleccionada.soat_clientes.proxima_accion || ""} onChange={(e) => cambiarProximaAccion(seleccionada, "proxima_accion", e.target.value)}
                              style={{ fontSize: 12, padding: "2px 8px", borderRadius: 12, border: "1px solid #d1d7db", background: "#fff", color: "#111b21", fontWeight: 600, cursor: "pointer", outline: "none" }}>
                              <option value="">Sin definir</option>
                              {ACCIONES_SOAT.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                          </label>
                          <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <span>Fecha</span>
                            <input type="date" value={seleccionada.soat_clientes.fecha_proxima || ""} onChange={(e) => cambiarProximaAccion(seleccionada, "fecha_proxima", e.target.value)}
                              style={{ fontSize: 12, padding: "1px 6px", borderRadius: 12, border: "1px solid #d1d7db", background: "#fff", color: "#111b21", fontWeight: 600, outline: "none" }} />
                          </label>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ flex: 1, overflowY: "auto", padding: "14px 7%", display: "flex", flexDirection: "column", gap: 2, background: WA.chatBg }}>
                  {mensajesSeleccionados.length === 0 && (
                    <div style={{ textAlign: "center", color: WA.textMuted, fontSize: 13, marginTop: 20 }}>Sin mensajes todavía</div>
                  )}
                  {mensajesSeleccionados.map((m, idx) => {
                    const saliente = m.direccion === "saliente";
                    const previo = mensajesSeleccionados[idx - 1];
                    const nuevoDia = !previo || new Date(previo.created_at).toDateString() !== new Date(m.created_at).toDateString();
                    const primeroDelGrupo = nuevoDia || previo.direccion !== m.direccion;
                    return (
                      <div key={m.id} style={{ display: "flex", flexDirection: "column", marginTop: primeroDelGrupo ? 8 : 0 }}>
                        {nuevoDia && (
                          <div style={{ alignSelf: "center", margin: "8px 0 10px", background: "#fff", color: WA.textMuted, fontSize: 12, padding: "4px 12px", borderRadius: 8, boxShadow: "0 1px 1px rgba(0,0,0,0.1)", textTransform: "capitalize" }}>{fmtDia(m.created_at)}</div>
                        )}
                      <div style={{ display: "flex", justifyContent: saliente ? "flex-end" : "flex-start", alignItems: "center", gap: 6 }}
                        onMouseEnter={() => setHoverMsg(m.id)} onMouseLeave={() => setHoverMsg(null)}>
                        <div style={{
                          maxWidth: "65%", borderRadius: 8, padding: "6px 9px 5px 10px", position: "relative", marginBottom: m.reaccion || m.reaccion_agente ? 14 : 0,
                          ...(primeroDelGrupo ? (saliente ? { borderTopRightRadius: 0 } : { borderTopLeftRadius: 0 }) : {}),
                          background: saliente ? WA.bubbleOut : WA.bubbleIn,
                          boxShadow: "0 1px 0.5px rgba(11,20,26,0.13)",
                        }}>
                          {primeroDelGrupo && (
                            <span style={{ position: "absolute", top: 0, [saliente ? "right" : "left"]: -8, width: 0, height: 0, borderTop: `8px solid ${saliente ? WA.bubbleOut : WA.bubbleIn}`, [saliente ? "borderRight" : "borderLeft"]: "8px solid transparent" }} />
                          )}
                          {m.media_path && <MediaMensaje m={m} />}
                          {(m.contenido || !m.media_path) && <div style={{ fontSize: 14.2, lineHeight: 1.35, color: "#111b21", whiteSpace: "pre-wrap" }}>{m.contenido}</div>}
                          <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", alignItems: "center", marginTop: 1 }}>
                            {m.tipo === "plantilla" && <span style={{ fontSize: 10.5, color: WA.textMuted }}>Plantilla</span>}
                            <span style={{ fontSize: 10.5, color: WA.textMuted }}>{fmtHora(m.created_at)}</span>
                            {saliente && <TickMensaje estado={m.estado} error={m.error} />}
                          </div>
                          {m.reaccion_agente && (
                            <div style={{ position: "absolute", left: 8, bottom: -12, background: "#fff", border: "1px solid #e9e9e9", borderRadius: 12, padding: "1px 6px", fontSize: 14, boxShadow: "0 1px 2px rgba(0,0,0,0.12)" }}>{m.reaccion_agente}</div>
                          )}
                          {m.reaccion && (
                            <div style={{ position: "absolute", right: 8, bottom: -12, background: "#fff", border: "1px solid #e9e9e9", borderRadius: 12, padding: "1px 6px", fontSize: 14, boxShadow: "0 1px 2px rgba(0,0,0,0.12)" }}>{m.reaccion}</div>
                          )}
                          {saliente && m.estado === "fallido" && m.error && (
                            <div style={{ fontSize: 11.5, color: "#dc2626", marginTop: 4, textAlign: "right" }}>{m.error}</div>
                          )}
                        </div>
                        {!saliente && m.wa_message_id && (hoverMsg === m.id || pickerMsg === m.id) && (
                          <div style={{ position: "relative", order: 2 }}>
                            <button onClick={() => setPickerMsg(pickerMsg === m.id ? null : m.id)} title="Reaccionar"
                              style={{ width: 26, height: 26, borderRadius: "50%", border: "1px solid #e9e9e9", background: "#fff", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0 }}>☺</button>
                            {pickerMsg === m.id && (
                              <div style={{ position: "absolute", left: 30, top: -6, zIndex: 5, display: "flex", gap: 2, background: "#fff", border: "1px solid #e9e9e9", borderRadius: 22, padding: "4px 8px", boxShadow: "0 2px 8px rgba(0,0,0,0.18)" }}>
                                {REACCIONES.map(e => (
                                  <button key={e} onClick={() => reaccionar(m, e)}
                                    style={{ border: "none", background: m.reaccion_agente === e ? "#e7fce3" : "transparent", borderRadius: "50%", width: 30, height: 30, fontSize: 18, cursor: "pointer", padding: 0 }}>{e}</button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ padding: "10px 16px", background: "#f0f2f5" }}>
                  {errorEnvio && <div style={{ color: "#dc2626", fontSize: 12, marginBottom: 8 }}>{errorEnvio}</div>}
                  {ventanaAbierta ? (
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        <button onClick={() => setMostrarEmojis(v => !v)} title="Emojis"
                          style={{ width: 38, height: 38, borderRadius: "50%", border: "none", background: "transparent", fontSize: 22, cursor: "pointer", padding: 0 }}>😊</button>
                        {mostrarEmojis && (
                          <div style={{ position: "absolute", bottom: 46, left: 0, zIndex: 5, width: 300, display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 2, background: "#fff", border: "1px solid #e9e9e9", borderRadius: 12, padding: 8, boxShadow: "0 2px 12px rgba(0,0,0,0.2)" }}>
                            {EMOJIS.map(e => (
                              <button key={e} onClick={() => insertarEmoji(e)}
                                style={{ border: "none", background: "transparent", fontSize: 18, cursor: "pointer", padding: 2, borderRadius: 6 }}>{e}</button>
                            ))}
                          </div>
                        )}
                      </div>
                      <textarea ref={textareaRef} value={texto} onChange={(e) => setTexto(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviarMensaje(); } }}
                        placeholder="Escribe un mensaje…" rows={1}
                        style={{ ...S.input, resize: "none", fontFamily: "inherit", borderRadius: 20, background: "#fff" }} />
                      <button onClick={enviarMensaje} disabled={enviando || !texto.trim()}
                        style={{ width: 38, height: 38, borderRadius: "50%", border: "none", background: WA.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, opacity: enviando || !texto.trim() ? 0.6 : 1 }}>
                        <Icon name="send" size={16} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12.5, color: WA.textMuted }}>
                      La ventana de 24 horas está cerrada. Podrás escribirle libremente cuando el cliente responda.
                      {plantillasDisponibles.length > 0 ? (
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
                          <span style={{ color: "#111b21", fontWeight: 600 }}>Segundo contacto:</span>
                          <select value={plantillaActual} onChange={(e) => setPlantillaElegida(e.target.value)} style={{ ...S.input, width: "auto", flex: "1 1 220px" }}>
                            {plantillasDisponibles.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                          </select>
                          <button onClick={enviarPlantillaElegida} disabled={enviando}
                            style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: WA.accent, color: "#fff", fontWeight: 700, cursor: "pointer", opacity: enviando ? 0.6 : 1 }}>
                            Enviar plantilla
                          </button>
                        </div>
                      ) : (
                        <div style={{ marginTop: 6 }}>No quedan plantillas disponibles para este cliente (cada una se manda una sola vez).</div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppPage;
