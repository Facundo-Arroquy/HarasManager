-- Datos propios de cada embrión para trazabilidad del stock.
-- La fecha se copia del flushing al crear nuevos embriones. Para los registros
-- históricos originados en un flushing se completa desde esa fuente confiable;
-- los vitrificados manuales antiguos quedan NULL porque no conocemos la fecha.

alter table public.embrion
  add column fecha_extraccion date,
  add column lugar_almacenamiento text;

update public.embrion e
   set fecha_extraccion = f.fecha
  from public.cria_flushing f
 where f.id = e.flushing_id
   and e.fecha_extraccion is null;

comment on column public.embrion.fecha_extraccion is
  'Fecha exacta en que se extrajo el embrión; coincide con la fecha del flushing cuando existe.';

comment on column public.embrion.lugar_almacenamiento is
  'Texto libre que identifica dónde se conserva o a dónde se envió el embrión.';
