import { useState, useMemo } from "react";
import { S, BLUE } from "../constants.js";
import { fmt, fmtDate, diasParaVencer, estadoColor, esAdmin } from "../helpers.js";
import Icon from "../components/Icon.jsx";

const PolizasPage = ({ polizas, interesados, ramos, aseguradoras, onDelete, userRol, agenteActualId, showConfirm }) => {
  const [q, setQ] = useState("");
  const [filtroRamo, setFiltroRamo] = useState("Todos");
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [filtroAnio, setFiltroAnio] = useState("Todos");
  const [filtroMes, setFiltroMes] = useState("Todos");

  const polizasPorRol = esAdmin(userRol)
    ? polizas
    : polizas.filter((p) => p.agenteId === agenteActualId);

  const anios = useMemo(() => {
    const s = new Set();
    polizasPorRol.forEach((p) => {
      const f = p.fechaEmision || p.vigenciaInicio;
      if (f) s.add(f.substring(0, 4));
    });
    return Array.from(s).sort().reverse();
  }, [polizasPorRol]);

  const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  const filtered = useMemo(
    () =>
      polizasPorRol.filter((p) => {
        const matchQ =
          !q ||
          p.numero?.toLowerCase().includes(q.toLowerCase()) ||
          p.clienteNombre?.toLowerCase().includes(q.toLowerCase()) ||
          p.aseguradora?.toLowerCase().includes(q.toLowerCase());
        const fe = p.fechaEmision || p.vigenciaInicio || "";
        const matchAnio = filtroAnio === "Todos" || fe.startsWith(filtroAnio);
        const matchMes =
          filtroMes === "Todos" ||
          fe.substring(5, 7) === String(meses.indexOf(filtroMes) + 1).padStart(2, "0");
        return (
          matchQ &&
          (filtroRamo === "Todos" || p.ramo === filtroRamo) &&
          (filtroEstado === "Todos" || p.estado === filtroEstado) &&
          matchAnio &&
          matchMes
        );
      }),
    [polizasPorRol, q, filtroRamo, filtroEstado, filtroAnio, filtroMes]
  );

  return (
    <div>
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>Pólizas</div>
          <div style={S.pageSub}>
            {filtered.length} de {polizasPorRol.length} pólizas ·{" "}
            {polizasPorRol.filter((p) => p.estado === "Activa").length} activas
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={S.searchBar}>
          <Icon name="search" size={16} />
          <input
            style={S.searchInput}
            placeholder="Buscar póliza, cliente, aseguradora…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select style={{ ...S.select, width: "auto", padding: "7px 12px" }} value={filtroAnio} onChange={(e) => setFiltroAnio(e.target.value)}>
          <option value="Todos">Todos los años</option>
          {anios.map((a) => <option key={a}>{a}</option>)}
        </select>
        <select style={{ ...S.select, width: "auto", padding: "7px 12px" }} value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)}>
          <option value="Todos">Todos los meses</option>
          {meses.map((m) => <option key={m}>{m}</option>)}
        </select>
        <select style={{ ...S.select, width: "auto", padding: "7px 12px" }} value={filtroRamo} onChange={(e) => setFiltroRamo(e.target.value)}>
          <option value="Todos">Todos los ramos</option>
          {ramos.map((r) => <option key={r.id} value={r.nombre}>{r.nombre}</option>)}
        </select>
        <select style={{ ...S.select, width: "auto", padding: "7px 12px" }} value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          {["Todos","Activa","Vencida","Cancelada"].map((e) => <option key={e}>{e}</option>)}
        </select>
      </div>

      <div style={S.tableWrap}>
        <div style={{ ...S.tableHead, gridTemplateColumns: "1.4fr 1.4fr 0.8fr 1fr 1fr 1fr 1fr 0.8fr 50px" }}>
          <span>N° Póliza</span><span>Cliente</span><span>Ramo</span><span>Aseguradora</span>
          <span>Prima</span><span>Emitida</span><span>Vence</span><span>Estado</span><span></span>
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#aaa" }}>
            No se encontraron pólizas
          </div>
        ) : (
          filtered.map((p) => {
            const dias = diasParaVencer(p.vigenciaFin);
            return (
              <div
                key={p.id}
                style={{ ...S.tableRow, gridTemplateColumns: "1.4fr 1.4fr 0.8fr 1fr 1fr 1fr 1fr 0.8fr 50px" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = BLUE.light)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "")}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>{p.numero || "—"}</div>
                <div style={{ fontSize: 13 }}>{p.clienteNombre || "—"}</div>
                <span style={S.chip(BLUE.primary)}>{p.ramo || "—"}</span>
                <div style={{ fontSize: 12.5, color: "#555" }}>{p.aseguradora}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{fmt(p.prima || 0)}</div>
                <div style={{ fontSize: 12.5 }}>{fmtDate(p.fechaEmision)}</div>
                <div>
                  <div style={{ fontSize: 12.5 }}>{fmtDate(p.vigenciaFin)}</div>
                  {p.estado === "Activa" && dias <= 30 && dias >= 0 && (
                    <div style={{ fontSize: 11, color: dias <= 7 ? "#dc2626" : "#d97706", fontWeight: 600 }}>
                      {dias}d
                    </div>
                  )}
                </div>
                <span style={S.badge(estadoColor(p.estado))}>{p.estado}</span>
                <button
                  style={{ ...S.btn("ghost"), color: "#dc2626" }}
                  title="Eliminar póliza"
                  onClick={async () => {
                    const ok = await showConfirm(
                      `¿Eliminar póliza ${p.numero || ""}?`,
                      "Esta acción no se puede deshacer."
                    );
                    if (!ok) return;
                    await onDelete(p.id);
                  }}
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default PolizasPage;
