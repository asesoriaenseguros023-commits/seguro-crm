import { useState, useEffect, useMemo } from "react";
import { supabase } from './supabase.js';

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
const fmtDate = (s) => { if (!s) return "—"; const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; };
const diasParaVencer = (fechaFin) => {
  const fin = new Date(fechaFin + "T00:00:00");
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  return Math.round((fin - hoy) / 86400000);
};
const estadoColor = (e) => ({ Activa: "#16a34a", Vencida: "#dc2626", Cancelada: "#6b7280" }[e] || "#6b7280");
const tipoColor = (t) => ({ Auto: "#2563eb", Vida: "#7c3aed", GMM: "#0891b2", Hogar: "#d97706", RC: "#be185d" }[t] || "#6b7280");

// Mappers Supabase → app (snake_case → camelCase)
const mapCliente = (c) => ({ ...c, agenteId: c.agente_id, fechaAlta: c.fecha_alta });
const mapPoliza = (p) => ({ ...p, clienteId: p.cliente_id, agenteId: p.agente_id, sumaAsegurada: p.suma_asegurada, vigenciaInicio: p.vigencia_inicio, vigenciaFin: p.vigencia_fin });

// Roles
const ROL_ADMIN  = "Admin";
const ROL_AGENTE = "Agente";
const esAdmin = (rol) => rol === ROL_ADMIN;

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
  };
  return (
    <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d={paths[name]} />
    </svg>
  );
};

