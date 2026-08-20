-- =============================================================================
-- Editar y eliminar lo que está programado y todavía no se hizo
--
-- Hasta acá, una consulta agendada por error o un plan sanitario mal cargado no
-- se podían sacar del calendario: `historial_clinico` no tenía policy de DELETE
-- (ninguna fila se borraba nunca) y la de `trabajo_sanitario` solo alcanzaba al
-- admin de la sociedad, al superadmin y al vet dueño — el veterinario que
-- programa un plan sobre caballos de una empresa quedaba afuera de su propio
-- plan.
--
-- La inmutabilidad del historial clínico se mantiene intacta: solo se puede
-- borrar lo que está en `estado = 'pendiente'`, es decir lo agendado que nunca
-- ocurrió. Una consulta ya realizada sigue sin tener forma de borrarse.
-- =============================================================================

-- ── historial_clinico: borrar una consulta agendada, nunca una realizada ─────
DROP POLICY IF EXISTS historial_clinico_delete ON historial_clinico;

CREATE POLICY historial_clinico_delete ON historial_clinico
  FOR DELETE TO authenticated
  USING (creado_por = auth.uid() AND estado = 'pendiente');

-- ── trabajo_sanitario: el autor puede borrar su plan mientras siga pendiente ──
DROP POLICY IF EXISTS trabajo_sanitario_delete ON trabajo_sanitario;

CREATE POLICY trabajo_sanitario_delete ON trabajo_sanitario
  FOR DELETE
  USING (
    es_admin(sociedad_id)
    OR is_superadmin()
    OR vet_owner_id = auth.uid()
    OR (creado_por = auth.uid() AND estado = 'pendiente')
  );
