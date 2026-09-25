import { JWT } from "google-auth-library";

// Compartido por todos los endpoints que leen Google Sheets del lado del
// servidor con la cuenta de servicio (primas-data.js, certificados-data.js,
// ...) — ver [[project-pulso-primas]] para cómo se creó esa cuenta.
export function sheetsClient() {
  const email = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  // Vercel no preserva saltos de línea reales en variables de entorno — la
  // llave privada se guarda con "\n" literales y hay que devolverlos aquí.
  const key = (process.env.GOOGLE_SHEETS_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!email || !key) {
    throw new Error("Faltan las variables GOOGLE_SHEETS_CLIENT_EMAIL / GOOGLE_SHEETS_PRIVATE_KEY");
  }
  return new JWT({ email, key, scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] });
}

export async function fetchSheetValues(client, spreadsheetId, sheetName) {
  const token = await client.getAccessToken();
  const range = encodeURIComponent(`'${sheetName}'`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token.token}` } });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Google Sheets API ${resp.status}: ${body.slice(0, 300)}`);
  }
  const data = await resp.json();
  return data.values || [];
}

// UNFORMATTED_VALUE ya devuelve numeros reales — este fallback solo cubre
// el caso raro de una celda con texto tipo "15.000" colado en una columna
// numerica.
export function toNumber(v) {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).trim().replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// Matriz [fila][col] (como la devuelve fetchSheetValues) -> objetos, usando
// la primera fila como encabezado. `campos` mapea nombre de salida -> lista
// de posibles nombres de columna (minúsculas) a probar en orden.
export function rowsFromMatrixGeneric(matrix, campos) {
  if (!matrix.length) return [];
  const header = matrix[0].map((h) => String(h || "").trim().toLowerCase());
  const idx = {};
  header.forEach((h, i) => { idx[h] = i; });
  function get(row, names) {
    for (const n of names) {
      const col = idx[n];
      if (col != null && row[col] != null) return row[col];
    }
    return null;
  }
  return matrix.slice(1).map((row) => {
    const out = {};
    Object.keys(campos).forEach((campo) => { out[campo] = get(row, campos[campo]); });
    return out;
  });
}
