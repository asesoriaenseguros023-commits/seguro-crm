import { useState, useMemo } from "react";
import { S, BLUE, ESTADOS_COT, ACCIONES_COT } from "../constants.js";
import { fmtDate, esAdmin, accionColor, estadoCotColor2 } from "../helpers.js";
import Icon from "../components/Icon.jsx";
import { supabase } from "../supabase.js";
import { PolizaEmitidaModal } from "./Leads.jsx";
import { ADMIN_EMAIL } from "./Login.jsx";

const CotizacionesPage = ({
  cotizaciones, interesados, aseguradoras,
  onEditCotizacion, onDeleteCotizacion,
  userRol, agenteActualId,
}) => {
  const [q, setQ] = useState("");
  const [busquedaModo, setBusquedaModo] = useState("cliente");
  const [editModal, setEditModal] = useState(null);
  // Borrar una cotización con póliza ligada (activa) exige contraseña —
  // porque implica borrar también esa póliza en cascada, no solo la cotización.
  const [delPasswordFor, setDelPasswordFor] = useState(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState("");

  const cotizacionesFiltradas = useMemo(() => {
    const base = esAdmin(userRol)
      ? cotizaciones
      : cotizaciones.filter((c) => c.agenteId === agenteActualId);
    return base.filter((c) => {
      if (!q) return true;
      if (busquedaModo === "poliza") return (c.numeroPolizaEmitida || "").toLowerCase().includes(q.toLowerCase());
      return c.clienteNombre?.toLowerCase().includes(q.toLowerCase());
    });
  }, [cotizaciones, q, busquedaModo, userRol, agenteActualId]);

  const handleSave = async (cot, changes) => {
    await onEditCotizacion({ ...cot, ...changes });
  };

  const confirmarBorrado = async () => {
    if (!passwordInput) return;
    setDeleting(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: ADMIN_EMAIL, password: passwordInput });
    if (authError) {
      setPasswordError("Contraseña incorrecta.");
      setDeleting(false);
      return;
    }
    const res = await onDeleteCotizacion(delPasswordFor.id);
    setDeleting(false);
    setDelPasswordFor(null);
    if (res?.error) setActionError(res.error);
  };

  return (
    <div>
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>Cotizaciones</div>
          <div style={S.pageSub}>{cotizacionesFiltradas.length} cotizaciones registradas</div>
        </div>
      </div>

      {actionError && (
        <div style={{ ...S.alertBox("#dc2626"), marginBottom: 16 }}>
          <span style={{ fontSize: 13.5, color: "#dc2626", fontWeight: 600 }}>{actionError}</span>
        </div>
      )}

      <div style={{ background: "#fff", border: `1px solid ${BLUE.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 0, marginBottom: 10, borderRadius: 8, overflow: "hidden", width: "fit-content", border: `1px solid ${BLUE.border}` }}>
          {[["cliente", "Cliente"], ["poliza", "N° Póliza"]].map(([modo, label]) => (
            <button key={modo} onClick={() => { setBusquedaModo(modo); setQ(""); }}
              style={{ padding: "6px 18px", fontSize: 13, fontWeight: busquedaModo === modo ? 700 : 400, background: busquedaModo === modo ? BLUE.primary : "#fff", color: busquedaModo === modo ? "#fff" : "#555", border: "none", cursor: "pointer", transition: "all 0.15s" }}>
              {label}
            </button>
          ))}
        </div>
        <div style={S.searchBar}>
          <Icon name="search" size={16} />
          <input
            style={S.searchInput}
            placeholder={busquedaModo === "poliza" ? "Número de póliza…" : "Nombre del cliente…"}
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
                      onClick={() => { setActionError(""); setPasswordInput(""); setPasswordError(""); setDelPasswordFor(c); }}
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

      {delPasswordFor && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(7,29,71,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 16 }}
          onClick={() => !deleting && setDelPasswordFor(null)}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 400, padding: "28px 32px", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: 17, color: BLUE.text, marginBottom: 8 }}>Eliminar cotización</div>
            <p style={{ fontSize: 13.5, color: "#555", marginBottom: 16 }}>
              ¿Eliminar la cotización de <strong>{delPasswordFor.clienteNombre || "este cliente"}</strong>? Esta acción no se puede deshacer.
              Escribe la contraseña para confirmar.
            </p>
            <input
              type="password" autoFocus style={S.input} value={passwordInput}
              onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(""); }}
              onKeyDown={(e) => e.key === "Enter" && confirmarBorrado()}
              placeholder="Contraseña"
            />
            {passwordError && (
              <div style={{ fontSize: 12.5, color: "#dc2626", marginTop: 8 }}>{passwordError}</div>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button style={S.btn("secondary")} onClick={() => setDelPasswordFor(null)} disabled={deleting}>Cancelar</button>
              <button style={{ ...S.btn("danger"), opacity: deleting ? 0.6 : 1 }} onClick={confirmarBorrado} disabled={deleting || !passwordInput}>
                {deleting ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CotizacionesPage;
