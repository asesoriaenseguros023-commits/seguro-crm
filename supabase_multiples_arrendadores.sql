-- Permite varios arrendadores: cada inmueble ahora indica a cuál pertenece.
-- Correr en el SQL Editor de Supabase.

alter table inmuebles add column if not exists arrendador_id uuid references arrendador_config(id) on delete set null;

-- Si ya existe un arrendador (el único que se venía usando), asignarlo por
-- defecto a los inmuebles que todavía no tengan uno, para no dejar nada
-- huérfano en la transición.
update inmuebles
set arrendador_id = (select id from arrendador_config order by nombre limit 1)
where arrendador_id is null
  and exists (select 1 from arrendador_config);
