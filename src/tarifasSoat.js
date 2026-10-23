// Tarifas SOAT 2026 (tabla "Tarifario SOAT", Seguros Mundial). Funciones puras,
// sin React, para poder probarlas fuera del navegador.
//
// Cada tarifa: código, valor de la prima, contribución del 52 %, tasa RUNT y
// total a pagar. La tarifa depende del tipo de vehículo y, según el caso, de la
// antigüedad (modelo) y del cilindraje o las toneladas.

const T = (codigo, prima, contribucion, total, runt = 2400) => ({ codigo, prima, contribucion, runt, total });

// Costo del servicio de la agencia: se suma a toda cotización.
export const COSTO_SERVICIO = 31000;

export const TARIFAS = {
  100: T(100, 80100, 41600, 124100),
  110: T(110, 167000, 86800, 256200),
  120: T(120, 224300, 116600, 343300),
  130: T(130, 499400, 259600, 761400),
  140: T(140, 253000, 131500, 386900),
  150: T(150, 253000, 131500, 386900),
  211: T(211, 520000, 270400, 792800), 221: T(221, 621200, 323000, 946600), 231: T(231, 728900, 379000, 1110300),
  212: T(212, 625400, 325200, 953000), 222: T(222, 736200, 382800, 1121400), 232: T(232, 836600, 435000, 1274000),
  310: T(310, 582900, 303100, 888400), 320: T(320, 842400, 438000, 1282800), 330: T(330, 1065500, 554000, 1621900),
  410: T(410, 656000, 341100, 999500), 420: T(420, 827500, 430300, 1260200), 430: T(430, 992300, 515900, 1510600),
  511: T(511, 292700, 152200, 447300), 521: T(521, 356800, 185500, 544700), 531: T(531, 416900, 216700, 636000),
  512: T(512, 388500, 202000, 592900), 522: T(522, 444100, 230900, 677400), 532: T(532, 494700, 257200, 754300),
  611: T(611, 523000, 271900, 797300), 621: T(621, 700600, 364300, 1067300),
  612: T(612, 668000, 347300, 1017700), 622: T(622, 841600, 437600, 1281600),
  711: T(711, 183900, 95600, 281900), 721: T(721, 228700, 118900, 350000), 731: T(731, 295400, 153600, 451400),
  712: T(712, 230000, 119600, 352000), 722: T(722, 282900, 147100, 432400), 732: T(732, 346700, 180200, 529300),
  810: T(810, 441400, 229500, 673300), 910: T(910, 436300, 226800, 665500), 920: T(920, 633500, 329400, 965300),
};

const DESC = {
  100: "Ciclomotor", 110: "Moto de menos de 100 c.c.", 120: "Moto de 100 a 200 c.c.", 130: "Moto de más de 200 c.c.",
  140: "Motocarro, tricimoto o cuadriciclo", 150: "Motocarro 5 pasajeros",
  211: "Campero o camioneta 0-9 años, menos de 1.500 c.c.", 221: "Campero o camioneta 0-9 años, 1.500 a 2.500 c.c.", 231: "Campero o camioneta 0-9 años, más de 2.500 c.c.",
  212: "Campero o camioneta 10 años o más, menos de 1.500 c.c.", 222: "Campero o camioneta 10 años o más, 1.500 a 2.500 c.c.", 232: "Campero o camioneta 10 años o más, más de 2.500 c.c.",
  310: "Carga o mixto, menos de 5 toneladas", 320: "Carga o mixto, 5 a 15 toneladas", 330: "Carga o mixto, más de 15 toneladas",
  410: "Oficial especial, menos de 1.500 c.c.", 420: "Oficial especial, 1.500 a 2.500 c.c.", 430: "Oficial especial, más de 2.500 c.c.",
  511: "Auto familiar 0-9 años, menos de 1.500 c.c.", 521: "Auto familiar 0-9 años, 1.500 a 2.500 c.c.", 531: "Auto familiar 0-9 años, más de 2.500 c.c.",
  512: "Auto familiar 10 años o más, menos de 1.500 c.c.", 522: "Auto familiar 10 años o más, 1.500 a 2.500 c.c.", 532: "Auto familiar 10 años o más, más de 2.500 c.c.",
  611: "Vehículo de 6 o más pasajeros 0-9 años, menos de 2.500 c.c.", 621: "Vehículo de 6 o más pasajeros 0-9 años, 2.500 c.c. o más",
  612: "Vehículo de 6 o más pasajeros 10 años o más, menos de 2.500 c.c.", 622: "Vehículo de 6 o más pasajeros 10 años o más, 2.500 c.c. o más",
  711: "Auto de negocio o taxi 0-9 años, menos de 1.500 c.c.", 721: "Auto de negocio o taxi 0-9 años, 1.500 a 2.500 c.c.", 731: "Auto de negocio o taxi 0-9 años, más de 2.500 c.c.",
  712: "Auto de negocio o taxi 10 años o más, menos de 1.500 c.c.", 722: "Auto de negocio o taxi 10 años o más, 1.500 a 2.500 c.c.", 732: "Auto de negocio o taxi 10 años o más, más de 2.500 c.c.",
  810: "Bus o buseta, servicio público urbano", 910: "Bus o buseta, intermunicipal de menos de 10 pasajeros", 920: "Bus o buseta, intermunicipal de 10 o más pasajeros",
};

