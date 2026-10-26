import { useState, useMemo } from "react";
import { S, BLUE } from "../constants.js";
import { fmt } from "../helpers.js";
import Icon from "../components/Icon.jsx";
import Tabla from "../components/Tabla.jsx";
import { useCertificadosData } from "../useCertificadosData.js";
import { compararPorColegio } from "../certificadosOperativa.js";

// Gestión Operativa de Certificados Escolares: una tabla por colegio (con los
// totales de archivados, sin archivar, estudiantes sin certificado y diferencias
// con Seguros 2026); al hacer clic en un colegio aparece SOLO el detalle de los
// certificados que todavía no están archivados.

const fmtNum = new Intl.NumberFormat("es-CO");
const COLOR_OK = "#16a34a";
const COLOR_WARN = "#dc2626";
const COLOR_AVISO = "#d97706";
const COLOR_MUTED = "#6b87b0";

const Tarjeta = ({ titulo, desc, children }) => (
  <div style={{ background: "#fff", borderRadius: 12, padding: "18px 20px 16px", border: `1px solid ${BLUE.border}`, boxShadow: "0 1px 6px rgba(26,86,219,0.06)", marginBottom: 16 }}>
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#9aa8c7", marginBottom: desc ? 4 : 12 }}>{titulo}</div>
    {desc && <div style={{ fontSize: 12.5, color: "#6b87b0", marginBottom: 12 }}>{desc}</div>}
    {children}
  </div>
);

