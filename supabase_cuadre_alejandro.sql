-- Cuadre Alejandro (Arriendos): egresos que se descuentan del recaudo de
-- Piso 1A y Piso 2A. Correr una vez en el SQL Editor de Supabase.

create table if not exists cuadre_egresos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  concepto text not null,
  valor numeric not null check (valor >= 0),
  created_at timestamptz not null default now()
);

alter table cuadre_egresos enable row level security;

create policy "anon_all_cuadre_egresos" on cuadre_egresos for all using (true) with check (true);
