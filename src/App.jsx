import { useState, useEffect, useMemo } from "react";
import { supabase } from './supabase.js';

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
const fmtDate = (s) => { if (!s) return "—"; const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; };
const diasParaVencer = (fechaFin) => {
  if (!fechaFin) return 9999;
  const fin = new Date(fechaFin + "T00:00:00");
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  return Math.round((fin - hoy) / 86400000);
};
const estadoColor = (e) => ({ Activa: "#16a34a", Vencida: "#dc2626", Cancelada: "#6b7280" }[e] || "#6b7280");
const today = () => new Date().toISOString().split("T")[0];

// Mappers
const mapCliente = (c) => ({ ...c, agenteId: c.agente_id, fechaAlta: c.fecha_alta });
const mapInteresado = (i) => ({ ...i, agenteId: i.agente_id, tipoSeguro: i.tipo_seguro, tipoPersona: i.tipo_persona, documentosChecklist: i.documentos_checklist ? (typeof i.documentos_checklist === 'string' ? JSON.parse(i.documentos_checklist) : i.documentos_checklist) : {}, numeroContrato: i.numero_contrato, envioOficina: i.envio_oficina, fechaRegistro: i.fecha_registro, clienteId: i.cliente_id });
const mapCotizacion = (c) => ({ ...c, interesadoId: c.interesado_id, agenteId: c.agente_id, sumaAsegurada: c.suma_asegurada, fechaCotizacion: c.fecha_cotizacion, numeroPoliza: c.numero_poliza });
const mapPoliza = (p) => ({ ...p, cotizacionId: p.cotizacion_id, clienteId: p.cliente_id, agenteId: p.agente_id, sumaAsegurada: p.suma_asegurada, vigenciaInicio: p.vigencia_inicio, vigenciaFin: p.vigencia_fin, fechaEmision: p.fecha_emision, ramoId: p.ramo_id });

const ROL_ADMIN = "Admin";
const ROL_AGENTE = "Agente";
const esAdmin = (rol) => rol === ROL_ADMIN;

// ─── TEMA AZUL ───────────────────────────────────────────────────────────────
const BLUE = {
  primary: "#1a56db",
  primaryDark: "#1044b8",
  sidebar: "#0d2d6b",
  sidebarDark: "#071d47",
  accent: "#3b82f6",
  light: "#eff6ff",
  border: "#bfdbfe",
  text: "#1e3a5f",
};

// ─── ICONS ───────────────────────────────────────────────────────────────────
const Icon = ({ name, size = 18 }) => {
  const paths = {
    dashboard: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
    users: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
    document: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    bell: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
    shield: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    plus: "M12 4v16m8-8H4",
    search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
    edit: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
    trash: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
    x: "M6 18L18 6M6 6l12 12",
    logout: "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
    warning: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
    arrow: "M13 7l5 5m0 0l-5 5m5-5H6",
    chart: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    tag: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z",
  };
  return (
    <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d={paths[name] || ""} />
    </svg>
  );
};

