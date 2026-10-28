-- Tipo de vehículo homologado del cliente de SOAT (AUTOMOVIL, MOTO, CAMPERO/CAMIONETA, CAMION, TAXI, BUS).
alter table soat_clientes add column if not exists tipo_vehiculo text default '';
