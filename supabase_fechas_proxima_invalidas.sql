-- Limpia fechas de próxima acción con año absurdo (ej. 2029 mal digitado).
-- Vacía solo la fecha; la acción y el resto del cliente quedan igual.
-- Revisa primero cuáles son:
select id, nombre, proxima_accion, fecha_proxima
from soat_clientes
where fecha_proxima is not null and fecha_proxima <> ''
  and (regexp_match(fecha_proxima, '(\d{4})'))[1]::int > extract(year from now())::int + 1;

update soat_clientes
set fecha_proxima = ''
where fecha_proxima is not null and fecha_proxima <> ''
  and (regexp_match(fecha_proxima, '(\d{4})'))[1]::int > extract(year from now())::int + 1;
