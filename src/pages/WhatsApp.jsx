import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../supabase.js";
import { S, FM_MENSAJE_WA, FM_SOAT } from "../constants.js";
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
  return <span title={fm?.label || estado} style={{ color: estado === "leido" ? fm?.color : WA.textMuted, fontSize: 12, fontWeight: estado === "leido" ? 700 : 400 }}>{marca}</span>;
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

  useEffect(() => {
    Promise.all([
      supabase.from("whatsapp_conversaciones").select("*, soat_clientes(nombre, placa, fase, fecha_vencimiento)").order("updated_at", { ascending: false }),
      supabase.from("whatsapp_mensajes").select("*").order("created_at", { ascending: true }),
    ]).then(([convRes, msgRes]) => {
      if (convRes.data) setConversaciones(convRes.data);
      if (msgRes.data) setMensajes(msgRes.data);
      setLoading(false);
    });

    const channel = supabase.channel("whatsapp-chat")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversaciones" }, (payload) => {
        if (payload.eventType === "INSERT") setConversaciones(p => p.some(x => x.id === payload.new.id) ? p : [payload.new, ...p]);
        if (payload.eventType === "UPDATE") setConversaciones(p => p.map(x => x.id === payload.new.id ? { ...x, ...payload.new } : x));
        if (payload.eventType === "DELETE") setConversaciones(p => p.filter(x => x.id !== payload.old.id));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_mensajes" }, (payload) => {
        if (payload.eventType === "INSERT") setMensajes(p => p.some(x => x.id === payload.new.id) ? p : [...p, payload.new]);
        if (payload.eventType === "UPDATE") setMensajes(p => p.map(x => x.id === payload.new.id ? { ...x, ...payload.new } : x));
        if (payload.eventType === "DELETE") setMensajes(p => p.filter(x => x.id !== payload.old.id));
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
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
      .map(c => ({ c, sinResponder: ultimoPorConversacion[c.id]?.direccion === "entrante" }))
      .sort((a, b) => (a.sinResponder === b.sinResponder ? t(b.c) - t(a.c) : a.sinResponder ? -1 : 1));
  }, [conversaciones, ultimoPorConversacion]);
  const totalSinResponder = listaOrdenada.filter(x => x.sinResponder).length;

  const seleccionada = conversaciones.find(c => c.id === seleccionadaId) || null;
  const mensajesSeleccionados = useMemo(
    () => mensajes.filter(m => m.conversacion_id === seleccionadaId),
    [mensajes, seleccionadaId]
  );
  const ventanaAbierta = !!seleccionada?.ultima_entrante_at && !!ahora
    && ahora - new Date(seleccionada.ultima_entrante_at).getTime() < VENTANA_24H_MS;

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
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Error al enviar");
      setTexto("");
    } catch (err) {
      setErrorEnvio(err.message);
    }
    setEnviando(false);
  };


  return (
    <div>
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
        <div style={{ ...S.tableWrap, display: "flex", height: "calc(100vh - 190px)", minHeight: 420 }}>
          {/* ─── Lista de conversaciones ─── */}
          <div style={{ width: 300, flexShrink: 0, borderRight: "1px solid #e9e9e9", overflowY: "auto" }}>
            {totalSinResponder > 0 && (
              <div style={{ padding: "8px 16px", background: "#e7fce3", color: WA.header, fontSize: 12, fontWeight: 700, borderBottom: "1px solid #d4efcd" }}>
                {totalSinResponder} sin responder
              </div>
            )}
            {listaOrdenada.map(({ c, sinResponder }) => {
              const ultimo = ultimoPorConversacion[c.id];
              const activa = c.id === seleccionadaId;
              return (
                <div key={c.id} onClick={() => setSeleccionadaId(c.id)}
                  style={{ padding: "12px 16px", borderBottom: "1px solid #f0f0f0", borderLeft: `4px solid ${sinResponder ? WA.accent : "transparent"}`, cursor: "pointer", background: activa ? WA.listSelected : sinResponder ? "#f6fff4" : "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                    <div style={{ fontWeight: sinResponder ? 800 : 600, fontSize: 14, color: "#111b21", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.soat_clientes?.nombre || c.nombre || "—"}
                    </div>
                    <div style={{ fontSize: 11, color: sinResponder ? WA.header : WA.textMuted, fontWeight: sinResponder ? 700 : 400, flexShrink: 0 }}>{fmtHora(ultimo?.created_at || c.updated_at)}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                    <div style={{ flex: 1, fontSize: 12.5, color: sinResponder ? "#111b21" : WA.textMuted, fontWeight: sinResponder ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ultimo ? `${ultimo.direccion === "saliente" ? "Tú: " : ""}${ultimo.contenido || ETIQUETA_MEDIA[ultimo.tipo] || ""}` : "—"}
                    </div>
                    {sinResponder && <span style={{ flexShrink: 0, background: WA.accent, color: "#fff", borderRadius: 10, padding: "1px 8px", fontSize: 10.5, fontWeight: 700 }}>Sin responder</span>}
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
                <div style={{ padding: "12px 20px", background: WA.header, color: "#fff" }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{seleccionada.soat_clientes?.nombre || seleccionada.nombre || "—"}</div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 2, fontSize: 12, color: "rgba(255,255,255,0.8)" }}>
                    <span>{seleccionada.telefono}</span>
                    {seleccionada.soat_clientes?.placa && <span>Placa: {seleccionada.soat_clientes.placa}</span>}
                    {seleccionada.soat_clientes?.fecha_vencimiento && <span>Vence SOAT: {seleccionada.soat_clientes.fecha_vencimiento}</span>}
                    {seleccionada.soat_clientes?.fase && (() => {
                      const f = FM_SOAT[seleccionada.soat_clientes.fase];
                      return <span style={{ background: "rgba(255,255,255,0.2)", color: "#fff", padding: "1px 10px", borderRadius: 12, fontWeight: 700, fontSize: 11.5 }}>{f?.label || seleccionada.soat_clientes.fase}</span>;
                    })()}
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8, background: WA.chatBg }}>
                  {mensajesSeleccionados.length === 0 && (
                    <div style={{ textAlign: "center", color: WA.textMuted, fontSize: 13, marginTop: 20 }}>Sin mensajes todavía</div>
                  )}
                  {mensajesSeleccionados.map((m) => {
                    const saliente = m.direccion === "saliente";
                    return (
                      <div key={m.id} style={{ display: "flex", justifyContent: saliente ? "flex-end" : "flex-start", alignItems: "center", gap: 6 }}
                        onMouseEnter={() => setHoverMsg(m.id)} onMouseLeave={() => setHoverMsg(null)}>
                        <div style={{
                          maxWidth: "70%", borderRadius: 8, padding: "7px 12px", position: "relative", marginBottom: m.reaccion || m.reaccion_agente ? 14 : 0,
                          background: saliente ? WA.bubbleOut : WA.bubbleIn,
                          border: `1px solid ${saliente ? WA.bubbleOutBorder : WA.bubbleInBorder}`,
                          boxShadow: "0 1px 1px rgba(0,0,0,0.08)",
                        }}>
                          {m.media_path && <MediaMensaje m={m} />}
                          {(m.contenido || !m.media_path) && <div style={{ fontSize: 13.5, color: "#111b21", whiteSpace: "pre-wrap" }}>{m.contenido}</div>}
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center", marginTop: 4 }}>
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
                      La ventana de 24 horas está cerrada: la plantilla ya se envió y solo se manda una vez. Podrás escribirle cuando el cliente responda.
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
