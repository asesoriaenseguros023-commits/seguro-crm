const UNIDADES = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
const ESPECIALES = ["diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve"];
const VEINTI = ["veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
const DECENAS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const CENTENAS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

function dosDigitos(n) {
  if (n < 10) return UNIDADES[n];
  if (n < 20) return ESPECIALES[n - 10];
  if (n < 30) return VEINTI[n - 20];
  const d = Math.floor(n / 10), u = n % 10;
  return u ? `${DECENAS[d]} y ${UNIDADES[u]}` : DECENAS[d];
}

function tresDigitos(n) {
  if (n === 100) return "cien";
  const c = Math.floor(n / 100), resto = n % 100;
  const partes = [];
  if (c) partes.push(CENTENAS[c]);
  if (resto) partes.push(dosDigitos(resto));
  return partes.join(" ");
}

// Convierte un entero (0 a 999.999.999) a su representación en palabras.
export function numeroALetras(n) {
  n = Math.round(Math.abs(n || 0));
  if (n === 0) return "cero";
  if (n >= 1000000000) return String(n);

  const millones = Math.floor(n / 1000000);
  const miles = Math.floor((n % 1000000) / 1000);
  const resto = n % 1000;

  const partes = [];
  if (millones) partes.push(millones === 1 ? "un millón" : `${tresDigitos(millones)} millones`);
  if (miles) partes.push(miles === 1 ? "mil" : `${tresDigitos(miles)} mil`);
  if (resto) partes.push(tresDigitos(resto));
  return partes.join(" ");
}

// "Son: {Monto} pesos M/CTE" listo para imprimir.
export function montoEnLetras(valor) {
  const texto = numeroALetras(valor);
  return `${texto.charAt(0).toUpperCase()}${texto.slice(1)} pesos M/CTE`;
}
