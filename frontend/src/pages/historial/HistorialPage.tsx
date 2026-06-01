import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Droplets, ArrowLeftRight, Stethoscope, FlaskConical, GitBranch, Printer, ImageIcon } from 'lucide-react'
import Tooltip from '../../components/ui/Tooltip'
import { caballoService, type Caballo } from '../../services/caballoService'
import { historialService } from '../../services/historialService'
import { crianzaService } from '../../services/crianzaService'
import { useAuthStore } from '../../store/authStore'
import { calcularEdad } from '../../utils/fecha'
import { exportarFichaCaballo } from '../../utils/exportarFichaCaballo'
import Spinner from '../../components/ui/Spinner'
import FotoCaballo from '../../components/domain/FotoCaballo'
import HistorialCard, { type HistorialEntry } from '../../components/domain/HistorialCard'
import NuevaConsultaModal from '../../components/domain/NuevaConsultaModal'
import ArbolGenealogico from '../../components/domain/ArbolGenealogico'
import type { RegistroClinicoCria, Flushing, TransferenciaEmbrionaria } from '../../types/crianza'

const CATEGORIA_STYLE: Record<string, string> = {
  Yegua:    'bg-pink-950 text-pink-700 ring-1 ring-pink-800',
  Padrillo: 'bg-blue-950 text-blue-700 ring-1 ring-blue-800',
  Caballo:  'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  Potrillo: 'bg-brand-950 text-brand-700 ring-1 ring-brand-800',
}

