import { getSupabaseClient } from '../lib/supabase'

const BUCKET = 'fichas-historicas'

export interface FichaHistorica {
  id: string
  path: string
  caballo_id: string
  caballo_nombre: string
  sociedad_id: string
  fecha: string  // ISO datetime
}

export const fichaHistoricaService = {
  /** Guarda el HTML de la ficha en Storage antes de la transferencia. */
  async guardar(opts: {
    caballoId: string
    sociedadId: string
    html: string
  }): Promise<void> {
    const { caballoId, sociedadId, html } = opts

    const timestamp = Date.now()
    const path = `${sociedadId}/${caballoId}/${timestamp}.html`
    const blob = new Blob([html], { type: 'text/html; charset=utf-8' })
    const file = new File([blob], `${timestamp}.html`, { type: 'text/html; charset=utf-8' })

    const supabase = getSupabaseClient()
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { cacheControl: '31536000' })
    if (error) throw new Error(error.message)
  },

  /** Lista las fichas históricas de una sociedad, más recientes primero. */
  async listar(sociedadId: string): Promise<FichaHistorica[]> {
    const supabase = getSupabaseClient()

    // Listar carpetas (caballoId) dentro de sociedadId
    const { data: folders, error: e1 } = await supabase.storage
      .from(BUCKET)
      .list(sociedadId, { limit: 200, sortBy: { column: 'name', order: 'asc' } })
    if (e1) throw new Error(e1.message)

    const fichas: FichaHistorica[] = []
    for (const folder of folders ?? []) {
      const { data: files, error: e2 } = await supabase.storage
        .from(BUCKET)
        .list(`${sociedadId}/${folder.name}`, { limit: 50, sortBy: { column: 'created_at', order: 'desc' } })
      if (e2) continue

      for (const file of files ?? []) {
        const ts = parseInt(file.name.replace('.html', ''), 10)
        fichas.push({
          id: file.id ?? `${folder.name}-${file.name}`,
          path: `${sociedadId}/${folder.name}/${file.name}`,
          caballo_id: folder.name,
          caballo_nombre: folder.name,  // el llamador puede resolver el nombre
          sociedad_id: sociedadId,
          fecha: isNaN(ts) ? (file.created_at ?? '') : new Date(ts).toISOString(),
        })
      }
    }

    return fichas.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
  },

  /** Abre la ficha en una nueva pestaña (imprimible / descargable). */
  async abrir(ficha: FichaHistorica): Promise<void> {
    const base = import.meta.env.VITE_SUPABASE_URL
    if (!base) return
    window.open(`${base}/storage/v1/object/public/${BUCKET}/${ficha.path}`, '_blank')
  },

  /** Elimina una ficha (solo admin). */
  async eliminar(ficha: FichaHistorica): Promise<void> {
    const supabase = getSupabaseClient()
    await supabase.storage.from(BUCKET).remove([ficha.path])
  },
}