// Cada tipo declara qué datos pide: "modelo" (año del vehículo), "cc" (cilindraje),
// "ton" (toneladas) o "sub" (una opción de lista).
export const TIPOS = [
  { id: "moto", nombre: "Moto", pide: ["cc"] },
  { id: "ciclomotor", nombre: "Ciclomotor", pide: [] },
  { id: "motocarro", nombre: "Motocarro, tricimoto o cuadriciclo", pide: ["sub"], opciones: [
    { id: 140, nombre: "Motocarro, tricimoto o cuadriciclo" }, { id: 150, nombre: "Motocarro 5 pasajeros" }] },
  { id: "campero", nombre: "Campero o camioneta", pide: ["modelo", "cc"] },
  { id: "familiar", nombre: "Auto familiar", pide: ["modelo", "cc"] },
  { id: "negocio", nombre: "Auto de negocio o taxi", pide: ["modelo", "cc"] },
  { id: "seis", nombre: "Vehículo de 6 o más pasajeros", pide: ["modelo", "cc"] },
  { id: "oficial", nombre: "Oficial especial", pide: ["cc"] },
  { id: "carga", nombre: "Carga o mixto", pide: ["ton"] },
  { id: "bus", nombre: "Bus o buseta", pide: ["sub"], opciones: [
    { id: 810, nombre: "Servicio público urbano" }, { id: 910, nombre: "Intermunicipal de menos de 10 pasajeros" },
    { id: 920, nombre: "Intermunicipal de 10 o más pasajeros" }] },
];

// Antigüedad = año actual − modelo (modelo en el futuro cuenta como 0).
export const antiguedad = (modelo, anioActual = new Date().getFullYear()) => Math.max(0, anioActual - modelo);

// Rango de cilindraje: 0 = "menos de 1.500", 1 = "1.500 a 2.500", 2 = "más de 2.500".
const rangoCC = (cc) => (cc < 1500 ? 0 : cc <= 2500 ? 1 : 2);

// Devuelve { tarifa, descripcion, antiguedad? } o { error }.
export function cotizar({ tipo, modelo, cc, ton, sub }, anioActual = new Date().getFullYear()) {
  const t = TIPOS.find((x) => x.id === tipo);
  if (!t) return { error: "Elige el tipo de vehículo." };
  const nCC = Number(cc), nModelo = Number(modelo), nTon = Number(ton);
  let codigo, edad = null;

  if (tipo === "ciclomotor") codigo = 100;
  else if (tipo === "motocarro" || tipo === "bus") {
    if (!sub) return { error: "Elige una opción." };
    codigo = Number(sub);
  } else if (tipo === "moto") {
    if (!(nCC > 0)) return { error: "Escribe el cilindraje (c.c.)." };
    codigo = nCC < 100 ? 110 : nCC <= 200 ? 120 : 130;
  } else if (tipo === "carga") {
    if (!(nTon > 0)) return { error: "Escribe las toneladas." };
    codigo = nTon < 5 ? 310 : nTon <= 15 ? 320 : 330;
  } else if (tipo === "oficial") {
    if (!(nCC > 0)) return { error: "Escribe el cilindraje (c.c.)." };
    codigo = 410 + rangoCC(nCC) * 10;
  } else {
    if (!(nModelo >= 1950 && nModelo <= anioActual + 1)) return { error: "Escribe un modelo (año) válido." };
    if (!(nCC > 0)) return { error: "Escribe el cilindraje (c.c.)." };
    edad = antiguedad(nModelo, anioActual);
    const viejo = edad >= 10 ? 1 : 0;
    if (tipo === "seis") codigo = 611 + viejo + (nCC < 2500 ? 0 : 10);
    else {
      const base = { campero: 211, familiar: 511, negocio: 711 }[tipo];
      codigo = base + viejo + rangoCC(nCC) * 10;
    }
  }
  const tarifa = TARIFAS[codigo];
  return { tarifa, descripcion: DESC[codigo], antiguedad: edad, servicio: COSTO_SERVICIO, totalCliente: tarifa.total + COSTO_SERVICIO };
}