export default function HistorialPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const rol  = useAuthStore((s) => s.rol)
  const user = useAuthStore((s) => s.user)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [caballo,    setCaballo]    = useState<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [historial,  setHistorial]  = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [showModal,   setShowModal]   = useState(false)
  const [entryToEdit, setEntryToEdit] = useState<HistorialEntry | null>(null)

  const [tab, setTab] = useState<'clinico' | 'reproductivo' | 'genealogia' | 'foto'>('clinico')
  const [repLoading,    setRepLoading]    = useState(false)
  const [registrosCria, setRegistrosCria] = useState<RegistroClinicoCria[]>([])
  const [flushings,     setFlushings]     = useState<Flushing[]>([])
  const [transferencias,setTransferencias]= useState<TransferenciaEmbrionaria[]>([])
  const [todosCaballos, setTodosCaballos] = useState<Caballo[]>([])

  function cargarHistorial() {
    if (!id) return
    historialService
      .listarPorCaballo(id)
      .then((h) => setHistorial(h as object[]))
      .catch((e: Error) => setError(e.message))
  }

  async function cargarReproductivo() {
    if (!id || repLoading) return
    setRepLoading(true)
    try {
      const [regs, flush, transf] = await Promise.all([
        crianzaService.listarRegistrosPorCaballo(id),
        crianzaService.listarFlushingsPorCaballo(id),
        crianzaService.listarTransferenciasPorCaballo(id),
      ])
      setRegistrosCria(regs)
      setFlushings(flush)
      setTransferencias(transf)
    } finally {
      setRepLoading(false)
    }
  }

  function handleTabReproductivo() {
    setTab('reproductivo')
    if (registrosCria.length === 0 && flushings.length === 0 && transferencias.length === 0) {
      cargarReproductivo()
    }
  }

  function handleTabGenealogia() {
    setTab('genealogia')
    if (todosCaballos.length === 0 && caballo?.sociedad_id) {
      caballoService.listar(caballo.sociedad_id)
        .then((data) => setTodosCaballos(data as Caballo[]))
        .catch(() => {})
    }
  }

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      caballoService.obtener(id),
      historialService.listarPorCaballo(id),
    ])
      .then(([cab, hist]) => {
        setCaballo(cab)
        setHistorial(hist as object[])
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-900 bg-red-950 p-4 text-sm text-red-700">{error}</div>
      </div>
    )
  }

  const badgeClass = CATEGORIA_STYLE[caballo?.categoria ?? ''] ?? CATEGORIA_STYLE['Caballo']

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Volver */}
      <button
        onClick={() => navigate('/caballos')}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 transition-colors mb-5"
      >
        <ArrowLeft size={15} /> Volver a caballos
      </button>

      {/* Cabecera del caballo */}
      {caballo && (
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
          <div className="flex items-center gap-4">
            <FotoCaballo
              caballoId={caballo.id}
              nombre={caballo.nombre}
              canEdit={rol === 'admin' || rol === 'veterinario'}
              size={72}
            />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-slate-900">{caballo.nombre}</h1>
                {caballo.categoria && (
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${badgeClass}`}>
                    {caballo.categoria}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-400">
                {caballo.cat_raza?.nombre ?? '—'}
                {caballo.cat_pelaje?.nombre ? ` · ${caballo.cat_pelaje.nombre}` : ''}
                {caballo.fecha_nacimiento  ? ` · ${calcularEdad(caballo.fecha_nacimiento)}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Exportar ficha — admin y veterinario */}
            {(rol === 'admin' || rol === 'veterinario') && (
              <>
                <button
                  onClick={() => exportarFichaCaballo({
                    caballo,
                    historial,
                    caballos: todosCaballos,
                    registrosCria,
                    flushings,
                    transferencias,
                  }).catch(console.error)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 hover:border-slate-400 bg-slate-100 hover:bg-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors"
                >
                  <Printer size={15} /> Exportar PDF
                </button>
                <Tooltip text="Descarga la ficha completa del caballo: datos generales, historial clínico y registros reproductivos." />
              </>
            )}
            {/* Solo veterinario — caballo ya pre-seleccionado */}
            {rol === 'veterinario' && (
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-1.5 rounded-lg bg-brand-500 hover:bg-brand-500 px-3 py-2 text-sm font-medium text-white transition-colors"
              >
                <Plus size={15} /> Nueva consulta
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      {(rol === 'veterinario' || rol === 'admin') && (
        <div className="flex gap-1 border-b border-slate-200 mb-5">
          <button
            onClick={() => setTab('clinico')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === 'clinico'
                ? 'border-brand-500 text-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Stethoscope size={13} />
            Clínico
          </button>
          <button
            onClick={handleTabReproductivo}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === 'reproductivo'
                ? 'border-blue-500 text-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <FlaskConical size={13} />
            Reproductivo
            <Tooltip text="Muestra ecografías, flushings y transferencias de embriones registradas para este animal." />
          </button>
          <button
            onClick={handleTabGenealogia}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === 'genealogia'
                ? 'border-brand-500 text-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <GitBranch size={13} />
            Genealogía
            <Tooltip text="Árbol genealógico con padre y madre. Se completa asignando los progenitores desde la ficha de edición del caballo." />
          </button>
          <button
            onClick={() => setTab('foto')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === 'foto'
                ? 'border-brand-500 text-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <ImageIcon size={13} />
            Foto
          </button>
        </div>
      )}

      {/* Tab: Clínico */}
      {tab === 'clinico' && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Historial clínico
            </h2>
            <span className="text-xs text-slate-400">{historial.length} registros</span>
          </div>

          {historial.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center text-slate-400 text-sm">
              Sin registros clínicos para este animal.
            </div>
          ) : (
            <div className="space-y-3">
              {historial.map((entry) => {
                const e = entry as HistorialEntry
                return (
                  <HistorialCard
                    key={e.id}
                    entry={e}
                    onEditar={e.creado_por === user?.id ? () => setEntryToEdit(e) : undefined}
                  />
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Tab: Reproductivo */}
      {tab === 'reproductivo' && (
        <div className="space-y-6">
          {repLoading ? (
            <div className="flex justify-center py-12"><Spinner size="lg" /></div>
          ) : (
            <>
              {/* Registros clínicos cría */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <FlaskConical size={13} className="text-slate-400" />
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                    Registros reproductivos
                  </h3>
                  <span className="text-xs text-slate-600">{registrosCria.length}</span>
                </div>
                {registrosCria.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">Sin registros reproductivos.</p>
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-200">
                    {registrosCria.map((r) => (
                      <div key={r.id} className="px-4 py-3 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex flex-wrap gap-1">
                              {[...r.ovario_izq.map((c) => `OI:${c}`), ...r.ovario_der.map((c) => `OD:${c}`)].map((c) => (
                                <span key={c} className="text-[11px] bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">{c}</span>
                              ))}
                              {r.utero.map((c) => (
                                <span key={c} className="text-[11px] bg-slate-100 text-slate-500 rounded px-1.5 py-0.5">{c}</span>
                              ))}
                              {r.obs_chips.map((c) => (
                                <span key={c} className="text-[11px] bg-blue-50 text-blue-700 rounded px-1.5 py-0.5">{c}</span>
                              ))}
                            </div>
                            {r.padrillo && (
                              <p className="text-xs text-slate-400">× {r.padrillo.nombre}</p>
                            )}
                            {r.observaciones && (
                              <p className="text-xs text-slate-400 italic">{r.observaciones}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-slate-500">{formatFecha(r.fecha)}</p>
                            {r.veterinario && (
                              <p className="text-[11px] text-slate-400">Dr/a. {r.veterinario.apellido}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Flushings */}
              {flushings.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Droplets size={13} className="text-brand-500" />
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                      Flushings
                    </h3>
                    <span className="text-xs text-slate-600">{flushings.length}</span>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-200">
                    {flushings.map((f) => (
                      <div key={f.id} className={`px-4 py-3 text-sm ${f.cancelado ? 'opacity-50' : ''}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            {f.es_negativo ? (
                              <span className="text-slate-400">Negativo</span>
                            ) : (
                              <span className="text-brand-600 font-medium">
                                {f.cantidad} {f.cantidad === 1 ? 'embrión' : 'embriones'}
                                {f.estadio ? ` · ${f.estadio}` : ''}
                                {f.grado != null ? ` · G${f.grado}` : ''}
                              </span>
                            )}
                            {f.padrillo && (
                              <p className="text-xs text-slate-400 mt-0.5">× {f.padrillo.nombre}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-slate-500">{formatFecha(f.fecha)}</p>
                            {f.veterinario && (
                              <p className="text-[11px] text-slate-400">Dr/a. {f.veterinario.apellido}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Transferencias */}
              {transferencias.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <ArrowLeftRight size={13} className="text-blue-600" />
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                      Transferencias
                    </h3>
                    <span className="text-xs text-slate-600">{transferencias.length}</span>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-200">
                    {transferencias.map((t) => (
                      <div key={t.id} className="px-4 py-3 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 text-slate-600">
                              <span>{t.receptora?.nombre ?? '—'}</span>
                              <ArrowLeftRight size={10} className="text-slate-400" />
                              <span className="text-slate-500">{t.donante?.nombre ?? '—'}</span>
                              {t.padrillo && (
                                <>
                                  <span className="text-slate-400">×</span>
                                  <span className="text-slate-400">{t.padrillo.nombre}</span>
                                </>
                              )}
                            </div>
                            <div className="flex gap-2 mt-1 text-xs text-slate-400">
                              {t.clasificacion && <span>{t.clasificacion}</span>}
                              {t.cl_calidad && <span>CL {t.cl_calidad}</span>}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-slate-500">{formatFecha(t.fecha)}</p>
                            {t.veterinario && (
                              <p className="text-[11px] text-slate-400">Dr/a. {t.veterinario.apellido}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {registrosCria.length === 0 && flushings.length === 0 && transferencias.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center text-slate-400 text-sm">
                  Sin registros reproductivos para este animal.
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Tab: Genealogía */}
      {tab === 'genealogia' && caballo && (
        <ArbolGenealogico caballo={caballo as Caballo} caballos={todosCaballos} />
      )}

      {/* Tab: Foto */}
      {tab === 'foto' && caballo && (
        <div className="flex flex-col items-center py-8 gap-5">
          <FotoCaballo
            caballoId={caballo.id}
            nombre={caballo.nombre}
            canEdit={rol === 'admin' || rol === 'veterinario'}
            size={260}
          />
          {(rol === 'admin' || rol === 'veterinario') && (
            <p className="text-xs text-slate-400">
              Hacé click en el ícono de cámara para cambiar la foto
            </p>
          )}
        </div>
      )}

      {/* Modal nueva consulta o edición */}
      {(showModal || !!entryToEdit) && id && (
        <NuevaConsultaModal
          caballoId={id}
          entryToEdit={entryToEdit ?? undefined}
          onClose={() => { setShowModal(false); setEntryToEdit(null) }}
          onSuccess={cargarHistorial}
        />
      )}
    </div>
  )
}

function formatFecha(fecha: string): string {
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y.slice(2)}`
}
