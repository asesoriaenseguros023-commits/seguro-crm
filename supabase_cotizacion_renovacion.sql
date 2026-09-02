-- Liga una póliza a la cotización que se crea cuando, en Renovaciones, se
-- marca la decisión "Cliente Cotiza" — para no crear una cotización
-- duplicada si se vuelve a seleccionar. Correr en el SQL Editor de Supabase.

alter table polizas add column if not exists cotizacion_renovacion_id uuid references cotizaciones(id);
