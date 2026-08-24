-- Catálogo de documentos que se pueden exigir por ramo (antes vivía en
-- localStorage del navegador — cada equipo veía una lista distinta). Ahora
-- es la fuente única de verdad para las columnas de la tabla de Ramos.
-- Correr en el SQL Editor de Supabase.

create table if not exists ramos_documentos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo_persona text not null check (tipo_persona in ('Natural', 'Jurídica')),
  created_at timestamptz not null default now(),
  unique (nombre, tipo_persona)
);

alter table ramos_documentos enable row level security;

-- Mismo patrón de acceso que el resto de tablas: cualquier usuario
-- autenticado puede leer/escribir. Ajusta si tus otras tablas usan otra
-- política antes de correr esto, para que quede consistente.
create policy "authenticated full access" on ramos_documentos for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Semilla: los mismos documentos que traía por defecto la versión en
-- localStorage, para no perder nada al migrar.
insert into ramos_documentos (nombre, tipo_persona) values
  ('Cédula', 'Natural'),
  ('SARLAFT', 'Natural'),
  ('RUT', 'Natural'),
  ('Contrato', 'Natural'),
  ('Carta de Autorización', 'Natural'),
  ('Cámara de Comercio', 'Jurídica'),
  ('RUT Empresa', 'Jurídica'),
  ('SARLAFT', 'Jurídica'),
  ('Estados Financieros', 'Jurídica'),
  ('Cédula Rep. Legal', 'Jurídica'),
  ('Contrato', 'Jurídica'),
  ('Carta de Autorización', 'Jurídica')
on conflict (nombre, tipo_persona) do nothing;
