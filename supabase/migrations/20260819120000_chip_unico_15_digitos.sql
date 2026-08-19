-- Chip identificatorio del caballo: formato fijo y único.
--
-- Los chips que se implantan son transpondedores ISO 11784/11785 (los que usa
-- el haras son Datamars Animal iD, prefijo 981). Su número es siempre de 15
-- dígitos y es único en el mundo: no puede repetirse entre dos animales.
-- Hasta ahora `numero_chip` era texto libre sin restricciones.
--
-- Datos previos: los únicos chips cargados eran los de las sociedades demo,
-- secuencias de 9 dígitos (982000101…). Se los completa a 15 dígitos
-- rellenando con ceros después del prefijo del fabricante, para que sigan
-- siendo válidos y distintos entre sí. Sol de Agosto no tenía ninguno cargado.

-- 1) Normalizar lo que ya está: solo dígitos.
UPDATE public.caballo
SET numero_chip = regexp_replace(numero_chip, '\D', '', 'g')
WHERE numero_chip IS NOT NULL;

-- 2) Completar a 15 dígitos los que quedaron cortos (prefijo + relleno).
UPDATE public.caballo
SET numero_chip = substr(numero_chip, 1, 3) || lpad(substr(numero_chip, 4), 12, '0')
WHERE numero_chip IS NOT NULL
  AND length(numero_chip) BETWEEN 4 AND 14;

-- 3) Lo que aun así no sea un chip válido no es un chip: se descarta.
UPDATE public.caballo
SET numero_chip = NULL
WHERE numero_chip IS NOT NULL
  AND numero_chip !~ '^\d{15}$';

-- 4) Formato obligatorio de acá en más.
ALTER TABLE public.caballo
  ADD CONSTRAINT caballo_numero_chip_formato_check
  CHECK (numero_chip IS NULL OR numero_chip ~ '^\d{15}$');

-- 5) Un chip, un caballo. El índice es parcial: los animales sin chip no se
--    pisan entre sí.
CREATE UNIQUE INDEX caballo_numero_chip_uniq
  ON public.caballo (numero_chip)
  WHERE numero_chip IS NOT NULL;

COMMENT ON COLUMN public.caballo.numero_chip IS
  'Chip ISO 11784/11785: 15 dígitos, único por animal. NULL si el caballo todavía no fue chipeado.';
