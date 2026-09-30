import { useState, useEffect, useMemo } from "react";
import { S, BLUE } from "../constants.js";
import { fmt, authHeaders } from "../helpers.js";
import Icon from "../components/Icon.jsx";

// Módulo nativo que replica el artefacto "Oficina SOAT" (ventas, gastos y
// caja del negocio de venta de SOAT) — mismo patrón que [[project-pulso-primas]]
// y Certificados Escolares: el artefacto depende de window.claude.use("mcp"),
// que no funciona fuera del visor de Artifacts de claude.ai, así que este
// módulo pide los datos ya parseados a /api/oficina-soat-data.js.

const REFETCH_MS = 20 * 60 * 1000;
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
// Pedido explícito 2026-09-30: este módulo es parte nativa del CRM, no un
// artefacto embebido — usa el azul de marca del sistema (BLUE.primary),
// igual que Arriendos/SOAT/Configuraciones, en vez de una paleta propia.
const COLOR_VENTAS = BLUE.primary;
const COLOR_CLIENTES = "#f59e0b";
const COLOR_GOOD = "#16a34a";
const COLOR_BAD = "#dc2626";
const GRUPO_COLOR = { Personal: "#1656c9", Servicios: "#1baf7a", Operativos: "#eda100", Depreciaciones: "#4a3aa7", "Sin categoría": "#8b95a3" };
const GRUPOS_ORDEN = ["Personal", "Servicios", "Operativos", "Depreciaciones", "Sin categoría"];

// ---------- formato ----------
const fmtInt = new Intl.NumberFormat("es-CO");
function fmtCOPShort(n) {
  return Math.abs(n) >= 1e6 ? (n < 0 ? "-" : "") + "$" + (Math.abs(n) / 1e6).toFixed(1).replace(".0", "") + "M" : fmt(n);
}

// ---------- fechas ----------
function pad2(n) { return String(n).padStart(2, "0"); }
function addMonths(ym, delta) {
  const y = parseInt(ym.slice(0, 4), 10), m = parseInt(ym.slice(5, 7), 10);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12), nm = (total % 12) + 1;
  return `${ny}-${pad2(nm)}`;
}
function ymLabel(ym) { const y = ym.slice(0, 4), m = parseInt(ym.slice(5, 7), 10); return `${MESES[m - 1]} ${y}`; }
function periodBounds(mode, key) {
  if (mode === "mes") return [key + "-01", addMonths(key, 1) + "-01"];
  const y = parseInt(key, 10);
  return [`${y}-01-01`, `${y + 1}-01-01`];
}
function enRango(f, a, b) { return f >= a && f < b; }
function diasEnMes(ym) { const y = parseInt(ym.slice(0, 4), 10), m = parseInt(ym.slice(5, 7), 10); return new Date(y, m, 0).getDate(); }

// ---------- métricas (idénticas al artefacto) ----------
function calcularPrimeraCompra(soat) {
  const mapa = {};
  const ord = [...soat].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  ord.forEach((r) => { if (!mapa[r.nombre]) mapa[r.nombre] = r.fecha; });
  return mapa;
}

function ventasMetrics(soat, primeraCompra, mode, key) {
  const [start, end] = periodBounds(mode, key);
  const recs = soat.filter((r) => enRango(r.fecha, start, end));
  const count = recs.length;
  const valor = recs.reduce((s, r) => s + r.valor, 0);
  const porCliente = {};
  recs.forEach((r) => {
    if (!porCliente[r.nombre]) porCliente[r.nombre] = { count: 0, valor: 0 };
    porCliente[r.nombre].count++; porCliente[r.nombre].valor += r.valor;
  });
  const nombres = Object.keys(porCliente);
  let nuevos = 0, recurrentes = 0;
  nombres.forEach((n) => { if (enRango(primeraCompra[n], start, end)) nuevos++; else recurrentes++; });
  const pctRecurrencia = nombres.length ? (recurrentes / nombres.length) * 100 : 0;

  const anio = mode === "mes" ? parseInt(key.slice(0, 4), 10) : parseInt(key, 10);
  const yStart = `${anio}-01-01`, yEnd = `${anio + 1}-01-01`;
  const porClienteAnio = {};
  soat.forEach((r) => { if (enRango(r.fecha, yStart, yEnd)) porClienteAnio[r.nombre] = (porClienteAnio[r.nombre] || 0) + 1; });
  const buenosClientes = Object.keys(porClienteAnio).filter((n) => porClienteAnio[n] >= 2).length;

  const tipos = {};
  recs.forEach((r) => { tipos[r.tipo] = (tipos[r.tipo] || 0) + 1; });
  const top = nombres.map((n) => ({ nombre: n, count: porCliente[n].count, valor: porCliente[n].valor })).sort((a, b) => b.valor - a.valor);

  return { count, valor, clientesUnicos: nombres.length, nuevos, recurrentes, pctRecurrencia, buenosClientes, tipos, top };
}

