import { useEffect, useMemo, useState } from 'react'
import { X, AlertCircle, Droplets, Snowflake, Cloud, ArrowRight } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useCrianzaStore } from '../../store/crianzaStore'
import { crianzaService } from '../../services/crianzaService'
import { ESTADO_POR_DESTINO } from '../../types/crianza'
import type { RecordatorioCria, DestinoEmbrion, NuevoEmbrionPayload } from '../../types/crianza'
import { hoyAR, formatFecha } from '../../utils/fecha'
import { mensajeError } from '../../utils/error'
import { receptorasOvuladas } from '../../utils/receptoras'

interface Props {
  onClose: () => void
  onSuccess?: (flushingId: string) => void
  // Recordatorio "Flushing" que disparó este modal (opcional)
  recordatorio?: RecordatorioCria
  // Pre-seleccionar donante
  caballoIdInicial?: string
}

type AnimalItem = {
  id: string
  nombre: string
  categoria: string
  rol_reproductivo: 'Donante' | 'Receptora' | null
}

type PadrilloItem = {
  id: string
  nombre: string
  empresa: string | null
}

/** Un embrión recuperado, tal como se carga en el paso 1 y se destina en el 2. */
type EmbrionForm = {
  tamanio:       string
  estadio:       string
  grado:         1 | 2 | 3 | 4 | ''
  zona_pelucida: string
  destino:       DestinoEmbrion
  receptoraId:   string
}

const ESTADIOS = ['Mórula', 'Blastocisto temprano', 'Blastocisto', 'Blastocisto expandido'] as const
const TAMANIOS = ['Pequeño', 'Mediano', 'Grande'] as const
const GRADOS   = [1, 2, 3, 4] as const
const ZONAS    = ['Intacta', 'Rota'] as const

const MAX_EMBRIONES = 10

function embrionVacio(): EmbrionForm {
  return { tamanio: '', estadio: '', grado: '', zona_pelucida: '', destino: 'transferir', receptoraId: '' }
}

