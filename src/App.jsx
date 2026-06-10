import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";
import { S, BLUE, ROL_ADMIN, ROL_AGENTE } from "./constants.js";
import { mapInteresado, mapCotizacion, mapPoliza, esAdmin, today } from "./helpers.js";
import { FontLoader, LoadingScreen } from "./components/Modal.jsx";
import ConfirmDialog from "./components/ConfirmDialog.jsx";
import Icon from "./components/Icon.jsx";
import LoginPage from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import ClientesPage from "./pages/Clients.jsx";
import InteresadosPage from "./pages/Leads.jsx";
import CotizacionesPage from "./pages/Cotizaciones.jsx";
import PolizasPage from "./pages/Polizas.jsx";
import RenovacionesPage from "./pages/Renovaciones.jsx";
import SoatPage from "./pages/SOAT.jsx";
import ReportesPage from "./pages/Reportes.jsx";
import RamosPage from "./pages/Ramos.jsx";
import AseguradorasPage from "./pages/Aseguradoras.jsx";
import ConfiguracionPage from "./pages/Configuracion.jsx";

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────
const Sidebar = ({ current, onNav, onLogout, userName, userRol, isOpen, isMobile, onClose }) => {
  const initials = userName
    ? userName.split(" ").slice(0, 2).map((w) => w[0]).join("")
    : "U";

  const sidebarStyle = isMobile
    ? { ...S.sidebar, position: "fixed", top: 0, left: 0, height: "100vh", zIndex: 300, width: 240, transform: isOpen ? "translateX(0)" : "translateX(-100%)", transition: "transform 0.25s ease", boxShadow: isOpen ? "4px 0 24px rgba(0,0,0,0.45)" : "none" }
    : S.sidebar;

  const handleNav = (id) => { onNav(id); if (isMobile) onClose(); };

  return (
    <>
      {isMobile && isOpen && (
        <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 299 }} />
      )}
      <div style={sidebarStyle}>
        <div style={S.sbLogo}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <img src="/logo.png" alt="Logo" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover" }} />
            <div>
              <div style={S.sbLogoText}>Asesoría en Seguros</div>
              <div style={S.sbLogoSub}>Tocancipá · NIT 46.662.968</div>
            </div>
          </div>
        </div>
        <div style={S.sbNav}>
          <div style={S.sbSection}>Principal</div>
          {[
            { id: "dashboard", label: "Dashboard", icon: "dashboard" },
            { id: "clientes", label: "Clientes", icon: "users" },
            { id: "interesados", label: "Leads", icon: "document" },
            { id: "cotizaciones", label: "Cotizaciones", icon: "tag" },
            { id: "polizas", label: "Pólizas", icon: "shield" },
            { id: "renovaciones", label: "Renovaciones", icon: "bell" },
            { id: "soat", label: "Seguimiento SOAT", icon: "shield" },
            { id: "reportes", label: "Reportes", icon: "chart" },
          ].map((i) => (
            <div key={i.id} style={S.sbItem(current === i.id)} onClick={() => handleNav(i.id)}>
              <Icon name={i.icon} size={16} />{i.label}
            </div>
          ))}
          {esAdmin(userRol) && (
            <>
              <div style={S.sbSection}>Administración</div>
              {[
                { id: "ramos", label: "Ramos de Seguros", icon: "tag" },
                { id: "aseguradoras", label: "Aseguradoras", icon: "shield" },
              ].map((i) => (
                <div key={i.id} style={S.sbItem(current === i.id)} onClick={() => handleNav(i.id)}>
                  <Icon name={i.icon} size={16} />{i.label}
                </div>
              ))}
            </>
          )}
        </div>
        <div style={S.sbBottom}>
          <div style={{ padding: "4px 12px 8px" }}>
            <span style={{ ...S.chip(esAdmin(userRol) ? "#7c3aed" : BLUE.primary), fontSize: 11 }}>
              {userRol || "Agente"}
            </span>
          </div>
          <div style={S.sbUser}>
            <div style={S.sbAvatar}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: "#e5e7eb", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {userName || "Usuario"}
              </div>
            </div>
          </div>
          <div style={{ ...S.sbItem(false), marginTop: 4 }} onClick={onLogout}>
            <Icon name="logout" size={16} />Salir
          </div>
        </div>
      </div>
    </>
  );
};

