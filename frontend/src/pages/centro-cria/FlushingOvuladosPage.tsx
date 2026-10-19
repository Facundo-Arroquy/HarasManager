import { useEffect, useMemo, useState } from 'react'
import { Droplets, Clock3, ChevronDown, Calendar, Egg } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useCrianzaStore } from '../../store/crianzaStore'
import { crianzaService } from '../../services/crianzaService'
import Spinner from '../../components/ui/Spinner'
import NombreCaballoLink from '../../components/domain/NombreCaballoLink'
import FlushingModal from '../../components/centro-cria/FlushingModal'
import type { RecordatorioCria } from '../../types/crianza'
import { ovuladosPorDia, type OvuladoDia } from '../../utils/receptoras'
import {
  hoyAR, sumarDias, diffDias, formatFecha,
  diaDeSemana, esFinDeSemana, esSabado,
} from '../../utils/fecha'
import { mensajeError } from '../../utils/error'

// ── Tipos locales ───────────────────────────────────────────────────────────

interface FlushingPendiente {
  recordatorio: RecordatorioCria
  fechaOv:      string
  diaCiclo:     number
  campo:        string
}

interface UbicacionAnimal {
  empresa: string
  campo:   string
}

const SIN_EMPRESA = 'Sin empresa'
const SIN_CAMPO   = 'Sin campo'

// ── Componente principal ────────────────────────────────────────────────────

