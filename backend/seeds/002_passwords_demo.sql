-- 002_passwords_demo.sql
-- Contraseña de prueba "demo1234" para los usuarios del seed 001.
-- Se guarda el HASH de bcrypt, nunca la contraseña en texto plano.
-- Solo para desarrollo: en producción cada usuario elige su propia contraseña.

BEGIN;

UPDATE usuarios
SET password_hash = '$2b$10$BkNWQTcbV7xbnkJIggZWNOzV9.OEECKsbF5905R9JnEc8fDlQofIu'
WHERE email IN ('laura@consultorio.test', 'recepcion@consultorio.test');

COMMIT;