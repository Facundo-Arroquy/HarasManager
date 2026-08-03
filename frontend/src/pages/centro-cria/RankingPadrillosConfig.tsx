import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Check, Plus, Trophy, X, AlertCircle } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { crianzaService } from '../../services/crianzaService'
import { mensajeError } from '../../utils/error'
import { MAX_PADRILLOS_RANKING } from '../../types/crianza'

// =============================================================================
// Ranking de padrillos preferidos por donante — migración 20260802120200
// =============================================================================
// Definición de Gero (2026-08-02): admin y veterinario arman, para cada donante,
// una lista de hasta 10 padrillos ordenada por prioridad (1 = más recomendado).
// La lista es del establecimiento; el vet solo ve las donantes y los padrillos
// a los que el admin le dio acceso.
// =============================================================================

interface Animal {
  id:               string
  nombre:           string
  categoria:        string
  rol_reproductivo: string | null
}

export default function RankingPadrillosConfig() {
  const { sociedadActiva, rol } = useAuth()

  const [animales, setAnimales] = useState<Animal[]>([])
  const [cargando, setCargando] = useState(true)
  const [donanteId, setDonanteId] = useState('')
  const [orden, setOrden] = useState<string[]>([])
  const [aAgregar, setAAgregar] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const promesa = sociedadActiva
      ? crianzaService.listarAnimalesReproductivos(sociedadActiva.id)
      : rol === 'veterinario'
        ? crianzaService.listarAnimalesReproductivosVet()
        : Promise.resolve([])

    promesa
      .then((data) => setAnimales(data as Animal[]))
      .catch((e) => setError(mensajeError(e)))
      .finally(() => setCargando(false))
  }, [sociedadActiva, rol])

  const donantes = useMemo(
    () => animales.filter((a) => a.rol_reproductivo === 'Donante'),
    [animales],
  )
  const padrillos = useMemo(
    () => animales.filter((a) => a.categoria === 'Padrillo'),
    [animales],
  )
  const nombrePorId = useMemo(
    () => new Map(animales.map((a) => [a.id, a.nombre])),
    [animales],
  )

  const cargarRanking = useCallback(async (id: string) => {
    if (!id) return setOrden([])
    try {
      const filas = await crianzaService.listarRankingPadrillos(id)
      setOrden(filas.map((f) => f.padrillo_id))
    } catch (e) {
      setError(mensajeError(e))
    }
  }, [])

  useEffect(() => { cargarRanking(donanteId) }, [donanteId, cargarRanking])

  const disponibles = padrillos.filter((p) => !orden.includes(p.id))
  const lleno = orden.length >= MAX_PADRILLOS_RANKING

  function mover(indice: number, delta: number) {
    const destino = indice + delta
    if (destino < 0 || destino >= orden.length) return
    const copia = [...orden]
    ;[copia[indice], copia[destino]] = [copia[destino], copia[indice]]
    setOrden(copia)
    setGuardado(false)
  }

  function quitar(id: string) {
    setOrden((o) => o.filter((x) => x !== id))
    setGuardado(false)
  }

  function agregar() {
    if (!aAgregar || lleno || orden.includes(aAgregar)) return
    setOrden((o) => [...o, aAgregar])
    setAAgregar('')
    setGuardado(false)
  }

  async function guardar() {
    if (!donanteId) return
    setError('')
    setGuardando(true)
    try {
      await crianzaService.guardarRankingPadrillos(donanteId, orden)
      // Releemos de la DB: lo que queda en pantalla es lo que quedó guardado.
      await cargarRanking(donanteId)
      setGuardado(true)
    } catch (err) {
      setError(mensajeError(err, 'No se pudo guardar el ranking.'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 text-xs font-medium text-slate-500 uppercase tracking-wider">
        <Trophy size={14} />
        Ranking de padrillos por donante
      </div>

      <div className="p-4 space-y-3">
        <p className="text-xs text-slate-400">
          Hasta {MAX_PADRILLOS_RANKING} padrillos por donante, ordenados por
          prioridad: el #1 es el más recomendado. Aparecen primero al elegir
          padrillo en la inseminación.
        </p>

        {cargando ? (
          <p className="text-xs text-slate-400">Cargando…</p>
        ) : donantes.length === 0 ? (
          <p className="text-xs text-slate-500 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-3">
            No hay donantes cargadas todavía.
          </p>
        ) : (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Donante</label>
              <select
                value={donanteId}
                onChange={(e) => { setDonanteId(e.target.value); setGuardado(false) }}
                className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">— Elegí una donante —</option>
                {donantes.map((d) => (
                  <option key={d.id} value={d.id}>{d.nombre}</option>
                ))}
              </select>
            </div>

            {donanteId && (
              <>
                {orden.length === 0 ? (
                  <p className="text-xs text-slate-500 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-3">
                    Esta donante todavía no tiene padrillos rankeados.
                  </p>
                ) : (
                  <ol className="divide-y divide-slate-100 rounded-md border border-slate-200">
                    {orden.map((id, i) => (
                      <li key={id} className="flex items-center gap-2 px-3 py-2">
                        <span className="w-6 shrink-0 rounded bg-brand-100 px-1.5 py-0.5 text-center text-[10px] font-semibold text-brand-700">
                          #{i + 1}
                        </span>
                        <span className="flex-1 truncate text-sm text-slate-700">
                          {nombrePorId.get(id) ?? 'Padrillo sin acceso'}
                        </span>
                        <button
                          type="button"
                          onClick={() => mover(i, -1)}
                          disabled={i === 0}
                          title="Subir prioridad"
                          className="text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:hover:text-slate-400"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => mover(i, 1)}
                          disabled={i === orden.length - 1}
                          title="Bajar prioridad"
                          className="text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:hover:text-slate-400"
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => quitar(id)}
                          title="Sacar del ranking"
                          className="text-slate-400 hover:text-red-600"
                        >
                          <X size={14} />
                        </button>
                      </li>
                    ))}
                  </ol>
                )}

                <div className="flex items-center gap-2">
                  <select
                    value={aAgregar}
                    onChange={(e) => setAAgregar(e.target.value)}
                    disabled={lleno || disponibles.length === 0}
                    className="flex-1 rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
                  >
                    <option value="">
                      {lleno
                        ? `Máximo ${MAX_PADRILLOS_RANKING} padrillos`
                        : disponibles.length === 0
                          ? 'No quedan padrillos para sumar'
                          : '— Agregar padrillo —'}
                    </option>
                    {disponibles.map((p) => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={agregar}
                    disabled={!aAgregar || lleno}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-600 transition-colors disabled:opacity-40"
                  >
                    <Plus size={13} />
                    Sumar
                  </button>
                </div>

                <button
                  type="button"
                  onClick={guardar}
                  disabled={guardando}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-brand-500 hover:bg-brand-400 text-sm font-medium text-white transition-colors disabled:opacity-50"
                >
                  {guardado ? <Check size={14} /> : null}
                  {guardando ? 'Guardando…' : guardado ? 'Guardado' : 'Guardar ranking'}
                </button>
              </>
            )}
          </>
        )}

        {error && (
          <p className="flex items-center gap-1.5 text-xs text-red-600">
            <AlertCircle size={12} />
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
