-- Fotos, audios, videos y documentos que el cliente manda por WhatsApp.
-- El webhook (api/whatsapp.js) descarga el archivo de Meta (los links de Meta
-- caducan) y lo guarda en el bucket privado "whatsapp-media"; aquí quedan las
-- columnas para encontrarlo. Correr en el SQL Editor de Supabase, UNA vez,
-- ANTES de que lleguen mensajes con archivos.

alter table whatsapp_mensajes add column if not exists media_path text;    -- ruta dentro del bucket
alter table whatsapp_mensajes add column if not exists media_mime text;    -- p. ej. audio/ogg, image/jpeg
alter table whatsapp_mensajes add column if not exists media_nombre text;  -- nombre original (documentos)

-- Bucket privado: nadie lo lee sin sesión. El webhook sube con la service role.
insert into storage.buckets (id, name, public)
values ('whatsapp-media', 'whatsapp-media', false)
on conflict (id) do nothing;

-- Los usuarios autenticados del CRM pueden ver los archivos (se piden con links firmados).
create policy "authenticated read whatsapp-media" on storage.objects for select
  using (bucket_id = 'whatsapp-media' and auth.role() = 'authenticated');
