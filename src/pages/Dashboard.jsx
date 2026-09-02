import { S, BLUE, ESTADOS_COT } from "../constants.js";
import { fmt, fmtDate, estadoCotColor2 } from "../helpers.js";

const toISODash = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const StatCard = ({ label, value, color, sub }) => (
  <div style={{ background: "#fff", borderRadius: 12, padding: "18px 20px", borderTop: `3px solid ${color || BLUE.primary}`, boxShadow: "0 1px 6px rgba(26,86,219,0.08)" }}>
    <div style={S.statNum}>{value}</div>
    <div style={S.statLabel}>{label}</div>
    {sub && <div style={{ fontSize: 11, color: "#9aa8c7", marginTop: 5 }}>{sub}</div>}
  </div>
);

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

// Dashboard = gestión del mes en curso (leads, cotizaciones, ventas). Nada
// de vencimientos/renovaciones aquí a propósito — eso vive en Renovaciones,
// mostrarlo también aquí era duplicar la misma información dos veces.
const Dashboard = ({ interesados, cotizaciones, polizas }) => {
  const hoy = new Date();
  const inicioMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;
  const inicioMesAnterior = toISODash(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1));
  const finMesAnterior = toISODash(new Date(hoy.getFullYear(), hoy.getMonth(), 0));

  const enEsteMes = (fecha) => !!fecha && fecha >= inicioMes;
  const enMesAnterior = (fecha) => !!fecha && fecha >= inicioMesAnterior && fecha <= finMesAnterior;

  // Un lead ya enviado a cotización cambió de fase — no cuenta acá, mismo
  // criterio que el resto del funnel (evitar contar lo mismo dos veces).
  const leadsActivos = interesados.filter((i) => !i.envioOficina);
  const leadsMes = leadsActivos.filter((i) => enEsteMes(i.fechaRegistro)).length;
  const leadsMesAnt = leadsActivos.filter((i) => enMesAnterior(i.fechaRegistro)).length;

  // Una cotización con póliza ya registrada cambió de fase (ahora es una
  // venta, cuenta en "Pólizas emitidas") — no debe sumar acá también, sería
  // contarla dos veces.
  const cotizacionesActivas = cotizaciones.filter((c) => !(c.accion === "Póliza Emitida" && c.numeroPolizaEmitida));
  const cotizacionesMesArr = cotizacionesActivas.filter((c) => enEsteMes(c.fechaCotizacion));
  const cotizacionesMes = cotizacionesMesArr.length;
  const cotizacionesMesAnt = cotizacionesActivas.filter((c) => enMesAnterior(c.fechaCotizacion)).length;
  const porEstado = ["Pendiente", ...ESTADOS_COT].map((estado) => ({
    estado,
    cantidad: cotizacionesMesArr.filter((c) => (c.estado || "Pendiente") === estado).length,
  }));

  const polizasMes = polizas.filter((p) => enEsteMes(p.fechaEmision)).sort((a, b) => (b.fechaEmision || "").localeCompare(a.fechaEmision || ""));
  const polizasMesAnt = polizas.filter((p) => enMesAnterior(p.fechaEmision));
  const primaMes = polizasMes.reduce((s, p) => s + Number(p.prima || 0), 0);
  const primaMesAnt = polizasMesAnt.reduce((s, p) => s + Number(p.prima || 0), 0);
  const variacionPrima = primaMesAnt > 0 ? Math.round(((primaMes - primaMesAnt) / primaMesAnt) * 100) : null;

  const subComparativo = (actual, anterior) =>
    anterior === 0 ? "sin dato del mes anterior" : `${actual >= anterior ? "↑" : "↓"} vs. ${anterior} el mes pasado`;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={S.pageTitle}>Gestión de {MESES[hoy.getMonth()]}</div>
        <div style={S.pageSub}>Leads, cotizaciones y ventas del mes en curso</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 28 }}>
        <StatCard label="Leads nuevos" value={leadsMes} color={BLUE.primary} sub={subComparativo(leadsMes, leadsMesAnt)} />
        <StatCard label="Cotizaciones registradas" value={cotizacionesMes} color="#f59e0b" sub={subComparativo(cotizacionesMes, cotizacionesMesAnt)} />
        <StatCard label="Pólizas emitidas" value={polizasMes.length} color="#16a34a" sub={subComparativo(polizasMes.length, polizasMesAnt.length)} />
        <StatCard
          label="Prima vendida"
          value={fmt(primaMes)}
          color={variacionPrima === null ? "#7c3aed" : variacionPrima >= 0 ? "#16a34a" : "#dc2626"}
          sub={variacionPrima === null ? "sin dato del mes anterior" : `${variacionPrima >= 0 ? "↑" : "↓"} ${Math.abs(variacionPrima)}% vs. mes anterior`}
        />
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: "#6b87b0", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 12 }}>
        Cotizaciones del mes por estado
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 28 }}>
        {cotizacionesMes === 0 ? (
          <div style={{ fontSize: 13, color: "#aaa" }}>Sin cotizaciones registradas este mes todavía.</div>
        ) : (
          porEstado.map(({ estado, cantidad }) => (
            <div key={estado} style={{
              display: "flex", alignItems: "center", gap: 8, background: "#fff",
              border: `1px solid ${BLUE.border}`, borderRadius: 10, padding: "10px 16px",
            }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: estadoCotColor2(estado) }}>{cantidad}</span>
              <span style={{ fontSize: 12.5, color: "#555" }}>{estado}</span>
            </div>
          ))
        )}
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: "#6b87b0", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 12 }}>
        Pólizas emitidas este mes
      </div>
      <div style={S.tableWrap}>
        {polizasMes.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "#aaa", fontSize: 14 }}>
            Todavía no se ha emitido ninguna póliza este mes
          </div>
        ) : (
          <>
            <div style={{ ...S.tableHead, gridTemplateColumns: "1.5fr 1.2fr 1.2fr 1fr 1fr" }}>
              <span>Cliente</span><span>Ramo</span><span>Aseguradora</span><span>Prima</span><span>Emitida</span>
            </div>
            {polizasMes.map((p) => (
              <div key={p.id} style={{ ...S.tableRow, gridTemplateColumns: "1.5fr 1.2fr 1.2fr 1fr 1fr" }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{p.clienteNombre || "—"}</div>
                <span style={S.chip(BLUE.primary)}>{p.ramo || "—"}</span>
                <div style={{ fontSize: 12.5, color: "#555" }}>{p.aseguradora || "—"}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{fmt(p.prima || 0)}</div>
                <div style={{ fontSize: 12.5 }}>{fmtDate(p.fechaEmision)}</div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
