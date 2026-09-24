import { useState, useEffect, useMemo } from "react";
import { S, BLUE } from "../constants.js";
import { fmt, authHeaders } from "../helpers.js";
import Icon from "../components/Icon.jsx";

// Módulo nativo del CRM que replica el artefacto "Pulso de Primas" (mismas
// hojas de origen — "Base 2026" y "Base 2025" — mismos fixes de datos).
// El artefacto usa un puente (window.claude.use("mcp")) que solo existe
// dentro del visor de Artifacts de claude.ai, así que aquí los datos se
// piden a /api/primas-data.js (lee Google Sheets con una cuenta de servicio,
// del lado del servidor) en vez de vía conector. Ver [[project-pulso-primas]]
// — cualquier corrección de datos nueva (alias de ramo/tomador) debe
// aplicarse en AMBOS lugares (ese archivo server-side y este módulo NO
// necesita repetirla porque ya llega normalizada desde la API).

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const MESES_ABBR = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const RAMO_ESCOLARES = "accidentes escolares";
const REFETCH_MS = 20 * 60 * 1000;

// Paleta propia del módulo (pedido explícito 2026-09-24: "más verde y azul,
// de otro lado" — no la reutiliza tal cual del resto del CRM) — azul para
// 2026, verde para 2025, distintos del verde/rojo semántico de good/bad.
const COLOR_2026 = "#2563eb";
const COLOR_2025 = "#059669";
const COLOR_GOOD = "#16a34a";
const COLOR_BAD = "#dc2626";
const COLOR_GRID = BLUE.border;
const COLOR_AXIS = "#9aa8c7";

// ---------- formato ----------
function fmtCompact(n) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e6) return sign + (abs / 1e6).toLocaleString("es-CO", { maximumFractionDigits: 1 }) + "M";
  if (abs >= 1e3) return sign + (abs / 1e3).toLocaleString("es-CO", { maximumFractionDigits: 0 }) + "k";
  return sign + abs.toLocaleString("es-CO");
}
// Sin sufijo "M" — el chart declara una vez arriba que todo está en
// millones (pedido explícito) en vez de repetirlo en cada etiqueta.
function fmtMillones(n) {
  const sign = n < 0 ? "-" : "";
  return sign + (Math.abs(n) / 1e6).toLocaleString("es-CO", { maximumFractionDigits: 1 });
}
function niceCeil(v) {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log(v) / Math.LN10));
  const norm = v / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * mag;
}

// ---------- agregación (idéntica al artefacto) ----------
function sumBy(rows, keyFn) {
  const map = {};
  rows.forEach((r) => {
    const k = keyFn(r);
    if (k == null) return;
    map[k] = (map[k] || 0) + r.prima;
  });
  return map;
}
function monthlySeries(rows) {
  const sums = new Array(12).fill(0);
  const seen = new Array(12).fill(false);
  rows.forEach((r) => {
    if (r.mesIdx == null) return;
    sums[r.mesIdx] += r.prima;
    seen[r.mesIdx] = true;
  });
  return Array.from({ length: 12 }, (_, i) => (seen[i] ? sums[i] : null));
}
function isEscolar(r) { return (r.ramo || "").trim().toLowerCase() === RAMO_ESCOLARES; }
function normTomador(t) { return (t || "").trim().toUpperCase(); }
function topKeyByValue(obj) {
  let best = null, bestV = -1;
  Object.keys(obj).forEach((k) => { if (obj[k] > bestV) { bestV = obj[k]; best = k; } });
  return best || "(Sin dato)";
}

function nombreTokens(s) { return s.split(/\s+/).filter(Boolean); }
// true si TODAS las palabras de "cortas" aparecen en "largas" (subconjunto exacto de palabras)
function esSubconjuntoDePalabras(cortas, largas) {
  const set = new Set(largas);
  return cortas.length > 0 && cortas.every((t) => set.has(t));
}

