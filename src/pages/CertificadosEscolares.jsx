import { useState, useEffect, useMemo } from "react";
import { S, BLUE } from "../constants.js";
import { fmt, authHeaders } from "../helpers.js";
import Icon from "../components/Icon.jsx";

// Módulo nativo que replica el artefacto "Control de Certificados Escolares"
// — mismo origen de datos (hoja "Control Ejecutivo Colegios", pestañas
// ResumenVentas/Certificados ya calculadas por consolidarDatos() en Apps
// Script), pero vía /api/certificados-data.js en vez de window.claude.use
// ("mcp"), que solo funciona dentro del visor de Artifacts de claude.ai —
// mismo motivo que [[project-pulso-primas]].

const REFETCH_MS = 20 * 60 * 1000;
const COLOR_ACCENT = "#b8923c";
const COLOR_OK = "#16a34a";
const COLOR_WARN = "#dc2626";
const COLOR_MUTED = "#6b87b0";

const fmtNum = new Intl.NumberFormat("es-CO");

const ESTADO_COLOR = (estado) => {
  if (estado === "PAGADO") return COLOR_OK;
  if (estado === "DEBE" || estado === "ANULADO" || estado === "SIN ESTADO") return COLOR_WARN;
  return COLOR_MUTED;
};

const StatCard = ({ label, value, sub, secondary, color }) => (
  <div style={{ background: "#fff", borderRadius: 12, padding: "16px 18px", border: `1px solid ${BLUE.border}`, boxShadow: "0 1px 6px rgba(26,86,219,0.06)" }}>
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#9aa8c7", marginBottom: 8 }}>{label}</div>
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || BLUE.text, letterSpacing: -0.5 }}>{value}</div>
      {secondary && <div style={{ fontSize: 13, fontWeight: 600, color: "#9aa8c7" }}>{secondary}</div>}
    </div>
    {sub && <div style={{ fontSize: 11.5, color: "#9aa8c7", marginTop: 4 }}>{sub}</div>}
  </div>
);

function calcularResumen(resumen) {
  const polizas = resumen.reduce((s, d) => s + d.polizasVendidas, 0);
  const montoPolizas = resumen.reduce((s, d) => s + Math.round(d.polizasVendidas * d.tarifa), 0);
  const duplicados = resumen.reduce((s, d) => s + d.duplicados, 0);
  const montoDuplicados = resumen.reduce((s, d) => s + d.valorDuplicados, 0);
  const polizasUnicas = resumen.reduce((s, d) => s + d.estudiantesAsegurados, 0);
  const montoUnicas = resumen.reduce((s, d) => s + d.valorVendido, 0);
  return { polizas, montoPolizas, duplicados, montoDuplicados, polizasUnicas, montoUnicas };
}

function calcularCaja(certificados, resumen) {
  const totalMonto = certificados.reduce((s, c) => s + c.montoCertificado, 0);
  const valorVendido = resumen.reduce((s, d) => s + Math.round(d.polizasVendidas * d.tarifa), 0);
  const valorDuplicados = resumen.reduce((s, d) => s + d.valorDuplicados, 0);
  const caja = valorVendido - totalMonto;

  const montoPorColegio = {};
  certificados.forEach((c) => { montoPorColegio[c.colegio] = (montoPorColegio[c.colegio] || 0) + c.montoCertificado; });
  const cantidadAsegurados = resumen.reduce((s, d) => {
    if (!d.tarifa) return s;
    return s + (montoPorColegio[d.colegio] || 0) / d.tarifa;
  }, 0);

  return { totalMonto, valorVendido, valorDuplicados, caja, cantidadAsegurados };
}

function calcularRankEstado(certificados) {
  const porEstado = {};
  certificados.forEach((c) => { porEstado[c.estadoPago] = (porEstado[c.estadoPago] || 0) + c.montoCertificado; });
  const total = certificados.reduce((s, c) => s + c.montoCertificado, 0) || 1;
  const claves = Object.keys(porEstado).sort((a, b) => porEstado[b] - porEstado[a]);
  const max = claves.length ? Math.max(...claves.map((k) => porEstado[k])) : 1;
  return claves.map((k) => ({ estado: k, monto: porEstado[k], pct: (porEstado[k] / total) * 100, barPct: Math.max(3, (porEstado[k] / max) * 100) }));
}

