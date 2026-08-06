-- Módulo Arriendos — schema completo (inmuebles, arrendatarios, contratos, pagos, movimientos)
-- Correr una sola vez en el SQL Editor de Supabase.

create table if not exists inmuebles (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  direccion text,
  valor_canon_base numeric not null default 0,
  dia_vencimiento_pago int not null check (dia_vencimiento_pago between 1 and 31),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists arrendatarios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text,
  documento text,
  created_at timestamptz not null default now()
);

create table if not exists contratos (
  id uuid primary key default gen_random_uuid(),
  inmueble_id uuid not null references inmuebles(id) on delete restrict,
  arrendatario_id uuid not null references arrendatarios(id) on delete restrict,
  fecha_inicio date not null,
  fecha_fin date,
  valor_canon numeric not null,
  dia_pago int not null check (dia_pago between 1 and 31),
  estado text not null default 'activo' check (estado in ('activo', 'terminado')),
  created_at timestamptz not null default now()
);

-- Un inmueble no puede tener dos contratos activos al mismo tiempo (lo necesita
-- el dashboard/semáforo, que asume un único contrato vigente por inmueble).
create unique index if not exists un_inmueble_un_contrato_activo
  on contratos (inmueble_id) where estado = 'activo';

create table if not exists pagos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references contratos(id) on delete cascade,
  fecha_pago date not null,
  periodo_inicio date not null,
  periodo_fin date not null,
  valor numeric not null,
  metodo text not null check (metodo in ('efectivo', 'transferencia', 'pse')),
  estado text not null default 'pagado' check (estado in ('pagado', 'parcial', 'pendiente')),
  created_at timestamptz not null default now()
);

create table if not exists movimientos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  tipo text not null check (tipo in ('ingreso_arriendo', 'gasto', 'prestamo', 'otro')),
  categoria text,
  valor numeric not null,
  descripcion text,
  pago_id uuid references pagos(id) on delete set null,
  inmueble_id uuid references inmuebles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- RLS: mismo patrón permisivo para "anon" que usa el resto de tablas del proyecto
-- (la app entera ya está protegida por el login de Supabase Auth delante).
alter table inmuebles enable row level security;
alter table arrendatarios enable row level security;
alter table contratos enable row level security;
alter table pagos enable row level security;
alter table movimientos enable row level security;

create policy "anon_all_inmuebles" on inmuebles for all using (true) with check (true);
create policy "anon_all_arrendatarios" on arrendatarios for all using (true) with check (true);
create policy "anon_all_contratos" on contratos for all using (true) with check (true);
create policy "anon_all_pagos" on pagos for all using (true) with check (true);
create policy "anon_all_movimientos" on movimientos for all using (true) with check (true);
