-- Cada boda: tus clientes
CREATE TABLE bodas (
  id                SERIAL PRIMARY KEY,
  slug              TEXT UNIQUE NOT NULL,      -- ej: ana-y-luis (para la URL)
  novios            TEXT NOT NULL,
  fecha_boda        TIMESTAMPTZ NOT NULL,
  fecha_limite_rsvp TIMESTAMPTZ NOT NULL
);

-- Cada persona invitada (adultos con código, niños ligados a un adulto)
CREATE TABLE invitados (
  id              SERIAL PRIMARY KEY,
  boda_id         INT NOT NULL REFERENCES bodas(id) ON DELETE CASCADE,
  nombre          TEXT NOT NULL,
  es_nino         BOOLEAN NOT NULL DEFAULT false,
  codigo          TEXT UNIQUE,                  -- solo adultos
  responsable_id  INT REFERENCES invitados(id), -- solo niños
  respuesta       TEXT CHECK (respuesta IN ('si', 'no')),  -- NULL = pendiente
  fecha_respuesta TIMESTAMPTZ,

  -- Regla: un adulto tiene código; un niño no tiene código pero sí responsable
  CHECK (
    (es_nino = false AND codigo IS NOT NULL AND responsable_id IS NULL) OR
    (es_nino = true  AND codigo IS NULL     AND responsable_id IS NOT NULL)
  )
);

-- Acelera la búsqueda de "los niños a cargo de este adulto"
CREATE INDEX idx_invitados_responsable ON invitados(responsable_id);

-- ===== Datos de prueba =====
INSERT INTO bodas (slug, novios, fecha_boda, fecha_limite_rsvp)
VALUES ('prueba', 'Novio1 & Novio2', '2028-03-03 15:00-06', '2028-02-01 23:59:59-06');

INSERT INTO invitados (boda_id, nombre, codigo) VALUES
  (1, 'Juan Pérez', 'prueba123'),
  (1, 'Ana López',  'ana456');

INSERT INTO invitados (boda_id, nombre, es_nino, responsable_id)
VALUES (1, 'Sofía Pérez', true, 1);