import { S, BLUE } from "../constants.js";
import Icon from "./Icon.jsx";

const fmtDuration = (sec) => {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

const LABELS = {
  "requesting-token": "Conectando…",
  connecting: "Conectando…",
  ringing: "Timbrando…",
  "in-call": "En llamada",
  error: "Error",
};

const SoftphoneWidget = ({ status, callee, durationSec, muted, errorMessage, hangup, toggleMute }) => {
  if (status === "idle") return null;

  return (
    <div style={{
      position: "fixed", bottom: 20, right: 20, zIndex: 250,
      background: "#fff", borderRadius: 14, boxShadow: "0 20px 60px rgba(26,86,219,0.25)",
      border: `1px solid ${BLUE.border}`, padding: "14px 18px", minWidth: 240,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
          background: status === "error" ? "#fef2f2" : BLUE.light,
          color: status === "error" ? "#dc2626" : BLUE.primary,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon name="phone" size={16} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: BLUE.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {callee?.nombre || callee?.telefono || "Llamada"}
          </div>
          <div style={{ fontSize: 12, color: status === "error" ? "#dc2626" : "#6b87b0", marginTop: 1 }}>
            {status === "error"
              ? (errorMessage || "No se pudo completar la llamada.")
              : status === "in-call" ? fmtDuration(durationSec) : LABELS[status]}
          </div>
        </div>
      </div>
      {status !== "error" && (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={toggleMute} style={{ ...S.btn(muted ? "primary" : "secondary"), flex: 1, justifyContent: "center" }}>
            {muted ? "Silenciado" : "Silenciar"}
          </button>
          <button onClick={hangup} style={{ ...S.btn("danger"), flex: 1, justifyContent: "center" }}>
            Colgar
          </button>
        </div>
      )}
    </div>
  );
};

export default SoftphoneWidget;
