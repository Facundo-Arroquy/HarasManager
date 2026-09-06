import { useEffect, useState } from 'react'
import { Bell, CheckCircle, XCircle, Clock, AlertCircle, ChevronDown } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useCrianzaStore } from '../../store/crianzaStore'
import { LABEL_RESULTADO_ECO } from '../../types/crianza'
import type { RecordatorioCria, EstadoRecordatorio } from '../../types/crianza'
import Spinner from '../../components/ui/Spinner'
import FlushingModal from '../../components/centro-cria/FlushingModal'
import EcografiaModal from '../../components/centro-cria/EcografiaModal'
import RegistroCriaModal from '../../components/centro-cria/RegistroCriaModal'
import FlushingBanner from '../../components/centro-cria/FlushingBanner'
import NombreCaballoLink from '../../components/domain/NombreCaballoLink'
import { hoyAR, formatFecha } from '../../utils/fecha'
import {
  accionParaRecordatorio, fichaDeRecordatorio,
  type AccionRecordatorio, type FichaRecordatorio,
} from '../../utils/recordatorio'

const FILTROS: { label: string; value: EstadoRecordatorio | 'todos' }[] = [
  { label: 'Todos',      value: 'todos' },
  { label: 'Pendientes', value: 'pendiente' },
  { label: 'Vencidos',   value: 'vencido' },
  { label: 'Hechos',     value: 'hecho' },
  { label: 'Cancelados', value: 'cancelado' },
]

