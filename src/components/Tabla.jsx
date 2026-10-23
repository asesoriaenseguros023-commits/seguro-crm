import { BLUE } from "../constants.js";

// Tabla con celdas separadas por líneas, márgenes en cada columna, encabezado fijo
// y filas alternadas. cols: [{ h, right }]; filas: [{ key, cells, onClick, bg }].
const BORDE = "#dbe4f3";
export default function Tabla({ cols, filas, minWidth = 640, maxHeight, total }) {
  return (
  <div style={{ border: `1px solid ${BORDE}`, borderRadius: 10, overflow: "auto", maxHeight }}>
    <table style={{ width: "100%", minWidth, borderCollapse: "separate", borderSpacing: 0, fontSize: 13.5 }}>
      <thead>
        <tr>
          {cols.map((c, i) => (
            <th key={i} style={{ position: "sticky", top: 0, zIndex: 1, background: BLUE.light, color: BLUE.primary, fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", textAlign: c.right ? "right" : "left", padding: "11px 16px", borderBottom: `2px solid ${BORDE}`, borderRight: i < cols.length - 1 ? `1px solid ${BORDE}` : "none", whiteSpace: "nowrap" }}>{c.h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.map((f, r) => (
          <tr key={f.key ?? r} onClick={f.onClick} style={{ cursor: f.onClick ? "pointer" : "default", background: f.bg || (r % 2 ? "#f8faff" : "#fff") }}>
            {f.cells.map((cell, i) => (
              <td key={i} style={{ textAlign: cols[i].right ? "right" : "left", padding: "11px 16px", verticalAlign: "middle", borderBottom: r < filas.length - 1 ? `1px solid ${BORDE}` : "none", borderRight: i < cols.length - 1 ? `1px solid ${BORDE}` : "none" }}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
      {total && (
        <tfoot>
          <tr>{total.map((cell, i) => <td key={i} style={{ textAlign: cols[i].right ? "right" : "left", padding: "11px 16px", fontWeight: 700, background: BLUE.light, borderTop: `2px solid ${BORDE}`, borderRight: i < cols.length - 1 ? `1px solid ${BORDE}` : "none" }}>{cell}</td>)}</tr>
        </tfoot>
      )}
    </table>
  </div>
  );
}
