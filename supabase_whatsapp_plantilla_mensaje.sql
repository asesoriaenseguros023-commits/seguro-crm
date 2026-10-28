-- Guarda con qué plantilla se envió cada mensaje, para que cada plantilla se
-- mande una sola vez por cliente (selector de segundo contacto).
alter table whatsapp_mensajes add column if not exists plantilla text;
update whatsapp_mensajes set plantilla = 'soat_seguimiento_lead'
where tipo = 'plantilla' and direccion = 'saliente' and plantilla is null;
