import { useEffect, useMemo, useState } from 'react'
import { X, AlertCircle, Snowflake } from 'lucide-react'
import { useEscapeClose } from '../../hooks/useEscapeClose'
import { useSaveHandler } from '../../hooks/useSaveHandler'
import { useAuth } from '../../hooks/useAuth'
import { crianzaService } from '../../services/crianzaService'
import {
  ESTADIOS_EMBRION as ESTADIOS,
  TAMANIOS_EMBRION as TAMANIOS,
  GRADOS_EMBRION as GRADOS,
  ZONAS_EMBRION as ZONAS,
} from '../../types/crianza'
import type { NuevoEmbrionPayload, RolReproductivo } from '../../types/crianza'

interface Props {
  onClose:   () => void
  onSuccess: () => void
}

type AnimalItem = {
  id:               string
  nombre:           string
  categoria:        string
  rol_reproductivo: RolReproductivo
  /** Solo viene en el listado del vet, que cruza sociedades. */
  sociedad_id?:     string | null
}

const MAX_EMBRIONES = 20

const SELECT_CLS = 'w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60'

/**
 * Alta manual de embriones vitrificados que no salen de un flushing cargado en
 * el sistema (stock previo, comprado o de otro centro). Nacen en 'congelado'
 * y quedan en Embriones para transferirlos como cualquier otro.
 */
export default function EmbrionVitrificadoModal({ onClose, onSuccess }: Props) {
  const { user, sociedadActiva } = useAuth()

  const [animales, setAnimales] = useState<AnimalItem[]>([])
  const [cargando, setCargando] = useState(true)

  const [donanteId,     setDonanteId]     = useState('')
  const [padrilloId,    setPadrilloId]    = useState('')
  const [padrilloTexto, setPadrilloTexto] = useState('')
  const [cantidad,      setCantidad]      = useState(1)
  const [tamanio,       setTamanio]       = useState('')
  const [estadio,       setEstadio]       = useState('')
  const [grado,         setGrado]         = useState<1 | 2 | 3 | 4 | ''>('')
  const [zona,          setZona]          = useState('')
  const [notas,         setNotas]         = useState('')

  const { saving, error, setError, execute } = useSaveHandler('No se pudo guardar el embrión.')

  useEscapeClose(onClose)

  // El admin trabaja sobre su sociedad; el vet no tiene sociedad activa y ve
  // los caballos de todas las sociedades a las que tiene acceso.
  useEffect(() => {
    const promesa: Promise<AnimalItem[]> = sociedadActiva?.id
      ? crianzaService.listarAnimalesReproductivos(sociedadActiva.id)
      : crianzaService.listarAnimalesReproductivosVet()
    promesa
      .then(setAnimales)
      .catch(() => setError('No se pudieron cargar los caballos.'))
      .finally(() => setCargando(false))
  }, [sociedadActiva?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const donantes  = useMemo(() => animales.filter((a) => a.rol_reproductivo === 'Donante'), [animales])
  const padrillos = useMemo(() => animales.filter((a) => a.categoria === 'Padrillo'), [animales])

  async function guardar() {
    if (!donanteId) return setError('Seleccioná la donante.')
    if (!user?.id) return
    const donante = animales.find((a) => a.id === donanteId)
    const sociedadId = sociedadActiva?.id ?? donante?.sociedad_id
    if (!sociedadId) return setError('La donante no pertenece a ninguna empresa.')

    const notaPadrillo = padrilloTexto.trim() && !padrilloId ? `Padrillo: ${padrilloTexto.trim()}` : null
    const notasFinales = [notas.trim(), notaPadrillo].filter(Boolean).join(' | ') || null

    const payload: NuevoEmbrionPayload = {
      flushing_id:        null,
      creado_por:         user.id,
      caballo_donante_id: donanteId,
      sociedad_id:        sociedadId,
      padrillo_id:        padrilloId || null,
      estadio:            estadio || null,
      grado:              grado !== '' ? grado : null,
      tamanio:            tamanio || null,
      zona_pelucida:      zona || null,
      estado:             'congelado',
      notas:              notasFinales,
    }

    await execute(async () => {
      await crianzaService.crearEmbriones(Array.from({ length: cantidad }, () => payload))
      onSuccess()
      onClose()
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg sm:mx-4 rounded-t-2xl sm:rounded-xl border border-slate-300 bg-white shadow-2xl max-h-[90vh] flex flex-col">

        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <Snowflake size={16} className="text-cyan-600" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Cargar embrión vitrificado</h2>
              <p className="text-xs text-slate-500 mt-0.5">Stock que no sale de un flushing cargado en el sistema</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-xs font-medium text-slate-500">Donante *</label>
              <select
                value={donanteId}
                onChange={(e) => setDonanteId(e.target.value)}
                disabled={cargando}
                className={SELECT_CLS}
              >
                <option value="">— Seleccioná —</option>
                {donantes.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
              </select>
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-xs font-medium text-slate-500">Cantidad *</label>
              <input
                type="number"
                min={1}
                max={MAX_EMBRIONES}
                value={cantidad}
                onChange={(e) => setCantidad(Math.max(1, Math.min(MAX_EMBRIONES, Number(e.target.value) || 1)))}
                className={SELECT_CLS}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Padrillo</label>
            <select
              value={padrilloId}
              onChange={(e) => {
                setPadrilloId(e.target.value)
                if (e.target.value) setPadrilloTexto('')
              }}
              disabled={cargando}
              className={SELECT_CLS}
            >
              <option value="">— Sin especificar —</option>
              {padrillos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
            {!padrilloId && (
              <input
                type="text"
                value={padrilloTexto}
                onChange={(e) => setPadrilloTexto(e.target.value)}
                placeholder="O escribí el nombre si no está en la lista"
                className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
              Tamaño y estado{cantidad > 1 ? ' (se aplica a todos)' : ''}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <select value={tamanio} onChange={(e) => setTamanio(e.target.value)} className={SELECT_CLS}>
                <option value="">Tamaño —</option>
                {TAMANIOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={estadio} onChange={(e) => setEstadio(e.target.value)} className={SELECT_CLS}>
                <option value="">Estadio —</option>
                {ESTADIOS.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
              <select
                value={grado}
                onChange={(e) => setGrado(e.target.value === '' ? '' : Number(e.target.value) as 1 | 2 | 3 | 4)}
                className={SELECT_CLS}
              >
                <option value="">Grado —</option>
                {GRADOS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              <select value={zona} onChange={(e) => setZona(e.target.value)} className={SELECT_CLS}>
                <option value="">Zona pel. —</option>
                {ZONAS.map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Notas</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Origen, pajuela, tanque…"
              className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 text-xs text-red-600">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={guardar}
            disabled={saving || cargando}
            className="px-4 py-2 text-sm font-medium rounded-md bg-brand-500 hover:bg-brand-400 text-white transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando…' : cantidad > 1 ? `Guardar ${cantidad} embriones` : 'Guardar embrión'}
          </button>
        </div>
      </div>
    </div>
  )
}