// Cruce de tomadores 2025 -> 2026 (excluye Accidentes Escolares, capítulo aparte)
function buildRenewalTable(rows2025, rows2026) {
  const base2025 = rows2025.filter((r) => !isEscolar(r));
  const base2026 = rows2026.filter((r) => !isEscolar(r));

  const map2026 = {}, nombre2026 = {}, ramoPrima2026 = {};
  base2026.forEach((r) => {
    const k = normTomador(r.tomador);
    if (!k) return;
    map2026[k] = (map2026[k] || 0) + r.prima;
    if (!nombre2026[k]) nombre2026[k] = r.tomador || "(Sin tomador)";
    if (!ramoPrima2026[k]) ramoPrima2026[k] = {};
    const rk26 = r.ramo || "(Sin dato)";
    ramoPrima2026[k][rk26] = (ramoPrima2026[k][rk26] || 0) + r.prima;
  });

  const groups = {};
  base2025.forEach((r) => {
    const k = normTomador(r.tomador);
    if (!k) return;
    if (!groups[k]) groups[k] = { nombre: r.tomador || "(Sin tomador)", prima2025: 0, ramoPrima: {} };
    const g = groups[k];
    g.prima2025 += r.prima;
    const rk = r.ramo || "(Sin dato)";
    g.ramoPrima[rk] = (g.ramoPrima[rk] || 0) + r.prima;
  });

  // Cruce difuso por palabras — SOLO como respaldo cuando el cruce exacto no
  // encontró nada (pedido explícito 2026-09-24: casos como "GUILLERMO
  // MORENO" en 2025 vs "MORENO LUIS GUILLERMO" en 2026, mismo cliente con el
  // nombre incompleto o en otro orden en una de las dos hojas). Un nombre
  // corto cruza con uno largo solo si TODAS sus palabras están contenidas en
  // el largo, Y es la ÚNICA coincidencia posible en ambos sentidos — si un
  // nombre corto pudiera calzar con más de un nombre largo (o viceversa), se
  // deja SIN cruzar en vez de adivinar: fusionar dos clientes distintos por
  // error es peor que mostrar de más un "no ha renovado".
  const fuzzyMatch = {}; // clave normalizada 2025 -> clave normalizada 2026
  const usados2026 = new Set();
  const pendientes2025 = Object.keys(groups).filter((k) => !(k in map2026));
  const pendientes2026 = Object.keys(map2026).filter((k) => !(k in groups));
  const tokensPend2025 = Object.fromEntries(pendientes2025.map((k) => [k, nombreTokens(k)]));
  const tokensPend2026 = Object.fromEntries(pendientes2026.map((k) => [k, nombreTokens(k)]));
  const calzan = (ta, tb) => ta.length >= 2 && tb.length >= 2 && (esSubconjuntoDePalabras(ta, tb) || esSubconjuntoDePalabras(tb, ta));
  pendientes2025.forEach((k25) => {
    const candidatos26 = pendientes2026.filter((k26) => calzan(tokensPend2025[k25], tokensPend2026[k26]));
    if (candidatos26.length !== 1) return;
    const k26 = candidatos26[0];
    const otrosCandidatos25 = pendientes2025.filter((otra) => otra !== k25 && calzan(tokensPend2025[otra], tokensPend2026[k26]));
    if (otrosCandidatos25.length > 0) return;
    fuzzyMatch[k25] = k26;
    usados2026.add(k26);
  });

  const list = Object.keys(groups).map((k) => {
    const g = groups[k];
    const exact = Object.prototype.hasOwnProperty.call(map2026, k);
    const kFuzzy = !exact ? fuzzyMatch[k] : null;
    const renovo = exact || !!kFuzzy;
    const prima2026 = exact ? map2026[k] : kFuzzy ? map2026[kFuzzy] : 0;
    return {
      nombre: kFuzzy ? nombre2026[kFuzzy] : g.nombre, ramo: topKeyByValue(g.ramoPrima),
      prima2025: g.prima2025, prima2026, renovo, esNuevo: false, cruceAutomatico: !!kFuzzy,
    };
  });

  // Tomadores 2026 sin cruce en 2025 (exacto ni difuso) = negocio nuevo, no entran en % de retención.
  Object.keys(map2026).forEach((k) => {
    if (Object.prototype.hasOwnProperty.call(groups, k)) return;
    if (usados2026.has(k)) return;
    list.push({ nombre: nombre2026[k], ramo: topKeyByValue(ramoPrima2026[k]), prima2025: 0, prima2026: map2026[k], renovo: true, esNuevo: true });
  });

  list.sort((a, b) => {
    if (a.renovo !== b.renovo) return a.renovo ? 1 : -1;
    if (a.prima2025 !== b.prima2025) return b.prima2025 - a.prima2025;
    return b.prima2026 - a.prima2026;
  });
  return list;
}

// YTD por colegio, solo ramo Accidentes Escolares (capítulo aparte)
function buildEscolaresData(rows2026, rows2025) {
  const r26 = rows2026.filter(isEscolar);
  const r25 = rows2025.filter(isEscolar);
  const map26 = {}, map25 = {}, n26 = {}, n25 = {};
  r26.forEach((r) => { const k = r.tomador || "(Sin colegio)"; map26[k] = (map26[k] || 0) + r.prima; n26[k] = (n26[k] || 0) + 1; });
  r25.forEach((r) => { const k = r.tomador || "(Sin colegio)"; map25[k] = (map25[k] || 0) + r.prima; n25[k] = (n25[k] || 0) + 1; });
  const keys = Object.keys(map26).concat(Object.keys(map25).filter((k) => !(k in map26)));
  return keys.map((k) => {
    const v26 = map26[k] || 0, v25 = map25[k] || 0;
    return { colegio: k, prima2026: v26, prima2025: v25, n2026: n26[k] || 0, n2025: n25[k] || 0, delta: v25 !== 0 ? ((v26 - v25) / Math.abs(v25)) * 100 : null };
  }).sort((a, b) => b.prima2026 - a.prima2026);
}

