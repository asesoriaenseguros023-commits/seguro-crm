import { useState } from "react";
import * as XLSX from "xlsx";
import { S, BLUE } from "../constants.js";
import { fmt, fmtDate, diasParaVencer, esAdmin } from "../helpers.js";
import Icon from "../components/Icon.jsx";
import Modal from "../components/Modal.jsx";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const RenovacionesPage = ({ polizas, userRol, agenteActualId, onImportPolizas, onDecisionRenovacion }) => {
  // Todo anclado al reloj/fecha real del sistema, nunca un valor fijo — por
  // defecto solo el mes en curso, no un rango de días como antes.
  const [anio, setAnio] = useState(() => String(new Date().getFullYear()));
  const [mes, setMes] = useState(() => MESES[new Date().getMonth()]);
  const [vista, setVista] = useState("porVencer"); // porVencer | vencidas | cotiza | noInteres
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [preview, setPreview] = useState([]);
  const [q, setQ] = useState("");
  const [busquedaModo, setBusquedaModo] = useState("cliente");
  const [avisoYaExiste, setAvisoYaExiste] = useState(null);

  const polizasPorRol = esAdmin(userRol)
    ? polizas
    : polizas.filter((p) => p.agenteId === agenteActualId);

  const anios = Array.from(new Set([
    String(new Date().getFullYear()),
    ...polizasPorRol.map((p) => (p.vigenciaFin || "").substring(0, 4)).filter(Boolean),
  ])).sort().reverse();

  const enMesSeleccionado = (p) => {
    const f = p.vigenciaFin || "";
    return f.startsWith(anio) && f.substring(5, 7) === String(MESES.indexOf(mes) + 1).padStart(2, "0");
  };

  const cantidadMes = polizasPorRol.filter((p) => p.estado === "Activa" && enMesSeleccionado(p)).length;
  const cantidadVencidas = polizasPorRol.filter((p) => p.estado === "Vencida").length;
  const cantidadCotiza = polizasPorRol.filter((p) => p.decisionRenovacion === "Cliente Cotiza").length;
  const cantidadNoInteres = polizasPorRol.filter((p) => p.decisionRenovacion === "Cliente No Interesado").length;

  const candidates = polizasPorRol
    .filter((p) => {
      const matchFiltro =
        vista === "vencidas" ? p.estado === "Vencida"
        : vista === "cotiza" ? p.decisionRenovacion === "Cliente Cotiza"
        : vista === "noInteres" ? p.decisionRenovacion === "Cliente No Interesado"
        : p.estado === "Activa" && enMesSeleccionado(p);
      const matchQ =
        !q ||
        (busquedaModo === "poliza"
          ? p.numero?.toLowerCase().includes(q.toLowerCase())
          : p.clienteNombre?.toLowerCase().includes(q.toLowerCase()));
      return matchFiltro && matchQ;
    })
    .sort((a, b) => diasParaVencer(a.vigenciaFin) - diasParaVencer(b.vigenciaFin));

  const parseExcelDate = (val) => {
    if (!val) return null;
    const s = String(val).trim();
    if (/^\d+$/.test(s)) {
      const d = new Date(Math.round((parseInt(s) - 25569) * 86400 * 1000));
      return d.toISOString().split("T")[0];
    }
    const parts = s.split(/[/-]/);
    if (parts.length === 3) {
      const [a, b, c] = parts;
      if (c.length === 4) return `${c}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
      if (a.length === 4) return `${a}-${b.padStart(2, "0")}-${c.padStart(2, "0")}`;
    }
    return s;
  };

  const parseCurrency = (val) => {
    if (!val && val !== 0) return 0;
    return parseFloat(String(val).replace(/[^0-9.-]/g, "")) || 0;
  };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportMsg("Leyendo archivo…");
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const mapped = rows
        .map((r, i) => {
          const keys = Object.keys(r);
          const get = (...names) => {
            for (const n of names) {
              const k = keys.find((k) => k.toLowerCase().includes(n.toLowerCase()));
              if (k) return r[k];
            }
            return "";
          };
          const fechaRaw = parseExcelDate(get("fecha"));
          const fechaVig = fechaRaw
            ? (() => {
                const d = new Date(fechaRaw);
                d.setFullYear(d.getFullYear() + 1);
                return d.toISOString().split("T")[0];
              })()
            : null;
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
        })
        .filter((r) => r.numero || r.clienteNombre);
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
      setImportMsg(`${preview.length} pólizas importadas correctamente.`);
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
        <div>
          <div style={S.pageTitle}>Renovaciones</div>
          <div style={S.pageSub}>Pólizas por vencer y vencidas</div>
        </div>
        <button style={S.btn("secondary")} onClick={() => setShowImport(true)}>
          <Icon name="upload" size={16} />Importar Pólizas Excel
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 20 }}>
        {[
          { key: "porVencer", label: `Por vencer — ${mes} ${anio}`, valor: cantidadMes, color: BLUE.primary },
          { key: "vencidas", label: "Vencidas", valor: cantidadVencidas, color: "#dc2626" },
          { key: "cotiza", label: "Cliente Cotiza", valor: cantidadCotiza, color: "#16a34a" },
          { key: "noInteres", label: "Cliente No Interesado", valor: cantidadNoInteres, color: "#6b7280" },
        ].map((c) => (
          <div
            key={c.key}
            onClick={() => setVista(c.key)}
            style={{
              background: "#fff", borderRadius: 12, padding: "18px 20px", cursor: "pointer",
              borderTop: `3px solid ${c.color}`, boxShadow: vista === c.key ? `0 4px 12px ${c.color}30` : "0 1px 6px rgba(26,86,219,0.08)",
              outline: vista === c.key ? `1.5px solid ${c.color}` : "none",
            }}
          >
            <div style={{ ...S.statNum, color: c.color }}>{c.valor}</div>
            <div style={S.statLabel}>{c.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", border: `1px solid ${BLUE.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
          {vista === "porVencer" && (
            <>
              <select style={{ ...S.select, width: "auto", padding: "7px 12px" }} value={anio} onChange={(e) => setAnio(e.target.value)}>
                {anios.map((a) => <option key={a}>{a}</option>)}
              </select>
              <select style={{ ...S.select, width: "auto", padding: "7px 12px" }} value={mes} onChange={(e) => setMes(e.target.value)}>
                {MESES.map((m) => <option key={m}>{m}</option>)}
              </select>
            </>
          )}
        </div>
        <div style={{ display: "flex", gap: 0, marginBottom: 10, borderRadius: 8, overflow: "hidden", width: "fit-content", border: `1px solid ${BLUE.border}` }}>
          {[["cliente", "Cliente"], ["poliza", "Póliza"]].map(([modo, label]) => (
            <button key={modo} onClick={() => { setBusquedaModo(modo); setQ(""); }}
              style={{ padding: "6px 18px", fontSize: 13, fontWeight: busquedaModo === modo ? 700 : 400, background: busquedaModo === modo ? BLUE.primary : "#fff", color: busquedaModo === modo ? "#fff" : "#555", border: "none", cursor: "pointer", transition: "all 0.15s" }}>
              {label}
            </button>
          ))}
        </div>
        <div style={S.searchBar}>
          <Icon name="search" size={16} />
          <input style={S.searchInput}
            placeholder={busquedaModo === "poliza" ? "Número de póliza…" : "Nombre del cliente…"}
            value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {candidates.length === 0 ? (
        <div style={{ ...S.tableWrap, padding: 48, textAlign: "center", color: "#aaa" }}>
          No hay pólizas en este rango.
        </div>
      ) : (
        <div style={S.tableWrap}>
          <div style={{ ...S.tableHead, gridTemplateColumns: "36px 1fr 1.2fr 1.4fr 1fr 1.1fr 0.8fr 150px" }}>
            <span>#</span><span>Fecha</span><span>Póliza</span><span>Tomador</span>
            <span>Total Pago</span><span>Compañía</span><span>Ramo</span><span>Decisión</span>
          </div>
          {candidates.map((p, idx) => {
            const d = diasParaVencer(p.vigenciaFin);
            const urgColor =
              vista === "vencidas" ? "#dc2626" : d <= 7 ? "#dc2626" : d <= 15 ? "#d97706" : BLUE.primary;
            const decisionColor =
              { "Cliente Cotiza": "#16a34a", "Cliente No Interesado": "#dc2626" }[p.decisionRenovacion] || "#6b7280";
            return (
              <div
                key={p.id}
                style={{
                  ...S.tableRow,
                  gridTemplateColumns: "36px 1fr 1.2fr 1.4fr 1fr 1.1fr 0.8fr 150px",
                  borderLeft: `3px solid ${urgColor}`,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = BLUE.light)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "")}
              >
                <div style={{ fontWeight: 700, color: "#bbb", fontSize: 12 }}>{idx + 1}</div>
                <div style={{ fontSize: 12.5 }}>{fmtDate(p.vigenciaFin)}</div>
                <div style={{ fontWeight: 600, fontSize: 12.5 }}>{p.numero}</div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{p.clienteNombre}</div>
                  {p.clienteTelefono && <div style={{ fontSize: 11, color: "#888" }}>{p.clienteTelefono}</div>}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                  {fmt(p.totalPago || (Number(p.prima || 0) + Number(p.iva || 0) + Number(p.gastosExpedicion || 0)))}
                </div>
                <div style={{ fontSize: 12 }}>{p.aseguradora}</div>
                <span style={S.chip(BLUE.primary)}>{p.ramo || "—"}</span>
                <select
                  value={p.decisionRenovacion || ""}
                  onChange={async (e) => {
                    const val = e.target.value;
                    if (!val) return;
                    const res = await onDecisionRenovacion(p, val);
                    if (res?.yaExistia) setAvisoYaExiste(p.clienteNombre || "este cliente");
                  }}
                  style={{
                    fontSize: 11.5, padding: "5px 8px", borderRadius: 8,
                    border: `1.5px solid ${decisionColor}`, color: decisionColor,
                    fontWeight: 600, cursor: "pointer", background: "#fff", width: "100%",
                  }}
                >
                  <option value="">— Decisión —</option>
                  <option value="Cliente Cotiza">Cliente Cotiza</option>
                  <option value="Cliente No Interesado">Cliente No Interesado</option>
                </select>
              </div>
            );
          })}
        </div>
      )}

      {showImport && (
        <Modal
          title="Importar Pólizas desde Excel"
          onClose={() => { setShowImport(false); setPreview([]); setImportMsg(""); }}
          wide
          footer={
            <>
              <button style={S.btn("secondary")} onClick={() => { setShowImport(false); setPreview([]); setImportMsg(""); }}>Cancelar</button>
              {preview.length > 0 && (
                <button
                  style={{ ...S.btn("primary"), opacity: importing ? 0.6 : 1 }}
                  onClick={handleImport}
                  disabled={importing}
                >
                  {importing ? "Importando…" : `Importar ${preview.length} pólizas`}
                </button>
              )}
            </>
          }
        >
          <div style={{ background: BLUE.light, border: `1px solid ${BLUE.border}`, borderRadius: 10, padding: "14px 18px", marginBottom: 16, fontSize: 13, color: BLUE.text }}>
            <strong>Columnas esperadas en el Excel:</strong><br />
            Fecha · Poliza · Tomador · Telefono · Prima · Iva · Gastos · Total Pago · Compañia · Ramo
            <div style={{ marginTop: 6, fontSize: 12, color: "#6b87b0" }}>
              La vigencia se calcula automáticamente como +1 año desde la fecha.
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ ...S.btn("primary"), display: "inline-flex", cursor: "pointer" }}>
              <Icon name="upload" size={16} />Seleccionar archivo .xlsx
              <input type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: "none" }} />
            </label>
          </div>
          {importMsg && (
            <div style={{
              background: importMsg.startsWith("Error") ? "#fef2f2" : BLUE.light,
              border: `1px solid ${importMsg.startsWith("Error") ? "#fecaca" : BLUE.border}`,
              borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 12,
            }}>
              {importMsg}
            </div>
          )}
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
              {preview.length > 20 && (
                <div style={{ padding: "8px 18px", fontSize: 12, color: "#888" }}>
                  ...y {preview.length - 20} más
                </div>
              )}
            </div>
          )}
        </Modal>
      )}

      {avisoYaExiste && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(7,29,71,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 16 }} onClick={() => setAvisoYaExiste(null)}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 380, padding: "24px 28px", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: 16, color: BLUE.text, marginBottom: 8 }}>Ya está en cotización</div>
            <p style={{ fontSize: 13.5, color: "#555", marginBottom: 18 }}>
              <strong>{avisoYaExiste}</strong> ya tiene una cotización creada por esta renovación — no se creó una nueva, pero el cambio quedó guardado.
            </p>
            <button style={{ ...S.btn("primary"), width: "100%", justifyContent: "center" }} onClick={() => setAvisoYaExiste(null)}>Entendido</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RenovacionesPage;
