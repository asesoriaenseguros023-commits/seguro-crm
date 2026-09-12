-- Análisis automático por IA de las llamadas grabadas en Seguimiento SOAT.
-- Claude no recibe audio directamente: se transcribe primero (OpenAI) y
-- Claude analiza el texto — si contestó una persona real, resumen de la
-- llamada, y calidad del agente. Se llena solo desde
-- api/twilio-recording-status.js apenas queda la grabación (llamadas
-- marcadas "buzon" no llegan aquí — esa grabación se borra antes).
-- Correr en el SQL Editor de Supabase.

alter table soat_llamadas
  add column if not exists transcripcion text,
  add column if not exists analisis_ia jsonb,
  add column if not exists analizado_en timestamptz;
