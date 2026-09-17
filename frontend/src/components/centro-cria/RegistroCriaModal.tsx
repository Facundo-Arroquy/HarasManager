import { useEffect, useMemo, useState } from 'react'
import { useEscapeClose } from '../../hooks/useEscapeClose'
import { useSaveHandler } from '../../hooks/useSaveHandler'
import { Link } from 'react-router-dom'
import { X, AlertCircle, Settings2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useCrianzaStore, reglasParaRegistro, VENTANA_INSEMINACION_DIAS } from '../../store/crianzaStore'
import { crianzaService } from '../../services/crianzaService'
import {
  CHIPS_OI_OD, CHIPS_UTERO, admiteRegistroCria,
  REVIEW_DIAS_BOTONES_RAPIDOS, REVIEW_DIAS_MIN, REVIEW_DIAS_MAX,
} from '../../types/crianza'
import type {
  RolReproductivo, PlazosVet, RecordatorioCria, RegistroClinicoCria, ReglaRecordatorioVet,
} from '../../types/crianza'
import ChipSelector from './ChipSelector'
import PadrilloSelect from './PadrilloSelect'
import { hoyAR, sumarDias, formatFecha as formatFechaAR } from '../../utils/fecha'
import { mensajeError } from '../../utils/error'

interface Props {
  onClose: () => void
  onSuccess?: () => void
  // Pre-seleccionar un animal (desde ProgramaSemanal o vista de detalle)
  caballoIdInicial?: string
  /**
   * Recordatorio que disparó el modal. Con él, guardar no es cargar un registro
   * suelto: es hacer lo que estaba agendado, así que al terminar el recordatorio
   * queda `hecho` en vez de seguir pendiente al lado del registro nuevo.
   */
  recordatorio?: RecordatorioCria
  /**
   * Registro a corregir. El animal no se cambia y no se vuelven a generar
   * recordatorios: los que ya se crearon con el registro quedan como están.
   */
  registroEditar?: RegistroClinicoCria
}

/**
 * Acción del vet que resuelve cada tipo de recordatorio. Solo se pre-marca si el
 * vet tiene esa acción configurada; lo que no está acá abre el modal sin nada
 * marcado, como cualquier registro.
 */
const CHIP_QUE_RESUELVE: Record<string, string> = {
  IN:      'IN',
  OXI:     'OXI',
  'Dar PG': 'PG',
}

type AnimalItem = {
  id: string
  nombre: string
  categoria: string
  rol_reproductivo: RolReproductivo
  sociedad_id?: string
  campo: { nombre: string } | null
}

