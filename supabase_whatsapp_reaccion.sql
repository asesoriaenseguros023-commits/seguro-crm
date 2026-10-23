-- Reacciones (👍 ❤️ …) del cliente a un mensaje: se muestran pegadas a la burbuja.
-- Correr en el SQL Editor de Supabase, UNA vez.
alter table whatsapp_mensajes add column if not exists reaccion text;