// Cada insight es una tarjeta corta: kicker (qué es) + headline (el número
// que importa) + sub (el detalle de apoyo) — pedido explícito 2026-09-24de
// reemplazar las frases largas por algo más corto y dinámico en tarjetas.
function buildInsights(rows2026, rows2025) {
  const insights = [];
  const total2026 = rows2026.reduce((a, r) => a + r.prima, 0);
  const totalPeriodo2025 = rows2025.reduce((a, r) => a + r.prima, 0);

  if (totalPeriodo2025 > 0) {
    const deltaTotal = ((total2026 - totalPeriodo2025) / totalPeriodo2025) * 100;
    insights.push({
      tone: deltaTotal < 0 ? "bad" : "good",
      icon: deltaTotal < 0 ? "🔻" : "📈",
      kicker: "Primas 2026 vs. período 2025",
      headline: `${deltaTotal >= 0 ? "+" : ""}${deltaTotal.toFixed(0)}%`,
      sub: `${fmt(total2026)} vs ${fmt(totalPeriodo2025)}`,
    });
  }

  function biggestMover(keyFn, label) {
    const v26 = sumBy(rows2026, keyFn), v25 = sumBy(rows2025, keyFn);
    const cats = Object.keys(v26).concat(Object.keys(v25).filter((k) => !(k in v26)));
    let worst = null;
    cats.forEach((c) => {
      const a = v26[c] || 0, b = v25[c] || 0;
      if (b < 1000000) return;
      const drop = b - a;
      if (drop <= 0) return;
      if (worst === null || drop > worst.drop) worst = { cat: c, drop, a, b, pct: ((a - b) / b) * 100 };
    });
    if (worst && worst.pct < -15) {
      insights.push({
        tone: "bad", icon: "⚠️",
        kicker: `${label} con mayor caída`,
        headline: worst.cat,
        sub: `${worst.pct.toFixed(0)}% · ${fmt(worst.drop)} menos que 2025`,
      });
    }
  }
  biggestMover((r) => r.ramo || "(Sin dato)", "Ramo");
  biggestMover((r) => r.compania || "(Sin dato)", "Compañía");

  const renewal = buildRenewalTable(rows2025, rows2026).filter((t) => !t.esNuevo);
  if (renewal.length) {
    const noRenovo = renewal.filter((t) => !t.renovo);
    const pctRenovo = ((renewal.length - noRenovo.length) / renewal.length) * 100;
    const enRiesgo = noRenovo.reduce((a, t) => a + t.prima2025, 0);
    if (noRenovo.length) {
      insights.push({
        tone: pctRenovo < 60 ? "bad" : "good", icon: "🔁",
        kicker: "Retención de clientes 2025",
        headline: `${pctRenovo.toFixed(0)}%`,
        sub: `${noRenovo.length} de ${renewal.length} sin renovar · ${fmt(enRiesgo)} en riesgo`,
      });
    }
  }

  const tomPrima = sumBy(rows2026, (r) => r.tomador || "(Sin tomador)");
  const tomSorted = Object.keys(tomPrima).sort((a, b) => tomPrima[b] - tomPrima[a]);
  if (tomSorted.length >= 3 && total2026 > 0) {
    const top3 = tomSorted.slice(0, 3).reduce((a, k) => a + tomPrima[k], 0);
    const share = (top3 / total2026) * 100;
    if (share > 30) {
      insights.push({
        tone: share > 50 ? "bad" : "good", icon: "🎯",
        kicker: "Concentración de cartera",
        headline: `${share.toFixed(0)}%`,
        sub: "de la prima 2026 en los 3 tomadores más grandes",
      });
    }
  }

  return insights.slice(0, 4);
}

// ---------- filtros ----------
function applyCategoryOnly(rows, filterRamo, filterCompania) {
  return rows.filter((r) => {
    if (filterRamo && (r.ramo || "(Sin dato)") !== filterRamo) return false;
    if (filterCompania && (r.compania || "(Sin dato)") !== filterCompania) return false;
    return true;
  });
}
function inPeriod(r, ini, fin) { return r.mesIdx != null && r.mesIdx >= ini && r.mesIdx <= fin; }
function uniqueValues(rowsArr, keyFn) {
  const seen = {}, list = [];
  rowsArr.forEach((r) => { const k = keyFn(r); if (!seen[k]) { seen[k] = true; list.push(k); } });
  list.sort((a, b) => {
    if (a === "(Sin dato)") return 1;
    if (b === "(Sin dato)") return -1;
    return a.localeCompare(b, "es");
  });
  return list;
}

// ---------- piezas visuales ----------
const StatCard = ({ label, value, color, sub }) => (
  <div style={{ background: "#fff", borderRadius: 12, padding: "18px 20px", borderTop: `3px solid ${color || BLUE.primary}`, boxShadow: "0 1px 6px rgba(26,86,219,0.08)" }}>
    <div style={S.statNum}>{value}</div>
    <div style={S.statLabel}>{label}</div>
    {sub && <div style={{ fontSize: 11, color: "#9aa8c7", marginTop: 5 }}>{sub}</div>}
  </div>
);

const SectionLabel = ({ children }) => (
  <div style={{ fontSize: 12, fontWeight: 700, color: "#6b87b0", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 12 }}>{children}</div>
);

const Card = ({ title, desc, children }) => (
  <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 6px rgba(26,86,219,0.08)", padding: "18px 20px 16px", marginBottom: 16 }}>
    <SectionLabel>{title}</SectionLabel>
    {desc && <div style={{ fontSize: 12.5, color: "#6b87b0", margin: "-6px 0 14px" }}>{desc}</div>}
    {children}
  </div>
);

