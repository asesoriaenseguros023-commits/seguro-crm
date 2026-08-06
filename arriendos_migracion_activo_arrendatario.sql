-- Agrega el estado activo/inactivo a arrendatarios (para marcar inquilinos
-- que ya no viven en el inmueble, sin borrar su historial de pagos).
alter table arrendatarios add column if not exists activo boolean not null default true;
