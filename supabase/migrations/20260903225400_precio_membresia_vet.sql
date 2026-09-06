-- Precio definitivo de la membresía del veterinario: $10.000 ARS por mes.
--
-- Hasta hoy la fila activa tenía $100, el monto con el que se probó el cobro
-- real en MercadoPago (Fase 2). Queda acá y no solo aplicado a mano para que el
-- valor vigente esté en el repo y no haya que ir a mirar la base para saberlo.
--
-- El precio se sigue pudiendo cambiar con un UPDATE, sin deploy y sin migración:
-- el checkout lee siempre la fila `activo = true`. Esta migración es el registro
-- de cuál es el precio de arranque, no un candado.
--
-- No afecta a las suscripciones ya autorizadas: MercadoPago sigue cobrando el
-- monto con el que se creó cada preapproval. Al momento de aplicarla ninguna de
-- las suscripciones activas tenía preapproval (todas se activaron a mano).

UPDATE plan_suscripcion_vet
   SET precio = 10000.00
 WHERE codigo = 'mensual';
