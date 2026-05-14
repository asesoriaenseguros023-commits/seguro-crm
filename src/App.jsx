import { useState, useEffect, useMemo, useRef } from "react";
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
const mapCotizacion = (c) => ({ ...c, interesadoId: c.interesado_id, leadId: c.lead_id, agenteId: c.agente_id, sumaAsegurada: c.suma_asegurada, fechaCotizacion: c.fecha_cotizacion, numeroPoliza: c.numero_poliza, clienteNombre: c.cliente_nombre, clienteTelefono: c.cliente_telefono, accion: c.accion || 'En Curso', numeroPolizaEmitida: c.numero_poliza_emitida, aseguradoraEmitida: c.aseguradora_emitida, primaEmitida: c.prima_emitida, ivaEmitida: c.iva_emitida, gastosEmitida: c.gastos_emitida, totalPagoEmitida: c.total_pago_emitida });
const mapPoliza = (p) => ({ ...p, cotizacionId: p.cotizacion_id, clienteId: p.cliente_id, agenteId: p.agente_id, sumaAsegurada: p.suma_asegurada, vigenciaInicio: p.vigencia_inicio, vigenciaFin: p.vigencia_fin, fechaEmision: p.fecha_emision, ramoId: p.ramo_id, decisionRenovacion: p.decision_renovacion || "" });

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
          { id: "soat", label: "Seguimiento SOAT", icon: "shield" },
          { id: "reportes", label: "Reportes", icon: "chart" },
        ].map(i => (
          <div key={i.id} style={S.sbItem(current === i.id)} onClick={() => onNav(i.id)}>
            <Icon name={i.icon} size={16} />{i.label}
          </div>
        ))}
        {esAdmin(userRol) && <>
          <div style={S.sbSection}>Administración</div>
          {[
            { id: "ramos", label: "Ramos de Seguros", icon: "tag" },
            { id: "aseguradoras", label: "Aseguradoras", icon: "shield" },
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
  const labels = { dashboard: "Dashboard", clientes: "Clientes", interesados: "Leads", cotizaciones: "Cotizaciones", polizas: "Pólizas", renovaciones: "Renovaciones", soat: "Seguimiento Clientes SOAT", ramos: "Ramos de Seguros", aseguradoras: "Aseguradoras", reportes: "Reportes" };
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
// Todos los ramos muestran checklist de documentos
const DOCS_NATURAL = ["Cédula", "SARLAFT", "RUT", "Contrato", "Carta de Autorización"];
const DOCS_JURIDICA = ["Cámara de Comercio", "RUT Empresa", "SARLAFT", "Estados Financieros", "Cédula Representante Legal", "Contrato", "Carta de Autorización"];

// Form Lead
const InteresadoForm = ({ initial, agentes, ramos, clientes, onSave, onClose }) => {
  const [form, setForm] = useState(initial || {
    clienteId: "",
    tipoSeguro: "", documentosChecklist: {}, envioOficina: false,
    notas: "", estado: "Lead", fechaRegistro: today(),
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setDoc = (nombre, val) => setForm(f => ({ ...f, documentosChecklist: { ...f.documentosChecklist, [nombre]: val } }));

  const clienteSeleccionado = clientes.find(c => c.id === form.clienteId);
  const ramoSeleccionado = ramos.find(r => r.nombre === form.tipoSeguro);

  // Documentos del ramo según tipo de persona del cliente
  const docsDelRamo = useMemo(() => {
    if (!ramoSeleccionado?.documentos) return [];
    const esJuridica = clienteSeleccionado?.tipo_persona === "Jurídica";
    if (esJuridica) {
      return Object.entries(ramoSeleccionado.documentos).filter(([k, v]) => v && k.startsWith("J_")).map(([k]) => k.slice(2));
    } else {
      return Object.entries(ramoSeleccionado.documentos).filter(([k, v]) => v && !k.startsWith("J_")).map(([k]) => k);
    }
  }, [ramoSeleccionado, clienteSeleccionado]);

  const valid = form.clienteId && form.tipoSeguro;
  const handleSave = async () => { setSaving(true); await onSave(form); setSaving(false); };

  const infoStyle = { background: "#f8faff", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: BLUE.text, border: `1px solid ${BLUE.border}` };

  return (
    <Modal title={initial?.id ? "Editar Lead" : "Nuevo Lead"} onClose={onClose} wide
      footer={<>
        <button style={S.btn("secondary")} onClick={onClose}>Cancelar</button>
        <button style={{ ...S.btn("primary"), opacity: valid && !saving ? 1 : 0.5 }} onClick={handleSave} disabled={!valid || saving}>
          {saving ? "Guardando…" : "Guardar Lead"}
        </button>
      </>}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>

        {/* Cliente */}
        <div style={{ ...S.formGroup, gridColumn: "1/-1" }}>
          <label style={S.label}>Cliente *</label>
          <select style={S.select} value={form.clienteId} onChange={e => set("clienteId", e.target.value)}>
            <option value="">— Selecciona un cliente —</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>

        {/* Info del cliente seleccionado */}
        {clienteSeleccionado && (
          <>
            <div style={{ ...S.formGroup, gridColumn: "1/-1" }}>
              <div style={{ ...infoStyle, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div><span style={{ fontSize: 11, color: "#aaa", display: "block" }}>TIPO DE PERSONA</span><strong>{clienteSeleccionado.tipo_persona || "Natural"}</strong></div>
                <div><span style={{ fontSize: 11, color: "#aaa", display: "block" }}>DOCUMENTO</span>{clienteSeleccionado.rfc || clienteSeleccionado.documento || "—"}</div>
                <div><span style={{ fontSize: 11, color: "#aaa", display: "block" }}>CORREO</span>{clienteSeleccionado.email || "—"}</div>
                <div><span style={{ fontSize: 11, color: "#aaa", display: "block" }}>TELÉFONO</span>{clienteSeleccionado.telefono || clienteSeleccionado.celular || "—"}</div>
                {(clienteSeleccionado.tipo_persona === "Jurídica") && <>
                  <div><span style={{ fontSize: 11, color: "#aaa", display: "block" }}>CONTACTO</span>{clienteSeleccionado.nombre_contacto || "—"}</div>
                  <div><span style={{ fontSize: 11, color: "#aaa", display: "block" }}>TEL. CONTACTO</span>{clienteSeleccionado.telefono_contacto || "—"}</div>
                </>}
              </div>
            </div>
          </>
        )}

        {/* Fecha */}
        <div style={S.formGroup}>
          <label style={S.label}>Fecha de Registro</label>
          <input style={{ ...S.input, background: "#f8faff", color: "#6b87b0" }} type="date" value={form.fechaRegistro} readOnly />
        </div>

        {/* Tipo de Seguro */}
        <div style={S.formGroup}>
          <label style={S.label}>Tipo de Seguro *</label>
          <select style={S.select} value={form.tipoSeguro} onChange={e => { set("tipoSeguro", e.target.value); set("documentosChecklist", {}); }}>
            <option value="">— Selecciona —</option>
            {ramos.map(r => <option key={r.id} value={r.nombre}>{r.nombre}</option>)}
          </select>
        </div>

        {/* Documentos — solo si hay ramo seleccionado y tiene docs configurados */}
        {form.tipoSeguro && docsDelRamo.length > 0 && (
          <div style={{ gridColumn: "1/-1", background: "#f8faff", border: `1px solid ${BLUE.border}`, borderRadius: 10, padding: "16px 18px", marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: BLUE.text, marginBottom: 12 }}>
              📄 Documentos — {form.tipoSeguro}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {docsDelRamo.map(doc => (
                <label key={doc} style={{ display: "flex", alignItems: "center", gap: 10, background: form.documentosChecklist[doc] === "Sí" ? "#f0fdf4" : "#fff", border: `1px solid ${form.documentosChecklist[doc] === "Sí" ? "#bbf7d0" : BLUE.border}`, borderRadius: 8, padding: "10px 14px", cursor: "pointer" }}>
                  <input type="checkbox"
                    checked={form.documentosChecklist[doc] === "Sí"}
                    onChange={e => setDoc(doc, e.target.checked ? "Sí" : "No")}
                    style={{ width: 17, height: 17, accentColor: "#16a34a", cursor: "pointer" }} />
                  <span style={{ fontSize: 13.5, color: form.documentosChecklist[doc] === "Sí" ? "#16a34a" : BLUE.text, fontWeight: form.documentosChecklist[doc] === "Sí" ? 600 : 400 }}>{doc}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {form.tipoSeguro && docsDelRamo.length === 0 && (
          <div style={{ gridColumn: "1/-1", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#92400e" }}>
            ⚠️ Este ramo no tiene documentos configurados. Ve a <strong>Ramos de Seguros</strong> para agregarlos.
          </div>
        )}

        <div style={{ ...S.formGroup, gridColumn: "1/-1" }}>
          <label style={S.label}>Notas</label>
          <textarea style={{ ...S.input, minHeight: 60, resize: "vertical" }} value={form.notas} onChange={e => set("notas", e.target.value)} />
        </div>

        {/* Envío a cotización — solo habilitado si todos los docs están completos */}
        {(() => {
          const ramoObj = ramos.find(r => r.nombre === form.tipoSeguro);
          const docsDelRamo = ramoObj?.documentos ? Object.entries(ramoObj.documentos).filter(([,v]) => v).map(([k]) => k) : [];
          const todosCompletos = docsDelRamo.length > 0 && docsDelRamo.every(d => form.documentosChecklist[d] === "Sí");
          const bloqueado = docsDelRamo.length > 0 && !todosCompletos;
          return (
            <div style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", gap: 12, background: form.envioOficina ? "#f0fdf4" : bloqueado ? "#fafafa" : BLUE.light, border: `1px solid ${form.envioOficina ? "#bbf7d0" : bloqueado ? "#e5e7eb" : BLUE.border}`, borderRadius: 10, padding: "12px 16px", opacity: bloqueado ? 0.6 : 1 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: bloqueado ? "not-allowed" : "pointer", flex: 1 }}>
                <input type="checkbox" checked={form.envioOficina} onChange={e => !bloqueado && set("envioOficina", e.target.checked)}
                  disabled={bloqueado}
                  style={{ width: 18, height: 18, accentColor: "#16a34a", cursor: bloqueado ? "not-allowed" : "pointer" }} />
                <div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: form.envioOficina ? "#16a34a" : bloqueado ? "#aaa" : BLUE.text }}>
                    {form.envioOficina ? "✓ Enviado a cotización" : "Enviado a cotización"}
                  </span>
                  {bloqueado && <div style={{ fontSize: 11.5, color: "#f59e0b", marginTop: 2 }}>⚠ Completa todos los documentos primero</div>}
                </div>
              </label>
            </div>
          );
        })()}
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
                <div style={{ fontSize: 13 }}>{c.celular || c.telefono || "—"}</div>
                {c.tipoPersona === "Jurídica" && c.telefonoContacto && <div style={{ fontSize: 11.5, color: "#7c3aed" }}>Cto: {c.telefonoContacto}</div>}
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
const ESTADOS_COT = ["Corrección SARLAFT", "Corrección Contrato", "Cotización Completada"];
const ACCIONES_COT = ["En Curso", "Cliente Rechaza", "Póliza Emitida"];
const accionColor = (a) => ({ "En Curso": "#f59e0b", "Cliente Rechaza": "#dc2626", "Póliza Emitida": "#16a34a" }[a] || "#6b7280");
const estadoCotColor2 = (e) => ({ "Corrección SARLAFT": "#f59e0b", "Corrección Contrato": "#d97706", "Cotización Completada": "#16a34a", "Pendiente": "#6b7280" }[e] || "#6b7280");

const CotizacionesPage = ({ cotizaciones, interesados, polizas, agentes, ramos, aseguradoras, onAddCotizacion, onEditCotizacion, onEmitirPoliza, userRol, agenteActualId }) => {
  const [q, setQ] = useState("");
  const [editModal, setEditModal] = useState(null); // cotizacion being edited
  const [saving, setSaving] = useState(false);

  const cotizacionesFiltradas = useMemo(() => {
    const base = esAdmin(userRol) ? cotizaciones : cotizaciones.filter(c => c.agenteId === agenteActualId);
    return base.filter(c => !q || c.clienteNombre?.toLowerCase().includes(q.toLowerCase()) || c.ramo?.toLowerCase().includes(q.toLowerCase()) || c.numeroPolizaEmitida?.toLowerCase().includes(q.toLowerCase()));
  }, [cotizaciones, q, userRol, agenteActualId]);

  const handleSave = async (cot, changes) => {
    setSaving(cot.id);
    await onEditCotizacion({ ...cot, ...changes });
    setSaving(false);
  };

  return (
    <div>
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>Cotizaciones</div>
          <div style={S.pageSub}>{cotizacionesFiltradas.length} cotizaciones registradas</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div style={S.searchBar}><Icon name="search" size={16} /><input style={S.searchInput} placeholder="Buscar cliente, ramo, n° póliza…" value={q} onChange={e => setQ(e.target.value)} /></div>
      </div>

      <div style={S.tableWrap}>
        <div style={{ ...S.tableHead, gridTemplateColumns: "50px 1.6fr 1fr 1fr 1fr 160px" }}>
          <span>#</span><span>Lead / Cliente</span><span>Ramo</span><span>Estado</span><span>Acción</span><span>Acciones</span>
        </div>
        {cotizacionesFiltradas.length === 0
          ? <div style={{ padding: 40, textAlign: "center", color: "#aaa" }}>No hay cotizaciones registradas</div>
          : cotizacionesFiltradas.map((c, idx) => {
            const interesado = interesados.find(i => i.id === c.interesadoId || i.id === c.leadId);
            return (
              <div key={c.id}>
                <div style={{ ...S.tableRow, gridTemplateColumns: "50px 1.6fr 1fr 1fr 1fr 160px" }}
                  onMouseEnter={e => e.currentTarget.style.background = BLUE.light}
                  onMouseLeave={e => e.currentTarget.style.background = ""}>
                  <div style={{ fontWeight: 700, color: "#aaa", fontSize: 13 }}>{idx + 1}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{c.clienteNombre || interesado?.nombre || "—"}</div>
                    {c.clienteTelefono && <div style={{ fontSize: 11.5, color: "#888" }}>{c.clienteTelefono}</div>}
                    <div style={{ fontSize: 11, color: "#aaa" }}>{fmtDate(c.fechaCotizacion)}</div>
                  </div>
                  <span style={S.chip(BLUE.primary)}>{c.ramo || "—"}</span>
                  {/* Estado selector */}
                  <select value={c.estado || "Pendiente"}
                    onChange={async e => { await handleSave(c, { estado: e.target.value }); }}
                    style={{ fontSize: 12, padding: "5px 8px", borderRadius: 8, border: `1.5px solid ${estadoCotColor2(c.estado)}`, background: "#fff", color: estadoCotColor2(c.estado), fontWeight: 600, cursor: "pointer", maxWidth: 170 }}>
                    <option value="Pendiente">Pendiente</option>
                    {ESTADOS_COT.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                  {/* Acción selector */}
                  <select value={c.accion || "En Curso"}
                    onChange={async e => { await handleSave(c, { accion: e.target.value }); }}
                    style={{ fontSize: 12, padding: "5px 8px", borderRadius: 8, border: `1.5px solid ${accionColor(c.accion)}`, background: "#fff", color: accionColor(c.accion), fontWeight: 600, cursor: "pointer", maxWidth: 160 }}>
                    {ACCIONES_COT.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <div style={{ display: "flex", gap: 4 }}>
                    {c.accion === "Póliza Emitida" && (
                      <button style={{ ...S.btn("success"), padding: "5px 10px", fontSize: 12 }}
                        onClick={() => setEditModal(c)}>
                        {c.numeroPolizaEmitida ? "Ver Póliza" : "Registrar Póliza"}
                      </button>
                    )}
                    <button style={{ ...S.btn("ghost"), color: "#dc2626" }} title="Eliminar"
                      onClick={async () => {
                        if (!confirm(`¿Eliminar esta cotización de ${c.clienteNombre || "este cliente"}?`)) return;
                        await supabase.from('cotizaciones').delete().eq('id', c.id);
                        setCotizaciones(prev => prev.filter(x => x.id !== c.id));
                      }}>
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </div>

                {/* Panel póliza emitida */}
                {c.accion === "Póliza Emitida" && c.numeroPolizaEmitida && (
                  <div style={{ background: "#f0fdf4", borderLeft: "3px solid #16a34a", padding: "10px 18px 10px 24px", display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, fontSize: 12 }}>
                    <div><span style={{ color: "#aaa", display: "block" }}>N° Póliza</span><strong>{c.numeroPolizaEmitida}</strong></div>
                    <div><span style={{ color: "#aaa", display: "block" }}>Aseguradora</span>{c.aseguradoraEmitida}</div>
                    <div><span style={{ color: "#aaa", display: "block" }}>Prima</span>{fmt(c.primaEmitida || 0)}</div>
                    <div><span style={{ color: "#aaa", display: "block" }}>IVA</span>{fmt(c.ivaEmitida || 0)}</div>
                    <div><span style={{ color: "#aaa", display: "block" }}>Gastos</span>{fmt(c.gastosEmitida || 0)}</div>
                    <div><span style={{ color: "#aaa", display: "block" }}>Total Pago</span><strong style={{ color: "#16a34a" }}>{fmt(c.totalPagoEmitida || 0)}</strong></div>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Modal registrar póliza emitida */}
      {editModal && (
        <PolizaEmitidaModal cot={editModal} aseguradoras={aseguradoras} onSave={async (data) => {
          await handleSave(editModal, data);
          setEditModal(null);
        }} onClose={() => setEditModal(null)} />
      )}
    </div>
  );
};

const PolizaEmitidaModal = ({ cot, aseguradoras, onSave, onClose }) => {
  const [form, setForm] = useState({
    numeroPolizaEmitida: cot.numeroPolizaEmitida || "",
    aseguradoraEmitida: cot.aseguradoraEmitida || "",
    primaEmitida: cot.primaEmitida || "",
    ivaEmitida: cot.ivaEmitida || "",
    gastosEmitida: cot.gastosEmitida || "",
    totalPagoEmitida: cot.totalPagoEmitida || "",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const [saving, setSaving] = useState(false);

  // Auto-calcular total
  useEffect(() => {
    const total = (parseFloat(form.primaEmitida) || 0) + (parseFloat(form.ivaEmitida) || 0) + (parseFloat(form.gastosEmitida) || 0);
    setForm(f => ({ ...f, totalPagoEmitida: total || "" }));
  }, [form.primaEmitida, form.ivaEmitida, form.gastosEmitida]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <Modal title="Registrar Póliza Emitida" onClose={onClose}
      footer={<>
        <button style={S.btn("secondary")} onClick={onClose}>Cancelar</button>
        <button style={{ ...S.btn("success"), opacity: saving ? 0.6 : 1 }} onClick={handleSave} disabled={saving}>
          {saving ? "Guardando…" : "✓ Guardar Póliza"}
        </button>
      </>}>
      <div style={{ background: BLUE.light, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
        <strong>{cot.clienteNombre}</strong> · {cot.ramo}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
        <div style={{ ...S.formGroup, gridColumn: "1/-1" }}>
          <label style={S.label}>N° Póliza *</label>
          <input style={S.input} value={form.numeroPolizaEmitida} onChange={e => set("numeroPolizaEmitida", e.target.value)} placeholder="Número de póliza" />
        </div>
        <div style={{ ...S.formGroup, gridColumn: "1/-1" }}>
          <label style={S.label}>Aseguradora *</label>
          <select style={S.select} value={form.aseguradoraEmitida} onChange={e => set("aseguradoraEmitida", e.target.value)}>
            <option value="">— Selecciona aseguradora —</option>
            {(aseguradoras || []).filter(a => a.activo !== false).map(a => <option key={a.id} value={a.nombre}>{a.nombre}</option>)}
          </select>
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>Prima</label>
          <input style={S.input} type="number" value={form.primaEmitida} onChange={e => set("primaEmitida", e.target.value)} placeholder="0" />
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>IVA</label>
          <input style={S.input} type="number" value={form.ivaEmitida} onChange={e => set("ivaEmitida", e.target.value)} placeholder="0" />
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>Gastos</label>
          <input style={S.input} type="number" value={form.gastosEmitida} onChange={e => set("gastosEmitida", e.target.value)} placeholder="0" />
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>Total Pago</label>
          <input style={{ ...S.input, background: "#f0fdf4", fontWeight: 700, color: "#16a34a" }} type="number" value={form.totalPagoEmitida} readOnly />
        </div>
      </div>
    </Modal>
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

      {/* Tabla Leads */}
      <div style={S.tableWrap}>
        <div style={{ ...S.tableHead, gridTemplateColumns: "40px 100px 1.6fr 1fr 140px 150px 1fr" }}>
          <span>#</span><span>Fecha</span><span>Cliente</span><span>Tipo Seguro</span><span>Estado Docs</span><span>Enviado a Cotización</span><span>Acciones</span>
        </div>
        {interesadosFiltrados.length === 0
          ? <div style={{ padding: 40, textAlign: "center", color: "#aaa" }}>No hay leads registrados</div>
          : interesadosFiltrados.map((i, idx) => {
            const cliente = clientes.find(c => c.id === i.clienteId);
            const ramoObj = ramos.find(r => r.nombre === i.tipoSeguro);
            const docsDelRamo = ramoObj?.documentos
              ? Object.entries(ramoObj.documentos).filter(([, v]) => v).map(([k]) => k)
              : [];
            const checklist = i.documentosChecklist || {};
            const todosCompletos = docsDelRamo.length > 0 && docsDelRamo.every(d => checklist[d] === "Sí");
            const algunoMarcado = docsDelRamo.some(d => checklist[d] === "Sí");
            const estadoDocs = docsDelRamo.length === 0 ? null : todosCompletos ? "Completos" : "Incompletos";
            const estadoColor = todosCompletos ? "#16a34a" : "#f59e0b";

            return (
              <div key={i.id} style={{ ...S.tableRow, gridTemplateColumns: "40px 100px 1.6fr 1fr 140px 150px 1fr" }}
                onMouseEnter={e => e.currentTarget.style.background = BLUE.light}
                onMouseLeave={e => e.currentTarget.style.background = ""}>
                <div style={{ fontWeight: 700, color: "#aaa", fontSize: 13 }}>{idx + 1}</div>
                <div style={{ fontSize: 13, color: "#555" }}>{fmtDate(i.fechaRegistro)}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{cliente?.nombre || i.nombre || "—"}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>{cliente?.email || ""}</div>
                  <div style={{ fontSize: 11, color: "#6b87b0" }}>
                    {cliente?.tipo_persona === "Jurídica"
                      ? (cliente?.telefono_contacto || cliente?.nombre_contacto || "")
                      : (cliente?.celular || cliente?.telefono || "")}
                  </div>
                </div>
                <span style={S.chip(BLUE.primary)}>{i.tipoSeguro || "—"}</span>
                <div>
                  {estadoDocs
                    ? <span style={S.badge(estadoColor)}>{estadoDocs === "Completos" ? "✓ Completos" : "⚠ Incompletos"}</span>
                    : <span style={{ fontSize: 12, color: "#ccc" }}>—</span>}
                </div>
                <div>
                  {i.envioOficina
                    ? <span style={S.badge("#16a34a")}>✓ Sí</span>
                    : <span style={S.badge("#6b7280")}>No</span>}
                </div>
                <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                  <button style={S.btn("ghost")} onClick={() => setEditInteresado(i)}><Icon name="edit" size={14} /></button>
                  {esAdmin(userRol) && <button style={{ ...S.btn("ghost"), color: "#dc2626" }} onClick={() => setDelInteresado(i)}><Icon name="trash" size={14} /></button>}
                  {/* Estado dinámico */}
                  {i.envioOficina
                    ? <span style={{ ...S.badge("#16a34a"), fontSize: 11.5, whiteSpace: "nowrap" }}>En Cotización</span>
                    : docsDelRamo.length === 0
                      ? <span style={{ ...S.badge(BLUE.primary), fontSize: 11.5, whiteSpace: "nowrap" }}>Llamar al Cliente</span>
                      : !todosCompletos
                        ? <span style={{ ...S.badge("#f59e0b"), fontSize: 11.5, whiteSpace: "nowrap" }}>Pendiente Docs</span>
                        : <span style={{ ...S.badge("#16a34a"), fontSize: 11.5, whiteSpace: "nowrap" }}>Listo</span>
                  }
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
const PolizasPage = ({ polizas, interesados, ramos, aseguradoras, onDelete, userRol, agenteActualId }) => {
  const [q, setQ] = useState("");
  const [filtroRamo, setFiltroRamo] = useState("Todos");
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [filtroAnio, setFiltroAnio] = useState("Todos");
  const [filtroMes, setFiltroMes] = useState("Todos");

  const polizasPorRol = esAdmin(userRol) ? polizas : polizas.filter(p => p.agenteId === agenteActualId);

  // Años disponibles de las pólizas
  const anios = useMemo(() => {
    const s = new Set();
    polizasPorRol.forEach(p => { const f = p.fechaEmision || p.vigenciaInicio; if(f) s.add(f.substring(0,4)); });
    return Array.from(s).sort().reverse();
  }, [polizasPorRol]);

  const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  const filtered = useMemo(() => polizasPorRol.filter(p => {
    const matchQ = !q || p.numero?.toLowerCase().includes(q.toLowerCase()) || p.clienteNombre?.toLowerCase().includes(q.toLowerCase()) || p.aseguradora?.toLowerCase().includes(q.toLowerCase());
    const fe = p.fechaEmision || p.vigenciaInicio || "";
    const matchAnio = filtroAnio === "Todos" || fe.startsWith(filtroAnio);
    const matchMes = filtroMes === "Todos" || fe.substring(5,7) === String(meses.indexOf(filtroMes)+1).padStart(2,"0");
    return matchQ && (filtroRamo === "Todos" || p.ramo === filtroRamo) && (filtroEstado === "Todos" || p.estado === filtroEstado) && matchAnio && matchMes;
  }), [polizasPorRol, q, filtroRamo, filtroEstado, filtroAnio, filtroMes]);

  return (
    <div>
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>Pólizas</div>
          <div style={S.pageSub}>{filtered.length} de {polizasPorRol.length} pólizas · {polizasPorRol.filter(p => p.estado === "Activa").length} activas</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={S.searchBar}><Icon name="search" size={16} /><input style={S.searchInput} placeholder="Buscar póliza, cliente, aseguradora…" value={q} onChange={e => setQ(e.target.value)} /></div>
        <select style={{ ...S.select, width: "auto", padding: "7px 12px" }} value={filtroAnio} onChange={e => setFiltroAnio(e.target.value)}>
          <option value="Todos">Todos los años</option>
          {anios.map(a => <option key={a}>{a}</option>)}
        </select>
        <select style={{ ...S.select, width: "auto", padding: "7px 12px" }} value={filtroMes} onChange={e => setFiltroMes(e.target.value)}>
          <option value="Todos">Todos los meses</option>
          {meses.map(m => <option key={m}>{m}</option>)}
        </select>
        <select style={{ ...S.select, width: "auto", padding: "7px 12px" }} value={filtroRamo} onChange={e => setFiltroRamo(e.target.value)}>
          <option value="Todos">Todos los ramos</option>
          {ramos.map(r => <option key={r.id} value={r.nombre}>{r.nombre}</option>)}
        </select>
        <select style={{ ...S.select, width: "auto", padding: "7px 12px" }} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          {["Todos", "Activa", "Vencida", "Cancelada"].map(e => <option key={e}>{e}</option>)}
        </select>
      </div>
      <div style={S.tableWrap}>
        <div style={{ ...S.tableHead, gridTemplateColumns: "1.4fr 1.4fr 0.8fr 1fr 1fr 1fr 1fr 0.8fr 50px" }}>
          <span>N° Póliza</span><span>Cliente</span><span>Ramo</span><span>Aseguradora</span><span>Prima</span><span>Emitida</span><span>Vence</span><span>Estado</span><span></span>
        </div>
        {filtered.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: "#aaa" }}>No se encontraron pólizas</div>
          : filtered.map(p => {
            const dias = diasParaVencer(p.vigenciaFin);
            return (
              <div key={p.id} style={{ ...S.tableRow, gridTemplateColumns: "1.4fr 1.4fr 0.8fr 1fr 1fr 1fr 1fr 0.8fr 50px" }}
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
                <button style={{ ...S.btn("ghost"), color: "#dc2626" }} title="Eliminar póliza"
                  onClick={async () => { if (!confirm(`¿Eliminar póliza ${p.numero || ""}?`)) return; await onDelete(p.id); }}>
                  <Icon name="trash" size={14} />
                </button>
              </div>
            );
          })}
      </div>
    </div>
  );
};

// ─── RENOVACIONES ─────────────────────────────────────────────────────────────
const RenovacionesPage = ({ polizas, userRol, agenteActualId, onImportPolizas, onUpdatePoliza }) => {
  const [filtro, setFiltro] = useState("30");
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [preview, setPreview] = useState([]);
  const [q, setQ] = useState("");

  const polizasPorRol = esAdmin(userRol) ? polizas : polizas.filter(p => p.agenteId === agenteActualId);
  const getCount = (val) => polizasPorRol.filter(p => {
    const d = diasParaVencer(p.vigenciaFin);
    return val === "vencidas" ? p.estado === "Vencida" : p.estado === "Activa" && d >= 0 && d <= parseInt(val);
  }).length;

  const candidates = polizasPorRol.filter(p => {
    const d = diasParaVencer(p.vigenciaFin);
    const matchFiltro = filtro === "vencidas" ? p.estado === "Vencida" : p.estado === "Activa" && d >= 0 && d <= parseInt(filtro);
    const matchQ = !q || p.numero?.toLowerCase().includes(q.toLowerCase()) || p.clienteNombre?.toLowerCase().includes(q.toLowerCase()) || p.aseguradora?.toLowerCase().includes(q.toLowerCase()) || p.ramo?.toLowerCase().includes(q.toLowerCase());
    return matchFiltro && matchQ;
  }).sort((a, b) => diasParaVencer(a.vigenciaFin) - diasParaVencer(b.vigenciaFin));

  // Parsear fecha dd/mm/yyyy o m/d/yyyy
  const parseExcelDate = (val) => {
    if (!val) return null;
    const s = String(val).trim();
    // Si es número serial de Excel
    if (/^\d+$/.test(s)) {
      const d = new Date(Math.round((parseInt(s) - 25569) * 86400 * 1000));
      return d.toISOString().split("T")[0];
    }
    // dd/mm/yyyy o d/m/yyyy
    const parts = s.split(/[\/\-]/);
    if (parts.length === 3) {
      const [a, b, c] = parts;
      if (c.length === 4) return `${c}-${b.padStart(2,"0")}-${a.padStart(2,"0")}`;
      if (a.length === 4) return `${a}-${b.padStart(2,"0")}-${c.padStart(2,"0")}`;
    }
    return s;
  };

  const parseCurrency = (val) => {
    if (!val && val !== 0) return 0;
    return parseFloat(String(val).replace(/[^0-9.\-]/g, "")) || 0;
  };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportMsg("Leyendo archivo…");
    try {
      const XLSX = await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
      // Mapear columnas flexiblemente
      const mapped = rows.map((r, i) => {
        const keys = Object.keys(r);
        const get = (...names) => { for (const n of names) { const k = keys.find(k => k.toLowerCase().includes(n.toLowerCase())); if (k) return r[k]; } return ""; };
        const fechaRaw = parseExcelDate(get("fecha"));
        const fechaVig = fechaRaw ? (() => { const d = new Date(fechaRaw); d.setFullYear(d.getFullYear() + 1); return d.toISOString().split("T")[0]; })() : null;
        return {
          _row: i + 2,
          numero: String(get("poliza", "póliza", "numero", "número") || "").trim(),
          clienteNombre: String(get("tomador", "cliente", "nombre") || "").trim(),
          clienteTelefono: String(get("telefono", "teléfono", "tel") || "").trim(),
          ramo: String(get("ramo") || "").trim(),
          aseguradora: String(get("compañia", "compania", "aseguradora", "empresa") || "").trim(),
          prima: parseCurrency(get("prima")),
          iva: parseCurrency(get("iva")),
          gastosExpedicion: parseCurrency(get("gastos")),
          totalPago: parseCurrency(get("total")),
          fechaEmision: fechaRaw,
          vigenciaInicio: fechaRaw,
          vigenciaFin: fechaVig,
          estado: "Activa",
        };
      }).filter(r => r.numero || r.clienteNombre);
      setPreview(mapped);
      setImportMsg(`${mapped.length} registros listos para importar.`);
    } catch (err) {
      setImportMsg("Error leyendo el archivo. Asegúrate que sea .xlsx");
      console.error(err);
    }
    e.target.value = "";
  };

  const handleImport = async () => {
    if (!preview.length) return;
    setImporting(true);
    setImportMsg("Importando…");
    try {
      await onImportPolizas(preview);
      setImportMsg(`✓ ${preview.length} pólizas importadas correctamente.`);
      setPreview([]);
      setTimeout(() => { setShowImport(false); setImportMsg(""); }, 2000);
    } catch (err) {
      setImportMsg("Error al importar: " + err.message);
    }
    setImporting(false);
  };

  return (
    <div>
      <div style={S.pageHeader}>
        <div><div style={S.pageTitle}>Renovaciones</div><div style={S.pageSub}>Pólizas por vencer y vencidas</div></div>
        <button style={S.btn("secondary")} onClick={() => setShowImport(true)}>
          <Icon name="upload" size={16} />Importar Pólizas Excel
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {[["7", "7 días"], ["15", "15 días"], ["30", "30 días"], ["60", "60 días"], ["vencidas", "Vencidas"]].map(([val, label]) => (
          <button key={val} onClick={() => setFiltro(val)} style={{ padding: "7px 16px", borderRadius: 20, border: `1.5px solid ${filtro === val ? BLUE.primary : BLUE.border}`, background: filtro === val ? BLUE.light : "#fff", color: filtro === val ? BLUE.primary : "#555", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {label} <span style={{ color: filtro === val ? BLUE.primary : "#aaa" }}>({getCount(val)})</span>
          </button>
        ))}
        <div style={{ ...S.searchBar, marginLeft: "auto" }}>
          <Icon name="search" size={16} />
          <input style={S.searchInput} placeholder="Buscar póliza, cliente, ramo…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
      </div>

      {/* Tabla */}
      {candidates.length === 0
        ? <div style={{ ...S.tableWrap, padding: 48, textAlign: "center", color: "#aaa" }}>No hay pólizas en este rango.</div>
        : (
          <div style={S.tableWrap}>
            <div style={{ ...S.tableHead, gridTemplateColumns: "1fr 1.2fr 1.4fr 0.9fr 0.9fr 0.9fr 1fr 1.1fr 0.8fr 150px" }}>
              <span>Fecha</span><span>Póliza</span><span>Tomador</span><span>Prima</span><span>Iva</span><span>Gastos</span><span>Total Pago</span><span>Compañía</span><span>Ramo</span><span>Decisión</span>
            </div>
            {candidates.map(p => {
              const d = diasParaVencer(p.vigenciaFin);
              const urgColor = filtro === "vencidas" ? "#dc2626" : d <= 7 ? "#dc2626" : d <= 15 ? "#d97706" : BLUE.primary;
              const decisionColor = { "Cliente renueva": "#16a34a", "Cliente no renueva": "#dc2626" }[p.decisionRenovacion] || "#6b7280";
              return (
                <div key={p.id} style={{ ...S.tableRow, gridTemplateColumns: "1fr 1.2fr 1.4fr 0.9fr 0.9fr 0.9fr 1fr 1.1fr 0.8fr 150px", borderLeft: `3px solid ${urgColor}` }}
                  onMouseEnter={e => e.currentTarget.style.background = BLUE.light}
                  onMouseLeave={e => e.currentTarget.style.background = ""}>
                  <div style={{ fontSize: 12.5 }}>{fmtDate(p.vigenciaFin)}</div>
                  <div style={{ fontWeight: 600, fontSize: 12.5 }}>{p.numero}</div>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{p.clienteNombre}</div>
                    {p.clienteTelefono && <div style={{ fontSize: 11, color: "#888" }}>{p.clienteTelefono}</div>}
                  </div>
                  <div style={{ fontSize: 12.5 }}>{fmt(p.prima || 0)}</div>
                  <div style={{ fontSize: 12.5 }}>{fmt(p.iva || 0)}</div>
                  <div style={{ fontSize: 12.5 }}>{fmt(p.gastosExpedicion || 0)}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{fmt(p.totalPago || (Number(p.prima||0)+Number(p.iva||0)+Number(p.gastosExpedicion||0)))}</div>
                  <div style={{ fontSize: 12 }}>{p.aseguradora}</div>
                  <span style={S.chip(BLUE.primary)}>{p.ramo || "—"}</span>
                  <select value={p.decisionRenovacion || ""}
                    onChange={async e => {
                      const val = e.target.value;
                      await supabase.from('polizas').update({ decision_renovacion: val }).eq('id', p.id);
                      onUpdatePoliza(p.id, { decisionRenovacion: val });
                    }}
                    style={{ fontSize: 11.5, padding: "5px 8px", borderRadius: 8, border: `1.5px solid ${decisionColor}`, color: decisionColor, fontWeight: 600, cursor: "pointer", background: "#fff", width: "100%" }}>
                    <option value="">— Decisión —</option>
                    <option value="Cliente renueva">✓ Cliente renueva</option>
                    <option value="Cliente no renueva">✗ Cliente no renueva</option>
                  </select>
                </div>
              );
            })}
          </div>
        )}

      {/* Modal importar */}
      {showImport && (
        <Modal title="Importar Pólizas desde Excel" onClose={() => { setShowImport(false); setPreview([]); setImportMsg(""); }} wide
          footer={<>
            <button style={S.btn("secondary")} onClick={() => { setShowImport(false); setPreview([]); setImportMsg(""); }}>Cancelar</button>
            {preview.length > 0 && <button style={{ ...S.btn("primary"), opacity: importing ? 0.6 : 1 }} onClick={handleImport} disabled={importing}>{importing ? "Importando…" : `Importar ${preview.length} pólizas`}</button>}
          </>}>
          <div style={{ background: BLUE.light, border: `1px solid ${BLUE.border}`, borderRadius: 10, padding: "14px 18px", marginBottom: 16, fontSize: 13, color: BLUE.text }}>
            <strong>Columnas esperadas en el Excel:</strong><br />
            Fecha · Poliza · Tomador · Telefono · Prima · Iva · Gastos · Total Pago · Compañia · Ramo
            <div style={{ marginTop: 6, fontSize: 12, color: "#6b87b0" }}>La vigencia se calcula automáticamente como +1 año desde la fecha.</div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ ...S.btn("primary"), display: "inline-flex", cursor: "pointer" }}>
              <Icon name="upload" size={16} />Seleccionar archivo .xlsx
              <input type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: "none" }} />
            </label>
          </div>
          {importMsg && <div style={{ background: importMsg.startsWith("✓") ? "#f0fdf4" : importMsg.startsWith("Error") ? "#fef2f2" : BLUE.light, border: `1px solid ${importMsg.startsWith("✓") ? "#bbf7d0" : importMsg.startsWith("Error") ? "#fecaca" : BLUE.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>{importMsg}</div>}
          {preview.length > 0 && (
            <div style={{ maxHeight: 260, overflowY: "auto", borderRadius: 8, border: `1px solid ${BLUE.border}` }}>
              <div style={{ ...S.tableHead, gridTemplateColumns: "1.5fr 1.2fr 1fr 1fr 1fr", fontSize: 11 }}>
                <span>Tomador</span><span>Póliza</span><span>Prima</span><span>Compañía</span><span>Ramo</span>
              </div>
              {preview.slice(0, 20).map((r, i) => (
                <div key={i} style={{ ...S.tableRow, gridTemplateColumns: "1.5fr 1.2fr 1fr 1fr 1fr", fontSize: 12 }}>
                  <div>{r.clienteNombre}</div>
                  <div>{r.numero}</div>
                  <div>{fmt(r.prima)}</div>
                  <div>{r.aseguradora}</div>
                  <div>{r.ramo}</div>
                </div>
              ))}
              {preview.length > 20 && <div style={{ padding: "8px 18px", fontSize: 12, color: "#888" }}>...y {preview.length - 20} más</div>}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};

// ─── REPORTES ─────────────────────────────────────────────────────────────────
const ReportesPage = ({ polizas, ramos, clientes }) => {
  const [fechaInicio, setFechaInicio] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split("T")[0]; });
  const [fechaFin, setFechaFin] = useState(today());
  const [filtroAseg, setFiltroAseg] = useState("Todas");
  const [filtroRamo, setFiltroRamo] = useState("Todos");
  const [filtroCliente, setFiltroCliente] = useState("Todos");

  const polizasFiltradas = useMemo(() => polizas.filter(p => {
    const fe = p.fechaEmision || p.vigenciaInicio;
    if (!fe) return false;
    const matchFecha = fe >= fechaInicio && fe <= fechaFin;
    const matchAseg = filtroAseg === "Todas" || p.aseguradora === filtroAseg;
    const matchRamo = filtroRamo === "Todos" || p.ramo === filtroRamo;
    const matchCliente = filtroCliente === "Todos" || p.clienteNombre === filtroCliente;
    return matchFecha && matchAseg && matchRamo && matchCliente;
  }), [polizas, fechaInicio, fechaFin, filtroAseg, filtroRamo, filtroCliente]);

  const aseguradoras = [...new Set(polizas.map(p => p.aseguradora).filter(Boolean))].sort();
  const ramosLista = [...new Set(polizas.map(p => p.ramo).filter(Boolean))].sort();
  const clientesLista = [...new Set(polizas.map(p => p.clienteNombre).filter(Boolean))].sort();
  const totalPrima = polizasFiltradas.reduce((s, p) => s + Number(p.prima || 0), 0);
  const totalSuma = polizasFiltradas.reduce((s, p) => s + Number(p.sumaAsegurada || 0), 0);

  const porAseg = useMemo(() => {
    const map = {};
    polizasFiltradas.forEach(p => {
      if (!map[p.aseguradora]) map[p.aseguradora] = { nombre: p.aseguradora, cantidad: 0, prima: 0 };
      map[p.aseguradora].cantidad++;
      map[p.aseguradora].prima += Number(p.prima || 0);
    });
    return Object.values(map).sort((a, b) => b.prima - a.prima);
  }, [polizasFiltradas]);

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

  const exportXLSX = () => {
    const rows = [
      ["#", "N° Póliza", "Cliente", "Ramo", "Aseguradora", "Prima", "Suma Asegurada", "Fecha Emisión"],
      ...polizasFiltradas.map((p, i) => [
        i + 1, p.numero || "—", p.clienteNombre || "—", p.ramo || "—",
        p.aseguradora || "—", Number(p.prima || 0), Number(p.sumaAsegurada || 0), p.fechaEmision || ""
      ])
    ];
    const ws = rows.map(r => r.join("\t")).join("\n");
    const blob = new Blob([ws], { type: "text/tab-separated-values" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `reporte_polizas_${fechaInicio}_${fechaFin}.xls`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div style={S.pageHeader}>
        <div><div style={S.pageTitle}>Reportes</div><div style={S.pageSub}>Pólizas emitidas — {polizasFiltradas.length} registros</div></div>
        <button style={S.btn("success")} onClick={exportXLSX}>
          <Icon name="download" size={16} />Exportar Excel
        </button>
      </div>

      {/* Filtros */}
      <div style={{ background: "#fff", borderRadius: 12, padding: "18px 20px", marginBottom: 24, boxShadow: "0 1px 6px rgba(26,86,219,0.08)", display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={S.formGroup}>
          <label style={S.label}>Fecha Inicio</label>
          <input style={{ ...S.input, width: 150 }} type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>Fecha Fin</label>
          <input style={{ ...S.input, width: 150 }} type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>Aseguradora</label>
          <select style={{ ...S.select, width: 180 }} value={filtroAseg} onChange={e => setFiltroAseg(e.target.value)}>
            <option value="Todas">Todas</option>
            {aseguradoras.map(a => <option key={a}>{a}</option>)}
          </select>
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>Ramo de Seguro</label>
          <select style={{ ...S.select, width: 180 }} value={filtroRamo} onChange={e => setFiltroRamo(e.target.value)}>
            <option value="Todos">Todos</option>
            {ramosLista.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>Cliente</label>
          <select style={{ ...S.select, width: 200 }} value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)}>
            <option value="Todos">Todos</option>
            {clientesLista.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Gráficas */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
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
      <div style={{ fontSize: 12, fontWeight: 700, color: "#6b87b0", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 12 }}>
        Detalle de Pólizas Emitidas — {polizasFiltradas.length} registros · Prima total: {fmt(totalPrima)} · Suma asegurada: {fmt(totalSuma)}
      </div>
      <div style={S.tableWrap}>
        <div style={{ ...S.tableHead, gridTemplateColumns: "40px 1.1fr 1.3fr 0.9fr 1fr 1fr 1fr 1fr" }}>
          <span>#</span><span>N° Póliza</span><span>Cliente</span><span>Ramo</span><span>Aseguradora</span><span>Prima</span><span>Suma Aseg.</span><span>Fecha Emisión</span>
        </div>
        {polizasFiltradas.length === 0
          ? <div style={{ padding: 40, textAlign: "center", color: "#aaa" }}>No hay pólizas en este rango de fechas</div>
          : polizasFiltradas.map((p, idx) => (
            <div key={p.id} style={{ ...S.tableRow, gridTemplateColumns: "40px 1.1fr 1.3fr 0.9fr 1fr 1fr 1fr 1fr" }}
              onMouseEnter={e => e.currentTarget.style.background = BLUE.light}
              onMouseLeave={e => e.currentTarget.style.background = ""}>
              <div style={{ fontWeight: 700, color: "#aaa", fontSize: 13 }}>{idx + 1}</div>
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
const DOCS_NATURAL_DEFAULT = ["Cédula", "SARLAFT", "RUT", "Contrato", "Carta de Autorización"];
const DOCS_JURIDICA_DEFAULT = ["Cámara de Comercio", "RUT Empresa", "SARLAFT", "Estados Financieros", "Cédula Rep. Legal", "Contrato", "Carta de Autorización"];
const DOCS_KEY_NAT = "docs_natural_v2";
const DOCS_KEY_JUR = "docs_juridica_v2";

const initDocs = (key, defaults) => {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored);
    localStorage.setItem(key, JSON.stringify(defaults));
    return defaults;
  } catch { return defaults; }
};

const RamosPage = ({ ramos, onAdd, onEdit, onDelete }) => {
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [delItem, setDelItem] = useState(null);
  const [form, setForm] = useState({ nombre: "", descripcion: "", activo: true, documentos: {} });
  const [nuevoDoc, setNuevoDoc] = useState("");
  const [tipoPersona, setTipoPersona] = useState("Natural");
  const [docsNatural, setDocsNatural] = useState(() => initDocs(DOCS_KEY_NAT, DOCS_NATURAL_DEFAULT));
  const [docsJuridica, setDocsJuridica] = useState(() => initDocs(DOCS_KEY_JUR, DOCS_JURIDICA_DEFAULT));
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleDoc = (doc, tp) => setForm(f => {
    const key = tp === "Natural" ? doc : `J_${doc}`;
    return { ...f, documentos: { ...f.documentos, [key]: !f.documentos[key] } };
  });

  const docsMostrar = tipoPersona === "Natural" ? docsNatural : docsJuridica;

  const agregarDocGlobal = () => {
    const d = nuevoDoc.trim();
    if (!d) { setNuevoDoc(""); return; }
    if (tipoPersona === "Natural") {
      if (docsNatural.includes(d)) { setNuevoDoc(""); return; }
      const nuevos = [...docsNatural, d];
      setDocsNatural(nuevos);
      localStorage.setItem(DOCS_KEY_NAT, JSON.stringify(nuevos));
    } else {
      if (docsJuridica.includes(d)) { setNuevoDoc(""); return; }
      const nuevos = [...docsJuridica, d];
      setDocsJuridica(nuevos);
      localStorage.setItem(DOCS_KEY_JUR, JSON.stringify(nuevos));
    }
    setNuevoDoc("");
  };

  const eliminarDoc = (doc) => {
    if (tipoPersona === "Natural") {
      const nuevos = docsNatural.filter(d => d !== doc);
      setDocsNatural(nuevos);
      localStorage.setItem(DOCS_KEY_NAT, JSON.stringify(nuevos));
    } else {
      const nuevos = docsJuridica.filter(d => d !== doc);
      setDocsJuridica(nuevos);
      localStorage.setItem(DOCS_KEY_JUR, JSON.stringify(nuevos));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    if (editItem) { await onEdit({ ...editItem, ...form }); setEditItem(null); setShowForm(false); }
    else { await onAdd(form); setShowForm(false); setForm({ nombre: "", descripcion: "", activo: true, documentos: {} }); }
    setSaving(false);
  };

  const thStyle = { padding: "11px 14px", textAlign: "center", fontWeight: 700, color: BLUE.primary, fontSize: 11.5, borderBottom: `1px solid ${BLUE.border}`, minWidth: 110, whiteSpace: "nowrap", letterSpacing: 0.3 };
  const tdStyle = (idx) => ({ textAlign: "center", borderBottom: `1px solid ${BLUE.border}`, padding: "10px 8px", background: idx % 2 === 0 ? "#fff" : "#f8faff" });

  // Check if ramo has doc for current tipo persona
  const ramoTieneDoc = (r, doc) => tipoPersona === "Natural" ? r.documentos?.[doc] : r.documentos?.[`J_${doc}`];

  const btnTP = (tp) => ({
    padding: "7px 18px", borderRadius: 8, border: `1.5px solid ${tipoPersona === tp ? BLUE.primary : BLUE.border}`,
    background: tipoPersona === tp ? BLUE.primary : "#fff", color: tipoPersona === tp ? "#fff" : BLUE.text,
    fontSize: 13, fontWeight: 600, cursor: "pointer"
  });

  return (
    <div>
      <div style={S.pageHeader}>
        <div><div style={S.pageTitle}>Ramos de Seguros</div><div style={S.pageSub}>Configura qué documentos requiere cada ramo</div></div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <input style={{ ...S.input, width: 200, padding: "8px 12px", fontSize: 13 }} value={nuevoDoc}
              onChange={e => setNuevoDoc(e.target.value)}
              onKeyDown={e => e.key === "Enter" && agregarDocGlobal()}
              placeholder={`+ Doc ${tipoPersona}…`} />
            <button style={S.btn("secondary")} onClick={agregarDocGlobal}>Agregar</button>
          </div>
          <button style={S.btn("primary")} onClick={() => { setShowForm(true); setEditItem(null); setForm({ nombre: "", descripcion: "", activo: true, documentos: {} }); }}>
            <Icon name="plus" size={16} />Nuevo Ramo
          </button>
        </div>
      </div>

      {/* Selector tipo persona */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#6b87b0", marginRight: 4 }}>Ver documentos para:</span>
        <button style={btnTP("Natural")} onClick={() => setTipoPersona("Natural")}>👤 Persona Natural</button>
        <button style={btnTP("Jurídica")} onClick={() => setTipoPersona("Jurídica")}>🏢 Persona Jurídica</button>
      </div>

      {/* Matriz */}
      <div style={{ overflowX: "auto", marginBottom: 24 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 12, boxShadow: "0 1px 6px rgba(26,86,219,0.08)", fontSize: 13 }}>
          <thead>
            <tr style={{ background: BLUE.light }}>
              <th style={{ ...thStyle, minWidth: 80 }}>ACCIONES</th>
              <th style={{ ...thStyle, textAlign: "left", minWidth: 180, position: "sticky", left: 0, background: BLUE.light, zIndex: 2 }}>RAMO</th>
              {docsMostrar.map(doc => (
                <th key={doc} style={thStyle}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                    <span>{doc}</span>
                    <button title="Eliminar documento" onClick={() => eliminarDoc(doc)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 13, lineHeight: 1, padding: "0 2px", fontWeight: 700 }}>✕</button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ramos.length === 0 && (
              <tr><td colSpan={docsMostrar.length + 2} style={{ padding: 40, textAlign: "center", color: "#aaa" }}>No hay ramos. Agrega el primero.</td></tr>
            )}
            {ramos.map((r, idx) => (
              <tr key={r.id}>
                <td style={tdStyle(idx)}>
                  <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                    <button style={S.btn("ghost")} title="Editar" onClick={() => { setEditItem(r); setForm({ nombre: r.nombre, descripcion: r.descripcion || "", activo: r.activo !== false, documentos: { ...(r.documentos || {}) } }); setShowForm(true); }}>
                      <Icon name="edit" size={14} />
                    </button>
                    <button style={{ ...S.btn("ghost"), color: "#dc2626" }} title="Eliminar" onClick={() => setDelItem(r)}>
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </td>
                <td style={{ ...tdStyle(idx), textAlign: "left", padding: "12px 16px", fontWeight: 600, color: BLUE.text, position: "sticky", left: 0, zIndex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {r.nombre}
                    <span style={S.chip(r.activo !== false ? "#16a34a" : "#6b7280")}>{r.activo !== false ? "Activo" : "Inactivo"}</span>
                  </div>
                </td>
                {docsMostrar.map(doc => (
                  <td key={doc} style={tdStyle(idx)}>
                    {ramoTieneDoc(r, doc) ? <span style={{ color: "#16a34a", fontSize: 18, fontWeight: 700 }}>✓</span> : <span style={{ color: "#d1d5db" }}>—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal nuevo/editar */}
      {showForm && (
        <Modal title={editItem ? `Editar — ${editItem.nombre}` : "Nuevo Ramo"} onClose={() => { setShowForm(false); setEditItem(null); }} wide
          footer={<>
            <button style={S.btn("secondary")} onClick={() => { setShowForm(false); setEditItem(null); }}>Cancelar</button>
            <button style={{ ...S.btn("primary"), opacity: saving ? 0.6 : 1 }} onClick={handleSave} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>
          </>}>
          <div style={S.formGroup}><label style={S.label}>Nombre del Ramo *</label><input style={S.input} value={form.nombre} onChange={e => set("nombre", e.target.value)} placeholder="Ej. SOAT, Vida, Automóvil" /></div>
          <div style={S.formGroup}><label style={S.label}>Descripción</label><input style={S.input} value={form.descripcion} onChange={e => set("descripcion", e.target.value)} /></div>
          <div style={{ ...S.formGroup, display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <input type="checkbox" checked={form.activo} onChange={e => set("activo", e.target.checked)} style={{ width: 16, height: 16, accentColor: BLUE.primary }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: BLUE.text }}>Ramo activo</span>
          </div>

          {/* Docs Natural */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: BLUE.primary, letterSpacing: 0.5, marginBottom: 8 }}>👤 DOCUMENTOS PERSONA NATURAL</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {docsNatural.map(doc => (
                <label key={doc} style={{ display: "flex", alignItems: "center", gap: 8, background: form.documentos[doc] ? "#f0fdf4" : BLUE.light, border: `1px solid ${form.documentos[doc] ? "#bbf7d0" : BLUE.border}`, borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}>
                  <input type="checkbox" checked={!!form.documentos[doc]} onChange={() => toggleDoc(doc, "Natural")} style={{ width: 15, height: 15, accentColor: "#16a34a" }} />
                  <span style={{ fontSize: 12.5, color: form.documentos[doc] ? "#16a34a" : BLUE.text, fontWeight: form.documentos[doc] ? 600 : 400 }}>{doc}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Docs Jurídica */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed", letterSpacing: 0.5, marginBottom: 8 }}>🏢 DOCUMENTOS PERSONA JURÍDICA</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {docsJuridica.map(doc => (
                <label key={doc} style={{ display: "flex", alignItems: "center", gap: 8, background: form.documentos[`J_${doc}`] ? "#faf5ff" : BLUE.light, border: `1px solid ${form.documentos[`J_${doc}`] ? "#e9d5ff" : BLUE.border}`, borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}>
                  <input type="checkbox" checked={!!form.documentos[`J_${doc}`]} onChange={() => toggleDoc(doc, "Jurídica")} style={{ width: 15, height: 15, accentColor: "#7c3aed" }} />
                  <span style={{ fontSize: 12.5, color: form.documentos[`J_${doc}`] ? "#7c3aed" : BLUE.text, fontWeight: form.documentos[`J_${doc}`] ? 600 : 400 }}>{doc}</span>
                </label>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmar eliminación */}
      {delItem && (
        <Modal title="Eliminar Ramo" onClose={() => setDelItem(null)}
          footer={<>
            <button style={S.btn("secondary")} onClick={() => setDelItem(null)}>Cancelar</button>
            <button style={S.btn("danger")} onClick={async () => { await onDelete(delItem.id); setDelItem(null); }}>Eliminar</button>
          </>}>
          <p style={{ fontSize: 14, color: "#555" }}>¿Eliminar el ramo <strong>{delItem.nombre}</strong>? Esta acción no se puede deshacer.</p>
        </Modal>
      )}
    </div>
  );
};

// ─── SEGUIMIENTO CLIENTES SOAT ────────────────────────────────────────────────
const SOAT_KEY = "soat-crm-v2";
const FASES_SOAT = [
  {id:"pendiente",   label:"📋 Pendiente",         color:"#3b82f6", bg:"#dbeafe", text:"#1d4ed8"},
  {id:"en_gestion",  label:"📞 En gestión",         color:"#f59e0b", bg:"#fef3c7", text:"#92400e"},
  {id:"interesado",  label:"🟢 Interesado",         color:"#22c55e", bg:"#dcfce7", text:"#166534"},
  {id:"cotizado",    label:"💰 Cotización enviada", color:"#06b6d4", bg:"#cffafe", text:"#155e75"},
  {id:"compro",      label:"🏆 Compró",             color:"#8b5cf6", bg:"#ede9fe", text:"#5b21b6"},
  {id:"no_interes",  label:"🔴 No interesado",      color:"#ef4444", bg:"#fee2e2", text:"#991b1b"},
  {id:"competencia", label:"⚔️ Competencia",        color:"#f97316", bg:"#ffedd5", text:"#9a3412"},
  {id:"ilocalizable",label:"⚫ Ilocalizable",        color:"#6b7280", bg:"#f3f4f6", text:"#374151"},
];
const FM_SOAT = Object.fromEntries(FASES_SOAT.map(f=>[f.id,f]));
const MOTIVOS_SOAT = ["Precio muy alto","Ya compró con otra aseguradora","No tiene vehículo activo","No le interesa renovar aún","Prefiere pagar en oficina","Problemas económicos","No contestó / Buzón","Número equivocado","Otro"];
const ACCIONES_SOAT = ["Llamar en fecha acordada","Enviar cotización por WhatsApp","Esperar decisión del cliente","Llamar en 3 días","Llamar en 1 semana","No volver a contactar","Hacer seguimiento post-venta"];

let soatNid = Date.now();
const soatNewId = () => `s${++soatNid}`;
const soatEmpty = () => ({id: soatNewId(), nombre:"", telefono:"", placa:"", fechaCompra:"", fase:"pendiente", agente:"Sin asignar", intentos:0, proximaAccion:"", fechaProxima:"", motivoNoCompra:"", valorCotizado:"", grupoEnvio:"", historial:[], notas:""});

const parseDateSoat = (str) => { if(!str)return null; const s=str.trim(),p=s.split(/[-\/]/); if(p.length!==3)return null; try{return new Date(p[0].length===4?s:`${p[2]}-${p[1]}-${p[0]}`);}catch{return null;} };
const diasRenSoat = (fc) => { const f=parseDateSoat(fc); if(!f)return null; const r=new Date(f); r.setFullYear(r.getFullYear()+1); return Math.ceil((r-new Date())/86400000); };

const SoatPage = () => {
  const [clientes, setClientes] = useState(() => { try { const s=localStorage.getItem(SOAT_KEY); return s?JSON.parse(s):[]; } catch { return []; } });
  const [filtroFase, setFiltroFase] = useState("Todos");
  const [filtroAgente, setFiltroAgente] = useState("Todos");
  const [busqueda, setBusqueda] = useState("");
  const [modal, setModal] = useState(null);
  const [agentes, setAgentes] = useState(["Sin asignar","YELI","ENCARNACION","SANTIAGO","WEYMAR"]);
  const [nuevoAgente, setNuevoAgente] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const [activeTab, setActiveTab] = useState("info");
  const [callLog, setCallLog] = useState({resultado:"",motivo:"",proximaAccion:"",fechaProxima:"",nota:""});
  const fileRef = useRef();

  useEffect(() => { try { localStorage.setItem(SOAT_KEY, JSON.stringify(clientes)); } catch {} }, [clientes]);

  const updateC = (id, field, value) => {
    setClientes(p => p.map(c => c.id===id ? {...c,[field]:value} : c));
    if(modal?.id===id) setModal(p => ({...p,[field]:value}));
  };

  const openModal = (c) => { setModal(c); setActiveTab("info"); setCallLog({resultado:"",motivo:"",proximaAccion:"",fechaProxima:"",nota:""}); };

  const registrarLlamada = () => {
    if(!callLog.resultado) return;
    const entry = {fecha: new Date().toLocaleDateString("es-CO"), ...callLog, agente: modal.agente};
    const updated = {...modal, historial:[entry,...(modal.historial||[])], intentos:(modal.intentos||0)+1, fase:callLog.resultado, proximaAccion:callLog.proximaAccion||modal.proximaAccion, fechaProxima:callLog.fechaProxima||modal.fechaProxima, motivoNoCompra:callLog.motivo||modal.motivoNoCompra};
    setClientes(p => p.map(c => c.id===modal.id ? updated : c));
    setModal(updated); setCallLog({resultado:"",motivo:"",proximaAccion:"",fechaProxima:"",nota:""}); setActiveTab("historial");
  };

  const deleteC = (id) => { if(!confirm("¿Eliminar cliente?")) return; setClientes(p => p.filter(c => c.id!==id)); setModal(null); };
  const addCliente = () => { const c=soatEmpty(); setClientes(p=>[c,...p]); openModal(c); };

  const importCSV = (e) => {
    const file=e.target.files[0]; if(!file)return;
    const reader=new FileReader();
    reader.onload = ev => {
      const lines=ev.target.result.trim().split("\n");
      const hdr=lines[0].toLowerCase().replace(/\r/g,"").split(/[,;]/);
      const col=ks=>hdr.findIndex(h=>ks.some(p=>h.includes(p)));
      const iN=col(["nombre","name"]),iT=col(["tel","cel","phone"]);
      const iF=col(["ultima compra","fecha compra","fecha","date"]);
      const iP=col(["placa","plate"]),iA=col(["asignado","agente","agent"]);
      const iE=col(["estado","status"]),iV=col(["veces"]),iG=col(["grupo"]);
      if(iN===-1){setImportMsg("❌ No se encontró columna 'nombre'");return;}
      const fm={"interesado volver a llamar":"interesado","volver a llamar no contesto":"en_gestion","volver a llamar":"en_gestion","no interesado":"no_interes","cliente compro":"compro","ilocalizable":"ilocalizable"};
      const nuevos=lines.slice(1).filter(l=>l.trim()).map(line=>{
        const c=line.replace(/\r/g,"").split(/[,;]/);
        const er=(iE>=0?c[iE]?.trim():"").toLowerCase();
        return{...soatEmpty(),id:soatNewId(),nombre:c[iN]?.trim()||"",telefono:iT>=0?c[iT]?.trim():"",fechaCompra:iF>=0?c[iF]?.trim():"",placa:iP>=0?c[iP]?.trim():"",agente:iA>=0&&c[iA]?.trim()?c[iA].trim():"Sin asignar",fase:fm[er]||"pendiente",intentos:iV>=0?parseInt(c[iV])||0:0,grupoEnvio:iG>=0?c[iG]?.trim():""};
      }).filter(c=>c.nombre);
      setClientes(p=>[...p,...nuevos]);
      setImportMsg(`✅ ${nuevos.length} clientes importados`);
      setTimeout(()=>setImportMsg(""),4000);
    };
    reader.readAsText(file); e.target.value="";
  };

  const exportCSV = () => {
    const cols=["Nombre","Teléfono","Placa","Fecha Compra","Fase","Agente","Grupo Envío","Intentos","Próxima Acción","Fecha Próxima","Motivo No Compra","Valor Cotizado","Notas"];
    const rows=filtrados.map(c=>[c.nombre,c.telefono,c.placa,c.fechaCompra,FM_SOAT[c.fase]?.label||c.fase,c.agente,c.grupoEnvio||"",c.intentos,c.proximaAccion,c.fechaProxima,c.motivoNoCompra,c.valorCotizado,c.notas]);
    const csv=[cols,...rows].map(r=>r.map(v=>`"${(v||"").toString().replace(/"/g,'""')}"`).join(",")).join("\n");
    const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"})); a.download="soat-seguimiento.csv"; a.click();
  };

  const filtrados = clientes.filter(c => {
    const mF=filtroFase==="Todos"||c.fase===filtroFase;
    const mA=filtroAgente==="Todos"||c.agente===filtroAgente;
    const mB=!busqueda||c.nombre.toLowerCase().includes(busqueda.toLowerCase())||(c.telefono||"").includes(busqueda)||(c.placa||"").toLowerCase().includes(busqueda.toLowerCase());
    return mF&&mA&&mB;
  });

  const stats = {
    total:clientes.length,
    sinGestionar:clientes.filter(c=>c.intentos===0).length,
    enGestion:clientes.filter(c=>c.fase==="en_gestion"||c.fase==="pendiente").length,
    interesados:clientes.filter(c=>c.fase==="interesado"||c.fase==="cotizado").length,
    compro:clientes.filter(c=>c.fase==="compro").length,
    proximos30:clientes.filter(c=>{const d=diasRenSoat(c.fechaCompra);return d!==null&&d>=0&&d<=30;}).length,
  };

  const alertaHoy = clientes.filter(c => { if(!c.fechaProxima)return false; const d=parseDateSoat(c.fechaProxima); return d&&d<=new Date(); });

  const inpS = { background:"#f8faff", border:`1px solid ${BLUE.border}`, borderRadius:8, padding:"8px 11px", color:BLUE.text, fontSize:13, outline:"none", width:"100%", fontFamily:"inherit" };
  const lblS = { fontSize:11, color:"#6b87b0", textTransform:"uppercase", marginBottom:4, letterSpacing:"0.05em", display:"block" };
  const selS = { ...inpS, cursor:"pointer" };

  return (
    <div>
      {/* Header */}
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>Seguimiento Clientes SOAT</div>
          <div style={S.pageSub}>{clientes.length} clientes registrados</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={()=>fileRef.current.click()} style={S.btn("secondary")}><Icon name="upload" size={16}/>Importar CSV</button>
          <button onClick={exportCSV} style={S.btn("success")}><Icon name="download" size={16}/>Exportar CSV</button>
          <button onClick={addCliente} style={S.btn("primary")}><Icon name="plus" size={16}/>Nuevo Cliente</button>
          <input ref={fileRef} type="file" accept=".csv" onChange={importCSV} style={{display:"none"}}/>
        </div>
      </div>

      {/* Alertas */}
      {importMsg && <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"10px 14px",marginBottom:12,fontSize:13,color:"#16a34a"}}>{importMsg}</div>}
      {alertaHoy.length>0 && <div style={{background:"#fffbeb",border:"1px solid #fcd34d",borderRadius:8,padding:"10px 14px",marginBottom:12,fontSize:13,color:"#92400e"}}>🔔 <strong>{alertaHoy.length} cliente{alertaHoy.length>1?"s":""}</strong> con seguimiento pendiente para hoy o antes</div>}

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:10,marginBottom:18}}>
        {[
          {label:"Total",value:stats.total,color:BLUE.primary},
          {label:"Sin gestionar",value:stats.sinGestionar,color:"#f97316"},
          {label:"En gestión",value:stats.enGestion,color:"#f59e0b"},
          {label:"Interesados",value:stats.interesados,color:"#16a34a"},
          {label:"Compraron",value:stats.compro,color:"#8b5cf6"},
          {label:"Vencen ≤30d",value:stats.proximos30,color:"#dc2626"},
        ].map(s=>(
          <div key={s.label} style={{background:"#fff",border:`1px solid ${BLUE.border}`,borderRadius:12,padding:"14px 16px",boxShadow:"0 1px 4px rgba(26,86,219,0.07)"}}>
            <div style={{fontSize:22,fontWeight:700,color:s.color}}>{s.value}</div>
            <div style={{fontSize:11,color:"#6b87b0",marginTop:2}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filtro fases */}
      <div style={{display:"flex",gap:6,marginBottom:12,overflowX:"auto",paddingBottom:4}}>
        {[{id:"Todos",label:"Todos",color:"#6b7280"},...FASES_SOAT].map(f => {
          const cnt=f.id==="Todos"?clientes.length:clientes.filter(c=>c.fase===f.id).length;
          const active=filtroFase===f.id;
          return <button key={f.id} onClick={()=>setFiltroFase(f.id)}
            style={{background:active?f.color:"#fff",border:`1.5px solid ${active?f.color:BLUE.border}`,borderRadius:20,padding:"5px 14px",fontSize:12,color:active?"#fff":f.color||"#555",cursor:"pointer",whiteSpace:"nowrap",fontWeight:active?600:400}}>
            {f.label} ({cnt})
          </button>;
        })}
      </div>

      {/* Filtros */}
      <div style={{display:"flex",gap:10,marginBottom:14,alignItems:"center"}}>
        <div style={S.searchBar}><Icon name="search" size={16}/><input style={S.searchInput} placeholder="Buscar nombre, teléfono o placa..." value={busqueda} onChange={e=>setBusqueda(e.target.value)}/></div>
        <select value={filtroAgente} onChange={e=>setFiltroAgente(e.target.value)} style={{...S.select,width:"auto",padding:"7px 12px"}}>
          <option value="Todos">Todos los agentes</option>
          {agentes.map(a=><option key={a}>{a}</option>)}
        </select>
        <span style={{fontSize:12,color:"#6b87b0",whiteSpace:"nowrap"}}>{filtrados.length} registros</span>
      </div>

      {/* Tabla */}
      <div style={{...S.tableWrap,overflowX:"auto"}}>
        <div style={{minWidth:900}}>
          <div style={{...S.tableHead,display:"grid",gridTemplateColumns:"1.5fr 1fr 0.8fr 0.9fr 0.7fr 1.4fr 0.5fr 0.9fr 1.2fr 0.8fr 80px"}}>
            <span>Cliente</span><span>Teléfono</span><span>Placa</span><span>F. Compra</span><span>Renovación</span><span>Fase</span><span>Intentos</span><span>Agente</span><span>Próxima acción</span><span>Fecha próx.</span><span></span>
          </div>
          {filtrados.length===0
            ? <div style={{padding:40,textAlign:"center",color:"#aaa"}}>Sin registros. Importa un CSV o agrega clientes.</div>
            : filtrados.map(c => {
              const dias=diasRenSoat(c.fechaCompra);
              const fase=FM_SOAT[c.fase]||FASES_SOAT[0];
              const urgente=c.fechaProxima&&parseDateSoat(c.fechaProxima)<=new Date();
              return (
                <div key={c.id} style={{...S.tableRow,display:"grid",gridTemplateColumns:"1.5fr 1fr 0.8fr 0.9fr 0.7fr 1.4fr 0.5fr 0.9fr 1.2fr 0.8fr 80px"}}
                  onMouseEnter={e=>e.currentTarget.style.background=BLUE.light}
                  onMouseLeave={e=>e.currentTarget.style.background=""}>
                  <div style={{fontWeight:600,fontSize:13,cursor:"pointer",color:BLUE.primary}} onClick={()=>openModal(c)}>
                    {c.nombre||"—"}{c.historial?.length>0&&<span style={{marginLeft:6,fontSize:10,color:"#aaa"}}>💬{c.historial.length}</span>}
                  </div>
                  <div style={{fontSize:12.5,color:"#555"}}>{c.telefono||"—"}</div>
                  <div style={{fontSize:12.5,color:"#555"}}>{c.placa||"—"}</div>
                  <div style={{fontSize:12,color:"#555"}}>{c.fechaCompra||"—"}</div>
                  <div>{dias!==null?<span style={{fontSize:11,color:dias<0?"#dc2626":dias<=30?"#f97316":"#16a34a",background:dias<0?"#fee2e2":dias<=30?"#ffedd5":"#dcfce7",padding:"2px 8px",borderRadius:20,whiteSpace:"nowrap"}}>{dias<0?"Venció":dias===0?"Hoy":`${dias}d`}</span>:"—"}</div>
                  <select value={c.fase} onChange={e=>updateC(c.id,"fase",e.target.value)}
                    style={{fontSize:11,padding:"3px 7px",borderRadius:6,border:`1.5px solid ${fase.color}`,background:fase.bg,color:fase.text,cursor:"pointer",outline:"none",fontWeight:600,width:"100%"}}>
                    {FASES_SOAT.map(f=><option key={f.id} value={f.id}>{f.label}</option>)}
                  </select>
                  <div style={{textAlign:"center"}}>
                    <span style={{background:BLUE.light,borderRadius:20,padding:"2px 10px",fontSize:12,color:c.intentos>=3?"#dc2626":c.intentos>=1?"#f59e0b":"#aaa"}}>{c.intentos||0}</span>
                  </div>
                  <select value={c.agente} onChange={e=>updateC(c.id,"agente",e.target.value)}
                    style={{fontSize:11,padding:"3px 7px",borderRadius:6,border:`1px solid ${BLUE.border}`,background:"#fff",color:BLUE.text,cursor:"pointer",outline:"none",width:"100%"}}>
                    {agentes.map(a=><option key={a}>{a}</option>)}
                  </select>
                  <div style={{fontSize:11.5,color:"#555",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.proximaAccion||"—"}</div>
                  <div>{c.fechaProxima?<span style={{fontSize:11,color:urgente?"#dc2626":"#555",background:urgente?"#fee2e2":"transparent",padding:urgente?"2px 7px":"0",borderRadius:20}}>{urgente?"🔔 ":""}{c.fechaProxima}</span>:"—"}</div>
                  <button onClick={()=>openModal(c)} style={{...S.btn("secondary"),padding:"4px 10px",fontSize:12}}>Ver</button>
                </div>
              );
            })}
        </div>
      </div>

      {/* Agentes */}
      <div style={{marginTop:20,background:"#fff",border:`1px solid ${BLUE.border}`,borderRadius:12,padding:"14px 18px"}}>
        <div style={{fontWeight:600,marginBottom:10,color:"#6b87b0",fontSize:12,textTransform:"uppercase"}}>⚙️ Agentes comerciales</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          {agentes.slice(1).map(a=>(
            <div key={a} style={{background:BLUE.light,borderRadius:20,padding:"4px 12px",fontSize:12,display:"flex",gap:8,alignItems:"center",color:BLUE.text}}>
              {a} <span style={{cursor:"pointer",color:"#dc2626",fontWeight:700}} onClick={()=>setAgentes(p=>p.filter(x=>x!==a))}>×</span>
            </div>
          ))}
          <input value={nuevoAgente} onChange={e=>setNuevoAgente(e.target.value)} placeholder="Nuevo agente..."
            onKeyDown={e=>{if(e.key==="Enter"&&nuevoAgente.trim()){setAgentes(p=>[...p,nuevoAgente.trim()]);setNuevoAgente("");}}}
            style={{...S.input,width:140,padding:"5px 10px",fontSize:12}}/>
          <button onClick={()=>{if(nuevoAgente.trim()){setAgentes(p=>[...p,nuevoAgente.trim()]);setNuevoAgente("");}}} style={S.btn("secondary")}>+ Agregar</button>
        </div>
      </div>

      {/* Modal detalle */}
      {modal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16}} onClick={()=>setModal(null)}>
          <div style={{background:"#fff",borderRadius:18,width:"100%",maxWidth:640,maxHeight:"92vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:"20px 24px 0",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <div style={{fontWeight:700,fontSize:18,color:BLUE.text}}>{modal.nombre||"Nuevo cliente"}</div>
                <div style={{fontSize:12,color:"#888",marginTop:2}}>{modal.telefono}{modal.placa?` · ${modal.placa}`:""} · {modal.intentos||0} intento{modal.intentos!==1?"s":""}{modal.valorCotizado?` · $${modal.valorCotizado}`:""}</div>
              </div>
              <button onClick={()=>setModal(null)} style={{background:"transparent",border:"none",color:"#aaa",fontSize:22,cursor:"pointer"}}>×</button>
            </div>
            {/* Tabs */}
            <div style={{display:"flex",gap:0,padding:"14px 24px 0",borderBottom:`1px solid ${BLUE.border}`}}>
              {[["info","📋 Info"],["llamada","📞 Llamada"],["historial",`🕐 Historial (${modal.historial?.length||0})`]].map(([t,l])=>(
                <button key={t} onClick={()=>setActiveTab(t)}
                  style={{background:activeTab===t?BLUE.light:"transparent",border:"none",color:activeTab===t?BLUE.primary:"#aaa",borderRadius:"8px 8px 0 0",padding:"8px 16px",fontSize:13,cursor:"pointer",fontWeight:activeTab===t?600:400}}>
                  {l}
                </button>
              ))}
            </div>
            <div style={{padding:"20px 24px 24px"}}>
              {activeTab==="info" && (
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                    {[["Nombre","nombre"],["Teléfono","telefono"],["Placa","placa"],["Fecha de compra","fechaCompra"],["Valor cotizado ($)","valorCotizado"],["Grupo de envío","grupoEnvio"]].map(([l,f])=>(
                      <div key={f}>
                        <label style={lblS}>{l}</label>
                        <input value={modal[f]||""} onChange={e=>{updateC(modal.id,f,e.target.value);setModal(p=>({...p,[f]:e.target.value}));}} style={inpS}/>
                      </div>
                    ))}
                    <div>
                      <label style={lblS}>Fase actual</label>
                      <select value={modal.fase} onChange={e=>{updateC(modal.id,"fase",e.target.value);setModal(p=>({...p,fase:e.target.value}));}} style={selS}>
                        {FASES_SOAT.map(f=><option key={f.id} value={f.id}>{f.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={lblS}>Agente</label>
                      <select value={modal.agente} onChange={e=>{updateC(modal.id,"agente",e.target.value);setModal(p=>({...p,agente:e.target.value}));}} style={selS}>
                        {agentes.map(a=><option key={a}>{a}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={lblS}>Próxima acción</label>
                      <select value={modal.proximaAccion||""} onChange={e=>{updateC(modal.id,"proximaAccion",e.target.value);setModal(p=>({...p,proximaAccion:e.target.value}));}} style={selS}>
                        <option value="">Sin definir</option>
                        {ACCIONES_SOAT.map(a=><option key={a}>{a}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={lblS}>Fecha próximo contacto</label>
                      <input type="date" value={modal.fechaProxima||""} onChange={e=>{updateC(modal.id,"fechaProxima",e.target.value);setModal(p=>({...p,fechaProxima:e.target.value}));}} style={inpS}/>
                    </div>
                    <div style={{gridColumn:"1/-1"}}>
                      <label style={lblS}>Motivo no compra</label>
                      <select value={modal.motivoNoCompra||""} onChange={e=>{updateC(modal.id,"motivoNoCompra",e.target.value);setModal(p=>({...p,motivoNoCompra:e.target.value}));}} style={selS}>
                        <option value="">N/A</option>
                        {MOTIVOS_SOAT.map(m=><option key={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={lblS}>Notas generales</label>
                    <textarea value={modal.notas||""} onChange={e=>{updateC(modal.id,"notas",e.target.value);setModal(p=>({...p,notas:e.target.value}));}} rows={3} style={{...inpS,resize:"vertical"}}/>
                  </div>
                  <button onClick={()=>deleteC(modal.id)} style={{...S.btn("danger"),width:"100%",justifyContent:"center"}}>Eliminar cliente</button>
                </div>
              )}
              {activeTab==="llamada" && (
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  <div style={{background:BLUE.light,border:`1px solid ${BLUE.border}`,borderRadius:12,padding:16}}>
                    <div style={{fontSize:11,color:"#6b87b0",marginBottom:10,textTransform:"uppercase"}}>Intento #{(modal.intentos||0)+1} · Agente: {modal.agente}</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                      <div style={{gridColumn:"1/-1"}}>
                        <label style={lblS}>Resultado *</label>
                        <select value={callLog.resultado} onChange={e=>setCallLog(p=>({...p,resultado:e.target.value}))} style={selS}>
                          <option value="">Selecciona resultado...</option>
                          {FASES_SOAT.map(f=><option key={f.id} value={f.id}>{f.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={lblS}>Motivo no compra</label>
                        <select value={callLog.motivo} onChange={e=>setCallLog(p=>({...p,motivo:e.target.value}))} style={selS}>
                          <option value="">N/A</option>
                          {MOTIVOS_SOAT.map(m=><option key={m}>{m}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={lblS}>Próxima acción</label>
                        <select value={callLog.proximaAccion} onChange={e=>setCallLog(p=>({...p,proximaAccion:e.target.value}))} style={selS}>
                          <option value="">Sin definir</option>
                          {ACCIONES_SOAT.map(a=><option key={a}>{a}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={lblS}>Fecha próximo contacto</label>
                        <input type="date" value={callLog.fechaProxima} onChange={e=>setCallLog(p=>({...p,fechaProxima:e.target.value}))} style={inpS}/>
                      </div>
                      <div style={{gridColumn:"1/-1"}}>
                        <label style={lblS}>Nota de la llamada</label>
                        <textarea value={callLog.nota} onChange={e=>setCallLog(p=>({...p,nota:e.target.value}))} rows={2} placeholder="Ej: Cliente pide que lo llamen el martes..." style={{...inpS,resize:"vertical"}}/>
                      </div>
                    </div>
                  </div>
                  <button onClick={registrarLlamada} disabled={!callLog.resultado}
                    style={{...S.btn(callLog.resultado?"success":"secondary"),width:"100%",justifyContent:"center",opacity:callLog.resultado?1:0.4,cursor:callLog.resultado?"pointer":"not-allowed"}}>
                    ✅ Guardar registro de llamada
                  </button>
                </div>
              )}
              {activeTab==="historial" && (
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {(!modal.historial||modal.historial.length===0)&&<div style={{textAlign:"center",color:"#aaa",padding:30}}>Sin llamadas registradas aún.</div>}
                  {(modal.historial||[]).map((h,i)=>{
                    const f=FM_SOAT[h.resultado];
                    return(
                      <div key={i} style={{background:BLUE.light,border:`1px solid ${BLUE.border}`,borderRadius:10,padding:"12px 14px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                          <span style={{fontSize:12,fontWeight:600,color:f?.text||BLUE.text,background:f?.bg||BLUE.light,padding:"2px 10px",borderRadius:20}}>{f?.label||h.resultado}</span>
                          <span style={{fontSize:11,color:"#aaa"}}>{h.fecha} · {h.agente}</span>
                        </div>
                        {h.motivo&&<div style={{fontSize:12,color:"#888",marginBottom:3}}>📌 Motivo: {h.motivo}</div>}
                        {h.proximaAccion&&<div style={{fontSize:12,color:"#888",marginBottom:3}}>🗓 Acción: {h.proximaAccion}{h.fechaProxima?` · ${h.fechaProxima}`:""}</div>}
                        {h.nota&&<div style={{fontSize:12,color:"#555",fontStyle:"italic",marginTop:4}}>"{h.nota}"</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── ASEGURADORAS ─────────────────────────────────────────────────────────────
const AseguradorasPage = ({ aseguradoras, onAdd, onEdit, onDelete }) => {
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [delItem, setDelItem] = useState(null);
  const [form, setForm] = useState({ nombre: "", activo: true });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    if (editItem) { await onEdit({ ...editItem, ...form }); setEditItem(null); setShowForm(false); }
    else { await onAdd(form); setShowForm(false); setForm({ nombre: "", activo: true }); }
    setSaving(false);
  };

  return (
    <div>
      <div style={S.pageHeader}>
        <div><div style={S.pageTitle}>Aseguradoras</div><div style={S.pageSub}>{aseguradoras.length} aseguradoras configuradas</div></div>
        <button style={S.btn("primary")} onClick={() => { setShowForm(true); setEditItem(null); setForm({ nombre: "", activo: true }); }}>
          <Icon name="plus" size={16} />Nueva Aseguradora
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
        {aseguradoras.map(a => (
          <div key={a.id} style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 6px rgba(26,86,219,0.08)", border: `1px solid ${BLUE.border}`, borderTop: `3px solid ${BLUE.primary}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: BLUE.text }}>{a.nombre}</div>
              <div style={{ display: "flex", gap: 4 }}>
                <button style={S.btn("ghost")} onClick={() => { setEditItem(a); setForm({ nombre: a.nombre, activo: a.activo !== false }); setShowForm(true); }}><Icon name="edit" size={14} /></button>
                <button style={{ ...S.btn("ghost"), color: "#dc2626" }} onClick={() => setDelItem(a)}><Icon name="trash" size={14} /></button>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <span style={S.chip(a.activo !== false ? "#16a34a" : "#6b7280")}>{a.activo !== false ? "Activa" : "Inactiva"}</span>
            </div>
          </div>
        ))}
        {aseguradoras.length === 0 && <div style={{ color: "#aaa", fontSize: 13, padding: 20 }}>No hay aseguradoras. Agrega la primera.</div>}
      </div>

      {showForm && (
        <Modal title={editItem ? "Editar Aseguradora" : "Nueva Aseguradora"} onClose={() => { setShowForm(false); setEditItem(null); }}
          footer={<>
            <button style={S.btn("secondary")} onClick={() => { setShowForm(false); setEditItem(null); }}>Cancelar</button>
            <button style={{ ...S.btn("primary"), opacity: saving ? 0.6 : 1 }} onClick={handleSave} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>
          </>}>
          <div style={S.formGroup}><label style={S.label}>Nombre *</label><input style={S.input} value={form.nombre} onChange={e => set("nombre", e.target.value)} placeholder="Ej. Seguros del Estado" autoFocus /></div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={form.activo} onChange={e => set("activo", e.target.checked)} style={{ width: 16, height: 16, accentColor: BLUE.primary }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: BLUE.text }}>Aseguradora activa</span>
          </div>
        </Modal>
      )}

      {delItem && (
        <Modal title="Eliminar Aseguradora" onClose={() => setDelItem(null)}
          footer={<>
            <button style={S.btn("secondary")} onClick={() => setDelItem(null)}>Cancelar</button>
            <button style={S.btn("danger")} onClick={async () => { await onDelete(delItem.id); setDelItem(null); }}>Eliminar</button>
          </>}>
          <p style={{ fontSize: 14, color: "#555" }}>¿Eliminar <strong>{delItem.nombre}</strong>?</p>
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
  const [aseguradoras, setAseguradoras] = useState([]);
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
      const [{ data: rms }, { data: asgs }, { data: cls }, { data: ints }, { data: cots }, { data: pols }] = await Promise.all([
        supabase.from('ramos').select('*').order('nombre'),
        supabase.from('aseguradoras').select('*').order('nombre'),
        supabase.from('clientes').select('*').order('nombre'),
        supabase.from('interesados').select('*').order('created_at', { ascending: false }),
        supabase.from('cotizaciones').select('*').order('created_at', { ascending: false }),
        supabase.from('polizas').select('*').order('created_at', { ascending: false }),
      ]);
      if (rms) setRamos(rms);
      if (asgs) setAseguradoras(asgs);
      if (cls) setClientes(cls.map(c => ({ ...c, tipoDocumento: c.tipo_documento, tipoPersona: c.tipo_persona, nombreContacto: c.nombre_contacto, telefonoContacto: c.telefono_contacto })));
      if (ints) setInteresados(ints.map(mapInteresado));
      if (cots) setCotizaciones(cots.map(mapCotizacion));
      if (pols) setPolizas(pols.map(p => ({ ...mapPoliza(p), ramo: p.ramo, clienteNombre: p.cliente_nombre, clienteTelefono: p.cliente_telefono })));

      // Auto-crear cotizaciones para leads con envio_oficina=true que no tengan cotización
      if (ints && cots) {
        const leadsConEnvio = ints.filter(i => i.envio_oficina);
        const leadIdsConCot = new Set(cots.map(c => c.lead_id).filter(Boolean));
        const leadsHuerfanos = leadsConEnvio.filter(i => !leadIdsConCot.has(i.id));
        if (leadsHuerfanos.length > 0) {
          const nuevasCots = leadsHuerfanos.map(i => {
            const cliente = cls?.find(c => c.id === i.cliente_id);
            return {
              lead_id: i.id,
              cliente_nombre: i.nombre,
              cliente_telefono: cliente?.celular || cliente?.telefono || "",
              ramo: i.tipo_seguro,
              estado: "Pendiente",
              accion: "En Curso",
              fecha_cotizacion: today(),
            };
          });
          const { data: creadas } = await supabase.from('cotizaciones').insert(nuevasCots).select();
          if (creadas) setCotizaciones(prev => [...creadas.map(mapCotizacion), ...prev]);
        }
      }

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
    const { data, error } = await supabase.from('clientes').insert([{
      nombre: f.nombre, email: f.email, celular: f.celular || f.telefono, telefono: f.telefono,
      tipo_persona: f.tipoPersona, nombre_contacto: f.nombreContacto, telefono_contacto: f.telefonoContacto,
      documento: f.documento, tipo_documento: f.tipoDocumento, ciudad: f.ciudad, direccion: f.direccion,
      notas: f.notas
    }]).select().single();
    if (error) { console.error('addCliente error:', error); return; }
    if (data) setClientes(prev => [...prev, { ...data, tipoPersona: data.tipo_persona, nombreContacto: data.nombre_contacto, telefonoContacto: data.telefono_contacto, tipoDocumento: data.tipo_documento }]);
  };
  const editCliente = async (f) => {
    await supabase.from('clientes').update({
      nombre: f.nombre, email: f.email, celular: f.celular || f.telefono, telefono: f.telefono,
      tipo_persona: f.tipoPersona, nombre_contacto: f.nombreContacto, telefono_contacto: f.telefonoContacto,
      documento: f.documento, tipo_documento: f.tipoDocumento, ciudad: f.ciudad, direccion: f.direccion,
      notas: f.notas
    }).eq('id', f.id);
    setClientes(prev => prev.map(x => x.id === f.id ? { ...x, ...f, tipoPersona: f.tipoPersona, nombreContacto: f.nombreContacto, telefonoContacto: f.telefonoContacto, tipoDocumento: f.tipoDocumento } : x));
  };
  const deleteCliente = async (id) => {
    await supabase.from('clientes').delete().eq('id', id);
    setClientes(prev => prev.filter(x => x.id !== id));
  };

  // CRUD Interesados
  const addInteresado = async (f) => {
    const clienteNombre = clientes.find(c => c.id === f.clienteId)?.nombre || "";
    const { data, error } = await supabase.from('interesados').insert([{
      cliente_id: f.clienteId,
      nombre: clienteNombre,
      tipo_seguro: f.tipoSeguro,
      documentos_checklist: f.documentosChecklist || {},
      envio_oficina: f.envioOficina || false,
      notas: f.notas || "",
      estado: f.estado || "Lead",
      fecha_registro: f.fechaRegistro,
    }]).select().single();
    if (error) { console.error('addInteresado error:', error); return; }
    if (data) setInteresados(prev => [mapInteresado(data), ...prev]);
  };
  const editInteresado = async (f) => {
    const clienteNombre = clientes.find(c => c.id === f.clienteId)?.nombre || "";
    const cliente = clientes.find(c => c.id === f.clienteId);
    const { error } = await supabase.from('interesados').update({
      cliente_id: f.clienteId,
      nombre: clienteNombre,
      tipo_seguro: f.tipoSeguro,
      documentos_checklist: f.documentosChecklist || {},
      envio_oficina: f.envioOficina || false,
      notas: f.notas || "",
    }).eq('id', f.id);
    if (error) { console.error('editInteresado error:', error); return; }
    // Si tiene envioOficina marcado, verificar y crear cotización si no existe
    if (f.envioOficina) {
      try {
        const { data: existing } = await supabase.from('cotizaciones').select('*').eq('lead_id', f.id).limit(1);
        if (!existing || existing.length === 0) {
          const { data: cot, error: cotError } = await supabase.from('cotizaciones').insert([{
            lead_id: f.id,
            cliente_nombre: clienteNombre,
            cliente_telefono: cliente?.celular || cliente?.telefono || "",
            ramo: f.tipoSeguro,
            estado: "Pendiente",
            accion: "En Curso",
            fecha_cotizacion: today(),
          }]).select().single();
          if (cotError) console.error('Error creando cotización:', cotError);
          if (cot) setCotizaciones(prev => [mapCotizacion(cot), ...prev]);
        } else {
          // Ya existe — asegurarse que esté en el estado local
          setCotizaciones(prev => prev.some(c => c.id === existing[0].id) ? prev : [mapCotizacion(existing[0]), ...prev]);
        }
      } catch(e) { console.error('Excepción cotización:', e); }
    }
    setInteresados(prev => prev.map(x => x.id === f.id ? { ...x, clienteId: f.clienteId, nombre: clienteNombre, tipoSeguro: f.tipoSeguro, documentosChecklist: f.documentosChecklist, envioOficina: f.envioOficina, notas: f.notas } : x));
  };
  const deleteInteresado = async (id) => {
    await supabase.from('interesados').delete().eq('id', id);
    setInteresados(prev => prev.filter(x => x.id !== id));
  };

  // CRUD Cotizaciones
  const addCotizacion = async (f) => {
    const { data } = await supabase.from('cotizaciones').insert([{
      interesado_id: f.interesadoId, lead_id: f.leadId, agente_id: f.agenteId,
      cliente_nombre: f.clienteNombre, cliente_telefono: f.clienteTelefono,
      ramo: f.ramo, aseguradora: f.aseguradora, suma_asegurada: f.sumaAsegurada,
      prima: f.prima, iva: f.iva, gastos_expedicion: f.gastosExpedicion,
      numero_poliza: f.numeroPoliza, fecha_cotizacion: f.fechaCotizacion,
      notas: f.notas, estado: f.estado || "Pendiente", accion: f.accion || "En Curso",
    }]).select().single();
    if (data) setCotizaciones(prev => [mapCotizacion(data), ...prev]);
  };
  const editCotizacion = async (f) => {
    await supabase.from('cotizaciones').update({
      ramo: f.ramo, aseguradora: f.aseguradora, suma_asegurada: f.sumaAsegurada,
      prima: f.prima, iva: f.iva, gastos_expedicion: f.gastosExpedicion,
      numero_poliza: f.numeroPoliza, fecha_cotizacion: f.fechaCotizacion,
      notas: f.notas, estado: f.estado, accion: f.accion,
      numero_poliza_emitida: f.numeroPolizaEmitida,
      aseguradora_emitida: f.aseguradoraEmitida,
      prima_emitida: f.primaEmitida, iva_emitida: f.ivaEmitida,
      gastos_emitida: f.gastosEmitida, total_pago_emitida: f.totalPagoEmitida,
    }).eq('id', f.id);
    setCotizaciones(prev => prev.map(x => x.id === f.id ? { ...x, ...f } : x));

    // Si se marcó como Póliza Emitida y tiene número de póliza, crear en tabla polizas
    if (f.accion === "Póliza Emitida" && f.numeroPolizaEmitida) {
      const yaExiste = polizas.some(p => p.cotizacionId === f.id);
      if (!yaExiste) {
        const vigenciaInicio = today();
        const vigenciaFin = (() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString().split("T")[0]; })();
        const { data: pol, error } = await supabase.from('polizas').insert([{
          cotizacion_id: f.id,
          cliente_nombre: f.clienteNombre,
          cliente_telefono: f.clienteTelefono,
          numero: f.numeroPolizaEmitida,
          ramo: f.ramo,
          aseguradora: f.aseguradoraEmitida,
          prima: f.primaEmitida,
          iva: f.ivaEmitida,
          gastos_expedicion: f.gastosEmitida,
          total_pago: f.totalPagoEmitida,
          fecha_emision: today(),
          vigencia_inicio: vigenciaInicio,
          vigencia_fin: vigenciaFin,
          estado: "Activa",
        }]).select().single();
        if (error) console.error('Error creando póliza:', error);
        if (pol) setPolizas(prev => [{ ...mapPoliza(pol), clienteNombre: pol.cliente_nombre, clienteTelefono: pol.cliente_telefono }, ...prev]);
      }
    }
  };

  // Emitir póliza desde cotización
  const emitirPoliza = async ({ cotizacion, interesado, fechaEmision, vigenciaInicio, vigenciaFin, ramoId, notas }) => {
    const ramo = ramos.find(r => r.id === ramoId);
    const cliente = clientes.find(c => c.id === interesado?.clienteId || c.id === interesado?.cliente_id);
    const telefono = cliente?.celular || cliente?.telefono || interesado?.telefono || "";
    const { data } = await supabase.from('polizas').insert([{
      cotizacion_id: cotizacion.id,
      cliente_id: interesado?.id,
      cliente_nombre: interesado?.nombre,
      cliente_telefono: telefono,
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
    const { data } = await supabase.from('ramos').insert([{ nombre: r.nombre, descripcion: r.descripcion, activo: r.activo, documentos: r.documentos || {} }]).select().single();
    if (data) setRamos(prev => [...prev, data]);
  };
  const editRamo = async (r) => {
    await supabase.from('ramos').update({ nombre: r.nombre, descripcion: r.descripcion, activo: r.activo, documentos: r.documentos || {} }).eq('id', r.id);
    setRamos(prev => prev.map(x => x.id === r.id ? { ...x, ...r } : x));
  };
  const deleteRamo = async (id) => {
    await supabase.from('ramos').delete().eq('id', id);
    setRamos(prev => prev.filter(x => x.id !== id));
  };

  const addAseguradora = async (a) => {
    const { data } = await supabase.from('aseguradoras').insert([{ nombre: a.nombre, activo: a.activo }]).select().single();
    if (data) setAseguradoras(prev => [...prev, data].sort((a,b) => a.nombre.localeCompare(b.nombre)));
  };
  const editAseguradora = async (a) => {
    await supabase.from('aseguradoras').update({ nombre: a.nombre, activo: a.activo }).eq('id', a.id);
    setAseguradoras(prev => prev.map(x => x.id === a.id ? { ...x, ...a } : x));
  };
  const deleteAseguradora = async (id) => {
    await supabase.from('aseguradoras').delete().eq('id', id);
    setAseguradoras(prev => prev.filter(x => x.id !== id));
  };

  const deletePoliza = async (id) => {
    await supabase.from('polizas').delete().eq('id', id);
    setPolizas(prev => prev.filter(x => x.id !== id));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setLoggedIn(false); setAgentes([]); setRamos([]); setClientes([]); setInteresados([]); setCotizaciones([]); setPolizas([]);
    setUserRol(ROL_AGENTE); setAgenteActualId(null);
  };

  if (!loggedIn) return <><FontLoader /><LoginPage onLogin={handleLogin} /></>;
  if (loading) return <><FontLoader /><LoadingScreen /></>;

  const handleNav = (p) => {
    if (p === "ramos" && !esAdmin(userRol)) return;
    setPage(p);
  };

  const importPolizas = async (rows) => {
    const inserts = rows.map(r => ({
      numero: r.numero,
      cliente_nombre: r.clienteNombre,
      cliente_telefono: r.clienteTelefono,
      ramo: r.ramo,
      aseguradora: r.aseguradora,
      prima: r.prima,
      iva: r.iva,
      gastos_expedicion: r.gastosExpedicion,
      total_pago: r.totalPago,
      fecha_emision: r.fechaEmision,
      vigencia_inicio: r.vigenciaInicio,
      vigencia_fin: r.vigenciaFin,
      estado: "Activa",
    }));
    const BATCH = 50;
    let imported = [];
    for (let i = 0; i < inserts.length; i += BATCH) {
      const { data, error } = await supabase.from('polizas').insert(inserts.slice(i, i + BATCH)).select();
      if (error) throw error;
      if (data) imported = imported.concat(data);
    }
    setPolizas(prev => [...imported.map(p => ({ ...mapPoliza(p), ramo: p.ramo, clienteNombre: p.cliente_nombre, clienteTelefono: p.cliente_telefono })), ...prev]);
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
        return <CotizacionesPage cotizaciones={cotizaciones} interesados={interesados} polizas={polizas} agentes={agentes} ramos={ramos.filter(r => r.activo !== false)} aseguradoras={aseguradoras} onAddCotizacion={addCotizacion} onEditCotizacion={editCotizacion} onEmitirPoliza={emitirPoliza} userRol={userRol} agenteActualId={agenteActualId} />;
      case "polizas":
        return <PolizasPage polizas={polizas} interesados={interesados} ramos={ramos} aseguradoras={aseguradoras} onDelete={deletePoliza} userRol={userRol} agenteActualId={agenteActualId} />;
      case "renovaciones":
        return <RenovacionesPage polizas={polizas} userRol={userRol} agenteActualId={agenteActualId} onImportPolizas={importPolizas} onUpdatePoliza={(id, changes) => setPolizas(prev => prev.map(p => p.id === id ? { ...p, ...changes } : p))} />;
      case "soat":
        return <SoatPage />;
      case "reportes":
        return <ReportesPage polizas={polizas} ramos={ramos} clientes={clientes} />;
      case "ramos":
        return esAdmin(userRol) ? <RamosPage ramos={ramos} onAdd={addRamo} onEdit={editRamo} onDelete={deleteRamo} /> : null;
      case "aseguradoras":
        return esAdmin(userRol) ? <AseguradorasPage aseguradoras={aseguradoras} onAdd={addAseguradora} onEdit={editAseguradora} onDelete={deleteAseguradora} /> : null;
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
