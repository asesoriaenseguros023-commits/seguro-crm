-- Simplifica el módulo Arriendos quitando la tabla "contratos" (no aportaba
-- valor para este caso de uso: manejo personal de pocos inmuebles).
-- Seguro de correr: NO toca la tabla "inmuebles" ni "arrendatarios" (ahí
-- están tus datos reales). Solo borra "contratos", "pagos" y "movimientos",
-- que están vacías todavía (el módulo de Pagos no se había construido).

drop table if exists movimientos cascade;
drop table if exists pagos cascade;
drop table if exists contratos cascade;

alter table inmuebles
  add column if not exists arrendatario_id uuid references arrendatarios(id) on delete set null;

create table pagos (
  id uuid primary key default gen_random_uuid(),
  inmueble_id uuid not null references inmuebles(id) on delete restrict,
  arrendatario_id uuid not null references arrendatarios(id) on delete restrict,
  fecha_pago date not null,
  periodo_inicio date not null,
  periodo_fin date not null,
  valor numeric not null,
  metodo text not null check (metodo in ('efectivo', 'transferencia', 'pse')),
  estado text not null default 'pagado' check (estado in ('pagado', 'parcial', 'pendiente')),
  created_at timestamptz not null default now()
);

create table movimientos (
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

-- Datos del arrendador (tú) — aparecen en cada comprobante de pago que generes.
-- Se usa como un solo registro: la app siempre edita/crea la primera fila.
create table if not exists arrendador_config (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  documento text,
  telefono text,
  direccion text,
  created_at timestamptz not null default now()
);

alter table pagos enable row level security;
alter table movimientos enable row level security;
alter table arrendador_config enable row level security;
create policy "anon_all_pagos" on pagos for all using (true) with check (true);
create policy "anon_all_movimientos" on movimientos for all using (true) with check (true);
create policy "anon_all_arrendador_config" on arrendador_config for all using (true) with check (true);
