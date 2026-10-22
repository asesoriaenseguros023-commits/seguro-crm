// Cálculos de Gestión de Caja (Certificados Escolares) — funciones puras, sin
// React, para poder probarlas con datos reales fuera del navegador.
//
// Definiciones (las mismas del artefacto original, ahora explícitas):
//  - Valor vendido  = estudiantes asegurados ÚNICOS × tarifa del colegio (es el
//    ValorVendido de la hoja). Los duplicados se informan aparte y NO entran en caja.
//  - Valor certificados = suma de MontoCertificado de TODOS los certificados,
//    sin importar su estado de pago.
//  - Caja = Valor vendido − Valor certificados.
//  - Tarifa del colegio = ValorVendido de la hoja ÷ EstudiantesAsegurados.

const ESTADOS_NORMALES = ["PAGADO", "DEBE", "SIN ESTADO"];

const suma = (arr, f) => arr.reduce((s, x) => s + f(x), 0);

export function analizarCaja(resumen, certificados) {
  const certPorColegio = {};
  certificados.forEach((c) => { (certPorColegio[c.colegio] ||= []).push(c); });

  const porColegio = resumen.map((d) => {
    const cs = certPorColegio[d.colegio] || [];
    const vendido = d.valorVendido;
    const totalCert = suma(cs, (c) => c.montoCertificado);
    return {
      ...d,
      vendido,
      nCertificados: cs.length,
      totalCert,
      pagado: suma(cs.filter((c) => c.estadoPago === "PAGADO"), (c) => c.montoCertificado),
      debe: suma(cs.filter((c) => c.estadoPago === "DEBE"), (c) => c.montoCertificado),
      caja: vendido - totalCert,
      // Lo que debería dar la hoja: base − anulados − duplicados = únicos.
      esperadoUnicas: d.totalBaseFilas - d.anulados - d.duplicados,
    };
  });

  const totales = {
    unicas: suma(porColegio, (d) => d.estudiantesAsegurados),
    duplicados: suma(porColegio, (d) => d.duplicados),
    valorVendido: suma(porColegio, (d) => d.vendido),
    valorDuplicados: suma(porColegio, (d) => d.valorDuplicados),
    nCertificados: suma(porColegio, (d) => d.nCertificados),
    totalCert: suma(porColegio, (d) => d.totalCert),
    pagado: suma(porColegio, (d) => d.pagado),
    debe: suma(porColegio, (d) => d.debe),
  };
  totales.caja = totales.valorVendido - totales.totalCert;
  return { porColegio, totales };
}

// Estudiantes certificados de un certificado = monto ÷ tarifa del colegio. La
// columna CantidadEstudiantes de la hoja no es confiable (en Jardines trae
// números de 8 dígitos y en 5 colegios trae 0), por eso se calcula.
export function estudiantesDe(cert, tarifaColegio) {
  if (!tarifaColegio) return null;
  return Math.round(cert.montoCertificado / tarifaColegio);
}

// Mensajes para revisar: cada uno trae el colegio para poder filtrar al hacer clic.
export function calcularAlertas(porColegio, certificados, fmt) {
  const alertas = [];
  const nombres = new Set(porColegio.map((d) => d.colegio));

  porColegio.forEach((d) => {
    if (d.caja < 0) {
      alertas.push({ nivel: "error", colegio: d.colegio, texto: `${d.colegio}: los certificados (${fmt(d.totalCert)}) superan lo vendido (${fmt(d.vendido)}) por ${fmt(-d.caja)}.` });
    }
    if (d.esperadoUnicas !== d.estudiantesAsegurados) {
      const dif = d.estudiantesAsegurados - d.esperadoUnicas;
      alertas.push({ nivel: "aviso", colegio: d.colegio, texto: `${d.colegio}: base (${d.totalBaseFilas}) − anulados (${d.anulados}) − duplicados (${d.duplicados}) da ${d.esperadoUnicas}, pero la hoja reporta ${d.estudiantesAsegurados} asegurados únicos (${dif > 0 ? "+" : ""}${dif}).` });
    }
    if (d.debe > 0) {
      alertas.push({ nivel: "aviso", colegio: d.colegio, texto: `${d.colegio}: ${fmt(d.debe)} en certificados por pagar (DEBE).` });
    }
  });

  // Certificados sin estado, por colegio.
  const sinEstado = {};
  certificados.forEach((c) => {
    if (c.estadoPago === "SIN ESTADO") {
      const x = (sinEstado[c.colegio] ||= { n: 0, monto: 0 });
      x.n++; x.monto += c.montoCertificado;
    }
  });
  Object.entries(sinEstado).forEach(([colegio, x]) => {
    alertas.push({ nivel: "aviso", colegio, texto: `${colegio}: ${x.n} certificado${x.n === 1 ? "" : "s"} SIN ESTADO por ${fmt(x.monto)}. Falta marcarlos como PAGADO o DEBE.` });
  });

  // Mismo número de certificado repetido dentro de un colegio (posible doble conteo).
  const vistos = {};
  certificados.forEach((c) => {
    if (!c.certificado) return;
    const k = `${c.colegio}|${c.certificado}`;
    (vistos[k] ||= []).push(c);
  });
  const repetidosPorColegio = {};
  Object.values(vistos).forEach((v) => {
    if (v.length > 1) (repetidosPorColegio[v[0].colegio] ||= []).push(v[0].certificado);
  });
  Object.entries(repetidosPorColegio).forEach(([colegio, lista]) => {
    alertas.push({ nivel: "aviso", colegio, texto: `${colegio}: certificado${lista.length === 1 ? "" : "s"} repetido${lista.length === 1 ? "" : "s"} (${lista.slice(0, 4).join(", ")}${lista.length > 4 ? "…" : ""}). Verifica que no se esté contando doble.` });
  });

  // Estados distintos de PAGADO / DEBE / SIN ESTADO: son los que más confunden la caja.
  const otros = {};
  certificados.forEach((c) => {
    if (!ESTADOS_NORMALES.includes(c.estadoPago)) {
      const x = (otros[c.estadoPago] ||= { n: 0, monto: 0 });
      x.n++; x.monto += c.montoCertificado;
    }
  });
  Object.entries(otros).forEach(([estado, x]) => {
    alertas.push({ nivel: "info", colegio: null, texto: `${x.n} certificado${x.n === 1 ? "" : "s"} en estado ${estado} (${fmt(x.monto)}). Cuentan dentro del valor de certificados.` });
  });

  // Certificados de colegios que no están en ResumenVentas.
  const huerfanos = [...new Set(certificados.map((c) => c.colegio))].filter((c) => !nombres.has(c));
  huerfanos.forEach((colegio) => {
    alertas.push({ nivel: "error", colegio: null, texto: `Hay certificados de "${colegio}" pero ese colegio no está en ResumenVentas: no se están descontando de la caja.` });
  });

  const orden = { error: 0, aviso: 1, info: 2 };
  return alertas.sort((a, b) => orden[a.nivel] - orden[b.nivel]);
}
