import { useState, useEffect, useCallback } from 'react'
import { ArrowLeftRight, CheckSquare, Square, AlertTriangle, CheckCircle2, FileText, Trash2, ExternalLink } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { caballoService } from '../../services/caballoService'
import {
  transferEmpresaService,
  type SociedadItem,
  type TransferenciaEmpresa,
} from '../../services/transferEmpresaService'
import { historialService } from '../../services/historialService'
import { crianzaService } from '../../services/crianzaService'
import { generarFichaHtml } from '../../utils/exportarFichaCaballo'
import { fichaHistoricaService, type FichaHistorica } from '../../services/fichaHistoricaService'
import { useAuthStore } from '../../store/authStore'
import { formatFecha } from '../../utils/fecha'

export default function TransferirEmpresaPage() {
  const { sociedadActiva } = useAuth()
  const rol = useAuthStore((s) => s.rol)
  const sociedadId = sociedadActiva?.id ?? ''

  const [caballos, setCaballos] = useState<any[]>([])
  const [sociedades, setSociedades] = useState<SociedadItem[]>([])
  const [historial, setHistorial] = useState<TransferenciaEmpresa[]>([])
  const [fichasHistoricas, setFichasHistoricas] = useState<FichaHistorica[]>([])

  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [tipo, setTipo] = useState<'registrada' | 'no_registrada'>('registrada')
  const [sociedadDestinoId, setSociedadDestinoId] = useState('')
  const [entidadNombre, setEntidadNombre] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingStep, setSavingStep] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)
  const [eliminando, setEliminando] = useState<string | null>(null)

  const cargarDatos = useCallback(async () => {
    if (!sociedadId) return
    const [listaCaballos, listaSociedades, listaHistorial, listaFichas] = await Promise.all([
      caballoService.listar(sociedadId),
      transferEmpresaService.listarSociedades(sociedadId),
      transferEmpresaService.listarHistorial(sociedadId),
      fichaHistoricaService.listar(sociedadId),
    ])
    setCaballos(listaCaballos)
    setSociedades(listaSociedades)
    setHistorial(listaHistorial)
    setFichasHistoricas(listaFichas)
  }, [sociedadId])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  const toggleSeleccion = (id: string) => {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleTodos = () => {
    if (seleccionados.size === caballos.length) {
      setSeleccionados(new Set())
    } else {
      setSeleccionados(new Set(caballos.map((c) => c.id)))
    }
  }

  const puedeConfirmar =
    seleccionados.size > 0 &&
    (tipo === 'registrada' ? !!sociedadDestinoId : entidadNombre.trim().length > 0)

  const confirmar = async () => {
    if (!puedeConfirmar) return
    setSaving(true)
    setError(null)
    setExito(null)

    try {
      // 1. Generar y guardar ficha histórica de cada caballo ANTES de la transferencia
      const caballosSeleccionados = caballos.filter((c) => seleccionados.has(c.id))
      setSavingStep(`Generando fichas históricas (0/${caballosSeleccionados.length})…`)

      await Promise.allSettled(
        caballosSeleccionados.map(async (caballo, idx) => {
          try {
            const [hist, regs, flush, transf] = await Promise.all([
              historialService.listarPorCaballo(caballo.id),
              crianzaService.listarRegistrosPorCaballo(caballo.id),
              crianzaService.listarFlushingsPorCaballo(caballo.id),
              crianzaService.listarTransferenciasPorCaballo(caballo.id),
            ])

            const html = await generarFichaHtml({
              caballo,
              historial: hist as any[],
              caballos,   // todos los caballos para resolver genealogía
              registrosCria: regs,
              flushings: flush,
              transferencias: transf,
            })

            await fichaHistoricaService.guardar({
              caballoId: caballo.id,
              nombre: caballo.nombre,
              sociedadId,
              html,
            })

            setSavingStep(`Generando fichas históricas (${idx + 1}/${caballosSeleccionados.length})…`)
          } catch (e) {
            console.error(`Error guardando ficha de ${caballo.nombre}:`, e)
          }
        })
      )

      // 2. Ejecutar la transferencia
      setSavingStep('Transfiriendo caballos…')
      const sociedadDest = sociedades.find((s) => s.id === sociedadDestinoId)
      await transferEmpresaService.transferir(
        {
          caballoIds: Array.from(seleccionados),
          tipo,
          sociedadDestinoId: tipo === 'registrada' ? sociedadDestinoId : undefined,
          sociedadDestinoNombre: tipo === 'registrada' ? sociedadDest?.nombre : undefined,
          entidadNombre: tipo === 'no_registrada' ? entidadNombre.trim() : undefined,
        },
        sociedadId
      )

      setExito(
        `${seleccionados.size} caballo${seleccionados.size > 1 ? 's' : ''} transferido${seleccionados.size > 1 ? 's' : ''} correctamente. Se guardó la ficha histórica de cada animal.`
      )
      setSeleccionados(new Set())
      setSociedadDestinoId('')
      setEntidadNombre('')
      await cargarDatos()
    } catch (e: any) {
      setError(e?.message ?? 'Error al transferir')
    } finally {
      setSaving(false)
      setSavingStep(null)
    }
  }

  async function handleEliminarFicha(ficha: FichaHistorica) {
    if (!confirm(`¿Eliminar la ficha histórica de ${ficha.caballo_nombre}? Esta acción no se puede deshacer.`)) return
    setEliminando(ficha.id)
    try {
      await fichaHistoricaService.eliminar(ficha)
      setFichasHistoricas((prev) => prev.filter((f) => f.id !== ficha.id))
    } catch (e: any) {
      alert(`Error al eliminar: ${e?.message}`)
    } finally {
      setEliminando(null)
    }
  }

  function resolverNombreCaballo(caballoId: string, nombreGuardado: string): string {
    return caballos.find((c) => c.id === caballoId)?.nombre ?? nombreGuardado ?? caballoId
  }

  const todosSeleccionados = caballos.length > 0 && seleccionados.size === caballos.length

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-8">
      {/* Header */}
      <div className="border-b border-slate-200 px-4 py-4 md:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
            <ArrowLeftRight size={18} className="text-slate-600" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900">Transferir caballos</h1>
            <p className="text-xs text-slate-400">Movimiento entre empresas o entidades externas</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 md:px-8 space-y-6 max-w-3xl">
        {/* Mensajes */}
        {exito && (
          <div className="flex items-center gap-2 rounded-lg bg-brand-50 border border-emerald-800 px-4 py-3 text-sm text-brand-500">
            <CheckCircle2 size={16} className="shrink-0" />
            {exito}
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-red-950 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Lista de caballos */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {/* Cabecera */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-slate-100/40">
            <button
              onClick={toggleTodos}
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              {todosSeleccionados ? (
                <CheckSquare size={16} className="text-brand-600" />
              ) : (
                <Square size={16} className="text-slate-400" />
              )}
              Seleccionar todos
            </button>
            {seleccionados.size > 0 && (
              <span className="ml-auto text-xs font-medium text-brand-600">
                {seleccionados.size} seleccionado{seleccionados.size > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Filas */}
          {caballos.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-400 text-center">
              No hay caballos disponibles para transferir.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {caballos.map((caballo) => {
                const activo = seleccionados.has(caballo.id)
                return (
                  <li key={caballo.id}>
                    <button
                      onClick={() => toggleSeleccion(caballo.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                        activo ? 'bg-slate-100' : 'hover:bg-slate-50'
                      }`}
                    >
                      {activo ? (
                        <CheckSquare size={16} className="shrink-0 text-brand-600" />
                      ) : (
                        <Square size={16} className="shrink-0 text-slate-400" />
                      )}
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-slate-900 truncate">
                          {caballo.nombre}
                        </span>
                        <span className="block text-xs text-slate-400">
                          {caballo.categoria}
                          {caballo.campo?.nombre ? ` · ${caballo.campo.nombre}` : ' · Sin campo'}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Panel destino — visible solo si hay seleccionados */}
        {seleccionados.size > 0 && (
          <div className="rounded-xl border border-slate-300 bg-white p-4 space-y-4">
            <p className="text-sm font-medium text-slate-700">Destino</p>

            {/* Selector de tipo */}
            <div className="flex gap-4">
              {(['registrada', 'no_registrada'] as const).map((t) => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="tipo"
                    value={t}
                    checked={tipo === t}
                    onChange={() => setTipo(t)}
                    className="accent-emerald-500"
                  />
                  <span className="text-sm text-slate-600">
                    {t === 'registrada' ? 'Empresa registrada' : 'Entidad no registrada'}
                  </span>
                </label>
              ))}
            </div>

            {/* Selector de destino */}
            {tipo === 'registrada' ? (
              <select
                value={sociedadDestinoId}
                onChange={(e) => setSociedadDestinoId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none"
              >
                <option value="">— Seleccionar empresa —</option>
                {sociedades.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Nombre de la entidad"
                  value={entidadNombre}
                  onChange={(e) => setEntidadNombre(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none"
                />
                <div className="flex items-start gap-2 rounded-lg bg-brand-50 border border-brand-200 px-3 py-2">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5 text-brand-600" />
                  <p className="text-xs text-brand-700">
                    Los caballos quedarán inactivos pero se guardará un registro histórico.
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={confirmar}
              disabled={!puedeConfirmar || saving}
              className="w-full rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? (savingStep ?? 'Procesando…') : 'Confirmar transferencia'}
            </button>
          </div>
        )}

        {/* Historial de transferencias */}
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-3">
            Historial de transferencias
          </p>
          {historial.length === 0 ? (
            <p className="text-sm text-slate-400">Sin transferencias registradas.</p>
          ) : (
            <ul className="space-y-2">
              {historial.map((t) => {
                const fecha = new Date(t.fecha).toLocaleDateString('es-AR', {
                  day: '2-digit',
                  month: '2-digit',
                })
                const destino =
                  t.tipo === 'registrada'
                    ? t.sociedadDestinoNombre ?? t.sociedadDestinoId
                    : t.entidadNombre
                return (
                  <li
                    key={t.id}
                    className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
                  >
                    <ArrowLeftRight size={14} className="mt-0.5 shrink-0 text-slate-400" />
                    <div className="min-w-0">
                      <p className="text-sm text-slate-700">
                        <span className="font-medium">{fecha}</span>
                        {' · '}
                        {t.caballoNombres.length === 1
                          ? t.caballoNombres[0]
                          : `${t.caballoNombres.length} caballos`}
                        {' → '}
                        <span className="text-slate-600">{destino}</span>
                      </p>
                      <p className="text-xs text-slate-400">
                        {t.tipo === 'registrada' ? 'Empresa registrada' : 'Entidad no registrada'}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Fichas históricas guardadas */}
        {fichasHistoricas.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-3">
              Fichas históricas guardadas
            </p>
            <ul className="space-y-2">
              {fichasHistoricas.map((ficha) => {
                const nombre = resolverNombreCaballo(ficha.caballo_id, ficha.caballo_nombre)
                const fecha = formatFecha(ficha.fecha.slice(0, 10))
                return (
                  <li
                    key={ficha.id}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
                  >
                    <FileText size={14} className="shrink-0 text-slate-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{nombre}</p>
                      <p className="text-xs text-slate-400">Generada el {fecha}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => fichaHistoricaService.abrir(ficha)}
                        title="Ver ficha"
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors"
                      >
                        <ExternalLink size={12} /> Ver
                      </button>
                      {rol === 'admin' && (
                        <button
                          onClick={() => handleEliminarFicha(ficha)}
                          disabled={eliminando === ficha.id}
                          title="Eliminar ficha"
                          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-500 hover:text-red-600 hover:bg-red-950 transition-colors disabled:opacity-40"
                        >
                          <Trash2 size={12} />
                          {eliminando === ficha.id ? '…' : 'Eliminar'}
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
