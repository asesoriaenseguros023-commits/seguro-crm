// ─── CONSTANTES GLOBALES ─────────────────────────────────────────────────────

export const ROL_ADMIN = "Admin";
export const ROL_AGENTE = "Agente";

export const BLUE = {
  primary: "#1e40af",     // blue-800 (barra y botones de POS Tocancipá)
  primaryDark: "#1e3a8a", // blue-900
  sidebar: "#1e40af",
  sidebarDark: "#1e3a8a",
  accent: "#2563eb",      // blue-600
  light: "#eff6ff",       // blue-50
  border: "#e2e8f0",      // slate-200
  text: "#1e293b",        // slate-800
};

const FUENTE = 'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"';

// ─── ESTILOS ─────────────────────────────────────────────────────────────────
export const S = {
  app: { minHeight: "100vh", background: "#f1f5f9", fontFamily: FUENTE, color: "#1e293b" },
  sidebar: { width: 210, background: `linear-gradient(180deg, ${BLUE.sidebarDark} 0%, ${BLUE.sidebar} 100%)`, display: "flex", flexDirection: "column", flexShrink: 0, position: "sticky", top: 0, height: "100vh", overflowY: "auto" },
  main: { maxWidth: 1280, width: "100%", margin: "0 auto", boxSizing: "border-box", flex: 1 },
  topbar: { background: "#fff", borderBottom: `1px solid ${BLUE.border}`, padding: "0 28px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 },
  content: { background: "#fff", borderRadius: 16, boxShadow: "0 1px 2px rgba(15,23,42,0.06)", border: "1px solid #f1f5f9", minHeight: "80vh", boxSizing: "border-box" },
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
  pageSub: { fontSize: 13, color: "#64748b", marginTop: 3 },
  statGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px,1fr))", gap: 14, marginBottom: 24 },
  statCard: (accent) => ({ background: "#fff", borderRadius: 12, padding: "18px 20px", borderTop: `3px solid ${accent}`, boxShadow: "0 1px 6px rgba(15,23,42,0.08)" }),
  statNum: { fontSize: 28, fontWeight: 700, color: BLUE.text, letterSpacing: -1 },
  statLabel: { fontSize: 11.5, color: "#64748b", fontWeight: 600, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  tableWrap: { background: "#fff", borderRadius: 12, boxShadow: "0 1px 6px rgba(15,23,42,0.08)", overflow: "hidden" },
  tableHead: { display: "grid", background: BLUE.light, borderBottom: `1px solid ${BLUE.border}`, padding: "10px 18px", fontSize: 11, fontWeight: 700, color: BLUE.primary, letterSpacing: 0.8, textTransform: "uppercase" },
  tableRow: { display: "grid", padding: "13px 18px", borderBottom: "1px solid #f1f5f9", alignItems: "center", fontSize: 13.5, transition: "background 0.12s" },
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
  modal: { background: "#fff", borderRadius: 14, width: "100%", maxWidth: 580, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(15,23,42,0.2)" },
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
  // ─── Inicio (tarjetas de sección) ───────────────────────────────────────────
  nav: { background: "#1e40af", boxShadow: "0 10px 15px -3px rgba(15,23,42,0.15), 0 4px 6px -4px rgba(15,23,42,0.15)", position: "sticky", top: 0, zIndex: 40 },
  navLogoBtn: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0, background: "transparent", border: "none", borderRadius: 8, padding: 4, margin: -4, cursor: "pointer", fontFamily: "inherit" },
  navLogoImg: { width: 32, height: 32, objectFit: "contain", borderRadius: 8, background: "#fff", padding: 2, boxSizing: "border-box" },
  navTab: (active) => ({ flexShrink: 0, padding: "6px 12px", borderRadius: 6, fontSize: 14, fontWeight: 500, whiteSpace: "nowrap", border: "none", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s", background: active ? "#fff" : "transparent", color: active ? "#1e40af" : "#bfdbfe", boxShadow: active ? "0 1px 2px rgba(0,0,0,0.08)" : "none" }),
  navSalir: { flexShrink: 0, fontSize: 12, fontWeight: 500, color: "#bfdbfe", background: "rgba(30,58,138,0.6)", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit" },
  navHamburger: { color: "#fff", width: 44, height: 44, flexShrink: 0, borderRadius: 8, background: "transparent", border: "none", fontSize: 20, lineHeight: 1, cursor: "pointer" },
  navMobileItem: (active) => ({ display: "flex", alignItems: "center", width: "100%", padding: "12px 16px", borderRadius: 8, fontSize: 16, fontWeight: 500, border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left", background: active ? "#fff" : "transparent", color: active ? "#1e40af" : "#dbeafe" }),
  homeLogo: { width: 64, height: 64, objectFit: "contain", borderRadius: 12, background: "#fff", boxShadow: "0 1px 2px rgba(15,23,42,0.06)", border: "1px solid #f1f5f9", padding: 4, boxSizing: "border-box", display: "block", margin: "0 auto 12px" },
  homeTitle: { fontSize: 20, fontWeight: 700, color: "#1e293b", margin: 0, letterSpacing: "normal", lineHeight: 1.4 },
  homeSub: { fontSize: 14, color: "#64748b", marginTop: 4, marginBottom: 0 },
  homeGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px,1fr))", gap: 12, maxWidth: 768, margin: "0 auto" },
  homeCard: { background: "#fff", borderRadius: 12, padding: 20, border: "2px solid #e2e8f0", cursor: "pointer", transition: "all 0.15s", textAlign: "center", fontFamily: "inherit" },
  homeCardLabel: { fontSize: 14, fontWeight: 600, color: "#1e293b" },
  // ─── Sub-pestañas dentro de una sección (CRM Seguros / Configuraciones) ─────
  subTabBar: { display: "flex", gap: 2, marginBottom: 20, borderBottom: `1px solid ${BLUE.border}`, flexWrap: "wrap" },
  subTabBtn: (active) => ({
    padding: "9px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", background: "transparent",
    border: "none", borderBottom: active ? `2px solid ${BLUE.primary}` : "2px solid transparent",
    color: active ? BLUE.primary : "#64748b", marginBottom: -1, fontFamily: "inherit",
  }),
};

// ─── NAVEGACIÓN (secciones del inicio y sub-pestañas) ────────────────────────
// "CRM Seguros" (Dashboard/Clientes/Leads/Cotizaciones/Pólizas/Renovaciones)
// se eliminó del código el 2026-09-30 a pedido explícito del usuario — venía
// desactivado desde el 2026-09-25 y decidió no reactivarlo nunca, tras
// encontrar un bug real de datos en la importación de pólizas (Renovaciones).
// Las tablas de Supabase (clientes, interesados, cotizaciones, polizas) NO
// se tocaron — solo se quitó el código del frontend. Ver [[project-seguro-crm]].
export const SECCIONES = [
  { id: "soat",         label: "Seguimiento SOAT",      icon: "shield",   adminOnly: false },
  { id: "whatsapp",     label: "WhatsApp",              icon: "whatsapp", adminOnly: false },
  { id: "primas",       label: "Pulso de Primas",       icon: "chart",    adminOnly: false },
  { id: "certificados", label: "Certificados Escolares", icon: "document", adminOnly: false },
  { id: "oficina-soat", label: "Oficina SOAT",          icon: "tag",      adminOnly: false },
  { id: "arriendos",    label: "Arriendos",             icon: "home",     adminOnly: true },
  { id: "config",       label: "Configuraciones",       icon: "settings", adminOnly: true },
];

export const SUBTABS_CONFIG = [
  { id: "ramos",         label: "Ramos de Seguros" },
  { id: "aseguradoras",  label: "Aseguradoras" },
  { id: "comerciales",   label: "Comerciales" },
  { id: "configuracion", label: "Agentes" },
];

// ─── SOAT ────────────────────────────────────────────────────────────────────
export const FASES_SOAT = [
  { id: "pendiente",    label: "Pendiente",      color: "#3b82f6", bg: "#dbeafe", text: "#1d4ed8" },
  { id: "contactado_whatsapp", label: "Contactado por WhatsApp", color: "#10b981", bg: "#d1fae5", text: "#065f46" },
  { id: "en_gestion",  label: "En gestión",     color: "#f59e0b", bg: "#fef3c7", text: "#92400e" },
  { id: "interesado",  label: "Interesado",     color: "#22c55e", bg: "#dcfce7", text: "#166534" },
  { id: "compro",      label: "Compró",         color: "#8b5cf6", bg: "#ede9fe", text: "#5b21b6" },
  { id: "no_interes",  label: "No interesado",  color: "#ef4444", bg: "#fee2e2", text: "#991b1b" },
  { id: "ilocalizable",label: "Ilocalizable",   color: "#6b7280", bg: "#f3f4f6", text: "#374151" },
  { id: "numero_equivocado", label: "Número equivocado", color: "#0891b2", bg: "#cffafe", text: "#155e75" },
];

export const FM_SOAT = Object.fromEntries(FASES_SOAT.map(f => [f.id, f]));

export const MOTIVOS_SOAT = [
  "Ya compró con otra aseguradora",
  "No tiene vehículo activo",
  "No le interesa renovar aún",
];

// ─── WhatsApp (whatsapp_conversaciones / whatsapp_mensajes) ─────────────────
// Estado real de entrega por MENSAJE saliente (lo que manda Meta vía
// webhook) -- ya no es un estado manual por conversación, ver
// [[project-seguro-crm]] / supabase_whatsapp_chat.sql.
export const ESTADOS_MENSAJE_WA = [
  { id: "enviado",   label: "Enviado",   color: "#64748b", bg: "#f1f5f9", text: "#334155" },
  { id: "entregado", label: "Entregado", color: "#3b82f6", bg: "#dbeafe", text: "#1d4ed8" },
  { id: "leido",     label: "Leído",     color: "#8b5cf6", bg: "#ede9fe", text: "#5b21b6" },
  { id: "fallido",   label: "Falló",     color: "#ef4444", bg: "#fee2e2", text: "#991b1b" },
];

export const FM_MENSAJE_WA = Object.fromEntries(ESTADOS_MENSAJE_WA.map(e => [e.id, e]));

// "Número equivocado" salió de acá — ahora es su propia fase (FASES_SOAT),
// no un motivo dentro de Ilocalizable. Pedido explícito del usuario.
export const MOTIVOS_ILOCALIZABLE = ["No contestó / Buzón"];

export const ACCIONES_SOAT = ["Volver a llamar", "Escribir por WhatsApp"];

// Plantillas de WhatsApp (Meta). "aprobada" se pone en true cuando Meta la
// aprueba -- solo las aprobadas aparecen en el selector de segundo contacto.
// Cada una se manda UNA sola vez por cliente. El texto debe coincidir con el
// de api/whatsapp.js (PLANTILLAS_WA).
export const PLANTILLAS_WA = [
  { id: "soat_claro_pendientes",       label: "Claro que sí, quedamos pendientes", aprobada: true },
  { id: "soat_recordatorio_asesoria",  label: "Recordatorio para asesorarle con el SOAT", aprobada: true },
  { id: "soat_datos_vehiculo",         label: "Pedir tipo de vehículo, cilindraje y modelo", aprobada: true },
  { id: "soat_retomar_conversacion_2", label: "¿Desea retomar la conversación?", aprobada: true },
];

// Tipo de vehículo (homologado) del cliente de SOAT.
export const TIPOS_VEHICULO = ["AUTOMOVIL", "MOTO", "CAMPERO/CAMIONETA", "CAMION", "TAXI", "BUS"];
