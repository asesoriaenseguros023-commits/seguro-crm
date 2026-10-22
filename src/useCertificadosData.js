import { useState, useEffect } from "react";
import { authHeaders } from "./helpers.js";

const REFETCH_MS = 20 * 60 * 1000;

// Carga (y refresca cada 20 min) los datos de Certificados Escolares desde
// /api/sheets-dashboards?tipo=certificados. Mismo patrón que el resto de
// tableros: el fetch vive dentro del efecto y los re-fetch se disparan subiendo
// refreshTick (regla react-hooks/set-state-in-effect del proyecto).
export function useCertificadosData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelado = false;
    async function cargarDatos() {
      try {
        const res = await fetch("/api/sheets-dashboards?tipo=certificados", { headers: await authHeaders() });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || `Error ${res.status} consultando Google Sheets`);
        if (cancelado) return;
        setError("");
        setData(json);
        setLastUpdated(new Date());
      } catch (e) {
        if (!cancelado) setError(e.message || "No se pudo cargar la información.");
      } finally {
        if (!cancelado) { setLoading(false); setRefreshing(false); }
      }
    }
    cargarDatos();
    return () => { cancelado = true; };
  }, [refreshTick]);

  useEffect(() => {
    const id = setInterval(() => { setRefreshing(true); setRefreshTick((t) => t + 1); }, REFETCH_MS);
    return () => clearInterval(id);
  }, []);

  const refresh = () => { setRefreshing(true); setRefreshTick((t) => t + 1); };
  const retry = () => { setLoading(true); setRefreshTick((t) => t + 1); };
  return { data, loading, refreshing, error, lastUpdated, refresh, retry };
}