// ─── STYLES ──────────────────────────────────────────────────────────────────
const S = {
  app: { display: "flex", minHeight: "100vh", background: "#f0ede8", fontFamily: "'DM Sans', sans-serif", color: "#1a1a1a" },
  sidebar: { width: 220, background: "#0f1117", display: "flex", flexDirection: "column", flexShrink: 0, position: "sticky", top: 0, height: "100vh", overflowY: "auto" },
  main: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 },
  topbar: { background: "#fff", borderBottom: "1px solid #e5e0d8", padding: "0 28px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 },
  content: { flex: 1, padding: "28px 32px", overflowY: "auto" },
  sbLogo: { padding: "20px 20px 8px", borderBottom: "1px solid rgba(255,255,255,0.07)" },
  sbLogoText: { fontFamily: "'Instrument Serif', serif", fontSize: 20, color: "#fff", letterSpacing: -0.5 },
  sbLogoSub: { fontSize: 10, color: "#6b7180", fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 2 },
  sbNav: { flex: 1, padding: "12px 10px" },
  sbItem: (active) => ({ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, cursor: "pointer", marginBottom: 2, transition: "all 0.15s", background: active ? "rgba(59,130,246,0.15)" : "transparent", color: active ? "#7aa3ff" : "#9ca3af", fontSize: 13.5, fontWeight: active ? 600 : 400 }),
  sbBottom: { padding: "12px 10px", borderTop: "1px solid rgba(255,255,255,0.07)" },
  sbUser: { display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, cursor: "pointer", color: "#9ca3af", fontSize: 13 },
  sbAvatar: { width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0 },
  pageHeader: { marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 },
  pageTitle: { fontFamily: "'Instrument Serif', serif", fontSize: 28, fontWeight: 400, letterSpacing: -0.5, color: "#0f1117" },
  pageSub: { fontSize: 13, color: "#888", marginTop: 2 },
  statGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px,1fr))", gap: 14, marginBottom: 24 },
  statCard: (accent) => ({ background: "#fff", borderRadius: 12, padding: "20px 22px", borderLeft: `3px solid ${accent}`, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }),
  statNum: { fontSize: 28, fontFamily: "'Instrument Serif', serif", color: "#0f1117", letterSpacing: -1 },
  statLabel: { fontSize: 12, color: "#888", fontWeight: 500, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  tableWrap: { background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" },
  tableHead: { display: "grid", background: "#f8f7f5", borderBottom: "1px solid #ece9e3", padding: "10px 18px", fontSize: 11, fontWeight: 700, color: "#888", letterSpacing: 0.8, textTransform: "uppercase" },
  tableRow: { display: "grid", padding: "13px 18px", borderBottom: "1px solid #f0ede8", alignItems: "center", fontSize: 13.5, transition: "background 0.12s" },
  badge: (color) => ({ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 600, background: color + "18", color }),
  btn: (variant = "primary") => ({ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: "pointer", border: "none", transition: "all 0.15s", ...(variant === "primary" ? { background: "#1a4fdb", color: "#fff" } : {}), ...(variant === "secondary" ? { background: "#f0ede8", color: "#1a1a1a", border: "1px solid #ddd9d2" } : {}), ...(variant === "danger" ? { background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" } : {}), ...(variant === "ghost" ? { background: "transparent", color: "#555", padding: "6px 10px" } : {}) }),
  input: { width: "100%", border: "1px solid #ddd9d2", borderRadius: 8, padding: "9px 12px", fontSize: 13.5, color: "#1a1a1a", background: "#fff", outline: "none", fontFamily: "inherit" },
  label: { fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 5, display: "block", textTransform: "uppercase", letterSpacing: 0.5 },
  formGroup: { marginBottom: 16 },
  select: { width: "100%", border: "1px solid #ddd9d2", borderRadius: 8, padding: "9px 12px", fontSize: 13.5, color: "#1a1a1a", background: "#fff", outline: "none", fontFamily: "inherit" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 },
  modal: { background: "#fff", borderRadius: 14, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" },
  modalHeader: { padding: "20px 24px 16px", borderBottom: "1px solid #ece9e3", display: "flex", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { fontFamily: "'Instrument Serif', serif", fontSize: 20 },
  modalBody: { padding: "20px 24px" },
  modalFooter: { padding: "14px 24px", borderTop: "1px solid #ece9e3", display: "flex", justifyContent: "flex-end", gap: 10 },
  searchBar: { display: "flex", alignItems: "center", gap: 8, background: "#f8f7f5", border: "1px solid #ece9e3", borderRadius: 8, padding: "7px 12px", flex: 1, maxWidth: 320 },
  searchInput: { border: "none", background: "transparent", fontSize: 13.5, color: "#1a1a1a", outline: "none", width: "100%", fontFamily: "inherit" },
  chip: (color) => ({ padding: "2px 9px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: color + "18", color, display: "inline-block" }),
  alertBox: (color) => ({ background: color + "12", border: `1px solid ${color}30`, borderRadius: 10, padding: "12px 16px", display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 16 }),
};

// ─── FONT LOADER ─────────────────────────────────────────────────────────────
const FontLoader = () => {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap";
    document.head.appendChild(link);
  }, []);
  return null;
};

// ─── LOADING SCREEN ───────────────────────────────────────────────────────────
const LoadingScreen = () => (
  <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0ede8", fontFamily: "'DM Sans', sans-serif" }}>
    <div style={{ textAlign: "center" }}>
      <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 28, color: "#0f1117", marginBottom: 8 }}>SeguroCRM</div>
      <div style={{ fontSize: 13, color: "#aaa" }}>Cargando datos…</div>
    </div>
  </div>
);

// ─── MODAL ───────────────────────────────────────────────────────────────────
const Modal = ({ title, onClose, children, footer }) => (
  <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
    <div style={S.modal}>
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
const LoginPage = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !pass) { setError("Ingresa tu correo y contraseña."); return; }
    setLoading(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (err) { setError("Credenciales incorrectas. Verifica tu correo y contraseña."); setLoading(false); }
    else { onLogin(); }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f1117", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ marginBottom: 36, textAlign: "center" }}>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 34, color: "#fff", letterSpacing: -1 }}>SeguroCRM</div>
          <div style={{ fontSize: 12, color: "#6b7180", fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginTop: 4 }}>Sistema de Gestión de Clientes</div>
        </div>
        <div style={{ background: "#1a1d27", borderRadius: 16, padding: 32, border: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={S.formGroup}>
            <label style={{ ...S.label, color: "#9ca3af" }}>Correo Electrónico</label>
            <input style={{ ...S.input, background: "#0f1117", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
              type="email" value={email} onChange={e => { setEmail(e.target.value); setError(""); }}
              placeholder="correo@empresa.com" />
          </div>
          <div style={S.formGroup}>
            <label style={{ ...S.label, color: "#9ca3af" }}>Contraseña</label>
            <input style={{ ...S.input, background: "#0f1117", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
              type="password" value={pass} onChange={e => { setPass(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="••••••••" />
          </div>
          {error && <div style={{ background: "#fef2f2", color: "#dc2626", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>{error}</div>}
          <button style={{ ...S.btn("primary"), width: "100%", justifyContent: "center", padding: "11px 16px", fontSize: 15, opacity: loading ? 0.7 : 1 }}
            onClick={handleLogin} disabled={loading}>
            {loading ? "Iniciando sesión…" : "Iniciar Sesión"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────
const Sidebar = ({ current, onNav, onLogout, userName, userRol }) => {
  const itemsComunes = [
    { id: "dashboard",    label: "Dashboard",   icon: "dashboard" },
    { id: "clientes",     label: "Clientes",    icon: "users"     },
    { id: "polizas",      label: "Pólizas",     icon: "document"  },
    { id: "renovaciones", label: "Renovaciones",icon: "bell"      },
  ];
  const itemsAdmin = [
    { id: "configuracion", label: "Configuración", icon: "shield" },
  ];
  const items = esAdmin(userRol) ? [...itemsComunes, ...itemsAdmin] : itemsComunes;
  const initials = userName ? userName.split(" ").slice(0, 2).map(w => w[0]).join("") : "U";
  return (
    <div style={S.sidebar}>
      <div style={S.sbLogo}>
        <div style={S.sbLogoText}>SeguroCRM</div>
        <div style={S.sbLogoSub}>Aseguradora</div>
      </div>
      <div style={S.sbNav}>
        {items.map(i => (
          <div key={i.id} style={S.sbItem(current === i.id)} onClick={() => onNav(i.id)}>
            <Icon name={i.icon} size={16} />{i.label}
          </div>
        ))}
      </div>
      <div style={S.sbBottom}>
        {/* Badge de rol */}
        <div style={{ padding: "4px 12px 10px" }}>
          <span style={{ ...S.chip(esAdmin(userRol) ? "#7c3aed" : "#2563eb"), fontSize: 11 }}>
            {userRol || "Agente"}
          </span>
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
  const labels = { dashboard: "Dashboard", clientes: "Clientes", polizas: "Pólizas", renovaciones: "Renovaciones", configuracion: "Configuración" };
  return (
    <div style={S.topbar}>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#555" }}>{labels[page]}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: "#888" }}>
        <span style={S.chip(esAdmin(userRol) ? "#7c3aed" : "#2563eb")}>{userRol}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a" }} />
          Sistema en línea
        </div>
      </div>
    </div>
  );
};

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
const Dashboard = ({ clientes, polizas, userName, onNav }) => {
  const activas = polizas.filter(p => p.estado === "Activa");
  const vencidas = polizas.filter(p => p.estado === "Vencida");
  const primaTotal = activas.reduce((s, p) => s + Number(p.prima), 0);
  const proxVencer = polizas.filter(p => p.estado === "Activa" && diasParaVencer(p.vigenciaFin) <= 30 && diasParaVencer(p.vigenciaFin) >= 0);
  const urgentes = proxVencer.filter(p => diasParaVencer(p.vigenciaFin) <= 7);

  return (
    <div>
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>Bienvenido, {userName?.split(" ")[0] || "usuario"}</div>
          <div style={S.pageSub}>Resumen de tu cartera al día de hoy</div>
        </div>
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

      <div style={S.statGrid}>
        <div style={S.statCard("#2563eb")}><div style={S.statNum}>{clientes.length}</div><div style={S.statLabel}>Clientes Totales</div></div>
        <div style={S.statCard("#16a34a")}><div style={S.statNum}>{activas.length}</div><div style={S.statLabel}>Pólizas Activas</div></div>
        <div style={S.statCard("#dc2626")}><div style={S.statNum}>{vencidas.length}</div><div style={S.statLabel}>Pólizas Vencidas</div></div>
        <div style={S.statCard("#d97706")}><div style={S.statNum}>{proxVencer.length}</div><div style={S.statLabel}>Por Vencer (30 días)</div></div>
        <div style={S.statCard("#7c3aed")}><div style={S.statNum}>{fmt(primaTotal)}</div><div style={S.statLabel}>Prima Total Activa</div></div>
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: "#888", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 12 }}>Renovaciones Urgentes</div>
      <div style={S.tableWrap}>
        {proxVencer.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", color: "#aaa", fontSize: 14 }}>No hay pólizas por vencer en los próximos 30 días. ✅</div>
        ) : (
          <>
            <div style={{ ...S.tableHead, gridTemplateColumns: "1.5fr 1fr 1fr 1fr 80px" }}>
              <span>Póliza / Cliente</span><span>Tipo</span><span>Vence</span><span>Prima</span><span>Días</span>
            </div>
            {proxVencer.sort((a, b) => diasParaVencer(a.vigenciaFin) - diasParaVencer(b.vigenciaFin)).map(p => {
              const cliente = clientes.find(c => c.id === p.clienteId);
              const dias = diasParaVencer(p.vigenciaFin);
              return (
                <div key={p.id} style={{ ...S.tableRow, gridTemplateColumns: "1.5fr 1fr 1fr 1fr 80px" }}>
                  <div><div style={{ fontWeight: 600, fontSize: 13 }}>{p.numero}</div><div style={{ color: "#888", fontSize: 12 }}>{cliente?.nombre}</div></div>
                  <span style={S.chip(tipoColor(p.tipo))}>{p.tipo}</span>
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

// ─── FORM CLIENTE ─────────────────────────────────────────────────────────────
const ClienteForm = ({ initial, agentes, onSave, onClose }) => {
  const [form, setForm] = useState(initial || { nombre: "", email: "", telefono: "", rfc: "", domicilio: "", agenteId: agentes[0]?.id || "", notas: "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.nombre && form.email;

  const handleSave = async () => { setSaving(true); await onSave(form); setSaving(false); };

  return (
    <Modal title={initial?.id ? "Editar Cliente" : "Nuevo Cliente"} onClose={onClose}
      footer={<><button style={S.btn("secondary")} onClick={onClose}>Cancelar</button><button style={{ ...S.btn("primary"), opacity: valid && !saving ? 1 : 0.5 }} onClick={handleSave} disabled={!valid || saving}>{saving ? "Guardando…" : "Guardar Cliente"}</button></>}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
        <div style={{ ...S.formGroup, gridColumn: "1/-1" }}><label style={S.label}>Nombre Completo *</label><input style={S.input} value={form.nombre} onChange={e => set("nombre", e.target.value)} placeholder="Ej. Juan Pérez García" /></div>
        <div style={S.formGroup}><label style={S.label}>Correo *</label><input style={S.input} type="email" value={form.email} onChange={e => set("email", e.target.value)} /></div>
        <div style={S.formGroup}><label style={S.label}>Teléfono</label><input style={S.input} value={form.telefono} onChange={e => set("telefono", e.target.value)} placeholder="55 1234 5678" /></div>
        <div style={S.formGroup}><label style={S.label}>RFC</label><input style={S.input} value={form.rfc} onChange={e => set("rfc", e.target.value)} placeholder="XXXX######ABC" /></div>
        <div style={S.formGroup}><label style={S.label}>Agente</label>
          <select style={S.select} value={form.agenteId} onChange={e => set("agenteId", e.target.value)}>
            {agentes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select></div>
        <div style={{ ...S.formGroup, gridColumn: "1/-1" }}><label style={S.label}>Domicilio</label><input style={S.input} value={form.domicilio} onChange={e => set("domicilio", e.target.value)} /></div>
        <div style={{ ...S.formGroup, gridColumn: "1/-1" }}><label style={S.label}>Notas</label><textarea style={{ ...S.input, minHeight: 70, resize: "vertical" }} value={form.notas} onChange={e => set("notas", e.target.value)} /></div>
      </div>
    </Modal>
  );
};

// ─── CLIENTES ─────────────────────────────────────────────────────────────────
const ClientesPage = ({ clientes, polizas, agentes, onAdd, onEdit, onDelete, onSelectCliente, userRol, agenteActualId }) => {
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [delItem, setDelItem] = useState(null);

  // Agente solo ve sus propios clientes
  const clientesFiltradosPorRol = esAdmin(userRol)
    ? clientes
    : clientes.filter(c => c.agenteId === agenteActualId);

  const filtered = useMemo(() => clientesFiltradosPorRol.filter(c =>
    !q ||
    c.nombre?.toLowerCase().includes(q.toLowerCase()) ||
    c.email?.toLowerCase().includes(q.toLowerCase()) ||
    c.rfc?.toLowerCase().includes(q.toLowerCase())
  ), [clientesFiltradosPorRol, q]);

  const handleSave = async (form) => {
    if (editItem) { await onEdit({ ...editItem, ...form }); setEditItem(null); }
    else { await onAdd(form); setShowForm(false); }
  };

  return (
    <div>
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>Clientes</div>
          <div style={S.pageSub}>
            {esAdmin(userRol)
              ? `${clientes.length} asegurados registrados en total`
              : `${clientesFiltradosPorRol.length} clientes asignados a ti`}
          </div>
        </div>
        <button style={S.btn("primary")} onClick={() => setShowForm(true)}><Icon name="plus" size={16} />Nuevo Cliente</button>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div style={S.searchBar}><Icon name="search" size={16} /><input style={S.searchInput} placeholder="Buscar por nombre, email, RFC…" value={q} onChange={e => setQ(e.target.value)} /></div>
      </div>
      <div style={S.tableWrap}>
        <div style={{ ...S.tableHead, gridTemplateColumns: esAdmin(userRol) ? "1.8fr 1.2fr 1fr 80px 90px" : "1.8fr 1.4fr 1fr 90px" }}>
          <span>Cliente</span><span>Contacto</span>
          {esAdmin(userRol) && <span>Agente</span>}
          <span>Pólizas</span><span>Acciones</span>
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#aaa" }}>No se encontraron clientes</div>
        ) : filtered.map(c => {
          const agt = agentes.find(a => a.id === c.agenteId);
          const nPol = polizas.filter(p => p.clienteId === c.id && p.estado === "Activa").length;
          return (
            <div key={c.id}
              style={{ ...S.tableRow, gridTemplateColumns: esAdmin(userRol) ? "1.8fr 1.2fr 1fr 80px 90px" : "1.8fr 1.4fr 1fr 90px" }}
              onMouseEnter={e => e.currentTarget.style.background = "#fafaf8"}
              onMouseLeave={e => e.currentTarget.style.background = ""}>
              <div style={{ cursor: "pointer" }} onClick={() => onSelectCliente(c)}>
                <div style={{ fontWeight: 600 }}>{c.nombre}</div>
                <div style={{ fontSize: 11.5, color: "#999" }}>Alta: {fmtDate(c.fechaAlta)}</div>
              </div>
              <div><div style={{ fontSize: 13 }}>{c.email}</div><div style={{ fontSize: 12, color: "#888" }}>{c.telefono}</div></div>
              {esAdmin(userRol) && <div style={{ fontSize: 13 }}>{agt?.nombre || "—"}</div>}
              <span style={S.chip("#2563eb")}>{nPol} activa{nPol !== 1 ? "s" : ""}</span>
              <div style={{ display: "flex", gap: 4 }}>
                <button style={S.btn("ghost")} onClick={() => setEditItem(c)}><Icon name="edit" size={15} /></button>
                {esAdmin(userRol) && (
                  <button style={{ ...S.btn("ghost"), color: "#dc2626" }} onClick={() => setDelItem(c)}><Icon name="trash" size={15} /></button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {(showForm || editItem) && (
        <ClienteForm
          initial={editItem}
          agentes={esAdmin(userRol) ? agentes : agentes.filter(a => a.id === agenteActualId)}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditItem(null); }}
        />
      )}
      {delItem && esAdmin(userRol) && (
        <Modal title="Confirmar eliminación" onClose={() => setDelItem(null)}
          footer={<><button style={S.btn("secondary")} onClick={() => setDelItem(null)}>Cancelar</button><button style={S.btn("danger")} onClick={async () => { await onDelete(delItem.id); setDelItem(null); }}>Eliminar</button></>}>
          <p style={{ fontSize: 14, color: "#555" }}>¿Eliminar a <strong>{delItem.nombre}</strong>? Esta acción no se puede deshacer.</p>
        </Modal>
      )}
    </div>
  );
};

// ─── DETALLE CLIENTE ──────────────────────────────────────────────────────────
const ClienteDetalle = ({ cliente, polizas, agentes, onBack }) => {
  const agt = agentes.find(a => a.id === cliente.agenteId);
  const pols = polizas.filter(p => p.clienteId === cliente.id);
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <button style={{ ...S.btn("secondary"), fontSize: 13 }} onClick={onBack}>← Volver a Clientes</button>
      </div>
      <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg,#2563eb,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 22, fontFamily: "'Instrument Serif', serif", flexShrink: 0 }}>{cliente.nombre?.[0]}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 24 }}>{cliente.nombre}</div>
            <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>{cliente.email} · {cliente.telefono}</div>
            {cliente.rfc && <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>RFC: {cliente.rfc}</div>}
            {cliente.domicilio && <div style={{ fontSize: 12.5, color: "#666", marginTop: 6 }}>{cliente.domicilio}</div>}
            {cliente.notas && <div style={{ marginTop: 12, padding: "10px 14px", background: "#f8f7f5", borderRadius: 8, fontSize: 13, color: "#555" }}>{cliente.notas}</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#aaa" }}>Agente asignado</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#333", marginTop: 2 }}>{agt?.nombre || "—"}</div>
            <div style={{ fontSize: 11, color: "#aaa", marginTop: 8 }}>Alta: {fmtDate(cliente.fechaAlta)}</div>
          </div>
        </div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#888", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 12 }}>Pólizas del Cliente ({pols.length})</div>
      <div style={S.tableWrap}>
        {pols.length === 0 ? <div style={{ padding: 32, textAlign: "center", color: "#aaa" }}>Sin pólizas registradas.</div> :
          <><div style={{ ...S.tableHead, gridTemplateColumns: "1.2fr 0.8fr 1fr 1fr 1fr 0.9fr" }}><span>Número</span><span>Tipo</span><span>Vigencia</span><span>Suma Asegurada</span><span>Prima</span><span>Estado</span></div>
            {pols.map(p => (
              <div key={p.id} style={{ ...S.tableRow, gridTemplateColumns: "1.2fr 0.8fr 1fr 1fr 1fr 0.9fr" }}>
                <div><div style={{ fontWeight: 600 }}>{p.numero}</div><div style={{ fontSize: 11.5, color: "#999" }}>{p.aseguradora}</div></div>
                <span style={S.chip(tipoColor(p.tipo))}>{p.tipo}</span>
                <div style={{ fontSize: 13 }}>{fmtDate(p.vigenciaInicio)} – {fmtDate(p.vigenciaFin)}</div>
                <div style={{ fontSize: 13 }}>{fmt(p.sumaAsegurada)}</div>
                <div style={{ fontSize: 13 }}>{fmt(p.prima)}</div>
                <span style={S.badge(estadoColor(p.estado))}><div style={{ width: 6, height: 6, borderRadius: "50%", background: estadoColor(p.estado) }} />{p.estado}</span>
              </div>
            ))}</>}
      </div>
    </div>
  );
};

// ─── FORM PÓLIZA ──────────────────────────────────────────────────────────────
const PolizaForm = ({ initial, clientes, agentes, onSave, onClose }) => {
  const [form, setForm] = useState(initial || { numero: "", clienteId: clientes[0]?.id || "", tipo: "Auto", aseguradora: "", sumaAsegurada: "", prima: "", vigenciaInicio: "", vigenciaFin: "", estado: "Activa", agenteId: agentes[0]?.id || "", notas: "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.numero && form.clienteId && form.aseguradora && form.sumaAsegurada && form.prima && form.vigenciaInicio && form.vigenciaFin;

  const handleSave = async () => { setSaving(true); await onSave(form); setSaving(false); };

  return (
    <Modal title={initial?.id ? "Editar Póliza" : "Nueva Póliza"} onClose={onClose}
      footer={<><button style={S.btn("secondary")} onClick={onClose}>Cancelar</button><button style={{ ...S.btn("primary"), opacity: valid && !saving ? 1 : 0.5 }} onClick={handleSave} disabled={!valid || saving}>{saving ? "Guardando…" : "Guardar Póliza"}</button></>}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
        <div style={S.formGroup}><label style={S.label}>Número *</label><input style={S.input} value={form.numero} onChange={e => set("numero", e.target.value)} placeholder="POL-2024-XXXX" /></div>
        <div style={S.formGroup}><label style={S.label}>Estado</label><select style={S.select} value={form.estado} onChange={e => set("estado", e.target.value)}>{["Activa", "Vencida", "Cancelada"].map(e => <option key={e}>{e}</option>)}</select></div>
        <div style={{ ...S.formGroup, gridColumn: "1/-1" }}><label style={S.label}>Cliente *</label><select style={S.select} value={form.clienteId} onChange={e => set("clienteId", e.target.value)}>{clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
        <div style={S.formGroup}><label style={S.label}>Tipo *</label><select style={S.select} value={form.tipo} onChange={e => set("tipo", e.target.value)}>{["Auto", "Vida", "GMM", "Hogar", "RC"].map(t => <option key={t}>{t}</option>)}</select></div>
        <div style={S.formGroup}><label style={S.label}>Aseguradora *</label><input style={S.input} value={form.aseguradora} onChange={e => set("aseguradora", e.target.value)} placeholder="GNP, AXA, Metlife…" /></div>
        <div style={S.formGroup}><label style={S.label}>Suma Asegurada *</label><input style={S.input} type="number" value={form.sumaAsegurada} onChange={e => set("sumaAsegurada", Number(e.target.value))} /></div>
        <div style={S.formGroup}><label style={S.label}>Prima Anual *</label><input style={S.input} type="number" value={form.prima} onChange={e => set("prima", Number(e.target.value))} /></div>
        <div style={S.formGroup}><label style={S.label}>Inicio Vigencia *</label><input style={S.input} type="date" value={form.vigenciaInicio} onChange={e => set("vigenciaInicio", e.target.value)} /></div>
        <div style={S.formGroup}><label style={S.label}>Fin Vigencia *</label><input style={S.input} type="date" value={form.vigenciaFin} onChange={e => set("vigenciaFin", e.target.value)} /></div>
        <div style={S.formGroup}><label style={S.label}>Agente</label><select style={S.select} value={form.agenteId} onChange={e => set("agenteId", e.target.value)}>{agentes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></div>
        <div style={{ ...S.formGroup, gridColumn: "1/-1" }}><label style={S.label}>Notas</label><textarea style={{ ...S.input, minHeight: 60, resize: "vertical" }} value={form.notas} onChange={e => set("notas", e.target.value)} /></div>
      </div>
    </Modal>
  );
};

// ─── PÓLIZAS ─────────────────────────────────────────────────────────────────
const PolizasPage = ({ polizas, clientes, agentes, onAdd, onEdit, onDelete, userRol, agenteActualId }) => {
  const [q, setQ] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("Todos");
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [delItem, setDelItem] = useState(null);

  // Agente solo ve sus propias pólizas
  const polizasPorRol = esAdmin(userRol) ? polizas : polizas.filter(p => p.agenteId === agenteActualId);

  const filtered = useMemo(() => polizasPorRol.filter(p => {
    const cliente = clientes.find(c => c.id === p.clienteId);
    const matchQ = !q || p.numero?.toLowerCase().includes(q.toLowerCase()) || cliente?.nombre?.toLowerCase().includes(q.toLowerCase()) || p.aseguradora?.toLowerCase().includes(q.toLowerCase());
    return matchQ && (filtroTipo === "Todos" || p.tipo === filtroTipo) && (filtroEstado === "Todos" || p.estado === filtroEstado);
  }), [polizasPorRol, clientes, q, filtroTipo, filtroEstado]);

  const handleSave = async (form) => {
    if (editItem) { await onEdit({ ...editItem, ...form }); setEditItem(null); }
    else { await onAdd(form); setShowForm(false); }
  };

  return (
    <div>
      <div style={S.pageHeader}>
        <div><div style={S.pageTitle}>Pólizas</div><div style={S.pageSub}>{polizasPorRol.length} pólizas · {polizasPorRol.filter(p => p.estado === "Activa").length} activas</div></div>
        <button style={S.btn("primary")} onClick={() => setShowForm(true)}><Icon name="plus" size={16} />Nueva Póliza</button>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={S.searchBar}><Icon name="search" size={16} /><input style={S.searchInput} placeholder="Buscar póliza, cliente, aseguradora…" value={q} onChange={e => setQ(e.target.value)} /></div>
        <select style={{ ...S.select, width: "auto", padding: "7px 12px" }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>{["Todos", "Auto", "Vida", "GMM", "Hogar", "RC"].map(t => <option key={t}>{t}</option>)}</select>
        <select style={{ ...S.select, width: "auto", padding: "7px 12px" }} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>{["Todos", "Activa", "Vencida", "Cancelada"].map(e => <option key={e}>{e}</option>)}</select>
      </div>
      <div style={S.tableWrap}>
        <div style={{ ...S.tableHead, gridTemplateColumns: "1.4fr 1.2fr 0.8fr 0.8fr 0.9fr 1fr 0.7fr 80px" }}>
          <span>Póliza</span><span>Cliente</span><span>Tipo</span><span>Aseg.</span><span>Prima</span><span>Vence</span><span>Estado</span><span>Acc.</span>
        </div>
        {filtered.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: "#aaa" }}>No se encontraron pólizas</div>
          : filtered.map(p => {
            const cliente = clientes.find(c => c.id === p.clienteId);
            const dias = diasParaVencer(p.vigenciaFin);
            return (
              <div key={p.id} style={{ ...S.tableRow, gridTemplateColumns: "1.4fr 1.2fr 0.8fr 0.8fr 0.9fr 1fr 0.7fr 80px" }}
                onMouseEnter={e => e.currentTarget.style.background = "#fafaf8"}
                onMouseLeave={e => e.currentTarget.style.background = ""}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{p.numero}</div>
                <div style={{ fontSize: 13 }}>{cliente?.nombre || "—"}</div>
                <span style={S.chip(tipoColor(p.tipo))}>{p.tipo}</span>
                <div style={{ fontSize: 12.5, color: "#555" }}>{p.aseguradora}</div>
                <div style={{ fontSize: 13 }}>{fmt(p.prima)}</div>
                <div><div style={{ fontSize: 13 }}>{fmtDate(p.vigenciaFin)}</div>{p.estado === "Activa" && dias <= 30 && dias >= 0 && <div style={{ fontSize: 11, color: dias <= 7 ? "#dc2626" : "#d97706", fontWeight: 600 }}>{dias}d</div>}</div>
                <span style={S.badge(estadoColor(p.estado))}>{p.estado}</span>
                <div style={{ display: "flex", gap: 4 }}>
                  <button style={S.btn("ghost")} onClick={() => setEditItem(p)}><Icon name="edit" size={15} /></button>
                  {esAdmin(userRol) && <button style={{ ...S.btn("ghost"), color: "#dc2626" }} onClick={() => setDelItem(p)}><Icon name="trash" size={15} /></button>}
                </div>
              </div>
            );
          })}
      </div>
      {(showForm || editItem) && (
        <PolizaForm
          initial={editItem}
          clientes={esAdmin(userRol) ? clientes : clientes.filter(c => c.agenteId === agenteActualId)}
          agentes={esAdmin(userRol) ? agentes : agentes.filter(a => a.id === agenteActualId)}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditItem(null); }}
        />
      )}
      {delItem && esAdmin(userRol) && (
        <Modal title="Confirmar eliminación" onClose={() => setDelItem(null)}
          footer={<><button style={S.btn("secondary")} onClick={() => setDelItem(null)}>Cancelar</button><button style={S.btn("danger")} onClick={async () => { await onDelete(delItem.id); setDelItem(null); }}>Eliminar</button></>}>
          <p style={{ fontSize: 14, color: "#555" }}>¿Eliminar la póliza <strong>{delItem.numero}</strong>? Esta acción no se puede deshacer.</p>
        </Modal>
      )}
    </div>
  );
};

// ─── RENOVACIONES ─────────────────────────────────────────────────────────────
const RenovacionesPage = ({ polizas, clientes, userRol, agenteActualId }) => {
  const [filtro, setFiltro] = useState("30");
  // Agente solo ve sus pólizas
  const polizasPorRol = esAdmin(userRol) ? polizas : polizas.filter(p => p.agenteId === agenteActualId);
  const getCount = (val) => polizasPorRol.filter(p => { const d = diasParaVencer(p.vigenciaFin); return val === "vencidas" ? p.estado === "Vencida" : p.estado === "Activa" && d >= 0 && d <= parseInt(val); }).length;
  const candidates = polizasPorRol.filter(p => { const d = diasParaVencer(p.vigenciaFin); return filtro === "vencidas" ? p.estado === "Vencida" : p.estado === "Activa" && d >= 0 && d <= parseInt(filtro); }).sort((a, b) => diasParaVencer(a.vigenciaFin) - diasParaVencer(b.vigenciaFin));

  return (
    <div>
      <div style={S.pageHeader}><div><div style={S.pageTitle}>Renovaciones</div><div style={S.pageSub}>Pólizas por vencer y vencidas</div></div></div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {[["7", "7 días"], ["15", "15 días"], ["30", "30 días"], ["60", "60 días"], ["vencidas", "Vencidas"]].map(([val, label]) => (
          <button key={val} onClick={() => setFiltro(val)} style={{ padding: "7px 16px", borderRadius: 20, border: `1.5px solid ${filtro === val ? "#1a4fdb" : "#ddd9d2"}`, background: filtro === val ? "#eef2ff" : "#fff", color: filtro === val ? "#1a4fdb" : "#555", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {label} <span style={{ color: filtro === val ? "#1a4fdb" : "#aaa", fontWeight: 400 }}>({getCount(val)})</span>
          </button>
        ))}
      </div>
      {candidates.length === 0 ? <div style={{ ...S.tableWrap, padding: 48, textAlign: "center", color: "#aaa" }}>No hay pólizas en este rango.</div> : (
        <div style={S.tableWrap}>
          <div style={{ ...S.tableHead, gridTemplateColumns: "1.2fr 1.4fr 0.8fr 0.8fr 1fr 1fr 80px" }}>
            <span>Póliza</span><span>Cliente</span><span>Tipo</span><span>Aseg.</span><span>Prima</span><span>Vence</span><span>Días</span>
          </div>
          {candidates.map(p => {
            const cliente = clientes.find(c => c.id === p.clienteId);
            const d = diasParaVencer(p.vigenciaFin);
            const urgColor = filtro === "vencidas" ? "#dc2626" : d <= 7 ? "#dc2626" : d <= 15 ? "#d97706" : "#2563eb";
            return (
              <div key={p.id} style={{ ...S.tableRow, gridTemplateColumns: "1.2fr 1.4fr 0.8fr 0.8fr 1fr 1fr 80px", borderLeft: `3px solid ${urgColor}` }}
                onMouseEnter={e => e.currentTarget.style.background = "#fafaf8"}
                onMouseLeave={e => e.currentTarget.style.background = ""}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{p.numero}</div>
                <div><div style={{ fontSize: 13 }}>{cliente?.nombre}</div><div style={{ fontSize: 11.5, color: "#aaa" }}>{cliente?.telefono}</div></div>
                <span style={S.chip(tipoColor(p.tipo))}>{p.tipo}</span>
                <div style={{ fontSize: 12.5 }}>{p.aseguradora}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{fmt(p.prima)}</div>
                <div style={{ fontSize: 13 }}>{fmtDate(p.vigenciaFin)}</div>
                <span style={{ ...S.chip(urgColor), fontWeight: 700 }}>{filtro === "vencidas" ? "Vencida" : `${d}d`}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── CONFIGURACIÓN (solo Admin) ───────────────────────────────────────────────
const ConfiguracionPage = ({ agentes, polizas, clientes, onAdd, onEdit, onDelete }) => {
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [delItem, setDelItem] = useState(null);
  const [form, setForm] = useState({ nombre: "", email: "", rol: ROL_AGENTE });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    if (editItem) { await onEdit({ ...editItem, ...form }); setEditItem(null); }
    else { await onAdd(form); setShowForm(false); setForm({ nombre: "", email: "", rol: ROL_AGENTE }); }
    setSaving(false);
  };

  return (
    <div>
      <div style={S.pageHeader}>
        <div><div style={S.pageTitle}>Configuración</div><div style={S.pageSub}>Gestión de usuarios — solo visible para Admin</div></div>
        <button style={S.btn("primary")} onClick={() => setShowForm(true)}><Icon name="plus" size={16} />Nuevo Usuario</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
        <div style={{ background: "#f5f0ff", border: "1px solid #e0d4fc", borderRadius: 12, padding: 18 }}>
          <div style={{ marginBottom: 8 }}><span style={S.chip("#7c3aed")}>Admin</span></div>
          <div style={{ fontSize: 13, color: "#555", lineHeight: 1.5 }}>Ve y gestiona <strong>todos</strong> los clientes y pólizas. Puede crear, editar y eliminar cualquier registro. Acceso a Configuración.</div>
        </div>
        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: 18 }}>
          <div style={{ marginBottom: 8 }}><span style={S.chip("#2563eb")}>Agente</span></div>
          <div style={{ fontSize: 13, color: "#555", lineHeight: 1.5 }}>Ve <strong>únicamente sus propios</strong> clientes y pólizas. Puede crear y editar, sin eliminar. Sin acceso a Configuración.</div>
        </div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#888", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 12 }}>Usuarios ({agentes.length})</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {agentes.map(a => {
          const nClientes = clientes.filter(c => c.agenteId === a.id).length;
          const nPolizas = polizas.filter(p => p.agenteId === a.id && p.estado === "Activa").length;
          const prima = polizas.filter(p => p.agenteId === a.id && p.estado === "Activa").reduce((s, p) => s + Number(p.prima), 0);
          const initials = a.nombre.split(" ").slice(0, 2).map(w => w[0]).join("");
          const rolColor = a.rol === ROL_ADMIN ? "#7c3aed" : "#2563eb";
          return (
            <div key={a.id} style={{ background: "#fff", borderRadius: 12, padding: 22, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #ece9e3" }}>
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
                <span style={S.chip("#16a34a")}>Activo</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, borderTop: "1px solid #f0ede8", paddingTop: 12 }}>
                <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontFamily: "'Instrument Serif', serif" }}>{nClientes}</div><div style={{ fontSize: 11, color: "#aaa" }}>Clientes</div></div>
                <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontFamily: "'Instrument Serif', serif" }}>{nPolizas}</div><div style={{ fontSize: 11, color: "#aaa" }}>Pólizas</div></div>
                <div style={{ textAlign: "center" }}><div style={{ fontSize: 14, fontFamily: "'Instrument Serif', serif" }}>{fmt(prima)}</div><div style={{ fontSize: 11, color: "#aaa" }}>Prima</div></div>
              </div>
            </div>
          );
        })}
      </div>
      {(showForm || editItem) && (
        <Modal title={editItem ? "Editar Usuario" : "Nuevo Usuario"} onClose={() => { setShowForm(false); setEditItem(null); }}
          footer={<><button style={S.btn("secondary")} onClick={() => { setShowForm(false); setEditItem(null); }}>Cancelar</button><button style={{ ...S.btn("primary"), opacity: saving ? 0.6 : 1 }} onClick={handleSave} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button></>}>
          <div style={S.formGroup}><label style={S.label}>Nombre completo *</label><input style={S.input} value={form.nombre} onChange={e => set("nombre", e.target.value)} /></div>
          <div style={S.formGroup}><label style={S.label}>Email *</label><input style={S.input} type="email" value={form.email} onChange={e => set("email", e.target.value)} /></div>
          <div style={S.formGroup}>
            <label style={S.label}>Rol</label>
            <select style={S.select} value={form.rol} onChange={e => set("rol", e.target.value)}>
              <option value={ROL_ADMIN}>Admin — acceso total</option>
              <option value={ROL_AGENTE}>Agente — solo su cartera</option>
            </select>
          </div>
          <div style={{ background: "#f8f7f5", borderRadius: 8, padding: "10px 14px", fontSize: 12.5, color: "#888" }}>
            💡 Para que el usuario pueda hacer login, crea su cuenta en Supabase → Authentication → Users con el mismo email y contraseña.
          </div>
        </Modal>
      )}
      {delItem && (
        <Modal title="Confirmar eliminación" onClose={() => setDelItem(null)}
          footer={<><button style={S.btn("secondary")} onClick={() => setDelItem(null)}>Cancelar</button><button style={S.btn("danger")} onClick={async () => { await onDelete(delItem.id); setDelItem(null); }}>Eliminar</button></>}>
          <p style={{ fontSize: 14, color: "#555" }}>¿Eliminar al usuario <strong>{delItem.nombre}</strong>? Sus clientes y pólizas asignadas quedarán sin agente.</p>
        </Modal>
      )}
    </div>
  );
};

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [page, setPage] = useState("dashboard");
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState("");
  const [userRol, setUserRol] = useState(ROL_AGENTE);
  const [agenteActualId, setAgenteActualId] = useState(null);

  const [clientes, setClientes] = useState([]);
  const [polizas, setPolizas] = useState([]);
  const [agentes, setAgentes] = useState([]);

  // Resolver rol del usuario logueado consultando tabla agentes por email
  const resolverRol = async (email) => {
    const { data } = await supabase.from('agentes').select('id, nombre, rol').eq('email', email).single();
    if (data) {
      setUserName(data.nombre || email);
      setUserRol(data.rol === ROL_ADMIN ? ROL_ADMIN : ROL_AGENTE);
      setAgenteActualId(data.id);
    } else {
      setUserName(email);
      setUserRol(ROL_AGENTE);
    }
  };

  // Verificar sesión activa al cargar la página
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        await resolverRol(session.user.email);
        setLoggedIn(true);
      }
    });
  }, []);

  // Cargar todos los datos al hacer login
  useEffect(() => {
    if (!loggedIn) return;
    const cargarDatos = async () => {
      setLoading(true);
      const [{ data: ags }, { data: cls }, { data: pols }] = await Promise.all([
        supabase.from('agentes').select('*').order('nombre'),
        supabase.from('clientes').select('*').order('nombre'),
        supabase.from('polizas').select('*').order('created_at', { ascending: false }),
      ]);
      if (ags) setAgentes(ags);
      if (cls) setClientes(cls.map(mapCliente));
      if (pols) setPolizas(pols.map(mapPoliza));
      setLoading(false);
    };
    cargarDatos();
  }, [loggedIn]);

  const handleLogin = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) await resolverRol(session.user.email);
    setLoggedIn(true);
  };

  // CRUD Clientes
  const addCliente = async (c) => {
    const { data } = await supabase.from('clientes').insert([{ nombre: c.nombre, email: c.email, telefono: c.telefono, rfc: c.rfc, domicilio: c.domicilio, notas: c.notas, agente_id: c.agenteId }]).select().single();
    if (data) setClientes(prev => [mapCliente(data), ...prev]);
  };
  const editCliente = async (c) => {
    await supabase.from('clientes').update({ nombre: c.nombre, email: c.email, telefono: c.telefono, rfc: c.rfc, domicilio: c.domicilio, notas: c.notas, agente_id: c.agenteId }).eq('id', c.id);
    setClientes(prev => prev.map(x => x.id === c.id ? { ...x, ...c } : x));
  };
  const deleteCliente = async (id) => {
    await supabase.from('clientes').delete().eq('id', id);
    setClientes(prev => prev.filter(x => x.id !== id));
  };

  // CRUD Pólizas
  const addPoliza = async (p) => {
    const { data } = await supabase.from('polizas').insert([{ numero: p.numero, cliente_id: p.clienteId, agente_id: p.agenteId, tipo: p.tipo, aseguradora: p.aseguradora, suma_asegurada: p.sumaAsegurada, prima: p.prima, vigencia_inicio: p.vigenciaInicio, vigencia_fin: p.vigenciaFin, estado: p.estado, notas: p.notas }]).select().single();
    if (data) setPolizas(prev => [mapPoliza(data), ...prev]);
  };
  const editPoliza = async (p) => {
    await supabase.from('polizas').update({ numero: p.numero, cliente_id: p.clienteId, agente_id: p.agenteId, tipo: p.tipo, aseguradora: p.aseguradora, suma_asegurada: p.sumaAsegurada, prima: p.prima, vigencia_inicio: p.vigenciaInicio, vigencia_fin: p.vigenciaFin, estado: p.estado, notas: p.notas }).eq('id', p.id);
    setPolizas(prev => prev.map(x => x.id === p.id ? { ...x, ...p } : x));
  };
  const deletePoliza = async (id) => {
    await supabase.from('polizas').delete().eq('id', id);
    setPolizas(prev => prev.filter(x => x.id !== id));
  };

  // CRUD Usuarios (solo Admin)
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setLoggedIn(false);
    setClientes([]); setPolizas([]); setAgentes([]);
    setUserRol(ROL_AGENTE); setAgenteActualId(null);
  };

  if (!loggedIn) return <><FontLoader /><LoginPage onLogin={handleLogin} /></>;
  if (loading) return <><FontLoader /><LoadingScreen /></>;

  const handleNav = (p) => {
    if (p === "configuracion" && !esAdmin(userRol)) return; // Bloquear acceso agente
    setPage(p);
    setClienteSeleccionado(null);
  };

  const renderPage = () => {
    if (page === "clientes" && clienteSeleccionado) {
      return <ClienteDetalle cliente={clienteSeleccionado} polizas={polizas} agentes={agentes} onBack={() => setClienteSeleccionado(null)} />;
    }
    switch (page) {
      case "dashboard":
        return <Dashboard clientes={clientes} polizas={polizas} userName={userName} onNav={handleNav} userRol={userRol} agenteActualId={agenteActualId} />;
      case "clientes":
        return <ClientesPage clientes={clientes} polizas={polizas} agentes={agentes} onAdd={addCliente} onEdit={editCliente} onDelete={deleteCliente} onSelectCliente={setClienteSeleccionado} userRol={userRol} agenteActualId={agenteActualId} />;
      case "polizas":
        return <PolizasPage polizas={polizas} clientes={clientes} agentes={agentes} onAdd={addPoliza} onEdit={editPoliza} onDelete={deletePoliza} userRol={userRol} agenteActualId={agenteActualId} />;
      case "renovaciones":
        return <RenovacionesPage polizas={polizas} clientes={clientes} userRol={userRol} agenteActualId={agenteActualId} />;
      case "configuracion":
        return esAdmin(userRol)
          ? <ConfiguracionPage agentes={agentes} polizas={polizas} clientes={clientes} onAdd={addAgente} onEdit={editAgente} onDelete={deleteAgente} />
          : <div style={{ padding: 48, textAlign: "center", color: "#aaa" }}>Sin acceso.</div>;
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
