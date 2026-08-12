-- Campos nuevos para el rediseño del comprobante de pago de Arriendos.
-- Correr en el SQL Editor de Supabase.

ALTER TABLE pagos ADD COLUMN IF NOT EXISTS numero_comprobante text;

ALTER TABLE arrendador_config ADD COLUMN IF NOT EXISTS cuenta_bancaria text;
ALTER TABLE arrendador_config ADD COLUMN IF NOT EXISTS responsable_iva boolean NOT NULL DEFAULT false;
