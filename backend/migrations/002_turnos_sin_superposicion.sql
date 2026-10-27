-- 002_turnos_sin_superposicion.sql
-- Impide, a nivel base de datos, que un profesional tenga dos turnos que se pisen.
-- Es la segunda capa de protección: funciona aunque lleguen dos reservas al mismo tiempo.

BEGIN;

-- Extensión que permite combinar "=" (mismo profesional) con "&&" (rangos que se pisan)
-- dentro de una misma restricción
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- tstzrange(inicio, fin) es el rango [inicio, fin): incluye el inicio y excluye el fin,
-- así un turno de 10:00-10:30 y otro de 10:30-11:00 NO se consideran superpuestos.
-- Los turnos cancelados no cuentan: liberan el horario.
ALTER TABLE turnos
  ADD CONSTRAINT turnos_sin_superposicion
  EXCLUDE USING gist (
    profesional_id WITH =,
    tstzrange(inicio, fin) WITH &&
  )
  WHERE (estado <> 'cancelado');

COMMIT;