import { useState } from "react";
import { S, BLUE } from "../constants.js";
import Icon from "./Icon.jsx";

// Aviso de "hay una versión nueva" — no se cierra por sí solo ni recarga
// solo. El agente decide cuándo actualizar (ej. no a mitad de una llamada).
const UpdateBanner = ({ updateAvailable, reload }) => {
  const [dismissed, setDismissed] = useState(false);
  if (!updateAvailable || dismissed) return null;

  return (
    <div style={{
      position: "fixed", bottom: 20, left: 20, zIndex: 260,
      background: "#fff", borderRadius: 14, boxShadow: "0 20px 60px rgba(26,86,219,0.25)",
      border: `1px solid ${BLUE.border}`, padding: "14px 16px", minWidth: 260, maxWidth: 320,
      display: "flex", alignItems: "flex-start", gap: 10,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
        background: BLUE.light, color: BLUE.primary,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon name="download" size={15} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: BLUE.text }}>Hay una actualización disponible</div>
        <div style={{ fontSize: 12, color: "#6b87b0", marginTop: 2, marginBottom: 10 }}>
          Guarda lo que estés editando y actualiza cuando puedas.
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={reload} style={{ ...S.btn("primary"), flex: 1, justifyContent: "center", padding: "6px 12px", fontSize: 12.5 }}>
            Actualizar ahora
          </button>
          <button onClick={() => setDismissed(true)} style={{ ...S.btn("ghost"), padding: "6px 10px", fontSize: 12.5 }}>
            Después
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateBanner;
