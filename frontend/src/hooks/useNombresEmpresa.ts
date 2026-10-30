import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { empresaService } from '../services/empresaService'

interface NombresEmpresa {
  /** `sociedad_id` → nombre de las empresas que el usuario puede leer. */
  nombres: ReadonlyMap<string, string>
  /** `false` mientras se pide la lista: ahí un nombre ausente todavía no significa "ilegible". */
  listos: boolean
}

/**
 * Nombres de las empresas visibles, para rotular datos que traen solo un
 * `sociedad_id`.
 *
 * - Con empresa activa se usa el nombre que ya está en el store: es la única
 *   empresa que se consulta en ese modo y no hace falta ir al RPC.
 * - Sin empresa activa (veterinario global) se pide una sola vez
 *   `get_empresas_visibles()`. Si falla, `listos` pasa a `true` con el mapa
 *   vacío: lo que se rotula con esos nombres cae en "Otra empresa" en vez de
 *   romper la pantalla.
 */
export function useNombresEmpresa(): NombresEmpresa {
  const sociedadId     = useAuthStore((s) => s.sociedadActiva?.id)
  const sociedadNombre = useAuthStore((s) => s.sociedadActiva?.nombre)
  const [visibles, setVisibles] = useState<ReadonlyMap<string, string> | null>(null)

  useEffect(() => {
    if (sociedadId) return
    let vigente = true
    empresaService.mapaNombres()
      .catch(() => new Map<string, string>())
      .then((mapa) => { if (vigente) setVisibles(mapa) })
    return () => { vigente = false }
  }, [sociedadId])

  return useMemo(() => {
    if (sociedadId) {
      return { nombres: new Map([[sociedadId, sociedadNombre ?? '']]), listos: true }
    }
    return { nombres: visibles ?? new Map<string, string>(), listos: visibles !== null }
  }, [sociedadId, sociedadNombre, visibles])
}
