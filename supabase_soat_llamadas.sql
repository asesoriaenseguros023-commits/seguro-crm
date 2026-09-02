-- Registro técnico de las llamadas de Twilio en Seguimiento SOAT (estado,
-- duración, grabación) — separado del "historial" manual que ya llena el
-- agente, para no tocar esa lógica. Se llena solo, vía los webhooks
-- api/twilio-call-status.js y api/twilio-recording-status.js.
-- Correr en el SQL Editor de Supabase.

create table if not exists soat_llamadas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references soat_clientes(id) on delete cascade,
  call_sid text not null unique,
  estado text,
  duracion_seg integer,
  grabacion_sid text,
  created_at timestamptz not null default now()
);

create index if not exists soat_llamadas_cliente_id_idx on soat_llamadas (cliente_id);

alter table soat_llamadas enable row level security;

-- Mismo patrón de acceso que el resto de tablas (authenticated full access).
-- Los webhooks de Twilio escriben con la service_role key (saltan RLS), así
-- que esta política es solo para que el CRM pueda leer/mostrar los datos.
create policy "authenticated full access" on soat_llamadas for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