// ─── TOPBAR ───────────────────────────────────────────────────────────────────
const Topbar = ({ page, userRol, isMobile, onToggleSidebar }) => {
  const labels = {
    dashboard: "Dashboard", clientes: "Clientes", interesados: "Leads",
    cotizaciones: "Cotizaciones", polizas: "Pólizas", renovaciones: "Renovaciones",
    soat: "Seguimiento SOAT", ramos: "Ramos de Seguros",
    aseguradoras: "Aseguradoras", reportes: "Reportes",
  };
  const [ahora, setAhora] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const fmtFechaCorta = (d) =>
    d.toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const fmtHora = (d) =>
    d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <div style={{ ...S.topbar, padding: isMobile ? "0 14px" : "0 28px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 0 }}>
        {isMobile && (
          <button onClick={onToggleSidebar}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "6px", borderRadius: 6, display: "flex", alignItems: "center", color: BLUE.primary }}>
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="19" y2="6" /><line x1="3" y1="12" x2="19" y2="12" /><line x1="3" y1="18" x2="19" y2="18" />
            </svg>
          </button>
        )}
        <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700, color: BLUE.text }}>{labels[page] || page}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 20, fontSize: 12, color: "#6b87b0" }}>
        {!isMobile && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, borderRight: `1px solid ${BLUE.border}`, paddingRight: 20 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: BLUE.primary, fontVariantNumeric: "tabular-nums" }}>{fmtHora(ahora)}</div>
              <div style={{ fontSize: 11, color: "#6b87b0", textTransform: "capitalize" }}>{fmtFechaCorta(ahora)}</div>
            </div>
          </div>
        )}
        <span style={S.chip(esAdmin(userRol) ? "#7c3aed" : BLUE.primary)}>{userRol}</span>
        {!isMobile && <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a" }} />
          Sistema en línea
        </div>}
      </div>
    </div>
  );
};

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [page, setPage] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState("");
  const [userRol, setUserRol] = useState(ROL_AGENTE);
  const [agenteActualId, setAgenteActualId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const [agentes, setAgentes] = useState([]);
  const [ramos, setRamos] = useState([]);
  const [aseguradoras, setAseguradoras] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [interesados, setInteresados] = useState([]);
  const [cotizaciones, setCotizaciones] = useState([]);
  const [polizas, setPolizas] = useState([]);

  // ─── ConfirmDialog state ──────────────────────────────────────────────────
  const [confirmState, setConfirmState] = useState({ open: false, message: "", detail: "", resolve: null });
  const showConfirm = (message, detail = "") =>
    new Promise((resolve) => setConfirmState({ open: true, message, detail, resolve }));
  const handleConfirm = (ok) => {
    confirmState.resolve(ok);
    setConfirmState({ open: false, message: "", detail: "", resolve: null });
  };

  // ─── resolverRol: consulta tabla agentes por email ────────────────────────
  const resolverRol = async (email) => {
    try {
      const { data } = await supabase
        .from("agentes")
        .select("id, nombre, rol")
        .eq("email", email)
        .single();
      if (data) {
        setUserName(data.nombre);
        setUserRol(data.rol || ROL_ADMIN);
        setAgenteActualId(data.id);
      } else {
        // Fallback: si no encuentra el email, asumir Admin
        setUserName("Administrador");
        setUserRol(ROL_ADMIN);
        setAgenteActualId(null);
      }
    } catch {
      setUserName("Administrador");
      setUserRol(ROL_ADMIN);
      setAgenteActualId(null);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) { await resolverRol(session.user.email); setLoggedIn(true); }
    });
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    const cargar = async () => {
      setLoading(true);
      const [{ data: rms }, { data: asgs }, { data: cls }, { data: ints }, { data: cots }, { data: pols }, { data: agts }] = await Promise.all([
        supabase.from("ramos").select("*").order("nombre"),
        supabase.from("aseguradoras").select("*").order("nombre"),
        supabase.from("clientes").select("*").order("nombre"),
        supabase.from("interesados").select("*").order("created_at", { ascending: false }),
        supabase.from("cotizaciones").select("*").order("created_at", { ascending: false }),
        supabase.from("polizas").select("*").order("created_at", { ascending: false }),
        supabase.from("agentes").select("*").order("nombre"),
      ]);
      if (rms) setRamos(rms);
      if (asgs) setAseguradoras(asgs);
      if (agts) setAgentes(agts);
      if (cls) setClientes(cls.map((c) => ({ ...c, tipoDocumento: c.tipo_documento, tipoPersona: c.tipo_persona, nombreContacto: c.nombre_contacto, telefonoContacto: c.telefono_contacto })));
      if (ints) setInteresados(ints.map(mapInteresado));
      if (cots) setCotizaciones(cots.map(mapCotizacion));
      if (pols) setPolizas(pols.map((p) => ({ ...mapPoliza(p), ramo: p.ramo, clienteNombre: p.cliente_nombre, clienteTelefono: p.cliente_telefono })));

      // Auto-crear cotizaciones para leads con envio_oficina=true que no tengan cotización
      if (ints && cots) {
        const leadsConEnvio = ints.filter((i) => i.envio_oficina);
        const leadIdsConCot = new Set(cots.map((c) => c.lead_id).filter(Boolean));
        const leadsHuerfanos = leadsConEnvio.filter((i) => !leadIdsConCot.has(i.id));
        if (leadsHuerfanos.length > 0) {
          const nuevasCots = leadsHuerfanos.map((i) => {
            const cliente = cls?.find((c) => c.id === i.cliente_id);
            return {
              lead_id: i.id, cliente_nombre: i.nombre,
              cliente_telefono: cliente?.celular || cliente?.telefono || "",
              ramo: i.tipo_seguro, estado: "Pendiente", accion: "En Curso",
              fecha_cotizacion: today(),
            };
          });
          const { data: creadas } = await supabase.from("cotizaciones").insert(nuevasCots).select();
          if (creadas) setCotizaciones((prev) => [...creadas.map(mapCotizacion), ...prev]);
        }
      }

      setLoading(false);
    };
    cargar();

    // ─── REALTIME ─────────────────────────────────────────────────────────────
    const channel = supabase
      .channel("db-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "clientes" }, (payload) => {
        if (payload.eventType === "INSERT")
          setClientes((prev) =>
            prev.some((x) => x.id === payload.new.id) ? prev : [{ ...payload.new, tipoPersona: payload.new.tipo_persona, nombreContacto: payload.new.nombre_contacto, telefonoContacto: payload.new.telefono_contacto, tipoDocumento: payload.new.tipo_documento }, ...prev]
          );
        if (payload.eventType === "UPDATE")
          setClientes((prev) =>
            prev.map((x) => x.id === payload.new.id ? { ...x, ...payload.new, tipoPersona: payload.new.tipo_persona, nombreContacto: payload.new.nombre_contacto, telefonoContacto: payload.new.telefono_contacto } : x)
          );
        if (payload.eventType === "DELETE")
          setClientes((prev) => prev.filter((x) => x.id !== payload.old.id));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "interesados" }, (payload) => {
        if (payload.eventType === "INSERT")
          setInteresados((prev) => prev.some((x) => x.id === payload.new.id) ? prev : [mapInteresado(payload.new), ...prev]);
        if (payload.eventType === "UPDATE")
          setInteresados((prev) => prev.map((x) => x.id === payload.new.id ? mapInteresado(payload.new) : x));
        if (payload.eventType === "DELETE")
          setInteresados((prev) => prev.filter((x) => x.id !== payload.old.id));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "cotizaciones" }, (payload) => {
        if (payload.eventType === "INSERT")
          setCotizaciones((prev) => prev.some((x) => x.id === payload.new.id) ? prev : [mapCotizacion(payload.new), ...prev]);
        if (payload.eventType === "UPDATE")
          setCotizaciones((prev) => prev.map((x) => x.id === payload.new.id ? mapCotizacion(payload.new) : x));
        if (payload.eventType === "DELETE")
          setCotizaciones((prev) => prev.filter((x) => x.id !== payload.old.id));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "polizas" }, (payload) => {
        if (payload.eventType === "INSERT")
          setPolizas((prev) => prev.some((x) => x.id === payload.new.id) ? prev : [{ ...mapPoliza(payload.new), clienteNombre: payload.new.cliente_nombre, clienteTelefono: payload.new.cliente_telefono }, ...prev]);
        if (payload.eventType === "UPDATE")
          setPolizas((prev) => prev.map((x) => x.id === payload.new.id ? { ...mapPoliza(payload.new), clienteNombre: payload.new.cliente_nombre, clienteTelefono: payload.new.cliente_telefono } : x));
        if (payload.eventType === "DELETE")
          setPolizas((prev) => prev.filter((x) => x.id !== payload.old.id));
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [loggedIn]);

  const handleLogin = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) await resolverRol(session.user.email);
    setLoggedIn(true);
  };

  // ─── CRUD Clientes ────────────────────────────────────────────────────────
  const addCliente = async (f) => {
    const { data, error } = await supabase.from("clientes").insert([{
      nombre: f.nombre, email: f.email, celular: f.celular || f.telefono, telefono: f.telefono,
      tipo_persona: f.tipoPersona, nombre_contacto: f.nombreContacto, telefono_contacto: f.telefonoContacto,
      documento: f.documento, tipo_documento: f.tipoDocumento, ciudad: f.ciudad, direccion: f.direccion,
      notas: f.notas,
    }]).select().single();
    if (error) { console.error("addCliente error:", error); return; }
    if (data) setClientes((prev) => [...prev, { ...data, tipoPersona: data.tipo_persona, nombreContacto: data.nombre_contacto, telefonoContacto: data.telefono_contacto, tipoDocumento: data.tipo_documento }]);
  };

  const editCliente = async (f) => {
    await supabase.from("clientes").update({
      nombre: f.nombre, email: f.email, celular: f.celular || f.telefono, telefono: f.telefono,
      tipo_persona: f.tipoPersona, nombre_contacto: f.nombreContacto, telefono_contacto: f.telefonoContacto,
      documento: f.documento, tipo_documento: f.tipoDocumento, ciudad: f.ciudad, direccion: f.direccion,
      notas: f.notas,
    }).eq("id", f.id);
    setClientes((prev) => prev.map((x) => x.id === f.id ? { ...x, ...f, tipoPersona: f.tipoPersona, nombreContacto: f.nombreContacto, telefonoContacto: f.telefonoContacto, tipoDocumento: f.tipoDocumento } : x));
  };

  const deleteCliente = async (id) => {
    await supabase.from("clientes").delete().eq("id", id);
    setClientes((prev) => prev.filter((x) => x.id !== id));
  };

  // ─── CRUD Interesados ─────────────────────────────────────────────────────
  const addInteresado = async (f) => {
    const clienteNombre = clientes.find((c) => c.id === f.clienteId)?.nombre || "";
    const { data, error } = await supabase.from("interesados").insert([{
      cliente_id: f.clienteId, nombre: clienteNombre,
      tipo_seguro: f.tipoSeguro, documentos_checklist: f.documentosChecklist || {},
      envio_oficina: f.envioOficina || false, notas: f.notas || "",
      estado: f.estado || "Lead", fecha_registro: f.fechaRegistro,
    }]).select().single();
    if (error) { console.error("addInteresado error:", error); return; }
    if (data) setInteresados((prev) => [mapInteresado(data), ...prev]);
  };

  const editInteresado = async (f) => {
    const clienteNombre = clientes.find((c) => c.id === f.clienteId)?.nombre || "";
    const cliente = clientes.find((c) => c.id === f.clienteId);
    const { error } = await supabase.from("interesados").update({
      cliente_id: f.clienteId, nombre: clienteNombre,
      tipo_seguro: f.tipoSeguro, documentos_checklist: f.documentosChecklist || {},
      envio_oficina: f.envioOficina || false, notas: f.notas || "",
    }).eq("id", f.id);
    if (error) { console.error("editInteresado error:", error); return; }
    if (f.envioOficina) {
      try {
        const { data: existing } = await supabase.from("cotizaciones").select("*").eq("lead_id", f.id).limit(1);
        if (!existing || existing.length === 0) {
          const { data: cot, error: cotError } = await supabase.from("cotizaciones").insert([{
            lead_id: f.id, cliente_nombre: clienteNombre,
            cliente_telefono: cliente?.celular || cliente?.telefono || "",
            ramo: f.tipoSeguro, estado: "Pendiente", accion: "En Curso",
            fecha_cotizacion: today(),
          }]).select().single();
          if (cotError) console.error("Error creando cotización:", cotError);
          if (cot) setCotizaciones((prev) => [mapCotizacion(cot), ...prev]);
        } else {
          setCotizaciones((prev) => prev.some((c) => c.id === existing[0].id) ? prev : [mapCotizacion(existing[0]), ...prev]);
        }
      } catch (e) { console.error("Excepción cotización:", e); }
    }
    setInteresados((prev) => prev.map((x) => x.id === f.id ? { ...x, clienteId: f.clienteId, nombre: clienteNombre, tipoSeguro: f.tipoSeguro, documentosChecklist: f.documentosChecklist, envioOficina: f.envioOficina, notas: f.notas } : x));
  };

  const deleteInteresado = async (id) => {
    await supabase.from("interesados").delete().eq("id", id);
    setInteresados((prev) => prev.filter((x) => x.id !== id));
  };

  // ─── CRUD Cotizaciones ────────────────────────────────────────────────────
  const addCotizacion = async (f) => {
    const { data } = await supabase.from("cotizaciones").insert([{
      interesado_id: f.interesadoId, lead_id: f.leadId, agente_id: f.agenteId,
      cliente_nombre: f.clienteNombre, cliente_telefono: f.clienteTelefono,
      ramo: f.ramo, aseguradora: f.aseguradora, suma_asegurada: f.sumaAsegurada,
      prima: f.prima, iva: f.iva, gastos_expedicion: f.gastosExpedicion,
      numero_poliza: f.numeroPoliza, fecha_cotizacion: f.fechaCotizacion,
      notas: f.notas, estado: f.estado || "Pendiente", accion: f.accion || "En Curso",
    }]).select().single();
    if (data) setCotizaciones((prev) => [mapCotizacion(data), ...prev]);
  };

  const editCotizacion = async (f) => {
    await supabase.from("cotizaciones").update({
      ramo: f.ramo, aseguradora: f.aseguradora, suma_asegurada: f.sumaAsegurada,
      prima: f.prima, iva: f.iva, gastos_expedicion: f.gastosExpedicion,
      numero_poliza: f.numeroPoliza, fecha_cotizacion: f.fechaCotizacion,
      notas: f.notas, estado: f.estado, accion: f.accion,
      numero_poliza_emitida: f.numeroPolizaEmitida,
      aseguradora_emitida: f.aseguradoraEmitida,
      prima_emitida: f.primaEmitida, iva_emitida: f.ivaEmitida,
      gastos_emitida: f.gastosEmitida, total_pago_emitida: f.totalPagoEmitida,
    }).eq("id", f.id);
    setCotizaciones((prev) => prev.map((x) => x.id === f.id ? { ...x, ...f } : x));

    if (f.accion === "Póliza Emitida" && f.numeroPolizaEmitida) {
      const yaExiste = polizas.some((p) => p.cotizacionId === f.id);
      if (!yaExiste) {
        const vigenciaInicio = today();
        const vigenciaFin = (() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString().split("T")[0]; })();
        const { data: pol, error } = await supabase.from("polizas").insert([{
          cotizacion_id: f.id, cliente_nombre: f.clienteNombre, cliente_telefono: f.clienteTelefono,
          numero: f.numeroPolizaEmitida, ramo: f.ramo, aseguradora: f.aseguradoraEmitida,
          prima: f.primaEmitida, iva: f.ivaEmitida, gastos_expedicion: f.gastosEmitida,
          total_pago: f.totalPagoEmitida, fecha_emision: today(),
          vigencia_inicio: vigenciaInicio, vigencia_fin: vigenciaFin, estado: "Activa",
        }]).select().single();
        if (error) console.error("Error creando póliza:", error);
        if (pol) setPolizas((prev) => [{ ...mapPoliza(pol), clienteNombre: pol.cliente_nombre, clienteTelefono: pol.cliente_telefono }, ...prev]);
      }
    }
  };

  const deleteCotizacion = async (id) => {
    await supabase.from("cotizaciones").delete().eq("id", id);
    setCotizaciones((prev) => prev.filter((x) => x.id !== id));
  };

  // ─── Emitir póliza ────────────────────────────────────────────────────────
  const emitirPoliza = async ({ cotizacion, interesado, fechaEmision, vigenciaInicio, vigenciaFin, ramoId, notas }) => {
    const ramo = ramos.find((r) => r.id === ramoId);
    const cliente = clientes.find((c) => c.id === interesado?.clienteId || c.id === interesado?.cliente_id);
    const telefono = cliente?.celular || cliente?.telefono || interesado?.telefono || "";
    const { data } = await supabase.from("polizas").insert([{
      cotizacion_id: cotizacion.id, cliente_id: interesado?.id,
      cliente_nombre: interesado?.nombre, cliente_telefono: telefono,
      agente_id: cotizacion.agenteId, numero: cotizacion.numeroPoliza,
      ramo: ramo?.nombre || cotizacion.ramo, ramo_id: ramoId,
      aseguradora: cotizacion.aseguradora, suma_asegurada: cotizacion.sumaAsegurada,
      prima: cotizacion.prima, iva: cotizacion.iva, gastos_expedicion: cotizacion.gastosExpedicion,
      fecha_emision: fechaEmision, vigencia_inicio: vigenciaInicio, vigencia_fin: vigenciaFin,
      estado: "Activa", notas,
    }]).select().single();
    if (data) {
      setPolizas((prev) => [{ ...mapPoliza(data), ramo: data.ramo, clienteNombre: data.cliente_nombre, clienteTelefono: data.cliente_telefono }, ...prev]);
      await supabase.from("cotizaciones").update({ estado: "Emitida" }).eq("id", cotizacion.id);
      setCotizaciones((prev) => prev.map((c) => c.id === cotizacion.id ? { ...c, estado: "Emitida" } : c));
    }
  };

  // ─── CRUD Agentes ─────────────────────────────────────────────────────────
  const addAgente = async (a) => {
    const { data } = await supabase.from("agentes").insert([{ nombre: a.nombre, email: a.email, rol: a.rol }]).select().single();
    if (data) setAgentes((prev) => [...prev, data]);
  };
  const editAgente = async (a) => {
    await supabase.from("agentes").update({ nombre: a.nombre, email: a.email, rol: a.rol }).eq("id", a.id);
    setAgentes((prev) => prev.map((x) => x.id === a.id ? { ...x, ...a } : x));
  };
  const deleteAgente = async (id) => {
    await supabase.from("agentes").delete().eq("id", id);
    setAgentes((prev) => prev.filter((x) => x.id !== id));
  };

  // ─── CRUD Ramos ───────────────────────────────────────────────────────────
  const addRamo = async (r) => {
    const { data } = await supabase.from("ramos").insert([{ nombre: r.nombre, descripcion: r.descripcion, activo: r.activo, documentos: r.documentos || {} }]).select().single();
    if (data) setRamos((prev) => [...prev, data]);
  };
  const editRamo = async (r) => {
    await supabase.from("ramos").update({ nombre: r.nombre, descripcion: r.descripcion, activo: r.activo, documentos: r.documentos || {} }).eq("id", r.id);
    setRamos((prev) => prev.map((x) => x.id === r.id ? { ...x, ...r } : x));
  };
  const deleteRamo = async (id) => {
    await supabase.from("ramos").delete().eq("id", id);
    setRamos((prev) => prev.filter((x) => x.id !== id));
  };

  // ─── CRUD Aseguradoras ────────────────────────────────────────────────────
  const addAseguradora = async (a) => {
    const { data } = await supabase.from("aseguradoras").insert([{ nombre: a.nombre, activo: a.activo }]).select().single();
    if (data) setAseguradoras((prev) => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)));
  };
  const editAseguradora = async (a) => {
    await supabase.from("aseguradoras").update({ nombre: a.nombre, activo: a.activo }).eq("id", a.id);
    setAseguradoras((prev) => prev.map((x) => x.id === a.id ? { ...x, ...a } : x));
  };
  const deleteAseguradora = async (id) => {
    await supabase.from("aseguradoras").delete().eq("id", id);
    setAseguradoras((prev) => prev.filter((x) => x.id !== id));
  };

  const deletePoliza = async (id) => {
    await supabase.from("polizas").delete().eq("id", id);
    setPolizas((prev) => prev.filter((x) => x.id !== id));
  };

  const importPolizas = async (rows) => {
    const inserts = rows.map((r) => ({
      numero: r.numero, cliente_nombre: r.clienteNombre, cliente_telefono: r.clienteTelefono,
      ramo: r.ramo, aseguradora: r.aseguradora, prima: r.prima, iva: r.iva,
      gastos_expedicion: r.gastosExpedicion, total_pago: r.totalPago,
      fecha_emision: r.fechaEmision, vigencia_inicio: r.vigenciaInicio,
      vigencia_fin: r.vigenciaFin, estado: "Activa",
    }));
    const BATCH = 50;
    let imported = [];
    for (let i = 0; i < inserts.length; i += BATCH) {
      const { data, error } = await supabase.from("polizas").insert(inserts.slice(i, i + BATCH)).select();
      if (error) throw error;
      if (data) imported = imported.concat(data);
    }
    setPolizas((prev) => [
      ...imported.map((p) => ({ ...mapPoliza(p), ramo: p.ramo, clienteNombre: p.cliente_nombre, clienteTelefono: p.cliente_telefono })),
      ...prev,
    ]);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setLoggedIn(false);
    setAgentes([]); setRamos([]); setClientes([]);
    setInteresados([]); setCotizaciones([]); setPolizas([]);
    setUserRol(ROL_AGENTE); setAgenteActualId(null);
  };

  if (!loggedIn) return <LoginPage onLogin={handleLogin} />;
  if (loading) return <><FontLoader /><LoadingScreen /></>;

  const handleNav = (p) => {
    if (p === "ramos" && !esAdmin(userRol)) return;
    setPage(p);
  };

  const renderPage = () => {
    switch (page) {
      case "dashboard":
        return <Dashboard interesados={interesados} cotizaciones={cotizaciones} polizas={polizas} userName={userName} onNav={handleNav} />;
      case "clientes":
        return <ClientesPage clientes={clientes} onAdd={addCliente} onEdit={editCliente} onDelete={deleteCliente} userRol={userRol} />;
      case "interesados":
        return (
          <InteresadosPage
            interesados={interesados} cotizaciones={cotizaciones} polizas={polizas}
            agentes={agentes} ramos={ramos.filter((r) => r.activo !== false)} clientes={clientes}
            onAddInteresado={addInteresado} onEditInteresado={editInteresado} onDeleteInteresado={deleteInteresado}
            onAddCotizacion={addCotizacion} onEditCotizacion={editCotizacion} onEmitirPoliza={emitirPoliza}
            userRol={userRol} agenteActualId={agenteActualId}
          />
        );
      case "cotizaciones":
        return (
          <CotizacionesPage
            cotizaciones={cotizaciones} interesados={interesados} polizas={polizas}
            agentes={agentes} ramos={ramos.filter((r) => r.activo !== false)} aseguradoras={aseguradoras}
            onAddCotizacion={addCotizacion} onEditCotizacion={editCotizacion} onDeleteCotizacion={deleteCotizacion}
            onEmitirPoliza={emitirPoliza} userRol={userRol} agenteActualId={agenteActualId}
            showConfirm={showConfirm}
          />
        );
      case "polizas":
        return (
          <PolizasPage
            polizas={polizas} interesados={interesados} ramos={ramos} aseguradoras={aseguradoras}
            onDelete={deletePoliza} userRol={userRol} agenteActualId={agenteActualId}
            showConfirm={showConfirm}
          />
        );
      case "renovaciones":
        return (
          <RenovacionesPage
            polizas={polizas} userRol={userRol} agenteActualId={agenteActualId}
            onImportPolizas={importPolizas}
            onUpdatePoliza={(id, changes) => setPolizas((prev) => prev.map((p) => p.id === id ? { ...p, ...changes } : p))}
          />
        );
      case "soat":
        return <SoatPage showConfirm={showConfirm} />;
      case "reportes":
        return <ReportesPage polizas={polizas} ramos={ramos} clientes={clientes} />;
      case "ramos":
        return esAdmin(userRol) ? <RamosPage ramos={ramos} onAdd={addRamo} onEdit={editRamo} onDelete={deleteRamo} /> : null;
      case "aseguradoras":
        return esAdmin(userRol) ? <AseguradorasPage aseguradoras={aseguradoras} onAdd={addAseguradora} onEdit={editAseguradora} onDelete={deleteAseguradora} /> : null;
      case "configuracion":
        return <ConfiguracionPage agentes={agentes} polizas={polizas} onAdd={addAgente} onEdit={editAgente} onDelete={deleteAgente} />;
      default:
        return null;
    }
  };

  return (
    <>
      <FontLoader />
      <ConfirmDialog confirmState={confirmState} onConfirm={handleConfirm} />
      <div style={S.app}>
        <Sidebar
          current={page} onNav={handleNav} onLogout={handleLogout}
          userName={userName} userRol={userRol}
          isOpen={sidebarOpen} isMobile={isMobile}
          onClose={() => setSidebarOpen(false)}
        />
        <div style={{ ...S.main, marginLeft: isMobile ? 0 : undefined }}>
          <Topbar page={page} userRol={userRol} isMobile={isMobile} onToggleSidebar={() => setSidebarOpen(o => !o)} />
          <div style={{ ...S.content, padding: isMobile ? "14px 12px" : "20px 16px" }}>{renderPage()}</div>
        </div>
      </div>
    </>
  );
}
