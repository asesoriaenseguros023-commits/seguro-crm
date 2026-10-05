-- Histórico de arriendos finalizados (pestaña "Histórico" en Arrendatarios):
-- un registro por cada vez que se "Finaliza" un arriendo, con el total
-- pagado durante el período y, si quedó algo sin cobrar, el saldo final y
-- su detalle. Guarda inmueble_nombre/arrendatario_nombre aparte (no solo el
-- id) porque el inmueble puede reasignarse a otro arrendatario después, o el
-- arrendatario puede volver a arrendar otro inmueble — el nombre de ESE
-- momento no debe cambiar si el registro vinculado cambia más adelante.
-- Correr en el SQL Editor de Supabase.

create table if not exists historial_arrendatarios (
  id uuid primary key default gen_random_uuid(),
  inmueble_id uuid references inmuebles(id) on delete set null,
  arrendatario_id uuid references arrendatarios(id) on delete set null,
  inmueble_nombre text not null default '',
  arrendatario_nombre text not null default '',
  fecha_inicio date,
  fecha_fin date not null,
  total_pagado numeric not null default 0,
  saldo_final numeric not null default 0,
  detalle_adeudado jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table historial_arrendatarios enable row level security;

-- Mismo patrón de acceso que el resto de tablas de Arriendos: cualquier
-- usuario autenticado puede leer/escribir.
create policy "authenticated full access" on historial_arrendatarios for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Necesario para que el realtime (supabase.channel) de Arriendos.jsx reciba
-- los INSERT/UPDATE/DELETE de esta tabla, igual que las demás del módulo.
alter publication supabase_realtime add table historial_arrendatarios;