function gastosMetrics(gastos, mode, key) {
  const [start, end] = periodBounds(mode, key);
  const recs = gastos.filter((r) => enRango(r.fecha, start, end));
  const total = recs.reduce((s, r) => s + r.monto, 0);
  const porGrupo = {};
  recs.forEach((r) => {
    if (!porGrupo[r.grupo]) porGrupo[r.grupo] = { valor: 0, count: 0, categorias: {} };
    porGrupo[r.grupo].valor += r.monto; porGrupo[r.grupo].count++;
    porGrupo[r.grupo].categorias[r.categoria] = (porGrupo[r.grupo].categorias[r.categoria] || 0) + r.monto;
  });
  return { total, count: recs.length, porGrupo };
}

// Filas del comparativo — en modo "mes", todas se comparan contra "Este
// mes" (no contra la fila de arriba); en modo "año", los meses se comparan
// encadenados y el total del año contra el año anterior. Mismo criterio que
// el artefacto original.
function filasComparativoVentas(mode, key, m, soat, primeraCompra, minYm, maxYm, anioOptions) {
  const rows = [];
  if (mode === "mes") {
    const etiquetaMes = ymLabel(key).split(" ")[0];
    const candidatos = [
      ["Este mes", key, true],
      ["Mes anterior", addMonths(key, -1), false],
      [`${etiquetaMes} año pasado`, addMonths(key, -12), false],
      [`${etiquetaMes} hace 2 años`, addMonths(key, -24), false],
      [`${etiquetaMes} hace 3 años`, addMonths(key, -36), false],
    ];
    candidatos.forEach(([label, k, hoy]) => {
      if (k < minYm) return;
      const esEsteMes = k === key;
      const mm = esEsteMes ? m : ventasMetrics(soat, primeraCompra, "mes", k);
      rows.push({ label, count: mm.count, valor: mm.valor, hoy, prevCount: esEsteMes ? null : m.count, prevValor: esEsteMes ? null : m.valor });
    });
  } else {
    let prevCount = null, prevValor = null;
    for (let mi = 1; mi <= 12; mi++) {
      const ym2 = `${key}-${pad2(mi)}`;
      if (ym2 > maxYm) break;
      const mm2 = ventasMetrics(soat, primeraCompra, "mes", ym2);
      rows.push({ label: MESES[mi - 1], count: mm2.count, valor: mm2.valor, hoy: ym2 === maxYm, prevCount, prevValor });
      prevCount = mm2.count; prevValor = mm2.valor;
    }
    const py = String(parseInt(key, 10) - 1);
    const prevYear = anioOptions.includes(py) ? ventasMetrics(soat, primeraCompra, "anio", py) : null;
    rows.push({ label: `Total ${key}`, count: m.count, valor: m.valor, total: true, prevCount: prevYear ? prevYear.count : null, prevValor: prevYear ? prevYear.valor : null });
  }
  return rows;
}

function filasComparativoGastos(mode, key, m, gastos, minYm, maxYm, anioOptions) {
  const rows = [];
  if (mode === "mes") {
    const etiquetaMes = ymLabel(key).split(" ")[0];
    const candidatos = [
      ["Este mes", key, true],
      ["Mes anterior", addMonths(key, -1), false],
      [`${etiquetaMes} año pasado`, addMonths(key, -12), false],
      [`${etiquetaMes} hace 2 años`, addMonths(key, -24), false],
    ];
    candidatos.forEach(([label, k, hoy]) => {
      if (k < minYm) return;
      const esEsteMes = k === key;
      const mm = esEsteMes ? m : gastosMetrics(gastos, "mes", k);
      rows.push({ label, total: mm.total, count: mm.count, hoy, prevValor: esEsteMes ? null : m.total });
    });
  } else {
    let prevValor = null;
    for (let mi = 1; mi <= 12; mi++) {
      const ym2 = `${key}-${pad2(mi)}`;
      if (ym2 > maxYm) break;
      const mm2 = gastosMetrics(gastos, "mes", ym2);
      rows.push({ label: MESES[mi - 1], total: mm2.total, count: mm2.count, hoy: ym2 === maxYm, prevValor });
      prevValor = mm2.total;
    }
    const py = String(parseInt(key, 10) - 1);
    const prevYearTotal = anioOptions.includes(py) ? gastosMetrics(gastos, "anio", py).total : null;
    rows.push({ label: `Total ${key}`, total: m.total, count: m.count, esTotal: true, prevValor: prevYearTotal });
  }
  return rows;
}

// ---------- piezas visuales ----------
function deltaInfo(curr, prev) {
  if (prev == null || prev === 0) return null;
  const pct = ((curr - prev) / prev) * 100;
  return { pct, up: pct >= 0 };
}