export default function RecordatoriosPage() {
  const sociedadId = useAuthStore((s) => s.sociedadActiva?.id)
  const rol        = useAuthStore((s) => s.rol)
  const esVet      = rol === 'veterinario'
  const {
    recordatorios, registros, flushings, ecografias, transferencias,
    loading, cargar, cargarParaVet, actualizarEstadoRecordatorio,
  } = useCrianzaStore()

  const [filtro,     setFiltro]     = useState<EstadoRecordatorio | 'todos'>('pendiente')
  const [cancelando, setCancelando] = useState<string | null>(null)
  // Cuál tiene la ficha desplegada: qué se registró para cerrarlo.
  const [abierto,    setAbierto]    = useState<string | null>(null)
  const [accion,     setAccion]     = useState<AccionRecordatorio | null>(null)

  useEffect(() => {
    if (sociedadId) cargar(sociedadId)
    else if (esVet) cargarParaVet()
  }, [sociedadId, esVet]) // eslint-disable-line react-hooks/exhaustive-deps

  function recargar() {
    if (sociedadId) cargar(sociedadId)
    else if (esVet) cargarParaVet()
  }

  const lista = filtro === 'todos'
    ? recordatorios
    : recordatorios.filter((r) => r.estado === filtro)

  const listaOrdenada = [...lista].sort((a, b) => a.fecha_vto.localeCompare(b.fecha_vto))

  /**
   * Hacer lo agendado: abre el modal que corresponde al tipo, enganchado al
   * recordatorio. Es el mismo camino que el evento del programa semanal, así
   * que el recordatorio queda hecho y con la ficha de lo que se hizo colgando.
   */
  function registrar(r: RecordatorioCria) {
    setAccion(accionParaRecordatorio(r, transferencias))
  }

  async function cancelar(id: string) {
    await actualizarEstadoRecordatorio(id, 'cancelado')
    setCancelando(null)
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>

  return (
    <div className="space-y-5 p-1">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Recordatorios</h1>
        <p className="text-sm text-slate-500 mt-0.5">Seguimiento del ciclo reproductivo</p>
      </div>

      <FlushingBanner />

      {/* Filtros */}
      <div className="flex flex-wrap gap-1.5">
        {FILTROS.map((f) => {
          const count = f.value === 'todos'
            ? recordatorios.length
            : recordatorios.filter((r) => r.estado === f.value).length
          return (
            <button
              key={f.value}
              onClick={() => setFiltro(f.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                filtro === f.value
                  ? 'bg-slate-200 text-slate-900'
                  : 'bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-700'
              }`}
            >
              {f.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                filtro === f.value ? 'bg-slate-400' : 'bg-slate-100'
              }`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Lista */}
      {listaOrdenada.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          <Bell size={28} className="mx-auto mb-2 opacity-30" />
          No hay recordatorios en esta categoría.
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden divide-y divide-slate-200">
          {listaOrdenada.map((r) => (
            <RecordatorioItem
              key={r.id}
              recordatorio={r}
              canEdit={esVet}
              ficha={fichaDeRecordatorio(r, { registros, flushings, ecografias })}
              abierto={abierto === r.id}
              onAlternar={() => setAbierto(abierto === r.id ? null : r.id)}
              onRegistrar={() => registrar(r)}
              onCancelar={() => cancelar(r.id)}
              cancelando={cancelando === r.id}
              setCancelando={() => setCancelando(cancelando === r.id ? null : r.id)}
            />
          ))}
        </div>
      )}

      {/* Modales — cada uno cierra el recordatorio que lo abrió.
          El destino de cada embrión del flushing se elige adentro del propio
          modal, así que no se encadena TransferenciaModal. */}
      {accion?.modal === 'flushing' && (
        <FlushingModal
          recordatorio={accion.recordatorio}
          onClose={() => setAccion(null)}
          onSuccess={() => { setAccion(null); recargar() }}
        />
      )}

      {accion?.modal === 'registro' && (
        <RegistroCriaModal
          recordatorio={accion.recordatorio}
          onClose={() => setAccion(null)}
          onSuccess={recargar}
        />
      )}

      {accion?.modal === 'eco' && (
        <EcografiaModal
          transferencia={accion.transferencia}
          ecografiasExistentes={ecografias.filter((e) => e.transferencia_id === accion.transferencia.id)}
          recordatorio={accion.recordatorio}
          onClose={() => setAccion(null)}
          onSuccess={() => { setAccion(null); recargar() }}
        />
      )}

      {accion?.modal === 'falta-transferencia' && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          No se encontró la transferencia de {accion.recordatorio.caballo?.nombre ?? 'la receptora'} para
          cargar la {accion.recordatorio.tipo}.{' '}
          <button onClick={() => setAccion(null)} className="underline">Cerrar</button>
        </p>
      )}
    </div>
  )
}

function RecordatorioItem({
  recordatorio: r,
  canEdit = true,
  ficha,
  abierto,
  onAlternar,
  onRegistrar,
  onCancelar,
  cancelando,
  setCancelando,
}: {
  recordatorio: RecordatorioCria
  canEdit?: boolean
  ficha: FichaRecordatorio
  abierto: boolean
  onAlternar: () => void
  onRegistrar: () => void
  onCancelar: () => void
  cancelando: boolean
  setCancelando: () => void
}) {
  const hoy = hoyAR()
  const esHoy    = r.fecha_vto === hoy
  const esPasado = r.fecha_vto < hoy
  const activo   = r.estado === 'pendiente' || r.estado === 'vencido'

  return (
    <div>
      <div className="px-4 py-3 flex items-start gap-3">
        {/* Ícono estado */}
        <div className="mt-0.5 shrink-0">
          {r.estado === 'hecho' && <CheckCircle size={16} className="text-brand-500" />}
          {r.estado === 'cancelado' && <XCircle size={16} className="text-slate-400" />}
          {r.estado === 'vencido' && <AlertCircle size={16} className="text-red-600" />}
          {r.estado === 'pendiente' && (
            <Clock size={16} className={esHoy ? 'text-brand-600' : 'text-slate-400'} />
          )}
        </div>

        {/* Contenido — toca para ver qué se registró */}
        <button
          type="button"
          onClick={onAlternar}
          aria-expanded={abierto}
          className="flex-1 min-w-0 text-left"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <NombreCaballoLink
              id={r.caballo_id}
              nombre={r.caballo?.nombre}
              className="font-medium text-slate-700 text-sm"
            />
            <span className={`text-sm ${esHoy && activo ? 'text-brand-700 font-medium' : 'text-slate-500'}`}>
              {r.tipo}
            </span>
            {r.auto_generado && (
              <span className="text-[10px] text-slate-400 border border-slate-300 rounded px-1">auto</span>
            )}
            {ficha && (
              <span className="text-[10px] text-brand-600 border border-brand-300 rounded px-1">
                con ficha
              </span>
            )}
          </div>
          <p className={`text-xs mt-0.5 ${
            r.estado === 'vencido' ? 'text-red-600' :
            esHoy && activo       ? 'text-brand-600' :
            esPasado && activo    ? 'text-red-600' :
            'text-slate-400'
          }`}>
            {formatFecha(r.fecha_vto)}
            {esHoy && activo && ' — Hoy'}
          </p>
          {r.notas && <p className="text-xs text-slate-400 mt-1">{r.notas}</p>}
          {r.cancel_motivo && (
            <p className="text-xs text-slate-400 mt-1">Cancelado: {r.cancel_motivo}</p>
          )}
        </button>

        {/* Acciones */}
        <div className="flex items-center gap-2 shrink-0">
          {activo && canEdit && (
            <>
              <button
                onClick={onRegistrar}
                className="text-xs px-2.5 py-1 rounded bg-brand-50 text-brand-600 hover:bg-brand-100 transition-colors"
                title="Cargar lo que se hizo y cerrar el recordatorio"
              >
                Registrar
              </button>
              {cancelando ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={onCancelar}
                    className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={setCancelando}
                    className="text-xs px-2 py-1 rounded text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={setCancelando}
                  className="text-xs px-2.5 py-1 rounded bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                >
                  Cancelar
                </button>
              )}
            </>
          )}
          <button
            type="button"
            onClick={onAlternar}
            aria-label={abierto ? 'Ocultar la ficha' : 'Ver la ficha'}
            className="rounded p-0.5 text-slate-300 transition-colors hover:text-slate-600"
          >
            <ChevronDown size={15} className={`transition-transform ${abierto ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {abierto && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 pl-11">
          <FichaPanel ficha={ficha} estado={r.estado} />
        </div>
      )}
    </div>
  )
}

// ── Ficha de lo que se registró ───────────────────────────────────────────────

function FichaPanel({ ficha, estado }: { ficha: FichaRecordatorio; estado: EstadoRecordatorio }) {
  if (!ficha) {
    return (
      <p className="text-xs text-slate-400">
        {estado === 'hecho'
          ? 'Se marcó hecho sin cargar ficha, o se cerró antes de que se guardara el detalle.'
          : estado === 'cancelado'
            ? 'Se canceló: no se registró nada.'
            : 'Todavía no se registró nada. Tocá “Registrar” para cargarlo y cerrarlo.'}
      </p>
    )
  }

  if (ficha.clase === 'flushing') {
    const f = ficha.flushing
    return (
      <Ficha
        titulo={f.es_negativo
          ? 'Flushing sin embriones'
          : `Flushing · ${f.cantidad ?? 0} embri${f.cantidad === 1 ? 'ón' : 'ones'}`}
        fecha={f.fecha}
        vet={f.veterinario}
        filas={[
          ['Padrillo', f.padrillo?.nombre ?? null],
          ['PG', f.pg_given ? 'Se dio' : 'No'],
          ['Notas', f.notas],
        ]}
      />
    )
  }

  if (ficha.clase === 'ecografia') {
    const e = ficha.ecografia
    return (
      <Ficha
        titulo={`Eco ${e.numero} · ${LABEL_RESULTADO_ECO[e.resultado]}`}
        fecha={e.fecha}
        vet={e.veterinario}
        filas={[
          ['Ovario izq.', e.ovario_izq.join(', ') || null],
          ['Ovario der.', e.ovario_der.join(', ') || null],
          ['Notas', e.notas],
        ]}
      />
    )
  }

  const g = ficha.registro
  return (
    <Ficha
      titulo={g.obs_chips.length > 0 ? g.obs_chips.join(', ') : 'Revisión'}
      fecha={g.fecha}
      vet={g.veterinario}
      filas={[
        ['Ovario izq.', g.ovario_izq.join(', ') || null],
        ['Ovario der.', g.ovario_der.join(', ') || null],
        ['Útero', g.utero.join(', ') || null],
        ['Padrillo', g.padrillo?.nombre ?? null],
        ['Días post-OV', g.ov_dias != null ? String(g.ov_dias) : null],
        ['Observaciones', g.observaciones],
      ]}
    />
  )
}

function Ficha({
  titulo, fecha, vet, filas,
}: {
  titulo: string
  fecha: string
  vet?: { nombre: string; apellido: string } | null
  /** Pares etiqueta/valor; las de valor vacío no se pintan. */
  filas: [string, string | null][]
}) {
  const conDato = filas.filter(([, v]) => v)
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-sm font-medium text-slate-800">{titulo}</span>
        <span className="text-xs text-slate-400">
          {formatFecha(fecha)}
          {vet ? ` · Dr/a. ${vet.nombre} ${vet.apellido}` : ''}
        </span>
      </div>
      {conDato.length === 0 ? (
        <p className="text-xs text-slate-400">Sin más detalle cargado.</p>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          {conDato.map(([label, valor]) => (
            <div key={label} className="contents">
              <dt className="text-slate-400">{label}</dt>
              <dd className="text-slate-600">{valor}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