const Legend = () => (
  <div style={{ display: "flex", gap: 16, marginBottom: 10, fontSize: 12, color: "#6b87b0" }}>
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 3, display: "inline-block", background: COLOR_2026 }} />2026</span>
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 3, display: "inline-block", background: COLOR_2025 }} />2025</span>
  </div>
);

function MonthlyChart({ s2025, s2026 }) {
  const width = 860, height = 260;
  const padL = 46, padR = 10, padT = 22, padB = 22;
  const plotW = width - padL - padR, plotH = height - padT - padB;
  const maxVal = Math.max(1, ...s2025.map((v) => v || 0), ...s2026.map((v) => v || 0));
  const niceMax = niceCeil(maxVal);
  const groupW = plotW / 12;
  const barGap = 3, sideGap = 5;
  const barW = Math.max(4, (groupW - barGap * 2 * 0 - sideGap * 2) / 2 - barGap / 2);
  const gridTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const val = niceMax * f;
    return { val, yy: padT + plotH - (plotH * val) / niceMax };
  });
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }} preserveAspectRatio="xMidYMid meet">
      {gridTicks.map((g, i) => (
        <g key={i}>
          <line x1={padL} y1={g.yy} x2={width - padR} y2={g.yy} stroke={COLOR_GRID} strokeWidth={1} />
          <text x={padL - 8} y={g.yy + 3.5} fontSize={10} fill={COLOR_AXIS} textAnchor="end">{fmtCompact(g.val)}</text>
        </g>
      ))}
      {Array.from({ length: 12 }).map((_, i) => {
        const gx = padL + i * groupW;
        const cx25 = gx + sideGap;
        const cx26 = cx25 + barW + barGap;
        const v25 = s2025[i], v26 = s2026[i];
        const h25 = v25 != null ? Math.max(1, (plotH * v25) / niceMax) : 0;
        const y25 = padT + plotH - h25;
        const h26 = v26 != null ? Math.max(1, (plotH * v26) / niceMax) : 0;
        const y26 = padT + plotH - h26;
        return (
          <g key={i}>
            {v25 != null && (
              <>
                <rect x={cx25} y={y25} width={barW} height={h25} rx={2.5} fill={COLOR_2025}><title>{MESES[i]} 2025: {fmt(v25)}</title></rect>
                <text x={cx25 + barW / 2} y={y25 - 4} fontSize={10.5} fill={COLOR_AXIS} textAnchor="middle">{fmtCompact(v25)}</text>
              </>
            )}
            {v26 != null && (
              <>
                <rect x={cx26} y={y26} width={barW} height={h26} rx={2.5} fill={COLOR_2026}><title>{MESES[i]} 2026: {fmt(v26)}</title></rect>
                <text x={cx26 + barW / 2} y={y26 - 4} fontSize={10.5} fill={COLOR_AXIS} textAnchor="middle">{fmtCompact(v26)}</text>
              </>
            )}
            <text x={gx + groupW / 2} y={height - 5} fontSize={10} fill={COLOR_AXIS} textAnchor="middle">{MESES_ABBR[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}

// Barras verticales pareadas (2026 vs 2025) por categoría arbitraria (compañía)
// — cifras en millones sin sufijo "M" (se declara una vez en la leyenda de
// arriba, pedido explícito 2026-09-24).
function CategoryChart({ categories, v2026, v2025 }) {
  if (!categories.length) return <div style={{ padding: 24, textAlign: "center", color: "#aaa", fontSize: 13 }}>Sin datos para los filtros elegidos.</div>;
  const width = 400, height = 280;
  const padL = 34, padR = 10, padT = 14, padB = 78;
  const plotW = width - padL - padR, plotH = height - padT - padB;
  const maxVal = Math.max(1, ...v2026, ...v2025);
  const niceMax = niceCeil(maxVal);
  const n = categories.length;
  const groupW = plotW / n;
  const barGap = 3, sideGap = Math.max(4, groupW * 0.15);
  const barW = Math.max(3, (groupW - barGap - sideGap * 2) / 2);
  const gridTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const val = niceMax * f;
    return { val, yy: padT + plotH - (plotH * val) / niceMax };
  });
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }} preserveAspectRatio="xMidYMid meet">
      {gridTicks.map((g, i) => (
        <g key={i}>
          <line x1={padL} y1={g.yy} x2={width - padR} y2={g.yy} stroke={COLOR_GRID} strokeWidth={1} />
          <text x={padL - 6} y={g.yy + 3.5} fontSize={10} fill={COLOR_AXIS} textAnchor="end">{fmtMillones(g.val)}</text>
        </g>
      ))}
      {categories.map((cat, i) => {
        const gx = padL + i * groupW;
        const cx26 = gx + sideGap;
        const cx25 = cx26 + barW + barGap;
        const v26 = v2026[i] || 0, v25 = v2025[i] || 0;
        const h26 = Math.max(1, (plotH * v26) / niceMax), y26 = padT + plotH - h26;
        const h25 = Math.max(1, (plotH * v25) / niceMax), y25 = padT + plotH - h25;
        const lx = gx + groupW / 2, ly = padT + plotH + 14;
        return (
          <g key={cat}>
            <rect x={cx26} y={y26} width={barW} height={h26} rx={2.5} fill={COLOR_2026}><title>{cat} 2026: {fmt(v26)}</title></rect>
            <text x={cx26 + barW / 2} y={y26 - 4} fontSize={10.5} fill={COLOR_AXIS} textAnchor="middle">{fmtMillones(v26)}</text>
            <rect x={cx25} y={y25} width={barW} height={h25} rx={2.5} fill={COLOR_2025}><title>{cat} 2025: {fmt(v25)}</title></rect>
            <text x={cx25 + barW / 2} y={y25 - 4} fontSize={10.5} fill={COLOR_AXIS} textAnchor="middle">{fmtMillones(v25)}</text>
            <text x={lx} y={ly} fontSize={10} fill={COLOR_AXIS} textAnchor="end" transform={`rotate(-35 ${lx} ${ly})`}>{cat}</text>
          </g>
        );
      })}
    </svg>
  );
}

