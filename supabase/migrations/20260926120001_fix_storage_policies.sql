-- Fix crítico de seguridad: los buckets "caballos" y "fichas-historicas" eran
-- públicos y sin aislamiento multi-tenant. Cualquier autenticado podía borrar
-- fotos de cualquier caballo y las URLs eran predecibles.
--
-- Cambios:
-- 1. Hacer ambos buckets privados (requiere signed URLs en el frontend)
-- 2. Bucket "caballos": política DELETE verifica membresía en la sociedad del caballo
-- 3. Bucket "caballos": política SELECT solo para authenticated (ya no public)
-- 4. Bucket "fichas-historicas": reemplazar ALL por SELECT/INSERT/DELETE granulares
--    con verificación de membresía en la sociedad

-- ============================================================
-- 1. Hacer buckets privados
-- ============================================================
UPDATE storage.buckets SET public = false WHERE id = 'caballos';
UPDATE storage.buckets SET public = false WHERE id = 'fichas-historicas';

-- ============================================================
-- 2. Bucket "caballos" — arreglar políticas
-- ============================================================

-- 2a. DROP la política DELETE abierta
DROP POLICY IF EXISTS "Eliminar fotos de caballos" ON storage.objects;

-- 2b. Nueva política DELETE: solo si el usuario pertenece a la sociedad del caballo
-- El nombre del objeto en este bucket es directamente el UUID del caballo
CREATE POLICY "Eliminar fotos de caballos con aislamiento"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'caballos'
    AND EXISTS (
      SELECT 1
      FROM caballo c
      JOIN membresia m ON m.sociedad_id = c.sociedad_id
      WHERE c.id = (storage.filename(name))::uuid
        AND m.usuario_id = auth.uid()
        AND m.activa = true
    )
  );

-- 2c. DROP la política SELECT pública de imágenes de consultas
DROP POLICY IF EXISTS "imágenes de consultas son públicas" ON storage.objects;

-- 2d. Nueva política SELECT para fotos de caballos: solo authenticated
-- (las fotos se acceden via signed URL)
CREATE POLICY "Ver fotos de caballos autenticado"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'caballos'
    AND EXISTS (
      SELECT 1
      FROM caballo c
      JOIN membresia m ON m.sociedad_id = c.sociedad_id
      WHERE c.id = (storage.filename(name))::uuid
        AND m.usuario_id = auth.uid()
        AND m.activa = true
    )
  );

-- 2e. Política SELECT para fotos de caballos que maneja un vet (sin sociedad_id)
-- Los vets independientes tienen caballos con sociedad_id IS NULL y acceso_vet
CREATE POLICY "Ver fotos de caballos de vet"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'caballos'
    AND EXISTS (
      SELECT 1
      FROM caballo c
      JOIN acceso_vet av ON av.caballo_id = c.id
      WHERE c.id = (storage.filename(name))::uuid
        AND av.vet_id = auth.uid()
        AND av.activo = true
    )
  );

-- 2f. Política DELETE para fotos de caballos de vet independiente
CREATE POLICY "Eliminar fotos de caballos de vet"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'caballos'
    AND EXISTS (
      SELECT 1
      FROM caballo c
      JOIN acceso_vet av ON av.caballo_id = c.id
      WHERE c.id = (storage.filename(name))::uuid
        AND av.vet_id = auth.uid()
        AND av.activo = true
    )
  );

-- 2g. SELECT para imágenes de consultas (subcarpeta consultas/) — authenticated
CREATE POLICY "Ver imágenes de consultas autenticado"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'caballos'
    AND (storage.foldername(name))[1] = 'consultas'
  );

-- ============================================================
-- 3. Bucket "fichas-historicas" — reemplazar ALL por granulares
-- ============================================================

-- 3a. DROP la política ALL abierta
DROP POLICY IF EXISTS "Autenticados gestionan fichas" ON storage.objects;

-- 3b. SELECT: solo miembros de la sociedad (el path empieza con sociedad_id/)
CREATE POLICY "Ver fichas historicas con aislamiento"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'fichas-historicas'
    AND EXISTS (
      SELECT 1
      FROM membresia m
      WHERE m.sociedad_id = ((storage.foldername(name))[1])::uuid
        AND m.usuario_id = auth.uid()
        AND m.activa = true
    )
  );

-- 3c. INSERT: solo miembros de la sociedad
CREATE POLICY "Crear fichas historicas con aislamiento"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'fichas-historicas'
    AND EXISTS (
      SELECT 1
      FROM membresia m
      WHERE m.sociedad_id = ((storage.foldername(name))[1])::uuid
        AND m.usuario_id = auth.uid()
        AND m.activa = true
    )
  );

-- 3d. DELETE: solo miembros de la sociedad
CREATE POLICY "Eliminar fichas historicas con aislamiento"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'fichas-historicas'
    AND EXISTS (
      SELECT 1
      FROM membresia m
      WHERE m.sociedad_id = ((storage.foldername(name))[1])::uuid
        AND m.usuario_id = auth.uid()
        AND m.activa = true
    )
  );
