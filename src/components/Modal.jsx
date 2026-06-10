import { useEffect } from "react";
import { S } from "../constants.js";
import Icon from "./Icon.jsx";

export const FontLoader = () => {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap";
    document.head.appendChild(link);
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.documentElement.style.margin = "0";
    document.documentElement.style.padding = "0";
    document.body.style.overflowX = "hidden";
  }, []);
  return null;
};

export const LoadingScreen = () => (
  <div
    style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#f0f4ff",
      fontFamily: "'DM Sans', sans-serif",
    }}
  >
    <div style={{ textAlign: "center" }}>
      <div
        style={{ fontSize: 26, fontWeight: 700, color: "#1e3a5f", marginBottom: 8 }}
      >
        Asesoría en Seguros
      </div>
      <div style={{ fontSize: 13, color: "#6b87b0" }}>Cargando datos…</div>
    </div>
  </div>
);

const Modal = ({ title, onClose, children, footer, wide }) => (
  <div
    style={S.overlay}
    onClick={(e) => e.target === e.currentTarget && onClose()}
  >
    <div style={{ ...S.modal, maxWidth: wide ? 720 : 580 }}>
      <div style={S.modalHeader}>
        <span style={S.modalTitle}>{title}</span>
        <button style={S.btn("ghost")} onClick={onClose}>
          <Icon name="x" size={18} />
        </button>
      </div>
      <div style={S.modalBody}>{children}</div>
      {footer && <div style={S.modalFooter}>{footer}</div>}
    </div>
  </div>
);

export default Modal;