// Barras horizontales pareadas (2026 vs 2025) por ramo — pedido explícito
// 2026-09-24. Misma idea que CategoryChart pero categorías en el eje Y,
// mejor para nombres de ramo largos y para escanear el ranking de arriba
// hacia abajo.
function HorizontalCategoryChart({ categories, v2026, v2025 }) {
  if (!categories.length) return <div style={{ padding: 24, textAlign: "center", color: "#aaa", fontSize: 13 }}>Sin datos para los filtros elegidos.</div>;
  const width = 460;
  const rowH = 40;
  const padL = 118, padR = 44, padT = 8, padB = 22;
  const height = padT + padB + categories.length * rowH;
  const plotW = width - padL - padR;
  const maxVal = Math.max(1, ...v2026, ...v2025);
  const niceMax = niceCeil(maxVal);
  const barGap = 3, barH = (rowH - barGap - 10) / 2;
  const gridTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const val = niceMax * f;
    return { val, xx: padL + (plotW * val) / niceMax };
  });
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }} preserveAspectRatio="xMidYMid meet">
      {gridTicks.map((g, i) => (
        <line key={i} x1={g.xx} y1={padT} x2={g.xx} y2={height - padB} stroke={COLOR_GRID} strokeWidth={1} />
      ))}
      {categories.map((cat, i) => {
        const rowY = padT + i * rowH;
        const y26 = rowY + 5;
        const y25 = y26 + barH + barGap;
        const v26 = v2026[i] || 0, v25 = v2025[i] || 0;
        const w26 = Math.max(1, (plotW * v26) / niceMax);
        const w25 = Math.max(1, (plotW * v25) / niceMax);
        return (
          <g key={cat}>
            <text x={padL - 10} y={rowY + rowH / 2 + 4} fontSize={11} fill={BLUE.text} textAnchor="end">{cat}</text>
            <rect x={padL} y={y26} width={w26} height={barH} rx={2.5} fill={COLOR_2026}><title>{cat} 2026: {fmt(v26)}</title></rect>
            <text x={padL + w26 + 6} y={y26 + barH / 2 + 3.5} fontSize={10.5} fill={COLOR_AXIS}>{fmtMillones(v26)}</text>
            <rect x={padL} y={y25} width={w25} height={barH} rx={2.5} fill={COLOR_2025}><title>{cat} 2025: {fmt(v25)}</title></rect>
            <text x={padL + w25 + 6} y={y25 + barH / 2 + 3.5} fontSize={10.5} fill={COLOR_AXIS}>{fmtMillones(v25)}</text>
          </g>
        );
      })}
      {gridTicks.map((g, i) => (
        <text key={i} x={g.xx} y={height - 6} fontSize={10} fill={COLOR_AXIS} textAnchor="middle">{fmtMillones(g.val)}</text>
      ))}
    </svg>
  );
}

const DeltaChip = ({ delta }) => {
  if (delta == null) return <span style={{ color: "#aaa" }}>—</span>;
  const up = delta >= 0;
  return <span style={{ fontWeight: 700, color: up ? COLOR_GOOD : COLOR_BAD }}>{up ? "+" : ""}{delta.toFixed(0)}%</span>;
};

// Pedido explícito 2026-09-24 (ajustado el mismo día): los filtros de
// período arrancan en "año a la fecha" — de Enero al mes en curso — para
// 2026 y 2025 por igual (mismo rango en los dos años, no todo 2025 vs solo
// el mes actual de 2026). "Total año 2025" sigue siendo siempre el año
// completo, sin importar este filtro — ver más abajo.
function mesEnCurso() { return new Date().getMonth(); }

