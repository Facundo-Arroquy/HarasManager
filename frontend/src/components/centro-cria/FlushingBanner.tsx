import { useState } from 'react'
import { Droplets, Clock3, ChevronDown, Calendar } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useCrianzaStore } from '../../store/crianzaStore'
import type { RecordatorioCria } from '../../types/crianza'
import { hoyAR, formatFecha, sumarDias, diffDias, esFinDeSemana, esSabado, diaDeSemana } from '../../utils/fecha'
import { mensajeError } from '../../utils/error'
import NombreCaballoLink from '../domain/NombreCaballoLink'
import FlushingModal from './FlushingModal'

/**
 * Aviso de los flushings que tocan hoy.
 *
 * Muestra únicamente los recordatorios de tipo Flushing que vencen **el día
 * configurado** por el veterinario (`donante_ov_a_flushing`, que se aplica al
 * generar el recordatorio). No lista atrasados: si el flushing no se hace hoy,
 * el camino es posponerlo explícitamente y aparece mañana (día X+1).
 */
export default function FlushingBanner() {
  const rol = useAuthStore((s) => s.rol)
  const { recordatorios, registros, plazos, posponerRecordatorio, posponerRecordatorioAFecha } = useCrianzaStore()

  const [modalRec,    setModalRec]    = useState<RecordatorioCria | null>(null)
  const [posponiendo, setPosponiendo] = useState<string | null>(null)
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null)
  const [findeAviso,  setFindeAviso]  = useState<{ id: string; fecha: string; motivo: string } | null>(null)
  const [fechaManual, setFechaManual] = useState<{ id: string; valor: string } | null>(null)
  const [error,       setError]       = useState('')

  const hoy = hoyAR()
  const deHoy = recordatorios.filter(
    (r) => r.tipo === 'Flushing' && r.estado === 'pendiente' && r.fecha_vto === hoy
  )

  if (deHoy.length === 0) return null

  const puedeRegistrar = rol === 'veterinario'

  /**
   * Fecha de ovulación y día del ciclo.
   */
  function ciclo(r: RecordatorioCria): { fechaOv: string; dia: number } {
    const origen = registros.find((reg) => reg.id === r.origen_registro_id)
    if (origen) {
      const fechaOv = sumarDias(origen.fecha, -(origen.ov_dias ?? 0))
      return { fechaOv, dia: diffDias(fechaOv, r.fecha_vto) }
    }
    const dia = plazos.donante_ov_a_flushing
    return { fechaOv: sumarDias(r.fecha_vto, -dia), dia }
  }

  async function ejecutarPosposicion(id: string, dias: number, motivo: string) {
    const destino = sumarDias(hoy, dias)
    // Si cae fin de semana → pedir confirmación
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

  return (
    <>
      <div className="rounded-lg border border-brand-200 border-l-[3px] border-l-brand-500 bg-white overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 pt-3 pb-2.5">
          <Droplets size={16} className="text-brand-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">Flushings para hacer</p>
            <p className="text-xs text-slate-500">
              Vencen hoy, al día configurado desde la ovulación
            </p>
          </div>
          <span className="ml-auto text-[11px] font-medium rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-brand-700">
            {deHoy.length}
          </span>
        </div>

        {deHoy.map((r) => {
          const { fechaOv, dia } = ciclo(r)
          return (
          <div
            key={r.id}
            className="flex items-center gap-3 flex-wrap border-t border-slate-100 px-4 py-2.5"
          >
            <NombreCaballoLink
              id={r.caballo_id}
              nombre={r.caballo?.nombre}
              className="text-sm font-medium text-slate-900"
            />
            <span className="text-[11px] font-medium rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-brand-700 tabular-nums">
              Día {dia} · hoy
            </span>
            <span className="text-xs text-slate-400 tabular-nums">
              OV {formatFecha(fechaOv)}
            </span>

            {r.fecha_original && r.fecha_original !== r.fecha_vto && (
              <span className="text-[10px] text-amber-600 tabular-nums">
                (orig. {formatFecha(r.fecha_original)})
              </span>
            )}

            {puedeRegistrar && (
              <div className="ml-auto flex items-center gap-2 relative">
                {/* Botón posponer con dropdown */}
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

        {error && (
          <p className="border-t border-slate-100 px-4 py-2 text-xs text-red-600">{error}</p>
        )}
      </div>

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
    </>
  )
}
