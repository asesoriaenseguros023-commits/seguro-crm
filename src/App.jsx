import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";
import { S, BLUE, ROL_AGENTE, SECCIONES, SUBTABS_CONFIG } from "./constants.js";
import { esAdmin, authHeaders } from "./helpers.js";
import { FontLoader, LoadingScreen } from "./components/Modal.jsx";
import ConfirmDialog from "./components/ConfirmDialog.jsx";
import SoftphoneWidget from "./components/SoftphoneWidget.jsx";
import { useSoftphone } from "./hooks/useSoftphone.js";
import UpdateBanner from "./components/UpdateBanner.jsx";
import { useAppVersion } from "./hooks/useAppVersion.js";
import LoginPage from "./pages/Login.jsx";
import SoatPage from "./pages/SOAT.jsx";
import WhatsAppPage from "./pages/WhatsApp.jsx";
import AvisoWhatsapp from "./components/AvisoWhatsapp.jsx";
import PulsoPrimasPage from "./pages/PulsoPrimas.jsx";
import CertificadosEscolaresPage from "./pages/CertificadosEscolares.jsx";
import OficinaSoatPage from "./pages/OficinaSoat.jsx";
import RamosPage from "./pages/Ramos.jsx";
import AseguradorasPage from "./pages/Aseguradoras.jsx";
import ConfiguracionPage from "./pages/Configuracion.jsx";
import ComercialPage from "./pages/Comerciales.jsx";
import ArriendosPage from "./pages/Arriendos.jsx";

// ─── BARRA SUPERIOR (mismo diseño que POS Tocancipá) ─────────────────────────
const TopNav = ({ current, onNav, onLogo, onLogout, userName, userRol, isMobile, onAbrirWhatsapp, titulo }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const visibles = SECCIONES.filter((s) => s.activo !== false && (!s.adminOnly || esAdmin(userRol)));
  const go = (id) => { onNav(id); setMenuOpen(false); };
  const ancho = typeof window !== "undefined" ? window.innerWidth : 1200;
  const mostrarNombre = ancho >= 1024;

  return (
    <nav style={S.nav}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: isMobile ? "0 12px" : "0 16px" }}>
        <div style={{ display: "flex", alignItems: "center", height: 56, gap: 12 }}>
          <button onClick={() => { onLogo(); setMenuOpen(false); }} style={S.navLogoBtn}>
            <img src="/logo.png" alt="Logo" style={S.navLogoImg} />
            {mostrarNombre && (
              <div style={{ textAlign: "left" }}>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 14, lineHeight: 1.2, maxWidth: 180, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Asesoría en Seguros</div>
                <div style={{ color: "#93c5fd", fontSize: 12 }}>{esAdmin(userRol) ? "Admin" : userName || "Usuario"}</div>
              </div>
            )}
          </button>

          {!isMobile && <div style={{ width: 1, height: 24, background: "#2563eb", flexShrink: 0 }} />}

          {!isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: 2, flex: 1, overflowX: "auto", scrollbarWidth: "none" }}>
              {visibles.map((s) => (
                <button key={s.id} onClick={() => go(s.id)} style={S.navTab(current === s.id)}
                  onMouseEnter={(e) => { if (current !== s.id) { e.currentTarget.style.background = "#1d4ed8"; e.currentTarget.style.color = "#fff"; } }}
                  onMouseLeave={(e) => { if (current !== s.id) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#bfdbfe"; } }}>{s.label}</button>
              ))}
            </div>
          )}

          {isMobile && <div style={{ flex: 1, minWidth: 0, textAlign: "right", color: "#dbeafe", fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{current === "inicio" ? "" : titulo}</div>}

          <AvisoWhatsapp onAbrir={onAbrirWhatsapp} compacto={isMobile} />

          {!isMobile && <button onClick={onLogout} style={S.navSalir}>Salir</button>}

          {isMobile && (
            <button onClick={() => setMenuOpen((o) => !o)} style={S.navHamburger}>{menuOpen ? "✕" : "☰"}</button>
          )}
        </div>

        {isMobile && menuOpen && (
          <div style={{ paddingBottom: 12, paddingTop: 4 }}>
            {visibles.map((s) => (
              <button key={s.id} onClick={() => go(s.id)} style={S.navMobileItem(current === s.id)}>{s.label}</button>
            ))}
            <div style={{ borderTop: "1px solid #1d4ed8", marginTop: 4, paddingTop: 4 }}>
              <button onClick={onLogout} style={{ ...S.navMobileItem(false), color: "#93c5fd", fontSize: 14 }}>Cerrar sesión</button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [seccion, setSeccion] = useState("inicio");
  const [configTab, setConfigTab] = useState("ramos");
  // Cliente a seleccionar al entrar al módulo WhatsApp -- lo usa el ícono de
  // WhatsApp en Seguimiento SOAT cuando el cliente ya tiene conversación
  // (ver onAbrirWhatsapp más abajo y SOAT.jsx/WhatsApp.jsx).
  const [waClienteId, setWaClienteId] = useState(null);
  const abrirWhatsapp = (clienteId) => { setWaClienteId(clienteId); setSeccion("whatsapp"); };
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState("");
  const [userRol, setUserRol] = useState(ROL_AGENTE);
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

  // Cada compra nueva en Histórico SOAT (Oficina SOAT) marca al cliente del CRM como
  // "Compró". Corre al entrar y cada 2 minutos mientras la app esté abierta.
  useEffect(() => {
    if (!loggedIn) return;
    const sincronizar = async () => {
      try { await fetch("/api/sheets-dashboards?tipo=sincronizar-compras", { method: "POST", headers: await authHeaders() }); }
      catch { /* sin red: se reintenta en el próximo ciclo */ }
    };
    sincronizar();
    const id = setInterval(sincronizar, 120000);
    return () => clearInterval(id);
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
        <div>
          <div style={{ textAlign: "center", marginBottom: 32, paddingTop: 16 }}>
            <img src="/logo.png" alt="Logo" style={S.homeLogo} />
            <h1 style={S.homeTitle}>Asesoría en Seguros Tocancipá</h1>
            <p style={S.homeSub}>Hola, {userName || "Usuario"} — elige un módulo</p>
          </div>
          <div style={S.homeGrid}>
            {visibles.map((s) => (
              <button
                key={s.id} style={S.homeCard} onClick={() => setSeccion(s.id)}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#2563eb"; e.currentTarget.style.background = "#eff6ff"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = BLUE.border; e.currentTarget.style.background = "#fff"; }}
              >
                <span style={S.homeCardLabel}>{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (seccion === "soat") return <SoatPage showConfirm={showConfirm} softphone={softphone} comerciales={agentes.filter((a) => a.rol === "Comercial")} onAbrirWhatsapp={abrirWhatsapp} />;

    if (seccion === "whatsapp") return <WhatsAppPage clienteIdInicial={waClienteId} softphone={softphone} />;

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
        <TopNav
          current={seccion} onNav={handleNav} onLogo={() => setSeccion("inicio")} onLogout={handleLogout}
          userName={userName} userRol={userRol} isMobile={isMobile}
          onAbrirWhatsapp={abrirWhatsapp} titulo={topbarTitle}
        />
        <main style={{ ...S.main, padding: isMobile ? "12px 8px" : "24px 16px" }}>
          <div style={{ ...S.content, padding: isMobile ? 12 : 24 }}>{renderContent()}</div>
        </main>
      </div>
    </>
  );
}
