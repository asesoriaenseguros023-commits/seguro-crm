// Comparación entre los certificados del archivo de cada colegio y las pólizas
// de Accidentes Escolares registradas en Seguros 2026 ("Base 2026"). Funciones
// puras, sin React, para poder probarlas con datos reales fuera del navegador.
//
// Cómo se cruza (lo que se acordó con el usuario: "número y valor"):
//  - Certificados Mundial (número de 8+ dígitos): el número del certificado es
//    la póliza en Base 2026; se compara el valor (monto vs prima).
//  - Certificados de Estado (ANEXO 0, 1…): en Base 2026 la póliza es otra
//    (21-68-…), así que se cruzan por valor, usando cada prima una sola vez.

const quitarTildes = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();

export function claveCertificado(raw) {
  const s = String(raw ?? "").trim();
  if (/^\d{8,}$/.test(s)) return { tipo: "numero", clave: s };
  const m = s.match(/ANEXO\s*(\d+)/i);
  if (m) return { tipo: "anexo", clave: `ANEXO ${parseInt(m[1], 10)}` };
  return { tipo: "otro", clave: quitarTildes(s) };
}

// ¿El tomador de una póliza parece ser este colegio? "SAN JUAN BOSCO" figura en
// Base 2026 como "...DEPARTAMENTAL SAN JUAN", por eso también se prueba sin la última palabra.
export function tomadorEsDelColegio(tomador, colegio) {
  const t = quitarTildes(tomador), c = quitarTildes(colegio);
  if (!t || !c) return false;
  if (t.includes(c)) return true;
  const palabras = c.split(" ");
  return palabras.length >= 3 && t.includes(palabras.slice(0, -1).join(" "));
}

export const RESULTADO = {
  coincide: "COINCIDE",
  coincidePorValor: "COINCIDE POR VALOR",
  distinto: "VALOR DISTINTO",
  noEsta: "NO ESTÁ EN BASE 2026",
  sinValor: "SIN VALOR",
  soloBase: "SOLO EN BASE 2026",
};

export function compararCertificados(certificados, base2026) {
  const filasBase = base2026.map((b, i) => ({ ...b, i, usada: false, clave: claveCertificado(b.poliza) }));

  const porNumero = new Map();
  filasBase.forEach((b) => {
    if (b.clave.tipo !== "numero") return;
    if (!porNumero.has(b.clave.clave)) porNumero.set(b.clave.clave, []);
    porNumero.get(b.clave.clave).push(b);
  });

  // Primero los de número (cruce exacto) y después los ANEXO (cruce por valor),
  // para que un cruce por valor nunca le quite una póliza a uno exacto.
  const resultado = certificados.map((c) => ({ cert: c, clave: claveCertificado(c.certificado), filaBase: null, resultado: null }));

  resultado.filter((r) => r.clave.tipo === "numero").forEach((r) => {
    const rows = porNumero.get(r.clave.clave);
    // Cada fila de Base 2026 se usa una sola vez: si el mismo número está dos
    // veces en el colegio, la segunda busca otra fila y si no hay queda como "no está".
    const libre = rows ? rows.find((b) => !b.usada) : null;
    if (!libre) { r.resultado = RESULTADO.noEsta; return; }
    libre.usada = true;
    r.filaBase = libre;
    r.resultado = libre.prima === Math.round(r.cert.montoCertificado) ? RESULTADO.coincide : RESULTADO.distinto;
  });

  resultado.filter((r) => r.clave.tipo !== "numero").forEach((r) => {
    const monto = Math.round(r.cert.montoCertificado);
    if (!monto) { r.resultado = RESULTADO.sinValor; return; }
    const libre = filasBase.find((b) => !b.usada && b.clave.tipo !== "numero" && b.prima === monto);
    if (!libre) { r.resultado = RESULTADO.noEsta; return; }
    libre.usada = true;
    r.filaBase = libre;
    r.resultado = RESULTADO.coincidePorValor;
  });

  return { resultado, filasBase };
}

// Resultado por colegio: filas comparadas + pólizas que solo están en Base 2026.
export function compararPorColegio(colegios, certificados, base2026) {
  const { resultado, filasBase } = compararCertificados(certificados, base2026);
  const porColegio = {};
  colegios.forEach((c) => { porColegio[c] = { filas: [], soloBase: [] }; });
  resultado.forEach((r) => { (porColegio[r.cert.colegio] ||= { filas: [], soloBase: [] }).filas.push(r); });

  const sinColegio = [];
  filasBase.filter((b) => !b.usada && b.clave.tipo === "numero").forEach((b) => {
    const dueno = colegios.find((c) => tomadorEsDelColegio(b.tomador, c));
    if (dueno) porColegio[dueno].soloBase.push(b); else sinColegio.push(b);
  });

  Object.values(porColegio).forEach((x) => {
    x.diferencias = x.filas.filter((r) => ![RESULTADO.coincide, RESULTADO.coincidePorValor, RESULTADO.sinValor].includes(r.resultado)).length + x.soloBase.length;
  });
  return { porColegio, sinColegio };
}
