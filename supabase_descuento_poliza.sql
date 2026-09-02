-- Campo de descuento al registrar la póliza emitida (resta del total a
-- pagar). Correr en el SQL Editor de Supabase.

alter table cotizaciones add column if not exists descuento_emitida numeric default 0;
alter table polizas add column if not exists descuento numeric default 0;
