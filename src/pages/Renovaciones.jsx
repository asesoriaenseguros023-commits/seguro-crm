import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../supabase.js";
import { S, BLUE } from "../constants.js";
import { fmt, fmtDate, diasParaVencer, esAdmin } from "../helpers.js";
import Icon from "../components/Icon.jsx";
import Modal from "../components/Modal.jsx";

const RenovacionesPage = ({ polizas, userRol, agenteActualId, onImportPolizas, onUpdatePoliza }) => {
  const [filtro, setFiltro] = useState("30");
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [preview, setPreview] = useState([]);
  const [q, setQ] = useState("");

  const polizasPorRol = esAdmin(userRol)
    ? polizas
    : polizas.filter((p) => p.agenteId === agenteActualId);

  const getCount = (val) =>
    polizasPorRol.filter((p) => {
      const d = diasParaVencer(p.vigenciaFin);
      return val === "vencidas"
        ? p.estado === "Vencida"
        : p.estado === "Activa" && d >= 0 && d <= parseInt(val);
    }).length;

  const candidates = polizasPorRol
    .filter((p) => {
      const d = diasParaVencer(p.vigenciaFin);
      const matchFiltro =
        filtro === "vencidas"
          ? p.estado === "Vencida"
          : p.estado === "Activa" && d >= 0 && d <= parseInt(filtro);
      const matchQ =
        !q ||
        p.numero?.toLowerCase().includes(q.toLowerCase()) ||
        p.clienteNombre?.toLowerCase().includes(q.toLowerCase()) ||
        p.aseguradora?.toLowerCase().includes(q.toLowerCase()) ||
        p.ramo?.toLowerCase().includes(q.toLowerCase());
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

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {[["7","7 días"],["15","15 días"],["30","30 días"],["60","60 días"],["vencidas","Vencidas"]].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFiltro(val)}
            style={{
              padding: "7px 16px", borderRadius: 20,
              border: `1.5px solid ${filtro === val ? BLUE.primary : BLUE.border}`,
              background: filtro === val ? BLUE.light : "#fff",
              color: filtro === val ? BLUE.primary : "#555",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            {label} <span style={{ color: filtro === val ? BLUE.primary : "#aaa" }}>({getCount(val)})</span>
          </button>
        ))}
        <div style={{ ...S.searchBar, marginLeft: "auto" }}>
          <Icon name="search" size={16} />
          <input style={S.searchInput} placeholder="Buscar póliza, cliente, ramo…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {candidates.length === 0 ? (
        <div style={{ ...S.tableWrap, padding: 48, textAlign: "center", color: "#aaa" }}>
          No hay pólizas en este rango.
        </div>
      ) : (
        <div style={S.tableWrap}>
          <div style={{ ...S.tableHead, gridTemplateColumns: "1fr 1.2fr 1.4fr 0.9fr 0.9fr 0.9fr 1fr 1.1fr 0.8fr 150px" }}>
            <span>Fecha</span><span>Póliza</span><span>Tomador</span><span>Prima</span>
            <span>Iva</span><span>Gastos</span><span>Total Pago</span><span>Compañía</span>
            <span>Ramo</span><span>Decisión</span>
          </div>
          {candidates.map((p) => {
            const d = diasParaVencer(p.vigenciaFin);
            const urgColor =
              filtro === "vencidas" ? "#dc2626" : d <= 7 ? "#dc2626" : d <= 15 ? "#d97706" : BLUE.primary;
            const decisionColor =
              { "Cliente renueva": "#16a34a", "Cliente no renueva": "#dc2626" }[p.decisionRenovacion] || "#6b7280";
            return (
              <div
                key={p.id}
                style={{
                  ...S.tableRow,
                  gridTemplateColumns: "1fr 1.2fr 1.4fr 0.9fr 0.9fr 0.9fr 1fr 1.1fr 0.8fr 150px",
                  borderLeft: `3px solid ${urgColor}`,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = BLUE.light)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "")}
              >
                <div style={{ fontSize: 12.5 }}>{fmtDate(p.vigenciaFin)}</div>
                <div style={{ fontWeight: 600, fontSize: 12.5 }}>{p.numero}</div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{p.clienteNombre}</div>
                  {p.clienteTelefono && <div style={{ fontSize: 11, color: "#888" }}>{p.clienteTelefono}</div>}
                </div>
                <div style={{ fontSize: 12.5 }}>{fmt(p.prima || 0)}</div>
                <div style={{ fontSize: 12.5 }}>{fmt(p.iva || 0)}</div>
                <div style={{ fontSize: 12.5 }}>{fmt(p.gastosExpedicion || 0)}</div>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                  {fmt(p.totalPago || (Number(p.prima || 0) + Number(p.iva || 0) + Number(p.gastosExpedicion || 0)))}
                </div>
                <div style={{ fontSize: 12 }}>{p.aseguradora}</div>
                <span style={S.chip(BLUE.primary)}>{p.ramo || "—"}</span>
                <select
                  value={p.decisionRenovacion || ""}
                  onChange={async (e) => {
                    const val = e.target.value;
                    await supabase.from("polizas").update({ decision_renovacion: val }).eq("id", p.id);
                    onUpdatePoliza(p.id, { decisionRenovacion: val });
                  }}
                  style={{
                    fontSize: 11.5, padding: "5px 8px", borderRadius: 8,
                    border: `1.5px solid ${decisionColor}`, color: decisionColor,
                    fontWeight: 600, cursor: "pointer", background: "#fff", width: "100%",
                  }}
                >
                  <option value="">— Decisión —</option>
                  <option value="Cliente renueva">Cliente renueva</option>
                  <option value="Cliente no renueva">Cliente no renueva</option>
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
    </div>
  );
};

export default RenovacionesPage;
