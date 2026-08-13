-- Fecha real de inicio del arriendo actual de cada inmueble, para que el
-- cálculo de atrasados/mora no adivine "el mes en curso" cuando el
-- arrendatario nunca ha pagado (eso marcaba como atrasados a arrendatarios
-- recién llegados que apenas van a hacer su primer pago).
-- Correr en el SQL Editor de Supabase.

alter table inmuebles add column if not exists fecha_inicio_arriendo date;
