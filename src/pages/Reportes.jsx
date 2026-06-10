import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { S, BLUE } from "../constants.js";
import { fmt, fmtDate, today } from "../helpers.js";
import Icon from "../components/Icon.jsx";

const ReportesPage = ({ polizas, ramos, clientes }) => {
  const [fechaInicio, setFechaInicio] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [fechaFin, setFechaFin] = useState(today());
  const [filtroAseg, setFiltroAseg] = useState("Todas");
  const [filtroRamo, setFiltroRamo] = useState("Todos");
  const [filtroCliente, setFiltroCliente] = useState("Todos");

  const polizasFiltradas = useMemo(
    () =>
      polizas.filter((p) => {
        const fe = p.fechaEmision || p.vigenciaInicio;
        if (!fe) return false;
        return (
          fe >= fechaInicio &&
          fe <= fechaFin &&
          (filtroAseg === "Todas" || p.aseguradora === filtroAseg) &&
          (filtroRamo === "Todos" || p.ramo === filtroRamo) &&
          (filtroCliente === "Todos" || p.clienteNombre === filtroCliente)
        );
      }),
    [polizas, fechaInicio, fechaFin, filtroAseg, filtroRamo, filtroCliente]
  );

  const aseguradoras = [...new Set(polizas.map((p) => p.aseguradora).filter(Boolean))].sort();
  const ramosLista = [...new Set(polizas.map((p) => p.ramo).filter(Boolean))].sort();
  const clientesLista = [...new Set(polizas.map((p) => p.clienteNombre).filter(Boolean))].sort();
  const totalPrima = polizasFiltradas.reduce((s, p) => s + Number(p.prima || 0), 0);
  const totalSuma = polizasFiltradas.reduce((s, p) => s + Number(p.sumaAsegurada || 0), 0);

  const porAseg = useMemo(() => {
    const map = {};
    polizasFiltradas.forEach((p) => {
      if (!map[p.aseguradora]) map[p.aseguradora] = { nombre: p.aseguradora, cantidad: 0, prima: 0 };
      map[p.aseguradora].cantidad++;
      map[p.aseguradora].prima += Number(p.prima || 0);
    });
    return Object.values(map).sort((a, b) => b.prima - a.prima);
  }, [polizasFiltradas]);

  const porRamo = useMemo(() => {
    const map = {};
    polizasFiltradas.forEach((p) => {
      const r = p.ramo || "Sin ramo";
      if (!map[r]) map[r] = { nombre: r, cantidad: 0, prima: 0 };
      map[r].cantidad++;
      map[r].prima += Number(p.prima || 0);
    });
    return Object.values(map).sort((a, b) => b.cantidad - a.cantidad);
  }, [polizasFiltradas]);

  const maxPrima = porAseg.length > 0 ? Math.max(...porAseg.map((a) => a.prima)) : 1;

  const exportXLSX = () => {
    const headers = ["#","N° Póliza","Cliente","Ramo","Aseguradora","Prima","Suma Asegurada","Fecha Emisión"];
    const rows = polizasFiltradas.map((p, i) => [
      i + 1,
      p.numero || "—",
      p.clienteNombre || "—",
      p.ramo || "—",
      p.aseguradora || "—",
      Number(p.prima || 0),
      Number(p.sumaAsegurada || 0),
      p.fechaEmision || "",
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Polizas");
    XLSX.writeFile(wb, `reporte_polizas_${fechaInicio}_${fechaFin}.xlsx`);
  };

  return (
    <div>
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>Reportes</div>
          <div style={S.pageSub}>Pólizas emitidas — {polizasFiltradas.length} registros</div>
        </div>
        <button style={S.btn("success")} onClick={exportXLSX}>
          <Icon name="download" size={16} />Exportar Excel
        </button>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: "18px 20px", marginBottom: 24, boxShadow: "0 1px 6px rgba(26,86,219,0.08)", display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={S.formGroup}>
          <label style={S.label}>Fecha Inicio</label>
          <input style={{ ...S.input, width: 150 }} type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>Fecha Fin</label>
          <input style={{ ...S.input, width: 150 }} type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>Aseguradora</label>
          <select style={{ ...S.select, width: 180 }} value={filtroAseg} onChange={(e) => setFiltroAseg(e.target.value)}>
            <option value="Todas">Todas</option>
            {aseguradoras.map((a) => <option key={a}>{a}</option>)}
          </select>
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>Ramo de Seguro</label>
          <select style={{ ...S.select, width: 180 }} value={filtroRamo} onChange={(e) => setFiltroRamo(e.target.value)}>
            <option value="Todos">Todos</option>
            {ramosLista.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>Cliente</label>
          <select style={{ ...S.select, width: 200 }} value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)}>
            <option value="Todos">Todos</option>
            {clientesLista.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 6px rgba(26,86,219,0.08)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: BLUE.text, marginBottom: 16 }}>Por Aseguradora</div>
          {porAseg.length === 0 ? (
            <div style={{ color: "#aaa", fontSize: 13 }}>Sin datos en este rango</div>
          ) : (
            porAseg.map((a) => (
              <div key={a.nombre} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                  <span style={{ fontWeight: 600 }}>{a.nombre}</span>
                  <span style={{ color: "#6b87b0" }}>{a.cantidad} pólizas · {fmt(a.prima)}</span>
                </div>
                <div style={{ background: BLUE.light, borderRadius: 6, height: 8, overflow: "hidden" }}>
                  <div style={{ background: BLUE.primary, height: "100%", width: `${(a.prima / maxPrima) * 100}%`, borderRadius: 6, transition: "width 0.4s" }} />
                </div>
              </div>
            ))
          )}
        </div>
        <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 6px rgba(26,86,219,0.08)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: BLUE.text, marginBottom: 16 }}>Por Ramo</div>
          {porRamo.length === 0 ? (
            <div style={{ color: "#aaa", fontSize: 13 }}>Sin datos en este rango</div>
          ) : (
            porRamo.map((r) => (
              <div key={r.nombre} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${BLUE.border}` }}>
                <span style={S.chip(BLUE.primary)}>{r.nombre}</span>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{r.cantidad} pólizas</div>
                  <div style={{ fontSize: 12, color: "#6b87b0" }}>{fmt(r.prima)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: "#6b87b0", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 12 }}>
        Detalle de Pólizas Emitidas — {polizasFiltradas.length} registros · Prima total: {fmt(totalPrima)} · Suma asegurada: {fmt(totalSuma)}
      </div>
      <div style={S.tableWrap}>
        <div style={{ ...S.tableHead, gridTemplateColumns: "40px 1.1fr 1.3fr 0.9fr 1fr 1fr 1fr 1fr" }}>
          <span>#</span><span>N° Póliza</span><span>Cliente</span><span>Ramo</span>
          <span>Aseguradora</span><span>Prima</span><span>Suma Aseg.</span><span>Fecha Emisión</span>
        </div>
        {polizasFiltradas.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#aaa" }}>
            No hay pólizas en este rango de fechas
          </div>
        ) : (
          polizasFiltradas.map((p, idx) => (
            <div
              key={p.id}
              style={{ ...S.tableRow, gridTemplateColumns: "40px 1.1fr 1.3fr 0.9fr 1fr 1fr 1fr 1fr" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = BLUE.light)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "")}
            >
              <div style={{ fontWeight: 700, color: "#aaa", fontSize: 13 }}>{idx + 1}</div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{p.numero || "—"}</div>
              <div style={{ fontSize: 13 }}>{p.clienteNombre || "—"}</div>
              <span style={S.chip(BLUE.primary)}>{p.ramo || "—"}</span>
              <div style={{ fontSize: 12.5 }}>{p.aseguradora}</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{fmt(p.prima || 0)}</div>
              <div style={{ fontSize: 13 }}>{fmt(p.sumaAsegurada || 0)}</div>
              <div style={{ fontSize: 13 }}>{fmtDate(p.fechaEmision)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ReportesPage;
