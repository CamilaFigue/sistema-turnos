-- 005_bloqueos.sql
-- Días en los que un profesional no atiende: francos, vacaciones, congresos...
-- Se guardan como rango de días completos (desde y hasta incluidos), en la fecha local del negocio.

BEGIN;

CREATE TABLE bloqueos (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  negocio_id      BIGINT       NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  profesional_id  BIGINT       NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
  desde           DATE         NOT NULL,
  hasta           DATE         NOT NULL,
  motivo          VARCHAR(200),
  creado_en       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CHECK (hasta >= desde)
);

-- La disponibilidad pregunta "¿este profesional tiene un bloqueo que incluya esta fecha?"
CREATE INDEX idx_bloqueos_profesional ON bloqueos (profesional_id, desde, hasta);

COMMIT;
