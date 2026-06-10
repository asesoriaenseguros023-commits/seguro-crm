import { S, BLUE } from "../constants.js";
import Icon from "./Icon.jsx";

/**
 * ConfirmDialog renders a modal that asks for confirmation.
 * It is driven by `confirmState` passed from App.
 *
 * confirmState = { open, message, detail, resolve }
 *
 * Usage from App:
 *   const [confirmState, setConfirmState] = useState({ open: false, message: "", detail: "", resolve: null });
 *   const showConfirm = (message, detail = "") =>
 *     new Promise((resolve) => setConfirmState({ open: true, message, detail, resolve }));
 *   const handleConfirm = (ok) => { confirmState.resolve(ok); setConfirmState({ open: false, message: "", detail: "", resolve: null }); };
 */

const ConfirmDialog = ({ confirmState, onConfirm }) => {
  if (!confirmState?.open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(7,29,71,0.55)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          width: "100%",
          maxWidth: 420,
          boxShadow: "0 20px 60px rgba(26,86,219,0.2)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "18px 22px 14px",
            borderBottom: `1px solid ${BLUE.border}`,
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "#fef2f2",
          }}
        >
          <span style={{ color: "#dc2626" }}>
            <Icon name="warning" size={20} />
          </span>
          <span
            style={{ fontSize: 16, fontWeight: 700, color: "#b91c1c" }}
          >
            {confirmState.message}
          </span>
        </div>
        {confirmState.detail && (
          <div
            style={{
              padding: "14px 22px 4px",
              fontSize: 13.5,
              color: "#555",
            }}
          >
            {confirmState.detail}
          </div>
        )}
        <div
          style={{
            padding: "16px 22px",
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          <button
            style={S.btn("secondary")}
            onClick={() => onConfirm(false)}
          >
            Cancelar
          </button>
          <button
            style={S.btn("danger")}
            onClick={() => onConfirm(true)}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
