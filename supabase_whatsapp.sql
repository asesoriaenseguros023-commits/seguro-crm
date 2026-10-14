-- Conversaciones de WhatsApp iniciadas desde Seguimiento SOAT — alimenta el
-- módulo "WhatsApp" y el indicador de estado en SOAT.jsx. Se llena sola vía
-- api/whatsapp.js: un INSERT al arrancar el envío (con el wa_message_id que
-- entrega Meta en la respuesta), y UPDATEs desde el webhook de Meta
-- (api/whatsapp.js?action=webhook) cuando cambia el estado de entrega o
-- llega una respuesta del lead. Correr en el SQL Editor de Supabase.

create table if not exists whatsapp_conversaciones (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references soat_clientes(id) on delete cascade,
  telefono text not null,
  nombre text,
  plantilla text,
  wa_message_id text unique,
  estado text not null default 'enviado', -- enviado | entregado | leido | respondido | fallido
  ultimo_mensaje text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_conversaciones_cliente_id_idx on whatsapp_conversaciones (cliente_id);
create index if not exists whatsapp_conversaciones_telefono_idx on whatsapp_conversaciones (telefono);

alter table whatsapp_conversaciones enable row level security;

-- Mismo patrón que soat_llamadas: el webhook escribe con la service_role
-- key (salta RLS); esta política es para que el CRM (usuario autenticado)
-- pueda leer y, si hace falta, ajustar el estado a mano.
create policy "authenticated full access" on whatsapp_conversaciones for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Realtime: necesario para que SOAT.jsx y WhatsApp.jsx se sincronicen solos
-- sin recargar, igual que ya pasa con soat_clientes/soat_llamadas.
alter publication supabase_realtime add table whatsapp_conversaciones;
