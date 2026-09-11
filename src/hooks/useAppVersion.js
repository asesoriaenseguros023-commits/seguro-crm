import { useCallback, useEffect, useState } from "react";

// Detecta cuando el CRM se redeployó mientras esta pestaña seguía abierta,
// comparando el bundle principal (nombre con hash de Vite, cambia en cada
// build) que cargó la pestaña contra el que sirve "/" ahora mismo. No
// recarga sola — podría perder un formulario a medio llenar o cortar una
// llamada en curso — solo avisa (ver UpdateBanner.jsx) para que cada quien
// actualice cuando le convenga.
const INTERVALO_MS = 5 * 60 * 1000; // 5 min

function bundleActual() {
  return document.querySelector('script[type="module"]')?.getAttribute("src") || null;
}

async function bundleEnServidor() {
  const res = await fetch(`/?_=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) return null;
  const html = await res.text();
  const m = /<script[^>]*type="module"[^>]*src="([^"]+)"/.exec(html);
  return m ? m[1] : null;
}

export function useAppVersion() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const propio = bundleActual();
    if (!propio) return; // en dev (sin build fijo) no aplica

    const check = async () => {
      try {
        const enServidor = await bundleEnServidor();
        if (enServidor && enServidor !== propio) setUpdateAvailable(true);
      } catch {
        // Sin conexión momentánea: no molestar, se reintenta en el próximo ciclo.
      }
    };

    const id = setInterval(check, INTERVALO_MS);
    // También revisa apenas la pestaña vuelve a estar visible (el agente
    // regresa de otra ventana) — es cuando más probable es que se haya
    // desplegado algo mientras tanto, sin esperar hasta 5 min.
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const reload = useCallback(() => window.location.reload(), []);

  return { updateAvailable, reload };
}
