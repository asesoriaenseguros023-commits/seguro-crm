-- Reacciones (👍 ❤️ …) del cliente a un mensaje: se muestran pegadas a la burbuja.
-- Correr en el SQL Editor de Supabase, UNA vez.
alter table whatsapp_mensajes add column if not exists reaccion text;

-- Reacciones que da el agente desde el CRM a los mensajes del cliente.
alter table whatsapp_mensajes add column if not exists reaccion_agente text;
