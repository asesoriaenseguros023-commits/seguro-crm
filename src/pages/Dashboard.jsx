import { S, BLUE } from "../constants.js";
import { fmt, fmtDate, diasParaVencer } from "../helpers.js";
import Icon from "../components/Icon.jsx";

const Dashboard = ({ interesados, cotizaciones, polizas, userName, onNav }) => {
  const activas = polizas.filter((p) => p.estado === "Activa");
  const primaTotal = activas.reduce((s, p) => s + Number(p.prima || 0), 0);
  const proxVencer = polizas.filter(
    (p) =>
      p.estado === "Activa" &&
      diasParaVencer(p.vigenciaFin) <= 30 &&
      diasParaVencer(p.vigenciaFin) >= 0
  );
  const urgentes = proxVencer.filter((p) => diasParaVencer(p.vigenciaFin) <= 7);
  const cotPendientes = cotizaciones.filter((c) => c.estado === "Pendiente");

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={S.pageTitle}>
          Bienvenido al entorno de Gestión de Pólizas de Asesoría en Seguros Tocancipá
        </div>
        <div style={S.pageSub}>Vista de información de negocio</div>
      </div>

      {urgentes.length > 0 && (
        <div style={S.alertBox("#dc2626")}>
          <Icon name="warning" size={18} />
          <div style={{ fontSize: 13.5, color: "#dc2626" }}>
            <strong>
              {urgentes.length} póliza{urgentes.length > 1 ? "s" : ""}
            </strong>{" "}
            vence{urgentes.length === 1 ? "" : "n"} en los próximos 7 días.{" "}
            <span
              style={{ cursor: "pointer", textDecoration: "underline" }}
              onClick={() => onNav("renovaciones")}
            >
              Ver renovaciones →
            </span>
          </div>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 14,
          marginBottom: 14,
        }}
      >
        <div style={S.statCard(BLUE.primary)}>
          <div style={S.statNum}>{interesados.length}</div>
          <div style={S.statLabel}>Leads</div>
        </div>
        <div style={S.statCard("#f59e0b")}>
          <div style={S.statNum}>{cotPendientes.length}</div>
          <div style={S.statLabel}>Cotizaciones Pendientes</div>
        </div>
        <div style={S.statCard("#16a34a")}>
          <div style={S.statNum}>{activas.length}</div>
          <div style={S.statLabel}>Pólizas Activas</div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          marginBottom: 24,
        }}
      >
        <div style={S.statCard("#dc2626")}>
          <div style={S.statNum}>{proxVencer.length}</div>
          <div style={S.statLabel}>Por Vencer (30d)</div>
        </div>
        <div style={S.statCard("#7c3aed")}>
          <div style={S.statNum}>{fmt(primaTotal)}</div>
          <div style={S.statLabel}>Prima Total Activa</div>
        </div>
      </div>

      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "#6b87b0",
          letterSpacing: 0.8,
          textTransform: "uppercase",
          marginBottom: 12,
        }}
      >
        Pólizas por Vencer
      </div>
      <div style={S.tableWrap}>
        {proxVencer.length === 0 ? (
          <div
            style={{ padding: 32, textAlign: "center", color: "#aaa", fontSize: 14 }}
          >
            No hay pólizas por vencer en los próximos 30 días
          </div>
        ) : (
          <>
            <div
              style={{
                ...S.tableHead,
                gridTemplateColumns: "1.5fr 1.2fr 1fr 1fr 80px",
              }}
            >
              <span>Póliza / Cliente</span>
              <span>Ramo</span>
              <span>Vence</span>
              <span>Prima</span>
              <span>Días</span>
            </div>
            {proxVencer
              .sort(
                (a, b) =>
                  diasParaVencer(a.vigenciaFin) - diasParaVencer(b.vigenciaFin)
              )
              .map((p) => {
                const dias = diasParaVencer(p.vigenciaFin);
                return (
                  <div
                    key={p.id}
                    style={{
                      ...S.tableRow,
                      gridTemplateColumns: "1.5fr 1.2fr 1fr 1fr 80px",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        {p.numero}
                      </div>
                      <div style={{ color: "#888", fontSize: 12 }}>
                        {p.clienteNombre}
                      </div>
                    </div>
                    <span style={S.chip(BLUE.primary)}>{p.ramo || p.tipo || "—"}</span>
                    <div style={{ fontSize: 13 }}>{fmtDate(p.vigenciaFin)}</div>
                    <div style={{ fontSize: 13 }}>{fmt(p.prima)}</div>
                    <span style={S.chip(dias <= 7 ? "#dc2626" : "#d97706")}>
                      {dias}d
                    </span>
                  </div>
                );
              })}
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
