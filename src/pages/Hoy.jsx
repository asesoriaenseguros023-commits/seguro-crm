import { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabase.js";
import { BLUE, FM_SOAT } from "../constants.js";
import { parseDateSoat } from "../helpers.js";

const VENTANA_24H_MS = 24 * 60 * 60 * 1000;
const FASES_ACTIVAS = ["pendiente", "contactado_whatsapp", "en_gestion", "interesado"];

const fmtRestante = (ms) => {
  if (ms <= 0) return "ventana cerrada";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `quedan ${h} h ${m} min` : `quedan ${m} min`;
};

const fmtDias = (d) => (d < 0 ? `vencido hace ${-d} d` : d === 0 ? "hoy" : `en ${d} d`);

const Seccion = ({ titulo, subtitulo, items, vacio, render }) => (
  <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${BLUE.border}`, marginBottom: 16, overflow: "hidden" }}>
    <div style={{ padding: "14px 18px", borderBottom: `1px solid ${BLUE.border}`, display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
      <div style={{ fontSize: 15, fontWeight: 700 }}>{titulo}</div>
      <div style={{ fontSize: 12, color: "#888" }}>{items.length} {items.length === 1 ? "cliente" : "clientes"}{subtitulo ? ` · ${subtitulo}` : ""}</div>
    </div>
    {items.length === 0
      ? <div style={{ padding: "18px", fontSize: 13, color: "#888" }}>{vacio}</div>
      : items.slice(0, 60).map(render)}
    {items.length > 60 && <div style={{ padding: "10px 18px", fontSize: 12, color: "#888" }}>Se muestran los primeros 60 de {items.length}.</div>}
  </div>
);

const Fila = ({ izq, medio, der, acciones }) => (
  <div style={{ padding: "11px 18px", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
    <div style={{ flex: "1 1 220px", minWidth: 0 }}>{izq}</div>
    <div style={{ flex: "1 1 200px", fontSize: 12.5, color: "#555" }}>{medio}</div>
    <div style={{ fontSize: 12.5, fontWeight: 700, minWidth: 120 }}>{der}</div>
    <div style={{ display: "flex", gap: 8 }}>{acciones}</div>
  </div>
);

const Boton = ({ children, onClick, primario }) => (
  <button onClick={onClick} style={{ padding: "6px 12px", borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: `1px solid ${primario ? "#1da851" : BLUE.border}`, background: primario ? "#25d366" : "#fff", color: primario ? "#fff" : "#333" }}>{children}</button>
);

const HoyPage = ({ onAbrirWhatsapp, onIrSoat }) => {
  const [clientes, setClientes] = useState([]);
  const [convs, setConvs] = useState([]);
  const [msgs, setMsgs] = useState([]);
  const [ahora, setAhora] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      const todos = [];
      for (let desde = 0; ; desde += 1000) {
        const { data, error } = await supabase.from("soat_clientes")
          .select("id,nombre,telefono,placa,fase,agente,fecha_vencimiento,proxima_accion,fecha_proxima")
          .order("id", { ascending: true }).range(desde, desde + 999);
        if (error || !data) break;
        todos.push(...data);
        if (data.length < 1000) break;
      }
      const [c, m] = await Promise.all([
        supabase.from("whatsapp_conversaciones").select("*"),
        supabase.from("whatsapp_mensajes").select("conversacion_id,direccion,created_at").order("created_at", { ascending: true }),
      ]);
      if (cancelado) return;
      setClientes(todos);
      if (c.data) setConvs(c.data);
      if (m.data) setMsgs(m.data);
      setAhora(Date.now());
      setCargando(false);
    }
    cargar();
    const id = setInterval(cargar, 60000);
    return () => { cancelado = true; clearInterval(id); };
  }, []);

  const { sinResponder, seguimientos, porVencer } = useMemo(() => {
    if (!ahora) return { sinResponder: [], seguimientos: [], porVencer: [] };
    const porId = new Map(clientes.map(c => [c.id, c]));
    const ultimo = new Map();
    msgs.forEach(m => ultimo.set(m.conversacion_id, m));

    const sinResponder = convs.map(cv => {
      const u = ultimo.get(cv.id);
      const desmarcada = !!cv.desmarcada_at && !!u && new Date(cv.desmarcada_at) >= new Date(u.created_at);
      if (u?.direccion !== "entrante" || desmarcada) return null;
      const restante = cv.ultima_entrante_at ? new Date(cv.ultima_entrante_at).getTime() + VENTANA_24H_MS - ahora : 0;
      return { cv, cliente: porId.get(cv.cliente_id), restante, desde: new Date(u.created_at) };
    }).filter(x => x && x.cliente).sort((a, b) => a.restante - b.restante);

    const hoy = new Date(ahora); hoy.setHours(0, 0, 0, 0);
    const idsSin = new Set(sinResponder.map(x => x.cliente.id));
    const dias = (d) => Math.round((d - hoy) / 86400000);

    const seguimientos = clientes.map(c => {
      if (!FASES_ACTIVAS.includes(c.fase) || idsSin.has(c.id)) return null;
      const f = parseDateSoat(c.fecha_proxima);
      if (!f || isNaN(f) || dias(f) > 0) return null;
      return { c, dias: dias(f) };
    }).filter(Boolean).sort((a, b) => a.dias - b.dias);

    const idsSeg = new Set(seguimientos.map(x => x.c.id));
    const porVencer = clientes.map(c => {
      if (!FASES_ACTIVAS.includes(c.fase) || idsSin.has(c.id) || idsSeg.has(c.id)) return null;
      const f = parseDateSoat(c.fecha_vencimiento);
      if (!f || isNaN(f)) return null;
      const d = dias(f);
      return d >= -5 && d <= 30 ? { c, dias: d } : null;
    }).filter(Boolean).sort((a, b) => a.dias - b.dias);

    return { sinResponder, seguimientos, porVencer };
  }, [clientes, convs, msgs, ahora]);

  if (cargando) return <div style={{ padding: 40, textAlign: "center", color: "#888" }}>Cargando...</div>;

  const nombre = (c) => (
    <>
      <div style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nombre || "Sin nombre"}</div>
      <div style={{ fontSize: 12, color: "#888" }}>{c.placa || "Sin placa"}{c.telefono ? ` · ${c.telefono}` : ""}</div>
    </>
  );
  const faseTxt = (c) => FM_SOAT[c.fase]?.label || c.fase;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Hoy</div>
        <div style={{ fontSize: 13, color: "#666" }}>
          {sinResponder.length} por responder · {seguimientos.length} seguimientos · {porVencer.length} por vencer. Se actualiza solo cada minuto.
        </div>
      </div>

      <Seccion titulo="1. Escribieron y no les has respondido" subtitulo="el más urgente primero"
        items={sinResponder} vacio="No hay chats pendientes de respuesta."
        render={({ cv, cliente, restante, desde }) => (
          <Fila key={cv.id} izq={nombre(cliente)}
            medio={<>Escribió el {desde.toLocaleDateString("es-CO")} a las {desde.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</>}
            der={<span style={{ color: restante <= 0 ? "#b91c1c" : restante < 3 * 3600000 ? "#c2410c" : "#166534" }}>{fmtRestante(restante)}</span>}
            acciones={<Boton primario onClick={() => onAbrirWhatsapp(cliente.id)}>Responder</Boton>} />
        )} />

      <Seccion titulo="2. Seguimientos de hoy o vencidos" subtitulo="fecha de próxima acción"
        items={seguimientos} vacio="No hay seguimientos vencidos."
        render={({ c, dias: d }) => (
          <Fila key={c.id} izq={nombre(c)}
            medio={<>{c.proxima_accion || "Sin acción definida"} · {faseTxt(c)}</>}
            der={<span style={{ color: d < 0 ? "#b91c1c" : "#c2410c" }}>{fmtDias(d)}</span>}
            acciones={<>
              <Boton onClick={() => onAbrirWhatsapp(c.id)}>WhatsApp</Boton>
              <Boton onClick={onIrSoat}>Ver en SOAT</Boton>
            </>} />
        )} />

      <Seccion titulo="3. SOAT por vencer sin gestión programada" subtitulo="vencen en los próximos 30 días"
        items={porVencer} vacio="No hay vencimientos próximos sin gestión."
        render={({ c, dias: d }) => (
          <Fila key={c.id} izq={nombre(c)}
            medio={<>Vence {c.fecha_vencimiento} · {faseTxt(c)}</>}
            der={<span style={{ color: d <= 7 ? "#c2410c" : "#333" }}>{fmtDias(d)}</span>}
            acciones={<>
              <Boton onClick={() => onAbrirWhatsapp(c.id)}>WhatsApp</Boton>
              <Boton onClick={onIrSoat}>Ver en SOAT</Boton>
            </>} />
        )} />
    </div>
  );
};

export default HoyPage;
