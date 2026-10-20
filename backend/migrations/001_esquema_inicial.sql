-- 001_esquema_inicial.sql
-- Crea las tablas base del sistema de turnos.
-- BEGIN/COMMIT: si algo falla, no se crea nada (todo o nada).

BEGIN;

-- Cada negocio que usa el sistema (base del multi-tenant)
CREATE TABLE negocios (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre        VARCHAR(120) NOT NULL,
  slug          VARCHAR(60)  NOT NULL UNIQUE,   -- para la URL pública: /reservar/peluqueria-demo
  telefono      VARCHAR(30),
  direccion     VARCHAR(200),
  zona_horaria  VARCHAR(60)  NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  creado_en     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Personas que inician sesión en el panel
CREATE TABLE usuarios (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  negocio_id     BIGINT       NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  nombre         VARCHAR(120) NOT NULL,
  email          VARCHAR(160) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,
  rol            VARCHAR(20)  NOT NULL CHECK (rol IN ('dueno', 'empleado')),
  activo         BOOLEAN      NOT NULL DEFAULT TRUE,
  creado_en      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Quienes atienden turnos (pueden o no tener usuario)
CREATE TABLE profesionales (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  negocio_id  BIGINT       NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  usuario_id  BIGINT       UNIQUE REFERENCES usuarios(id) ON DELETE SET NULL,
  nombre      VARCHAR(120) NOT NULL,
  activo      BOOLEAN      NOT NULL DEFAULT TRUE,
  creado_en   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Servicios que ofrece el negocio
CREATE TABLE servicios (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  negocio_id        BIGINT        NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  nombre            VARCHAR(120)  NOT NULL,
  descripcion       TEXT,
  duracion_minutos  INTEGER       NOT NULL CHECK (duracion_minutos > 0),
  precio            NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (precio >= 0),
  activo            BOOLEAN       NOT NULL DEFAULT TRUE,
  creado_en         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Relación muchos a muchos: qué profesional realiza qué servicio
CREATE TABLE profesional_servicios (
  profesional_id  BIGINT NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
  servicio_id     BIGINT NOT NULL REFERENCES servicios(id)     ON DELETE CASCADE,
  PRIMARY KEY (profesional_id, servicio_id)   -- evita pares repetidos
);

-- Franjas de trabajo semanales de cada profesional
CREATE TABLE horarios_atencion (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profesional_id  BIGINT   NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
  dia_semana      SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),  -- 0 = domingo
  hora_inicio     TIME     NOT NULL,
  hora_fin        TIME     NOT NULL,
  CHECK (hora_fin > hora_inicio)
);

-- Personas que reservan (sin login)
CREATE TABLE clientes (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  negocio_id  BIGINT       NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  nombre      VARCHAR(120) NOT NULL,
  telefono    VARCHAR(30)  NOT NULL,
  email       VARCHAR(160),
  creado_en   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (negocio_id, telefono)   -- el mismo teléfono puede ser cliente de distintos negocios
);

-- Reservas
CREATE TABLE turnos (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  negocio_id      BIGINT      NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  profesional_id  BIGINT      NOT NULL REFERENCES profesionales(id),
  servicio_id     BIGINT      NOT NULL REFERENCES servicios(id),
  cliente_id      BIGINT      NOT NULL REFERENCES clientes(id),
  inicio          TIMESTAMPTZ NOT NULL,
  fin             TIMESTAMPTZ NOT NULL,
  estado          VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente', 'confirmado', 'cancelado', 'completado')),
  notas           TEXT,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (fin > inicio)
);

-- Índices para las consultas más frecuentes
CREATE INDEX idx_usuarios_negocio        ON usuarios (negocio_id);
CREATE INDEX idx_profesionales_negocio   ON profesionales (negocio_id);
CREATE INDEX idx_servicios_negocio       ON servicios (negocio_id);
CREATE INDEX idx_horarios_profesional    ON horarios_atencion (profesional_id);
CREATE INDEX idx_turnos_profesional_inicio ON turnos (profesional_id, inicio);
CREATE INDEX idx_turnos_negocio_inicio     ON turnos (negocio_id, inicio);

COMMIT;