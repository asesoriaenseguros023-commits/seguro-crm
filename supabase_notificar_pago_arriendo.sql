-- Dispara un aviso a Google Apps Script cada vez que se inserta un pago
-- nuevo en `pagos`, para que la hoja de Google "Recaudo Arriendos" (que
-- alimenta el artefacto externo del mismo nombre) se actualice sola, sin
-- pasar por ninguna función de Vercel. Pedido del usuario 2026-10-05: no
-- quería gastar una función serverless más (el plan Hobby tope a 12, ver
-- [[project-seguro-crm]]) — esto corre enteramente dentro de Supabase
-- (pg_net) + un Web App gratis de Google Apps Script.
-- Correr en el SQL Editor de Supabase.

create extension if not exists pg_net with schema extensions;

-- IMPORTANTE: reemplaza estos dos placeholders antes de correr este script:
--   1. <URL_WEB_APP>: la URL que te da Google al desplegar
--      recaudo-arriendos-apps-script.gs como Web App (Implementar > Nueva
--      implementación > Aplicación web).
--   2. <SECRETO>: el mismo valor de la variable SECRETO en ese script
--      (ya viene generado ahí — cópialo tal cual, no inventes uno nuevo).
create or replace function notificar_pago_arriendo()
returns trigger
language plpgsql
security definer
as $$
declare
  v_inmueble text;
  v_arrendatario text;
begin
  select i.nombre, a.nombre
    into v_inmueble, v_arrendatario
  from inmuebles i
  left join arrendatarios a on a.id = i.arrendatario_id
  where i.id = new.inmueble_id;

  perform net.http_post(
    url := '<URL_WEB_APP>',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'secreto', '<SECRETO>',
      'pagoId', new.id,
      'fecha', new.fecha_pago,
      'inmueble', coalesce(v_inmueble, ''),
      'arrendatario', coalesce(v_arrendatario, ''),
      'valor', new.valor
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_notificar_pago_arriendo on pagos;
create trigger trg_notificar_pago_arriendo
  after insert on pagos
  for each row
  execute function notificar_pago_arriendo();
