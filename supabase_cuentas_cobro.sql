-- Tabla para persistir las cuentas de cobro generadas en Arrendatarios:
-- número consecutivo propio y saldo anterior acumulado por arrendatario.
-- Correr en el SQL Editor de Supabase.

create table if not exists cuentas_cobro (
  id uuid primary key default gen_random_uuid(),
  numero integer not null,
  arrendatario_id uuid not null references arrendatarios(id) on delete cascade,
  inmueble_id uuid references inmuebles(id) on delete set null,
  periodo_inicio date not null,
  periodo_fin date not null,
  valor numeric not null default 0,
  saldo_anterior numeric not null default 0,
  fecha_emision date not null,
  fecha_vencimiento date not null,
  created_at timestamptz not null default now(),
  unique (arrendatario_id, periodo_inicio, periodo_fin)
);

alter table cuentas_cobro enable row level security;

-- Mismo patrón de acceso que el resto de tablas de Arriendos: cualquier
-- usuario autenticado puede leer/escribir. Si tus otras tablas usan una
-- política distinta (por ejemplo RLS abierto a "anon"), ajusta esta antes
-- de correrla para que quede consistente.
create policy "authenticated full access" on cuentas_cobro for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
