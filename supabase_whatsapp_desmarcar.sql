-- Permite quitar la marca "sin responder" de una conversación sin contestarla.
-- Guarda cuándo se desmarcó; si el cliente escribe después, vuelve a marcarse.
-- Correr en el SQL Editor de Supabase, UNA vez.
alter table whatsapp_conversaciones add column if not exists desmarcada_at timestamptz;
