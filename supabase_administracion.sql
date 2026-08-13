-- Campo de administración por inmueble (sí/no + monto), que se suma al
-- canon en comprobantes y cuentas de cobro cuando aplica.
-- Correr en el SQL Editor de Supabase.

alter table inmuebles add column if not exists tiene_administracion boolean not null default false;
alter table inmuebles add column if not exists valor_administracion numeric not null default 0;

-- Snapshot de cuánto de cada pago/cobro correspondió a administración,
-- para que comprobantes y cuentas de cobro ya emitidos no cambien si el
-- valor de administración del inmueble se actualiza después.
alter table pagos add column if not exists valor_administracion numeric not null default 0;
alter table cuentas_cobro add column if not exists valor_administracion numeric not null default 0;
