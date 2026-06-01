-- =============================================================================
-- Migración 1: Catálogos normalizados
-- Tablas de referencia global (sin sociedad_id).
-- Solo lectura para usuarios autenticados; escritura solo por service_role.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tipos de consulta veterinaria
-- ---------------------------------------------------------------------------
CREATE TABLE cat_tipo_consulta (
  id     SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE
);

-- ---------------------------------------------------------------------------
-- Partes del cuerpo del caballo
-- ---------------------------------------------------------------------------
CREATE TABLE cat_parte_cuerpo (
  id     SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE
);

-- ---------------------------------------------------------------------------
-- Razas
-- ---------------------------------------------------------------------------
CREATE TABLE cat_raza (
  id     SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE
);

-- ---------------------------------------------------------------------------
-- Pelajes
-- ---------------------------------------------------------------------------
CREATE TABLE cat_pelaje (
  id     SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE
);

-- ---------------------------------------------------------------------------
-- Roles del sistema
-- Valores fijos: admin, veterinario, piloto, jugador, peticero
-- ---------------------------------------------------------------------------
CREATE TABLE cat_rol (
  id     SERIAL PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL UNIQUE
);

-- =============================================================================
-- Seed data
-- =============================================================================

INSERT INTO cat_rol (nombre) VALUES
  ('admin'),
  ('veterinario'),
  ('piloto'),
  ('jugador'),
  ('peticero');

INSERT INTO cat_tipo_consulta (nombre) VALUES
  ('Revisión general'),
  ('Vacuna'),
  ('Cirugía'),
  ('Control de preñez'),
  ('Desparasitación'),
  ('Herraje'),
  ('Odontología'),
  ('Radiografía'),
  ('Ecografía'),
  ('Tratamiento ortopédico'),
  ('Herida / sutura'),
  ('Otro');

INSERT INTO cat_raza (nombre) VALUES
  ('Criollo'),
  ('Pura Sangre de Carrera'),
  ('Polo Argentino'),
  ('Cuarto de Milla'),
  ('Árabe'),
  ('Warmblood'),
  ('Percherón'),
  ('Appaloosa'),
  ('Frisón'),
  ('Sin raza definida');

INSERT INTO cat_pelaje (nombre) VALUES
  ('Zaino'),
  ('Tordillo'),
  ('Alazán'),
  ('Bayo'),
  ('Overo'),
  ('Tobiano'),
  ('Picazo'),
  ('Rodado'),
  ('Rosillo'),
  ('Moro'),
  ('Palomino');

INSERT INTO cat_parte_cuerpo (nombre) VALUES
  -- Cabeza y cuello
  ('Cabeza'),
  ('Cuello'),
  -- Tronco
  ('Lomo'),
  ('Grupa'),
  ('Cola'),
  ('Pecho'),
  ('Abdomen'),
  -- Miembro anterior derecho
  ('Hombro derecho'),
  ('Brazo derecho'),
  ('Antebrazo derecho'),
  ('Rodilla delantera derecha'),
  ('Caña delantera derecha'),
  ('Menudillo delantero derecho'),
  ('Cuartilla delantera derecha'),
  ('Casco delantero derecho'),
  -- Miembro anterior izquierdo
  ('Hombro izquierdo'),
  ('Brazo izquierdo'),
  ('Antebrazo izquierdo'),
  ('Rodilla delantera izquierda'),
  ('Caña delantera izquierda'),
  ('Menudillo delantero izquierdo'),
  ('Cuartilla delantera izquierda'),
  ('Casco delantero izquierdo'),
  -- Miembro posterior derecho
  ('Anca derecha'),
  ('Muslo derecho'),
  ('Corvejón derecho'),
  ('Caña trasera derecha'),
  ('Menudillo trasero derecho'),
  ('Cuartilla trasera derecha'),
  ('Casco trasero derecho'),
  -- Miembro posterior izquierdo
  ('Anca izquierda'),
  ('Muslo izquierdo'),
  ('Corvejón izquierdo'),
  ('Caña trasera izquierda'),
  ('Menudillo trasero izquierdo'),
  ('Cuartilla trasera izquierda'),
  ('Casco trasero izquierdo');
