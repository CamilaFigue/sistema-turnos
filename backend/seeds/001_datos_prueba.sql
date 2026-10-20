-- 001_datos_prueba.sql
-- Datos de ejemplo para desarrollo. Asume una base recién creada (ids desde 1).

BEGIN;

INSERT INTO negocios (nombre, slug, telefono, direccion)
VALUES ('Consultorio Salud Integral', 'consultorio-salud-integral', '1122334455', 'Av. Siempre Viva 742');

-- password_hash provisorio: lo reemplazamos cuando hagamos el login con bcrypt
INSERT INTO usuarios (negocio_id, nombre, email, password_hash, rol) VALUES
  (1, 'Dra. Laura Gómez', 'laura@consultorio.test', 'pendiente', 'dueno'),
  (1, 'Sofía Díaz',       'recepcion@consultorio.test', 'pendiente', 'empleado');  -- recepcionista: usa el sistema pero no atiende

INSERT INTO profesionales (negocio_id, usuario_id, nombre) VALUES
  (1, 1,    'Dra. Laura Gómez'),   -- es dueña y además atiende
  (1, NULL, 'Lic. Martín Ruiz');   -- atiende pero no tiene usuario

INSERT INTO servicios (negocio_id, nombre, descripcion, duracion_minutos, precio) VALUES
  (1, 'Consulta clínica',     'Primera consulta de clínica médica', 30, 20000),
  (1, 'Control',              'Control de seguimiento',             20, 12000),
  (1, 'Consulta nutricional', 'Evaluación y plan alimentario',      45, 18000);

-- Dra. Gómez: consulta clínica y control | Lic. Ruiz: consulta nutricional
INSERT INTO profesional_servicios (profesional_id, servicio_id) VALUES
  (1, 1), (1, 2), (2, 3);

-- Dra. Gómez: lunes y miércoles 9-13 y 15-19 | Lic. Ruiz: martes 10-18
INSERT INTO horarios_atencion (profesional_id, dia_semana, hora_inicio, hora_fin) VALUES
  (1, 1, '09:00', '13:00'),
  (1, 1, '15:00', '19:00'),
  (1, 3, '09:00', '13:00'),
  (1, 3, '15:00', '19:00'),
  (2, 2, '10:00', '18:00');

INSERT INTO clientes (negocio_id, nombre, telefono, email) VALUES
  (1, 'Ana Pérez',   '1155556666', 'ana@mail.test'),
  (1, 'Jorge López', '1177778888', NULL);

-- Lunes 26/10 10:00 con la Dra. Gómez | Martes 27/10 11:00 con el Lic. Ruiz (hora Argentina, -03)
INSERT INTO turnos (negocio_id, profesional_id, servicio_id, cliente_id, inicio, fin, estado) VALUES
  (1, 1, 1, 1, '2026-10-26 10:00-03', '2026-10-26 10:30-03', 'confirmado'),
  (1, 2, 3, 2, '2026-10-27 11:00-03', '2026-10-27 11:45-03', 'pendiente');

COMMIT;