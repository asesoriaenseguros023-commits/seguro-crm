-- Chat real en el módulo WhatsApp (antes solo mostraba un indicador de
-- estado de solo lectura). whatsapp_conversaciones pasa de "una fila por
-- cada envío de plantilla" a "una fila por cliente" (la conversación), y el
-- hilo de mensajes real vive en whatsapp_mensajes (nueva). Correr en el SQL
-- Editor de Supabase, en orden.

-- 1. Para calcular la ventana de 24h de la API de WhatsApp sin tener que
--    agregar sobre whatsapp_mensajes en cada render de la lista.
alter table whatsapp_conversaciones add column if not exists ultima_entrante_at timestamptz;

-- 2. Antes del unique constraint del paso 3: confirmar que no haya ya varias
--    filas por el mismo cliente_id (si las hay, quedarse con la más
--    reciente por cliente_id a mano antes de seguir).
select cliente_id, count(*) from whatsapp_conversaciones group by cliente_id having count(*) > 1;

-- 3. Una conversación por cliente.
alter table whatsapp_conversaciones add constraint whatsapp_conversaciones_cliente_id_key unique (cliente_id);

-- 4. Columnas que ya no aplican a nivel de "conversación": plantilla/
--    wa_message_id/estado/ultimo_mensaje/error pasan a vivir por-mensaje en
--    whatsapp_mensajes. El estado manual editable a mano se elimina del
--    todo (pedido explícito del usuario -- lo real son los checks de
--    entrega/lectura por mensaje que ya manda Meta).
alter table whatsapp_conversaciones drop column if exists plantilla;
alter table whatsapp_conversaciones drop column if exists wa_message_id;
alter table whatsapp_conversaciones drop column if exists estado;
alter table whatsapp_conversaciones drop column if exists ultimo_mensaje;
alter table whatsapp_conversaciones drop column if exists error;

-- 5. Hilo de mensajes real.
create table if not exists whatsapp_mensajes (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references whatsapp_conversaciones(id) on delete cascade,
  direccion text not null,            -- 'saliente' | 'entrante'
  tipo text not null default 'texto', -- 'texto' | 'plantilla'
  contenido text,
  wa_message_id text unique,
  estado text not null default 'enviado', -- enviado | entregado | leido | fallido (solo aplica a 'saliente')
  error text,
  created_at timestamptz not null default now()
);
create index if not exists whatsapp_mensajes_conversacion_id_idx on whatsapp_mensajes (conversacion_id);

alter table whatsapp_mensajes enable row level security;
create policy "authenticated full access" on whatsapp_mensajes for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

alter publication supabase_realtime add table whatsapp_mensajes;