export default function PulsoPrimasPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const [filterRamo, setFilterRamo] = useState("");
  const [filterCompania, setFilterCompania] = useState("");
  const [ini2026, setIni2026] = useState(0);
  const [fin2026, setFin2026] = useState(mesEnCurso);
  const [ini2025, setIni2025] = useState(0);
  const [fin2025, setFin2025] = useState(mesEnCurso);
  // Botón "Actualizar" y el auto-refresco de abajo no llaman una función
  // externa directamente — solo suben este contador, que es la única
  // dependencia del efecto de carga. Así el fetch queda enteramente definido
  // DENTRO del efecto (mismo patrón que ya usa App.jsx para su carga inicial
  // de Supabase), que es lo que evita el "cascading renders" que marca
  // react-hooks/set-state-in-effect cuando se invoca una función externa.
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelado = false;
    async function cargarDatos() {
      try {
        const res = await fetch("/api/primas-data", { headers: await authHeaders() });
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

  const rawRows2026 = useMemo(() => data?.rows2026 || [], [data]);
  const rawRows2025 = useMemo(() => data?.rows2025 || [], [data]);
  const finToUse2026 = fin2026;

  const rows2026 = useMemo(
    () => applyCategoryOnly(rawRows2026, filterRamo, filterCompania).filter((r) => inPeriod(r, ini2026, finToUse2026)),
    [rawRows2026, filterRamo, filterCompania, ini2026, finToUse2026]
  );
  const rows2025 = useMemo(
    () => applyCategoryOnly(rawRows2025, filterRamo, filterCompania).filter((r) => inPeriod(r, ini2025, fin2025)),
    [rawRows2025, filterRamo, filterCompania, ini2025, fin2025]
  );
  const periodRaw2026 = useMemo(() => rawRows2026.filter((r) => inPeriod(r, ini2026, finToUse2026)), [rawRows2026, ini2026, finToUse2026]);
  const periodRaw2025 = useMemo(() => rawRows2025.filter((r) => inPeriod(r, ini2025, fin2025)), [rawRows2025, ini2025, fin2025]);

  const totalPrima2026 = rows2026.reduce((a, r) => a + r.prima, 0);
  const totalPrima2025Periodo = rows2025.reduce((a, r) => a + r.prima, 0);
  const totalPrima2025FullYear = applyCategoryOnly(rawRows2025, filterRamo, filterCompania).reduce((a, r) => a + r.prima, 0);
  const countPrima2025FullYear = applyCategoryOnly(rawRows2025, filterRamo, filterCompania).length;
  const mismoPeriodo = ini2026 === ini2025 && finToUse2026 === fin2025;
  const deltaPct = totalPrima2025Periodo !== 0 ? ((totalPrima2026 - totalPrima2025Periodo) / Math.abs(totalPrima2025Periodo)) * 100 : null;

  const s2025 = useMemo(() => monthlySeries(rows2025), [rows2025]);
  const s2026 = useMemo(() => monthlySeries(rows2026), [rows2026]);

  const compCats = useMemo(() => {
    const c26 = sumBy(rows2026, (r) => r.compania || "(Sin dato)");
    const c25 = sumBy(rows2025, (r) => r.compania || "(Sin dato)");
    const cats = Object.keys(c26).concat(Object.keys(c25).filter((k) => !(k in c26)));
    cats.sort((a, b) => (c26[b] || 0) - (c26[a] || 0));
    return { cats, v26: cats.map((c) => c26[c] || 0), v25: cats.map((c) => c25[c] || 0) };
  }, [rows2026, rows2025]);

  const ramoCats = useMemo(() => {
    const r26 = sumBy(rows2026, (r) => r.ramo || "(Sin dato)");
    const r25 = sumBy(rows2025, (r) => r.ramo || "(Sin dato)");
    const cats = Object.keys(r26).concat(Object.keys(r25).filter((k) => !(k in r26)));
    cats.sort((a, b) => (r26[b] || 0) - (r26[a] || 0));
    const n26 = sumBy(rows2026.map((r) => ({ ramo: r.ramo, prima: 1 })), (r) => r.ramo || "(Sin dato)");
    const n25 = sumBy(rows2025.map((r) => ({ ramo: r.ramo, prima: 1 })), (r) => r.ramo || "(Sin dato)");
    return { cats, v26: cats.map((c) => r26[c] || 0), v25: cats.map((c) => r25[c] || 0), n26, n25 };
  }, [rows2026, rows2025]);

  const insights = useMemo(() => buildInsights(periodRaw2026, periodRaw2025), [periodRaw2026, periodRaw2025]);
  const renewalList = useMemo(() => buildRenewalTable(rows2025, rows2026), [rows2025, rows2026]);
  const renewalCohort2025 = renewalList.filter((t) => !t.esNuevo);
  const renewalNuevos = renewalList.filter((t) => t.esNuevo);
  const renewedCount = renewalCohort2025.filter((t) => t.renovo).length;
  const atRiskPrima = renewalCohort2025.filter((t) => !t.renovo).reduce((a, t) => a + t.prima2025, 0);
  const escList = useMemo(() => buildEscolaresData(periodRaw2026, periodRaw2025), [periodRaw2026, periodRaw2025]);

  const ramoOptions = useMemo(() => uniqueValues([...rawRows2026, ...rawRows2025], (r) => r.ramo || "(Sin dato)"), [rawRows2026, rawRows2025]);
  const compOptions = useMemo(() => uniqueValues([...rawRows2026, ...rawRows2025], (r) => r.compania || "(Sin dato)"), [rawRows2026, rawRows2025]);
  const mesActual = mesEnCurso();
  const periodoDefault = ini2026 === 0 && finToUse2026 === mesActual && ini2025 === 0 && fin2025 === mesActual;
  const filtersActive = !!(filterRamo || filterCompania || !periodoDefault);

  const label2026 = `${MESES_ABBR[ini2026]}–${MESES_ABBR[finToUse2026]}`;
  const label2025 = `${MESES_ABBR[ini2025]}–${MESES_ABBR[fin2025]}`;

  const limpiarFiltros = () => {
    setFilterRamo(""); setFilterCompania("");
    setIni2026(0); setFin2026(mesActual);
    setIni2025(0); setFin2025(mesActual);
  };

  if (loading) {
    return (
      <div style={{ padding: "72px 24px", textAlign: "center", color: "#6b87b0" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📈</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: BLUE.text, marginBottom: 6 }}>Cargando Pulso de Primas…</div>
        <div style={{ fontSize: 13 }}>Consultando Base 2026 y Base 2025 en Google Sheets.</div>
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
          <div style={S.pageTitle}>Pulso de Primas</div>
          <div style={S.pageSub}>Evolución de primas recaudadas — Base 2026 vs Base 2025{filtersActive ? " · vista filtrada" : ""}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {lastUpdated && <span style={{ fontSize: 12, color: "#9aa8c7" }}>Actualizado {lastUpdated.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</span>}
          <button style={S.btn("secondary")} disabled={refreshing} onClick={handleRefreshClick}>
            <Icon name="download" size={14} />{refreshing ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${BLUE.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 20, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={S.label}>Ramo</label>
          <select style={{ ...S.select, width: "auto", minWidth: 170 }} value={filterRamo} onChange={(e) => setFilterRamo(e.target.value)}>
            <option value="">Todos los ramos</option>
            {ramoOptions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={S.label}>Compañía</label>
          <select style={{ ...S.select, width: "auto", minWidth: 170 }} value={filterCompania} onChange={(e) => setFilterCompania(e.target.value)}>
            <option value="">Todas las compañías</option>
            {compOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={S.label}>Período 2026</label>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <select style={{ ...S.select, width: "auto" }} value={ini2026} onChange={(e) => { const v = Number(e.target.value); setIni2026(v); if (v > finToUse2026) setFin2026(v); }}>
              {MESES.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <span style={{ fontSize: 12, color: "#9aa8c7" }}>a</span>
            <select style={{ ...S.select, width: "auto" }} value={finToUse2026} onChange={(e) => { const v = Number(e.target.value); setFin2026(v); if (v < ini2026) setIni2026(v); }}>
              {MESES.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={S.label}>Período 2025</label>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <select style={{ ...S.select, width: "auto" }} value={ini2025} onChange={(e) => { const v = Number(e.target.value); setIni2025(v); if (v > fin2025) setFin2025(v); }}>
              {MESES.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <span style={{ fontSize: 12, color: "#9aa8c7" }}>a</span>
            <select style={{ ...S.select, width: "auto" }} value={fin2025} onChange={(e) => { const v = Number(e.target.value); setFin2025(v); if (v < ini2025) setIni2025(v); }}>
              {MESES.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
          </div>
        </div>
        {filtersActive && (
          <button style={{ ...S.btn("ghost"), color: "#dc2626", textDecoration: "underline" }} onClick={limpiarFiltros}>Limpiar filtros</button>
        )}
      </div>

      {data?.errors?.base2026 && (
        <div style={S.alertBox("#dc2626")}><Icon name="warning" size={16} /><span style={{ fontSize: 12.5 }}><b>Base 2026</b> no se pudo cargar ({data.errors.base2026}). Se muestra solo lo disponible.</span></div>
      )}
      {data?.errors?.base2025 && (
        <div style={S.alertBox("#dc2626")}><Icon name="warning" size={16} /><span style={{ fontSize: 12.5 }}><b>Base 2025</b> no se pudo cargar ({data.errors.base2025}). Se muestra solo lo disponible.</span></div>
      )}

      <div style={S.statGrid}>
        <StatCard label="Primas 2026" value={fmt(totalPrima2026)} color={COLOR_2026} sub={`${rows2026.length} pólizas · ${label2026}`} />
        <StatCard label={`Primas 2025${mismoPeriodo ? " (mismo período)" : ""}`} value={fmt(totalPrima2025Periodo)} color={COLOR_2025} sub={`${rows2025.length} pólizas · ${label2025}`} />
        <StatCard
          label="Variación"
          value={deltaPct == null ? "—" : `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%`}
          color={deltaPct == null ? "#7c3aed" : deltaPct >= 0 ? COLOR_GOOD : COLOR_BAD}
          sub={mismoPeriodo ? "vs. mismo período 2025" : `2026 (${label2026}) vs. 2025 (${label2025})`}
        />
        <StatCard label="Total año 2025" value={fmt(totalPrima2025FullYear)} color="#6b87b0" sub={`${countPrima2025FullYear} pólizas · año completo`} />
      </div>

      <Card title="Evolución mensual de primas">
        <Legend />
        <MonthlyChart s2025={s2025} s2026={s2026} />
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 0 }}>
        <Card title="Primas por compañía" desc="Cifras en millones de pesos (COP)">
          <Legend /><CategoryChart categories={compCats.cats} v2026={compCats.v26} v2025={compCats.v25} />
        </Card>
        <Card title="Primas por ramo" desc="Cifras en millones de pesos (COP)">
          <Legend /><HorizontalCategoryChart categories={ramoCats.cats} v2026={ramoCats.v26} v2025={ramoCats.v25} />
        </Card>
      </div>

      <Card
        title="Renovaciones 2025 → 2026"
        desc={`${renewedCount} de ${renewalCohort2025.length} clientes de 2025 (sin contar Accidentes Escolares) ya renovaron en 2026 · ${fmt(atRiskPrima)} en prima 2025 todavía sin renovar${renewalNuevos.length ? ` · ${renewalNuevos.length} clientes nuevos en 2026 (sin cruce en 2025)` : ""}`}
      >
        <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
          <div style={{ ...S.tableHead, gridTemplateColumns: "1.8fr 1fr 1fr 1fr", position: "sticky", top: 0 }}>
            <span>Tomador</span><span>Renovó en 2026</span><span>Prima 2026</span><span>Prima 2025</span>
          </div>
          {renewalList.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "#aaa" }}>Sin datos para los filtros elegidos.</div>
          ) : renewalList.map((t, i) => (
            <div key={i} style={{ ...S.tableRow, gridTemplateColumns: "1.8fr 1fr 1fr 1fr" }}>
              <div style={{ fontWeight: 600 }}>
                {t.nombre}
                {t.cruceAutomatico && <span title="Nombre distinto en cada año, cruzado automáticamente por coincidencia de palabras" style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, color: COLOR_2025, cursor: "help" }}>🔗</span>}
              </div>
              <span style={S.badge(t.esNuevo ? COLOR_2026 : t.renovo ? COLOR_GOOD : COLOR_BAD)}>{t.esNuevo ? "Cliente nuevo" : t.renovo ? "Renovó" : "No ha renovado"}</span>
              <div style={{ fontWeight: 600 }}>{t.renovo ? fmt(t.prima2026) : "—"}</div>
              <div>{fmt(t.prima2025)}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11.5, color: "#9aa8c7", marginTop: 10 }}>Cruce por nombre de tomador (no por número de póliza, que puede cambiar entre años).</div>
      </Card>

      <Card title="Escolares — seguimiento por colegio">
        {escList.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "#9aa8c7" }}>Sin pólizas de Accidentes Escolares registradas todavía.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div style={{ ...S.tableHead, gridTemplateColumns: "1.8fr 0.8fr 1fr 1fr 0.8fr" }}>
              <span>Colegio</span><span>Pólizas 2026</span><span>{`Prima 2026 (${label2026})`}</span><span>{`Prima 2025 (${label2025})`}</span><span>Variación</span>
            </div>
            {escList.map((x, i) => (
              <div key={i} style={{ ...S.tableRow, gridTemplateColumns: "1.8fr 0.8fr 1fr 1fr 0.8fr" }}>
                <div>{x.colegio}</div>
                <div>{x.n2026}</div>
                <div>{fmt(x.prima2026)}</div>
                <div>{fmt(x.prima2025)}</div>
                <div><DeltaChip delta={x.delta} /></div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Detalle por ramo" desc={`Con los filtros de arriba aplicados — ${label2026} 2026 vs ${label2025} 2025${filtersActive ? "" : " (sin filtros activos)"}`}>
        {ramoCats.cats.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "#9aa8c7" }}>Sin datos para los filtros elegidos.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div style={{ ...S.tableHead, gridTemplateColumns: "1.4fr 0.8fr 1fr 0.8fr 1fr 0.8fr" }}>
              <span>Ramo</span><span>Pólizas 2026</span><span>Prima 2026</span><span>Pólizas 2025</span><span>Prima 2025</span><span>Variación</span>
            </div>
            {ramoCats.cats.map((cat, i) => {
              const v26 = ramoCats.v26[i], v25 = ramoCats.v25[i];
              const delta = v25 !== 0 ? ((v26 - v25) / Math.abs(v25)) * 100 : null;
              return (
                <div key={cat} style={{ ...S.tableRow, gridTemplateColumns: "1.4fr 0.8fr 1fr 0.8fr 1fr 0.8fr" }}>
                  <div>{cat}</div>
                  <div>{ramoCats.n26[cat] || 0}</div>
                  <div>{fmt(v26)}</div>
                  <div>{ramoCats.n25[cat] || 0}</div>
                  <div>{fmt(v25)}</div>
                  <div><DeltaChip delta={delta} /></div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {insights.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <SectionLabel>En resumen</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            {insights.map((ins, i) => (
              <div key={i} style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", borderTop: `3px solid ${ins.tone === "bad" ? COLOR_BAD : COLOR_GOOD}`, boxShadow: "0 1px 6px rgba(26,86,219,0.08)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 700, color: "#9aa8c7", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                  <span style={{ fontSize: 13 }}>{ins.icon}</span>{ins.kicker}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: ins.tone === "bad" ? COLOR_BAD : COLOR_GOOD, letterSpacing: -0.5 }}>{ins.headline}</div>
                <div style={{ fontSize: 12, color: "#6b87b0", marginTop: 3 }}>{ins.sub}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ textAlign: "center", color: "#9aa8c7", fontSize: 11.5, marginTop: 8 }}>
        Fuente: Google Sheets "Seguros 2026" (Base 2026) y "Seguros 2025" (Base 2025) · se actualiza sola cada 20 minutos mientras esta pantalla esté abierta
      </div>
    </div>
  );
}
