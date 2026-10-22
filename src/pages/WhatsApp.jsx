import { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabase.js";
import { S, BLUE, FM_MENSAJE_WA } from "../constants.js";
import { authHeaders } from "../helpers.js";
import Icon from "../components/Icon.jsx";

const VENTANA_24H_MS = 24 * 60 * 60 * 1000;

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
  return <span title={fm?.label || estado} style={{ color: fm?.color || "#999", fontSize: 11, fontWeight: estado === "leido" ? 700 : 400 }}>{marca}</span>;
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
  // "ahora" en state (no Date.now() directo en el render, que es impuro) --
  // se refresca cada minuto para que la ventana de 24h se cierre sola en
  // pantalla sin que el agente tenga que recargar.
  const [ahora, setAhora] = useState(null);

  useEffect(() => {
    Promise.all([
      supabase.from("whatsapp_conversaciones").select("*, soat_clientes(nombre, placa, fase)").order("updated_at", { ascending: false }),
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

  const seleccionada = conversaciones.find(c => c.id === seleccionadaId) || null;
  const mensajesSeleccionados = useMemo(
    () => mensajes.filter(m => m.conversacion_id === seleccionadaId),
    [mensajes, seleccionadaId]
  );
  const ventanaAbierta = !!seleccionada?.ultima_entrante_at && !!ahora
    && ahora - new Date(seleccionada.ultima_entrante_at).getTime() < VENTANA_24H_MS;

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

  const reenviarPlantilla = async () => {
    if (!seleccionada || enviando) return;
    setEnviando(true); setErrorEnvio("");
    try {
      const nombre = seleccionada.soat_clientes?.nombre || seleccionada.nombre;
      const res = await fetch("/api/whatsapp?action=enviar-seguimiento-soat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ telefono: seleccionada.telefono, nombre, clienteId: seleccionada.cliente_id }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Error al enviar");
    } catch (err) {
      setErrorEnvio(err.message);
    }
    setEnviando(false);
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
        <div style={{ ...S.tableWrap, display: "flex", height: "calc(100vh - 190px)", minHeight: 420 }}>
          {/* ─── Lista de conversaciones ─── */}
          <div style={{ width: 300, flexShrink: 0, borderRight: `1px solid ${BLUE.border}`, overflowY: "auto" }}>
            {conversaciones.map((c) => {
              const ultimo = ultimoPorConversacion[c.id];
              const activa = c.id === seleccionadaId;
              return (
                <div key={c.id} onClick={() => setSeleccionadaId(c.id)}
                  style={{ padding: "12px 16px", borderBottom: "1px solid #e8f0fe", cursor: "pointer", background: activa ? BLUE.light : "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: BLUE.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.soat_clientes?.nombre || c.nombre || "—"}
                    </div>
                    <div style={{ fontSize: 11, color: "#999", flexShrink: 0 }}>{fmtHora(ultimo?.created_at || c.updated_at)}</div>
                  </div>
                  <div style={{ fontSize: 12, color: "#888", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {ultimo ? `${ultimo.direccion === "saliente" ? "Tú: " : ""}${ultimo.contenido || ""}` : "—"}
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
                <div style={{ padding: "14px 20px", borderBottom: `1px solid ${BLUE.border}`, background: BLUE.light }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: BLUE.text }}>{seleccionada.soat_clientes?.nombre || seleccionada.nombre || "—"}</div>
                  <div style={{ fontSize: 12, color: "#6b87b0" }}>{seleccionada.telefono}</div>
                </div>

                <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {mensajesSeleccionados.length === 0 && (
                    <div style={{ textAlign: "center", color: "#aaa", fontSize: 13, marginTop: 20 }}>Sin mensajes todavía</div>
                  )}
                  {mensajesSeleccionados.map((m) => {
                    const saliente = m.direccion === "saliente";
                    return (
                      <div key={m.id} style={{ display: "flex", justifyContent: saliente ? "flex-end" : "flex-start" }}>
                        <div style={{
                          maxWidth: "70%", borderRadius: 14, padding: "8px 13px",
                          background: saliente ? BLUE.light : "#f8faff",
                          border: `1px solid ${saliente ? BLUE.border : "#e8f0fe"}`,
                        }}>
                          <div style={{ fontSize: 13.5, color: "#1a1a1a", whiteSpace: "pre-wrap" }}>{m.contenido}</div>
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center", marginTop: 4 }}>
                            {m.tipo === "plantilla" && <span style={{ fontSize: 10.5, color: "#999" }}>Plantilla</span>}
                            <span style={{ fontSize: 10.5, color: "#999" }}>{fmtHora(m.created_at)}</span>
                            {saliente && <TickMensaje estado={m.estado} error={m.error} />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ padding: "12px 16px", borderTop: `1px solid ${BLUE.border}` }}>
                  {errorEnvio && <div style={{ color: "#dc2626", fontSize: 12, marginBottom: 8 }}>{errorEnvio}</div>}
                  {ventanaAbierta ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <textarea value={texto} onChange={(e) => setTexto(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviarMensaje(); } }}
                        placeholder="Escribe un mensaje…" rows={1}
                        style={{ ...S.input, resize: "none", fontFamily: "inherit" }} />
                      <button onClick={enviarMensaje} disabled={enviando || !texto.trim()} style={S.btn("primary")}>
                        <Icon name="send" size={14} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 12.5, color: "#888" }}>La ventana de 24 horas está cerrada — hay que reenviar la plantilla.</div>
                      <button onClick={reenviarPlantilla} disabled={enviando} style={S.btn("secondary")}>Reenviar plantilla de seguimiento</button>
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
