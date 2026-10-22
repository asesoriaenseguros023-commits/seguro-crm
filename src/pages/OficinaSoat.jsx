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

const KpiTile = ({ color, label, value, hint, hintTone, onClick }) => (
  <div onClick={onClick} title={onClick ? "Ver detalle" : undefined} style={{ background: "#fff", borderRadius: 10, padding: "13px 15px 14px", border: `1px solid ${BLUE.border}`, borderTop: `3px solid ${color}`, boxShadow: "0 1px 6px rgba(26,86,219,0.06)", cursor: onClick ? "pointer" : "default" }}>
    <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#9aa8c7", marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 800, color: BLUE.text, letterSpacing: -0.3 }}>{value}</div>
    {hint && <div style={{ fontSize: 11.5, marginTop: 4, fontWeight: hintTone ? 700 : 400, color: hintTone === "good" ? COLOR_GOOD : hintTone === "bad" ? COLOR_BAD : "#6b87b0" }}>{hint}</div>}
    {onClick && <div style={{ fontSize: 11, marginTop: 5, color: BLUE.primary, fontWeight: 600 }}>Ver detalle →</div>}
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

// ---------- detalle (drill-down) ----------
const DIAS_SEM = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
function fmtFecha(iso) { return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—"; }
function diaSemana(iso) { const [y, m, d] = iso.split("-").map(Number); return DIAS_SEM[new Date(y, m - 1, d).getDay()]; }
function masReciente(a, b) { return a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0; }
function ventasDe(soat, start, end) { return soat.filter((r) => enRango(r.fecha, start, end)).sort(masReciente); }

// Agrupa ventas por cliente. `primeraCompra` es el mapa global (no solo del
// periodo) para poder mostrar desde cuándo es cliente.
function agruparClientes(recs, primeraCompra) {
  const m = {};
  recs.forEach((r) => {
    const c = m[r.nombre] || (m[r.nombre] = { nombre: r.nombre, count: 0, valor: 0, ultima: "", telefono: "" });
    c.count++; c.valor += r.valor;
    if (r.fecha > c.ultima) { c.ultima = r.fecha; if (r.telefono) c.telefono = r.telefono; }
    if (!c.telefono && r.telefono) c.telefono = r.telefono;
  });
  return Object.values(m).map((c) => ({ ...c, primera: primeraCompra[c.nombre] })).sort((a, b) => b.valor - a.valor);
}

function fmtDiaCorto(iso) { return `${diaSemana(iso).slice(0, 3)} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`; }

const COLS_VENTAS = "0.85fr 1.7fr 1fr 1.1fr 0.9fr 1fr 0.9fr";
const COLS_CLIENTES = "1.8fr 1fr 0.6fr 0.9fr 0.9fr 1fr";

function DetalleModal({ detalle, canBack, onBack, onClose, onCliente }) {
  const [q, setQ] = useState("");
  const qn = q.trim().toUpperCase();
  const esVentas = detalle.tipo === "ventas";
  const filas = useMemo(() => {
    const base = esVentas ? detalle.ventas : detalle.clientes;
    if (!qn) return base;
    return base.filter((r) => r.nombre.includes(qn) || (r.telefono || "").includes(qn) || (r.placa || "").includes(qn));
  }, [detalle, esVentas, qn]);
  const totalValor = filas.reduce((sum, r) => sum + r.valor, 0);
  const totalPolizas = esVentas ? filas.length : filas.reduce((sum, r) => sum + r.count, 0);

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal, maxWidth: 940 }} onClick={(e) => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <div>
            <div style={S.modalTitle}>{detalle.titulo}</div>
            {detalle.sub && <div style={{ fontSize: 12.5, color: "#6b87b0", marginTop: 3 }}>{detalle.sub}</div>}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {canBack && <button style={S.btn("secondary")} onClick={onBack}>← Volver</button>}
            <button style={S.btn("secondary")} onClick={onClose}>Cerrar</button>
          </div>
        </div>
        <div style={{ padding: "14px 24px 6px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input style={{ ...S.input, flex: 1, minWidth: 200 }} placeholder="Buscar por nombre, teléfono o placa…" value={q} onChange={(e) => setQ(e.target.value)} />
          <span style={{ fontSize: 12.5, color: "#6b87b0" }}>
            <b style={{ color: BLUE.text }}>{fmtInt.format(totalPolizas)}</b> {esVentas ? "pólizas" : "compras"}{!esVentas && <> · <b style={{ color: BLUE.text }}>{fmtInt.format(filas.length)}</b> clientes</>} · <b style={{ color: BLUE.text }}>{fmt(totalValor)}</b>
          </span>
        </div>
        <div style={{ padding: "6px 24px 20px" }}>
          {filas.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "#9aa8c7", fontSize: 13 }}>Sin resultados.</div>
          ) : (
            <div style={{ overflowX: "auto", maxHeight: "60vh", overflowY: "auto", border: `1px solid ${BLUE.border}`, borderRadius: 8 }}>
              <div style={{ minWidth: 720 }}>
                {esVentas ? (
                  <>
                    <div style={{ ...S.tableHead, gridTemplateColumns: COLS_VENTAS, position: "sticky", top: 0 }}>
                      <span>Fecha</span><span>Cliente</span><span>Teléfono</span><span>Tipo</span><span>Placa</span><span>Pago</span><span style={{ textAlign: "right" }}>Valor</span>
                    </div>
                    {filas.map((r, i) => (
                      <div key={i} style={{ ...S.tableRow, gridTemplateColumns: COLS_VENTAS, padding: "10px 18px", fontSize: 13 }}>
                        <div>{fmtFecha(r.fecha)}</div>
                        <div><button onClick={() => onCliente(r.nombre)} style={{ all: "unset", cursor: "pointer", color: BLUE.primary, fontWeight: 600 }}>{r.nombre}</button></div>
                        <div style={{ color: "#6b87b0" }}>{r.telefono || "—"}</div>
                        <div>{r.tipo}</div>
                        <div style={{ fontFamily: "monospace" }}>{r.placa || "—"}</div>
                        <div style={{ fontSize: 12 }}>{r.medio}</div>
                        <div style={{ textAlign: "right", fontWeight: 700 }}>{fmt(r.valor)}</div>
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    <div style={{ ...S.tableHead, gridTemplateColumns: COLS_CLIENTES, position: "sticky", top: 0 }}>
                      <span>Cliente</span><span>Teléfono</span><span style={{ textAlign: "right" }}>Compras</span><span style={{ textAlign: "right" }}>Valor</span><span style={{ textAlign: "right" }}>Cliente desde</span><span style={{ textAlign: "right" }}>Última compra</span>
                    </div>
                    {filas.map((c) => (
                      <div key={c.nombre} onClick={() => onCliente(c.nombre)} style={{ ...S.tableRow, gridTemplateColumns: COLS_CLIENTES, padding: "10px 18px", fontSize: 13, cursor: "pointer" }}>
                        <div style={{ color: BLUE.primary, fontWeight: 600 }}>{c.nombre}</div>
                        <div style={{ color: "#6b87b0" }}>{c.telefono || "—"}</div>
                        <div style={{ textAlign: "right" }}>{fmtInt.format(c.count)}</div>
                        <div style={{ textAlign: "right", fontWeight: 700 }}>{fmt(c.valor)}</div>
                        <div style={{ textAlign: "right" }}>{fmtFecha(c.primera)}</div>
                        <div style={{ textAlign: "right" }}>{fmtFecha(c.ultima)}</div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Dos líneas acumuladas (mes actual vs mismo mes del año pasado); marca el día elegido.
function AcumuladoChart({ cumA, cumP, dia, tope, labelA, labelP }) {
  const width = 640, height = 190, padL = 34, padR = 10, padT = 12, padB = 22;
  const n = Math.max(cumA.length, cumP.length);
  const maxV = Math.max(...cumA, ...cumP, 1) * 1.1;
  const x = (d) => padL + ((width - padL - padR) * (d - 1)) / Math.max(n - 1, 1);
  const y = (v) => padT + (height - padT - padB) * (1 - v / maxV);
  const linea = (arr, hasta) => arr.slice(0, hasta).map((v, k) => `${k ? "L" : "M"}${x(k + 1).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {[0, 0.5, 1].map((f, i) => <g key={i}><line x1={padL} x2={width - padR} y1={y(maxV / 1.1 * f)} y2={y(maxV / 1.1 * f)} stroke={BLUE.border} /><text x={padL - 5} y={y(maxV / 1.1 * f) + 3} fontSize={10} fill="#9aa8c7" textAnchor="end">{Math.round(maxV / 1.1 * f)}</text></g>)}
        <line x1={x(dia)} x2={x(dia)} y1={padT} y2={height - padB} stroke={COLOR_CLIENTES} strokeDasharray="3 3" />
        <path d={linea(cumP, cumP.length)} fill="none" stroke={COLOR_CLIENTES} strokeWidth={2} />
        <path d={linea(cumA, tope)} fill="none" stroke={COLOR_VENTAS} strokeWidth={2.5} />
        {[1, 5, 10, 15, 20, 25, n].filter((d, i, a) => d <= n && a.indexOf(d) === i).map((d) => <text key={d} x={x(d)} y={height - 6} fontSize={10} fill="#9aa8c7" textAnchor="middle">{d}</text>)}
      </svg>
      <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#6b87b0", justifyContent: "center" }}>
        <span><span style={{ display: "inline-block", width: 12, height: 3, background: COLOR_VENTAS, marginRight: 6, verticalAlign: "middle" }} />{labelA}</span>
        <span><span style={{ display: "inline-block", width: 12, height: 3, background: COLOR_CLIENTES, marginRight: 6, verticalAlign: "middle" }} />{labelP}</span>
      </div>
    </div>
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
  const [pila, setPila] = useState([]);
  const [diaSel, setDiaSel] = useState(null);
  const [diaAcum, setDiaAcum] = useState(null);
  const [mesAcum, setMesAcum] = useState(null);
  const [verEvol, setVerEvol] = useState(false);

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

  const ultimaFecha = useMemo(() => soat.reduce((mx, r) => (r.fecha > mx ? r.fecha : mx), ""), [soat]);

  // Acumulado del mes hasta un día D, contra el mismo día del año pasado.
  // Con el mes en curso el tope es el último día con datos; en un mes cerrado,
  // el último día del mes.
  const mesAcumActivo = mesAcum && mesOptions.includes(mesAcum) ? mesAcum : selMes;
  const acum = useMemo(() => {
    if (!mesAcumActivo) return null;
    const ymPas = addMonths(mesAcumActivo, -12);
    const nA = diasEnMes(mesAcumActivo), nP = diasEnMes(ymPas);
    const tope = ultimaFecha && ultimaFecha.slice(0, 7) === mesAcumActivo ? parseInt(ultimaFecha.slice(8, 10), 10) : nA;
    const dia = Math.max(1, Math.min(diaAcum ?? tope, tope));
    const diaPas = Math.min(dia, nP);
    const porDia = (ym, n) => {
      const c = Array(n + 1).fill(0), v = Array(n + 1).fill(0);
      soat.forEach((r) => { if (r.fecha.slice(0, 7) === ym) { const d = parseInt(r.fecha.slice(8, 10), 10); c[d]++; v[d] += r.valor; } });
      return { c, v };
    };
    const A = porDia(mesAcumActivo, nA), P = porDia(ymPas, nP);
    const hasta = (x, d) => ({ count: x.c.slice(1, d + 1).reduce((a, b) => a + b, 0), valor: x.v.slice(1, d + 1).reduce((a, b) => a + b, 0) });
    const cum = (x, n) => { let a = 0; return Array.from({ length: n }, (_, k) => (a += x.c[k + 1])); };
    return {
      dia, tope, nA, nP, ymPas,
      actual: hasta(A, dia), pasado: hasta(P, diaPas),
      finActual: hasta(A, nA), finPasado: hasta(P, nP),
      mesCompleto: tope === nA,
      cumA: cum(A, nA), cumP: cum(P, nP),
      porDiaA: A.c, porDiaP: P.c,
    };
  }, [soat, mesAcumActivo, ultimaFecha, diaAcum]);

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

  const diaActivo = diaSel || ultimaFecha;
  const ventasDia = useMemo(() => (diaActivo ? soat.filter((r) => r.fecha === diaActivo) : []), [soat, diaActivo]);

  const [ventasPeriodo, mediosPeriodo] = useMemo(() => {
    if (!key) return [[], []];
    const [a, b] = periodBounds(mode, key);
    const recs = ventasDe(soat, a, b);
    const m = {};
    recs.forEach((r) => { const x = m[r.medio] || (m[r.medio] = { medio: r.medio, count: 0, valor: 0 }); x.count++; x.valor += r.valor; });
    return [recs, Object.values(m).sort((x, y) => y.valor - x.valor)];
  }, [soat, mode, key]);

  const resumenPeriodo = useMemo(() => {
    if (!ventasPeriodo.length) return null;
    const porDia = {};
    ventasPeriodo.forEach((r) => { const d = (porDia[r.fecha] ||= { fecha: r.fecha, count: 0, valor: 0 }); d.count++; d.valor += r.valor; });
    const dias = Object.values(porDia);
    const mejor = dias.reduce((a, b) => (b.valor > a.valor ? b : a));
    const valor = ventasPeriodo.reduce((sum, r) => sum + r.valor, 0);
    return { diasConVentas: dias.length, mejor, ticket: valor / ventasPeriodo.length, promedioDia: valor / dias.length };
  }, [ventasPeriodo]);

  const abrir = (d) => setPila((p) => [...p, d]);
  const abrirCliente = (nombre) => {
    const v = soat.filter((r) => r.nombre === nombre).sort(masReciente);
    abrir({ titulo: nombre, sub: `Historial completo · ${v.length} compra${v.length === 1 ? "" : "s"}`, tipo: "ventas", ventas: v });
  };
  const etiquetaPeriodo = key ? (mode === "mes" ? ymLabel(key) : key) : "";
  const abrirVentas = (titulo, ventas) => abrir({ titulo, sub: etiquetaPeriodo, tipo: "ventas", ventas });
  const abrirClientes = (titulo, nombresSet) => {
    const recs = ventasPeriodo.filter((r) => nombresSet.has(r.nombre));
    abrir({ titulo, sub: etiquetaPeriodo, tipo: "clientes", clientes: agruparClientes(recs, primeraCompra) });
  };
  const abrirDia = (iso) => abrir({ titulo: `Ventas del ${fmtFecha(iso)}`, sub: diaSemana(iso), tipo: "ventas", ventas: soat.filter((r) => r.fecha === iso) });

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
            <KpiTile color={COLOR_VENTAS} label="Pólizas" value={fmtInt.format(mVentas.count)} onClick={() => abrirVentas(`Pólizas · ${etiquetaPeriodo}`, ventasPeriodo)} />
            <KpiTile color={COLOR_VENTAS} label="Valor cobrado" value={fmtCOPShort(mVentas.valor)} hint={fmt(mVentas.valor)} onClick={() => abrirVentas(`Valor cobrado · ${etiquetaPeriodo}`, ventasPeriodo)} />
            <KpiTile
              color={COLOR_VENTAS} label="Var. cantidad"
              value={mVentasBase ? `${deltaInfo(mVentas.count, mVentasBase.count)?.up ? "+" : ""}${deltaInfo(mVentas.count, mVentasBase.count)?.pct.toFixed(0)}%` : "—"}
              hint={mVentasBase ? `vs ${baseLabel}` : "sin período anterior"}
              hintTone={mVentasBase ? (deltaInfo(mVentas.count, mVentasBase.count)?.up ? "good" : "bad") : undefined}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 }}>
            <KpiTile color={COLOR_CLIENTES} label="% Recurrencia" value={`${mVentas.pctRecurrencia.toFixed(0)}%`} hint={`${mVentas.recurrentes} de ${mVentas.clientesUnicos}`} />
            <KpiTile color={COLOR_CLIENTES} label="Clientes nuevos" value={fmtInt.format(mVentas.nuevos)} hint="primera compra en el periodo"
              onClick={() => abrirClientes(`Clientes nuevos · ${etiquetaPeriodo}`, new Set(mVentas.top.filter((c) => enRango(primeraCompra[c.nombre], ...periodBounds(mode, key))).map((c) => c.nombre)))} />
            <KpiTile color={COLOR_CLIENTES} label="Clientes antiguos" value={fmtInt.format(mVentas.recurrentes)} hint="ya habían comprado antes"
              onClick={() => abrirClientes(`Clientes antiguos · ${etiquetaPeriodo}`, new Set(mVentas.top.filter((c) => !enRango(primeraCompra[c.nombre], ...periodBounds(mode, key))).map((c) => c.nombre)))} />
            <KpiTile color={COLOR_CLIENTES} label="Buenos clientes" value={fmtInt.format(mVentas.buenosClientes)} hint="2+ compras en el año" onClick={() => {
              const anio = mode === "mes" ? key.slice(0, 4) : key;
              const recs = ventasDe(soat, `${anio}-01-01`, `${parseInt(anio, 10) + 1}-01-01`);
              const por = agruparClientes(recs, primeraCompra).filter((c) => c.count >= 2);
              abrir({ titulo: `Buenos clientes ${anio}`, sub: "2 o más compras en el año", tipo: "clientes", clientes: por });
            }} />
          </div>
          {resumenPeriodo && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 16 }}>
              <KpiTile color={COLOR_VENTAS} label="Ticket promedio" value={fmt(Math.round(resumenPeriodo.ticket))} hint="valor por póliza" />
              <KpiTile color={COLOR_VENTAS} label="Promedio por día con ventas" value={fmt(Math.round(resumenPeriodo.promedioDia))} hint={`${resumenPeriodo.diasConVentas} días con ventas`} />
              <KpiTile color={COLOR_VENTAS} label="Mejor día" value={fmtDiaCorto(resumenPeriodo.mejor.fecha)} hint={`${resumenPeriodo.mejor.count} pólizas · ${fmt(resumenPeriodo.mejor.valor)}`} onClick={() => abrirDia(resumenPeriodo.mejor.fecha)} />
            </div>
          )}

          <Card title="Ventas del día" desc="quién compró, qué vehículo y cómo pagó">
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
              <button style={S.btn("secondary")} onClick={() => { const d = new Date(diaActivo + "T12:00:00"); d.setDate(d.getDate() - 1); setDiaSel(d.toISOString().slice(0, 10)); }}>←</button>
              <input type="date" style={{ ...S.input, width: "auto" }} value={diaActivo} max={ultimaFecha} onChange={(e) => e.target.value && setDiaSel(e.target.value)} />
              <button style={S.btn("secondary")} disabled={diaActivo >= ultimaFecha} onClick={() => { const d = new Date(diaActivo + "T12:00:00"); d.setDate(d.getDate() + 1); setDiaSel(d.toISOString().slice(0, 10)); }}>→</button>
              {diaActivo !== ultimaFecha && <button style={S.btn("secondary")} onClick={() => setDiaSel(null)}>Último día con datos</button>}
              <span style={{ fontSize: 13, color: "#6b87b0", marginLeft: "auto" }}>
                {diaSemana(diaActivo)} {fmtFecha(diaActivo)} · <b style={{ color: BLUE.text }}>{ventasDia.length}</b> pólizas · <b style={{ color: BLUE.text }}>{fmt(ventasDia.reduce((sum, r) => sum + r.valor, 0))}</b>
              </span>
            </div>
            {ventasDia.length === 0 ? (
              <div style={{ fontSize: 13, color: "#9aa8c7" }}>Sin ventas registradas este día.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <div style={{ minWidth: 640 }}>
                  <div style={{ ...S.tableHead, gridTemplateColumns: "1.8fr 1fr 1.1fr 0.9fr 1fr 0.9fr" }}>
                    <span>Cliente</span><span>Teléfono</span><span>Tipo</span><span>Placa</span><span>Pago</span><span style={{ textAlign: "right" }}>Valor</span>
                  </div>
                  {ventasDia.map((r, i) => (
                    <div key={i} style={{ ...S.tableRow, gridTemplateColumns: "1.8fr 1fr 1.1fr 0.9fr 1fr 0.9fr", padding: "10px 18px" }}>
                      <div><button onClick={() => abrirCliente(r.nombre)} style={{ all: "unset", cursor: "pointer", color: BLUE.primary, fontWeight: 600 }}>{r.nombre}</button></div>
                      <div style={{ color: "#6b87b0" }}>{r.telefono || "—"}</div>
                      <div>{r.tipo}</div>
                      <div style={{ fontFamily: "monospace" }}>{r.placa || "—"}</div>
                      <div style={{ fontSize: 12 }}>{r.medio}</div>
                      <div style={{ textAlign: "right", fontWeight: 700 }}>{fmt(r.valor)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

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
                    <div key={t} onClick={() => abrirVentas(`${t} · ${etiquetaPeriodo}`, ventasPeriodo.filter((r) => r.tipo === t))} style={{ ...S.tableRow, gridTemplateColumns: "1.4fr 1fr 0.8fr", cursor: "pointer" }}>
                      <div style={{ color: BLUE.primary, fontWeight: 600 }}>{t}</div>
                      <div style={{ textAlign: "right" }}>{fmtInt.format(c)}</div>
                      <div style={{ textAlign: "right" }}>{totalTipos ? ((c / totalTipos) * 100).toFixed(0) : 0}%</div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card title="Medio de pago" desc="cómo pagaron los clientes en el periodo — clic en una fila para ver las pólizas">
            {mediosPeriodo.length === 0 ? <div style={{ fontSize: 13, color: "#9aa8c7" }}>Sin pólizas en este periodo.</div> : (
              <div style={{ overflowX: "auto" }}>
                <div style={{ ...S.tableHead, gridTemplateColumns: "1.4fr 0.8fr 1fr 0.7fr" }}>
                  <span>Medio</span><span style={{ textAlign: "right" }}>Pólizas</span><span style={{ textAlign: "right" }}>Valor</span><span style={{ textAlign: "right" }}>%</span>
                </div>
                {mediosPeriodo.map((m2) => (
                  <div key={m2.medio} onClick={() => abrirVentas(`${m2.medio} · ${etiquetaPeriodo}`, ventasPeriodo.filter((r) => r.medio === m2.medio))} style={{ ...S.tableRow, gridTemplateColumns: "1.4fr 0.8fr 1fr 0.7fr", cursor: "pointer" }}>
                    <div style={{ color: BLUE.primary, fontWeight: 600 }}>{m2.medio}</div>
                    <div style={{ textAlign: "right" }}>{fmtInt.format(m2.count)}</div>
                    <div style={{ textAlign: "right" }}>{fmt(m2.valor)}</div>
                    <div style={{ textAlign: "right" }}>{mVentas.valor ? ((m2.valor / mVentas.valor) * 100).toFixed(0) : 0}%</div>
                  </div>
                ))}
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


          {acum && (() => {
            const fechaTxt = `${acum.dia} de ${ymLabel(mesAcumActivo).split(" ")[0].toLowerCase()}`;
            const mesAct = ymLabel(mesAcumActivo), mesPas = ymLabel(acum.ymPas);
            const Tarjeta = ({ titulo, sub, d, base, color, destacada }) => {
              const dv = base ? deltaInfo(d.count, base.count) : null;
              return (
                <div style={{ background: destacada ? BLUE.light : "#fff", border: `1px solid ${BLUE.border}`, borderTop: `3px solid ${color}`, borderRadius: 10, padding: "13px 15px 14px" }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#9aa8c7" }}>{titulo}</div>
                  <div style={{ fontSize: 11.5, color: "#6b87b0", marginBottom: 8 }}>{sub}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: BLUE.text, letterSpacing: -0.5 }}>{fmtInt.format(d.count)} <span style={{ fontSize: 13, fontWeight: 600, color: "#6b87b0" }}>pólizas</span></div>
                  <div style={{ fontSize: 13, color: "#6b87b0", marginTop: 2 }}>{fmt(d.valor)}</div>
                  {dv && <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6, color: dv.up ? COLOR_GOOD : COLOR_BAD }}>{dv.up ? "▲ +" : "▼ "}{dv.pct.toFixed(0)}% vs {mesPas}</div>}
                </div>
              );
            };
            const paso = (n) => setDiaAcum(Math.max(1, Math.min(acum.tope, acum.dia + n)));
            return (
              <Card title="Acumulado" desc="cómo vamos hasta un día del mes frente al mismo día del año pasado">
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
                  <button style={S.btn("secondary")} disabled={acum.dia <= 1} onClick={() => paso(-1)}>←</button>
                  <div style={{ minWidth: 150, textAlign: "center", fontWeight: 700, color: BLUE.text }}>Al {fechaTxt}</div>
                  <button style={S.btn("secondary")} disabled={acum.dia >= acum.tope} onClick={() => paso(1)}>→</button>
                  {diaAcum != null && <button style={S.btn("secondary")} onClick={() => setDiaAcum(null)}>Hoy</button>}
                  <select style={{ ...S.select, width: "auto", marginLeft: "auto" }} value={mesAcumActivo} onChange={(e) => { setMesAcum(e.target.value); setDiaAcum(null); }}>
                    {mesOptions.map((ym) => <option key={ym} value={ym}>{ymLabel(ym)}</option>)}
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
                  <Tarjeta titulo="Acumulado a hoy" sub={`${mesAct} · 1 al ${acum.dia}`} d={acum.actual} base={acum.pasado} color={COLOR_VENTAS} destacada />
                  <Tarjeta titulo="Año anterior" sub={`${mesPas} · 1 al ${Math.min(acum.dia, acum.nP)}`} d={acum.pasado} color={COLOR_CLIENTES} />
                  <Tarjeta titulo="Fin de mes" sub={`${mesAct}${acum.mesCompleto ? "" : " · lo que va"}`} d={acum.finActual} base={acum.finPasado} color={COLOR_VENTAS} />
                  <Tarjeta titulo="Fin de mes año anterior" sub={`${mesPas} · mes completo`} d={acum.finPasado} color={COLOR_CLIENTES} />
                </div>
                <button style={{ ...S.btn("secondary"), marginTop: 14 }} onClick={() => setVerEvol((v) => !v)}>{verEvol ? "Ocultar evolución ▲" : "Ver evolución día a día ▼"}</button>
                {verEvol && (
                  <div style={{ marginTop: 14 }}>
                    <AcumuladoChart cumA={acum.cumA} cumP={acum.cumP} dia={acum.dia} tope={acum.tope} labelA={mesAct} labelP={mesPas} />
                    <div style={{ overflowX: "auto", maxHeight: 380, overflowY: "auto", marginTop: 12 }}>
                      <div style={{ ...S.tableHead, gridTemplateColumns: "0.6fr 1fr 1fr 1fr 1fr", position: "sticky", top: 0 }}>
                        <span>Día</span><span style={{ textAlign: "right" }}>{mesAct}</span><span style={{ textAlign: "right" }}>Acumulado</span><span style={{ textAlign: "right" }}>{mesPas}</span><span style={{ textAlign: "right" }}>Acumulado</span>
                      </div>
                      {Array.from({ length: Math.max(acum.nA, acum.nP) }, (_, k) => {
                        const d = k + 1, cA = acum.porDiaA[d] || 0, cP = acum.porDiaP[d] || 0;
                        return (
                          <div key={d} onClick={cA > 0 ? () => abrirDia(`${mesAcumActivo}-${pad2(d)}`) : undefined} title={cA > 0 ? "Ver las ventas de este día" : undefined}
                            style={{ ...S.tableRow, gridTemplateColumns: "0.6fr 1fr 1fr 1fr 1fr", cursor: cA > 0 ? "pointer" : "default", background: d === acum.dia ? BLUE.light : undefined }}>
                            <div style={cA > 0 ? { color: BLUE.primary, fontWeight: 700 } : undefined}>{d}</div>
                            <div style={{ textAlign: "right" }}>{d <= acum.nA ? fmtInt.format(cA) : "—"}</div>
                            <div style={{ textAlign: "right" }}>{d <= acum.nA ? fmtInt.format(acum.cumA[k]) : "—"}</div>
                            <div style={{ textAlign: "right" }}>{d <= acum.nP ? fmtInt.format(cP) : "—"}</div>
                            <div style={{ textAlign: "right" }}>{d <= acum.nP ? fmtInt.format(acum.cumP[k]) : "—"}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Card>
            );
          })()}
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

      {pila.length > 0 && (
        <DetalleModal key={pila.length} detalle={pila[pila.length - 1]} canBack={pila.length > 1}
          onBack={() => setPila((p) => p.slice(0, -1))} onClose={() => setPila([])} onCliente={abrirCliente} />
      )}

      <div style={{ textAlign: "center", color: "#9aa8c7", fontSize: 11.5, lineHeight: 1.6, marginTop: 8 }}>
        Ventas y Día a día: hoja "Histórico SOAT". Gastos: hoja "GASTOS". Caja: hoja "CAJA", saldo tal como queda en la última fila registrada. "Cliente nuevo" = su primera compra registrada cae dentro del periodo mostrado. "Buenos clientes" cuenta clientes con 2 o más compras en el año correspondiente. Se actualiza sola cada 20 minutos mientras esta pantalla esté abierta.
      </div>
    </div>
  );
}