const DeltaTd = ({ curr, prev }) => {
  const d = deltaInfo(curr, prev);
  if (!d) return <div style={{ textAlign: "right", color: "#aaa" }}>—</div>;
  return <div style={{ textAlign: "right", fontWeight: 700, color: d.up ? COLOR_GOOD : COLOR_BAD }}>{d.up ? "+" : ""}{d.pct.toFixed(0)}%</div>;
};

const KpiTile = ({ color, label, value, hint, hintTone }) => (
  <div style={{ background: "#fff", borderRadius: 10, padding: "13px 15px 14px", border: `1px solid ${BLUE.border}`, borderTop: `3px solid ${color}`, boxShadow: "0 1px 6px rgba(26,86,219,0.06)" }}>
    <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#9aa8c7", marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 800, color: BLUE.text, letterSpacing: -0.3 }}>{value}</div>
    {hint && <div style={{ fontSize: 11.5, marginTop: 4, fontWeight: hintTone ? 700 : 400, color: hintTone === "good" ? COLOR_GOOD : hintTone === "bad" ? COLOR_BAD : "#6b87b0" }}>{hint}</div>}
  </div>
);

// Barras de evolución mensual (una sola serie) con el mes activo resaltado
// — usada para % de recurrencia y clientes nuevos por mes.
function EvolutionChart({ months, values, activeIdx, fmtValue }) {
  const width = 540, height = 170;
  const padL = 8, padR = 8, padT = 10, padB = 20;
  const innerW = width - padL - padR, innerH = height - padT - padB;
  const n = values.length;
  if (!n) return <div style={{ padding: 20, textAlign: "center", color: "#aaa", fontSize: 13 }}>Sin datos.</div>;
  const maxV = Math.max(...values, 0) * 1.15 || 1;
  const slot = innerW / n;
  const xAt = (i) => padL + slot * i + slot / 2;
  const yAt = (v) => padT + innerH - (innerH * v) / maxV;
  const barW = Math.max(2, slot * 0.6);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}>
      {[0, 0.5, 1].map((f, i) => { const gy = padT + innerH * f; return <line key={i} x1={padL} x2={width - padR} y1={gy} y2={gy} stroke={BLUE.border} strokeWidth={1} />; })}
      {activeIdx >= 0 && <rect x={padL + slot * activeIdx} y={padT} width={slot} height={innerH} fill={COLOR_CLIENTES} fillOpacity={0.12} />}
      {values.map((v, i) => {
        const by = yAt(v), bh = padT + innerH - by;
        return (
          <rect key={i} x={xAt(i) - barW / 2} y={by} width={barW} height={Math.max(bh, 0)} rx={2}
            fill={i === activeIdx ? COLOR_CLIENTES : COLOR_VENTAS} fillOpacity={i === activeIdx ? 1 : 0.55}>
            <title>{ymLabel(months[i])}: {fmtValue(v)}</title>
          </rect>
        );
      })}
      {months.map((ym, i) => (i % 6 === 0 || i === n - 1) ? (
        <text key={i} x={xAt(i)} y={height - 5} fontSize={10} fill="#9aa8c7" textAnchor="middle">
          {ymLabel(ym).split(" ")[0].slice(0, 3)} {ymLabel(ym).split(" ")[1].slice(2)}
        </text>
      ) : null)}
    </svg>
  );
}

const Card = ({ title, desc, children }) => (
  <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 6px rgba(26,86,219,0.06)", border: `1px solid ${BLUE.border}`, padding: "18px 20px 16px", marginBottom: 16 }}>
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#9aa8c7", marginBottom: desc ? 4 : 12 }}>{title}</div>
    {desc && <div style={{ fontSize: 12, color: "#9aa8c7", marginBottom: 12 }}>{desc}</div>}
    {children}
  </div>
);