export default function FlushingModal({ onClose, onSuccess, recordatorio, caballoIdInicial }: Props) {
  const { user, sociedadActiva } = useAuth()
  const {
    crearFlushing, actualizarEstadoRecordatorio, registrarTransferencia,
    registros, transferencias,
  } = useCrianzaStore()

  const [animales,  setAnimales]  = useState<AnimalItem[]>([])
  const [padrillos, setPadrillos] = useState<PadrilloItem[]>([])
  const [cargando,  setCargando]  = useState(true)

  // Form — paso 1
  const [paso,          setPaso]          = useState<1 | 2>(1)
  const [caballoId,     setCaballoId]     = useState(caballoIdInicial ?? recordatorio?.caballo_id ?? '')
  const [fecha,         setFecha]         = useState(recordatorio?.fecha_vto ?? hoyAR())
  const [esNegativo,    setEsNegativo]    = useState(false)
  const [embriones,     setEmbriones]     = useState<EmbrionForm[]>([embrionVacio()])
  const [padrilloId,    setPadrilloId]    = useState('')
  const [padrilloTexto, setPadrilloTexto] = useState('')
  const [pgGiven,       setPgGiven]       = useState(false)
  const [notas,         setNotas]         = useState('')

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  // Para el rol 'veterinario', sociedadActiva es null (vet global sin sociedad fija).
  // En ese caso derivamos el sociedad_id del recordatorio o del caballoIdInicial.
  const efectivaSociedadId = sociedadActiva?.id ?? recordatorio?.sociedad_id ?? ''

  const donantes = animales.filter((a) => a.rol_reproductivo === 'Donante')

  // Receptoras ovuladas a la fecha del flushing, ordenadas por días desde la OV.
  const receptoras = useMemo(
    () => receptorasOvuladas(registros, transferencias, fecha),
    [registros, transferencias, fecha]
  )

  useEffect(() => {
    if (!efectivaSociedadId) return

    async function cargar() {
      try {
        const animalesData = await crianzaService.listarAnimalesReproductivos(efectivaSociedadId)
        setAnimales(animalesData as AnimalItem[])

        // Intentar cargar padrillos de todas las sociedades del vet
        try {
          const vetData = await crianzaService.listarAnimalesReproductivosVet()
          const vetPadrillos = (vetData as { id: string; nombre: string; categoria: string; marca?: { nombre: string } | null }[])
            .filter((a) => a.categoria === 'Padrillo')
          setPadrillos(vetPadrillos.length > 0
            ? vetPadrillos.map((a) => ({ id: a.id, nombre: a.nombre, empresa: a.marca?.nombre ?? null }))
            : (animalesData as AnimalItem[])
                .filter((a) => a.categoria === 'Padrillo')
                .map((a) => ({ id: a.id, nombre: a.nombre, empresa: null })))
        } catch {
          // Fallback: padrillos solo de la sociedad del recordatorio
          setPadrillos((animalesData as AnimalItem[])
            .filter((a) => a.categoria === 'Padrillo')
            .map((a) => ({ id: a.id, nombre: a.nombre, empresa: null })))
        }
      } finally {
        setCargando(false)
      }
    }

    cargar()
  }, [efectivaSociedadId])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // ── Edición de la lista de embriones ───────────────────────────────────────

  /** Ajusta la cantidad conservando lo ya cargado en los que sobreviven. */
  function setCantidad(n: number) {
    const cant = Math.max(1, Math.min(MAX_EMBRIONES, n))
    setEmbriones((prev) =>
      cant <= prev.length
        ? prev.slice(0, cant)
        : [...prev, ...Array.from({ length: cant - prev.length }, embrionVacio)]
    )
  }

  function editarEmbrion(i: number, campos: Partial<EmbrionForm>) {
    setEmbriones((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...campos } : e)))
  }

  // ── Guardado ───────────────────────────────────────────────────────────────

  function irAlDestino() {
    setError('')
    if (!caballoId) return setError('Seleccioná la donante.')
    if (!fecha)     return setError('La fecha es requerida.')
    setPaso(2)
  }

  async function guardar() {
    setError('')
    if (!caballoId) return setError('Seleccioná la donante.')
    if (!fecha)     return setError('La fecha es requerida.')
    if (!user?.id || !efectivaSociedadId) return

    const aTransferir = esNegativo ? [] : embriones.filter((e) => e.destino === 'transferir')
    if (aTransferir.some((e) => !e.receptoraId)) {
      return setError('Elegí una receptora para cada embrión que vas a transferir.')
    }
    const receptorasElegidas = aTransferir.map((e) => e.receptoraId)
    if (new Set(receptorasElegidas).size !== receptorasElegidas.length) {
      return setError('No podés transferir dos embriones a la misma receptora.')
    }

    setSaving(true)
    try {
      // Padrillo con texto libre se guarda en notas
      const notaTextoLibre = padrilloTexto.trim() && !padrilloId
        ? `Padrillo: ${padrilloTexto.trim()}`
        : null
      const notasFinales = [notas.trim(), notaTextoLibre].filter(Boolean).join(' | ') || null

      const flushing = await crearFlushing({
        caballo_id:             caballoId,
        sociedad_id:            efectivaSociedadId,
        fecha,
        veterinario_id:         user.id,
        es_negativo:            esNegativo,
        cantidad:               esNegativo ? null : embriones.length,
        padrillo_id:            padrilloId || null,
        origen_recordatorio_id: recordatorio?.id ?? null,
        pg_given:               pgGiven,
        cancelado:              false,
        notas:                  notasFinales,
      })

      // Cada embrión nace con el estado que le corresponde a su destino: los que
      // se vitrifican o van a la nube quedan ahí; los que se transfieren nacen
      // 'disponible' y el RPC los pasa a 'transferido'.
      if (!esNegativo) {
        const payloads: NuevoEmbrionPayload[] = embriones.map((e) => ({
          flushing_id:        flushing.id,
          caballo_donante_id: caballoId,
          sociedad_id:        efectivaSociedadId,
          padrillo_id:        padrilloId || null,
          estadio:            e.estadio || null,
          grado:              e.grado !== '' ? e.grado : null,
          tamanio:            e.tamanio || null,
          zona_pelucida:      e.zona_pelucida || null,
          estado:             ESTADO_POR_DESTINO[e.destino],
          notas:              null,
        }))

        let creados
        try {
          creados = await crianzaService.crearEmbriones(payloads)
        } catch (errEmb) {
          // El flushing ya quedó guardado: sin las filas en embrion el stock
          // muestra la cantidad pero no hay nada transferible.
          throw new Error(
            `El flushing se guardó, pero no se pudieron crear los ${payloads.length} embriones: ` +
            `${mensajeError(errEmb)}. Revisá los permisos sobre la donante y volvé a cargarlos.`,
            { cause: errEmb }
          )
        }

        // El insert devuelve las filas en el orden en que se mandaron, así que
        // el índice alcanza para casar cada embrión con su destino.
        const fallidas: string[] = []
        for (let i = 0; i < embriones.length; i++) {
          const e = embriones[i]
          if (e.destino !== 'transferir' || !e.receptoraId || !creados[i]) continue
          try {
            await registrarTransferencia({
              sociedad_id:          efectivaSociedadId,
              fecha,
              caballo_receptora_id: e.receptoraId,
              caballo_donante_id:   caballoId,
              embrion_id:           creados[i].id,
              padrillo_id:          padrilloId || null,
              flushing_id:          flushing.id,
              ovario_izq:           [],
              ovario_der:           [],
              cl_calidad:           null,
              tono_uterino:         null,
              tono_cervical:        null,
              clasificacion:        'Fresco',
              notas:                null,
            })
          } catch (errTransf) {
            const nombre = receptoras.find((r) => r.caballoId === e.receptoraId)?.nombre ?? 'receptora'
            fallidas.push(`E${i + 1} → ${nombre}: ${mensajeError(errTransf)}`)
          }
        }

        if (fallidas.length > 0) {
          // Los embriones quedaron creados y disponibles: la transferencia se
          // puede rehacer desde Embriones sin volver a cargar el flushing.
          throw new Error(
            `El flushing y los embriones se guardaron, pero fallaron ${fallidas.length} ` +
            `transferencia(s): ${fallidas.join(' · ')}. Los embriones quedaron disponibles ` +
            'en Embriones para transferirlos desde ahí.'
          )
        }
      }

      // Marcar el recordatorio de origen como hecho
      if (recordatorio?.id) {
        await actualizarEstadoRecordatorio(recordatorio.id, 'hecho')
      }

      onSuccess?.(flushing.id)
      onClose()
    } catch (err) {
      setError(mensajeError(err, 'Error al guardar.'))
    } finally {
      setSaving(false)
    }
  }

  const donanteSeleccionada = animales.find((a) => a.id === caballoId)
  const enDestino = paso === 2 && !esNegativo

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg sm:mx-4 rounded-t-2xl sm:rounded-xl border border-slate-300 bg-white shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <Droplets size={16} className="text-brand-600" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                {enDestino ? 'Destino de los embriones' : 'Registrar flushing'}
              </h2>
              {donanteSeleccionada && (
                <p className="text-xs text-slate-500 mt-0.5">
                  {donanteSeleccionada.nombre} · {formatFecha(fecha)}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!esNegativo && (
              <span className="text-[11px] text-slate-400 tabular-nums">{paso} / 2</span>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          {/* ── Paso 1: qué salió ─────────────────────────────────────────── */}
          {paso === 1 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="text-xs font-medium text-slate-500">Donante *</label>
                  <select
                    value={caballoId}
                    onChange={(e) => setCaballoId(e.target.value)}
                    disabled={cargando || !!caballoIdInicial || !!recordatorio?.caballo_id}
                    className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60"
                  >
                    <option value="">— Seleccioná —</option>
                    {donantes.map((d) => (
                      <option key={d.id} value={d.id}>{d.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500">Fecha *</label>
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              {/* Resultado */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">Resultado</label>
                <div className="inline-flex rounded-lg bg-slate-100 p-0.5 gap-0.5">
                  <button
                    type="button"
                    onClick={() => setEsNegativo(false)}
                    className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                      !esNegativo ? 'bg-white text-slate-900 font-medium shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    Se recuperaron embriones
                  </button>
                  <button
                    type="button"
                    onClick={() => setEsNegativo(true)}
                    className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                      esNegativo ? 'bg-white text-red-700 font-medium shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    Negativo
                  </button>
                </div>
              </div>

              {esNegativo ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 space-y-1">
                  <p className="text-sm font-semibold text-red-800">Sin embriones recuperados</p>
                  <p className="text-xs text-red-700">No se crea ningún embrión ni transferencia.</p>
                </div>
              ) : (
                <>
                  {/* Cantidad */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500">Embriones recuperados *</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {Array.from({ length: 6 }, (_, i) => i + 1).map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setCantidad(n)}
                          className={`w-8 h-8 rounded-md border text-sm transition-colors ${
                            embriones.length === n
                              ? 'bg-brand-500 border-brand-500 text-white font-semibold'
                              : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                      <input
                        type="number"
                        min={1}
                        max={MAX_EMBRIONES}
                        value={embriones.length}
                        onChange={(e) => setCantidad(Number(e.target.value))}
                        className="w-16 rounded-md border border-slate-300 bg-slate-100 px-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                  </div>

                  {/* Un renglón por embrión */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                      Tamaño y estado de cada embrión
                    </p>
                    {embriones.map((emb, i) => (
                      <div key={i} className="rounded-lg border border-slate-200 p-2.5 space-y-2">
                        <span className="text-xs font-semibold text-brand-700">E{i + 1}</span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <select
                            value={emb.tamanio}
                            onChange={(e) => editarEmbrion(i, { tamanio: e.target.value })}
                            className="rounded-md border border-slate-300 bg-slate-100 px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          >
                            <option value="">Tamaño —</option>
                            {TAMANIOS.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <select
                            value={emb.estadio}
                            onChange={(e) => editarEmbrion(i, { estadio: e.target.value })}
                            className="rounded-md border border-slate-300 bg-slate-100 px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          >
                            <option value="">Estadio —</option>
                            {ESTADIOS.map((e) => <option key={e} value={e}>{e}</option>)}
                          </select>
                          <select
                            value={emb.grado}
                            onChange={(e) => editarEmbrion(i, {
                              grado: e.target.value === '' ? '' : Number(e.target.value) as 1|2|3|4,
                            })}
                            className="rounded-md border border-slate-300 bg-slate-100 px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          >
                            <option value="">Grado —</option>
                            {GRADOS.map((g) => <option key={g} value={g}>{g}</option>)}
                          </select>
                          <select
                            value={emb.zona_pelucida}
                            onChange={(e) => editarEmbrion(i, { zona_pelucida: e.target.value })}
                            className="rounded-md border border-slate-300 bg-slate-100 px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          >
                            <option value="">Zona pel. —</option>
                            {ZONAS.map((z) => <option key={z} value={z}>{z}</option>)}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Padrillo — único para todos los embriones del flushing */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500">Padrillo</label>
                    <select
                      value={padrilloId}
                      onChange={(e) => {
                        setPadrilloId(e.target.value)
                        if (e.target.value) setPadrilloTexto('')
                      }}
                      className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    >
                      <option value="">— Sin especificar —</option>
                      {padrillos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}{p.empresa ? ` (${p.empresa})` : ''}
                        </option>
                      ))}
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
                </>
              )}

              {/* PG + Notas */}
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pgGiven}
                  onChange={(e) => setPgGiven(e.target.checked)}
                  className="rounded border-slate-400 bg-slate-100 text-brand-500 focus:ring-brand-500"
                />
                <span className="text-sm text-slate-600">
                  {esNegativo ? 'Se dio prostaglandina (PG) de rutina' : 'PG administrada'}
                </span>
              </label>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">Notas</label>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  rows={2}
                  placeholder="Observaciones adicionales…"
                  className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
                />
              </div>
            </>
          )}

          {/* ── Paso 2: dónde va cada uno ─────────────────────────────────── */}
          {enDestino && embriones.map((emb, i) => (
            <div key={i} className="rounded-lg border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-2 flex-wrap bg-slate-50 border-b border-slate-200 px-3 py-2">
                <span className="text-xs font-semibold text-brand-700">E{i + 1}</span>
                <span className="text-xs text-slate-500">
                  {[emb.tamanio, emb.estadio, emb.grado !== '' ? `Grado ${emb.grado}` : null]
                    .filter(Boolean).join(' · ') || 'Sin detalle'}
                </span>
                <div className="ml-auto inline-flex rounded-lg bg-slate-200/70 p-0.5 gap-0.5">
                  {(['transferir', 'vitrificar', 'en_nube'] as DestinoEmbrion[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => editarEmbrion(i, { destino: d, receptoraId: d === 'transferir' ? emb.receptoraId : '' })}
                      className={`px-2.5 py-1 text-[11px] rounded-md transition-colors ${
                        emb.destino === d ? 'bg-white text-slate-900 font-medium shadow-sm' : 'text-slate-500'
                      }`}
                    >
                      {d === 'transferir' ? 'Transferir' : d === 'vitrificar' ? 'Vitrificar' : 'En nube'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 space-y-2">
                {emb.destino === 'transferir' && (
                  <>
                    <p className="text-[11px] font-medium text-slate-500">
                      Receptoras ovuladas{' '}
                      <span className="text-slate-400 font-normal">— ordenadas por días desde su ovulación</span>
                    </p>

                    {receptoras.length === 0 ? (
                      <p className="text-xs text-slate-400 py-2">
                        Ninguna receptora tiene una ovulación registrada a esta fecha.
                        Cargá la OV desde el registro reproductivo y volvé.
                      </p>
                    ) : receptoras.map((r) => {
                      const seleccionada = emb.receptoraId === r.caballoId
                      return (
                        <button
                          key={r.caballoId}
                          type="button"
                          onClick={() => editarEmbrion(i, { receptoraId: r.caballoId })}
                          className={`w-full flex items-center gap-2.5 flex-wrap rounded-md border px-2.5 py-2 text-left transition-colors ${
                            seleccionada
                              ? 'border-brand-500 bg-brand-50'
                              : 'border-slate-200 hover:bg-slate-50'
                          } ${r.yaTransferida ? 'opacity-60' : ''}`}
                        >
                          <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${
                            seleccionada ? 'border-4 border-brand-500' : 'border-[1.5px] border-slate-300'
                          }`} />
                          <span className="text-sm font-medium text-slate-900">{r.nombre}</span>
                          <span className="text-[11px] text-slate-400 tabular-nums">
                            OV {formatFecha(r.fechaOv)}
                            {r.yaTransferida && ' · ya transferida'}
                          </span>
                          <span className={`ml-auto text-[11px] font-medium rounded-full px-2 py-0.5 tabular-nums ${
                            r.yaTransferida
                              ? 'bg-slate-100 text-slate-400 border border-slate-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            +{r.diasDesdeOv}
                          </span>
                        </button>
                      )
                    })}
                  </>
                )}

                {emb.destino === 'vitrificar' && (
                  <div className="flex items-start gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2.5 text-xs text-cyan-900">
                    <Snowflake size={14} className="shrink-0 mt-0.5" />
                    <span>
                      Queda congelado y disponible en <b className="font-semibold">Embriones</b> para
                      transferirlo más adelante.
                    </span>
                  </div>
                )}

                {emb.destino === 'en_nube' && (
                  <div className="flex items-start gap-2 rounded-md border border-violet-200 bg-violet-50 px-3 py-2.5 text-xs text-violet-900">
                    <Cloud size={14} className="shrink-0 mt-0.5" />
                    <span>
                      Queda en nube y disponible en <b className="font-semibold">Embriones</b> para
                      transferirlo más adelante.
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {error && (
            <div className="flex items-start gap-2 text-xs text-red-600">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-slate-200 px-5 py-3 shrink-0">
          {enDestino && (
            <span className="text-[11px] text-slate-400">
              {resumenDestinos(embriones)}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => (paso === 2 ? setPaso(1) : onClose())}
              className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              {paso === 2 ? 'Atrás' : 'Cancelar'}
            </button>
            {paso === 1 && !esNegativo ? (
              <button
                type="button"
                onClick={irAlDestino}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-brand-500 hover:bg-brand-400 text-white transition-colors"
              >
                Continuar al destino
                <ArrowRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={guardar}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium rounded-md bg-brand-500 hover:bg-brand-400 text-white transition-colors disabled:opacity-50"
              >
                {saving ? 'Guardando…' : 'Guardar flushing'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** "1 transferencia · 1 vitrificado" para el pie del paso 2. */
function resumenDestinos(embriones: EmbrionForm[]): string {
  const cuenta = (d: DestinoEmbrion) => embriones.filter((e) => e.destino === d).length
  const partes: string[] = []
  const t = cuenta('transferir')
  const v = cuenta('vitrificar')
  const n = cuenta('en_nube')
  if (t) partes.push(`${t} transferencia${t > 1 ? 's' : ''}`)
  if (v) partes.push(`${v} vitrificado${v > 1 ? 's' : ''}`)
  if (n) partes.push(`${n} en nube`)
  return partes.join(' · ')
}
