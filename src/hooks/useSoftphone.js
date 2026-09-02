import { useCallback, useEffect, useRef, useState } from "react";
import { authHeaders } from "../helpers.js";

// Vive una sola vez en App.jsx (fuera de SoatPage) para que una llamada en
// curso sobreviva si el agente navega a otra sección — SoatPage se
// desmonta por completo al cambiar de "seccion" (ver App.jsx renderContent).
export function useSoftphone() {
  const [status, setStatus] = useState("idle"); // idle | requesting-token | connecting | ringing | in-call | error
  const [callee, setCallee] = useState(null); // { telefono, nombre }
  const [durationSec, setDurationSec] = useState(0);
  const [muted, setMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const deviceRef = useRef(null);
  const callRef = useRef(null);
  const timerRef = useRef(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    callRef.current = null;
    if (deviceRef.current) {
      try { deviceRef.current.destroy(); } catch { /* ya pudo haberse destruido */ }
      deviceRef.current = null;
    }
    setMuted(false);
    setDurationSec(0);
  }, []);

  const goIdle = useCallback(() => {
    cleanup();
    setStatus("idle");
    setCallee(null);
  }, [cleanup]);

  const goError = useCallback((message) => {
    cleanup();
    setStatus("error");
    setErrorMessage(message);
  }, [cleanup]);

  // Barra de error se auto-descarta, para no bloquear la UI indefinidamente.
  useEffect(() => {
    if (status !== "error") return;
    const t = setTimeout(() => { setStatus("idle"); setCallee(null); setErrorMessage(""); }, 4000);
    return () => clearTimeout(t);
  }, [status]);

  const startCall = useCallback(async (telefono, nombre, clienteId) => {
    if (status !== "idle") return; // una llamada a la vez
    setCallee({ telefono, nombre, clienteId });
    setStatus("requesting-token");
    try {
      const res = await fetch("/api/twilio-token", { headers: await authHeaders() });
      if (!res.ok) throw new Error("No se pudo obtener autorización para llamar.");
      const { token } = await res.json();

      // Import dinámico: el SDK solo pesa si de verdad se hace una llamada.
      const { Device } = await import("@twilio/voice-sdk");
      const device = new Device(token);
      deviceRef.current = device;
      device.on("error", (e) => goError(e?.message || "Error de Twilio."));

      setStatus("connecting");
      // ClienteId viaja como parámetro hasta el webhook de TwiML, que lo
      // reenvía en los callbacks de estado/grabación para poder guardar
      // el resultado técnico contra el cliente correcto.
      const call = await device.connect({ params: { To: telefono, ClienteId: clienteId || "" } });
      callRef.current = call;

      call.on("ringing", () => setStatus((s) => (s === "in-call" ? s : "ringing")));
      call.on("accept", () => {
        setStatus("in-call");
        timerRef.current = setInterval(() => setDurationSec((d) => d + 1), 1000);
      });
      call.on("disconnect", goIdle);
      call.on("cancel", goIdle);
      call.on("reject", goIdle);
      call.on("error", (e) => goError(e?.message || "Error en la llamada."));
    } catch (err) {
      goError(err?.message || "No se pudo iniciar la llamada.");
    }
  }, [status, goError, goIdle]);

  const hangup = useCallback(() => {
    if (callRef.current) callRef.current.disconnect();
    else goIdle();
  }, [goIdle]);

  const toggleMute = useCallback(() => {
    if (!callRef.current) return;
    const next = !muted;
    callRef.current.mute(next);
    setMuted(next);
  }, [muted]);

  return { status, callee, durationSec, muted, errorMessage, startCall, hangup, toggleMute };
}
