import { useState, useEffect, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../supabase.js";
import { S, BLUE, FASES_SOAT, FM_SOAT, MOTIVOS_SOAT, MOTIVOS_ILOCALIZABLE, ACCIONES_SOAT } from "../constants.js";
import { parseDateSoat, diasRenSoat, mapSoat, toSoatRow } from "../helpers.js";
import Icon from "../components/Icon.jsx";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const fmtAnioMes = (s) => {
  if (!s) return "Sin fecha";
  const [m, y] = s.split("-");
  const idx = parseInt(m, 10) - 1;
  return `${MESES[idx] || m} ${y || ""}`.trim();
};

let soatNid = Date.now();
const soatNewId = () => `s${++soatNid}`;
const soatEmpty = () => ({
  id: soatNewId(), nombre: "", telefono: "", placa: "", anioMes: "",
  fechaCompra: "", fase: "pendiente", agente: "Sin asignar",
  intentos: 0, proximaAccion: "", fechaProxima: "",
  motivoNoCompra: "", historial: [], notas: "",
});

const parseFechaCompra = (s) => {
  if (!s) return 0;
  const p = s.split("/");
  if (p.length === 3) return new Date(`${p[2]}-${p[1].padStart(2,"0")}-${p[0].padStart(2,"0")}`).getTime();
  return 0;
};

const FASES_SIN_ACCION = ["compro", "no_interes"];

// ─── Funnel bar ───────────────────────────────────────────────────────────────
const FunnelBar = ({ label, value, total, color, bold, onClick }) => {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 12, cursor: onClick ? "pointer" : "default" }} onClick={onClick}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <span style={{ fontSize: 13, fontWeight: bold ? 700 : 500, color: "#333" }}>
          {label}{onClick ? <span style={{ fontSize: 11, color, marginLeft: 6, fontWeight: 600 }}>▶ ver detalle</span> : null}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>
          {value} <span style={{ fontSize: 11.5, color: "#888", fontWeight: 400 }}>({pct}%)</span>
        </span>
      </div>
      <div style={{ background: "#e8f0fe", borderRadius: 6, height: 26, overflow: "hidden" }}>
        <div style={{ background: color, width: `${Math.max(pct, value > 0 ? 1 : 0)}%`, height: "100%", borderRadius: 6, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
};

const SoatPage = ({ showConfirm }) => {
  const [clientes, setClientes] = useState([]);
  const [loadingSoat, setLoadingSoat] = useState(true);
  const [filtroFase, setFiltroFase] = useState("Todos");
  const [filtroAgente, setFiltroAgente] = useState("Todos");
  const [filtroFecha, setFiltroFecha] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [busquedaModo, setBusquedaModo] = useState("nombre");
  const [modal, setModal] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [agentes, setAgentes] = useState(["Sin asignar"]);
  const [importMsg, setImportMsg] = useState({ text: "", type: "success" });
  const [importDups, setImportDups] = useState(null);
  const [activeTab, setActiveTab] = useState("info");
  const [callLog, setCallLog] = useState({ resultado: "", motivo: "", proximaAccion: "", fechaProxima: "", nota: "", motivoIloc: "" });
  const [filtroAlerta, setFiltroAlerta] = useState(false);
  const [showNoInteresDetail, setShowNoInteresDetail] = useState(false);
  const [ilocWarning, setIlocWarning] = useState(false);
  const [callLogError, setCallLogError] = useState("");
  const [modalCloseError, setModalCloseError] = useState("");
  // Funnel
  const [showFunnel, setShowFunnel] = useState(false);
  const [funnelBases, setFunnelBases] = useState([]);
  // Export dialog
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportBases, setExportBases] = useState([]);
  const [exportEstados, setExportEstados] = useState(FASES_SOAT.map(f => f.id));
  const fileRef = useRef();

  // ─── Carga inicial + realtime ────────────────────────────────────────────
  useEffect(() => {
    supabase.from("soat_clientes").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setClientes(data.map(mapSoat)); setLoadingSoat(false); });

    const cargarAgentes = () =>
      fetch("/api/comerciales").then(r => r.json())
        .then(data => {
          if (Array.isArray(data) && data.length > 0)
            setAgentes(["Sin asignar", ...data.map(r => r.nombre)]);
        });
    cargarAgentes();

    const channel = supabase.channel("soat-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "soat_clientes" }, (payload) => {
        if (payload.eventType === "INSERT")
          setClientes(p => p.some(x => x.id === payload.new.id) ? p : [mapSoat(payload.new), ...p]);
        if (payload.eventType === "UPDATE")
          setClientes(p => p.map(x => x.id === payload.new.id ? mapSoat(payload.new) : x));
        if (payload.eventType === "DELETE")
          setClientes(p => p.filter(x => x.id !== payload.old.id));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "agentes" }, cargarAgentes)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);


  // ─── Update campo ─────────────────────────────────────────────────────────
  const updateC = async (id, field, value) => {
    const dbField = {
      fase: "fase", agente: "agente", proximaAccion: "proxima_accion",
      fechaProxima: "fecha_proxima", motivoNoCompra: "motivo_no_compra",
      notas: "notas", nombre: "nombre", telefono: "telefono",
      placa: "placa", anioMes: "anio_mes", fechaCompra: "fecha_compra",
    }[field] || field;
    const clearAccion = field === "fase" && FASES_SIN_ACCION.includes(value);
    const patch = { [field]: value, ...(clearAccion ? { proximaAccion: "", fechaProxima: "" } : {}) };
    const dbPatch = { [dbField]: value, ...(clearAccion ? { proxima_accion: "", fecha_proxima: "" } : {}) };
    setClientes(p => p.map(c => c.id === id ? { ...c, ...patch } : c));
    if (modal?.id === id) setModal(p => ({ ...p, ...patch }));
    await supabase.from("soat_clientes").update(dbPatch).eq("id", id);
  };

  const openModal = (c) => {
    setModal(c); setActiveTab("info");
    setCallLog({ resultado: "", motivo: "", proximaAccion: "", fechaProxima: "", nota: "", motivoIloc: "" });
    setCallLogError(""); setModalCloseError("");
  };

  const handleCloseModal = () => {
    if (modal?.fase === "no_interes" && !modal?.motivoNoCompra) {
      setModalCloseError("Debes seleccionar un motivo de no compra antes de cerrar.");
      return;
    }
    setModalCloseError("");
    setModal(null);
  };

  // ─── Llamada ──────────────────────────────────────────────────────────────
  const registrarLlamada = async () => {
    if (!callLog.resultado) return;
    if (callLog.resultado === "no_interes" && !callLog.motivo) {
      setCallLogError("Debes seleccionar un motivo de no compra.");
      return;
    }
    if (callLog.resultado === "ilocalizable" && callLog.motivoIloc === "No contestó / Buzón") {
      const fechasUnicas = [...new Set((modal.historial || []).map(h => h.fecha))];
      if (fechasUnicas.length < 3) {
        setIlocWarning(true);
        return;
      }
    }
    setCallLogError("");
    const clearAccion = FASES_SIN_ACCION.includes(callLog.resultado);
    const entry = { fecha: new Date().toLocaleDateString("es-CO"), ...callLog, agente: modal.agente };
    const motivoGuardar = callLog.resultado === "no_interes" ? callLog.motivo
      : callLog.resultado === "ilocalizable" ? callLog.motivoIloc
      : modal.motivoNoCompra;
    const updated = {
      ...modal,
      historial: [entry, ...(modal.historial || [])],
      intentos: (modal.intentos || 0) + 1,
      fase: callLog.resultado,
      proximaAccion: clearAccion ? "" : (callLog.proximaAccion || modal.proximaAccion),
      fechaProxima: clearAccion ? "" : (callLog.fechaProxima || modal.fechaProxima),
      motivoNoCompra: motivoGuardar || modal.motivoNoCompra,
    };
    setClientes(p => p.map(c => c.id === modal.id ? updated : c));
    await supabase.from("soat_clientes").update({
      historial: updated.historial, intentos: updated.intentos, fase: updated.fase,
      proxima_accion: updated.proximaAccion, fecha_proxima: updated.fechaProxima,
      motivo_no_compra: updated.motivoNoCompra,
    }).eq("id", modal.id);
    setModal(updated);
    setCallLog({ resultado: "", motivo: "", proximaAccion: "", fechaProxima: "", nota: "", motivoIloc: "" });
    setActiveTab("historial");
  };

  const deleteC = async (id) => {
    const ok = await showConfirm("¿Eliminar cliente?", "Esta acción no se puede deshacer.");
    if (!ok) return;
    await supabase.from("soat_clientes").delete().eq("id", id);
    setClientes(p => p.filter(c => c.id !== id));
    setModal(null);
  };

  // ─── Template ─────────────────────────────────────────────────────────────
  const descargarTemplate = () => {
    const cols = ["Nombre", "Telefono", "Placa", "Fecha Compra", "Fecha Base", "Estado"];
    const ws = XLSX.utils.aoa_to_sheet([cols,
      ["MARIA LOPEZ", "3001234567", "ABC123", "16/01/2025", "", ""],
      ["JUAN PEREZ", "3109876543", "XYZ789", "22/03/2025", "", ""],
    ]);
    ws["!cols"] = cols.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clientes SOAT");
    XLSX.writeFile(wb, "template_soat.xlsx");
  };

  // ─── Import ───────────────────────────────────────────────────────────────
  const importCSV = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setImportMsg({ text: "Leyendo archivo…", type: "info" });
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
      if (!rows.length) { setImportMsg({ text: "El archivo está vacío", type: "error" }); return; }
      const keys = Object.keys(rows[0]);
      const col = (...names) => { for (const n of names) { const k = keys.find(k => k.toLowerCase().includes(n.toLowerCase())); if (k) return k; } return null; };
      const kN = col("nombre","name"), kT = col("tel","cel","phone"), kP = col("placa","plate");
      const kF = col("fecha compra","fecha","date","compra"), kE = col("estado","status","fase"), kM = col("fecha base","base","mes","año","anio");
      if (!kN) { setImportMsg({ text: "No se encontró columna 'Nombre'", type: "error" }); return; }
      const faseMap = {
        "interesado volver a llamar":"interesado","volver a llamar no contesto":"en_gestion",
        "volver a llamar":"en_gestion","no interesado":"no_interes","cliente compro":"compro",
        "ilocalizable":"ilocalizable","en gestión":"en_gestion","en gestion":"en_gestion",
        "interesado":"interesado","compró":"compro",
      };
      const parseAnioMes = (val) => {
        if (!val) return "";
        try {
          if (val instanceof Date) return `${String(val.getMonth()+1).padStart(2,"0")}-${val.getFullYear()}`;
          const s = String(val).trim(); if (!s) return "";
          const parts = s.split(/[/.-]/);
          if (parts.length === 3) {
            let d, m, y;
            if (parts[2].length === 4) { [d, m, y] = parts; }
            else if (parts[0].length === 4) { [y, m, d] = parts; }
            else return "";
            return `${m.padStart(2,"0")}-${y}`;
          }
        } catch {}
        return "";
      };
      const nuevos = rows.map(r => {
        const fechaRaw = kF ? r[kF] : "";
        const fechaStr = fechaRaw instanceof Date
          ? `${String(fechaRaw.getDate()).padStart(2,"0")}/${String(fechaRaw.getMonth()+1).padStart(2,"0")}/${fechaRaw.getFullYear()}`
          : String(fechaRaw || "").trim();
        const anioMesVal = kM ? String(r[kM] || "").trim() : parseAnioMes(fechaRaw);
        const er = kE ? String(r[kE] || "").toLowerCase().trim() : "";
        return { ...soatEmpty(), nombre: String(r[kN] || "").trim(), telefono: kT ? String(r[kT] || "").trim() : "",
          placa: kP ? String(r[kP] || "").trim() : "", fechaCompra: fechaStr, anioMes: anioMesVal,
          fase: faseMap[er] || "pendiente", agente: "Sin asignar" };
      }).filter(c => c.nombre);
      const duplicados = nuevos.filter(n =>
        clientes.some(c => c.nombre.toLowerCase() === n.nombre.toLowerCase() && c.telefono === n.telefono)
      );
      if (duplicados.length > 0) {
        setImportDups({ nuevos, duplicados, soloNuevos: nuevos.filter(n => !clientes.some(c => c.nombre.toLowerCase() === n.nombre.toLowerCase() && c.telefono === n.telefono)) });
        setImportMsg({ text: "", type: "success" });
      } else {
        await ejecutarImport(nuevos);
      }
    } catch (err) {
      setImportMsg({ text: "Error: " + err.message, type: "error" });
    }
    e.target.value = "";
  };

  const ejecutarImport = async (lista) => {
    setImportMsg({ text: "Importando…", type: "info" });
    const BATCH = 50;
    let insertados = [];
    for (let i = 0; i < lista.length; i += BATCH) {
      const { data, error } = await supabase.from("soat_clientes").insert(lista.slice(i, i+BATCH).map(toSoatRow)).select();
      if (error) throw error;
      if (data) insertados = insertados.concat(data.map(mapSoat));
    }
    setClientes(p => [...insertados, ...p]);
    setImportMsg({ text: `${insertados.length} clientes agregados correctamente`, type: "success" });
    setImportDups(null);
    setTimeout(() => setImportMsg({ text: "", type: "success" }), 5000);
  };

  // ─── Export con dialog ────────────────────────────────────────────────────
  const ejecutarExport = () => {
    let lista = clientes;
    if (exportBases.length > 0) lista = lista.filter(c => exportBases.includes(c.anioMes));
    if (exportEstados.length > 0) lista = lista.filter(c => exportEstados.includes(c.fase));
    const cols = ["#","Fecha Base","Nombre","Teléfono","Placa","Fecha Compra","Fase","Agente","Intentos","Próxima Acción","Fecha Próxima","Motivo No Compra","Notas"];
    const rows = lista.map((c, i) => [i+1, fmtAnioMes(c.anioMes), c.nombre, c.telefono, c.placa,
      c.fechaCompra, FM_SOAT[c.fase]?.label||c.fase, c.agente, c.intentos,
      c.proximaAccion, c.fechaProxima, c.motivoNoCompra, c.notas]);
    const ws = XLSX.utils.aoa_to_sheet([cols, ...rows]);
    ws["!cols"] = [6,14,28,14,10,14,16,14,8,22,14,22,30].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SOAT");
    XLSX.writeFile(wb, "soat-seguimiento.xlsx");
    setShowExportDialog(false);
  };

  // ─── Datos derivados ──────────────────────────────────────────────────────
  const toFechaStr = (yyyymmdd) => {
    if (!yyyymmdd) return "";
    const [y, m, d] = yyyymmdd.split("-");
    return `${d}/${m}/${y}`;
  };

  const basesDisponibles = useMemo(() =>
    [...new Set(clientes.map(c => c.anioMes).filter(Boolean))]
      .sort((a, b) => {
        const [ma, ya] = a.split("-"); const [mb, yb] = b.split("-");
        return new Date(`${ya}-${ma}-01`) - new Date(`${yb}-${mb}-01`);
      }),
    [clientes]
  );

  const filtrados = useMemo(() => clientes.filter(c => {
    const mF = filtroFase === "Todos" || c.fase === filtroFase;
    const mA = filtroAgente === "Todos" || c.agente === filtroAgente;
    const mFecha = !filtroFecha || c.fechaCompra === toFechaStr(filtroFecha) || c.fechaProxima === filtroFecha;
    const q = busqueda.trim().toLowerCase();
    const mB = !q || (() => {
      if (busquedaModo === "telefono") return (c.telefono || "").includes(busqueda.trim());
      if (busquedaModo === "placa") return (c.placa || "").toLowerCase().startsWith(q);
      return c.nombre.toLowerCase().includes(q);
    })();
    const mAlerta = !filtroAlerta || (() => {
      if (!c.fechaProxima) return false;
      const d = parseDateSoat(c.fechaProxima);
      return d && d <= new Date();
    })();
    return mF && mA && mFecha && mB && mAlerta;
  }), [clientes, filtroFase, filtroAgente, filtroFecha, busqueda, busquedaModo, filtroAlerta]);

  const stats = {
    total: clientes.length,
    sinGestionar: clientes.filter(c => c.intentos === 0).length,
    enGestion: clientes.filter(c => c.fase === "en_gestion" || c.fase === "pendiente").length,
    interesados: clientes.filter(c => c.fase === "interesado").length,
    compro: clientes.filter(c => c.fase === "compro").length,
    proximos30: clientes.filter(c => { const d = diasRenSoat(c.fechaCompra); return d !== null && d >= 0 && d <= 30; }).length,
  };

  const alertaHoy = clientes.filter(c => {
    if (!c.fechaProxima) return false;
    const d = parseDateSoat(c.fechaProxima);
    return d && d <= new Date();
  });

  // ─── Funnel data ──────────────────────────────────────────────────────────
  const funnelClientes = funnelBases.length === 0
    ? clientes
    : clientes.filter(c => funnelBases.includes(c.anioMes));

  const funnelData = useMemo(() => {
    const base = funnelClientes.length;
    const gestionados = funnelClientes.filter(c => ["interesado","compro","ilocalizable","no_interes","en_gestion"].includes(c.fase)).length;
    const noInteres = funnelClientes.filter(c => c.fase === "no_interes").length;
    const compro = funnelClientes.filter(c => c.fase === "compro").length;
    const ilocalizable = funnelClientes.filter(c => c.fase === "ilocalizable").length;
    const activos = funnelClientes.filter(c => ["en_gestion","interesado"].includes(c.fase)).length;
    return { base, gestionados, noInteres, compro, ilocalizable, activos };
  }, [funnelClientes]);

  // ─── Estilos ──────────────────────────────────────────────────────────────
  const inpS = { background: "#f8faff", border: `1px solid ${BLUE.border}`, borderRadius: 8, padding: "9px 12px", color: BLUE.text, fontSize: 13, outline: "none", width: "100%", fontFamily: "inherit", boxSizing: "border-box" };
  const lblS = { fontSize: 11, color: "#6b87b0", fontWeight: 700, textTransform: "uppercase", marginBottom: 5, letterSpacing: "0.06em", display: "block" };
  const selS = { ...inpS, cursor: "pointer" };
  const filterSel = { ...S.select, width: "auto", padding: "7px 12px", fontSize: 13 };

  // Pill toggle para multi-select
  const PillToggle = ({ options, selected, onChange, fmt }) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map(opt => {
        const active = selected.includes(opt);
        return (
          <button key={opt} onClick={() => onChange(active ? selected.filter(s => s !== opt) : [...selected, opt])}
            style={{ padding: "5px 13px", borderRadius: 20, fontSize: 12.5, cursor: "pointer", border: "1.5px solid", background: active ? BLUE.primary : "#fff", color: active ? "#fff" : BLUE.text, borderColor: active ? BLUE.primary : BLUE.border, fontWeight: active ? 700 : 400, transition: "all 0.12s" }}>
            {fmt ? fmt(opt) : opt}
          </button>
        );
      })}
      <button onClick={() => onChange(selected.length === options.length ? [] : [...options])}
        style={{ padding: "5px 13px", borderRadius: 20, fontSize: 12, cursor: "pointer", border: `1px solid ${BLUE.border}`, background: "transparent", color: "#888", transition: "all 0.12s" }}>
        {selected.length === options.length ? "Ninguno" : "Todos"}
      </button>
    </div>
  );

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>Seguimiento SOAT</div>
          <div style={S.pageSub}>{clientes.length} clientes · {filtrados.length} visibles con filtros activos</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => { setFunnelBases([]); setShowFunnel(true); }}
            style={{ ...S.btn("secondary"), border: `1.5px solid ${BLUE.primary}`, color: BLUE.primary }}>
            Funnel
          </button>
          <button onClick={descargarTemplate} style={{ ...S.btn("ghost"), border: `1px solid ${BLUE.border}` }}>Plantilla</button>
          <button onClick={() => fileRef.current.click()} style={S.btn("secondary")}>
            <Icon name="upload" size={16} /> Importar
          </button>
          <button onClick={() => { setExportBases([]); setExportEstados(FASES_SOAT.map(f => f.id)); setShowExportDialog(true); }}
            style={S.btn("success")}>
            <Icon name="download" size={16} /> Exportar
          </button>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={importCSV} style={{ display: "none" }} />
        </div>
      </div>

      {/* ── Alertas ─────────────────────────────────────────────────────────── */}
      {loadingSoat && <div style={{ textAlign: "center", padding: 40, color: "#6b87b0" }}>Cargando…</div>}

      {importMsg.text && (
        <div style={{ background: importMsg.type === "error" ? "#fef2f2" : importMsg.type === "info" ? "#eff6ff" : "#f0fdf4", border: `1px solid ${importMsg.type === "error" ? "#fecaca" : importMsg.type === "info" ? BLUE.border : "#bbf7d0"}`, borderRadius: 8, padding: "10px 16px", marginBottom: 12, fontSize: 13, color: importMsg.type === "error" ? "#dc2626" : importMsg.type === "info" ? BLUE.primary : "#16a34a" }}>
          {importMsg.text}
        </div>
      )}

      {importDups && (
        <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, padding: "16px 20px", marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: "#92400e", marginBottom: 8, fontSize: 14 }}>
            Se detectaron {importDups.duplicados.length} clientes repetidos (mismo nombre y teléfono)
          </div>
          <div style={{ fontSize: 13, color: "#78350f", marginBottom: 14 }}>
            Total en archivo: {importDups.nuevos.length} · Nuevos: {importDups.soloNuevos.length} · Duplicados: {importDups.duplicados.length}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={S.btn("primary")} onClick={() => ejecutarImport(importDups.soloNuevos)}>Importar solo los {importDups.soloNuevos.length} nuevos</button>
            <button style={S.btn("secondary")} onClick={() => ejecutarImport(importDups.nuevos)}>Importar todos ({importDups.nuevos.length})</button>
            <button style={S.btn("ghost")} onClick={() => setImportDups(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {alertaHoy.length > 0 && (
        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: "10px 16px", marginBottom: 12, fontSize: 13, color: "#c2410c", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Icon name="bell" size={15} />
          <span><strong>{alertaHoy.length} cliente{alertaHoy.length > 1 ? "s" : ""}</strong> con seguimiento pendiente para hoy o antes</span>
          <button onClick={() => setFiltroAlerta(v => !v)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#c2410c", fontWeight: 700, textDecoration: "underline", fontSize: 13, padding: 0, marginLeft: 4 }}>
            {filtroAlerta ? "(Mostrar todos)" : "(Ver)"}
          </button>
        </div>
      )}

      {/* ── Stats ───────────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total", value: stats.total, color: BLUE.primary },
          { label: "Sin gestionar", value: stats.sinGestionar, color: "#f97316" },
          { label: "En gestión", value: stats.enGestion, color: "#f59e0b" },
          { label: "Interesados", value: stats.interesados, color: "#16a34a" },
          { label: "Compraron", value: stats.compro, color: "#8b5cf6" },
          { label: "Vencen ≤30d", value: stats.proximos30, color: "#dc2626" },
        ].map(s => (
          <div key={s.label} style={{ background: "#fff", border: `1px solid ${BLUE.border}`, borderTop: `3px solid ${s.color}`, borderRadius: 10, padding: "16px 18px", boxShadow: "0 1px 4px rgba(26,86,219,0.06)" }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 11.5, color: "#6b87b0", marginTop: 5, fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Fase pills ──────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
        {[{ id: "Todos", label: "Todos", color: "#6b7280" }, ...FASES_SOAT].map(f => {
          const cnt = f.id === "Todos" ? clientes.length : clientes.filter(c => c.fase === f.id).length;
          const active = filtroFase === f.id;
          return (
            <button key={f.id} onClick={() => setFiltroFase(f.id)}
              style={{ background: active ? f.color : "#fff", border: `1.5px solid ${active ? f.color : BLUE.border}`, borderRadius: 20, padding: "6px 16px", fontSize: 12.5, color: active ? "#fff" : (f.color || "#555"), cursor: "pointer", whiteSpace: "nowrap", fontWeight: active ? 700 : 400, transition: "all 0.15s" }}>
              {f.label} <span style={{ opacity: 0.75 }}>({cnt})</span>
            </button>
          );
        })}
      </div>

      {/* ── Barra de filtros ─────────────────────────────────────────────────── */}
      <div style={{ background: "#fff", border: `1px solid ${BLUE.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
        {/* Modo búsqueda */}
        <div style={{ display: "flex", gap: 0, marginBottom: 10, borderRadius: 8, overflow: "hidden", width: "fit-content", border: `1px solid ${BLUE.border}` }}>
          {[["nombre","Nombre"],["telefono","Teléfono"],["placa","Placa"]].map(([modo, label]) => (
            <button key={modo} onClick={() => { setBusquedaModo(modo); setBusqueda(""); }}
              style={{ padding: "6px 18px", fontSize: 13, fontWeight: busquedaModo === modo ? 700 : 400, background: busquedaModo === modo ? BLUE.primary : "#fff", color: busquedaModo === modo ? "#fff" : "#555", border: "none", cursor: "pointer", transition: "all 0.15s" }}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ ...S.searchBar, flex: 1, minWidth: 200 }}>
            <Icon name="search" size={16} />
            <input style={S.searchInput}
              placeholder={busquedaModo === "telefono" ? "Número de teléfono..." : busquedaModo === "placa" ? "Placa del vehículo..." : "Nombre del cliente..."}
              value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>
          <select value={filtroAgente} onChange={e => setFiltroAgente(e.target.value)} style={filterSel}>
            <option value="Todos">Todos los agentes</option>
            {agentes.map(a => <option key={a}>{a}</option>)}
          </select>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label style={{ fontSize: 12, color: "#6b87b0", fontWeight: 600, whiteSpace: "nowrap" }}>Filtro fecha:</label>
            <input type="date" value={filtroFecha} onChange={e => setFiltroFecha(e.target.value)}
              style={{ ...filterSel, width: 150, padding: "7px 10px" }} />
            {filtroFecha && (
              <button onClick={() => setFiltroFecha("")} style={{ ...S.btn("ghost"), padding: "4px 8px", fontSize: 12, color: "#dc2626" }}>✕</button>
            )}
          </div>
          <span style={{ fontSize: 12, color: "#6b87b0", whiteSpace: "nowrap", fontWeight: 600 }}>{filtrados.length} registros</span>
        </div>
      </div>

      {/* ── Tabla ────────────────────────────────────────────────────────────── */}
      <div style={{ ...S.tableWrap, overflowX: "auto" }}>
        <div style={{ minWidth: 860 }}>
          <div style={{ ...S.tableHead, display: "grid", gridTemplateColumns: "36px 2fr 0.8fr 0.8fr 1.3fr 1fr 1.2fr 90px" }}>
            <span>#</span><span>Cliente</span><span>F. Base</span><span>F. Compra</span><span>Fase</span><span>Agente</span><span>Próxima acción</span><span></span>
          </div>
          {filtrados.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "#aaa", fontSize: 14 }}>Sin registros. Importa un archivo o ajusta los filtros.</div>
          ) : filtrados.map((c, idx) => {
            const fase = FM_SOAT[c.fase] || FASES_SOAT[0];
            const urgente = c.fechaProxima && parseDateSoat(c.fechaProxima) <= new Date();
            return (
              <div key={c.id}
                style={{ ...S.tableRow, display: "grid", gridTemplateColumns: "36px 2fr 0.8fr 0.8fr 1.3fr 1fr 1.2fr 90px" }}
                onMouseEnter={e => e.currentTarget.style.background = BLUE.light}
                onMouseLeave={e => e.currentTarget.style.background = ""}>
                <div style={{ fontWeight: 700, color: "#bbb", fontSize: 12 }}>{idx + 1}</div>
                <div style={{ cursor: "pointer" }} onClick={() => openModal(c)}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: BLUE.primary }}>{c.nombre || "—"}</div>
                  <div style={{ fontSize: 11.5, color: "#888", marginTop: 2 }}>
                    {c.telefono || "—"}{c.placa ? ` · ${c.placa}` : ""}
                    {c.historial?.length > 0 && <span style={{ marginLeft: 6, color: "#aaa" }}>({c.historial.length} llam.)</span>}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#555" }}>{fmtAnioMes(c.anioMes)}</div>
                <div style={{ fontSize: 12, color: "#555" }}>{c.fechaCompra || "—"}</div>
                <select value={c.fase} onChange={e => updateC(c.id, "fase", e.target.value)}
                  style={{ fontSize: 11.5, padding: "4px 8px", borderRadius: 6, border: `1.5px solid ${fase.color}`, background: fase.bg, color: fase.text, cursor: "pointer", outline: "none", fontWeight: 700, width: "100%" }}>
                  {FASES_SOAT.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
                <select value={c.agente} onChange={e => updateC(c.id, "agente", e.target.value)}
                  style={{ fontSize: 11.5, padding: "4px 8px", borderRadius: 6, border: `1px solid ${BLUE.border}`, background: "#fff", color: "#333", cursor: "pointer", outline: "none", width: "100%" }}>
                  {agentes.map(a => <option key={a}>{a}</option>)}
                </select>
                <div>
                  {FASES_SIN_ACCION.includes(c.fase) ? (
                    <span style={{ color: "#ccc", fontSize: 12 }}>—</span>
                  ) : c.proximaAccion ? (
                    <div>
                      <div style={{ fontSize: 11.5, color: "#555", fontWeight: 600 }}>{c.proximaAccion}</div>
                      {c.fechaProxima && (
                        <div style={{ fontSize: 11, color: urgente ? "#dc2626" : "#888", background: urgente ? "#fee2e2" : "transparent", padding: urgente ? "1px 6px" : "0", borderRadius: 10, marginTop: 2, display: "inline-block", fontWeight: urgente ? 700 : 400 }}>
                          {c.fechaProxima}
                        </div>
                      )}
                    </div>
                  ) : <span style={{ color: "#ccc", fontSize: 12 }}>—</span>}
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => openModal(c)} style={{ ...S.btn("primary"), padding: "5px 10px", fontSize: 11 }}>Ver</button>
                  <button onClick={() => setEditModal({ ...c })} style={{ ...S.btn("ghost"), padding: "5px 8px" }}><Icon name="edit" size={13} /></button>
                </div>
              </div>
            );
          })}
        </div>
      </div>


      {/* ── Modal edición rápida ─────────────────────────────────────────────── */}
      {editModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(7,29,71,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }} onClick={() => setEditModal(null)}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 520, padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 17, color: BLUE.text }}>Editar datos</div>
              <button onClick={() => setEditModal(null)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#aaa" }}>×</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
              {[["Nombre","nombre"],["Teléfono","telefono"],["Placa","placa"],["Fecha de Compra","fechaCompra"],["Fecha Base","anioMes"]].map(([l, f]) => (
                <div key={f} style={{ gridColumn: f === "nombre" ? "1/-1" : "auto" }}>
                  <label style={lblS}>{l}</label>
                  <input value={editModal[f] || ""} onChange={e => setEditModal(p => ({ ...p, [f]: e.target.value }))} style={inpS} />
                </div>
              ))}
              <div>
                <label style={lblS}>Fase</label>
                <select value={editModal.fase} onChange={e => setEditModal(p => ({ ...p, fase: e.target.value, motivoNoCompra: "" }))} style={selS}>
                  {FASES_SOAT.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </div>
              <div>
                <label style={lblS}>Agente</label>
                <select value={editModal.agente} onChange={e => setEditModal(p => ({ ...p, agente: e.target.value }))} style={selS}>
                  {agentes.map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
              {(editModal.fase === "no_interes" || editModal.fase === "ilocalizable") && (
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={lblS}>Motivo {editModal.fase === "ilocalizable" ? "ilocalizable" : "no compra"}{editModal.fase === "no_interes" ? " *" : ""}</label>
                  <select value={editModal.motivoNoCompra || ""} onChange={e => setEditModal(p => ({ ...p, motivoNoCompra: e.target.value }))} style={{ ...selS, borderColor: editModal.fase === "no_interes" && !editModal.motivoNoCompra ? "#fca5a5" : BLUE.border }}>
                    <option value="">— Selecciona —</option>
                    {(editModal.fase === "ilocalizable" ? MOTIVOS_ILOCALIZABLE : MOTIVOS_SOAT).map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
              <button style={S.btn("danger")} onClick={async () => {
                const ok = await showConfirm(`¿Eliminar a ${editModal.nombre}?`, "Esta acción no se puede deshacer.");
                if (!ok) return;
                await supabase.from("soat_clientes").delete().eq("id", editModal.id);
                setClientes(p => p.filter(c => c.id !== editModal.id));
                setEditModal(null);
              }}>Eliminar</button>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setEditModal(null)} style={S.btn("secondary")}>Cancelar</button>
                <button style={S.btn("primary")} onClick={async () => {
                  if (editModal.fase === "no_interes" && !editModal.motivoNoCompra) {
                    alert("Debes seleccionar un motivo de no compra.");
                    return;
                  }
                  const clearAccion = FASES_SIN_ACCION.includes(editModal.fase);
                  const dataSave = { ...editModal, ...(clearAccion ? { proximaAccion: "", fechaProxima: "" } : {}) };
                  await supabase.from("soat_clientes").update(toSoatRow(dataSave)).eq("id", editModal.id);
                  setClientes(p => p.map(c => c.id === editModal.id ? { ...c, ...dataSave } : c));
                  setEditModal(null);
                }}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal detalle ────────────────────────────────────────────────────── */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(7,29,71,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }} onClick={handleCloseModal}>
          <div style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 680, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(26,86,219,0.2)" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "22px 28px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 20, color: BLUE.text }}>{modal.nombre || "Cliente"}</div>
                <div style={{ display: "flex", gap: 14, marginTop: 6, fontSize: 13, color: "#888", flexWrap: "wrap" }}>
                  {modal.telefono && <span>{modal.telefono}</span>}
                  {modal.placa && <span>Placa: {modal.placa}</span>}
                  <span>{modal.intentos || 0} intento{modal.intentos !== 1 ? "s" : ""}</span>
                  <span style={{ ...(() => { const f = FM_SOAT[modal.fase]; return { background: f?.bg, color: f?.text, padding: "1px 10px", borderRadius: 12, fontWeight: 700, fontSize: 12 }; })() }}>
                    {FM_SOAT[modal.fase]?.label || modal.fase}
                  </span>
                </div>
              </div>
              <button onClick={handleCloseModal} style={{ background: "transparent", border: "none", color: "#aaa", fontSize: 24, cursor: "pointer", padding: "0 4px" }}>×</button>
            </div>
            <div style={{ display: "flex", padding: "16px 28px 0", borderBottom: `1px solid ${BLUE.border}`, gap: 4 }}>
              {[["info","Información"],["llamada","Registrar llamada"],["historial",`Historial (${modal.historial?.length || 0})`]].map(([t, l]) => (
                <button key={t} onClick={() => setActiveTab(t)}
                  style={{ background: activeTab === t ? BLUE.light : "transparent", border: "none", borderBottom: activeTab === t ? `2px solid ${BLUE.primary}` : "2px solid transparent", color: activeTab === t ? BLUE.primary : "#999", padding: "9px 18px", fontSize: 13.5, cursor: "pointer", fontWeight: activeTab === t ? 700 : 400, borderRadius: "6px 6px 0 0", transition: "all 0.15s" }}>
                  {l}
                </button>
              ))}
            </div>
            <div style={{ padding: "22px 28px 28px" }}>
              {activeTab === "info" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {[["Nombre","nombre"],["Teléfono","telefono"],["Placa","placa"],["Fecha de compra","fechaCompra"],["Fecha Base","anioMes"]].map(([l, f]) => (
                      <div key={f}>
                        <label style={lblS}>{l}</label>
                        <input value={modal[f] || ""} onChange={e => { updateC(modal.id, f, e.target.value); setModal(p => ({ ...p, [f]: e.target.value })); }} style={inpS} />
                      </div>
                    ))}
                    <div>
                      <label style={lblS}>Agente</label>
                      <select value={modal.agente} onChange={e => { updateC(modal.id, "agente", e.target.value); setModal(p => ({ ...p, agente: e.target.value })); }} style={selS}>
                        {agentes.map(a => <option key={a}>{a}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={lblS}>Fase actual</label>
                      <select value={modal.fase} onChange={e => { updateC(modal.id, "fase", e.target.value); setModal(p => ({ ...p, fase: e.target.value })); }} style={selS}>
                        {FASES_SOAT.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                      </select>
                    </div>
                    {!FASES_SIN_ACCION.includes(modal.fase) && <>
                      <div>
                        <label style={lblS}>Próxima acción</label>
                        <select value={modal.proximaAccion || ""} onChange={e => { updateC(modal.id, "proximaAccion", e.target.value); setModal(p => ({ ...p, proximaAccion: e.target.value })); }} style={selS}>
                          <option value="">Sin definir</option>
                          {ACCIONES_SOAT.map(a => <option key={a}>{a}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={lblS}>Fecha próximo contacto</label>
                        <input type="date" value={modal.fechaProxima || ""} onChange={e => { updateC(modal.id, "fechaProxima", e.target.value); setModal(p => ({ ...p, fechaProxima: e.target.value })); }} style={inpS} />
                      </div>
                    </>}
                    {modal.fase === "no_interes" && (
                      <div style={{ gridColumn: "1/-1" }}>
                        <label style={lblS}>Motivo no compra *</label>
                        <select value={modal.motivoNoCompra || ""} onChange={e => { updateC(modal.id, "motivoNoCompra", e.target.value); setModal(p => ({ ...p, motivoNoCompra: e.target.value })); setModalCloseError(""); }} style={{ ...selS, borderColor: !modal.motivoNoCompra ? "#fca5a5" : BLUE.border }}>
                          <option value="">— Selecciona un motivo —</option>
                          {MOTIVOS_SOAT.map(m => <option key={m}>{m}</option>)}
                        </select>
                      </div>
                    )}
                    {modal.fase === "ilocalizable" && (
                      <div style={{ gridColumn: "1/-1" }}>
                        <label style={lblS}>Motivo ilocalizable</label>
                        <select value={modal.motivoNoCompra || ""} onChange={e => { updateC(modal.id, "motivoNoCompra", e.target.value); setModal(p => ({ ...p, motivoNoCompra: e.target.value })); }} style={selS}>
                          <option value="">— Selecciona —</option>
                          {MOTIVOS_ILOCALIZABLE.map(m => <option key={m}>{m}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={lblS}>Notas generales</label>
                    <textarea value={modal.notas || ""} onChange={e => { updateC(modal.id, "notas", e.target.value); setModal(p => ({ ...p, notas: e.target.value })); }} rows={3} style={{ ...inpS, resize: "vertical" }} />
                  </div>
                  {modalCloseError && (
                    <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#dc2626" }}>
                      {modalCloseError}
                    </div>
                  )}
                  <button onClick={() => deleteC(modal.id)} style={{ ...S.btn("danger"), alignSelf: "flex-start" }}>Eliminar cliente</button>
                </div>
              )}
              {activeTab === "llamada" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ background: "#f8faff", border: `1px solid ${BLUE.border}`, borderRadius: 10, padding: "12px 16px", fontSize: 12.5, color: BLUE.text }}>
                    Intento #{(modal.intentos || 0) + 1} · Agente: <strong>{modal.agente}</strong>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div style={{ gridColumn: "1/-1" }}>
                      <label style={lblS}>Resultado de la llamada *</label>
                      <select value={callLog.resultado} onChange={e => setCallLog(p => ({ ...p, resultado: e.target.value }))} style={selS}>
                        <option value="">Selecciona el resultado...</option>
                        {FASES_SOAT.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                      </select>
                    </div>
                    {callLog.resultado === "no_interes" && (
                      <div style={{ gridColumn: "1/-1" }}>
                        <label style={lblS}>Motivo no compra *</label>
                        <select value={callLog.motivo} onChange={e => { setCallLog(p => ({ ...p, motivo: e.target.value })); setCallLogError(""); }} style={{ ...selS, borderColor: !callLog.motivo ? "#fca5a5" : BLUE.border }}>
                          <option value="">— Selecciona un motivo —</option>
                          {MOTIVOS_SOAT.map(m => <option key={m}>{m}</option>)}
                        </select>
                      </div>
                    )}
                    {callLog.resultado === "ilocalizable" && (
                      <div style={{ gridColumn: "1/-1" }}>
                        <label style={lblS}>Motivo ilocalizable</label>
                        <select value={callLog.motivoIloc} onChange={e => { setCallLog(p => ({ ...p, motivoIloc: e.target.value })); setCallLogError(""); }} style={selS}>
                          <option value="">— Selecciona —</option>
                          {MOTIVOS_ILOCALIZABLE.map(m => <option key={m}>{m}</option>)}
                        </select>
                      </div>
                    )}
                    {!FASES_SIN_ACCION.includes(callLog.resultado) && callLog.resultado && <>
                      <div>
                        <label style={lblS}>Próxima acción</label>
                        <select value={callLog.proximaAccion} onChange={e => setCallLog(p => ({ ...p, proximaAccion: e.target.value }))} style={selS}>
                          <option value="">Sin definir</option>
                          {ACCIONES_SOAT.map(a => <option key={a}>{a}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={lblS}>Fecha próximo contacto</label>
                        <input type="date" value={callLog.fechaProxima} onChange={e => setCallLog(p => ({ ...p, fechaProxima: e.target.value }))} style={inpS} />
                      </div>
                    </>}
                    <div style={{ gridColumn: "1/-1" }}>
                      <label style={lblS}>Nota de la llamada</label>
                      <textarea value={callLog.nota} onChange={e => setCallLog(p => ({ ...p, nota: e.target.value }))} rows={3} placeholder="Ej: Cliente pide que lo llamen el martes..." style={{ ...inpS, resize: "vertical" }} />
                    </div>
                  </div>
                  {callLogError && (
                    <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#dc2626" }}>
                      {callLogError}
                    </div>
                  )}
                  <button onClick={registrarLlamada} disabled={!callLog.resultado}
                    style={{ ...S.btn(callLog.resultado ? "success" : "secondary"), opacity: callLog.resultado ? 1 : 0.4, cursor: callLog.resultado ? "pointer" : "not-allowed", justifyContent: "center" }}>
                    Guardar registro de llamada
                  </button>
                </div>
              )}
              {activeTab === "historial" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {(!modal.historial || modal.historial.length === 0) && (
                    <div style={{ textAlign: "center", color: "#aaa", padding: 40, fontSize: 14 }}>Sin llamadas registradas aún.</div>
                  )}
                  {(modal.historial || []).map((h, i) => {
                    const f = FM_SOAT[h.resultado];
                    return (
                      <div key={i} style={{ background: "#f8faff", border: `1px solid ${BLUE.border}`, borderRadius: 10, padding: "14px 16px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: f?.text || BLUE.text, background: f?.bg || BLUE.light, padding: "3px 12px", borderRadius: 20 }}>{f?.label || h.resultado}</span>
                          <span style={{ fontSize: 12, color: "#aaa" }}>{h.fecha} · {h.agente}</span>
                        </div>
                        {(h.motivo || h.motivoIloc) && <div style={{ fontSize: 12.5, color: "#666", marginBottom: 4 }}>Motivo: {h.motivo || h.motivoIloc}</div>}
                        {h.proximaAccion && <div style={{ fontSize: 12.5, color: "#666", marginBottom: 4 }}>Acción: {h.proximaAccion}{h.fechaProxima ? ` · ${h.fechaProxima}` : ""}</div>}
                        {h.nota && <div style={{ fontSize: 13, color: "#444", fontStyle: "italic", marginTop: 6, borderLeft: `3px solid ${BLUE.border}`, paddingLeft: 10 }}>"{h.nota}"</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Funnel modal ─────────────────────────────────────────────────────── */}
      {showFunnel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(7,29,71,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 250, padding: 16 }} onClick={() => setShowFunnel(false)}>
          <div style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 620, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(26,86,219,0.25)", padding: "28px 32px" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 20, color: BLUE.text }}>Funnel de Ventas</div>
                <div style={{ fontSize: 13, color: "#6b87b0", marginTop: 3 }}>
                  {funnelBases.length === 0 ? "Toda la base" : funnelBases.map(fmtAnioMes).join(", ")} · {funnelClientes.length} clientes
                </div>
              </div>
              <button onClick={() => setShowFunnel(false)} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#aaa" }}>×</button>
            </div>

            {/* Filtro F.Base */}
            <div style={{ background: "#f8faff", border: `1px solid ${BLUE.border}`, borderRadius: 10, padding: "14px 16px", marginBottom: 24 }}>
              <label style={lblS}>Filtrar por F. Base</label>
              <PillToggle
                options={basesDisponibles}
                selected={funnelBases}
                onChange={setFunnelBases}
                fmt={fmtAnioMes}
              />
            </div>

            {/* Barras del funnel */}
            <div style={{ marginBottom: 24 }}>
              <FunnelBar label="Base total" value={funnelData.base} total={funnelData.base} color={BLUE.primary} bold />
              <FunnelBar label="Gestionados" value={funnelData.gestionados} total={funnelData.base} color="#6366f1" />
              <FunnelBar label="No interesados" value={funnelData.noInteres} total={funnelData.base} color="#ef4444" onClick={funnelData.noInteres > 0 ? () => setShowNoInteresDetail(v => !v) : undefined} />
              {showNoInteresDetail && funnelData.noInteres > 0 && (() => {
                const noInteresClientes = funnelClientes.filter(c => c.fase === "no_interes");
                const motivosCount = [...MOTIVOS_SOAT, ""].reduce((acc, m) => {
                  acc[m || "Sin motivo"] = noInteresClientes.filter(c => (c.motivoNoCompra || "") === m).length;
                  return acc;
                }, {});
                return (
                  <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 10, padding: "14px 16px", marginBottom: 12, marginTop: -4 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#9f1239", marginBottom: 10 }}>Desglose por motivo — {funnelData.noInteres} no interesados</div>
                    {Object.entries(motivosCount).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([motivo, count]) => (
                      <div key={motivo} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6, color: "#555" }}>
                        <span>{motivo}</span>
                        <span style={{ fontWeight: 700, color: "#ef4444" }}>{count} <span style={{ color: "#aaa", fontWeight: 400 }}>({Math.round((count / funnelData.noInteres) * 100)}%)</span></span>
                      </div>
                    ))}
                  </div>
                );
              })()}
              <FunnelBar label="Compró" value={funnelData.compro} total={funnelData.base} color="#8b5cf6" />
              <FunnelBar label="Ilocalizable" value={funnelData.ilocalizable} total={funnelData.base} color="#9ca3af" />
              <FunnelBar label="Clientes activos (En gestión + Interesados)" value={funnelData.activos} total={funnelData.base} color="#10b981" />
            </div>

            {/* KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                {
                  label: "% de Éxito",
                  value: funnelData.gestionados > 0 ? ((funnelData.compro / funnelData.gestionados) * 100).toFixed(1) : "0.0",
                  sub: `${funnelData.compro} compró / ${funnelData.gestionados} gestionados`,
                  color: "#8b5cf6",
                  bg: "#ede9fe",
                },
                {
                  label: "% Clientes Perdidos",
                  value: funnelData.gestionados > 0 ? ((funnelData.noInteres / funnelData.gestionados) * 100).toFixed(1) : "0.0",
                  sub: `${funnelData.noInteres} no interesados / ${funnelData.gestionados} gestionados`,
                  color: "#ef4444",
                  bg: "#fee2e2",
                },
              ].map(k => (
                <div key={k.label} style={{ background: k.bg, border: `1px solid ${k.color}30`, borderRadius: 12, padding: "20px 22px", textAlign: "center" }}>
                  <div style={{ fontSize: 38, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}%</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: k.color, marginTop: 8 }}>{k.label}</div>
                  <div style={{ fontSize: 11.5, color: "#666", marginTop: 4 }}>{k.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Ilocalizable warning ────────────────────────────────────────────── */}
      {ilocWarning && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(7,29,71,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 16 }} onClick={() => setIlocWarning(false)}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 420, padding: "28px 32px", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", textAlign: "center" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontWeight: 800, fontSize: 17, color: "#92400e", marginBottom: 10 }}>Llamadas insuficientes</div>
            <div style={{ fontSize: 14, color: "#555", lineHeight: 1.6, marginBottom: 20 }}>
              Recuerde que debe llamar más de <strong>3 veces en días diferentes</strong> antes de seleccionar "No contestó / Buzón" como motivo.
            </div>
            <button onClick={() => setIlocWarning(false)} style={{ ...S.btn("primary"), justifyContent: "center", width: "100%" }}>Entendido</button>
          </div>
        </div>
      )}

      {/* ── Export dialog ────────────────────────────────────────────────────── */}
      {showExportDialog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(7,29,71,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 250, padding: 16 }} onClick={() => setShowExportDialog(false)}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 540, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(26,86,219,0.2)", padding: "28px 32px" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: BLUE.text }}>Exportar a Excel</div>
              <button onClick={() => setShowExportDialog(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#aaa" }}>×</button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={lblS}>F. Base <span style={{ color: "#aaa", fontWeight: 400, textTransform: "none" }}>(vacío = todas)</span></label>
              <PillToggle options={basesDisponibles} selected={exportBases} onChange={setExportBases} fmt={fmtAnioMes} />
            </div>

            <div style={{ marginBottom: 28 }}>
              <label style={lblS}>Estados <span style={{ color: "#aaa", fontWeight: 400, textTransform: "none" }}>(vacío = todos)</span></label>
              <PillToggle
                options={FASES_SOAT.map(f => f.id)}
                selected={exportEstados}
                onChange={setExportEstados}
                fmt={id => FM_SOAT[id]?.label || id}
              />
            </div>

            <div style={{ background: "#f8faff", border: `1px solid ${BLUE.border}`, borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "#6b87b0" }}>
              Se exportarán <strong style={{ color: BLUE.text }}>
                {(() => {
                  let lista = clientes;
                  if (exportBases.length > 0) lista = lista.filter(c => exportBases.includes(c.anioMes));
                  if (exportEstados.length > 0) lista = lista.filter(c => exportEstados.includes(c.fase));
                  return lista.length;
                })()} registros
              </strong>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowExportDialog(false)} style={S.btn("secondary")}>Cancelar</button>
              <button onClick={ejecutarExport} style={S.btn("success")}>
                <Icon name="download" size={16} /> Descargar Excel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SoatPage;
