import { fetchSheetValues, rowsFromMatrixGeneric } from "./googleSheets.js";

// Cada compra que aparece en "Histórico SOAT" (la base de Oficina SOAT) marca
// al cliente del CRM como "Compró" -- así deja de salir en seguimiento y no se
// le vuelve a llamar. Se busca por placa; si la venta no trae placa, por
// teléfono solo cuando hay un único cliente con ese número. Corre cada vez que
// un agente tiene el CRM abierto (ver App.jsx) y es seguro repetirlo: un
// cliente que ya está en "Compró" no se toca.
const SHEET_ID = "11XaNCkjmRONiu5pPiJ8XP7bSFNIqrCLEBpvxNBVe9Uw";
const TAB = "Histórico SOAT";
const DIAS_VENTANA = 60;       // solo ventas recientes
const DIAS_ANTES_VENC = 90;    // la venta debe ser del ciclo de renovación del cliente

const serialAISO = (serial) => {
  const n = Number(serial);
  if (!isFinite(n)) return null;
  const d = new Date(Math.round((n - 25569) * 86400 * 1000));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
};
const placaNorm = (x) => {
  const p = String(x || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z]{3}\d{2}[A-Z0-9]$|^[A-Z]{3}\d{3}$|^[A-Z]{3}\d{2}$/.test(p) ? p : "";
};
const telNorm = (x) => {
  let d = String(x || "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("57")) d = d.slice(2);
  return d.length === 10 && d[0] === "3" ? d : "";
};
const isoMas = (iso, dias) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10); };

export async function sincronizarCompras(sheetsAuth, supabase) {
  const matrix = await fetchSheetValues(sheetsAuth, SHEET_ID, TAB);
  const filas = rowsFromMatrixGeneric(matrix, { fecha: ["fecha"], telefono: ["telefono", "teléfono"], placa: ["placa"] });
  const hoy = new Date().toISOString().slice(0, 10);
  const desde = isoMas(hoy, -DIAS_VENTANA);
  const ventas = [];
  for (const r of filas) {
    const fecha = serialAISO(r.fecha);
    if (!fecha || fecha > hoy || fecha < desde) continue;
    const placa = placaNorm(r.placa), tel = telNorm(r.telefono);
    if (placa || tel) ventas.push({ fecha, placa, tel });
  }
  if (ventas.length === 0) return { revisadas: 0, marcados: [] };

  const placas = [...new Set(ventas.map(v => v.placa).filter(Boolean))];
  const tels = [...new Set(ventas.map(v => v.tel).filter(Boolean))];
  const cols = "id, nombre, telefono, placa, fase, fecha_vencimiento, historial";
  const [porPlaca, porTel] = await Promise.all([
    placas.length ? supabase.from("soat_clientes").select(cols).in("placa", [...placas, ...placas.map(p => p.toLowerCase())]) : { data: [] },
    tels.length ? supabase.from("soat_clientes").select(cols).in("telefono", tels) : { data: [] },
  ]);
  const clientes = new Map();
  [...(porPlaca.data || []), ...(porTel.data || [])].forEach(c => clientes.set(c.id, c));
  const lista = [...clientes.values()];

  const compras = new Map(); // id -> venta más reciente que le corresponde
  for (const v of ventas) {
    let cand = v.placa ? lista.filter(c => placaNorm(c.placa) === v.placa) : [];
    let llenaPlaca = false;
    if (cand.length === 0 && v.tel) {
      const porTelefono = lista.filter(c => telNorm(c.telefono) === v.tel);
      // Sin placa en la venta: solo si hay un único cliente con ese teléfono.
      // Con placa en la venta: solo si ese cliente aún no tiene placa.
      if (porTelefono.length === 1 && (!v.placa || !placaNorm(porTelefono[0].placa))) { cand = porTelefono; llenaPlaca = !!v.placa; }
    }
    for (const c of cand) {
      if (c.fase === "compro") continue;
      if (c.fecha_vencimiento && v.fecha < isoMas(String(c.fecha_vencimiento).slice(0, 10), -DIAS_ANTES_VENC)) continue;
      const previa = compras.get(c.id);
      if (!previa || v.fecha > previa.venta.fecha) compras.set(c.id, { c, venta: v, llenaPlaca });
    }
  }

  const marcados = [];
  for (const { c, venta, llenaPlaca } of compras.values()) {
    const [y, m, d] = venta.fecha.split("-");
    const entrada = { fecha: `${Number(d)}/${Number(m)}/${y}`, agente: "Sistema", resultado: "compro", motivo: "", motivoIloc: "", nota: "Compró en la oficina (Histórico SOAT).", proximaAccion: "", fechaProxima: "" };
    const patch = { fase: "compro", proxima_accion: "", fecha_proxima: "", historial: [entrada, ...(c.historial || [])] };
    if (llenaPlaca) patch.placa = venta.placa;
    const { error } = await supabase.from("soat_clientes").update(patch).eq("id", c.id);
    if (!error) marcados.push({ id: c.id, nombre: c.nombre, placa: venta.placa || c.placa, fecha: venta.fecha });
  }
  return { revisadas: ventas.length, marcados };
}