export default function CertificadosOperativaPage({ onBack }) {
  const { data, loading, refreshing, error, lastUpdated, refresh, retry } = useCertificadosData();
  const [colegioActivo, setColegioActivo] = useState(null);
  const [verSinColegio, setVerSinColegio] = useState(false);

  const resumen = useMemo(() => data?.resumenVentas || [], [data]);
  const certificados = useMemo(() => data?.certificados || [], [data]);
  const base2026 = useMemo(() => data?.base2026 || [], [data]);
  const sinCertificado = useMemo(() => data?.estudiantesSinCertificado || [], [data]);
  const estudiantesPorColegio = useMemo(() => data?.estudiantesPorColegio || {}, [data]);

  const comparacion = useMemo(
    () => compararPorColegio(resumen.map((d) => d.colegio), certificados, base2026),
    [resumen, certificados, base2026]
  );
  const hayColumnaArchivo = useMemo(() => certificados.some((c) => c.archivo), [certificados]);

  const filas = useMemo(() => resumen.map((d) => {
    const certs = certificados.filter((c) => c.colegio === d.colegio);
    return {
      colegio: d.colegio,
      aseguradora: d.aseguradora,
      nCert: certs.length,
      archivados: certs.filter((c) => c.archivo === "SI").length,
      sinArchivar: certs.filter((c) => c.archivo !== "SI").length, // NO o vacío
      estudiantes: estudiantesPorColegio[d.colegio] || 0,
      sinCertificado: sinCertificado.filter((e) => e.colegio === d.colegio).length,
      diferencias: comparacion.porColegio[d.colegio]?.diferencias || 0,
    };
  }), [resumen, certificados, estudiantesPorColegio, sinCertificado, comparacion]);

  const totalDif = filas.reduce((s, f) => s + f.diferencias, 0);

  if (loading) {
    return (
      <div style={{ padding: "72px 24px", textAlign: "center", color: "#6b87b0" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🎓</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: BLUE.text, marginBottom: 6 }}>Cargando Gestión Operativa…</div>
        <div style={{ fontSize: 13 }}>Consultando los colegios y Seguros 2026 en Google Sheets.</div>
      </div>
    );
  }
  if (error && !data) {
    return (
      <div style={{ padding: "72px 24px", textAlign: "center", color: "#6b87b0" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: BLUE.text, marginBottom: 6 }}>No se pudo cargar</div>
        <div style={{ fontSize: 13, maxWidth: 420, margin: "0 auto 16px" }}>{error}</div>
        <button style={S.btn("secondary")} onClick={retry}>Reintentar</button>
      </div>
    );
  }

  const activo = colegioActivo ? filas.find((f) => f.colegio === colegioActivo) : null;
  const certsActivo = activo ? certificados.filter((c) => c.colegio === activo.colegio) : [];
  const sinArchivarActivo = certsActivo.filter((c) => c.archivo !== "SI"); // NO o vacío

  return (
    <div>
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>Gestión Operativa</div>
          <div style={S.pageSub}>Certificados por colegio, archivo y diferencias con Seguros 2026</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {onBack && <button style={S.btn("secondary")} onClick={onBack}>← Certificados Escolares</button>}
          {lastUpdated && <span style={{ fontSize: 12, color: "#9aa8c7" }}>Actualizado {lastUpdated.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</span>}
          <button style={S.btn("secondary")} disabled={refreshing} onClick={refresh}>
            <Icon name="download" size={14} />{refreshing ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
      </div>

      {data?.errors?.base2026 && <div style={S.alertBox("#dc2626")}><Icon name="warning" size={16} /><span style={{ fontSize: 12.5 }}><b>Seguros 2026</b> no se pudo cargar ({data.errors.base2026}). Las diferencias no son confiables.</span></div>}
      {data?.errors?.estudiantes && <div style={S.alertBox("#dc2626")}><Icon name="warning" size={16} /><span style={{ fontSize: 12.5 }}><b>Estudiantes</b> no se pudo cargar ({data.errors.estudiantes}).</span></div>}
      {!hayColumnaArchivo && <div style={S.alertBox("#d97706")}><Icon name="warning" size={16} /><span style={{ fontSize: 12.5 }}>La hoja maestra todavía no trae la columna <b>Archivo</b>: actualiza el script consolidarDatos() y córrelo una vez para ver si cada certificado está archivado.</span></div>}

      <Tarjeta titulo="Colegios" desc={`${totalDif ? `${totalDif} diferencias con Seguros 2026 en total. ` : "Sin diferencias con Seguros 2026. "}Haz clic en un colegio para ver sus certificados.`}>
        <Tabla
          minWidth={820}
          cols={[{ h: "Colegio" }, { h: "Certificados", right: true }, { h: "Archivados", right: true }, { h: "Sin archivar", right: true }, { h: "Estudiantes", right: true }, { h: "Sin certificado", right: true }, { h: "Diferencias", right: true }]}
          filas={filas.map((f) => ({
            key: f.colegio,
            onClick: () => setColegioActivo(colegioActivo === f.colegio ? null : f.colegio),
            bg: colegioActivo === f.colegio ? BLUE.light : undefined,
            cells: [
              <><div style={{ fontWeight: 600, color: BLUE.text }}>{f.colegio}</div><div style={{ fontSize: 11.5, color: "#9aa8c7" }}>{f.aseguradora}</div></>,
              fmtNum.format(f.nCert),
              hayColumnaArchivo ? fmtNum.format(f.archivados) : "—",
              <span style={{ color: f.sinArchivar ? COLOR_WARN : undefined, fontWeight: f.sinArchivar ? 700 : 400 }}>{hayColumnaArchivo ? (f.sinArchivar ? fmtNum.format(f.sinArchivar) : "—") : "—"}</span>,
              fmtNum.format(f.estudiantes),
              <span style={{ color: f.sinCertificado ? COLOR_WARN : "#9aa8c7", fontWeight: f.sinCertificado ? 700 : 400 }}>{f.sinCertificado ? fmtNum.format(f.sinCertificado) : "—"}</span>,
              f.diferencias ? <span style={S.badge(COLOR_AVISO)}>{f.diferencias}</span> : <span style={{ color: COLOR_OK }}>✓</span>,
            ],
          }))}
          total={[
            "Total",
            fmtNum.format(filas.reduce((x, f) => x + f.nCert, 0)),
            hayColumnaArchivo ? fmtNum.format(filas.reduce((x, f) => x + f.archivados, 0)) : "—",
            hayColumnaArchivo ? fmtNum.format(filas.reduce((x, f) => x + f.sinArchivar, 0)) : "—",
            fmtNum.format(filas.reduce((x, f) => x + f.estudiantes, 0)),
            fmtNum.format(filas.reduce((x, f) => x + f.sinCertificado, 0)),
            totalDif ? fmtNum.format(totalDif) : "✓",
          ]}
        />
        {comparacion.sinColegio.length > 0 && (
          <div style={{ marginTop: 12, fontSize: 12.5, color: COLOR_MUTED }}>
            {comparacion.sinColegio.length} póliza{comparacion.sinColegio.length === 1 ? "" : "s"} de Accidentes Escolares en Seguros 2026 no se pudo{comparacion.sinColegio.length === 1 ? "" : "ron"} asignar a ningún colegio.{" "}
            <button onClick={() => setVerSinColegio((v) => !v)} style={{ all: "unset", cursor: "pointer", color: BLUE.primary, fontWeight: 600 }}>{verSinColegio ? "Ocultar" : "Ver cuáles"}</button>
            {verSinColegio && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                {comparacion.sinColegio.map((b, i) => <div key={i} style={{ color: BLUE.text }}>{b.poliza} · {b.tomador} · {fmt(b.prima)}</div>)}
              </div>
            )}
          </div>
        )}
      </Tarjeta>

      {activo && (
        <Tarjeta
          titulo={`Certificados sin archivar · ${activo.colegio}`}
          desc={!hayColumnaArchivo ? "Todavía no llega la columna Archivo de la hoja maestra."
            : sinArchivarActivo.length ? `${sinArchivarActivo.length} de ${certsActivo.length} certificados todavía no están archivados.`
            : "✓ Todos los certificados de este colegio están archivados."}
        >
          {hayColumnaArchivo && sinArchivarActivo.length > 0 && (
            <Tabla
              minWidth={640} maxHeight={420}
              cols={[{ h: "Certificado" }, { h: "Monto", right: true }, { h: "Pago" }, { h: "Observaciones" }, { h: "Archivado" }]}
              filas={sinArchivarActivo.map((c, i) => ({
                key: i,
                cells: [
                  <b>{c.certificado}</b>,
                  fmt(c.montoCertificado),
                  <span style={{ fontSize: 12.5 }}>{c.estadoPago}</span>,
                  <span style={{ fontSize: 12, color: "#6b87b0" }}>{c.observaciones}</span>,
                  <span style={S.badge(COLOR_WARN)}>NO</span>,
                ],
              }))}
            />
          )}
        </Tarjeta>
      )}

      <div style={{ textAlign: "center", color: "#9aa8c7", fontSize: 11.5, lineHeight: 1.6, marginTop: 8 }}>
        Fuentes: "Control Ejecutivo Colegios" (Certificados y Estudiantes) y "Seguros 2026" (Base 2026, solo Accidentes Escolares). Se actualiza sola cada 20 minutos.
      </div>
    </div>
  );
}
