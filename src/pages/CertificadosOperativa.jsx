import { useState, useMemo } from "react";
import { S, BLUE } from "../constants.js";
import { fmt } from "../helpers.js";
import Icon from "../components/Icon.jsx";
import { useCertificadosData } from "../useCertificadosData.js";
import { compararPorColegio, RESULTADO } from "../certificadosOperativa.js";

// Gestión Operativa de Certificados Escolares: una tabla por colegio; al hacer
// clic en un colegio aparece cada certificado de su archivo (con su estado de
// archivo), la comparación contra Seguros 2026 y los estudiantes que no tienen
// certificado.

const fmtNum = new Intl.NumberFormat("es-CO");
const COLOR_OK = "#16a34a";
const COLOR_WARN = "#dc2626";
const COLOR_AVISO = "#d97706";
const COLOR_MUTED = "#6b87b0";

const colorResultado = (r) =>
  r === RESULTADO.coincide || r === RESULTADO.coincidePorValor ? COLOR_OK
  : r === RESULTADO.sinValor ? COLOR_MUTED
  : r === RESULTADO.distinto ? COLOR_AVISO
  : COLOR_WARN;

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
      sinArchivar: certs.filter((c) => c.archivo === "NO").length,
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
  const compActivo = activo ? comparacion.porColegio[activo.colegio] : null;
  const sinCertActivo = activo ? sinCertificado.filter((e) => e.colegio === activo.colegio) : [];

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
        <div style={{ overflowX: "auto" }}>
          <div style={{ ...S.tableHead, gridTemplateColumns: "1.6fr 0.8fr 0.8fr 0.8fr 0.8fr 0.9fr 0.9fr", minWidth: 820 }}>
            <span>Colegio</span><span style={{ textAlign: "right" }}>Certificados</span><span style={{ textAlign: "right" }}>Archivados</span><span style={{ textAlign: "right" }}>Sin archivar</span><span style={{ textAlign: "right" }}>Estudiantes</span><span style={{ textAlign: "right" }}>Sin certificado</span><span style={{ textAlign: "right" }}>Diferencias</span>
          </div>
          {filas.map((f) => (
            <div key={f.colegio} onClick={() => setColegioActivo(colegioActivo === f.colegio ? null : f.colegio)}
              style={{ ...S.tableRow, gridTemplateColumns: "1.6fr 0.8fr 0.8fr 0.8fr 0.8fr 0.9fr 0.9fr", minWidth: 820, cursor: "pointer", background: colegioActivo === f.colegio ? BLUE.light : undefined }}>
              <div><div style={{ fontWeight: 600, color: BLUE.text }}>{f.colegio}</div><div style={{ fontSize: 11.5, color: "#9aa8c7" }}>{f.aseguradora}</div></div>
              <div style={{ textAlign: "right" }}>{fmtNum.format(f.nCert)}</div>
              <div style={{ textAlign: "right" }}>{hayColumnaArchivo ? fmtNum.format(f.archivados) : "—"}</div>
              <div style={{ textAlign: "right", color: f.sinArchivar ? COLOR_WARN : undefined, fontWeight: f.sinArchivar ? 700 : 400 }}>{hayColumnaArchivo ? (f.sinArchivar ? fmtNum.format(f.sinArchivar) : "—") : "—"}</div>
              <div style={{ textAlign: "right" }}>{fmtNum.format(f.estudiantes)}</div>
              <div style={{ textAlign: "right", color: f.sinCertificado ? COLOR_WARN : "#9aa8c7", fontWeight: f.sinCertificado ? 700 : 400 }}>{f.sinCertificado ? fmtNum.format(f.sinCertificado) : "—"}</div>
              <div style={{ textAlign: "right" }}>{f.diferencias ? <span style={S.badge(COLOR_AVISO)}>{f.diferencias}</span> : <span style={{ color: COLOR_OK }}>✓</span>}</div>
            </div>
          ))}
        </div>
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
        <>
          <Tarjeta titulo={`Certificados · ${activo.colegio}`} desc="Cada certificado del archivo del colegio y si ya está archivado.">
            <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
              <div style={{ ...S.tableHead, gridTemplateColumns: "1.2fr 0.9fr 0.9fr 1.4fr 0.8fr", position: "sticky", top: 0, minWidth: 640 }}>
                <span>Certificado</span><span style={{ textAlign: "right" }}>Monto</span><span>Pago</span><span>Observaciones</span><span>Archivado</span>
              </div>
              {certsActivo.map((c, i) => (
                <div key={i} style={{ ...S.tableRow, gridTemplateColumns: "1.2fr 0.9fr 0.9fr 1.4fr 0.8fr", minWidth: 640, padding: "10px 18px" }}>
                  <div style={{ fontWeight: 600 }}>{c.certificado}</div>
                  <div style={{ textAlign: "right" }}>{fmt(c.montoCertificado)}</div>
                  <div style={{ fontSize: 12.5 }}>{c.estadoPago}</div>
                  <div style={{ fontSize: 12, color: "#6b87b0" }}>{c.observaciones}</div>
                  <div>{c.archivo === "SI" ? <span style={S.badge(COLOR_OK)}>SÍ</span> : c.archivo === "NO" ? <span style={S.badge(COLOR_WARN)}>NO</span> : <span style={{ color: "#9aa8c7" }}>—</span>}</div>
                </div>
              ))}
            </div>
          </Tarjeta>

          <Tarjeta titulo={`Archivo del colegio vs Seguros 2026 · ${activo.colegio}`} desc="A la izquierda lo que dice el archivo del colegio, a la derecha lo registrado en Base 2026. Mundial se cruza por número de certificado; Estado, por valor.">
            <div style={{ overflowX: "auto", maxHeight: 460, overflowY: "auto" }}>
              <div style={{ ...S.tableHead, gridTemplateColumns: "1fr 0.9fr 1.1fr 0.9fr 1fr", position: "sticky", top: 0, minWidth: 760 }}>
                <span>Certificado</span><span style={{ textAlign: "right" }}>Valor colegio</span><span>Póliza en Base 2026</span><span style={{ textAlign: "right" }}>Valor Base 2026</span><span>Resultado</span>
              </div>
              {compActivo.filas.map((r, i) => (
                <div key={i} style={{ ...S.tableRow, gridTemplateColumns: "1fr 0.9fr 1.1fr 0.9fr 1fr", minWidth: 760, padding: "10px 18px" }}>
                  <div style={{ fontWeight: 600 }}>{r.cert.certificado}</div>
                  <div style={{ textAlign: "right" }}>{fmt(r.cert.montoCertificado)}</div>
                  <div style={{ fontSize: 12.5 }}>{r.filaBase ? <>{r.filaBase.poliza}<div style={{ fontSize: 11, color: "#9aa8c7" }}>{r.filaBase.tomador}</div></> : "—"}</div>
                  <div style={{ textAlign: "right" }}>{r.filaBase ? fmt(r.filaBase.prima) : "—"}</div>
                  <div><span style={S.badge(colorResultado(r.resultado))}>{r.resultado}</span></div>
                </div>
              ))}
              {compActivo.soloBase.map((b, i) => (
                <div key={`b${i}`} style={{ ...S.tableRow, gridTemplateColumns: "1fr 0.9fr 1.1fr 0.9fr 1fr", minWidth: 760, padding: "10px 18px", background: "#fffbeb" }}>
                  <div style={{ color: "#9aa8c7" }}>—</div>
                  <div style={{ textAlign: "right", color: "#9aa8c7" }}>—</div>
                  <div style={{ fontSize: 12.5 }}>{b.poliza}<div style={{ fontSize: 11, color: "#9aa8c7" }}>{b.tomador}</div></div>
                  <div style={{ textAlign: "right" }}>{fmt(b.prima)}</div>
                  <div><span style={S.badge(COLOR_WARN)}>{RESULTADO.soloBase}</span></div>
                </div>
              ))}
            </div>
          </Tarjeta>

          <Tarjeta titulo={`Estudiantes sin certificado · ${activo.colegio}`} desc={sinCertActivo.length ? `${sinCertActivo.length} de ${fmtNum.format(activo.estudiantes)} estudiantes de la base todavía no tienen certificado asignado.` : "Todos los estudiantes de la base tienen certificado."}>
            {sinCertActivo.length > 0 && (
              <div style={{ overflowX: "auto", maxHeight: 360, overflowY: "auto" }}>
                <div style={{ ...S.tableHead, gridTemplateColumns: "1fr 2fr", position: "sticky", top: 0 }}><span>Documento</span><span>Nombre</span></div>
                {sinCertActivo.map((e, i) => (
                  <div key={i} style={{ ...S.tableRow, gridTemplateColumns: "1fr 2fr", padding: "9px 18px" }}><div>{e.documento}</div><div>{e.nombre || "—"}</div></div>
                ))}
              </div>
            )}
          </Tarjeta>
        </>
      )}

      <div style={{ textAlign: "center", color: "#9aa8c7", fontSize: 11.5, lineHeight: 1.6, marginTop: 8 }}>
        Fuentes: "Control Ejecutivo Colegios" (Certificados y Estudiantes) y "Seguros 2026" (Base 2026, solo Accidentes Escolares). Se actualiza sola cada 20 minutos.
      </div>
    </div>
  );
}
