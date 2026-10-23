// Comparación entre los certificados del archivo de cada colegio y las pólizas
// de Accidentes Escolares registradas en Seguros 2026 ("Base 2026"). Funciones
// puras, sin React, para poder probarlas con datos reales fuera del navegador.
//
// Cómo se cruza (lo que se acordó con el usuario: "número y valor"):
//  - Certificados Mundial (número de 8+ dígitos): el número del certificado es
//    la póliza en Base 2026; se compara el valor (monto vs prima).
//  - Certificados de Estado (ANEXO 0, 1…): en Base 2026 la póliza es otra
//    (21-68-…), así que se cruzan por valor, usando cada prima una sola vez
//    (preferiendo pólizas del mismo colegio).
//  - En ambos sentidos: las pólizas de Base 2026 del colegio que ningún
//    certificado cubre salen como "SOLO EN BASE 2026".

const quitarTildes = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();

export function claveCertificado(raw) {
  const s = String(raw ?? "").trim();
  if (/^\d{8,}$/.test(s)) return { tipo: "numero", clave: s };
  const m = s.match(/ANEXO\s*(\d+)/i);
  if (m) return { tipo: "anexo", clave: `ANEXO ${parseInt(m[1], 10)}` };
  return { tipo: "otro", clave: quitarTildes(s) };
}

// Pólizas de Estado en Base 2026: "21-68-1000005890" es el ANEXO 0 y
// "21-68-1000005890-12" es el ANEXO 12 de la misma póliza madre.
function raizYSufijo(poliza) {
  const m = String(poliza ?? "").trim().match(/^(\d{2}-\d{2}-\d+)(?:-(\d+))?$/);
  return m ? { raiz: m[1], n: m[2] ? parseInt(m[2], 10) : 0 } : null;
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
  repetido: "CERTIFICADO REPETIDO",
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

  const vistos = new Set();
  resultado.filter((r) => r.clave.tipo === "numero").forEach((r) => {
    const rows = porNumero.get(r.clave.clave);
    const llave = `${r.cert.colegio}|${r.clave.clave}`;
    const yaVisto = vistos.has(llave);
    vistos.add(llave);
    // Cada fila de Base 2026 se usa una sola vez: si el mismo número está dos
    // veces en el colegio, la segunda busca otra fila; si no hay, es un repetido.
    const libre = rows ? rows.find((b) => !b.usada) : null;
    if (!libre) {
      // Monto 0 = certificado sin valor (corrección/anulación): no se espera en Base 2026.
      r.resultado = !Math.round(r.cert.montoCertificado) ? RESULTADO.sinValor : yaVisto ? RESULTADO.repetido : RESULTADO.noEsta;
      return;
    }
    libre.usada = true;
    r.filaBase = libre;
    r.resultado = libre.prima === Math.round(r.cert.montoCertificado) ? RESULTADO.coincide : RESULTADO.distinto;
  });

  // Anexos de Estado: la póliza madre del colegio es la que más anexos cruza por
  // número + valor; ahí ANEXO N = póliza "-N". Lo que no cruza por ahí se busca
  // por valor entre las pólizas que sobran.
  const raizPorColegio = {};
  const anexosPorColegio = {};
  resultado.filter((r) => r.clave.tipo === "anexo").forEach((r) => { (anexosPorColegio[r.cert.colegio] ||= []).push(r); });
  Object.entries(anexosPorColegio).forEach(([colegio, rs]) => {
    const votos = {};
    rs.forEach((r) => {
      const n = parseInt(r.clave.clave.replace(/\D/g, ""), 10);
      const monto = Math.round(r.cert.montoCertificado);
      filasBase.forEach((b) => {
        const rs2 = raizYSufijo(b.poliza);
        if (rs2 && rs2.n === n && b.prima === monto && monto) votos[rs2.raiz] = (votos[rs2.raiz] || 0) + 1;
      });
    });
    const mejor = Object.entries(votos).sort((a, b) => b[1] - a[1])[0];
    if (mejor) raizPorColegio[colegio] = mejor[0];
  });

  resultado.filter((r) => r.clave.tipo !== "numero").forEach((r) => {
    const monto = Math.round(r.cert.montoCertificado);
    const raiz = raizPorColegio[r.cert.colegio];
    if (r.clave.tipo === "anexo" && raiz) {
      const n = parseInt(r.clave.clave.replace(/\D/g, ""), 10);
      const fila = filasBase.find((b) => !b.usada && (() => { const x = raizYSufijo(b.poliza); return x && x.raiz === raiz && x.n === n; })());
      if (fila) {
        fila.usada = true;
        r.filaBase = fila;
        r.resultado = !monto && !fila.prima ? RESULTADO.sinValor : fila.prima === monto ? RESULTADO.coincide : RESULTADO.distinto;
        return;
      }
      r.resultado = !monto ? RESULTADO.sinValor : RESULTADO.noEsta;
      return;
    }
    if (!monto) { r.resultado = RESULTADO.sinValor; return; }
    // Sin póliza madre identificada: cruce por valor (cada prima una sola vez),
    // prefiriendo una póliza cuyo tomador sea este colegio.
    const candidatas = filasBase.filter((b) => !b.usada && b.clave.tipo !== "numero" && b.prima === monto);
    const libre = candidatas.find((b) => tomadorEsDelColegio(b.tomador, r.cert.colegio)) || candidatas[0];
    if (!libre) { r.resultado = RESULTADO.noEsta; return; }
    libre.usada = true;
    r.filaBase = libre;
    r.resultado = RESULTADO.coincidePorValor;
  });

  return { resultado, filasBase, raizPorColegio };
}

// Resultado por colegio: filas comparadas + pólizas que solo están en Base 2026.
export function compararPorColegio(colegios, certificados, base2026) {
  const { resultado, filasBase, raizPorColegio } = compararCertificados(certificados, base2026);
  const porColegio = {};
  colegios.forEach((c) => { porColegio[c] = { filas: [], soloBase: [] }; });
  resultado.forEach((r) => { (porColegio[r.cert.colegio] ||= { filas: [], soloBase: [] }).filas.push(r); });

  // "Viceversa": toda póliza de Base 2026 del colegio que ningún certificado cubrió.
  const sinColegio = [];
  filasBase.filter((b) => !b.usada).forEach((b) => {
    const x = raizYSufijo(b.poliza);
    const duenoPorRaiz = x ? Object.keys(raizPorColegio).find((c) => raizPorColegio[c] === x.raiz) : null;
    const dueno = duenoPorRaiz || colegios.find((c) => tomadorEsDelColegio(b.tomador, c));
    if (dueno && porColegio[dueno]) porColegio[dueno].soloBase.push(b); else sinColegio.push(b);
  });

  Object.values(porColegio).forEach((x) => {
    x.diferencias = x.filas.filter((r) => ![RESULTADO.coincide, RESULTADO.coincidePorValor, RESULTADO.sinValor].includes(r.resultado)).length + x.soloBase.length;
  });
  return { porColegio, sinColegio };
}
