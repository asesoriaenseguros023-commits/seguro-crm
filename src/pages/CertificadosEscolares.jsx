import { useState } from "react";
import { S, BLUE } from "../constants.js";
import Icon from "../components/Icon.jsx";
import CertificadosCajaPage from "./CertificadosCaja.jsx";
import CertificadosOperativaPage from "./CertificadosOperativa.jsx";

// Entrada al módulo de Certificados Escolares: dos áreas. "Gestión de Caja"
// es el tablero que ya existía (ventas vs certificados, vía Google Sheets).
// "Gestión Operativa" muestra los certificados de cada colegio y sus diferencias con Seguros 2026.

const OPCIONES = [
  { id: "caja", titulo: "Gestión de Caja", icon: "chart", color: BLUE.primary, texto: "Lo vendido frente a lo certificado con la aseguradora, caja por colegio, duplicados y certificados por pagar.", disponible: true },
  { id: "operativa", titulo: "Gestión Operativa", icon: "settings", color: "#f59e0b", texto: "Certificados de cada colegio, si están archivados, diferencias con Seguros 2026 y estudiantes sin certificado.", disponible: true },
];

export default function CertificadosEscolaresPage() {
  const [vista, setVista] = useState("menu");

  if (vista === "caja") return <CertificadosCajaPage onBack={() => setVista("menu")} />;

  if (vista === "operativa") return <CertificadosOperativaPage onBack={() => setVista("menu")} />;

  return (
    <div>
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>Certificados Escolares</div>
          <div style={S.pageSub}>Elige el área con la que quieres trabajar</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, maxWidth: 820 }}>
        {OPCIONES.map((o) => (
          <button key={o.id} onClick={() => setVista(o.id)} style={{
            all: "unset", cursor: "pointer", boxSizing: "border-box", background: "#fff", borderRadius: 14, padding: "26px 26px 24px",
            border: `1px solid ${BLUE.border}`, borderTop: `4px solid ${o.color}`, boxShadow: "0 1px 6px rgba(26,86,219,0.06)",
          }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: BLUE.light, color: o.color, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
              <Icon name={o.icon} size={22} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: BLUE.text, marginBottom: 6 }}>{o.titulo}</div>
            <div style={{ fontSize: 13, color: "#6b87b0", lineHeight: 1.5 }}>{o.texto}</div>
            {!o.disponible && <div style={{ marginTop: 12, fontSize: 11.5, fontWeight: 700, color: "#92400e", background: "#fef3c7", display: "inline-block", padding: "3px 9px", borderRadius: 10 }}>Próximamente</div>}
          </button>
        ))}
      </div>
    </div>
  );
}