export default function RegistroCriaModal({ onClose, onSuccess, caballoIdInicial, recordatorio, registroEditar }: Props) {
  const { user, sociedadActiva, rol } = useAuth()
  const {
    crearRegistro, plazos, reglasPropias, cargarPlazos, actualizarEstadoRecordatorio,
    consultarInseminacionReciente,
  } = useCrianzaStore()

  const [animales, setAnimales] = useState<AnimalItem[]>([])
  const [cargandoAnimales, setCargandoAnimales] = useState(true)
  const [chipsObs, setChipsObs] = useState<string[]>([])
  const [cargandoChips, setCargandoChips] = useState(true)
  // padrillo_id → parentesco con la donante seleccionada (bloquea la elección)
  const [familiares, setFamiliares] = useState<Record<string, string>>({})
  // Ids del ranking de la donante, ordenados por prioridad
  const [ranking, setRanking] = useState<string[]>([])

  // ── Form state ────────────────────────────────────────────────────────────
  const [caballoId,     setCaballoId]     = useState(registroEditar?.caballo_id ?? caballoIdInicial ?? recordatorio?.caballo_id ?? '')
  const [fecha,         setFecha]         = useState(registroEditar?.fecha ?? hoyAR())
  const [ovarioIzq,     setOvarioIzq]     = useState<string[]>(registroEditar?.ovario_izq ?? [])
  const [ovarioDer,     setOvarioDer]     = useState<string[]>(registroEditar?.ovario_der ?? [])
  const [utero,         setUtero]         = useState<string[]>(registroEditar?.utero ?? [])
  const [obsChips,      setObsChips]      = useState<string[]>(registroEditar?.obs_chips ?? [])
  const [padrilloId,    setPadrilloId]    = useState(registroEditar?.padrillo_id ?? '')
  const [ovDias,        setOvDias]        = useState<string>(registroEditar?.ov_dias != null ? String(registroEditar.ov_dias) : '')
  const [reviewDias,    setReviewDias]    = useState<number | null>(registroEditar?.review_dias ?? null)
  const [reviewDesc,    setReviewDesc]    = useState(registroEditar?.review_desc ?? '')
  const [observaciones, setObservaciones] = useState(registroEditar?.observaciones ?? '')
  // Si el animal no tiene rol asignado, el vet elige uno en el modal
  const [rolManual,     setRolManual]     = useState<RolReproductivo>(null)
  // IN en los días previos: decide si la OV de la donante agenda Flushing o Dar PG
  const [inseminadaPrevia, setInseminadaPrevia] = useState(false)

  // Para vets sin sociedadActiva: se deriva del caballo seleccionado
  const [animalSociedadId, setAnimalSociedadId] = useState('')

  const { saving, error, setError, execute } = useSaveHandler('Error al guardar.')

  // ── Derivados ─────────────────────────────────────────────────────────────
  const animalSeleccionado = animales.find((a) => a.id === caballoId) ?? null
  // useMemo: la identidad de este array es dependencia del efecto que busca
  // familiares y ranking; sin memo se relanzaría en cada render.
  const padrillos = useMemo(
    () => animales.filter((a) => a.categoria === 'Padrillo'),
    [animales],
  )
  const rolEfectivo: RolReproductivo =
    animalSeleccionado?.rol_reproductivo ?? rolManual
  // Un registro viejo puede tener acciones que el vet ya sacó de su catálogo
  // (o la 'Transferida' que pone la transferencia): se ofrecen igual para no
  // perderlas al editar.
  const opcionesObs = useMemo(
    () => [...new Set([...chipsObs, ...(registroEditar?.obs_chips ?? [])])],
    [chipsObs, registroEditar],
  )

  const mostrarPadrillo = obsChips.includes('IN')
  const mostrarOvDias   = ovarioIzq.includes('OV') || ovarioDer.includes('OV')
  const necesitaRol     = animalSeleccionado && !animalSeleccionado.rol_reproductivo
  const parentescoElegido = padrilloId ? familiares[padrilloId] : undefined

  // ── Carga de animales ─────────────────────────────────────────────────────
  // Sin el catch/finally, un error de la consulta —o un usuario sin sociedad
  // activa que tampoco sea veterinario— dejaba el modal en "Cargando…" para
  // siempre, sin forma de saber qué pasó.
  useEffect(() => {
    const carga = sociedadActiva
      ? crianzaService.listarAnimalesReproductivos(sociedadActiva.id)
      : rol === 'veterinario'
        ? crianzaService.listarAnimalesReproductivosVet()
        : null

    if (!carga) { setCargandoAnimales(false); return }

    let cancelado = false
    carga
      .then((data) => {
        if (cancelado) return
        setAnimales(data.filter((a: { categoria: string }) => a.categoria !== 'Potrillo' && a.categoria !== 'Caballo'))
      })
      .catch((e: unknown) => {
        if (!cancelado) setError(mensajeError(e, 'No se pudieron cargar los animales.'))
      })
      .finally(() => { if (!cancelado) setCargandoAnimales(false) })

    return () => { cancelado = true }
  }, [sociedadActiva, rol])

  // Los plazos son del vet que firma el registro y salen de su configuración.
  // El modal se los pide él mismo porque ya no se abre solo desde el programa
  // semanal: entrando por la ficha del caballo el store todavía está en los
  // valores por defecto y los recordatorios caerían en la fecha equivocada.
  useEffect(() => { cargarPlazos().catch(() => {}) }, [cargarPlazos])

  // Para el preview: la misma consulta que hace el store al guardar.
  const consultarIN = rolEfectivo === 'Donante' && mostrarOvDias && !!caballoId && !!fecha
  useEffect(() => {
    if (!consultarIN) { setInseminadaPrevia(false); return }
    let cancelado = false
    consultarInseminacionReciente(caballoId, fecha)
      .then((r) => { if (!cancelado) setInseminadaPrevia(r) })
      .catch(() => { if (!cancelado) setInseminadaPrevia(false) })
    return () => { cancelado = true }
  }, [consultarIN, caballoId, fecha, consultarInseminacionReciente])

  // ── Carga del catálogo de acciones del vet autenticado ────────────────────
  // La lista es propia de cada veterinario (RLS filtra por auth.uid()) y viaja
  // con él a todos los establecimientos donde trabaja.
  useEffect(() => {
    crianzaService.listarMisChips()
      .then((data) => {
        const nombres = data.map((c) => c.nombre)
        setChipsObs(nombres)
        // Viniendo de un recordatorio, la acción que lo resuelve ya viene
        // marcada: el vet abrió el evento justamente para hacer eso. Queda
        // desmarcable, y el preview de abajo muestra qué se va a agendar.
        // Los de una regla propia se llaman como la acción que piden.
        const chip = recordatorio && (CHIP_QUE_RESUELVE[recordatorio.tipo] ?? recordatorio.tipo)
        if (chip && nombres.includes(chip)) setObsChips([chip])
      })
      .catch(() => setChipsObs([]))
      .finally(() => setCargandoChips(false))
  }, [recordatorio])

  // Si abre con un animal pre-seleccionado, derivar su sociedad apenas se cargan los animales.
  // El select onChange no se dispara en ese caso → sin esto el vet sin sociedadActiva pega
  // "No se pudo determinar la sociedad del animal." aunque el animal sí la tenga.
  useEffect(() => {
    if (!caballoId || animales.length === 0) return
    const animal = animales.find((a) => a.id === caballoId)
    if (animal?.sociedad_id) setAnimalSociedadId(animal.sociedad_id)
  }, [caballoId, animales])

  // ── Familiares + ranking de la donante seleccionada ───────────────────────
  // Se recalcula al cambiar de animal: el parentesco y el ranking son de esa yegua.
  useEffect(() => {
    if (!caballoId || padrillos.length === 0) {
      setFamiliares({})
      setRanking([])
      return
    }
    let cancelado = false
    const ids = padrillos.map((p) => p.id)

    crianzaService.listarPadrillosFamiliares(caballoId, ids)
      .then((res) => { if (!cancelado) setFamiliares(res) })
      .catch(() => { if (!cancelado) setFamiliares({}) })

    crianzaService.listarRankingPadrillos(caballoId)
      .then((res) => { if (!cancelado) setRanking(res.map((r) => r.padrillo_id)) })
      .catch(() => { if (!cancelado) setRanking([]) })

    return () => { cancelado = true }
  }, [caballoId, padrillos])

  // Si el padrillo elegido resulta familiar (cambió la donante), se limpia.
  useEffect(() => {
    if (padrilloId && familiares[padrilloId]) setPadrilloId('')
  }, [familiares, padrilloId])

  useEscapeClose(onClose)

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!caballoId)       return setError('Seleccioná un animal.')
    if (!fecha)           return setError('La fecha es requerida.')
    if (!user?.id)        return setError('Sin sesión activa.')
    // `animalSociedadId` arranca vacío: `||` para que caiga al recordatorio.
    const sociedadId = registroEditar?.sociedad_id || sociedadActiva?.id || animalSociedadId || recordatorio?.sociedad_id
    if (!sociedadId)      return setError('No se pudo determinar la sociedad del animal.')
    if (necesitaRol && !rolManual) return setError('Indicá si es Donante o Receptora.')
    if (mostrarPadrillo && parentescoElegido) {
      return setError(
        `El padrillo es ${parentescoElegido.toLowerCase()} de la yegua: no se puede inseminar con un familiar directo.`,
      )
    }
    if (reviewDias != null && (!Number.isInteger(reviewDias) || reviewDias < REVIEW_DIAS_MIN || reviewDias > REVIEW_DIAS_MAX)) {
      return setError(`Los días de revisión deben ser un número entero entre ${REVIEW_DIAS_MIN} y ${REVIEW_DIAS_MAX}.`)
    }

    const datos = {
      fecha,
      ovario_izq:    ovarioIzq,
      ovario_der:    ovarioDer,
      utero,
      obs_chips:     obsChips,
      padrillo_id:   mostrarPadrillo && padrilloId ? padrilloId : null,
      ov_dias:       mostrarOvDias && ovDias !== '' ? Number(ovDias) : null,
      review_dias:   reviewDias,
      review_desc:   reviewDias && reviewDesc ? reviewDesc : null,
      observaciones: observaciones.trim() || null,
    }

    await execute(async () => {
      if (registroEditar) {
        await crianzaService.actualizarRegistro(registroEditar.id, datos)
      } else {
        await crearRegistro(
          {
            ...datos,
            caballo_id:     caballoId,
            sociedad_id:    sociedadId,
            veterinario_id: user.id,
            motivo:         null,
            diagnostico:    null,
            tratamiento:    null,
            // Deja el rastro de qué se hizo para cerrar el recordatorio: sin
            // esto queda 'hecho' y no hay forma de ver con qué.
            origen_recordatorio_id: recordatorio?.id ?? null,
          },
          rolEfectivo
        )
      }

      // Si el animal no tenía rol, persistirlo
      if (necesitaRol && rolManual) {
        await crianzaService.actualizarRolReproductivo(caballoId, rolManual)
      }

      // Lo agendado ya se hizo: si no se cierra, el recordatorio queda
      // pendiente al lado del registro que lo resolvió y se vuelve a ofrecer.
      if (recordatorio) {
        await actualizarEstadoRecordatorio(recordatorio.id, 'hecho')
      }

      onSuccess?.()
      onClose()
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg sm:mx-4 rounded-t-2xl sm:rounded-xl border border-slate-300 bg-white shadow-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              {registroEditar
                ? 'Editar registro reproductivo'
                : recordatorio ? `${recordatorio.tipo} — registro reproductivo` : 'Registro reproductivo'}
            </h2>
            {recordatorio && (
              <p className="text-xs text-brand-600 mt-0.5">
                Agendado para el {formatFechaAR(recordatorio.fecha_vto)} · al guardar queda hecho
              </p>
            )}
            {animalSeleccionado && (
              <p className="text-xs text-slate-500 mt-0.5">
                {animalSeleccionado.nombre}
                {rolEfectivo && (
                  <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] border ${
                    rolEfectivo === 'Donante'
                      ? 'border-brand-300 text-brand-600'
                      : 'border-blue-300 text-blue-600'
                  }`}>
                    {rolEfectivo}
                  </span>
                )}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form
          id="registro-cria-form"
          onSubmit={handleSubmit}
          className="overflow-y-auto flex-1 px-5 py-4 space-y-5"
        >
          {/* Animal + Fecha */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-xs font-medium text-slate-500">Animal *</label>
              <select
                value={caballoId}
                onChange={(e) => {
                  const animal = animales.find((a) => a.id === e.target.value)
                  setCaballoId(e.target.value)
                  setAnimalSociedadId(animal?.sociedad_id ?? '')
                  setRolManual(null)
                }}
                // El recordatorio es de este animal: cambiarlo acá marcaría
                // hecho lo de una yegua y registraría lo de otra. Al editar,
                // el animal tampoco se cambia: de él cuelgan los recordatorios.
                disabled={cargandoAnimales || !!recordatorio || !!registroEditar}
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
              >
                <option value="">— Seleccioná —</option>
                {/* El animal de un registro viejo puede no estar en la lista
                    (dado de baja, o ya no es reproductivo). */}
                {registroEditar && !animales.some((a) => a.id === registroEditar.caballo_id) && (
                  <option value={registroEditar.caballo_id}>{registroEditar.caballo?.nombre ?? 'Animal'}</option>
                )}
                {animales.filter((a) => admiteRegistroCria(a.categoria)).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                    {a.rol_reproductivo ? ` (${a.rol_reproductivo})` : ''}
                  </option>
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

          {/* Rol manual — solo si la yegua no tiene rol asignado */}
          {necesitaRol && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-brand-600">
                Esta yegua no tiene rol reproductivo asignado. ¿Es...?
              </label>
              <div className="flex gap-2">
                {(['Donante', 'Receptora'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRolManual(r)}
                    className={`flex-1 py-2 rounded-md border text-sm transition-colors ${
                      rolManual === r
                        ? r === 'Donante'
                          ? 'border-brand-600 bg-brand-50 text-brand-700'
                          : 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-300 text-slate-500 hover:border-slate-400'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Ovarios */}
          <div className="grid grid-cols-2 gap-4">
            <ChipSelector
              label="Ovario izquierdo"
              options={CHIPS_OI_OD}
              selected={ovarioIzq}
              onChange={setOvarioIzq}
              allowCustom
            />
            <ChipSelector
              label="Ovario derecho"
              options={CHIPS_OI_OD}
              selected={ovarioDer}
              onChange={setOvarioDer}
              allowCustom
            />
          </div>

          {/* Días post-OV — visible cuando se marcó OV */}
          {mostrarOvDias && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Días post-OV</label>
              <input
                type="number"
                min={0}
                max={30}
                value={ovDias}
                onChange={(e) => setOvDias(e.target.value)}
                placeholder="0"
                className="w-24 rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          )}

          {/* Útero */}
          <ChipSelector
            label="Útero"
            options={CHIPS_UTERO}
            selected={utero}
            onChange={setUtero}
            colorSelected="bg-blue-100 text-blue-700 border-blue-300"
          />

          {/* Observaciones / chips de acciones */}
          {!cargandoChips && opcionesObs.length === 0 ? (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Acciones / tratamientos</label>
              <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                Todavía no configuraste tus acciones (Strelin, PG, Flushing…). Sin
                ellas se puede guardar el registro, pero no se generan
                recordatorios automáticos.
                <Link
                  to="/centro-cria/config"
                  onClick={onClose}
                  className="mt-2 flex items-center gap-1 text-brand-600 hover:text-brand-500 font-medium"
                >
                  <Settings2 size={12} />
                  Configurar mis acciones
                </Link>
              </div>
            </div>
          ) : (
            <ChipSelector
              label="Acciones / tratamientos"
              options={opcionesObs}
              selected={obsChips}
              onChange={setObsChips}
              colorSelected="bg-violet-100 text-violet-700 border-violet-300"
            />
          )}

          {/* Padrillo — visible cuando se marcó IN */}
          {mostrarPadrillo && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Padrillo (inseminación)</label>
              <PadrilloSelect
                padrillos={padrillos}
                value={padrilloId}
                onChange={setPadrilloId}
                familiares={familiares}
                ranking={ranking}
              />
              {ranking.length > 0 && (
                <p className="text-[11px] text-slate-400">
                  Los #1, #2… son el ranking configurado para esta donante.
                </p>
              )}
              {parentescoElegido && (
                <p className="flex items-center gap-1.5 text-xs text-red-600">
                  <AlertCircle size={12} />
                  {parentescoElegido} de la yegua — no se puede inseminar con este padrillo.
                </p>
              )}
            </div>
          )}

          {/* Revisión programada — reemplaza al viejo checkbox "Revisión mañana" */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-500">Revisión programada</label>
            <div className="flex flex-wrap items-center gap-1.5">
              {REVIEW_DIAS_BOTONES_RAPIDOS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setReviewDias(reviewDias === d ? null : d)}
                  className={`h-8 w-8 rounded-md border text-xs font-medium transition-colors ${
                    reviewDias === d
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-slate-300 text-slate-500 hover:border-slate-400'
                  }`}
                >
                  {d}
                </button>
              ))}
              {/* Input libre para 8-60: los botones rápidos ya cubren la primera semana. */}
              <input
                type="number"
                min={REVIEW_DIAS_BOTONES_RAPIDOS.length + 1}
                max={REVIEW_DIAS_MAX}
                value={reviewDias != null && reviewDias > REVIEW_DIAS_BOTONES_RAPIDOS.length ? reviewDias : ''}
                onChange={(e) => {
                  const v = e.target.value
                  setReviewDias(v === '' ? null : Number(v))
                }}
                placeholder="8-60"
                className="w-16 rounded-md border border-slate-300 bg-slate-100 px-2 py-1.5 text-xs text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <span className="text-[11px] text-slate-400">días</span>
              {reviewDias != null && (
                <button
                  type="button"
                  onClick={() => setReviewDias(null)}
                  className="text-[11px] text-slate-400 underline hover:text-slate-600"
                >
                  Quitar
                </button>
              )}
            </div>
            {reviewDias != null && reviewDias >= REVIEW_DIAS_MIN && reviewDias <= REVIEW_DIAS_MAX && (
              <>
                <p className="text-xs text-brand-600">
                  Se revisará el {formatFechaAR(sumarDias(fecha, reviewDias))}
                </p>
                <input
                  type="text"
                  value={reviewDesc}
                  onChange={(e) => setReviewDesc(e.target.value)}
                  placeholder="Motivo (opcional)"
                  className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </>
            )}
          </div>

          {/* Observaciones libres */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Observaciones</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
              placeholder="Notas adicionales…"
              className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
            />
          </div>

          {/* Previsualización de recordatorios a generar */}
          {registroEditar && (
            <p className="text-[11px] text-slate-400">
              Editar no vuelve a generar recordatorios: los que ya se crearon con este registro quedan como están.
            </p>
          )}
          {/* Sin exigir chips: una OV sola también agenda (Flushing o Dar PG).
              El preview no se pinta si no hay nada que generar. */}
          {!registroEditar && caballoId && (
            <RecordatoriosPreview
              obsChips={obsChips}
              ovarioDer={ovarioDer}
              ovarioIzq={ovarioIzq}
              fecha={fecha}
              rol={rolEfectivo}
              reviewDias={reviewDias}
              inseminada={obsChips.includes('IN') || inseminadaPrevia}
              cfg={plazos}
              propias={reglasPropias}
            />
          )}

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600">
              <AlertCircle size={13} />
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="registro-cria-form"
            disabled={saving || Boolean(mostrarPadrillo && parentescoElegido)}
            className="px-4 py-2 text-sm font-medium rounded-md bg-brand-500 hover:bg-brand-400 text-white transition-colors disabled:opacity-50"
          >
            {saving
              ? 'Guardando…'
              : registroEditar ? 'Guardar cambios'
              : recordatorio ? 'Guardar y marcar hecho' : 'Guardar registro'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Preview de recordatorios automáticos ──────────────────────────────────────

function RecordatoriosPreview({
  obsChips, ovarioIzq, ovarioDer, fecha, rol, reviewDias, inseminada, cfg, propias,
}: {
  obsChips: string[]
  ovarioIzq: string[]
  ovarioDer: string[]
  fecha: string
  rol: RolReproductivo
  reviewDias: number | null
  /** IN en este registro o en los días previos (ver VENTANA_INSEMINACION_DIAS). */
  inseminada: boolean
  /** Plazos del vet autenticado (los mismos que usará reglasParaRegistro). */
  cfg: PlazosVet
  /** Reglas propias del vet, que se suman a las fijas. */
  propias: ReglaRecordatorioVet[]
}) {
  // Las mismas reglas que aplica el store al guardar: con una copia propia, el
  // preview podía mostrar recordatorios que después no se creaban.
  const tieneOV = ovarioIzq.includes('OV') || ovarioDer.includes('OV')
  const items = reglasParaRegistro(
    { fecha, obs_chips: obsChips, ovario_izq: ovarioIzq, ovario_der: ovarioDer, review_dias: reviewDias },
    rol, cfg, inseminada, propias,
  ).map((r) => ({
    tipo:  r.tipo,
    fecha: r.calcularFecha(fecha),
    // El Dar PG de la donante sale de una OV sin IN previa: se aclara por qué.
    nota:  rol === 'Donante' && tieneOV && !inseminada && r.tipo === 'Dar PG'
      ? `sin IN en los últimos ${VENTANA_INSEMINACION_DIAS} días`
      : undefined,
  }))

  if (items.length === 0) return null

  return (
    <div className="rounded-md border border-slate-300 bg-slate-50 p-3 space-y-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
        Recordatorios a generar
      </p>
      {items.map((item, i) => (
        <div key={i} className="flex items-center justify-between text-xs">
          <span className="text-slate-600">
            {item.tipo}
            {item.nota && <span className="text-slate-400"> · {item.nota}</span>}
          </span>
          <span className="text-slate-400">{formatFecha(item.fecha)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Utilidades ───────────────────────────────────────────────────────────────

function formatFecha(fecha: string): string {
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y.slice(2)}`
}
