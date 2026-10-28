-- Estado nuevo "Contactado por WhatsApp" (fase = 'contactado_whatsapp').
-- No hace falta cambiar el esquema (fase es texto libre). Esto solo mueve a los clientes que YA tienen
-- WhatsApp enviado y siguen en "Pendiente", para que dejen de salir como pendientes.
update soat_clientes
set fase = 'contactado_whatsapp'
where fase = 'pendiente'
  and id in (select cliente_id from whatsapp_conversaciones);
