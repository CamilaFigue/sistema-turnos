-- 004_roles.sql
-- Dos roles con permisos distintos:
--   admin       -> gestiona todo el panel (agenda, profesionales, horarios, servicios)
--   profesional -> ve y cancela solo sus turnos, y bloquea sus días no laborables

BEGIN;

-- Primero sacamos la regla vieja ('dueno', 'empleado') para poder cambiar los valores
ALTER TABLE usuarios DROP CONSTRAINT usuarios_rol_check;

-- El dueño pasa a admin
UPDATE usuarios SET rol = 'admin' WHERE rol = 'dueno';

-- Un empleado que atiende (está vinculado a un profesional) pasa a profesional
UPDATE usuarios u SET rol = 'profesional'
WHERE u.rol = 'empleado'
  AND EXISTS (SELECT 1 FROM profesionales p WHERE p.usuario_id = u.id);

-- El resto de los empleados (por ejemplo, recepción) gestiona todo: pasa a admin
UPDATE usuarios SET rol = 'admin' WHERE rol = 'empleado';

ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_rol_check
  CHECK (rol IN ('admin', 'profesional'));

COMMIT;
