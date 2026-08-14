-- Campos propios de un veterinario: permiten agrupar los caballos que el vet
-- tiene sin sociedad (vet_owner_id). Un campo pertenece a una sociedad O a un
-- veterinario, nunca a ambos.

ALTER TABLE campo ALTER COLUMN sociedad_id DROP NOT NULL;

ALTER TABLE campo ADD COLUMN IF NOT EXISTS vet_owner_id UUID REFERENCES usuario(id);

ALTER TABLE campo DROP CONSTRAINT IF EXISTS campo_duenio_check;
ALTER TABLE campo ADD CONSTRAINT campo_duenio_check CHECK (
  (sociedad_id IS NOT NULL AND vet_owner_id IS NULL)
  OR
  (sociedad_id IS NULL AND vet_owner_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_campo_vet_owner
  ON campo(vet_owner_id) WHERE vet_owner_id IS NOT NULL;

-- ── RLS ────────────────────────────────────────────────────────────────────
-- La policy vieja dejaba a cualquier vet activo leer todos los campos. Ahora
-- se acota a los campos de sociedad, para que un vet no vea los de otro vet.
DROP POLICY IF EXISTS campo_select_vet ON campo;
CREATE POLICY campo_select_vet ON campo FOR SELECT USING (
  vet_owner_id IS NULL
  AND EXISTS (
    SELECT 1 FROM usuario u
    WHERE u.id = auth.uid() AND u.rol = 'veterinario' AND u.activo = TRUE
  )
);

DROP POLICY IF EXISTS campo_select_vet_propio ON campo;
CREATE POLICY campo_select_vet_propio ON campo FOR SELECT
  USING (vet_owner_id = auth.uid());

DROP POLICY IF EXISTS campo_insert_vet ON campo;
CREATE POLICY campo_insert_vet ON campo FOR INSERT WITH CHECK (
  vet_owner_id = auth.uid()
  AND sociedad_id IS NULL
  AND EXISTS (
    SELECT 1 FROM usuario u
    WHERE u.id = auth.uid() AND u.rol = 'veterinario' AND u.activo = TRUE
  )
);

DROP POLICY IF EXISTS campo_update_vet ON campo;
CREATE POLICY campo_update_vet ON campo FOR UPDATE
  USING (vet_owner_id = auth.uid())
  WITH CHECK (vet_owner_id = auth.uid() AND sociedad_id IS NULL);

DROP POLICY IF EXISTS campo_delete_vet ON campo;
CREATE POLICY campo_delete_vet ON campo FOR DELETE
  USING (vet_owner_id = auth.uid());