export default function FlushingOvuladosPage() {
  const sociedad   = useAuthStore((s) => s.sociedadActiva)
  const sociedadId = sociedad?.id
  const rol        = useAuthStore((s) => s.rol)
  const esVet      = rol === 'veterinario'

  const {
    registros, recordatorios, transferencias, plazos,
    cargar, cargarParaVet, loading,
    posponerRecordatorio, posponerRecordatorioAFecha,
  } = useCrianzaStore()

  const [ubicaciones, setUbicaciones] = useState<Map<string, UbicacionAnimal>>(new Map())

  // Estado de modales/acciones
  const [modalRec,    setModalRec]    = useState<RecordatorioCria | null>(null)
  const [posponiendo, setPosponiendo] = useState<string | null>(null)
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null)
  const [findeAviso,  setFindeAviso]  = useState<{ id: string; fecha: string; motivo: string } | null>(null)
  const [fechaManual, setFechaManual] = useState<{ id: string; valor: string } | null>(null)
  const [error,       setError]       = useState('')

  const hoy = hoyAR()

  // ── Carga de datos ──────────────────────────────────────────────────────

  useEffect(() => {
    if (sociedadId) {
      cargar(sociedadId)
      crianzaService.listarAnimalesReproductivos(sociedadId)
        .then((animales) => setUbicaciones(new Map(animales.map((a) => [a.id, {
          empresa: sociedad?.nombre ?? SIN_EMPRESA,
          campo: (a as { campo?: { nombre: string } | null }).campo?.nombre ?? SIN_CAMPO,
        }]))))
        .catch(() => setUbicaciones(new Map()))
    } else if (esVet) {
      cargarParaVet()
      crianzaService.listarAnimalesReproductivosVet()
        .then((animales: { id: string; marca?: { nombre: string } | null; campo?: { nombre: string } | null }[]) => setUbicaciones(new Map(animales.map((a) => [a.id, {
          empresa: a.marca?.nombre ?? SIN_EMPRESA,
          campo: a.campo?.nombre ?? SIN_CAMPO,
        }]))))
        .catch(() => setUbicaciones(new Map()))
    }
  }, [sociedadId, sociedad?.nombre, esVet]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Panel izquierdo: flushings pendientes ─────────────────────────────

  const flushingsPendientes = useMemo(() => {
    const hasta = sumarDias(hoy, 14)
    const pendientes: FlushingPendiente[] = []

    for (const r of recordatorios) {
      if (r.tipo !== 'Flushing') continue
      if (r.estado !== 'pendiente' && r.estado !== 'vencido') continue
      // Incluir vencidos (antes de hoy) y pendientes hasta +14 días
      if (r.fecha_vto > hasta) continue

      // Calcular fecha OV (patrón de FlushingBanner.ciclo())
      const origen = registros.find((reg) => reg.id === r.origen_registro_id)
      let fechaOv: string
      let diaCiclo: number
      if (origen) {
        fechaOv = sumarDias(origen.fecha, -(origen.ov_dias ?? 0))
        diaCiclo = diffDias(fechaOv, r.fecha_vto)
      } else {
        diaCiclo = plazos.donante_ov_a_flushing
        fechaOv = sumarDias(r.fecha_vto, -diaCiclo)
      }

      const ubi = ubicaciones.get(r.caballo_id)
      pendientes.push({
        recordatorio: r,
        fechaOv,
        diaCiclo,
        campo: ubi?.campo ?? SIN_CAMPO,
      })
    }

    // Ordenar: por fecha_vto asc, luego nombre
    pendientes.sort((a, b) =>
      a.recordatorio.fecha_vto.localeCompare(b.recordatorio.fecha_vto)
      || (a.recordatorio.caballo?.nombre ?? '').localeCompare(b.recordatorio.caballo?.nombre ?? '')
    )

    // Agrupar por fecha_vto
    const grupos = new Map<string, FlushingPendiente[]>()
    for (const p of pendientes) {
      const key = p.recordatorio.fecha_vto
      const grupo = grupos.get(key)
      if (grupo) grupo.push(p)
      else grupos.set(key, [p])
    }
    return grupos
  }, [recordatorios, registros, plazos, hoy, ubicaciones])

  // ── Panel derecho: ovulados por día ───────────────────────────────────

  const ovuladosMap = useMemo(() => {
    const desde = sumarDias(hoy, -3)
    const hasta = sumarDias(hoy, 7)
    return ovuladosPorDia(registros, transferencias, desde, hasta)
  }, [registros, transferencias, hoy])

  // Recalcular diasDesdeOv con referencia a hoy
  const ovuladosConDias = useMemo(() => {
    const result = new Map<string, OvuladoDia[]>()
    for (const [fecha, items] of ovuladosMap) {
      result.set(fecha, items.map((item) => ({
        ...item,
        diasDesdeOv: diffDias(item.fechaOv, hoy),
      })))
    }
    return result
  }, [ovuladosMap, hoy])

  // ── Lógica de posponer (replicada de FlushingBanner) ──────────────────

  async function ejecutarPosposicion(id: string, dias: number, motivo: string) {
    const destino = sumarDias(hoy, dias)
    if (esFinDeSemana(destino)) {
      setFindeAviso({ id, fecha: destino, motivo })
      setMenuAbierto(null)
      return
    }
    setPosponiendo(id)
    setError('')
    setMenuAbierto(null)
    try {
      await posponerRecordatorio(id, dias, motivo)
    } catch (err) {
      setError(mensajeError(err, 'No se pudo posponer el flushing.'))
    } finally {
      setPosponiendo(null)
    }
  }

  async function confirmarFecha(id: string, fecha: string, motivo: string) {
    setPosponiendo(id)
    setError('')
    setFindeAviso(null)
    setFechaManual(null)
    try {
      await posponerRecordatorioAFecha(id, fecha, motivo)
    } catch (err) {
      setError(mensajeError(err, 'No se pudo posponer el flushing.'))
    } finally {
      setPosponiendo(null)
    }
  }

  function abrirFechaManual(id: string) {
    setMenuAbierto(null)
    setFechaManual({ id, valor: sumarDias(hoy, 1) })
  }

  function confirmarFechaManual() {
    if (!fechaManual) return
    const { id, valor } = fechaManual
    if (valor < hoy) { setError('La fecha no puede ser anterior a hoy.'); return }
    if (esFinDeSemana(valor)) {
      setFindeAviso({ id, fecha: valor, motivo: 'manual' })
      setFechaManual(null)
      return
    }
    confirmarFecha(id, valor, 'manual')
  }

  // ── Helpers de render ─────────────────────────────────────────────────

  const totalFlushings = useMemo(() => {
    let count = 0
    for (const items of flushingsPendientes.values()) count += items.length
    return count
  }, [flushingsPendientes])

  const totalOvulados = useMemo(() => {
    let count = 0
    for (const items of ovuladosConDias.values()) count += items.length
    return count
  }, [ovuladosConDias])

  function headerDia(fecha: string): string {
    const ds = diaDeSemana(fecha).toUpperCase()
    const [, m, d] = fecha.split('-')
    return `${ds} ${d}/${m}`
  }

  const puedeActuar = esVet

  // ── Render ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Flushing y Ovulados</h1>
        <p className="text-sm text-slate-500">Vista unificada de flushings pendientes y animales ovulados</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Panel izquierdo: Flushings programados ─────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Droplets size={16} className="text-brand-600" />
            <h2 className="text-sm font-semibold text-slate-900">Flushings programados</h2>
            <span className="text-[11px] font-medium rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-brand-700">
              {totalFlushings}
            </span>
          </div>

          {totalFlushings === 0 && (
            <p className="text-sm text-slate-400 py-6 text-center">
              No hay flushings pendientes en los próximos 14 días.
            </p>
          )}

          {[...flushingsPendientes.entries()].map(([fecha, items]) => {
            const esVencido = fecha < hoy
            const esHoy = fecha === hoy
            return (
              <div key={fecha} className="rounded-lg border border-slate-200 overflow-hidden">
                {/* Header del día */}
                <div className={`px-3 py-2 flex items-center gap-2 ${
                  esVencido ? 'bg-red-50 border-b border-red-200' :
                  esHoy ? 'bg-brand-50 border-b border-brand-200' :
                  'bg-slate-50 border-b border-slate-200'
                }`}>
                  <span className={`text-xs font-semibold ${
                    esVencido ? 'text-red-700' : esHoy ? 'text-brand-700' : 'text-slate-700'
                  }`}>
                    {headerDia(fecha)}
                  </span>
                  {esVencido && (
                    <span className="text-[10px] font-medium rounded-full bg-red-100 text-red-700 px-2 py-0.5">
                      Vencido
                    </span>
                  )}
                  {esHoy && (
                    <span className="text-[10px] font-medium rounded-full bg-brand-100 text-brand-700 px-2 py-0.5">
                      Hoy
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400 ml-auto">{items.length}</span>
                </div>

                {/* Filas */}
                {items.map((fp) => {
                  const r = fp.recordatorio
                  const reprogramado = r.fecha_original && r.fecha_original !== r.fecha_vto
                  return (
                    <div key={r.id} className="flex items-center gap-3 flex-wrap px-3 py-2.5 border-b border-slate-100 last:border-b-0">
                      <NombreCaballoLink
                        id={r.caballo_id}
                        nombre={r.caballo?.nombre}
                        className="text-sm font-medium text-slate-900"
                      />

                      <span className="text-[11px] text-slate-500">{fp.campo}</span>

                      <span className="text-[11px] font-medium rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-brand-700 tabular-nums">
                        Día {fp.diaCiclo}
                      </span>

                      <span className="text-xs text-slate-400 tabular-nums">
                        OV {formatFecha(fp.fechaOv)}
                      </span>

                      {reprogramado && (
                        <span className="text-[10px] text-amber-600 tabular-nums">
                          (orig. {formatFecha(r.fecha_original)})
                        </span>
                      )}

                      {puedeActuar && (
                        <div className="ml-auto flex items-center gap-2 relative">
                          {/* Dropdown posponer */}
                          <div className="relative">
                            <button
                              onClick={() => setMenuAbierto(menuAbierto === r.id ? null : r.id)}
                              disabled={posponiendo === r.id}
                              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-slate-300 text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                            >
                              <Clock3 size={13} />
                              {posponiendo === r.id ? 'Posponiendo…' : 'Posponer'}
                              <ChevronDown size={12} />
                            </button>

                            {menuAbierto === r.id && (
                              <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20 min-w-[180px]">
                                <button
                                  onClick={() => ejecutarPosposicion(r.id, 1, 'pospuesto_1d')}
                                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                                >
                                  Mañana · {diaDeSemana(sumarDias(hoy, 1))} {formatFecha(sumarDias(hoy, 1))}
                                </button>
                                <button
                                  onClick={() => ejecutarPosposicion(r.id, 2, 'pospuesto_2d')}
                                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                                >
                                  2 días · {diaDeSemana(sumarDias(hoy, 2))} {formatFecha(sumarDias(hoy, 2))}
                                </button>
                                <hr className="my-1 border-slate-100" />
                                <button
                                  onClick={() => abrirFechaManual(r.id)}
                                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                                >
                                  <Calendar size={12} />
                                  Elegir fecha
                                </button>
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => setModalRec(r)}
                            className="text-xs font-medium px-3 py-1.5 rounded-md bg-brand-500 hover:bg-brand-400 text-white transition-colors"
                          >
                            Registrar flushing
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}

          {error && (
            <p className="text-xs text-red-600 px-1">{error}</p>
          )}
        </div>

        {/* ── Panel derecho: Ovulados por día ────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Egg size={16} className="text-purple-600" />
            <h2 className="text-sm font-semibold text-slate-900">Ovulados por día</h2>
            <span className="text-[11px] font-medium rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-purple-700">
              {totalOvulados}
            </span>
          </div>

          {totalOvulados === 0 && (
            <p className="text-sm text-slate-400 py-6 text-center">
              No hay animales ovulados en el rango de fechas.
            </p>
          )}

          {[...ovuladosConDias.entries()].map(([fechaOv, items]) => {
            const donantes   = items.filter((i) => i.rol === 'Donante')
            const receptoras = items.filter((i) => i.rol === 'Receptora')
            return (
              <div key={fechaOv} className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700">
                    {headerDia(fechaOv)}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    OV {formatFecha(fechaOv)}
                  </span>
                  <span className="text-[10px] text-slate-400 ml-auto">{items.length}</span>
                </div>

                {donantes.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 bg-teal-50/50 border-b border-slate-100">
                      <span className="text-[10px] font-semibold text-teal-700 uppercase tracking-wide">Donantes</span>
                    </div>
                    {donantes.map((ov) => (
                      <FilaOvulado key={ov.caballoId} ov={ov} ubicaciones={ubicaciones} hoy={hoy} />
                    ))}
                  </>
                )}

                {receptoras.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 bg-purple-50/50 border-b border-slate-100">
                      <span className="text-[10px] font-semibold text-purple-700 uppercase tracking-wide">Receptoras</span>
                    </div>
                    {receptoras.map((ov) => (
                      <FilaOvulado key={ov.caballoId} ov={ov} ubicaciones={ubicaciones} hoy={hoy} />
                    ))}
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Modales ──────────────────────────────────────────────────── */}

      {/* Modal selector de fecha manual */}
      {fechaManual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setFechaManual(null)}>
          <div className="bg-white rounded-lg shadow-xl p-5 w-80 space-y-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold text-slate-900">Elegir nueva fecha</p>
            <input
              type="date"
              min={hoy}
              value={fechaManual.valor}
              onChange={(e) => setFechaManual({ ...fechaManual, valor: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
            {fechaManual.valor && esFinDeSemana(fechaManual.valor) && (
              <p className="text-xs text-amber-600">
                Cae {esSabado(fechaManual.valor) ? 'sábado' : 'domingo'} — al confirmar se te ofrecerá moverlo.
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setFechaManual(null)} className="text-xs px-3 py-1.5 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={confirmarFechaManual} className="text-xs font-medium px-3 py-1.5 rounded-md bg-brand-500 text-white hover:bg-brand-400">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Aviso de fin de semana */}
      {findeAviso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setFindeAviso(null)}>
          <div className="bg-white rounded-lg shadow-xl p-5 w-80 space-y-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold text-slate-900">
              Cae {esSabado(findeAviso.fecha) ? 'sábado' : 'domingo'}
            </p>
            <p className="text-xs text-slate-600">
              El flushing quedaría para el{' '}
              <span className="font-medium">{diaDeSemana(findeAviso.fecha)} {formatFecha(findeAviso.fecha)}</span>.
              ¿Querés pasarlo al lunes?
            </p>
            <div className="flex flex-col gap-1.5 pt-1">
              {(() => {
                const esS = esSabado(findeAviso.fecha)
                const lunes = sumarDias(findeAviso.fecha, esS ? 2 : 1)
                return (
                  <>
                    <button
                      onClick={() => confirmarFecha(findeAviso.id, lunes, `${findeAviso.motivo}_movido_lun`)}
                      className="w-full text-left px-3 py-2 text-xs rounded-md border border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100 font-medium"
                    >
                      Sí, pasar al lunes {formatFecha(lunes)}
                    </button>
                    <button
                      onClick={() => confirmarFecha(findeAviso.id, findeAviso.fecha, findeAviso.motivo)}
                      className="w-full text-left px-3 py-2 text-xs rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      No, mantener {esSabado(findeAviso.fecha) ? 'sábado' : 'domingo'} {formatFecha(findeAviso.fecha)}
                    </button>
                    <button
                      onClick={() => { setFindeAviso(null); abrirFechaManual(findeAviso.id) }}
                      className="w-full text-left px-3 py-2 text-xs rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      Elegir otra fecha
                    </button>
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {modalRec && (
        <FlushingModal
          recordatorio={modalRec}
          onClose={() => setModalRec(null)}
          onSuccess={() => setModalRec(null)}
        />
      )}
    </div>
  )
}

// ── Subcomponente: fila de ovulado ────────────────────────────────────────

function FilaOvulado({ ov, ubicaciones, hoy }: {
  ov: OvuladoDia
  ubicaciones: Map<string, UbicacionAnimal>
  hoy: string
}) {
  const ubi = ubicaciones.get(ov.caballoId)
  const dias = diffDias(ov.fechaOv, hoy)

  return (
    <div className={`flex items-center gap-3 flex-wrap px-3 py-2 border-b border-slate-100 last:border-b-0 ${
      ov.yaTransferida ? 'opacity-50' : ''
    }`}>
      <NombreCaballoLink
        id={ov.caballoId}
        nombre={ov.nombre}
        className={`text-sm font-medium ${ov.yaTransferida ? 'line-through text-slate-400' : 'text-slate-900'}`}
      />

      <span className="text-[11px] text-slate-500">{ubi?.campo ?? SIN_CAMPO}</span>

      <span className="text-[11px] font-medium rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-purple-700 tabular-nums">
        +{dias}d OV
      </span>

      {ov.yaTransferida && (
        <span className="text-[10px] font-medium rounded-full bg-slate-200 text-slate-600 px-2 py-0.5">
          Transferida
        </span>
      )}
    </div>
  )
}
