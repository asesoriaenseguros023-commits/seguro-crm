import { useState, useEffect, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../supabase.js";
import { S, BLUE, FASES_SOAT, FM_SOAT, MOTIVOS_SOAT, ACCIONES_SOAT } from "../constants.js";
import { parseDateSoat, diasRenSoat, mapSoat, toSoatRow } from "../helpers.js";
import Icon from "../components/Icon.jsx";

let soatNid = Date.now();
const soatNewId = () => `s${++soatNid}`;
const soatEmpty = () => ({
  id: soatNewId(), nombre: "", telefono: "", placa: "", anioMes: "",
  fechaCompra: "", fase: "pendiente", agente: "Sin asignar",
  intentos: 0, proximaAccion: "", fechaProxima: "",
  motivoNoCompra: "", historial: [], notas: "",
});

const SoatPage = ({ showConfirm }) => {
  const [clientes, setClientes] = useState([]);
  const [loadingSoat, setLoadingSoat] = useState(true);
  const [filtroFase, setFiltroFase] = useState("Todos");
  const [filtroAgente, setFiltroAgente] = useState("Todos");
  const [filtroFechaCompra, setFiltroFechaCompra] = useState("Todos");
  const [busqueda, setBusqueda] = useState("");
  const [modal, setModal] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [agentes, setAgentes] = useState(["Sin asignar","YELI","ENCARNACION","SANTIAGO","WEYMAR"]);
  const [nuevoAgente, setNuevoAgente] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const [activeTab, setActiveTab] = useState("info");
  const [callLog, setCallLog] = useState({ resultado: "", motivo: "", proximaAccion: "", fechaProxima: "", nota: "" });
  const fileRef = useRef();

  // ─── Carga inicial ────────────────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from("soat_clientes")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setClientes(data.map(mapSoat));
        setLoadingSoat(false);
      });

    // Realtime para soat_clientes
    const channel = supabase
      .channel("soat-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "soat_clientes" }, (payload) => {
        if (payload.eventType === "INSERT") {
          setClientes((prev) =>
            prev.some((x) => x.id === payload.new.id) ? prev : [mapSoat(payload.new), ...prev]
          );
        }
        if (payload.eventType === "UPDATE") {
          setClientes((prev) =>
            prev.map((x) => (x.id === payload.new.id ? mapSoat(payload.new) : x))
          );
        }
        if (payload.eventType === "DELETE") {
          setClientes((prev) => prev.filter((x) => x.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // ─── Template ─────────────────────────────────────────────────────────────
  const descargarTemplate = () => {
    const cols = ["Nombre","Telefono","Placa","Fecha Compra","Fecha Base","Estado"];
    const ejemplo = [
      ["MARIA LOPEZ","3001234567","ABC123","16/01/2025",""],
      ["JUAN PEREZ","3109876543","XYZ789","22/03/2025",""],
    ];
    const ws = XLSX.utils.aoa_to_sheet([cols, ...ejemplo]);
    ws["!cols"] = cols.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clientes SOAT");
    XLSX.writeFile(wb, "template_soat.xlsx");
  };

  // ─── Update campo ─────────────────────────────────────────────────────────
  const updateC = async (id, field, value) => {
    const dbField = {
      fase: "fase", agente: "agente", proximaAccion: "proxima_accion",
      fechaProxima: "fecha_proxima", motivoNoCompra: "motivo_no_compra",
      notas: "notas", nombre: "nombre", telefono: "telefono",
      placa: "placa", anioMes: "anio_mes", fechaCompra: "fecha_compra",
    }[field] || field;
    setClientes((p) => p.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
    if (modal?.id === id) setModal((p) => ({ ...p, [field]: value }));
    await supabase.from("soat_clientes").update({ [dbField]: value }).eq("id", id);
  };

  const openModal = (c) => {
    setModal(c);
    setActiveTab("info");
    setCallLog({ resultado: "", motivo: "", proximaAccion: "", fechaProxima: "", nota: "" });
  };

  const registrarLlamada = async () => {
    if (!callLog.resultado) return;
    const entry = { fecha: new Date().toLocaleDateString("es-CO"), ...callLog, agente: modal.agente };
    const updated = {
      ...modal,
      historial: [entry, ...(modal.historial || [])],
      intentos: (modal.intentos || 0) + 1,
      fase: callLog.resultado,
      proximaAccion: callLog.proximaAccion || modal.proximaAccion,
      fechaProxima: callLog.fechaProxima || modal.fechaProxima,
      motivoNoCompra: callLog.motivo || modal.motivoNoCompra,
    };
    setClientes((p) => p.map((c) => (c.id === modal.id ? updated : c)));
    await supabase.from("soat_clientes").update({
      historial: updated.historial, intentos: updated.intentos, fase: updated.fase,
      proxima_accion: updated.proximaAccion, fecha_proxima: updated.fechaProxima,
      motivo_no_compra: updated.motivoNoCompra,
    }).eq("id", modal.id);
    setModal(updated);
    setCallLog({ resultado: "", motivo: "", proximaAccion: "", fechaProxima: "", nota: "" });
    setActiveTab("historial");
  };

  const deleteC = async (id) => {
    const ok = await showConfirm("¿Eliminar cliente?", "Esta acción no se puede deshacer.");
    if (!ok) return;
    await supabase.from("soat_clientes").delete().eq("id", id);
    setClientes((p) => p.filter((c) => c.id !== id));
    setModal(null);
  };

  const addCliente = () => {
    const c = soatEmpty();
    setClientes((p) => [c, ...p]);
    openModal(c);
  };

  // ─── Import CSV/XLSX ──────────────────────────────────────────────────────
  const importCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportMsg("Leyendo archivo…");
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
      if (!rows.length) { setImportMsg("El archivo está vacío"); return; }
      const keys = Object.keys(rows[0]);
      const col = (...names) => { for (const n of names) { const k = keys.find((k) => k.toLowerCase().includes(n.toLowerCase())); if (k) return k; } return null; };
      const kN = col("nombre","name"), kT = col("tel","cel","phone"), kP = col("placa","plate");
      const kF = col("fecha compra","fecha","date","compra"), kE = col("estado","status","fase"), kM = col("fecha base","base","mes","año","anio");
      if (!kN) { setImportMsg("No se encontró columna 'Nombre'"); return; }
      const fm = {
        "interesado volver a llamar": "interesado", "volver a llamar no contesto": "en_gestion",
        "volver a llamar": "en_gestion", "no interesado": "no_interes", "cliente compro": "compro",
        "ilocalizable": "ilocalizable", "en gestión": "en_gestion", "en gestion": "en_gestion",
        "interesado": "interesado", "compró": "compro", "no interesado": "no_interes",
      };

      const parseAnioMes = (val) => {
        if (!val) return "";
        try {
          if (val instanceof Date) {
            const m = String(val.getMonth() + 1).padStart(2, "0");
            return `${m}-${val.getFullYear()}`;
          }
          const s = String(val).trim();
          if (!s) return "";
          const parts = s.split(/[/.-]/);
          if (parts.length === 3) {
            let d, m, y;
            if (parts[2].length === 4) { [d, m, y] = parts; }
            else if (parts[0].length === 4) { [y, m, d] = parts; }
            else return "";
            return `${m.padStart(2, "0")}-${y}`;
          }
        } catch {}
        return "";
      };

      const nuevos = rows
        .map((r) => {
          const fechaRaw = kF ? r[kF] : "";
          const fechaStr =
            fechaRaw instanceof Date
              ? `${String(fechaRaw.getDate()).padStart(2, "0")}/${String(fechaRaw.getMonth() + 1).padStart(2, "0")}/${fechaRaw.getFullYear()}`
              : String(fechaRaw || "").trim();
          const anioMesVal = kM ? String(r[kM] || "").trim() : parseAnioMes(fechaRaw);
          const er = kE ? String(r[kE] || "").toLowerCase().trim() : "";
          return {
            ...soatEmpty(),
            id: soatNewId(),
            nombre: String(r[kN] || "").trim(),
            telefono: kT ? String(r[kT] || "").trim() : "",
            placa: kP ? String(r[kP] || "").trim() : "",
            fechaCompra: fechaStr,
            anioMes: anioMesVal,
            fase: fm[er] || "pendiente",
            agente: "Sin asignar",
          };
        })
        .filter((c) => c.nombre);

      const BATCH = 50;
      let insertados = [];
      for (let i = 0; i < nuevos.length; i += BATCH) {
        const { data, error } = await supabase
          .from("soat_clientes")
          .insert(nuevos.slice(i, i + BATCH).map(toSoatRow))
          .select();
        if (error) throw error;
        if (data) insertados = insertados.concat(data.map(mapSoat));
      }
      setClientes((p) => [...insertados, ...p]);
      setImportMsg(`${insertados.length} clientes importados`);
      setTimeout(() => setImportMsg(""), 4000);
    } catch (err) {
      setImportMsg("Error: " + err.message);
      console.error(err);
    }
    e.target.value = "";
  };

  // ─── Export XLSX ──────────────────────────────────────────────────────────
  const exportXLSX_SOAT = () => {
    const cols = ["#","Fecha Base","Nombre","Teléfono","Placa","Fecha Compra","Fase","Agente","Intentos","Próxima Acción","Fecha Próxima","Motivo No Compra","Notas"];
    const rows = filtrados.map((c, i) => [
      i + 1, c.anioMes || "", c.nombre, c.telefono, c.placa, c.fechaCompra,
      FM_SOAT[c.fase]?.label || c.fase, c.agente, c.intentos, c.proximaAccion,
      c.fechaProxima, c.motivoNoCompra, c.notas,
    ]);
    const ws = XLSX.utils.aoa_to_sheet([cols, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SOAT");
    XLSX.writeFile(wb, "soat-seguimiento.xlsx");
  };

  const fechasCompra = useMemo(
    () => [...new Set(clientes.map((c) => c.fechaCompra).filter(Boolean))].sort(),
    [clientes]
  );

  const filtrados = clientes.filter((c) => {
    const mF = filtroFase === "Todos" || c.fase === filtroFase;
    const mA = filtroAgente === "Todos" || c.agente === filtroAgente;
    const mFC = filtroFechaCompra === "Todos" || c.fechaCompra === filtroFechaCompra;
    const mB =
      !busqueda ||
      c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      (c.telefono || "").includes(busqueda) ||
      (c.placa || "").toLowerCase().includes(busqueda.toLowerCase());
    return mF && mA && mFC && mB;
  });

  const stats = {
    total: clientes.length,
    sinGestionar: clientes.filter((c) => c.intentos === 0).length,
    enGestion: clientes.filter((c) => c.fase === "en_gestion" || c.fase === "pendiente").length,
    interesados: clientes.filter((c) => c.fase === "interesado" || c.fase === "cotizado").length,
    compro: clientes.filter((c) => c.fase === "compro").length,
    proximos30: clientes.filter((c) => { const d = diasRenSoat(c.fechaCompra); return d !== null && d >= 0 && d <= 30; }).length,
  };

  const alertaHoy = clientes.filter((c) => {
    if (!c.fechaProxima) return false;
    const d = parseDateSoat(c.fechaProxima);
    return d && d <= new Date();
  });

  const inpS = { background: "#f8faff", border: `1px solid ${BLUE.border}`, borderRadius: 8, padding: "8px 11px", color: BLUE.text, fontSize: 13, outline: "none", width: "100%", fontFamily: "inherit" };
  const lblS = { fontSize: 11, color: "#6b87b0", textTransform: "uppercase", marginBottom: 4, letterSpacing: "0.05em", display: "block" };
  const selS = { ...inpS, cursor: "pointer" };

  return (
    <div>
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>Seguimiento Clientes SOAT</div>
          <div style={S.pageSub}>{clientes.length} clientes registrados</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={descargarTemplate} style={{ ...S.btn("ghost"), border: `1px solid ${BLUE.border}` }}>
            Descargar Template
          </button>
          <button onClick={() => fileRef.current.click()} style={S.btn("secondary")}>
            <Icon name="upload" size={16} />Importar
          </button>
          <button onClick={exportXLSX_SOAT} style={S.btn("success")}>
            <Icon name="download" size={16} />Exportar Excel
          </button>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={importCSV} style={{ display: "none" }} />
        </div>
      </div>

      {loadingSoat && <div style={{ textAlign: "center", padding: 40, color: "#6b87b0" }}>Cargando clientes SOAT…</div>}

      {importMsg && (
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "#16a34a" }}>
          {importMsg}
        </div>
      )}
      {alertaHoy.length > 0 && (
        <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "#92400e" }}>
          <Icon name="bell" size={14} />{" "}
          <strong>{alertaHoy.length} cliente{alertaHoy.length > 1 ? "s" : ""}</strong> con seguimiento pendiente para hoy o antes
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 10, marginBottom: 18 }}>
        {[
          { label: "Total", value: stats.total, color: BLUE.primary },
          { label: "Sin gestionar", value: stats.sinGestionar, color: "#f97316" },
          { label: "En gestión", value: stats.enGestion, color: "#f59e0b" },
          { label: "Interesados", value: stats.interesados, color: "#16a34a" },
          { label: "Compraron", value: stats.compro, color: "#8b5cf6" },
          { label: "Vencen ≤30d", value: stats.proximos30, color: "#dc2626" },
        ].map((s) => (
          <div key={s.label} style={{ background: "#fff", border: `1px solid ${BLUE.border}`, borderRadius: 12, padding: "14px 16px", boxShadow: "0 1px 4px rgba(26,86,219,0.07)" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "#6b87b0", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto", paddingBottom: 4 }}>
        {[{ id: "Todos", label: "Todos", color: "#6b7280" }, ...FASES_SOAT].map((f) => {
          const cnt = f.id === "Todos" ? clientes.length : clientes.filter((c) => c.fase === f.id).length;
          const active = filtroFase === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFiltroFase(f.id)}
              style={{
                background: active ? f.color : "#fff",
                border: `1.5px solid ${active ? f.color : BLUE.border}`,
                borderRadius: 20, padding: "5px 14px", fontSize: 12,
                color: active ? "#fff" : f.color || "#555",
                cursor: "pointer", whiteSpace: "nowrap", fontWeight: active ? 600 : 400,
              }}
            >
              {f.label} ({cnt})
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
        <div style={S.searchBar}>
          <Icon name="search" size={16} />
          <input style={S.searchInput} placeholder="Buscar nombre, teléfono o placa..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
        <select value={filtroAgente} onChange={(e) => setFiltroAgente(e.target.value)} style={{ ...S.select, width: "auto", padding: "7px 12px" }}>
          <option value="Todos">Todos los agentes</option>
          {agentes.map((a) => <option key={a}>{a}</option>)}
        </select>
        <select value={filtroFechaCompra} onChange={(e) => setFiltroFechaCompra(e.target.value)} style={{ ...S.select, width: "auto", padding: "7px 12px" }}>
          <option value="Todos">Todas las F. Compra</option>
          {fechasCompra.map((f) => <option key={f}>{f}</option>)}
        </select>
        <span style={{ fontSize: 12, color: "#6b87b0", whiteSpace: "nowrap" }}>{filtrados.length} registros</span>
      </div>

      <div style={{ ...S.tableWrap, overflowX: "auto" }}>
        <div style={{ minWidth: 900 }}>
          <div style={{ ...S.tableHead, display: "grid", gridTemplateColumns: "35px 70px 1.3fr 0.9fr 0.6fr 0.8fr 1.2fr 0.4fr 0.8fr 1fr 0.6fr 60px" }}>
            <span>#</span><span>Fecha Base</span><span>Cliente</span><span>Teléfono</span>
            <span>Placa</span><span>F. Compra</span><span>Renov.</span><span>Fase</span>
            <span>Int.</span><span>Agente</span><span>Próxima acción</span><span>Fecha</span><span></span>
          </div>
          {filtrados.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#aaa" }}>
              Sin registros. Importa un CSV o agrega clientes.
            </div>
          ) : (
            filtrados.map((c, idx) => {
              const fase = FM_SOAT[c.fase] || FASES_SOAT[0];
              const urgente = c.fechaProxima && parseDateSoat(c.fechaProxima) <= new Date();
              return (
                <div
                  key={c.id}
                  style={{ ...S.tableRow, display: "grid", gridTemplateColumns: "35px 70px 1.3fr 0.9fr 0.6fr 0.8fr 1.2fr 0.4fr 0.8fr 1fr 0.6fr 60px" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = BLUE.light)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  <div style={{ fontWeight: 700, color: "#aaa", fontSize: 12 }}>{idx + 1}</div>
                  <div style={{ fontSize: 12, color: "#555", fontWeight: 600 }}>{c.anioMes || "—"}</div>
                  <div
                    style={{ fontWeight: 600, fontSize: 13, cursor: "pointer", color: BLUE.primary }}
                    onClick={() => openModal(c)}
                  >
                    {c.nombre || "—"}
                    {c.historial?.length > 0 && (
                      <span style={{ marginLeft: 6, fontSize: 10, color: "#aaa" }}>({c.historial.length})</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12.5, color: "#555" }}>{c.telefono || "—"}</div>
                  <div style={{ fontSize: 12.5, color: "#555" }}>{c.placa || "—"}</div>
                  <div style={{ fontSize: 12, color: "#555" }}>{c.fechaCompra || "—"}</div>
                  <select
                    value={c.fase}
                    onChange={(e) => updateC(c.id, "fase", e.target.value)}
                    style={{ fontSize: 11, padding: "3px 7px", borderRadius: 6, border: `1.5px solid ${fase.color}`, background: fase.bg, color: fase.text, cursor: "pointer", outline: "none", fontWeight: 600, width: "100%" }}
                  >
                    {FASES_SOAT.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </select>
                  <div style={{ textAlign: "center" }}>
                    <span style={{ background: BLUE.light, borderRadius: 20, padding: "2px 10px", fontSize: 12, color: c.intentos >= 3 ? "#dc2626" : c.intentos >= 1 ? "#f59e0b" : "#aaa" }}>
                      {c.intentos || 0}
                    </span>
                  </div>
                  <select
                    value={c.agente}
                    onChange={(e) => updateC(c.id, "agente", e.target.value)}
                    style={{ fontSize: 11, padding: "3px 7px", borderRadius: 6, border: `1px solid ${BLUE.border}`, background: "#fff", color: BLUE.text, cursor: "pointer", outline: "none", width: "100%" }}
                  >
                    {agentes.map((a) => <option key={a}>{a}</option>)}
                  </select>
                  <div style={{ fontSize: 11.5, color: "#555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.proximaAccion || "—"}
                  </div>
                  <div>
                    {c.fechaProxima ? (
                      <span style={{ fontSize: 11, color: urgente ? "#dc2626" : "#555", background: urgente ? "#fee2e2" : "transparent", padding: urgente ? "2px 7px" : "0", borderRadius: 20 }}>
                        {c.fechaProxima}
                      </span>
                    ) : "—"}
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => openModal(c)} style={{ ...S.btn("secondary"), padding: "4px 8px", fontSize: 11 }}>Ver</button>
                    <button onClick={() => setEditModal({ ...c })} style={{ ...S.btn("ghost"), padding: "4px 8px", fontSize: 11 }}>
                      <Icon name="edit" size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal edición rápida */}
      {editModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}
          onClick={() => setEditModal(null)}
        >
          <div
            style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 480, padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: BLUE.text }}>Editar Cliente</div>
              <button onClick={() => setEditModal(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#aaa" }}>×</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              {[["Nombre","nombre"],["Teléfono","telefono"],["Placa","placa"],["Fecha de Compra","fechaCompra"],["Fecha Base","anioMes"]].map(([l, f]) => (
                <div key={f} style={{ gridColumn: f === "nombre" ? "1/-1" : "auto" }}>
                  <label style={{ fontSize: 11, color: "#6b87b0", textTransform: "uppercase", marginBottom: 4, display: "block" }}>{l}</label>
                  <input
                    value={editModal[f] || ""}
                    onChange={(e) => setEditModal((p) => ({ ...p, [f]: e.target.value }))}
                    style={{ background: "#f8faff", border: `1px solid ${BLUE.border}`, borderRadius: 8, padding: "8px 11px", color: BLUE.text, fontSize: 13, width: "100%", fontFamily: "inherit", boxSizing: "border-box" }}
                  />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 11, color: "#6b87b0", textTransform: "uppercase", marginBottom: 4, display: "block" }}>Fase</label>
                <select
                  value={editModal.fase}
                  onChange={(e) => setEditModal((p) => ({ ...p, fase: e.target.value }))}
                  style={{ background: "#f8faff", border: `1px solid ${BLUE.border}`, borderRadius: 8, padding: "8px 11px", fontSize: 13, width: "100%", fontFamily: "inherit" }}
                >
                  {FASES_SOAT.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
              <button
                style={S.btn("danger")}
                onClick={async () => {
                  const ok = await showConfirm(`¿Eliminar a ${editModal.nombre}?`, "Esta acción no se puede deshacer.");
                  if (!ok) return;
                  await supabase.from("soat_clientes").delete().eq("id", editModal.id);
                  setClientes((p) => p.filter((c) => c.id !== editModal.id));
                  setEditModal(null);
                }}
              >
                Eliminar
              </button>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setEditModal(null)} style={S.btn("secondary")}>Cancelar</button>
                <button
                  style={S.btn("primary")}
                  onClick={async () => {
                    await supabase.from("soat_clientes").update(toSoatRow(editModal)).eq("id", editModal.id);
                    setClientes((p) => p.map((c) => (c.id === editModal.id ? { ...c, ...editModal } : c)));
                    setEditModal(null);
                  }}
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gestión de agentes */}
      <div style={{ marginTop: 20, background: "#fff", border: `1px solid ${BLUE.border}`, borderRadius: 12, padding: "14px 18px" }}>
        <div style={{ fontWeight: 600, marginBottom: 10, color: "#6b87b0", fontSize: 12, textTransform: "uppercase" }}>Agentes comerciales</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {agentes.slice(1).map((a) => (
            <div key={a} style={{ background: BLUE.light, borderRadius: 20, padding: "4px 12px", fontSize: 12, display: "flex", gap: 8, alignItems: "center", color: BLUE.text }}>
              {a}
              <span style={{ cursor: "pointer", color: "#dc2626", fontWeight: 700 }} onClick={() => setAgentes((p) => p.filter((x) => x !== a))}>×</span>
            </div>
          ))}
          <input
            value={nuevoAgente}
            onChange={(e) => setNuevoAgente(e.target.value)}
            placeholder="Nuevo agente..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && nuevoAgente.trim()) {
                setAgentes((p) => [...p, nuevoAgente.trim()]);
                setNuevoAgente("");
              }
            }}
            style={{ ...S.input, width: 140, padding: "5px 10px", fontSize: 12 }}
          />
          <button
            onClick={() => {
              if (nuevoAgente.trim()) { setAgentes((p) => [...p, nuevoAgente.trim()]); setNuevoAgente(""); }
            }}
            style={S.btn("secondary")}
          >
            + Agregar
          </button>
        </div>
      </div>

      {/* Modal detalle */}
      {modal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}
          onClick={() => setModal(null)}
        >
          <div
            style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 640, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "20px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18, color: BLUE.text }}>{modal.nombre || "Nuevo cliente"}</div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
                  {modal.telefono}{modal.placa ? ` · ${modal.placa}` : ""} · {modal.intentos || 0} intento{modal.intentos !== 1 ? "s" : ""}
                </div>
              </div>
              <button onClick={() => setModal(null)} style={{ background: "transparent", border: "none", color: "#aaa", fontSize: 22, cursor: "pointer" }}>×</button>
            </div>

            <div style={{ display: "flex", gap: 0, padding: "14px 24px 0", borderBottom: `1px solid ${BLUE.border}` }}>
              {[["info","Info"],["llamada","Llamada"],["historial",`Historial (${modal.historial?.length || 0})`]].map(([t, l]) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  style={{
                    background: activeTab === t ? BLUE.light : "transparent", border: "none",
                    color: activeTab === t ? BLUE.primary : "#aaa",
                    borderRadius: "8px 8px 0 0", padding: "8px 16px", fontSize: 13,
                    cursor: "pointer", fontWeight: activeTab === t ? 600 : 400,
                  }}
                >
                  {l}
                </button>
              ))}
            </div>

            <div style={{ padding: "20px 24px 24px" }}>
              {activeTab === "info" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {[["Nombre","nombre"],["Teléfono","telefono"],["Placa","placa"],["Fecha de compra","fechaCompra"],["Fecha Base","anioMes"]].map(([l, f]) => (
                      <div key={f}>
                        <label style={lblS}>{l}</label>
                        <input
                          value={modal[f] || ""}
                          onChange={(e) => { updateC(modal.id, f, e.target.value); setModal((p) => ({ ...p, [f]: e.target.value })); }}
                          style={inpS}
                        />
                      </div>
                    ))}
                    <div>
                      <label style={lblS}>Fase actual</label>
                      <select
                        value={modal.fase}
                        onChange={(e) => { updateC(modal.id, "fase", e.target.value); setModal((p) => ({ ...p, fase: e.target.value })); }}
                        style={selS}
                      >
                        {FASES_SOAT.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={lblS}>Próxima acción</label>
                      <select
                        value={modal.proximaAccion || ""}
                        onChange={(e) => { updateC(modal.id, "proximaAccion", e.target.value); setModal((p) => ({ ...p, proximaAccion: e.target.value })); }}
                        style={selS}
                      >
                        <option value="">Sin definir</option>
                        {ACCIONES_SOAT.map((a) => <option key={a}>{a}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={lblS}>Fecha próximo contacto</label>
                      <input
                        type="date"
                        value={modal.fechaProxima || ""}
                        onChange={(e) => { updateC(modal.id, "fechaProxima", e.target.value); setModal((p) => ({ ...p, fechaProxima: e.target.value })); }}
                        style={inpS}
                      />
                    </div>
                    <div style={{ gridColumn: "1/-1" }}>
                      <label style={lblS}>Motivo no compra</label>
                      <select
                        value={modal.motivoNoCompra || ""}
                        onChange={(e) => { updateC(modal.id, "motivoNoCompra", e.target.value); setModal((p) => ({ ...p, motivoNoCompra: e.target.value })); }}
                        style={selS}
                      >
                        <option value="">N/A</option>
                        {MOTIVOS_SOAT.map((m) => <option key={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={lblS}>Notas generales</label>
                    <textarea
                      value={modal.notas || ""}
                      onChange={(e) => { updateC(modal.id, "notas", e.target.value); setModal((p) => ({ ...p, notas: e.target.value })); }}
                      rows={3}
                      style={{ ...inpS, resize: "vertical" }}
                    />
                  </div>
                  <button onClick={() => deleteC(modal.id)} style={{ ...S.btn("danger"), width: "100%", justifyContent: "center" }}>
                    Eliminar cliente
                  </button>
                </div>
              )}

              {activeTab === "llamada" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ background: BLUE.light, border: `1px solid ${BLUE.border}`, borderRadius: 12, padding: 16 }}>
                    <div style={{ fontSize: 11, color: "#6b87b0", marginBottom: 10, textTransform: "uppercase" }}>
                      Intento #{(modal.intentos || 0) + 1} · Agente: {modal.agente}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div style={{ gridColumn: "1/-1" }}>
                        <label style={lblS}>Resultado *</label>
                        <select value={callLog.resultado} onChange={(e) => setCallLog((p) => ({ ...p, resultado: e.target.value }))} style={selS}>
                          <option value="">Selecciona resultado...</option>
                          {FASES_SOAT.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={lblS}>Motivo no compra</label>
                        <select value={callLog.motivo} onChange={(e) => setCallLog((p) => ({ ...p, motivo: e.target.value }))} style={selS}>
                          <option value="">N/A</option>
                          {MOTIVOS_SOAT.map((m) => <option key={m}>{m}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={lblS}>Próxima acción</label>
                        <select value={callLog.proximaAccion} onChange={(e) => setCallLog((p) => ({ ...p, proximaAccion: e.target.value }))} style={selS}>
                          <option value="">Sin definir</option>
                          {ACCIONES_SOAT.map((a) => <option key={a}>{a}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={lblS}>Fecha próximo contacto</label>
                        <input type="date" value={callLog.fechaProxima} onChange={(e) => setCallLog((p) => ({ ...p, fechaProxima: e.target.value }))} style={inpS} />
                      </div>
                      <div style={{ gridColumn: "1/-1" }}>
                        <label style={lblS}>Nota de la llamada</label>
                        <textarea value={callLog.nota} onChange={(e) => setCallLog((p) => ({ ...p, nota: e.target.value }))} rows={2} placeholder="Ej: Cliente pide que lo llamen el martes..." style={{ ...inpS, resize: "vertical" }} />
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={registrarLlamada}
                    disabled={!callLog.resultado}
                    style={{ ...S.btn(callLog.resultado ? "success" : "secondary"), width: "100%", justifyContent: "center", opacity: callLog.resultado ? 1 : 0.4, cursor: callLog.resultado ? "pointer" : "not-allowed" }}
                  >
                    Guardar registro de llamada
                  </button>
                </div>
              )}

              {activeTab === "historial" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {(!modal.historial || modal.historial.length === 0) && (
                    <div style={{ textAlign: "center", color: "#aaa", padding: 30 }}>Sin llamadas registradas aún.</div>
                  )}
                  {(modal.historial || []).map((h, i) => {
                    const f = FM_SOAT[h.resultado];
                    return (
                      <div key={i} style={{ background: BLUE.light, border: `1px solid ${BLUE.border}`, borderRadius: 10, padding: "12px 14px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: f?.text || BLUE.text, background: f?.bg || BLUE.light, padding: "2px 10px", borderRadius: 20 }}>{f?.label || h.resultado}</span>
                          <span style={{ fontSize: 11, color: "#aaa" }}>{h.fecha} · {h.agente}</span>
                        </div>
                        {h.motivo && <div style={{ fontSize: 12, color: "#888", marginBottom: 3 }}>Motivo: {h.motivo}</div>}
                        {h.proximaAccion && <div style={{ fontSize: 12, color: "#888", marginBottom: 3 }}>Acción: {h.proximaAccion}{h.fechaProxima ? ` · ${h.fechaProxima}` : ""}</div>}
                        {h.nota && <div style={{ fontSize: 12, color: "#555", fontStyle: "italic", marginTop: 4 }}>"{h.nota}"</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SoatPage;
