-- 006_cancelacion_por_link.sql
-- Cada turno nuevo recibe un código secreto. Con el link que lo contiene,
-- el cliente puede ver su turno y cancelarlo sin iniciar sesión.

BEGIN;

-- Los turnos anteriores a esta migración quedan sin código (NULL): no tienen link.
-- UNIQUE crea además un índice, así buscar un turno por su código es rápido.
ALTER TABLE turnos ADD COLUMN codigo_cancelacion VARCHAR(64) UNIQUE;

COMMIT;