const COLUMNAS_CERT = [
  { campo: "colegio", label: "Colegio" },
  { campo: "aseguradora", label: "Aseguradora" },
  { campo: "certificado", label: "Certificado" },
  { campo: "cantidadEstudiantes", label: "Estudiantes", num: true },
  { campo: "montoCertificado", label: "Monto", num: true },
  { campo: "estadoPago", label: "Estado" },
];

export default function CertificadosEscolaresPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const [colegioActivo, setColegioActivo] = useState("todos");
  const [busquedaCert, setBusquedaCert] = useState("");
  const [orden, setOrden] = useState({ campo: "montoCertificado", asc: false });

  useEffect(() => {
    let cancelado = false;
    async function cargarDatos() {
      try {
        const res = await fetch("/api/certificados-data", { headers: await authHeaders() });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || `Error ${res.status} consultando Google Sheets`);
        if (cancelado) return;
        setError("");
        setData(json);
        setLastUpdated(new Date());
      } catch (e) {
        if (!cancelado) setError(e.message || "No se pudo cargar la información.");
      } finally {
        if (!cancelado) { setLoading(false); setRefreshing(false); }
      }
    }
    cargarDatos();
    return () => { cancelado = true; };
  }, [refreshTick]);

  useEffect(() => {
    const id = setInterval(() => { setRefreshing(true); setRefreshTick((t) => t + 1); }, REFETCH_MS);
    return () => clearInterval(id);
  }, []);

  const handleRefreshClick = () => { setRefreshing(true); setRefreshTick((t) => t + 1); };

  const resumen = useMemo(() => data?.resumenVentas || [], [data]);
  const certificados = useMemo(() => data?.certificados || [], [data]);

  const resumenFiltrado = useMemo(
    () => (colegioActivo === "todos" ? resumen : resumen.filter((d) => d.colegio === colegioActivo)),
    [resumen, colegioActivo]
  );
  const certificadosDelColegio = useMemo(
    () => (colegioActivo === "todos" ? certificados : certificados.filter((c) => c.colegio === colegioActivo)),
    [certificados, colegioActivo]
  );
  const certificadosFiltrados = useMemo(() => {
    if (!busquedaCert) return certificadosDelColegio;
    const q = busquedaCert.toLowerCase();
    return certificadosDelColegio.filter((c) =>
      c.colegio.toLowerCase().includes(q) || c.certificado.toLowerCase().includes(q) || c.aseguradora.toLowerCase().includes(q)
    );
  }, [certificadosDelColegio, busquedaCert]);

  const certificadosOrdenados = useMemo(() => {
    const { campo, asc } = orden;
    return [...certificadosFiltrados].sort((a, b) => {
      let va = a[campo], vb = b[campo];
      if (typeof va === "string") { va = va.toLowerCase(); vb = vb.toLowerCase(); }
      if (va < vb) return asc ? -1 : 1;
      if (va > vb) return asc ? 1 : -1;
      return 0;
    });
  }, [certificadosFiltrados, orden]);

  const kpisVentas = useMemo(() => calcularResumen(resumenFiltrado), [resumenFiltrado]);
  const caja = useMemo(() => calcularCaja(certificadosDelColegio, resumenFiltrado), [certificadosDelColegio, resumenFiltrado]);
  const rankEstado = useMemo(() => calcularRankEstado(certificadosDelColegio), [certificadosDelColegio]);

  const cambiarOrden = (campo) => {
    setOrden((prev) => (prev.campo === campo ? { campo, asc: !prev.asc } : { campo, asc: false }));
  };

  if (loading) {
    return (
      <div style={{ padding: "72px 24px", textAlign: "center", color: "#6b87b0" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🎓</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: BLUE.text, marginBottom: 6 }}>Cargando Certificados Escolares…</div>
        <div style={{ fontSize: 13 }}>Consultando "Control Ejecutivo Colegios" en Google Sheets.</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={{ padding: "72px 24px", textAlign: "center", color: "#6b87b0" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: BLUE.text, marginBottom: 6 }}>No se pudo cargar</div>
        <div style={{ fontSize: 13, maxWidth: 420, margin: "0 auto 16px" }}>{error}</div>
        <button style={S.btn("secondary")} onClick={() => { setLoading(true); setRefreshTick((t) => t + 1); }}>Reintentar</button>
      </div>
    );
  }

  return (
    <div>
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>Certificados Escolares</div>
          <div style={S.pageSub}>Ventas de certificados de accidentes escolares por colegio</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {lastUpdated && <span style={{ fontSize: 12, color: "#9aa8c7" }}>Actualizado {lastUpdated.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</span>}
          <button style={S.btn("secondary")} disabled={refreshing} onClick={handleRefreshClick}>
            <Icon name="download" size={14} />{refreshing ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
      </div>

      {data?.errors?.resumen && (
        <div style={S.alertBox("#dc2626")}><Icon name="warning" size={16} /><span style={{ fontSize: 12.5 }}><b>ResumenVentas</b> no se pudo cargar ({data.errors.resumen}).</span></div>
      )}
      {data?.errors?.certificados && (
        <div style={S.alertBox("#dc2626")}><Icon name="warning" size={16} /><span style={{ fontSize: 12.5 }}><b>Certificados</b> no se pudo cargar ({data.errors.certificados}).</span></div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
        <button
          style={{ ...S.btn(colegioActivo === "todos" ? "primary" : "secondary"), padding: "6px 14px", fontSize: 12.5 }}
          onClick={() => setColegioActivo("todos")}
        >
          Todos
        </button>
        {resumen.map((d) => (
          <button
            key={d.colegio}
            style={{ ...S.btn(colegioActivo === d.colegio ? "primary" : "secondary"), padding: "6px 14px", fontSize: 12.5 }}
            onClick={() => setColegioActivo(d.colegio)}
          >
            {d.colegio}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 16 }}>
        <StatCard label="Pólizas vendidas" value={fmtNum.format(kpisVentas.polizas)} secondary={fmt(kpisVentas.montoPolizas)} sub="Filas de BASE sin anulados (incluye duplicados)" color={COLOR_ACCENT} />
        <StatCard label="Duplicados" value={fmtNum.format(kpisVentas.duplicados)} secondary={fmt(kpisVentas.montoDuplicados)} sub="Personas con más de una venta" />
        <StatCard label="Pólizas vendidas únicas" value={fmtNum.format(kpisVentas.polizasUnicas)} secondary={fmt(kpisVentas.montoUnicas)} sub="Sin repetir persona" />
        <StatCard label="Total certificados" value={fmt(caja.totalMonto)} secondary={`${fmtNum.format(certificadosDelColegio.length)} certificados`} sub="Suma de Monto Certificado (VALIDADOR)" color={COLOR_ACCENT} />
        <StatCard label="Cantidad asegurados" value={fmtNum.format(Math.round(caja.cantidadAsegurados))} sub="Total certificados ÷ tarifa del colegio" />
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: "20px 22px", border: `1px solid ${BLUE.border}`, boxShadow: "0 1px 6px rgba(26,86,219,0.06)", marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#9aa8c7", marginBottom: 8 }}>Caja</div>
        <div style={{ fontSize: 34, fontWeight: 700, color: caja.caja < 0 ? COLOR_WARN : caja.caja > 0 ? COLOR_OK : BLUE.text, letterSpacing: -0.5 }}>{fmt(caja.caja)}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${BLUE.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#6b87b0" }}><span>Valor vendido</span><b style={{ color: BLUE.text }}>{fmt(caja.valorVendido)}</b></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#6b87b0" }}><span>Valor duplicados</span><b style={{ color: BLUE.text }}>{fmt(caja.valorDuplicados)}</b></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#6b87b0" }}><span>Valor certificados</span><b style={{ color: BLUE.text }}>{fmt(caja.totalMonto)}</b></div>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: "18px 20px 14px", border: `1px solid ${BLUE.border}`, boxShadow: "0 1px 6px rgba(26,86,219,0.06)", marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#9aa8c7", marginBottom: 14 }}>Certificados por estado de pago</div>
        {rankEstado.length === 0 ? (
          <div style={{ fontSize: 13, color: "#9aa8c7" }}>Sin datos para esta selección.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {rankEstado.map((r) => (
              <div key={r.estado} style={{ display: "grid", gridTemplateColumns: "150px 1fr 110px 46px", gap: 10, alignItems: "center" }}>
                <span style={S.badge(ESTADO_COLOR(r.estado))}>{r.estado}</span>
                <div style={{ background: "#eef1f8", borderRadius: 5, height: 10, overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 5, width: `${r.barPct}%`, background: ESTADO_COLOR(r.estado) }} />
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 700, textAlign: "right" }}>{fmt(r.monto)}</span>
                <span style={{ fontSize: 11, color: "#9aa8c7", textAlign: "right" }}>{r.pct.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: "18px 20px 14px", border: `1px solid ${BLUE.border}`, boxShadow: "0 1px 6px rgba(26,86,219,0.06)", marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#9aa8c7", marginBottom: 14 }}>Detalle de certificados</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ ...S.searchBar, maxWidth: 280 }}>
            <Icon name="search" size={16} />
            <input style={S.searchInput} placeholder="Buscar por colegio, certificado o aseguradora…" value={busquedaCert} onChange={(e) => setBusquedaCert(e.target.value)} />
          </div>
          <span style={{ fontSize: 12, color: "#9aa8c7" }}>{certificadosOrdenados.length} certificados</span>
        </div>
        <div style={{ overflowX: "auto", maxHeight: 440, overflowY: "auto" }}>
          <div style={{ ...S.tableHead, gridTemplateColumns: "1.2fr 1fr 1fr 0.8fr 0.9fr 0.9fr", position: "sticky", top: 0, minWidth: 720 }}>
            {COLUMNAS_CERT.map((c) => (
              <span key={c.campo} style={{ cursor: "pointer", textAlign: c.num ? "right" : "left" }} onClick={() => cambiarOrden(c.campo)}>
                {c.label}{orden.campo === c.campo ? (orden.asc ? " ▲" : " ▼") : ""}
              </span>
            ))}
          </div>
          {certificadosOrdenados.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "#aaa" }}>Sin certificados para este filtro.</div>
          ) : certificadosOrdenados.map((c, i) => (
            <div key={i} style={{ ...S.tableRow, gridTemplateColumns: "1.2fr 1fr 1fr 0.8fr 0.9fr 0.9fr", minWidth: 720 }}>
              <div>{c.colegio}</div>
              <div style={{ fontSize: 12.5, color: "#555" }}>{c.aseguradora}</div>
              <div style={{ fontSize: 12.5 }}>{c.certificado}</div>
              <div style={{ textAlign: "right" }}>{fmtNum.format(c.cantidadEstudiantes)}</div>
              <div style={{ textAlign: "right", fontWeight: 600 }}>{fmt(c.montoCertificado)}</div>
              <div><span style={S.badge(ESTADO_COLOR(c.estadoPago))}>{c.estadoPago}</span></div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: "18px 20px 14px", border: `1px solid ${BLUE.border}`, boxShadow: "0 1px 6px rgba(26,86,219,0.06)", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#9aa8c7", marginBottom: 4 }}>Pólizas vendidas por colegio</div>
        <div style={{ fontSize: 12.5, color: "#6b87b0", margin: "-2px 0 14px" }}>Clic en una fila para filtrar el resto del tablero.</div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ ...S.tableHead, gridTemplateColumns: "1.4fr 1fr 1fr 1fr 0.8fr", minWidth: 640 }}>
            <span>Colegio</span><span>Aseguradora</span><span>Pólizas vendidas</span><span>Valor vendido</span><span>Duplicados</span>
          </div>
          {resumen.map((d) => (
            <div
              key={d.colegio}
              style={{ ...S.tableRow, gridTemplateColumns: "1.4fr 1fr 1fr 1fr 0.8fr", minWidth: 640, cursor: "pointer", background: colegioActivo === d.colegio ? BLUE.light : undefined }}
              onClick={() => setColegioActivo(colegioActivo === d.colegio ? "todos" : d.colegio)}
            >
              <div style={{ fontWeight: 600, color: BLUE.text }}>{d.colegio}</div>
              <div style={{ fontSize: 12.5, color: "#555" }}>{d.aseguradora}</div>
              <div>{fmtNum.format(d.polizasVendidas)}</div>
              <div>{fmt(d.valorVendido)}</div>
              <div>{d.duplicados ? fmtNum.format(d.duplicados) : "—"}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ textAlign: "center", color: "#9aa8c7", fontSize: 11.5, lineHeight: 1.6, marginTop: 8 }}>
        Fuente: "Control Ejecutivo Colegios", pestañas ResumenVentas y Certificados (generadas por consolidarDatos() en Apps Script) · se actualiza sola cada 20 minutos mientras esta pantalla esté abierta.
      </div>
    </div>
  );
}
