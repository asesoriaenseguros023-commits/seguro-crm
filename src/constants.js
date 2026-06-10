// ─── CONSTANTES GLOBALES ─────────────────────────────────────────────────────

export const ROL_ADMIN = "Admin";
export const ROL_AGENTE = "Agente";

export const BLUE = {
  primary: "#1a56db",
  primaryDark: "#1044b8",
  sidebar: "#0d2d6b",
  sidebarDark: "#071d47",
  accent: "#3b82f6",
  light: "#eff6ff",
  border: "#bfdbfe",
  text: "#1e3a5f",
};

// ─── ESTILOS ─────────────────────────────────────────────────────────────────
export const S = {
  app: { display: "flex", minHeight: "100vh", background: `linear-gradient(135deg, ${BLUE.sidebarDark} 0%, #0a2255 100%)`, fontFamily: "'DM Sans', sans-serif", color: "#1a1a1a" },
  sidebar: { width: 210, background: `linear-gradient(180deg, ${BLUE.sidebarDark} 0%, ${BLUE.sidebar} 100%)`, display: "flex", flexDirection: "column", flexShrink: 0, position: "sticky", top: 0, height: "100vh", overflowY: "auto" },
  main: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 },
  topbar: { background: "#fff", borderBottom: `1px solid ${BLUE.border}`, padding: "0 28px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 },
  content: { flex: 1, padding: "20px 16px", overflowY: "auto", background: "#f0f4ff" },
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

// ─── SOAT ────────────────────────────────────────────────────────────────────
export const FASES_SOAT = [
  { id: "pendiente",    label: "Pendiente",      color: "#3b82f6", bg: "#dbeafe", text: "#1d4ed8" },
  { id: "en_gestion",  label: "En gestión",     color: "#f59e0b", bg: "#fef3c7", text: "#92400e" },
  { id: "interesado",  label: "Interesado",     color: "#22c55e", bg: "#dcfce7", text: "#166534" },
  { id: "compro",      label: "Compró",         color: "#8b5cf6", bg: "#ede9fe", text: "#5b21b6" },
  { id: "no_interes",  label: "No interesado",  color: "#ef4444", bg: "#fee2e2", text: "#991b1b" },
  { id: "ilocalizable",label: "Ilocalizable",   color: "#6b7280", bg: "#f3f4f6", text: "#374151" },
];

export const FM_SOAT = Object.fromEntries(FASES_SOAT.map(f => [f.id, f]));

export const MOTIVOS_SOAT = [
  "Ya compró con otra aseguradora",
  "No tiene vehículo activo",
  "No le interesa renovar aún",
  "No contestó / Buzón",
  "Número equivocado",
];

export const ACCIONES_SOAT = ["Volver a llamar", "Escribir por WhatsApp"];

// ─── COTIZACIONES ─────────────────────────────────────────────────────────────
export const ESTADOS_COT = ["Corrección SARLAFT", "Corrección Contrato", "Cotización Completada"];
export const ACCIONES_COT = ["En Curso", "Cliente Rechaza", "Póliza Emitida"];
