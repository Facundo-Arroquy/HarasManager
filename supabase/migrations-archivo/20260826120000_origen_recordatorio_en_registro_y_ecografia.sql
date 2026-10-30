-- Qué resolvió cada recordatorio.
--
-- `cria_flushing` ya guardaba `origen_recordatorio_id`, así que desde un
-- recordatorio de Flushing se podía llegar al flushing que lo cerró. Los otros
-- dos caminos —hacerlo como registro clínico, o cargar la ecografía que pedía
-- un 'Eco 1/2/3'— no dejaban rastro: el recordatorio quedaba 'hecho' y no había
-- forma de saber qué se registró. Esto lo completa, con el mismo nombre de
-- columna y la misma FK que ya usa el flushing.

ALTER TABLE public.cria_registro_clinico
  ADD COLUMN IF NOT EXISTS origen_recordatorio_id UUID
    REFERENCES public.cria_recordatorio(id) ON DELETE SET NULL;

ALTER TABLE public.cria_ecografia
  ADD COLUMN IF NOT EXISTS origen_recordatorio_id UUID
    REFERENCES public.cria_recordatorio(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.cria_registro_clinico.origen_recordatorio_id IS
  'Recordatorio que este registro resolvió, si se cargó tocándolo desde el calendario o la lista de recordatorios. NULL en un registro suelto.';

COMMENT ON COLUMN public.cria_ecografia.origen_recordatorio_id IS
  'Recordatorio Eco 1/2/3 que esta ecografía resolvió, si se cargó desde él. NULL si se cargó a mano desde Transferencias.';

-- Parciales: la enorme mayoría de las filas no viene de un recordatorio, y la
-- única lectura es "qué resolvió a este recordatorio".
CREATE INDEX IF NOT EXISTS idx_cria_registro_clinico_origen_recordatorio
  ON public.cria_registro_clinico(origen_recordatorio_id)
  WHERE origen_recordatorio_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cria_ecografia_origen_recordatorio
  ON public.cria_ecografia(origen_recordatorio_id)
  WHERE origen_recordatorio_id IS NOT NULL;
