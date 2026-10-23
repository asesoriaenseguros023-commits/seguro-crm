import { useState, useMemo } from "react";
import { S, BLUE } from "../constants.js";
import { fmt } from "../helpers.js";
import { TIPOS, cotizar } from "../tarifasSoat.js";

// Cotizador de SOAT: se elige el tipo de vehículo y, según el tipo, se pide el
// modelo (año), el cilindraje o las toneladas. Tarifas 2026 en tarifasSoat.js.

const campo = { width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 8, border: `1px solid ${BLUE.border}`, fontSize: 14, background: "#fff", color: BLUE.text };
const etiqueta = { display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#9aa8c7", marginBottom: 5 };

export default function Cotizador({ onClose }) {
  const [tipo, setTipo] = useState("");
  const [modelo, setModelo] = useState("");
  const [cc, setCc] = useState("");
  const [ton, setTon] = useState("");
  const [sub, setSub] = useState("");
  const [copiado, setCopiado] = useState(false);

  const t = TIPOS.find((x) => x.id === tipo);
  const pide = t?.pide || [];
  const r = useMemo(() => (tipo ? cotizar({ tipo, modelo, cc, ton, sub }) : null), [tipo, modelo, cc, ton, sub]);

  const cambiarTipo = (v) => { setTipo(v); setModelo(""); setCc(""); setTon(""); setSub(""); setCopiado(false); };

  // Lo que se le copia al cliente: costo del SOAT, tarifa de servicio y total
  // (sin el desglose de prima, contribución y tasa RUNT).
  const texto = r?.tarifa
    ? `SOAT 2026 · ${r.descripcion}\nCosto SOAT: ${fmt(r.tarifa.total)}\nTarifa de servicio: ${fmt(r.servicio)}\nTotal a pagar: ${fmt(r.totalCliente)}`
    : "";
  const copiar = async () => {
    try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* sin permiso de portapapeles */ }
  };

  const opcionesSub = t?.opciones || [];
  const off = (campoNombre) => !!t && !pide.includes(campoNombre);
  const apagado = (c) => (c ? { opacity: 0.45, background: "#f4f6fb" } : null);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(7,29,71,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 16 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 520, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(26,86,219,0.2)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: BLUE.text }}>Cotizar SOAT</div>
            <div style={{ fontSize: 12.5, color: "#6b87b0", marginTop: 2 }}>Tarifas 2026 + costo del servicio · llena los datos del vehículo</div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: "none", border: "none", fontSize: 22, color: "#9aa8c7", cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: "18px 24px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={etiqueta}>Tipo de vehículo</label>
            <select style={campo} value={tipo} onChange={(e) => cambiarTipo(e.target.value)}>
              <option value="">Selecciona…</option>
              {TIPOS.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
            </select>
          </div>

          <div>
            <label style={etiqueta}>Clase / servicio (motocarros y buses)</label>
            <select style={{ ...campo, ...apagado(off("sub")) }} value={sub} disabled={off("sub")} onChange={(e) => setSub(e.target.value)}>
              <option value="">{off("sub") ? "No aplica" : "Selecciona…"}</option>
              {opcionesSub.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={etiqueta}>Modelo (año)</label>
              <input style={{ ...campo, ...apagado(off("modelo")) }} type="number" inputMode="numeric" placeholder="2020" value={modelo} disabled={off("modelo")} onChange={(e) => setModelo(e.target.value)} />
            </div>
            <div>
              <label style={etiqueta}>Cilindraje (c.c.)</label>
              <input style={{ ...campo, ...apagado(off("cc")) }} type="number" inputMode="numeric" placeholder="1600" value={cc} disabled={off("cc")} onChange={(e) => setCc(e.target.value)} />
            </div>
            <div>
              <label style={etiqueta}>Toneladas</label>
              <input style={{ ...campo, ...apagado(off("ton")) }} type="number" inputMode="decimal" placeholder="3" value={ton} disabled={off("ton")} onChange={(e) => setTon(e.target.value)} />
            </div>
          </div>

          {r && (
            <div style={{ borderTop: `1px solid ${BLUE.border}`, paddingTop: 16 }}>
              {r.error ? (
                <div style={{ fontSize: 13, color: "#9aa8c7" }}>{r.error}</div>
              ) : (
                <>
                  <div style={{ fontSize: 12.5, color: "#6b87b0", marginBottom: 4 }}>Tarifa {r.tarifa.codigo} · {r.descripcion}</div>
                  {r.antiguedad !== null && <div style={{ fontSize: 12, color: "#9aa8c7", marginBottom: 8 }}>Antigüedad: {r.antiguedad} {r.antiguedad === 1 ? "año" : "años"} ({r.antiguedad >= 10 ? "10 años o más" : "0 a 9 años"})</div>}
                  <div style={{ fontSize: 34, fontWeight: 700, color: BLUE.primary, letterSpacing: -0.5 }}>{fmt(r.totalCliente)}</div>
                  <div style={{ fontSize: 12, color: "#9aa8c7", marginBottom: 12 }}>Total a pagar (SOAT + servicio)</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#9aa8c7", borderTop: `1px dashed ${BLUE.border}`, paddingTop: 10 }}>
                    <div style={{ fontStyle: "italic" }}>Desglose de la tarifa (prima, contribución y RUNT no se copian al cliente)</div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span>Prima</span><span>{fmt(r.tarifa.prima)}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span>Contribución 52 %</span><span>{fmt(r.tarifa.contribucion)}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span>Tasa RUNT</span><span>{fmt(r.tarifa.runt)}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span>SOAT</span><b style={{ color: BLUE.text }}>{fmt(r.tarifa.total)}</b></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span>Costo del servicio</span><b style={{ color: BLUE.text }}>{fmt(r.servicio)}</b></div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                    <button style={S.btn("primary")} onClick={copiar}>{copiado ? "✓ Copiado" : "Copiar para el cliente"}</button>
                    <button style={S.btn("secondary")} onClick={() => cambiarTipo("")}>Nueva cotización</button>
                  </div>
                  <div style={{ fontSize: 11, color: "#9aa8c7", marginTop: 12 }}>Los descuentos para vehículos eléctricos y a gas (GNV y GLP) se mantienen según la Ley 1964 de 2019 y la Ley 2128 de 2021.</div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