// ─── STYLES ──────────────────────────────────────────────────────────────────
const S = {
  app: { display: "flex", minHeight: "100vh", background: `linear-gradient(135deg, ${BLUE.sidebarDark} 0%, #0a2255 100%)`, fontFamily: "'DM Sans', sans-serif", color: "#1a1a1a" },
  sidebar: { width: 230, background: `linear-gradient(180deg, ${BLUE.sidebarDark} 0%, ${BLUE.sidebar} 100%)`, display: "flex", flexDirection: "column", flexShrink: 0, position: "sticky", top: 0, height: "100vh", overflowY: "auto" },
  main: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 },
  topbar: { background: "#fff", borderBottom: `1px solid ${BLUE.border}`, padding: "0 28px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 },
  content: { flex: 1, padding: "28px 32px", overflowY: "auto", background: "#f0f4ff" },
  sbLogo: { padding: "20px 20px 14px", borderBottom: "1px solid rgba(255,255,255,0.1)" },
  sbLogoText: { fontSize: 18, color: "#fff", fontWeight: 700, letterSpacing: -0.5 },
  sbLogoSub: { fontSize: 10, color: "rgba(255,255,255,0.45)", fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 3 },
  sbNav: { flex: 1, padding: "14px 10px" },
  sbSection: { fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", padding: "10px 12px 6px" },
  sbItem: (active) => ({ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, cursor: "pointer", marginBottom: 2, transition: "all 0.15s", background: active ? "rgba(255,255,255,0.15)" : "transparent", color: active ? "#fff" : "rgba(255,255,255,0.6)", fontSize: 13.5, fontWeight: active ? 600 : 400, borderLeft: active ? "3px solid #60a5fa" : "3px solid transparent" }),
  sbBottom: { padding: "12px 10px", borderTop: "1px solid rgba(255,255,255,0.1)" },
  sbUser: { display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, color: "rgba(255,255,255,0.7)", fontSize: 13 },
  sbAvatar: { width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#60a5fa,#3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0 },
  pageHeader: { marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 },
  pageTitle: { fontSize: 26, fontWeight: 700, letterSpacing: -0.5, color: BLUE.text },
  pageSub: { fontSize: 13, color: "#6b87b0", marginTop: 3 },
  statGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px,1fr))", gap: 14, marginBottom: 24 },
  statCard: (accent) => ({ background: "#fff", borderRadius: 12, padding: "18px 20px", borderTop: `3px solid ${accent}`, boxShadow: "0 1px 6px rgba(26,86,219,0.08)" }),
  statNum: { fontSize: 28, fontWeight: 700, color: BLUE.text, letterSpacing: -1 },
  statLabel: { fontSize: 11.5, color: "#6b87b0", fontWeight: 600, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  tableWrap: { background: "#fff", borderRadius: 12, boxShadow: "0 1px 6px rgba(26,86,219,0.08)", overflow: "hidden" },
  tableHead: { display: "grid", background: BLUE.light, borderBottom: `1px solid ${BLUE.border}`, padding: "10px 18px", fontSize: 11, fontWeight: 700, color: BLUE.primary, letterSpacing: 0.8, textTransform: "uppercase" },
  tableRow: { display: "grid", padding: "13px 18px", borderBottom: "1px solid #e8f0fe", alignItems: "center", fontSize: 13.5, transition: "background 0.12s" },
  badge: (color) => ({ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 600, background: color + "18", color }),
  btn: (variant = "primary") => ({
    display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: "pointer", border: "none", transition: "all 0.15s",
    ...(variant === "primary" ? { background: BLUE.primary, color: "#fff" } : {}),
    ...(variant === "secondary" ? { background: BLUE.light, color: BLUE.primary, border: `1px solid ${BLUE.border}` } : {}),
    ...(variant === "danger" ? { background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" } : {}),
    ...(variant === "ghost" ? { background: "transparent", color: "#555", padding: "6px 10px" } : {}),
    ...(variant === "success" ? { background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" } : {}),
  }),
  input: { width: "100%", border: `1px solid ${BLUE.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 13.5, color: "#1a1a1a", background: "#fff", outline: "none", fontFamily: "inherit", boxSizing: "border-box" },
  label: { fontSize: 12, fontWeight: 600, color: BLUE.text, marginBottom: 5, display: "block", textTransform: "uppercase", letterSpacing: 0.5 },
  formGroup: { marginBottom: 16 },
  select: { width: "100%", border: `1px solid ${BLUE.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 13.5, color: "#1a1a1a", background: "#fff", outline: "none", fontFamily: "inherit" },
  overlay: { position: "fixed", inset: 0, background: "rgba(7,29,71,0.55)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 },
  modal: { background: "#fff", borderRadius: 14, width: "100%", maxWidth: 580, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(26,86,219,0.2)" },
  modalHeader: { padding: "20px 24px 16px", borderBottom: `1px solid ${BLUE.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: BLUE.light },
  modalTitle: { fontSize: 18, fontWeight: 700, color: BLUE.text },
  modalBody: { padding: "20px 24px" },
  modalFooter: { padding: "14px 24px", borderTop: `1px solid ${BLUE.border}`, display: "flex", justifyContent: "flex-end", gap: 10 },
  searchBar: { display: "flex", alignItems: "center", gap: 8, background: BLUE.light, border: `1px solid ${BLUE.border}`, borderRadius: 8, padding: "7px 12px", flex: 1, maxWidth: 340 },
  searchInput: { border: "none", background: "transparent", fontSize: 13.5, color: "#1a1a1a", outline: "none", width: "100%", fontFamily: "inherit" },
  chip: (color) => ({ padding: "2px 9px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: color + "18", color, display: "inline-block" }),
  alertBox: (color) => ({ background: color + "12", border: `1px solid ${color}30`, borderRadius: 10, padding: "12px 16px", display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 16 }),
  flowStep: (active, done) => ({
    display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600,
    background: done ? "#f0fdf4" : active ? BLUE.primary : BLUE.light,
    color: done ? "#16a34a" : active ? "#fff" : BLUE.primary,
    border: `1px solid ${done ? "#bbf7d0" : active ? BLUE.primary : BLUE.border}`,
  }),
};

// ─── FONT LOADER ─────────────────────────────────────────────────────────────
const FontLoader = () => {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap";
    document.head.appendChild(link);
  }, []);
  return null;
};

// ─── LOADING ─────────────────────────────────────────────────────────────────
const LoadingScreen = () => (
  <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f4ff", fontFamily: "'DM Sans', sans-serif" }}>
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: BLUE.text, marginBottom: 8 }}>Asesoría en Seguros</div>
      <div style={{ fontSize: 13, color: "#6b87b0" }}>Cargando datos…</div>
    </div>
  </div>
);

// ─── MODAL ───────────────────────────────────────────────────────────────────
const Modal = ({ title, onClose, children, footer, wide }) => (
  <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
    <div style={{ ...S.modal, maxWidth: wide ? 720 : 580 }}>
      <div style={S.modalHeader}>
        <span style={S.modalTitle}>{title}</span>
        <button style={S.btn("ghost")} onClick={onClose}><Icon name="x" size={18} /></button>
      </div>
      <div style={S.modalBody}>{children}</div>
      {footer && <div style={S.modalFooter}>{footer}</div>}
    </div>
  </div>
);

// ─── LOGIN ────────────────────────────────────────────────────────────────────
const ADMIN_EMAIL = "minchitas@gmail.com";

const LoginPage = ({ onLogin }) => {
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!pass) { setError("Ingresa la contraseña."); return; }
    setLoading(true); setError("");
    const { error: err } = await supabase.auth.signInWithPassword({ email: ADMIN_EMAIL, password: pass });
    if (err) { setError("Contraseña incorrecta."); setLoading(false); }
    else { onLogin(); }
  };

  const inputStyle = {
    width: "100%", border: "1.5px solid #d1d5db", borderRadius: 8, padding: "12px 14px",
    fontSize: 14, color: "#1a1a1a", background: "#fff", outline: "none",
    fontFamily: "inherit", boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", background: BLUE.primary, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 110, height: 110, borderRadius: 18, overflow: "hidden", margin: "0 auto 16px", boxShadow: "0 4px 24px rgba(0,0,0,0.25)" }}>
            <img src="/logo.png" alt="Logo Asesoría en Seguros" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>Asesoría en Seguros Tocancipá</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 4 }}>NIT: 46.662.968</div>
        </div>

        {/* Card */}
        <div style={{ background: "#fff", borderRadius: 14, padding: "32px 28px", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#111", marginBottom: 24, textAlign: "center" }}>Iniciar sesión</div>

          {/* Usuario fijo */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Usuario</label>
            <input style={{ ...inputStyle, background: "#f9fafb", color: "#6b7280", cursor: "not-allowed" }}
              type="text" value="Administrador" readOnly />
          </div>

          {/* Contraseña */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Contraseña</label>
            <div style={{ position: "relative" }}>
              <input style={{ ...inputStyle, paddingRight: 44 }}
                type={showPass ? "text" : "password"} value={pass}
                onChange={e => { setPass(e.target.value); setError(""); }}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="••••••••" autoFocus />
              <button onClick={() => setShowPass(v => !v)}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 16 }}>
                {showPass ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          {error && <div style={{ background: "#fef2f2", color: "#dc2626", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>{error}</div>}

          <button
            style={{ width: "100%", background: BLUE.primary, color: "#fff", border: "none", borderRadius: 8, padding: "13px 16px", fontSize: 16, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, fontFamily: "inherit" }}
            onClick={handleLogin} disabled={loading}>
            {loading ? "Iniciando sesión…" : "Entrar"}
          </button>
        </div>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
          Calle 11 No 5 - 89 Primer Piso Emisora de Tocancipá
        </div>
      </div>
    </div>
  );
};

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────
const Sidebar = ({ current, onNav, onLogout, userName, userRol }) => {
  const initials = userName ? userName.split(" ").slice(0, 2).map(w => w[0]).join("") : "U";
  return (
    <div style={S.sidebar}>
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
          { id: "reportes", label: "Reportes", icon: "chart" },
        ].map(i => (
          <div key={i.id} style={S.sbItem(current === i.id)} onClick={() => onNav(i.id)}>
            <Icon name={i.icon} size={16} />{i.label}
          </div>
        ))}
        {esAdmin(userRol) && <>
          <div style={S.sbSection}>Administración</div>
          {[
            { id: "configuracion", label: "Usuarios", icon: "shield" },
            { id: "ramos", label: "Ramos de Seguros", icon: "tag" },
          ].map(i => (
            <div key={i.id} style={S.sbItem(current === i.id)} onClick={() => onNav(i.id)}>
              <Icon name={i.icon} size={16} />{i.label}
            </div>
          ))}
        </>}
      </div>
      <div style={S.sbBottom}>
        <div style={{ padding: "4px 12px 8px" }}>
          <span style={{ ...S.chip(esAdmin(userRol) ? "#7c3aed" : BLUE.primary), fontSize: 11 }}>{userRol || "Agente"}</span>
        </div>
        <div style={S.sbUser}>
          <div style={S.sbAvatar}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: "#e5e7eb", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{userName || "Usuario"}</div>
          </div>
        </div>
        <div style={{ ...S.sbItem(false), marginTop: 4 }} onClick={onLogout}>
          <Icon name="logout" size={16} />Salir
        </div>
      </div>
    </div>
  );
};

// ─── TOPBAR ───────────────────────────────────────────────────────────────────
const Topbar = ({ page, userRol }) => {
  const labels = { dashboard: "Dashboard", clientes: "Clientes", interesados: "Leads", cotizaciones: "Cotizaciones", polizas: "Pólizas", renovaciones: "Renovaciones", configuracion: "Usuarios", ramos: "Ramos de Seguros", reportes: "Reportes" };
  const [ahora, setAhora] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const fmtFechaCorta = (d) => d.toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const fmtHora = (d) => d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <div style={S.topbar}>
      <div style={{ fontSize: 14, fontWeight: 700, color: BLUE.text }}>{labels[page] || page}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 12, color: "#6b87b0" }}>
        {/* Reloj */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, borderRight: `1px solid ${BLUE.border}`, paddingRight: 20 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: BLUE.primary, fontVariantNumeric: "tabular-nums" }}>{fmtHora(ahora)}</div>
            <div style={{ fontSize: 11, color: "#6b87b0", textTransform: "capitalize" }}>{fmtFechaCorta(ahora)}</div>
          </div>
        </div>
        <span style={S.chip(esAdmin(userRol) ? "#7c3aed" : BLUE.primary)}>{userRol}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a" }} />Sistema en línea
        </div>
      </div>
    </div>
  );
};

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
const Dashboard = ({ interesados, cotizaciones, polizas, userName, onNav }) => {
  const activas = polizas.filter(p => p.estado === "Activa");
  const primaTotal = activas.reduce((s, p) => s + Number(p.prima || 0), 0);
  const proxVencer = polizas.filter(p => p.estado === "Activa" && diasParaVencer(p.vigenciaFin) <= 30 && diasParaVencer(p.vigenciaFin) >= 0);
  const urgentes = proxVencer.filter(p => diasParaVencer(p.vigenciaFin) <= 7);
  const cotPendientes = cotizaciones.filter(c => c.estado === "Pendiente");

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={S.pageTitle}>Bienvenido al entorno de Gestión de Pólizas de Asesoría en Seguros Tocancipá</div>
        <div style={S.pageSub}>Vista de información de negocio</div>
      </div>

      {urgentes.length > 0 && (
        <div style={S.alertBox("#dc2626")}>
          <Icon name="warning" size={18} />
          <div style={{ fontSize: 13.5, color: "#dc2626" }}>
            <strong>{urgentes.length} póliza{urgentes.length > 1 ? "s" : ""}</strong> vence{urgentes.length === 1 ? "" : "n"} en los próximos 7 días.{" "}
            <span style={{ cursor: "pointer", textDecoration: "underline" }} onClick={() => onNav("renovaciones")}>Ver renovaciones →</span>
          </div>
        </div>
      )}

      {/* Fila 1: 3 tarjetas */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
        <div style={S.statCard(BLUE.primary)}><div style={S.statNum}>{interesados.length}</div><div style={S.statLabel}>Leads</div></div>
        <div style={S.statCard("#f59e0b")}><div style={S.statNum}>{cotPendientes.length}</div><div style={S.statLabel}>Cotizaciones Pendientes</div></div>
        <div style={S.statCard("#16a34a")}><div style={S.statNum}>{activas.length}</div><div style={S.statLabel}>Pólizas Activas</div></div>
      </div>
      {/* Fila 2: 2 tarjetas */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
        <div style={S.statCard("#dc2626")}><div style={S.statNum}>{proxVencer.length}</div><div style={S.statLabel}>Por Vencer (30d)</div></div>
        <div style={S.statCard("#7c3aed")}><div style={S.statNum}>{fmt(primaTotal)}</div><div style={S.statLabel}>Prima Total Activa</div></div>
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: "#6b87b0", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 12 }}>Pólizas por Vencer</div>
      <div style={S.tableWrap}>
        {proxVencer.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "#aaa", fontSize: 14 }}>No hay pólizas por vencer en los próximos 30 días ✅</div>
        ) : (
          <>
            <div style={{ ...S.tableHead, gridTemplateColumns: "1.5fr 1.2fr 1fr 1fr 80px" }}>
              <span>Póliza / Cliente</span><span>Ramo</span><span>Vence</span><span>Prima</span><span>Días</span>
            </div>
            {proxVencer.sort((a, b) => diasParaVencer(a.vigenciaFin) - diasParaVencer(b.vigenciaFin)).map(p => {
              const dias = diasParaVencer(p.vigenciaFin);
              return (
                <div key={p.id} style={{ ...S.tableRow, gridTemplateColumns: "1.5fr 1.2fr 1fr 1fr 80px" }}>
                  <div><div style={{ fontWeight: 600, fontSize: 13 }}>{p.numero}</div><div style={{ color: "#888", fontSize: 12 }}>{p.clienteNombre}</div></div>
                  <span style={S.chip(BLUE.primary)}>{p.ramo || p.tipo || "—"}</span>
                  <div style={{ fontSize: 13 }}>{fmtDate(p.vigenciaFin)}</div>
                  <div style={{ fontSize: 13 }}>{fmt(p.prima)}</div>
                  <span style={S.chip(dias <= 7 ? "#dc2626" : "#d97706")}>{dias}d</span>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
};

// ─── FLUJO: LEAD → COTIZACIÓN → PÓLIZA ─────────────────────────────────

// ─── RAMOS QUE REQUIEREN CHECKLIST ───────────────────────────────────────────
const RAMOS_CHECKLIST = ["Responsabilidad Civil", "Cumplimiento", "Responsabilidad Civil Profesional"];
const DOCS_NATURAL = ["SARLAFT", "Cédula", "RUT"];
const DOCS_JURIDICA = ["Cámara de Comercio", "Estados Financieros", "RUT Empresa", "Cédula Representante Legal", "SARLAFT"];

// Form Lead
const InteresadoForm = ({ initial, agentes, ramos, clientes, onSave, onClose }) => {
  const [form, setForm] = useState(initial || {
    clienteId: clientes[0]?.id || "",
    email: "", celular: "", direccion: "", ciudad: "", documento: "", tipoDocumento: "CC",
    tipoSeguro: ramos[0]?.nombre || "", tipoPersona: "Natural",
    documentosChecklist: {}, numeroContrato: "", envioOficina: false,
    agenteId: agentes[0]?.id || "", notas: "", estado: "Lead",
    fechaRegistro: today(),
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setDoc = (nombre, val) => setForm(f => ({ ...f, documentosChecklist: { ...f.documentosChecklist, [nombre]: val } }));

  const requiereChecklist = RAMOS_CHECKLIST.includes(form.tipoSeguro);
  const docsRequeridos = form.tipoPersona === "Natural" ? DOCS_NATURAL : DOCS_JURIDICA;
  const clienteSeleccionado = clientes.find(c => c.id === form.clienteId);
  const valid = form.clienteId && form.tipoSeguro;

  const handleSave = async () => { setSaving(true); await onSave(form); setSaving(false); };

  return (
    <Modal title={initial?.id ? "Editar Lead" : "Nuevo Lead"} onClose={onClose} wide
      footer={<>
        <button style={S.btn("secondary")} onClick={onClose}>Cancelar</button>
        <button style={{ ...S.btn("primary"), opacity: valid && !saving ? 1 : 0.5 }} onClick={handleSave} disabled={!valid || saving}>
          {saving ? "Guardando…" : "Guardar Lead"}
        </button>
      </>}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>

        {/* Selección de cliente */}
        <div style={{ ...S.formGroup, gridColumn: "1/-1" }}>
          <label style={S.label}>Cliente *</label>
          <select style={S.select} value={form.clienteId} onChange={e => set("clienteId", e.target.value)}>
            <option value="">— Selecciona un cliente —</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.documento ? `· ${c.documento}` : ""}</option>)}
          </select>
          {clienteSeleccionado && (
            <div style={{ marginTop: 8, background: BLUE.light, borderRadius: 8, padding: "8px 12px", fontSize: 12.5, color: BLUE.text, border: `1px solid ${BLUE.border}` }}>
              📋 {clienteSeleccionado.nombre} · {clienteSeleccionado.email || ""} · {clienteSeleccionado.celular || ""}
            </div>
          )}
        </div>

        {/* Fecha registro automática */}
        <div style={S.formGroup}>
          <label style={S.label}>Fecha de Registro</label>
          <input style={{ ...S.input, background: "#f8faff", color: "#6b87b0" }} type="date" value={form.fechaRegistro} readOnly />
        </div>

        {/* Tipo de seguro */}
        <div style={S.formGroup}>
          <label style={S.label}>Tipo de Seguro *</label>
          <select style={S.select} value={form.tipoSeguro} onChange={e => { set("tipoSeguro", e.target.value); set("documentosChecklist", {}); }}>
            {ramos.map(r => <option key={r.id} value={r.nombre}>{r.nombre}</option>)}
          </select>
        </div>

        <div style={S.formGroup}>
          <label style={S.label}>Agente</label>
          <select style={S.select} value={form.agenteId} onChange={e => set("agenteId", e.target.value)}>
            {agentes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </div>

        {/* Campos dinámicos para ramos especiales */}
        {requiereChecklist && (
          <div style={{ gridColumn: "1/-1", background: "#f8faff", border: `1px solid ${BLUE.border}`, borderRadius: 10, padding: "16px 18px", marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: BLUE.text, marginBottom: 12 }}>
              📄 Documentos requeridos — {form.tipoSeguro}
            </div>

            {/* Tipo persona */}
            <div style={S.formGroup}>
              <label style={S.label}>Tipo de Persona *</label>
              <div style={{ display: "flex", gap: 10 }}>
                {["Natural", "Jurídica"].map(tp => (
                  <button key={tp} onClick={() => { set("tipoPersona", tp); set("documentosChecklist", {}); }}
                    style={{ padding: "8px 20px", borderRadius: 8, border: `1.5px solid ${form.tipoPersona === tp ? BLUE.primary : BLUE.border}`, background: form.tipoPersona === tp ? BLUE.primary : "#fff", color: form.tipoPersona === tp ? "#fff" : BLUE.text, fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
                    {tp === "Natural" ? "👤 Persona Natural" : "🏢 Persona Jurídica"}
                  </button>
                ))}
              </div>
            </div>

            {/* Checklist documentos */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {docsRequeridos.map(doc => (
                <div key={doc} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", borderRadius: 8, padding: "10px 14px", border: `1px solid ${BLUE.border}` }}>
                  <span style={{ fontSize: 13.5, color: BLUE.text }}>{doc}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    {["Sí", "No"].map(val => (
                      <button key={val} onClick={() => setDoc(doc, val)}
                        style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${form.documentosChecklist[doc] === val ? (val === "Sí" ? "#16a34a" : "#dc2626") : BLUE.border}`, background: form.documentosChecklist[doc] === val ? (val === "Sí" ? "#f0fdf4" : "#fef2f2") : "#fff", color: form.documentosChecklist[doc] === val ? (val === "Sí" ? "#16a34a" : "#dc2626") : "#888", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        {val === "Sí" ? "✓ Sí" : "✗ No"}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Contrato */}
            <div style={{ ...S.formGroup, marginTop: 14, marginBottom: 0 }}>
              <label style={S.label}>N° Contrato</label>
              <input style={S.input} value={form.numeroContrato} onChange={e => set("numeroContrato", e.target.value)} placeholder="Número de contrato" />
            </div>
          </div>
        )}

        <div style={{ ...S.formGroup, gridColumn: "1/-1" }}>
          <label style={S.label}>Notas</label>
          <textarea style={{ ...S.input, minHeight: 60, resize: "vertical" }} value={form.notas} onChange={e => set("notas", e.target.value)} />
        </div>

        {/* Envío a oficina */}
        <div style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", gap: 12, background: form.envioOficina ? "#f0fdf4" : BLUE.light, border: `1px solid ${form.envioOficina ? "#bbf7d0" : BLUE.border}`, borderRadius: 10, padding: "12px 16px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flex: 1 }}>
            <input type="checkbox" checked={form.envioOficina} onChange={e => set("envioOficina", e.target.checked)}
              style={{ width: 18, height: 18, accentColor: "#16a34a", cursor: "pointer" }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: form.envioOficina ? "#16a34a" : BLUE.text }}>
              {form.envioOficina ? "✓ Enviado a oficina" : "Envío a oficina"}
            </span>
          </label>
        </div>
      </div>
    </Modal>
  );
};

// ─── MÓDULO CLIENTES ─────────────────────────────────────────────────────────
const FORM_CLIENTE_VACIO = { tipoPersona: "Natural", nombre: "", email: "", celular: "", documento: "", tipoDocumento: "CC", ciudad: "", direccion: "", notas: "", nombreContacto: "", telefonoContacto: "" };

const ClientesPage = ({ clientes, onAdd, onEdit, onDelete, onImport, userRol }) => {
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [delItem, setDelItem] = useState(null);
  const [form, setForm] = useState(FORM_CLIENTE_VACIO);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const clientesFiltrados = useMemo(() =>
    clientes.filter(c => !q || c.nombre?.toLowerCase().includes(q.toLowerCase()) || c.email?.toLowerCase().includes(q.toLowerCase()) || c.documento?.includes(q) || c.celular?.includes(q))
  , [clientes, q]);

  const resetForm = () => { setForm(FORM_CLIENTE_VACIO); setShowForm(false); setEditItem(null); };

  const handleSave = async () => {
    if (!form.nombre) return;
    setSaving(true);
    if (editItem) { await onEdit({ ...editItem, ...form }); setEditItem(null); }
    else { await onAdd(form); resetForm(); }
    setSaving(false);
  };

  // Descarga template XLSX
  const downloadTemplate = () => {
    const headers = ["tipo_persona", "nombre", "email", "celular", "tipo_documento", "documento", "ciudad", "direccion", "nombre_contacto", "telefono_contacto", "notas"];
    const ejemplo1 = ["Natural", "Juan Pérez García", "juan@email.com", "3001234567", "CC", "12345678", "Bogotá", "Calle 123", "", "", "Cliente ejemplo"];
    const ejemplo2 = ["Jurídica", "Empresa S.A.S", "empresa@email.com", "3009876543", "NIT", "900123456-1", "Medellín", "Av. Principal 45", "María López", "3112223344", "Empresa ejemplo"];
    const csvContent = [headers, ejemplo1, ejemplo2].map(r => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "template_clientes.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  // Importar desde CSV/XLSX
  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true); setImportMsg("");
    const text = await file.text();
    const lines = text.trim().split("\n");
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/\r/g, ""));
    let ok = 0, errors = 0;
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(",").map(v => v.trim().replace(/\r/g, ""));
      const row = {};
      headers.forEach((h, idx) => { row[h] = vals[idx] || ""; });
      if (!row.nombre) { errors++; continue; }
      try {
        await onAdd({
          tipoPersona: row.tipo_persona || "Natural",
          nombre: row.nombre, email: row.email, celular: row.celular,
          tipoDocumento: row.tipo_documento || "CC", documento: row.documento,
          ciudad: row.ciudad, direccion: row.direccion,
          nombreContacto: row.nombre_contacto, telefonoContacto: row.telefono_contacto,
          notas: row.notas,
        });
        ok++;
      } catch { errors++; }
    }
    setImportMsg(`✓ ${ok} importados${errors > 0 ? ` · ${errors} errores` : ""}`);
    setImporting(false);
    e.target.value = "";
  };

  const openEdit = (c) => {
    setEditItem(c);
    setForm({ tipoPersona: c.tipoPersona || "Natural", nombre: c.nombre || "", email: c.email || "", celular: c.celular || "", documento: c.documento || "", tipoDocumento: c.tipoDocumento || "CC", ciudad: c.ciudad || "", direccion: c.direccion || "", notas: c.notas || "", nombreContacto: c.nombreContacto || "", telefonoContacto: c.telefonoContacto || "" });
  };

  return (
    <div>
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>Clientes</div>
          <div style={S.pageSub}>{clientesFiltrados.length} clientes registrados</div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {/* Importar */}
          <label style={{ ...S.btn("secondary"), cursor: "pointer" }}>
            📥 Importar .CSV
            <input type="file" accept=".csv,.xlsx" style={{ display: "none" }} onChange={handleImport} disabled={importing} />
          </label>
          <button style={S.btn("secondary")} onClick={downloadTemplate}>⬇ Bajar Template</button>
          <button style={S.btn("primary")} onClick={() => setShowForm(true)}><Icon name="plus" size={16} />Nuevo Cliente</button>
        </div>
      </div>

      {importMsg && (
        <div style={{ ...S.alertBox("#16a34a"), marginBottom: 16 }}>
          <span style={{ fontSize: 13.5, color: "#16a34a", fontWeight: 600 }}>{importMsg}</span>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div style={S.searchBar}><Icon name="search" size={16} /><input style={S.searchInput} placeholder="Buscar por nombre, email, documento, celular…" value={q} onChange={e => setQ(e.target.value)} /></div>
      </div>

      <div style={S.tableWrap}>
        <div style={{ ...S.tableHead, gridTemplateColumns: "0.7fr 1.8fr 1.2fr 1fr 1fr 0.8fr 100px" }}>
          <span>Tipo</span><span>Nombre</span><span>Celular / Email</span><span>Documento</span><span>Ciudad</span><span>Contacto</span><span>Acciones</span>
        </div>
        {clientesFiltrados.length === 0
          ? <div style={{ padding: 40, textAlign: "center", color: "#aaa" }}>No hay clientes registrados</div>
          : clientesFiltrados.map(c => (
            <div key={c.id} style={{ ...S.tableRow, gridTemplateColumns: "0.7fr 1.8fr 1.2fr 1fr 1fr 0.8fr 100px" }}
              onMouseEnter={e => e.currentTarget.style.background = BLUE.light}
              onMouseLeave={e => e.currentTarget.style.background = ""}>
              <span style={S.chip(c.tipoPersona === "Jurídica" ? "#7c3aed" : BLUE.primary)}>{c.tipoPersona === "Jurídica" ? "🏢" : "👤"}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{c.nombre}</div>
                {c.tipoPersona === "Jurídica" && c.nombreContacto && <div style={{ fontSize: 11.5, color: "#888" }}>Cto: {c.nombreContacto}</div>}
              </div>
              <div>
                <div style={{ fontSize: 13 }}>{c.celular || "—"}</div>
                <div style={{ fontSize: 11.5, color: "#888" }}>{c.email || ""}</div>
              </div>
              <div style={{ fontSize: 13 }}>{c.tipoDocumento}: {c.documento || "—"}</div>
              <div style={{ fontSize: 13, color: "#555" }}>{c.ciudad || "—"}</div>
              <div style={{ fontSize: 12.5, color: "#555" }}>{c.tipoPersona === "Jurídica" ? (c.telefonoContacto || "—") : "—"}</div>
              <div style={{ display: "flex", gap: 4 }}>
                <button style={S.btn("ghost")} onClick={() => openEdit(c)}><Icon name="edit" size={14} /></button>
                {esAdmin(userRol) && <button style={{ ...S.btn("ghost"), color: "#dc2626" }} onClick={() => setDelItem(c)}><Icon name="trash" size={14} /></button>}
              </div>
            </div>
          ))}
      </div>

      {/* FORM MODAL */}
      {(showForm || editItem) && (
        <Modal title={editItem ? "Editar Cliente" : "Nuevo Cliente"} onClose={resetForm} wide
          footer={<>
            <button style={S.btn("secondary")} onClick={resetForm}>Cancelar</button>
            <button style={{ ...S.btn("primary"), opacity: form.nombre && !saving ? 1 : 0.5 }} onClick={handleSave} disabled={!form.nombre || saving}>{saving ? "Guardando…" : "Guardar"}</button>
          </>}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>

            {/* Tipo persona — siempre primero */}
            <div style={{ ...S.formGroup, gridColumn: "1/-1" }}>
              <label style={S.label}>Tipo de Persona *</label>
              <div style={{ display: "flex", gap: 10 }}>
                {["Natural", "Jurídica"].map(tp => (
                  <button key={tp} onClick={() => set("tipoPersona", tp)}
                    style={{ flex: 1, padding: "10px 20px", borderRadius: 10, border: `2px solid ${form.tipoPersona === tp ? BLUE.primary : BLUE.border}`, background: form.tipoPersona === tp ? BLUE.primary : "#fff", color: form.tipoPersona === tp ? "#fff" : BLUE.text, fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "all 0.15s" }}>
                    {tp === "Natural" ? "👤 Persona Natural" : "🏢 Persona Jurídica"}
                  </button>
                ))}
              </div>
            </div>

            {/* Nombre */}
            <div style={{ ...S.formGroup, gridColumn: "1/-1" }}>
              <label style={S.label}>{form.tipoPersona === "Jurídica" ? "Razón Social *" : "Nombre Completo *"}</label>
              <input style={S.input} value={form.nombre} onChange={e => set("nombre", e.target.value)} placeholder={form.tipoPersona === "Jurídica" ? "Empresa S.A.S" : "Nombre completo"} />
            </div>

            {/* Campos comunes */}
            <div style={S.formGroup}>
              <label style={S.label}>Tipo Documento</label>
              <select style={S.select} value={form.tipoDocumento} onChange={e => set("tipoDocumento", e.target.value)}>
                {(form.tipoPersona === "Jurídica" ? ["NIT", "RUT"] : ["CC", "CE", "Pasaporte"]).map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={S.formGroup}>
              <label style={S.label}>N° Documento</label>
              <input style={S.input} value={form.documento} onChange={e => set("documento", e.target.value)} />
            </div>
            <div style={S.formGroup}>
              <label style={S.label}>Celular</label>
              <input style={S.input} value={form.celular} onChange={e => set("celular", e.target.value)} placeholder="3001234567" />
            </div>
            <div style={S.formGroup}>
              <label style={S.label}>Correo Electrónico</label>
              <input style={S.input} type="email" value={form.email} onChange={e => set("email", e.target.value)} />
            </div>
            <div style={S.formGroup}>
              <label style={S.label}>Ciudad</label>
              <input style={S.input} value={form.ciudad} onChange={e => set("ciudad", e.target.value)} />
            </div>
            <div style={S.formGroup}>
              <label style={S.label}>Dirección</label>
              <input style={S.input} value={form.direccion} onChange={e => set("direccion", e.target.value)} />
            </div>
            {/* Campos exclusivos Jurídica */}
            {form.tipoPersona === "Jurídica" && (<>
              <div style={S.formGroup}>
                <label style={S.label}>Nombre Contacto</label>
                <input style={S.input} value={form.nombreContacto} onChange={e => set("nombreContacto", e.target.value)} placeholder="Nombre del contacto principal" />
              </div>
              <div style={S.formGroup}>
                <label style={S.label}>Teléfono Contacto</label>
                <input style={S.input} value={form.telefonoContacto} onChange={e => set("telefonoContacto", e.target.value)} placeholder="3001234567" />
              </div>
            </>)}

            <div style={{ ...S.formGroup, gridColumn: "1/-1" }}>
              <label style={S.label}>Notas</label>
              <textarea style={{ ...S.input, minHeight: 60, resize: "vertical" }} value={form.notas} onChange={e => set("notas", e.target.value)} />
            </div>
          </div>
        </Modal>
      )}
      {delItem && (
        <Modal title="Confirmar eliminación" onClose={() => setDelItem(null)}
          footer={<><button style={S.btn("secondary")} onClick={() => setDelItem(null)}>Cancelar</button><button style={S.btn("danger")} onClick={async () => { await onDelete(delItem.id); setDelItem(null); }}>Eliminar</button></>}>
          <p style={{ fontSize: 14, color: "#555" }}>¿Eliminar al cliente <strong>{delItem.nombre}</strong>?</p>
        </Modal>
      )}
    </div>
  );
};

// Form Cotización
const CotizacionForm = ({ interesado, initial, agentes, ramos, onSave, onClose }) => {
  const [form, setForm] = useState(initial || {
    interesadoId: interesado?.id || "",
    agenteId: interesado?.agenteId || agentes[0]?.id || "",
    ramo: interesado?.tipoSeguro || ramos[0]?.nombre || "",
    aseguradora: "",
    sumaAsegurada: "",
    prima: "",
    iva: "",
    gastosExpedicion: "",
    numeroPoliza: "",
    fechaCotizacion: today(),
    notas: "",
    estado: "Pendiente",
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.aseguradora && form.prima && form.fechaCotizacion;
  const totalCotizacion = (Number(form.prima) || 0) + (Number(form.iva) || 0) + (Number(form.gastosExpedicion) || 0);

  const handleSave = async () => { setSaving(true); await onSave(form); setSaving(false); };

  return (
    <Modal title={initial?.id ? "Editar Cotización" : `Nueva Cotización — ${interesado?.nombre || ""}`} onClose={onClose} wide
      footer={<>
        <button style={S.btn("secondary")} onClick={onClose}>Cancelar</button>
        <button style={{ ...S.btn("primary"), opacity: valid && !saving ? 1 : 0.5 }} onClick={handleSave} disabled={!valid || saving}>
          {saving ? "Guardando…" : "Guardar Cotización"}
        </button>
      </>}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
        <div style={S.formGroup}>
          <label style={S.label}>Ramo</label>
          <select style={S.select} value={form.ramo} onChange={e => set("ramo", e.target.value)}>
            {ramos.map(r => <option key={r.id} value={r.nombre}>{r.nombre}</option>)}
          </select>
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>Aseguradora *</label>
          <input style={S.input} value={form.aseguradora} onChange={e => set("aseguradora", e.target.value)} placeholder="Ej. Sura, Bolivar, Allianz" />
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>Suma Asegurada</label>
          <input style={S.input} type="number" value={form.sumaAsegurada} onChange={e => set("sumaAsegurada", e.target.value)} />
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>Prima *</label>
          <input style={S.input} type="number" value={form.prima} onChange={e => set("prima", e.target.value)} />
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>IVA</label>
          <input style={S.input} type="number" value={form.iva} onChange={e => set("iva", e.target.value)} />
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>Gastos de Expedición</label>
          <input style={S.input} type="number" value={form.gastosExpedicion} onChange={e => set("gastosExpedicion", e.target.value)} />
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>N° Póliza (si aplica)</label>
          <input style={S.input} value={form.numeroPoliza} onChange={e => set("numeroPoliza", e.target.value)} />
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>Fecha de Cotización *</label>
          <input style={S.input} type="date" value={form.fechaCotizacion} onChange={e => set("fechaCotizacion", e.target.value)} />
        </div>
        <div style={{ ...S.formGroup, gridColumn: "1/-1" }}>
          <label style={S.label}>Notas</label>
          <textarea style={{ ...S.input, minHeight: 60, resize: "vertical" }} value={form.notas} onChange={e => set("notas", e.target.value)} />
        </div>
        {totalCotizacion > 0 && (
          <div style={{ gridColumn: "1/-1", background: BLUE.light, borderRadius: 10, padding: "12px 16px", border: `1px solid ${BLUE.border}` }}>
            <div style={{ fontSize: 12, color: BLUE.primary, fontWeight: 700, marginBottom: 6 }}>RESUMEN DE COTIZACIÓN</div>
            <div style={{ display: "flex", gap: 24, fontSize: 13 }}>
              <span>Prima: <strong>{fmt(Number(form.prima) || 0)}</strong></span>
              <span>IVA: <strong>{fmt(Number(form.iva) || 0)}</strong></span>
              <span>Gastos: <strong>{fmt(Number(form.gastosExpedicion) || 0)}</strong></span>
              <span style={{ color: BLUE.primary, fontWeight: 700 }}>Total: <strong>{fmt(totalCotizacion)}</strong></span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

// Form Emisión de Póliza
const EmisionForm = ({ cotizacion, interesado, ramos, onSave, onClose }) => {
  const [form, setForm] = useState({
    fechaEmision: today(),
    vigenciaInicio: today(),
    vigenciaFin: "",
    ramoId: ramos.find(r => r.nombre === cotizacion?.ramo)?.id || ramos[0]?.id || "",
    notas: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.fechaEmision && form.vigenciaInicio && form.vigenciaFin;

  const handleSave = async () => { setSaving(true); await onSave(form); setSaving(false); };

  return (
    <Modal title={`Emitir Póliza — ${interesado?.nombre || ""}`} onClose={onClose}
      footer={<>
        <button style={S.btn("secondary")} onClick={onClose}>Cancelar</button>
        <button style={{ ...S.btn("success"), opacity: valid && !saving ? 1 : 0.5 }} onClick={handleSave} disabled={!valid || saving}>
          {saving ? "Emitiendo…" : "✓ Emitir Póliza"}
        </button>
      </>}>
      <div style={{ background: BLUE.light, borderRadius: 10, padding: "12px 16px", marginBottom: 20, border: `1px solid ${BLUE.border}` }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: BLUE.primary, marginBottom: 8 }}>DATOS DE LA COTIZACIÓN</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 13 }}>
          <span>Ramo: <strong>{cotizacion?.ramo}</strong></span>
          <span>Aseguradora: <strong>{cotizacion?.aseguradora}</strong></span>
          <span>Prima: <strong>{fmt(cotizacion?.prima || 0)}</strong></span>
          <span>N° Póliza: <strong>{cotizacion?.numeroPoliza || "—"}</strong></span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
        <div style={S.formGroup}>
          <label style={S.label}>Ramo de Seguros *</label>
          <select style={S.select} value={form.ramoId} onChange={e => set("ramoId", e.target.value)}>
            {ramos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>Fecha de Emisión *</label>
          <input style={S.input} type="date" value={form.fechaEmision} onChange={e => set("fechaEmision", e.target.value)} />
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>Vigencia Inicio *</label>
          <input style={S.input} type="date" value={form.vigenciaInicio} onChange={e => set("vigenciaInicio", e.target.value)} />
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>Vigencia Fin *</label>
          <input style={S.input} type="date" value={form.vigenciaFin} onChange={e => set("vigenciaFin", e.target.value)} />
        </div>
        <div style={{ ...S.formGroup, gridColumn: "1/-1" }}>
          <label style={S.label}>Notas adicionales</label>
          <textarea style={{ ...S.input, minHeight: 60, resize: "vertical" }} value={form.notas} onChange={e => set("notas", e.target.value)} />
        </div>
      </div>
    </Modal>
  );
};

// ─── PÁGINA COTIZACIONES (módulo independiente) ───────────────────────────────
const CotizacionesPage = ({ cotizaciones, interesados, polizas, agentes, ramos, onAddCotizacion, onEditCotizacion, onEmitirPoliza, userRol, agenteActualId }) => {
  const [q, setQ] = useState("");
  const [showCotizacion, setShowCotizacion] = useState(null);
  const [editCotizacion, setEditCotizacion] = useState(null);
  const [showEmision, setShowEmision] = useState(null);

  const cotizacionesFiltradas = useMemo(() => {
    const base = esAdmin(userRol) ? cotizaciones : cotizaciones.filter(c => c.agenteId === agenteActualId);
    return base.filter(c => !q || c.aseguradora?.toLowerCase().includes(q.toLowerCase()) || c.ramo?.toLowerCase().includes(q.toLowerCase()) || c.numeroPoliza?.toLowerCase().includes(q.toLowerCase()));
  }, [cotizaciones, q, userRol, agenteActualId]);

  const handleSaveCotizacion = async (form) => {
    if (editCotizacion) { await onEditCotizacion({ ...editCotizacion, ...form }); setEditCotizacion(null); }
    else { await onAddCotizacion(form); setShowCotizacion(null); }
  };
  const handleEmitir = async (form) => {
    await onEmitirPoliza({ cotizacion: showEmision.cotizacion, interesado: showEmision.interesado, ...form });
    setShowEmision(null);
  };

  const estadoCotColor = (e) => ({ Pendiente: "#f59e0b", Emitida: "#16a34a", Cancelada: "#6b7280" }[e] || "#6b7280");

  return (
    <div>
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>Cotizaciones</div>
          <div style={S.pageSub}>{cotizacionesFiltradas.length} cotizaciones registradas</div>
        </div>
        <button style={S.btn("primary")} onClick={() => setShowCotizacion(true)}><Icon name="plus" size={16} />Nueva Cotización</button>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div style={S.searchBar}><Icon name="search" size={16} /><input style={S.searchInput} placeholder="Buscar por aseguradora, ramo, n° póliza…" value={q} onChange={e => setQ(e.target.value)} /></div>
      </div>

      <div style={S.tableWrap}>
        <div style={{ ...S.tableHead, gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr 0.8fr 120px" }}>
          <span>Lead</span><span>Ramo</span><span>Aseguradora</span><span>Prima</span><span>Fecha</span><span>Estado</span><span>Acciones</span>
        </div>
        {cotizacionesFiltradas.length === 0
          ? <div style={{ padding: 40, textAlign: "center", color: "#aaa" }}>No hay cotizaciones registradas</div>
          : cotizacionesFiltradas.map(c => {
            const interesado = interesados.find(i => i.id === c.interesadoId);
            const yaEmitida = polizas.some(p => p.cotizacionId === c.id);
            return (
              <div key={c.id} style={{ ...S.tableRow, gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr 0.8fr 120px" }}
                onMouseEnter={e => e.currentTarget.style.background = BLUE.light}
                onMouseLeave={e => e.currentTarget.style.background = ""}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{interesado?.nombre || "—"}</div>
                  <div style={{ fontSize: 11.5, color: "#888" }}>{c.numeroPoliza || ""}</div>
                </div>
                <span style={S.chip(BLUE.primary)}>{c.ramo || "—"}</span>
                <div style={{ fontSize: 13 }}>{c.aseguradora}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{fmt(c.prima || 0)}</div>
                <div style={{ fontSize: 13 }}>{fmtDate(c.fechaCotizacion)}</div>
                <span style={S.badge(estadoCotColor(yaEmitida ? "Emitida" : c.estado))}>{yaEmitida ? "Emitida" : c.estado}</span>
                <div style={{ display: "flex", gap: 3 }}>
                  {!yaEmitida && c.estado !== "Cancelada" && (
                    <button title="Emitir Póliza" style={{ ...S.btn("success"), padding: "5px 10px", fontSize: 12 }}
                      onClick={() => setShowEmision({ cotizacion: c, interesado })}>
                      Emitir
                    </button>
                  )}
                  <button style={S.btn("ghost")} onClick={() => setEditCotizacion(c)}><Icon name="edit" size={14} /></button>
                </div>
              </div>
            );
          })}
      </div>

      {showCotizacion && (
        <CotizacionForm interesado={null} agentes={agentes} ramos={ramos} onSave={handleSaveCotizacion} onClose={() => setShowCotizacion(null)} />
      )}
      {editCotizacion && (
        <CotizacionForm initial={editCotizacion} interesado={interesados.find(i => i.id === editCotizacion.interesadoId)} agentes={agentes} ramos={ramos} onSave={handleSaveCotizacion} onClose={() => setEditCotizacion(null)} />
      )}
      {showEmision && (
        <EmisionForm cotizacion={showEmision.cotizacion} interesado={showEmision.interesado} ramos={ramos} onSave={handleEmitir} onClose={() => setShowEmision(null)} />
      )}
    </div>
  );
};

// ─── PÁGINA LEADS ───────────────────────────
const InteresadosPage = ({ interesados, cotizaciones, polizas, agentes, ramos, clientes, onAddInteresado, onEditInteresado, onDeleteInteresado, onAddCotizacion, onEditCotizacion, onEmitirPoliza, userRol, agenteActualId }) => {
  const [q, setQ] = useState("");
  const [showFormInteresado, setShowFormInteresado] = useState(false);
  const [editInteresado, setEditInteresado] = useState(null);
  const [delInteresado, setDelInteresado] = useState(null);
  const [showCotizacion, setShowCotizacion] = useState(null); // interesado seleccionado
  const [editCotizacion, setEditCotizacion] = useState(null);
  const [showEmision, setShowEmision] = useState(null); // {cotizacion, interesado}

  const interesadosFiltrados = useMemo(() => {
    const base = esAdmin(userRol) ? interesados : interesados.filter(i => i.agenteId === agenteActualId);
    return base.filter(i => !q || i.nombre?.toLowerCase().includes(q.toLowerCase()) || i.telefono?.includes(q) || i.email?.toLowerCase().includes(q.toLowerCase()));
  }, [interesados, q, userRol, agenteActualId]);

  const handleSaveInteresado = async (form) => {
    if (editInteresado) { await onEditInteresado({ ...editInteresado, ...form }); setEditInteresado(null); }
    else { await onAddInteresado(form); setShowFormInteresado(false); }
  };

  const handleSaveCotizacion = async (form) => {
    if (editCotizacion) { await onEditCotizacion({ ...editCotizacion, ...form }); setEditCotizacion(null); }
    else { await onAddCotizacion(form); setShowCotizacion(null); }
  };

  const handleEmitir = async (form) => {
    await onEmitirPoliza({ cotizacion: showEmision.cotizacion, interesado: showEmision.interesado, ...form });
    setShowEmision(null);
  };

  const estadoCotColor = (e) => ({ Pendiente: "#f59e0b", Emitida: "#16a34a", Cancelada: "#6b7280" }[e] || "#6b7280");

  return (
    <div>
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>Leads</div>
          <div style={S.pageSub}>{interesadosFiltrados.length} leads registrados</div>
        </div>
        <button style={S.btn("primary")} onClick={() => setShowFormInteresado(true)}><Icon name="plus" size={16} />Nuevo Lead</button>
      </div>

      {/* Search */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div style={S.searchBar}><Icon name="search" size={16} /><input style={S.searchInput} placeholder="Buscar…" value={q} onChange={e => setQ(e.target.value)} /></div>
      </div>

      {/* Tabla Interesados */}
        <div style={S.tableWrap}>
          <div style={{ ...S.tableHead, gridTemplateColumns: "1.8fr 1.2fr 1fr 0.8fr 0.8fr 110px" }}>
            <span>Cliente</span><span>Tipo Seguro</span><span>Fecha</span><span>Cotizaciones</span><span>Oficina</span><span>Acciones</span>
          </div>
          {interesadosFiltrados.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: "#aaa" }}>No hay leads registrados</div>
            : interesadosFiltrados.map(i => {
              const nCots = cotizaciones.filter(c => c.interesadoId === i.id).length;
              const cliente = clientes.find(c => c.id === i.clienteId);
              return (
                <div key={i.id} style={{ ...S.tableRow, gridTemplateColumns: "1.8fr 1.2fr 1fr 0.8fr 0.8fr 110px" }}
                  onMouseEnter={e => e.currentTarget.style.background = BLUE.light}
                  onMouseLeave={e => e.currentTarget.style.background = ""}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{cliente?.nombre || i.nombre || "—"}</div>
                    <div style={{ fontSize: 11.5, color: "#888" }}>{cliente?.email || ""}</div>
                  </div>
                  <div>
                    <span style={S.chip(BLUE.primary)}>{i.tipoSeguro || "—"}</span>
                    {RAMOS_CHECKLIST.includes(i.tipoSeguro) && (
                      <div style={{ fontSize: 11, color: "#888", marginTop: 3 }}>{i.tipoPersona || ""}</div>
                    )}
                  </div>
                  <div style={{ fontSize: 12.5, color: "#555" }}>{fmtDate(i.fechaRegistro)}</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={S.chip(nCots > 0 ? "#16a34a" : "#f59e0b")}>{nCots > 0 ? `${nCots} cot.` : "Sin cotizar"}</span>
                  </div>
                  <div>{i.envioOficina ? <span style={S.chip("#16a34a")}>✓ Enviado</span> : <span style={S.chip("#6b7280")}>Pendiente</span>}</div>
                  <div style={{ display: "flex", gap: 3 }}>
                    <button title="Nueva Cotización" style={{ ...S.btn("secondary"), padding: "5px 10px", fontSize: 12 }} onClick={() => setShowCotizacion(i)}>
                      Cotizar
                    </button>
                    <button style={S.btn("ghost")} onClick={() => { setEditInteresado(i); }}><Icon name="edit" size={14} /></button>
                    {esAdmin(userRol) && <button style={{ ...S.btn("ghost"), color: "#dc2626" }} onClick={() => setDelInteresado(i)}><Icon name="trash" size={14} /></button>}
                  </div>
                </div>
              );
            })}
        </div>

      {/* Modales */}
      {(showFormInteresado || editInteresado) && (
        <InteresadoForm initial={editInteresado} agentes={agentes} ramos={ramos} clientes={clientes} onSave={handleSaveInteresado} onClose={() => { setShowFormInteresado(false); setEditInteresado(null); }} />
      )}
      {showCotizacion && (
        <CotizacionForm interesado={showCotizacion} agentes={agentes} ramos={ramos} onSave={async (form) => { await onAddCotizacion(form); setShowCotizacion(null); }} onClose={() => setShowCotizacion(null)} />
      )}
      {delInteresado && (
        <Modal title="Confirmar eliminación" onClose={() => setDelInteresado(null)}
          footer={<>
            <button style={S.btn("secondary")} onClick={() => setDelInteresado(null)}>Cancelar</button>
            <button style={S.btn("danger")} onClick={async () => { await onDeleteInteresado(delInteresado.id); setDelInteresado(null); }}>Eliminar</button>
          </>}>
          <p style={{ fontSize: 14, color: "#555" }}>¿Eliminar al lead <strong>{delInteresado.nombre}</strong>? Sus cotizaciones también serán eliminadas.</p>
        </Modal>
      )}
    </div>
  );
};

// ─── PÓLIZAS ─────────────────────────────────────────────────────────────────
const PolizasPage = ({ polizas, interesados, ramos, userRol, agenteActualId }) => {
  const [q, setQ] = useState("");
  const [filtroRamo, setFiltroRamo] = useState("Todos");
  const [filtroEstado, setFiltroEstado] = useState("Todos");

  const polizasPorRol = esAdmin(userRol) ? polizas : polizas.filter(p => p.agenteId === agenteActualId);
  const filtered = useMemo(() => polizasPorRol.filter(p => {
    const matchQ = !q || p.numero?.toLowerCase().includes(q.toLowerCase()) || p.clienteNombre?.toLowerCase().includes(q.toLowerCase()) || p.aseguradora?.toLowerCase().includes(q.toLowerCase());
    return matchQ && (filtroRamo === "Todos" || p.ramo === filtroRamo) && (filtroEstado === "Todos" || p.estado === filtroEstado);
  }), [polizasPorRol, q, filtroRamo, filtroEstado]);

  return (
    <div>
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>Pólizas</div>
          <div style={S.pageSub}>{polizasPorRol.length} pólizas · {polizasPorRol.filter(p => p.estado === "Activa").length} activas</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={S.searchBar}><Icon name="search" size={16} /><input style={S.searchInput} placeholder="Buscar póliza, cliente, aseguradora…" value={q} onChange={e => setQ(e.target.value)} /></div>
        <select style={{ ...S.select, width: "auto", padding: "7px 12px" }} value={filtroRamo} onChange={e => setFiltroRamo(e.target.value)}>
          <option value="Todos">Todos los ramos</option>
          {ramos.map(r => <option key={r.id} value={r.nombre}>{r.nombre}</option>)}
        </select>
        <select style={{ ...S.select, width: "auto", padding: "7px 12px" }} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          {["Todos", "Activa", "Vencida", "Cancelada"].map(e => <option key={e}>{e}</option>)}
        </select>
      </div>
      <div style={S.tableWrap}>
        <div style={{ ...S.tableHead, gridTemplateColumns: "1.4fr 1.4fr 0.8fr 1fr 1fr 1fr 1fr 0.8fr" }}>
          <span>N° Póliza</span><span>Cliente</span><span>Ramo</span><span>Aseguradora</span><span>Prima</span><span>Emitida</span><span>Vence</span><span>Estado</span>
        </div>
        {filtered.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: "#aaa" }}>No se encontraron pólizas</div>
          : filtered.map(p => {
            const dias = diasParaVencer(p.vigenciaFin);
            return (
              <div key={p.id} style={{ ...S.tableRow, gridTemplateColumns: "1.4fr 1.4fr 0.8fr 1fr 1fr 1fr 1fr 0.8fr" }}
                onMouseEnter={e => e.currentTarget.style.background = BLUE.light}
                onMouseLeave={e => e.currentTarget.style.background = ""}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{p.numero || "—"}</div>
                <div style={{ fontSize: 13 }}>{p.clienteNombre || "—"}</div>
                <span style={S.chip(BLUE.primary)}>{p.ramo || "—"}</span>
                <div style={{ fontSize: 12.5, color: "#555" }}>{p.aseguradora}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{fmt(p.prima || 0)}</div>
                <div style={{ fontSize: 12.5 }}>{fmtDate(p.fechaEmision)}</div>
                <div>
                  <div style={{ fontSize: 12.5 }}>{fmtDate(p.vigenciaFin)}</div>
                  {p.estado === "Activa" && dias <= 30 && dias >= 0 && <div style={{ fontSize: 11, color: dias <= 7 ? "#dc2626" : "#d97706", fontWeight: 600 }}>{dias}d</div>}
                </div>
                <span style={S.badge(estadoColor(p.estado))}>{p.estado}</span>
              </div>
            );
          })}
      </div>
    </div>
  );
};

// ─── RENOVACIONES ─────────────────────────────────────────────────────────────
const RenovacionesPage = ({ polizas, userRol, agenteActualId }) => {
  const [filtro, setFiltro] = useState("30");
  const polizasPorRol = esAdmin(userRol) ? polizas : polizas.filter(p => p.agenteId === agenteActualId);
  const getCount = (val) => polizasPorRol.filter(p => { const d = diasParaVencer(p.vigenciaFin); return val === "vencidas" ? p.estado === "Vencida" : p.estado === "Activa" && d >= 0 && d <= parseInt(val); }).length;
  const candidates = polizasPorRol.filter(p => { const d = diasParaVencer(p.vigenciaFin); return filtro === "vencidas" ? p.estado === "Vencida" : p.estado === "Activa" && d >= 0 && d <= parseInt(filtro); }).sort((a, b) => diasParaVencer(a.vigenciaFin) - diasParaVencer(b.vigenciaFin));

  return (
    <div>
      <div style={S.pageHeader}><div><div style={S.pageTitle}>Renovaciones</div><div style={S.pageSub}>Pólizas por vencer y vencidas</div></div></div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {[["7", "7 días"], ["15", "15 días"], ["30", "30 días"], ["60", "60 días"], ["vencidas", "Vencidas"]].map(([val, label]) => (
          <button key={val} onClick={() => setFiltro(val)} style={{ padding: "7px 16px", borderRadius: 20, border: `1.5px solid ${filtro === val ? BLUE.primary : BLUE.border}`, background: filtro === val ? BLUE.light : "#fff", color: filtro === val ? BLUE.primary : "#555", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {label} <span style={{ color: filtro === val ? BLUE.primary : "#aaa" }}>({getCount(val)})</span>
          </button>
        ))}
      </div>
      {candidates.length === 0 ? <div style={{ ...S.tableWrap, padding: 48, textAlign: "center", color: "#aaa" }}>No hay pólizas en este rango.</div> : (
        <div style={S.tableWrap}>
          <div style={{ ...S.tableHead, gridTemplateColumns: "1.2fr 1.4fr 0.8fr 1fr 1fr 1fr 80px" }}>
            <span>Póliza</span><span>Cliente</span><span>Ramo</span><span>Aseg.</span><span>Prima</span><span>Vence</span><span>Días</span>
          </div>
          {candidates.map(p => {
            const d = diasParaVencer(p.vigenciaFin);
            const urgColor = filtro === "vencidas" ? "#dc2626" : d <= 7 ? "#dc2626" : d <= 15 ? "#d97706" : BLUE.primary;
            return (
              <div key={p.id} style={{ ...S.tableRow, gridTemplateColumns: "1.2fr 1.4fr 0.8fr 1fr 1fr 1fr 80px", borderLeft: `3px solid ${urgColor}` }}
                onMouseEnter={e => e.currentTarget.style.background = BLUE.light}
                onMouseLeave={e => e.currentTarget.style.background = ""}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{p.numero}</div>
                <div><div style={{ fontSize: 13 }}>{p.clienteNombre}</div><div style={{ fontSize: 11.5, color: "#aaa" }}>{p.clienteTelefono}</div></div>
                <span style={S.chip(BLUE.primary)}>{p.ramo || "—"}</span>
                <div style={{ fontSize: 12.5 }}>{p.aseguradora}</div>
                <div style={{ fontSize: 13 }}>{fmt(p.prima || 0)}</div>
                <div style={{ fontSize: 13 }}>{fmtDate(p.vigenciaFin)}</div>
                <span style={S.chip(urgColor)}>{filtro === "vencidas" ? "Vencida" : `${d}d`}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── REPORTES ─────────────────────────────────────────────────────────────────
const ReportesPage = ({ polizas, ramos }) => {
  const [fechaInicio, setFechaInicio] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split("T")[0]; });
  const [fechaFin, setFechaFin] = useState(today());
  const [filtroAseg, setFiltroAseg] = useState("Todas");

  const polizasFiltradas = useMemo(() => polizas.filter(p => {
    const fe = p.fechaEmision || p.vigenciaInicio;
    if (!fe) return false;
    const matchFecha = fe >= fechaInicio && fe <= fechaFin;
    const matchAseg = filtroAseg === "Todas" || p.aseguradora === filtroAseg;
    return matchFecha && matchAseg;
  }), [polizas, fechaInicio, fechaFin, filtroAseg]);

  const aseguradoras = [...new Set(polizas.map(p => p.aseguradora).filter(Boolean))].sort();
  const totalPrima = polizasFiltradas.reduce((s, p) => s + Number(p.prima || 0), 0);
  const totalSuma = polizasFiltradas.reduce((s, p) => s + Number(p.sumaAsegurada || 0), 0);

  // Agrupado por aseguradora
  const porAseg = useMemo(() => {
    const map = {};
    polizasFiltradas.forEach(p => {
      if (!map[p.aseguradora]) map[p.aseguradora] = { nombre: p.aseguradora, cantidad: 0, prima: 0 };
      map[p.aseguradora].cantidad++;
      map[p.aseguradora].prima += Number(p.prima || 0);
    });
    return Object.values(map).sort((a, b) => b.prima - a.prima);
  }, [polizasFiltradas]);

  // Agrupado por ramo
  const porRamo = useMemo(() => {
    const map = {};
    polizasFiltradas.forEach(p => {
      const r = p.ramo || "Sin ramo";
      if (!map[r]) map[r] = { nombre: r, cantidad: 0, prima: 0 };
      map[r].cantidad++;
      map[r].prima += Number(p.prima || 0);
    });
    return Object.values(map).sort((a, b) => b.cantidad - a.cantidad);
  }, [polizasFiltradas]);

  const maxPrima = porAseg.length > 0 ? Math.max(...porAseg.map(a => a.prima)) : 1;

  return (
    <div>
      <div style={S.pageHeader}>
        <div><div style={S.pageTitle}>Reportes</div><div style={S.pageSub}>Pólizas emitidas por fecha y aseguradora</div></div>
      </div>

      {/* Filtros */}
      <div style={{ background: "#fff", borderRadius: 12, padding: "18px 20px", marginBottom: 24, boxShadow: "0 1px 6px rgba(26,86,219,0.08)", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={S.formGroup}>
          <label style={S.label}>Fecha Inicio</label>
          <input style={{ ...S.input, width: 160 }} type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>Fecha Fin</label>
          <input style={{ ...S.input, width: 160 }} type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>Aseguradora</label>
          <select style={{ ...S.select, width: 200 }} value={filtroAseg} onChange={e => setFiltroAseg(e.target.value)}>
            <option value="Todas">Todas</option>
            {aseguradoras.map(a => <option key={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* Totales */}
      <div style={S.statGrid}>
        <div style={S.statCard(BLUE.primary)}><div style={S.statNum}>{polizasFiltradas.length}</div><div style={S.statLabel}>Pólizas Emitidas</div></div>
        <div style={S.statCard("#16a34a")}><div style={S.statNum}>{fmt(totalPrima)}</div><div style={S.statLabel}>Prima Total</div></div>
        <div style={S.statCard("#7c3aed")}><div style={S.statNum}>{fmt(totalSuma)}</div><div style={S.statLabel}>Suma Asegurada Total</div></div>
        <div style={S.statCard("#f59e0b")}><div style={S.statNum}>{porAseg.length}</div><div style={S.statLabel}>Aseguradoras</div></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        {/* Por aseguradora */}
        <div style={{ background: "#fff", borderRadius: 12, padding: "20px", boxShadow: "0 1px 6px rgba(26,86,219,0.08)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: BLUE.text, marginBottom: 16 }}>Por Aseguradora</div>
          {porAseg.length === 0 ? <div style={{ color: "#aaa", fontSize: 13 }}>Sin datos en este rango</div>
            : porAseg.map(a => (
              <div key={a.nombre} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                  <span style={{ fontWeight: 600 }}>{a.nombre}</span>
                  <span style={{ color: "#6b87b0" }}>{a.cantidad} pólizas · {fmt(a.prima)}</span>
                </div>
                <div style={{ background: BLUE.light, borderRadius: 6, height: 8, overflow: "hidden" }}>
                  <div style={{ background: BLUE.primary, height: "100%", width: `${(a.prima / maxPrima) * 100}%`, borderRadius: 6, transition: "width 0.4s" }} />
                </div>
              </div>
            ))}
        </div>

        {/* Por ramo */}
        <div style={{ background: "#fff", borderRadius: 12, padding: "20px", boxShadow: "0 1px 6px rgba(26,86,219,0.08)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: BLUE.text, marginBottom: 16 }}>Por Ramo</div>
          {porRamo.length === 0 ? <div style={{ color: "#aaa", fontSize: 13 }}>Sin datos en este rango</div>
            : porRamo.map(r => (
              <div key={r.nombre} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${BLUE.border}` }}>
                <span style={S.chip(BLUE.primary)}>{r.nombre}</span>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{r.cantidad} pólizas</div>
                  <div style={{ fontSize: 12, color: "#6b87b0" }}>{fmt(r.prima)}</div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Tabla detalle */}
      <div style={{ fontSize: 12, fontWeight: 700, color: "#6b87b0", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 12 }}>Detalle de Pólizas Emitidas</div>
      <div style={S.tableWrap}>
        <div style={{ ...S.tableHead, gridTemplateColumns: "1.2fr 1.4fr 0.8fr 1fr 1fr 1fr 1fr" }}>
          <span>N° Póliza</span><span>Cliente</span><span>Ramo</span><span>Aseguradora</span><span>Prima</span><span>Suma Aseg.</span><span>Fecha Emisión</span>
        </div>
        {polizasFiltradas.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: "#aaa" }}>No hay pólizas en este rango de fechas</div>
          : polizasFiltradas.map(p => (
            <div key={p.id} style={{ ...S.tableRow, gridTemplateColumns: "1.2fr 1.4fr 0.8fr 1fr 1fr 1fr 1fr" }}
              onMouseEnter={e => e.currentTarget.style.background = BLUE.light}
              onMouseLeave={e => e.currentTarget.style.background = ""}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{p.numero || "—"}</div>
              <div style={{ fontSize: 13 }}>{p.clienteNombre || "—"}</div>
              <span style={S.chip(BLUE.primary)}>{p.ramo || "—"}</span>
              <div style={{ fontSize: 12.5 }}>{p.aseguradora}</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{fmt(p.prima || 0)}</div>
              <div style={{ fontSize: 13 }}>{fmt(p.sumaAsegurada || 0)}</div>
              <div style={{ fontSize: 13 }}>{fmtDate(p.fechaEmision)}</div>
            </div>
          ))}
      </div>
    </div>
  );
};

// ─── CONFIGURACIÓN (Usuarios) ─────────────────────────────────────────────────
const ConfiguracionPage = ({ agentes, polizas, onAdd, onEdit, onDelete }) => {
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [delItem, setDelItem] = useState(null);
  const [form, setForm] = useState({ nombre: "", email: "", rol: ROL_AGENTE });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    if (editItem) { await onEdit({ ...editItem, ...form }); setEditItem(null); }
    else { await onAdd(form); setShowForm(false); setForm({ nombre: "", email: "", rol: ROL_AGENTE }); }
    setSaving(false);
  };

  return (
    <div>
      <div style={S.pageHeader}>
        <div><div style={S.pageTitle}>Usuarios</div><div style={S.pageSub}>Gestión de usuarios del sistema</div></div>
        <button style={S.btn("primary")} onClick={() => setShowForm(true)}><Icon name="plus" size={16} />Nuevo Usuario</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {agentes.map(a => {
          const nPolizas = polizas.filter(p => p.agenteId === a.id && p.estado === "Activa").length;
          const prima = polizas.filter(p => p.agenteId === a.id && p.estado === "Activa").reduce((s, p) => s + Number(p.prima || 0), 0);
          const initials = a.nombre.split(" ").slice(0, 2).map(w => w[0]).join("");
          const rolColor = a.rol === ROL_ADMIN ? "#7c3aed" : BLUE.primary;
          return (
            <div key={a.id} style={{ background: "#fff", borderRadius: 12, padding: 22, boxShadow: "0 1px 6px rgba(26,86,219,0.08)", border: `1px solid ${BLUE.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                <div style={{ width: 46, height: 46, borderRadius: "50%", background: `linear-gradient(135deg,${rolColor},${rolColor}88)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 16 }}>{initials}</div>
                <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 15 }}>{a.nombre}</div><div style={{ fontSize: 12, color: "#888" }}>{a.email}</div></div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button style={S.btn("ghost")} onClick={() => { setEditItem(a); setForm({ nombre: a.nombre, email: a.email, rol: a.rol }); }}><Icon name="edit" size={14} /></button>
                  <button style={{ ...S.btn("ghost"), color: "#dc2626" }} onClick={() => setDelItem(a)}><Icon name="trash" size={14} /></button>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={S.chip(rolColor)}>{a.rol}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, borderTop: `1px solid ${BLUE.border}`, paddingTop: 12 }}>
                <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700 }}>{nPolizas}</div><div style={{ fontSize: 11, color: "#aaa" }}>Pólizas Activas</div></div>
                <div style={{ textAlign: "center" }}><div style={{ fontSize: 14, fontWeight: 700 }}>{fmt(prima)}</div><div style={{ fontSize: 11, color: "#aaa" }}>Prima</div></div>
              </div>
            </div>
          );
        })}
      </div>
      {(showForm || editItem) && (
        <Modal title={editItem ? "Editar Usuario" : "Nuevo Usuario"} onClose={() => { setShowForm(false); setEditItem(null); }}
          footer={<><button style={S.btn("secondary")} onClick={() => { setShowForm(false); setEditItem(null); }}>Cancelar</button><button style={{ ...S.btn("primary"), opacity: saving ? 0.6 : 1 }} onClick={handleSave} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button></>}>
          <div style={S.formGroup}><label style={S.label}>Nombre *</label><input style={S.input} value={form.nombre} onChange={e => set("nombre", e.target.value)} /></div>
          <div style={S.formGroup}><label style={S.label}>Email *</label><input style={S.input} type="email" value={form.email} onChange={e => set("email", e.target.value)} /></div>
          <div style={S.formGroup}>
            <label style={S.label}>Rol</label>
            <select style={S.select} value={form.rol} onChange={e => set("rol", e.target.value)}>
              <option value={ROL_ADMIN}>Admin</option>
              <option value={ROL_AGENTE}>Agente</option>
            </select>
          </div>
          <div style={{ background: BLUE.light, borderRadius: 8, padding: "10px 14px", fontSize: 12.5, color: BLUE.primary }}>
            💡 Crea el usuario en Supabase → Authentication → Users con el mismo email.
          </div>
        </Modal>
      )}
      {delItem && (
        <Modal title="Confirmar eliminación" onClose={() => setDelItem(null)}
          footer={<><button style={S.btn("secondary")} onClick={() => setDelItem(null)}>Cancelar</button><button style={S.btn("danger")} onClick={async () => { await onDelete(delItem.id); setDelItem(null); }}>Eliminar</button></>}>
          <p style={{ fontSize: 14, color: "#555" }}>¿Eliminar al usuario <strong>{delItem.nombre}</strong>?</p>
        </Modal>
      )}
    </div>
  );
};

// ─── RAMOS (Paramétrico Admin) ────────────────────────────────────────────────
const RamosPage = ({ ramos, onAdd, onEdit, onDelete }) => {
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ nombre: "", descripcion: "", activo: true });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    if (editItem) { await onEdit({ ...editItem, ...form }); setEditItem(null); }
    else { await onAdd(form); setShowForm(false); setForm({ nombre: "", descripcion: "", activo: true }); }
    setSaving(false);
  };

  return (
    <div>
      <div style={S.pageHeader}>
        <div><div style={S.pageTitle}>Ramos de Seguros</div><div style={S.pageSub}>Configuración paramétrica de ramos</div></div>
        <button style={S.btn("primary")} onClick={() => setShowForm(true)}><Icon name="plus" size={16} />Nuevo Ramo</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
        {ramos.map(r => (
          <div key={r.id} style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 6px rgba(26,86,219,0.08)", border: `1px solid ${BLUE.border}`, borderTop: `3px solid ${BLUE.primary}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: BLUE.text }}>{r.nombre}</div>
                {r.descripcion && <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>{r.descripcion}</div>}
              </div>
              <div style={{ display: "flex", gap: 3 }}>
                <button style={S.btn("ghost")} onClick={() => { setEditItem(r); setForm({ nombre: r.nombre, descripcion: r.descripcion || "", activo: r.activo }); }}><Icon name="edit" size={14} /></button>
                <button style={{ ...S.btn("ghost"), color: "#dc2626" }} onClick={() => onDelete(r.id)}><Icon name="trash" size={14} /></button>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <span style={S.chip(r.activo !== false ? "#16a34a" : "#6b7280")}>{r.activo !== false ? "Activo" : "Inactivo"}</span>
            </div>
          </div>
        ))}
        {ramos.length === 0 && <div style={{ color: "#aaa", fontSize: 13, padding: 20 }}>No hay ramos configurados. Agrega el primero.</div>}
      </div>
      {(showForm || editItem) && (
        <Modal title={editItem ? "Editar Ramo" : "Nuevo Ramo"} onClose={() => { setShowForm(false); setEditItem(null); }}
          footer={<><button style={S.btn("secondary")} onClick={() => { setShowForm(false); setEditItem(null); }}>Cancelar</button><button style={{ ...S.btn("primary"), opacity: saving ? 0.6 : 1 }} onClick={handleSave} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button></>}>
          <div style={S.formGroup}><label style={S.label}>Nombre del Ramo *</label><input style={S.input} value={form.nombre} onChange={e => set("nombre", e.target.value)} placeholder="Ej. SOAT, Vida, Automóvil" /></div>
          <div style={S.formGroup}><label style={S.label}>Descripción</label><input style={S.input} value={form.descripcion} onChange={e => set("descripcion", e.target.value)} /></div>
          <div style={S.formGroup}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={form.activo} onChange={e => set("activo", e.target.checked)} />
              <span style={{ fontSize: 13, fontWeight: 600, color: BLUE.text }}>Ramo activo</span>
            </label>
          </div>
        </Modal>
      )}
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

  const [agentes, setAgentes] = useState([]);
  const [ramos, setRamos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [interesados, setInteresados] = useState([]);
  const [cotizaciones, setCotizaciones] = useState([]);
  const [polizas, setPolizas] = useState([]);

  const resolverRol = async (email) => {
    setUserName("Administrador");
    setUserRol(ROL_ADMIN);
    setAgenteActualId(null);
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
      const [{ data: rms }, { data: cls }, { data: ints }, { data: cots }, { data: pols }] = await Promise.all([
        supabase.from('ramos').select('*').order('nombre'),
        supabase.from('clientes').select('*').order('nombre'),
        supabase.from('interesados').select('*').order('created_at', { ascending: false }),
        supabase.from('cotizaciones').select('*').order('created_at', { ascending: false }),
        supabase.from('polizas').select('*').order('created_at', { ascending: false }),
      ]);
      if (rms) setRamos(rms);
      if (cls) setClientes(cls.map(c => ({ ...c, tipoDocumento: c.tipo_documento, tipoPersona: c.tipo_persona, nombreContacto: c.nombre_contacto, telefonoContacto: c.telefono_contacto })));
      if (ints) setInteresados(ints.map(mapInteresado));
      if (cots) setCotizaciones(cots.map(mapCotizacion));
      if (pols) setPolizas(pols.map(p => ({ ...mapPoliza(p), ramo: p.ramo, clienteNombre: p.cliente_nombre, clienteTelefono: p.cliente_telefono })));
      setLoading(false);
    };
    cargar();
  }, [loggedIn]);

  const handleLogin = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) await resolverRol(session.user.email);
    setLoggedIn(true);
  };

  // CRUD Clientes
  const addCliente = async (f) => {
    const { data, error } = await supabase.from('clientes').insert([{ nombre: f.nombre, email: f.email, celular: f.celular || f.telefono, telefono: f.telefono, tipo_persona: f.tipoPersona, nombre_contacto: f.nombreContacto, telefono_contacto: f.telefonoContacto, notas: f.notas }]).select().single();
    if (error) { console.error('addCliente error:', error); return; }
    if (data) setClientes(prev => [...prev, { ...data, tipoPersona: data.tipo_persona, nombreContacto: data.nombre_contacto, telefonoContacto: data.telefono_contacto }]);
  };
  const editCliente = async (f) => {
    await supabase.from('clientes').update({ nombre: f.nombre, email: f.email, celular: f.celular || f.telefono, telefono: f.telefono, tipo_persona: f.tipoPersona, nombre_contacto: f.nombreContacto, telefono_contacto: f.telefonoContacto, notas: f.notas }).eq('id', f.id);
    setClientes(prev => prev.map(x => x.id === f.id ? { ...x, ...f, tipoPersona: f.tipoPersona, nombreContacto: f.nombreContacto, telefonoContacto: f.telefonoContacto } : x));
  };
  const deleteCliente = async (id) => {
    await supabase.from('clientes').delete().eq('id', id);
    setClientes(prev => prev.filter(x => x.id !== id));
  };

  // CRUD Interesados
  const addInteresado = async (f) => {
    const { data } = await supabase.from('interesados').insert([{
      cliente_id: f.clienteId, email: f.email, celular: f.celular, direccion: f.direccion, ciudad: f.ciudad,
      documento: f.documento, tipo_documento: f.tipoDocumento, tipo_seguro: f.tipoSeguro,
      tipo_persona: f.tipoPersona, documentos_checklist: JSON.stringify(f.documentosChecklist),
      numero_contrato: f.numeroContrato, envio_oficina: f.envioOficina,
      agente_id: f.agenteId, notas: f.notas, estado: f.estado, fecha_registro: f.fechaRegistro,
    }]).select().single();
    if (data) setInteresados(prev => [mapInteresado(data), ...prev]);
  };
  const editInteresado = async (f) => {
    await supabase.from('interesados').update({
      cliente_id: f.clienteId, email: f.email, celular: f.celular, direccion: f.direccion, ciudad: f.ciudad,
      documento: f.documento, tipo_documento: f.tipoDocumento, tipo_seguro: f.tipoSeguro,
      tipo_persona: f.tipoPersona, documentos_checklist: JSON.stringify(f.documentosChecklist),
      numero_contrato: f.numeroContrato, envio_oficina: f.envioOficina,
      agente_id: f.agenteId, notas: f.notas,
    }).eq('id', f.id);
    setInteresados(prev => prev.map(x => x.id === f.id ? mapInteresado({ ...x, ...f, agente_id: f.agenteId, tipo_seguro: f.tipoSeguro, tipo_persona: f.tipoPersona, documentos_checklist: JSON.stringify(f.documentosChecklist), numero_contrato: f.numeroContrato, envio_oficina: f.envioOficina, cliente_id: f.clienteId }) : x));
  };
  const deleteInteresado = async (id) => {
    await supabase.from('interesados').delete().eq('id', id);
    setInteresados(prev => prev.filter(x => x.id !== id));
  };

  // CRUD Cotizaciones
  const addCotizacion = async (f) => {
    const { data } = await supabase.from('cotizaciones').insert([{ interesado_id: f.interesadoId, agente_id: f.agenteId, ramo: f.ramo, aseguradora: f.aseguradora, suma_asegurada: f.sumaAsegurada, prima: f.prima, iva: f.iva, gastos_expedicion: f.gastosExpedicion, numero_poliza: f.numeroPoliza, fecha_cotizacion: f.fechaCotizacion, notas: f.notas, estado: f.estado }]).select().single();
    if (data) setCotizaciones(prev => [mapCotizacion(data), ...prev]);
  };
  const editCotizacion = async (f) => {
    await supabase.from('cotizaciones').update({ ramo: f.ramo, aseguradora: f.aseguradora, suma_asegurada: f.sumaAsegurada, prima: f.prima, iva: f.iva, gastos_expedicion: f.gastosExpedicion, numero_poliza: f.numeroPoliza, fecha_cotizacion: f.fechaCotizacion, notas: f.notas, estado: f.estado }).eq('id', f.id);
    setCotizaciones(prev => prev.map(x => x.id === f.id ? { ...x, ...mapCotizacion({ ...x, ...f, interesado_id: f.interesadoId, agente_id: f.agenteId, suma_asegurada: f.sumaAsegurada, numero_poliza: f.numeroPoliza, fecha_cotizacion: f.fechaCotizacion, gastos_expedicion: f.gastosExpedicion }) } : x));
  };

  // Emitir póliza desde cotización
  const emitirPoliza = async ({ cotizacion, interesado, fechaEmision, vigenciaInicio, vigenciaFin, ramoId, notas }) => {
    const ramo = ramos.find(r => r.id === ramoId);
    const { data } = await supabase.from('polizas').insert([{
      cotizacion_id: cotizacion.id,
      cliente_id: interesado?.id,
      cliente_nombre: interesado?.nombre,
      cliente_telefono: interesado?.telefono,
      agente_id: cotizacion.agenteId,
      numero: cotizacion.numeroPoliza,
      ramo: ramo?.nombre || cotizacion.ramo,
      ramo_id: ramoId,
      aseguradora: cotizacion.aseguradora,
      suma_asegurada: cotizacion.sumaAsegurada,
      prima: cotizacion.prima,
      iva: cotizacion.iva,
      gastos_expedicion: cotizacion.gastosExpedicion,
      fecha_emision: fechaEmision,
      vigencia_inicio: vigenciaInicio,
      vigencia_fin: vigenciaFin,
      estado: "Activa",
      notas,
    }]).select().single();
    if (data) {
      setPolizas(prev => [{ ...mapPoliza(data), ramo: data.ramo, clienteNombre: data.cliente_nombre, clienteTelefono: data.cliente_telefono }, ...prev]);
      // Marcar cotización como emitida
      await supabase.from('cotizaciones').update({ estado: "Emitida" }).eq('id', cotizacion.id);
      setCotizaciones(prev => prev.map(c => c.id === cotizacion.id ? { ...c, estado: "Emitida" } : c));
    }
  };

  // CRUD Agentes
  const addAgente = async (a) => {
    const { data } = await supabase.from('agentes').insert([{ nombre: a.nombre, email: a.email, rol: a.rol }]).select().single();
    if (data) setAgentes(prev => [...prev, data]);
  };
  const editAgente = async (a) => {
    await supabase.from('agentes').update({ nombre: a.nombre, email: a.email, rol: a.rol }).eq('id', a.id);
    setAgentes(prev => prev.map(x => x.id === a.id ? { ...x, ...a } : x));
  };
  const deleteAgente = async (id) => {
    await supabase.from('agentes').delete().eq('id', id);
    setAgentes(prev => prev.filter(x => x.id !== id));
  };

  // CRUD Ramos
  const addRamo = async (r) => {
    const { data } = await supabase.from('ramos').insert([{ nombre: r.nombre, descripcion: r.descripcion, activo: r.activo }]).select().single();
    if (data) setRamos(prev => [...prev, data]);
  };
  const editRamo = async (r) => {
    await supabase.from('ramos').update({ nombre: r.nombre, descripcion: r.descripcion, activo: r.activo }).eq('id', r.id);
    setRamos(prev => prev.map(x => x.id === r.id ? { ...x, ...r } : x));
  };
  const deleteRamo = async (id) => {
    await supabase.from('ramos').delete().eq('id', id);
    setRamos(prev => prev.filter(x => x.id !== id));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setLoggedIn(false); setAgentes([]); setRamos([]); setClientes([]); setInteresados([]); setCotizaciones([]); setPolizas([]);
    setUserRol(ROL_AGENTE); setAgenteActualId(null);
  };

  if (!loggedIn) return <><FontLoader /><LoginPage onLogin={handleLogin} /></>;
  if (loading) return <><FontLoader /><LoadingScreen /></>;

  const handleNav = (p) => {
    if ((p === "configuracion" || p === "ramos") && !esAdmin(userRol)) return;
    setPage(p);
  };

  const renderPage = () => {
    switch (page) {
      case "dashboard":
        return <Dashboard interesados={interesados} cotizaciones={cotizaciones} polizas={polizas} userName={userName} onNav={handleNav} />;
      case "clientes":
        return <ClientesPage clientes={clientes} onAdd={addCliente} onEdit={editCliente} onDelete={deleteCliente} userRol={userRol} />;
      case "interesados":
        return <InteresadosPage interesados={interesados} cotizaciones={cotizaciones} polizas={polizas} agentes={agentes} ramos={ramos.filter(r => r.activo !== false)} clientes={clientes} onAddInteresado={addInteresado} onEditInteresado={editInteresado} onDeleteInteresado={deleteInteresado} onAddCotizacion={addCotizacion} onEditCotizacion={editCotizacion} onEmitirPoliza={emitirPoliza} userRol={userRol} agenteActualId={agenteActualId} />;
      case "cotizaciones":
        return <CotizacionesPage cotizaciones={cotizaciones} interesados={interesados} polizas={polizas} agentes={agentes} ramos={ramos.filter(r => r.activo !== false)} onAddCotizacion={addCotizacion} onEditCotizacion={editCotizacion} onEmitirPoliza={emitirPoliza} userRol={userRol} agenteActualId={agenteActualId} />;
      case "polizas":
        return <PolizasPage polizas={polizas} interesados={interesados} ramos={ramos} userRol={userRol} agenteActualId={agenteActualId} />;
      case "renovaciones":
        return <RenovacionesPage polizas={polizas} userRol={userRol} agenteActualId={agenteActualId} />;
      case "reportes":
        return <ReportesPage polizas={polizas} ramos={ramos} />;
      case "configuracion":
        return esAdmin(userRol) ? <ConfiguracionPage agentes={agentes} polizas={polizas} onAdd={addAgente} onEdit={editAgente} onDelete={deleteAgente} /> : null;
      case "ramos":
        return esAdmin(userRol) ? <RamosPage ramos={ramos} onAdd={addRamo} onEdit={editRamo} onDelete={deleteRamo} /> : null;
      default: return null;
    }
  };

  return (
    <>
      <FontLoader />
      <div style={S.app}>
        <Sidebar current={page} onNav={handleNav} onLogout={handleLogout} userName={userName} userRol={userRol} />
        <div style={S.main}>
          <Topbar page={page} userRol={userRol} />
          <div style={S.content}>{renderPage()}</div>
        </div>
      </div>
    </>
  );
}
