-- Carga inicial de los inmuebles reales. Correr DESPUÉS de arriendos_schema.sql.
-- valor_canon_base queda en 0 y dia_vencimiento_pago en 5 (placeholder) —
-- edítalos desde la app, uno por uno, con los valores reales.

insert into inmuebles (nombre, direccion, valor_canon_base, dia_vencimiento_pago, activo) values
  ('Local 1',        'Calle 10 #28-04', 0, 5, true),
  ('Local 2 pequeño', 'Calle 10 #28-04', 0, 5, true),
  ('Tienda 2',        'Calle 10 #28-04', 0, 5, true),
  ('Piso 2',           'Calle 10 #28-04', 0, 5, true),
  ('Piso 3',           'Calle 10 #28-04', 0, 5, true),
  ('Piso 1',           'Calle 10 #27-58', 0, 5, true),
  ('Piso 2',           'Calle 10 #27-58', 0, 5, true);
