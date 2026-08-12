import { useEffect, useState } from 'react'
import { Archive, RotateCcw, ChevronDown, ChevronUp, Lock } from 'lucide-react'
import {
  vetLimiteService,
  type CaballoInactivoVet,
  type EstadoLimiteVet,
} from '../../services/vetLimiteService'
import { mensajeError } from '../../utils/error'

interface Props {
  /** Se llama tras reactivar, para que el panel refresque sus contadores. */
  onCambio?: () => void
}

function formatFecha(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()}`
}

/**
 * Caballos propios dados de baja, con opción de reactivarlos.
 *
 * Existe porque el modal de regularización del límite freemium le promete al
 * vet que las bajas son recuperables — sin esta vista esa promesa era falsa:
 * el caballo desaparecía de todos los listados (`get_caballos_veterinario`
 * filtra `activo = true`) y solo se recuperaba a mano desde la base.
 *
 * No se renderiza nada si el vet no tiene caballos dados de baja.
 */
export default function CaballosDadosDeBajaVet({ onCambio }: Props) {
  const [caballos,   setCaballos]   = useState<CaballoInactivoVet[]>([])
  const [estado,     setEstado]     = useState<EstadoLimiteVet | null>(null)
  const [seleccion,  setSeleccion]  = useState<Set<string>>(new Set())
  // Arranca abierta: solo se renderiza si hay caballos dados de baja, y el vet
  // que acaba de regularizar el límite viene justamente a buscarlos. Plegada
  // por defecto era un encabezado finito muy fácil de pasar por alto.
  const [abierto,    setAbierto]    = useState(true)
  const [cargando,   setCargando]   = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [error,      setError]      = useState('')

  async function cargar() {
    setCargando(true)
    setError('')
    try {
      const [lista, est] = await Promise.all([
        vetLimiteService.listarInactivos(),
        vetLimiteService.estado(),
      ])
      setCaballos(lista)
      setEstado(est)
      setSeleccion(new Set())
    } catch (e) {
      setError(mensajeError(e, 'No se pudieron cargar los caballos dados de baja.'))
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  if (cargando) return null

  // Si la carga falló hay que decirlo: devolver null dejaría al vet creyendo
  // que no tiene caballos dados de baja cuando en realidad no se pudieron leer.
  if (error && caballos.length === 0) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
        <p className="text-xs text-rose-700">{error}</p>
        <button
          onClick={cargar}
          className="mt-2 text-xs font-semibold text-rose-700 underline underline-offset-2 hover:text-rose-800"
        >
          Reintentar
        </button>
      </div>
    )
  }

  if (caballos.length === 0) return null

  // Reactivar vuelve a llenar el cupo del límite que le aplica al vet — el del
  // plan gratuito o el de la membresía. El backend rechaza si se pasa; acá se
  // muestra antes para que no sea un error sorpresa después de seleccionar.
  const cupo = Math.max((estado?.limite ?? 0) - (estado?.caballos_propios ?? 0), 0)

  const excede = seleccion.size > cupo
  const puedeReactivar = seleccion.size > 0 && !excede && !procesando

  function toggle(id: string) {
    setSeleccion((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function reactivar() {
    if (!puedeReactivar) return
    setError('')
    setProcesando(true)
    try {
      await vetLimiteService.reactivarLote([...seleccion])
      await cargar()
      onCambio?.()
    } catch (e) {
      setError(mensajeError(e, 'No se pudieron reactivar los caballos.'))
    } finally {
      setProcesando(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Archive size={15} className="text-slate-400 shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Dados de baja
          </span>
          <span className="text-xs text-slate-400">({caballos.length})</span>
        </div>
        {abierto
          ? <ChevronUp size={14} className="text-slate-300 shrink-0" />
          : <ChevronDown size={14} className="text-slate-300 shrink-0" />}
      </button>

      {abierto && (
        <>
          {cupo === 0 ? (
            <div className="flex items-start gap-2 px-4 py-3 bg-amber-50 border-b border-amber-100">
              <Lock size={13} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                {estado?.suscripcion_activa
                  ? <>Ya estás usando los {estado?.limite} caballos que incluye tu membresía. Para
                      reactivar alguno, primero dá de baja otro.</>
                  : <>Ya estás usando los {estado?.limite} caballos del plan gratuito. Para reactivar
                      alguno, primero dá de baja otro o activá tu membresía.</>}
              </p>
            </div>
          ) : (
            <p className="px-4 py-2 text-[11px] text-slate-400 border-b border-slate-100">
              {`Podés reactivar hasta ${cupo} ${cupo === 1 ? 'caballo' : 'caballos'} `}
              {estado?.suscripcion_activa ? 'con tu membresía.' : 'con el plan gratuito.'}
            </p>
          )}

          <div className="divide-y divide-slate-100">
            {caballos.map((c) => {
              const marcado = seleccion.has(c.id)
              const bloqueado = cupo === 0 && !marcado
              return (
                <label
                  key={c.id}
                  className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                    bloqueado ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-50'
                  } ${marcado ? 'bg-brand-50/50' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={marcado}
                    disabled={bloqueado}
                    onChange={() => toggle(c.id)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500/40 disabled:cursor-not-allowed"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{c.nombre}</p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {[c.categoria, c.raza_nombre].filter(Boolean).join(' · ') || 'Sin datos'}
                      {' · baja '}{formatFecha(c.fecha_baja)}
                      {c.consultas > 0 && ` · ${c.consultas} ${c.consultas === 1 ? 'consulta' : 'consultas'}`}
                    </p>
                  </div>
                </label>
              )
            })}
          </div>

          <div className="px-4 py-3 border-t border-slate-100 space-y-2">
            {error && <p className="text-xs text-rose-600">{error}</p>}
            {excede && (
              <p className="text-xs text-amber-700">
                Seleccionaste {seleccion.size} y solo podés reactivar {cupo}.
              </p>
            )}
            <button
              onClick={reactivar}
              disabled={!puedeReactivar}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white transition
                hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              <RotateCcw size={14} />
              {procesando
                ? 'Reactivando…'
                : `Reactivar ${seleccion.size > 0 ? `(${seleccion.size})` : ''}`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
