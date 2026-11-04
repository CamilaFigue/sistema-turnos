-- 003_turnos_confirmados.sql
-- Los turnos se confirman solos al reservarse: el estado "pendiente" deja de existir.
-- Un turno nace "confirmado" y después puede pasar a "cancelado" o "completado".

BEGIN;

-- Los turnos que quedaron pendientes pasan a confirmados
UPDATE turnos SET estado = 'confirmado' WHERE estado = 'pendiente';

-- Valor por defecto para los turnos nuevos
ALTER TABLE turnos ALTER COLUMN estado SET DEFAULT 'confirmado';

-- Reemplazamos la regla de estados válidos por una sin "pendiente"
ALTER TABLE turnos DROP CONSTRAINT turnos_estado_check;
ALTER TABLE turnos
  ADD CONSTRAINT turnos_estado_check
  CHECK (estado IN ('confirmado', 'cancelado', 'completado'));

COMMIT;