export default function OficinaSoatPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const [tab, setTab] = useState("ventas");
  const [mode, setMode] = useState("mes");
  const [selMes, setSelMes] = useState(null);
  const [selAnio, setSelAnio] = useState(null);
  const [catCols, setCatCols] = useState(null);

  useEffect(() => {
    let cancelado = false;
    async function cargarDatos() {
      try {
        const res = await fetch("/api/sheets-dashboards?tipo=oficina-soat", { headers: await authHeaders() });
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

  const soat = useMemo(() => data?.soat || [], [data]);
  const gastos = useMemo(() => data?.gastos || [], [data]);
  const caja = useMemo(() => data?.caja || [], [data]);
  const primeraCompra = useMemo(() => calcularPrimeraCompra(soat), [soat]);

  const { minYm, maxYm, mesOptions, anioOptions, mesAsc } = useMemo(() => {
    if (!soat.length) return { minYm: null, maxYm: null, mesOptions: [], anioOptions: [], mesAsc: [] };
    const allYm = soat.map((r) => r.fecha.slice(0, 7));
    const mnYm = allYm.reduce((a, b) => (b < a ? b : a));
    const mxYm = allYm.reduce((a, b) => (b > a ? b : a));
    const minY = parseInt(mnYm.slice(0, 4), 10), maxY = parseInt(mxYm.slice(0, 4), 10);
    const meses = []; for (let ym = mxYm; ym >= mnYm; ym = addMonths(ym, -1)) meses.push(ym);
    const anios = []; for (let y = maxY; y >= minY; y--) anios.push(String(y));
    return { minYm: mnYm, maxYm: mxYm, mesOptions: meses, anioOptions: anios, mesAsc: [...meses].reverse() };
  }, [soat]);

  // Se fija una sola vez, apenas llegan los primeros datos — de ahí en
  // adelante el usuario manda con los selectores (mismo criterio que Pulso
  // de Primas para su período por defecto).
  useEffect(() => {
    if (!maxYm) return;
    // Ver nota en App.jsx / PulsoPrimas.jsx: react-hooks/set-state-in-effect
    // solo mira los statements directos del cuerpo del efecto — envolver el
    // setState en una función local definida aquí mismo lo deja conforme.
    function fijarValoresPorDefecto() {
      setSelMes((prev) => prev ?? maxYm);
      setSelAnio((prev) => prev ?? maxYm.slice(0, 4));
      setCatCols((prev) => prev ?? [addMonths(maxYm, -12), addMonths(maxYm, -1), maxYm]);
    }
    fijarValoresPorDefecto();
  }, [maxYm]);

  const key = mode === "mes" ? selMes : selAnio;
  const mVentas = useMemo(() => (key ? ventasMetrics(soat, primeraCompra, mode, key) : null), [soat, primeraCompra, mode, key]);
  const mGastos = useMemo(() => (key ? gastosMetrics(gastos, mode, key) : null), [gastos, mode, key]);

  const baseKey = key ? (mode === "mes" ? addMonths(key, -1) : String(parseInt(key, 10) - 1)) : null;
  const baseDisponible = key && (mode === "mes" ? minYm && baseKey >= minYm : anioOptions.includes(baseKey));
  const mVentasBase = baseDisponible ? ventasMetrics(soat, primeraCompra, mode, baseKey) : null;
  const mGastosBase = baseDisponible ? gastosMetrics(gastos, mode, baseKey) : null;
  const baseLabel = baseKey ? (mode === "mes" ? ymLabel(baseKey) : baseKey) : null;

  const filasVentas = useMemo(() => (mVentas && key ? filasComparativoVentas(mode, key, mVentas, soat, primeraCompra, minYm, maxYm, anioOptions) : []), [mVentas, key, mode, soat, primeraCompra, minYm, maxYm, anioOptions]);
  const filasGastos = useMemo(() => (mGastos && key ? filasComparativoGastos(mode, key, mGastos, gastos, minYm, maxYm, anioOptions) : []), [mGastos, key, mode, gastos, minYm, maxYm, anioOptions]);

  const serieRecurrencia = useMemo(() => mesAsc.map((ym) => ventasMetrics(soat, primeraCompra, "mes", ym).pctRecurrencia), [mesAsc, soat, primeraCompra]);
  const serieNuevos = useMemo(() => mesAsc.map((ym) => ventasMetrics(soat, primeraCompra, "mes", ym).nuevos), [mesAsc, soat, primeraCompra]);
  const activeIdxEvol = key ? mesAsc.indexOf(key) : -1;

  const diaDia = useMemo(() => {
    if (!selMes) return null;
    const ymPasado = addMonths(selMes, -12);
    const nDias = diasEnMes(selMes);
    const porDiaActual = {}, porDiaPasado = {};
    soat.forEach((r) => {
      if (r.fecha.slice(0, 7) === selMes) { const d = parseInt(r.fecha.slice(8, 10), 10); porDiaActual[d] = (porDiaActual[d] || 0) + 1; }
      if (r.fecha.slice(0, 7) === ymPasado) { const d = parseInt(r.fecha.slice(8, 10), 10); porDiaPasado[d] = (porDiaPasado[d] || 0) + 1; }
    });
    return { nDias, porDiaActual, porDiaPasado, labelActual: ymLabel(selMes), labelPasado: ymLabel(ymPasado) };
  }, [soat, selMes]);

  const metricsCatCols = useMemo(() => (catCols ? catCols.map((k2) => gastosMetrics(gastos, "mes", k2)) : []), [catCols, gastos]);
  const gruposCatCols = useMemo(() => {
    const set = new Set();
    metricsCatCols.forEach((mm) => Object.keys(mm.porGrupo).forEach((g) => set.add(g)));
    return GRUPOS_ORDEN.filter((g) => set.has(g));
  }, [metricsCatCols]);

  const ultimoCaja = caja.length ? caja[caja.length - 1] : null;
  const cajaDelMes = useMemo(() => (selMes ? caja.filter((r) => r.fecha.slice(0, 7) === selMes) : []), [caja, selMes]);
  const ingresosMes = cajaDelMes.filter((r) => r.monto > 0).reduce((s, r) => s + r.monto, 0);
  const salidasMes = cajaDelMes.filter((r) => r.monto < 0).reduce((s, r) => s + r.monto, 0);

  if (loading) {
    return (
      <div style={{ padding: "72px 24px", textAlign: "center", color: "#6b87b0" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🚦</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: BLUE.text, marginBottom: 6 }}>Cargando Oficina SOAT…</div>
        <div style={{ fontSize: 13 }}>Consultando ventas, gastos y caja en Google Sheets.</div>
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
  if (!key) {
    return <div style={{ padding: "72px 24px", textAlign: "center", color: "#9aa8c7" }}>Sin pólizas registradas todavía.</div>;
  }

  return (
    <div>
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>Oficina SOAT</div>
          <div style={S.pageSub}>{tab === "ventas" ? "Panel de ventas" : tab === "gastos" ? "Gastos" : "Caja"}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {lastUpdated && <span style={{ fontSize: 12, color: "#9aa8c7" }}>Actualizado {lastUpdated.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</span>}
          <button style={S.btn("secondary")} disabled={refreshing} onClick={handleRefreshClick}>
            <Icon name="download" size={14} />{refreshing ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
      </div>

      {data?.errors?.soat && <div style={S.alertBox("#dc2626")}><Icon name="warning" size={16} /><span style={{ fontSize: 12.5 }}><b>Histórico SOAT</b> no se pudo cargar ({data.errors.soat}).</span></div>}
      {data?.errors?.gastos && <div style={S.alertBox("#dc2626")}><Icon name="warning" size={16} /><span style={{ fontSize: 12.5 }}><b>GASTOS</b> no se pudo cargar ({data.errors.gastos}).</span></div>}
      {data?.errors?.caja && <div style={S.alertBox("#dc2626")}><Icon name="warning" size={16} /><span style={{ fontSize: 12.5 }}><b>CAJA</b> no se pudo cargar ({data.errors.caja}).</span></div>}

      <div style={{ display: "flex", gap: 2, marginBottom: 16, borderBottom: `1px solid ${BLUE.border}` }}>
        {[["ventas", "Panel de ventas"], ["gastos", "Gastos"], ["caja", "Caja"]].map(([id, label]) => (
          <button key={id} style={S.subTabBtn(tab === id)} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      <div style={{ background: "#fff", border: `1px solid ${BLUE.border}`, borderRadius: 10, padding: "10px 14px", marginBottom: 20, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", background: BLUE.light, borderRadius: 8, padding: 3, gap: 2 }}>
          {[["mes", "Mes"], ["anio", "Año"]].map(([id, label]) => (
            <button key={id} onClick={() => setMode(id)} style={{
              border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              background: mode === id ? "#fff" : "transparent", color: mode === id ? BLUE.text : "#6b87b0", boxShadow: mode === id ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
            }}>{label}</button>
          ))}
        </div>
        {mode === "mes" ? (
          <select style={{ ...S.select, width: "auto" }} value={selMes || ""} onChange={(e) => setSelMes(e.target.value)}>
            {mesOptions.map((ym) => <option key={ym} value={ym}>{ymLabel(ym)}</option>)}
          </select>
        ) : (
          <select style={{ ...S.select, width: "auto" }} value={selAnio || ""} onChange={(e) => setSelAnio(e.target.value)}>
            {anioOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
        <span style={{ fontSize: 12, color: "#9aa8c7", marginLeft: "auto" }}>Datos desde {minYm ? ymLabel(minYm) : "—"}</span>
      </div>

      {tab === "ventas" && mVentas && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 12 }}>
            <KpiTile color={COLOR_VENTAS} label="Pólizas" value={fmtInt.format(mVentas.count)} />
            <KpiTile color={COLOR_VENTAS} label="Valor cobrado" value={fmtCOPShort(mVentas.valor)} />
            <KpiTile
              color={COLOR_VENTAS} label="Var. cantidad"
              value={mVentasBase ? `${deltaInfo(mVentas.count, mVentasBase.count)?.up ? "+" : ""}${deltaInfo(mVentas.count, mVentasBase.count)?.pct.toFixed(0)}%` : "—"}
              hint={mVentasBase ? `vs ${baseLabel}` : "sin período anterior"}
              hintTone={mVentasBase ? (deltaInfo(mVentas.count, mVentasBase.count)?.up ? "good" : "bad") : undefined}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 }}>
            <KpiTile color={COLOR_CLIENTES} label="% Recurrencia" value={`${mVentas.pctRecurrencia.toFixed(0)}%`} hint={`${mVentas.recurrentes} de ${mVentas.clientesUnicos}`} />
            <KpiTile color={COLOR_CLIENTES} label="Clientes nuevos" value={fmtInt.format(mVentas.nuevos)} />
            <KpiTile color={COLOR_CLIENTES} label="Clientes antiguos" value={fmtInt.format(mVentas.recurrentes)} hint="ya habían comprado antes" />
            <KpiTile color={COLOR_CLIENTES} label="Buenos clientes" value={fmtInt.format(mVentas.buenosClientes)} hint="2+ compras en el año" />
          </div>

          <Card title={`Comparativo — ${mode === "mes" ? ymLabel(key) : key}`} desc="pólizas y valor cobrado, con variación">
            <div style={{ overflowX: "auto" }}>
              <div style={{ ...S.tableHead, gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr" }}>
                <span>Periodo</span><span style={{ textAlign: "right" }}>Pólizas</span><span style={{ textAlign: "right" }}>Var. cantidad</span><span style={{ textAlign: "right" }}>Valor</span><span style={{ textAlign: "right" }}>Var. valor</span>
              </div>
              {filasVentas.map((r, i) => (
                <div key={i} style={{ ...S.tableRow, gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr", background: r.hoy ? BLUE.light : r.total ? "#f7f8fb" : undefined, fontWeight: r.total ? 700 : 400 }}>
                  <div>{r.label}</div>
                  <div style={{ textAlign: "right" }}>{fmtInt.format(r.count)}</div>
                  <DeltaTd curr={r.count} prev={r.prevCount} />
                  <div style={{ textAlign: "right" }}>{fmt(r.valor)}</div>
                  <DeltaTd curr={r.valor} prev={r.prevValor} />
                </div>
              ))}
            </div>
          </Card>

          <Card title="Tipo de vehículo">
            {Object.keys(mVentas.tipos).length === 0 ? (
              <div style={{ fontSize: 13, color: "#9aa8c7" }}>Sin pólizas en este periodo.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <div style={{ ...S.tableHead, gridTemplateColumns: "1.4fr 1fr 0.8fr" }}>
                  <span>Tipo</span><span style={{ textAlign: "right" }}>Cantidad</span><span style={{ textAlign: "right" }}>%</span>
                </div>
                {Object.entries(mVentas.tipos).sort((a, b) => b[1] - a[1]).map(([t, c]) => {
                  const totalTipos = Object.values(mVentas.tipos).reduce((s, v) => s + v, 0);
                  return (
                    <div key={t} style={{ ...S.tableRow, gridTemplateColumns: "1.4fr 1fr 0.8fr" }}>
                      <div>{t}</div>
                      <div style={{ textAlign: "right" }}>{fmtInt.format(c)}</div>
                      <div style={{ textAlign: "right" }}>{totalTipos ? ((c / totalTipos) * 100).toFixed(0) : 0}%</div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 0 }}>
            <Card title="Evolución de recurrencia" desc="% de clientes que ya habían comprado antes">
              <EvolutionChart months={mesAsc} values={serieRecurrencia} activeIdx={activeIdxEvol} fmtValue={(v) => `${v.toFixed(0)}%`} />
            </Card>
            <Card title="Evolución de clientes nuevos" desc="cantidad de clientes nuevos por mes">
              <EvolutionChart months={mesAsc} values={serieNuevos} activeIdx={activeIdxEvol} fmtValue={(v) => `${fmtInt.format(v)} clientes`} />
            </Card>
          </div>

          <Card title="Top clientes" desc={`${mVentas.top.length} clientes en el periodo`}>
            {mVentas.top.length === 0 ? (
              <div style={{ fontSize: 13, color: "#9aa8c7" }}>Sin datos.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <div style={{ ...S.tableHead, gridTemplateColumns: "1.6fr 1fr 1fr" }}>
                  <span>Cliente</span><span style={{ textAlign: "right" }}>Compras</span><span style={{ textAlign: "right" }}>Valor</span>
                </div>
                {mVentas.top.slice(0, 12).map((c, i) => (
                  <div key={c.nombre} style={{ ...S.tableRow, gridTemplateColumns: "1.6fr 1fr 1fr" }}>
                    <div><span style={{ color: "#9aa8c7", marginRight: 8 }}>{i + 1}</span>{c.nombre}</div>
                    <div style={{ textAlign: "right" }}>{fmtInt.format(c.count)}</div>
                    <div style={{ textAlign: "right" }}>{fmt(c.valor)}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {diaDia && (
            <Card title="Día a día" desc={`${diaDia.labelActual} vs ${diaDia.labelPasado}`}>
              <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
                <div style={{ ...S.tableHead, gridTemplateColumns: "0.6fr 1fr 1fr 1fr 1fr", position: "sticky", top: 0 }}>
                  <span>Día</span><span style={{ textAlign: "right" }}>{diaDia.labelActual}</span><span style={{ textAlign: "right" }}>Acumulado</span><span style={{ textAlign: "right" }}>{diaDia.labelPasado}</span><span style={{ textAlign: "right" }}>Acumulado</span>
                </div>
                {(() => {
                  let acumA = 0, acumP = 0;
                  const filas = [];
                  for (let d = 1; d <= diaDia.nDias; d++) {
                    const cA = diaDia.porDiaActual[d] || 0, cP = diaDia.porDiaPasado[d] || 0;
                    acumA += cA; acumP += cP;
                    filas.push(
                      <div key={d} style={{ ...S.tableRow, gridTemplateColumns: "0.6fr 1fr 1fr 1fr 1fr" }}>
                        <div>{d}</div>
                        <div style={{ textAlign: "right" }}>{fmtInt.format(cA)}</div>
                        <div style={{ textAlign: "right" }}>{fmtInt.format(acumA)}</div>
                        <div style={{ textAlign: "right" }}>{fmtInt.format(cP)}</div>
                        <div style={{ textAlign: "right" }}>{fmtInt.format(acumP)}</div>
                      </div>
                    );
                  }
                  return filas;
                })()}
              </div>
            </Card>
          )}
        </>
      )}

      {tab === "gastos" && mGastos && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 16 }}>
            <KpiTile color={COLOR_VENTAS} label="Total gastado" value={fmtCOPShort(mGastos.total)} />
            <KpiTile
              color={COLOR_VENTAS} label="Var. gastado"
              value={mGastosBase ? `${deltaInfo(mGastos.total, mGastosBase.total)?.up ? "+" : ""}${deltaInfo(mGastos.total, mGastosBase.total)?.pct.toFixed(0)}%` : "—"}
              hint={mGastosBase ? `vs ${baseLabel}` : "sin período anterior"}
              hintTone={mGastosBase ? (deltaInfo(mGastos.total, mGastosBase.total)?.up ? "bad" : "good") : undefined}
            />
            <KpiTile color={COLOR_VENTAS} label="Movimientos" value={fmtInt.format(mGastos.count)} />
            <KpiTile
              color={COLOR_CLIENTES} label="Mayor categoría"
              value={(() => { const arr = Object.entries(mGastos.porGrupo).sort((a, b) => b[1].valor - a[1].valor); return arr.length ? arr[0][0] : "—"; })()}
              hint={(() => { const arr = Object.entries(mGastos.porGrupo).sort((a, b) => b[1].valor - a[1].valor); return arr.length ? fmtCOPShort(arr[0][1].valor) : null; })()}
            />
          </div>

          <Card title={`Comparativo — ${mode === "mes" ? ymLabel(key) : key}`} desc="total gastado por periodo">
            <div style={{ overflowX: "auto" }}>
              <div style={{ ...S.tableHead, gridTemplateColumns: "1.4fr 1fr 1fr 1fr" }}>
                <span>Periodo</span><span style={{ textAlign: "right" }}>Movimientos</span><span style={{ textAlign: "right" }}>Total</span><span style={{ textAlign: "right" }}>Var.</span>
              </div>
              {filasGastos.map((r, i) => (
                <div key={i} style={{ ...S.tableRow, gridTemplateColumns: "1.4fr 1fr 1fr 1fr", background: r.hoy ? BLUE.light : r.esTotal ? "#f7f8fb" : undefined, fontWeight: r.esTotal ? 700 : 400 }}>
                  <div>{r.label}</div>
                  <div style={{ textAlign: "right" }}>{fmtInt.format(r.count)}</div>
                  <div style={{ textAlign: "right" }}>{fmt(r.total)}</div>
                  <DeltaTd curr={r.total} prev={r.prevValor} />
                </div>
              ))}
            </div>
          </Card>

          <Card title="Gastos por categoría" desc="agrupados y estandarizados — elige los 3 meses a comparar">
            {catCols && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                {catCols.map((k2, idx) => (
                  <select key={idx} style={{ ...S.select, width: "auto", flex: 1, minWidth: 140 }} value={k2} onChange={(e) => setCatCols((prev) => prev.map((v, i2) => (i2 === idx ? e.target.value : v)))}>
                    {mesOptions.map((ym) => <option key={ym} value={ym}>{ymLabel(ym)}</option>)}
                  </select>
                ))}
              </div>
            )}
            {gruposCatCols.length === 0 || !catCols ? (
              <div style={{ fontSize: 13, color: "#9aa8c7" }}>Sin gastos en los meses elegidos.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <div style={{ ...S.tableHead, gridTemplateColumns: `1.6fr repeat(${catCols.length}, 1fr)` }}>
                  <span>Categoría</span>{catCols.map((k2) => <span key={k2} style={{ textAlign: "right" }}>{ymLabel(k2)}</span>)}
                </div>
                {gruposCatCols.map((g) => {
                  const catsPresentes = new Set();
                  metricsCatCols.forEach((mm) => { if (mm.porGrupo[g]) Object.keys(mm.porGrupo[g].categorias).forEach((c) => catsPresentes.add(c)); });
                  const ultimo = metricsCatCols[metricsCatCols.length - 1];
                  const catsArr = [...catsPresentes].sort((a, b) => ((ultimo.porGrupo[g] && ultimo.porGrupo[g].categorias[b]) || 0) - ((ultimo.porGrupo[g] && ultimo.porGrupo[g].categorias[a]) || 0));
                  return (
                    <div key={g}>
                      <div style={{ ...S.tableRow, gridTemplateColumns: `1.6fr repeat(${catCols.length}, 1fr)`, background: "#f7f8fb", fontWeight: 700 }}>
                        <div><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: GRUPO_COLOR[g] || "#8b95a3", marginRight: 8 }} />{g}</div>
                        {metricsCatCols.map((mm, i2) => <div key={i2} style={{ textAlign: "right" }}>{fmt((mm.porGrupo[g] && mm.porGrupo[g].valor) || 0)}</div>)}
                      </div>
                      {catsArr.map((c) => (
                        <div key={c} style={{ ...S.tableRow, gridTemplateColumns: `1.6fr repeat(${catCols.length}, 1fr)` }}>
                          <div style={{ paddingLeft: 20, color: "#6b87b0", fontSize: 12.5 }}>{c}</div>
                          {metricsCatCols.map((mm, i2) => <div key={i2} style={{ textAlign: "right", fontSize: 12.5 }}>{fmt((mm.porGrupo[g] && mm.porGrupo[g].categorias[c]) || 0)}</div>)}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}

      {tab === "caja" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 16 }}>
            <KpiTile color={COLOR_VENTAS} label="Saldo en caja" value={ultimoCaja ? fmt(ultimoCaja.saldo) : "Sin datos"} hint={ultimoCaja ? `${ultimoCaja.fecha} — ${ultimoCaja.detalle || ultimoCaja.movimiento}` : null} />
            <KpiTile color={COLOR_VENTAS} label="Ingresos del mes" value={fmtCOPShort(ingresosMes)} hint={selMes ? ymLabel(selMes) : null} />
            <KpiTile color={COLOR_CLIENTES} label="Salidas del mes" value={fmtCOPShort(Math.abs(salidasMes))} hint={selMes ? ymLabel(selMes) : null} />
            <KpiTile color={COLOR_CLIENTES} label="Movimientos" value={fmtInt.format(cajaDelMes.length)} hint={selMes ? ymLabel(selMes) : null} />
          </div>

          <Card title="Movimientos de caja" desc={selMes ? ymLabel(selMes) : ""}>
            {cajaDelMes.length === 0 ? (
              <div style={{ fontSize: 13, color: "#9aa8c7" }}>Sin movimientos en este mes.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <div style={{ ...S.tableHead, gridTemplateColumns: "0.9fr 1fr 1.4fr 1fr 1fr" }}>
                  <span>Fecha</span><span>Movimiento</span><span>Detalle</span><span style={{ textAlign: "right" }}>Monto</span><span style={{ textAlign: "right" }}>Saldo</span>
                </div>
                {cajaDelMes.map((r, i) => (
                  <div key={i} style={{ ...S.tableRow, gridTemplateColumns: "0.9fr 1fr 1.4fr 1fr 1fr" }}>
                    <div>{r.fecha}</div>
                    <div>{r.movimiento}</div>
                    <div style={{ fontSize: 12.5, color: "#6b87b0" }}>{r.detalle}</div>
                    <div style={{ textAlign: "right", fontWeight: 700, color: r.monto < 0 ? COLOR_BAD : COLOR_GOOD }}>{fmt(r.monto)}</div>
                    <div style={{ textAlign: "right" }}>{fmt(r.saldo)}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      <div style={{ textAlign: "center", color: "#9aa8c7", fontSize: 11.5, lineHeight: 1.6, marginTop: 8 }}>
        Ventas y Día a día: hoja "Histórico SOAT". Gastos: hoja "GASTOS". Caja: hoja "CAJA", saldo tal como queda en la última fila registrada. "Cliente nuevo" = su primera compra registrada cae dentro del periodo mostrado. "Buenos clientes" cuenta clientes con 2 o más compras en el año correspondiente. Se actualiza sola cada 20 minutos mientras esta pantalla esté abierta.
      </div>
    </div>
  );
}
