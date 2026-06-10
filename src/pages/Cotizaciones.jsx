import { useState, useMemo } from "react";
import { S, BLUE, ESTADOS_COT, ACCIONES_COT } from "../constants.js";
import { fmtDate, esAdmin, accionColor, estadoCotColor2 } from "../helpers.js";
import Icon from "../components/Icon.jsx";
import { PolizaEmitidaModal } from "./Leads.jsx";

const CotizacionesPage = ({
  cotizaciones, interesados, polizas, agentes, ramos, aseguradoras,
  onAddCotizacion, onEditCotizacion, onDeleteCotizacion, onEmitirPoliza,
  userRol, agenteActualId, showConfirm,
}) => {
  const [q, setQ] = useState("");
  const [editModal, setEditModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const cotizacionesFiltradas = useMemo(() => {
    const base = esAdmin(userRol)
      ? cotizaciones
      : cotizaciones.filter((c) => c.agenteId === agenteActualId);
    return base.filter(
      (c) =>
        !q ||
        c.clienteNombre?.toLowerCase().includes(q.toLowerCase()) ||
        c.ramo?.toLowerCase().includes(q.toLowerCase()) ||
        c.numeroPolizaEmitida?.toLowerCase().includes(q.toLowerCase())
    );
  }, [cotizaciones, q, userRol, agenteActualId]);

  const handleSave = async (cot, changes) => {
    setSaving(cot.id);
    await onEditCotizacion({ ...cot, ...changes });
    setSaving(false);
  };

  return (
    <div>
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>Cotizaciones</div>
          <div style={S.pageSub}>{cotizacionesFiltradas.length} cotizaciones registradas</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div style={S.searchBar}>
          <Icon name="search" size={16} />
          <input
            style={S.searchInput}
            placeholder="Buscar cliente, ramo, n° póliza…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div style={S.tableWrap}>
        <div style={{ ...S.tableHead, gridTemplateColumns: "50px 1.6fr 1fr 1fr 1fr 160px" }}>
          <span>#</span><span>Lead / Cliente</span><span>Ramo</span>
          <span>Estado</span><span>Acción</span><span>Acciones</span>
        </div>
        {cotizacionesFiltradas.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#aaa" }}>
            No hay cotizaciones registradas
          </div>
        ) : (
          cotizacionesFiltradas.map((c, idx) => {
            const interesado = interesados.find(
              (i) => i.id === c.interesadoId || i.id === c.leadId
            );
            return (
              <div key={c.id}>
                <div
                  style={{ ...S.tableRow, gridTemplateColumns: "50px 1.6fr 1fr 1fr 1fr 160px" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = BLUE.light)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  <div style={{ fontWeight: 700, color: "#aaa", fontSize: 13 }}>{idx + 1}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      {c.clienteNombre || interesado?.nombre || "—"}
                    </div>
                    {c.clienteTelefono && (
                      <div style={{ fontSize: 11.5, color: "#888" }}>{c.clienteTelefono}</div>
                    )}
                    <div style={{ fontSize: 11, color: "#aaa" }}>{fmtDate(c.fechaCotizacion)}</div>
                  </div>
                  <span style={S.chip(BLUE.primary)}>{c.ramo || "—"}</span>
                  <select
                    value={c.estado || "Pendiente"}
                    onChange={async (e) => { await handleSave(c, { estado: e.target.value }); }}
                    style={{
                      fontSize: 12, padding: "5px 8px", borderRadius: 8,
                      border: `1.5px solid ${estadoCotColor2(c.estado)}`,
                      background: "#fff", color: estadoCotColor2(c.estado),
                      fontWeight: 600, cursor: "pointer", maxWidth: 170,
                    }}
                  >
                    <option value="Pendiente">Pendiente</option>
                    {ESTADOS_COT.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                  <select
                    value={c.accion || "En Curso"}
                    onChange={async (e) => { await handleSave(c, { accion: e.target.value }); }}
                    style={{
                      fontSize: 12, padding: "5px 8px", borderRadius: 8,
                      border: `1.5px solid ${accionColor(c.accion)}`,
                      background: "#fff", color: accionColor(c.accion),
                      fontWeight: 600, cursor: "pointer", maxWidth: 160,
                    }}
                  >
                    {ACCIONES_COT.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <div style={{ display: "flex", gap: 4 }}>
                    {c.accion === "Póliza Emitida" && (
                      <button
                        style={{ ...S.btn("success"), padding: "5px 10px", fontSize: 12 }}
                        onClick={() => setEditModal(c)}
                      >
                        {c.numeroPolizaEmitida ? "Ver Póliza" : "Registrar Póliza"}
                      </button>
                    )}
                    <button
                      style={{ ...S.btn("ghost"), color: "#dc2626" }}
                      title="Eliminar"
                      onClick={async () => {
                        const ok = await showConfirm(
                          `¿Eliminar esta cotización de ${c.clienteNombre || "este cliente"}?`,
                          "Esta acción no se puede deshacer."
                        );
                        if (!ok) return;
                        await onDeleteCotizacion(c.id);
                      }}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </div>

                {c.accion === "Póliza Emitida" && c.numeroPolizaEmitida && (
                  <div style={{
                    background: "#f0fdf4", borderLeft: "3px solid #16a34a",
                    padding: "10px 18px 10px 24px",
                    display: "grid", gridTemplateColumns: "repeat(6, 1fr)",
                    gap: 8, fontSize: 12,
                  }}>
                    <div><span style={{ color: "#aaa", display: "block" }}>N° Póliza</span><strong>{c.numeroPolizaEmitida}</strong></div>
                    <div><span style={{ color: "#aaa", display: "block" }}>Aseguradora</span>{c.aseguradoraEmitida}</div>
                    <div><span style={{ color: "#aaa", display: "block" }}>Prima</span>{c.primaEmitida || 0}</div>
                    <div><span style={{ color: "#aaa", display: "block" }}>IVA</span>{c.ivaEmitida || 0}</div>
                    <div><span style={{ color: "#aaa", display: "block" }}>Gastos</span>{c.gastosEmitida || 0}</div>
                    <div><span style={{ color: "#aaa", display: "block" }}>Total Pago</span><strong style={{ color: "#16a34a" }}>{c.totalPagoEmitida || 0}</strong></div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {editModal && (
        <PolizaEmitidaModal
          cot={editModal}
          aseguradoras={aseguradoras}
          onSave={async (data) => {
            await handleSave(editModal, data);
            setEditModal(null);
          }}
          onClose={() => setEditModal(null)}
        />
      )}
    </div>
  );
};

export default CotizacionesPage;
