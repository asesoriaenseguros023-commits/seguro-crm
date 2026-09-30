import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";
import { S, BLUE, ROL_AGENTE, SECCIONES, SUBTABS_CONFIG } from "./constants.js";
import { esAdmin } from "./helpers.js";
import { FontLoader, LoadingScreen } from "./components/Modal.jsx";
import ConfirmDialog from "./components/ConfirmDialog.jsx";
import SoftphoneWidget from "./components/SoftphoneWidget.jsx";
import { useSoftphone } from "./hooks/useSoftphone.js";
import UpdateBanner from "./components/UpdateBanner.jsx";
import { useAppVersion } from "./hooks/useAppVersion.js";
import Icon from "./components/Icon.jsx";
import LoginPage from "./pages/Login.jsx";
import SoatPage from "./pages/SOAT.jsx";
import PulsoPrimasPage from "./pages/PulsoPrimas.jsx";
import CertificadosEscolaresPage from "./pages/CertificadosEscolares.jsx";
import OficinaSoatPage from "./pages/OficinaSoat.jsx";
import RamosPage from "./pages/Ramos.jsx";
import AseguradorasPage from "./pages/Aseguradoras.jsx";
import ConfiguracionPage from "./pages/Configuracion.jsx";
import ComercialPage from "./pages/Comerciales.jsx";
import ArriendosPage from "./pages/Arriendos.jsx";

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────
const Sidebar = ({ current, onNav, onLogo, onLogout, userName, userRol, isOpen, isMobile, onClose }) => {
  const initials = userName
    ? userName.split(" ").slice(0, 2).map((w) => w[0]).join("")
    : "U";

  const sidebarStyle = isMobile
    ? { ...S.sidebar, position: "fixed", top: 0, left: 0, height: "100vh", zIndex: 300, width: 240, transform: isOpen ? "translateX(0)" : "translateX(-100%)", transition: "transform 0.25s ease", boxShadow: isOpen ? "4px 0 24px rgba(0,0,0,0.45)" : "none" }
    : S.sidebar;

  const handleNav = (id) => { onNav(id); if (isMobile) onClose(); };
  const handleLogo = () => { onLogo(); if (isMobile) onClose(); };
  const visibles = SECCIONES.filter((s) => s.activo !== false && (!s.adminOnly || esAdmin(userRol)));

  return (
    <>
      {isMobile && isOpen && (
        <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 299 }} />
      )}
      <div style={sidebarStyle}>
        <div style={{ ...S.sbLogo, cursor: "pointer" }} onClick={handleLogo}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <img src="/logo.png" alt="Logo" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover" }} />
            <div>
              <div style={S.sbLogoText}>Asesoría en Seguros</div>
              <div style={S.sbLogoSub}>Tocancipá · NIT 46.662.968</div>
            </div>
          </div>
        </div>
        <div style={S.sbNav}>
          <div style={S.sbSection}>Secciones</div>
          {visibles.map((s) => (
            <div key={s.id} style={S.sbItem(current === s.id)} onClick={() => handleNav(s.id)}>
              <Icon name={s.icon} size={16} />{s.label}
            </div>
          ))}
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
const Topbar = ({ title, userRol, isMobile, onToggleSidebar }) => {
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
        <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700, color: BLUE.text }}>{title}</div>
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
  const [seccion, setSeccion] = useState("inicio");
  const [configTab, setConfigTab] = useState("ramos");
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState("");
  const [userRol, setUserRol] = useState(ROL_AGENTE);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const softphone = useSoftphone();
  const appVersion = useAppVersion();
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const [agentes, setAgentes] = useState([]);
  const [ramos, setRamos] = useState([]);
  const [documentosCatalogo, setDocumentosCatalogo] = useState([]);
  const [aseguradoras, setAseguradoras] = useState([]);

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
        .maybeSingle();
      if (data) {
        setUserName(data.nombre);
        setUserRol(data.rol || ROL_AGENTE);
      } else {
        // Fallback: si no encuentra el email en agentes, asumir el rol de
        // MENOS privilegio (Agente), no Admin — un correo autenticado que
        // no está en la tabla no debería heredar acceso total por defecto.
        setUserName("Usuario");
        setUserRol(ROL_AGENTE);
      }
    } catch {
      setUserName("Usuario");
      setUserRol(ROL_AGENTE);
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
      const [{ data: rms }, { data: asgs }, { data: agts }, { data: docs }] = await Promise.all([
        supabase.from("ramos").select("*").order("nombre"),
        supabase.from("aseguradoras").select("*").order("nombre"),
        supabase.from("agentes").select("*").order("nombre"),
        supabase.from("ramos_documentos").select("*").order("nombre"),
      ]);
      if (rms) setRamos(rms);
      if (asgs) setAseguradoras(asgs);
      if (agts) setAgentes(agts);
      if (docs) setDocumentosCatalogo(docs);
      setLoading(false);
    };
    cargar();
  }, [loggedIn]);

  const handleLogin = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) await resolverRol(session.user.email);
    setLoggedIn(true);
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

  // ─── CRUD Comerciales ─────────────────────────────────────────────────────
  // Antes pasaba por api/comerciales.js (un endpoint de Vercel completo solo
  // para esto). Se movió a Supabase directo desde el navegador — mismo
  // patrón que Ramos/Aseguradoras arriba — porque "Comerciales" ya vive bajo
  // "Configuraciones", una sección adminOnly (ver SECCIONES en constants.js):
  // ya nadie más que un Admin puede ni siquiera ver este formulario, así que
  // el endpoint no agregaba una restricción real que RLS no diera. Ahorra
  // una función serverless (Vercel Hobby tope a 12 — ver [[project-seguro-crm]]).
  const addComercial = async (nombre) => {
    const nombreUpper = nombre.trim().toUpperCase();
    const email = `comercial.${nombre.trim().toLowerCase().replace(/\s+/g, ".")}@crm.local`;
    const { data, error } = await supabase.from("agentes").insert([{ nombre: nombreUpper, rol: "Comercial", email }]).select().single();
    if (error) { console.error(error); return; }
    if (data) setAgentes((prev) => [...prev, data]);
  };
  const deleteComercial = async (id) => {
    await supabase.from("agentes").delete().eq("id", id).eq("rol", "Comercial");
    setAgentes((prev) => prev.filter((x) => x.id !== id));
  };

  // ─── CRUD Ramos ───────────────────────────────────────────────────────────
  // Antes se descartaba el error del insert: si fallaba (nombre vacío,
  // constraint, etc.) el modal se cerraba igual sin avisar nada — el ramo
  // simplemente no quedaba creado y no había ninguna pista de por qué.
  const addRamo = async (r) => {
    const { data, error } = await supabase.from("ramos").insert([{ nombre: r.nombre, descripcion: r.descripcion, activo: r.activo, documentos: r.documentos || {} }]).select().single();
    if (error) return { error: error.message };
    setRamos((prev) => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    return { data };
  };
  const editRamo = async (r) => {
    const { error } = await supabase.from("ramos").update({ nombre: r.nombre, descripcion: r.descripcion, activo: r.activo, documentos: r.documentos || {} }).eq("id", r.id);
    if (error) return { error: error.message };
    setRamos((prev) => prev.map((x) => x.id === r.id ? { ...x, ...r } : x).sort((a, b) => a.nombre.localeCompare(b.nombre)));
    return {};
  };
  const deleteRamo = async (id) => {
    await supabase.from("ramos").delete().eq("id", id);
    setRamos((prev) => prev.filter((x) => x.id !== id));
  };

  // ─── Documento requerido por ramo (toggle directo desde la tabla) ────────
  const toggleRamoDocumento = async (ramo, key) => {
    const documentos = { ...(ramo.documentos || {}), [key]: !ramo.documentos?.[key] };
    await supabase.from("ramos").update({ documentos }).eq("id", ramo.id);
    setRamos((prev) => prev.map((x) => x.id === ramo.id ? { ...x, documentos } : x));
  };

  // ─── CRUD Catálogo de documentos (antes en localStorage) ─────────────────
  const addDocumento = async (nombre, tipoPersona) => {
    const { data, error } = await supabase.from("ramos_documentos")
      .insert([{ nombre, tipo_persona: tipoPersona }]).select().single();
    if (error) { console.error("addDocumento error:", error); return; }
    if (data) setDocumentosCatalogo((prev) => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)));
  };
  const deleteDocumento = async (id) => {
    await supabase.from("ramos_documentos").delete().eq("id", id);
    setDocumentosCatalogo((prev) => prev.filter((x) => x.id !== id));
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setLoggedIn(false);
    setAgentes([]); setRamos([]);
    setUserRol(ROL_AGENTE);
  };

  if (!loggedIn) return <LoginPage onLogin={handleLogin} />;
  if (loading) return <><FontLoader /><LoadingScreen /></>;

  const handleNav = (id) => {
    const s = SECCIONES.find((x) => x.id === id);
    if (s?.activo === false) return;
    if (s?.adminOnly && !esAdmin(userRol)) return;
    setSeccion(id);
  };

  const renderConfigTab = () => {
    switch (configTab) {
      case "ramos":
        return (
          <RamosPage
            ramos={ramos} onAdd={addRamo} onEdit={editRamo} onDelete={deleteRamo}
            documentosCatalogo={documentosCatalogo} onToggleDocumento={toggleRamoDocumento}
            onAddDocumento={addDocumento} onDeleteDocumento={deleteDocumento}
          />
        );
      case "aseguradoras":
        return <AseguradorasPage aseguradoras={aseguradoras} onAdd={addAseguradora} onEdit={editAseguradora} onDelete={deleteAseguradora} />;
      case "comerciales":
        return <ComercialPage comerciales={agentes.filter((a) => a.rol === "Comercial")} onAdd={addComercial} onDelete={deleteComercial} showConfirm={showConfirm} />;
      case "configuracion":
        return <ConfiguracionPage agentes={agentes} onAdd={addAgente} onEdit={editAgente} onDelete={deleteAgente} />;
      default:
        return null;
    }
  };

  const renderContent = () => {
    if (seccion === "inicio") {
      const visibles = SECCIONES.filter((s) => s.activo !== false && (!s.adminOnly || esAdmin(userRol)));
      return (
        <div style={S.homeWrap}>
          <div style={S.homeTitle}>Hola, {userName || "Usuario"}</div>
          <div style={S.homeSub}>Elige un módulo</div>
          <div style={S.homeGrid}>
            {visibles.map((s) => (
              <div
                key={s.id} style={S.homeCard} onClick={() => setSeccion(s.id)}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = BLUE.primary; e.currentTarget.style.background = BLUE.light; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = BLUE.border; e.currentTarget.style.background = "#fff"; }}
              >
                <div style={S.homeCardIcon}><Icon name={s.icon} size={22} /></div>
                <div style={S.homeCardLabel}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (seccion === "soat") return <SoatPage showConfirm={showConfirm} softphone={softphone} comerciales={agentes.filter((a) => a.rol === "Comercial")} />;

    if (seccion === "primas") return <PulsoPrimasPage />;

    if (seccion === "certificados") return <CertificadosEscolaresPage />;

    if (seccion === "oficina-soat") return <OficinaSoatPage />;

    if (seccion === "arriendos") return esAdmin(userRol) ? <ArriendosPage /> : null;

    if (seccion === "config") {
      if (!esAdmin(userRol)) return null;
      return (
        <div>
          <div style={S.subTabBar}>
            {SUBTABS_CONFIG.map((t) => (
              <button key={t.id} style={S.subTabBtn(configTab === t.id)} onClick={() => setConfigTab(t.id)}>{t.label}</button>
            ))}
          </div>
          {renderConfigTab()}
        </div>
      );
    }

    return null;
  };

  const seccionLabel = SECCIONES.find((s) => s.id === seccion)?.label || "Inicio";
  const subTabLabel = seccion === "config" ? SUBTABS_CONFIG.find((t) => t.id === configTab)?.label : null;
  const topbarTitle = subTabLabel ? `${seccionLabel} · ${subTabLabel}` : seccionLabel;

  return (
    <>
      <FontLoader />
      <ConfirmDialog confirmState={confirmState} onConfirm={handleConfirm} />
      <SoftphoneWidget {...softphone} />
      <UpdateBanner {...appVersion} />
      <div style={S.app}>
        <Sidebar
          current={seccion} onNav={handleNav} onLogo={() => setSeccion("inicio")} onLogout={handleLogout}
          userName={userName} userRol={userRol}
          isOpen={sidebarOpen} isMobile={isMobile}
          onClose={() => setSidebarOpen(false)}
        />
        <div style={{ ...S.main, marginLeft: isMobile ? 0 : undefined }}>
          <Topbar title={topbarTitle} userRol={userRol} isMobile={isMobile} onToggleSidebar={() => setSidebarOpen(o => !o)} />
          <div style={{ ...S.content, padding: isMobile ? "14px 12px" : "20px 16px" }}>{renderContent()}</div>
        </div>
      </div>
    </>
  );
}
