import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import { caballoService } from '../../services/caballoService'
import { historialService } from '../../services/historialService'
import { useAuthStore } from '../../store/authStore'
import { calcularEdad } from '../../utils/fecha'
import Spinner from '../../components/ui/Spinner'
import HistorialCard from '../../components/domain/HistorialCard'
import NuevaConsultaModal from '../../components/domain/NuevaConsultaModal'

const CATEGORIA_STYLE: Record<string, string> = {
  Yegua:    'bg-pink-950 text-pink-300 ring-1 ring-pink-800',
  Padrillo: 'bg-blue-950 text-blue-300 ring-1 ring-blue-800',
  Caballo:  'bg-zinc-800 text-zinc-300 ring-1 ring-zinc-700',
  Potrillo: 'bg-amber-950 text-amber-300 ring-1 ring-amber-800',
}

export default function HistorialPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const rol = useAuthStore((s) => s.rol)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [caballo,    setCaballo]    = useState<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [historial,  setHistorial]  = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [showModal,  setShowModal]  = useState(false)

  function cargarHistorial() {
    if (!id) return
    historialService
      .listarPorCaballo(id)
      .then((h) => setHistorial(h as object[]))
      .catch((e: Error) => setError(e.message))
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
        <div className="rounded-lg border border-red-900 bg-red-950 p-4 text-sm text-red-300">{error}</div>
      </div>
    )
  }

  const badgeClass = CATEGORIA_STYLE[caballo?.categoria ?? ''] ?? CATEGORIA_STYLE['Caballo']

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Volver */}
      <button
        onClick={() => navigate('/caballos')}
        className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-200 transition-colors mb-5"
      >
        <ArrowLeft size={15} /> Volver a caballos
      </button>

      {/* Cabecera del caballo */}
      {caballo && (
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-zinc-100">{caballo.nombre}</h1>
              {caballo.categoria && (
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${badgeClass}`}>
                  {caballo.categoria}
                </span>
              )}
            </div>
            <p className="text-sm text-zinc-500">
              {caballo.cat_raza?.nombre ?? '—'}
              {caballo.cat_pelaje?.nombre ? ` · ${caballo.cat_pelaje.nombre}` : ''}
              {caballo.fecha_nacimiento  ? ` · ${calcularEdad(caballo.fecha_nacimiento)}` : ''}
            </p>
          </div>

          {/* Solo veterinario — caballo ya pre-seleccionado */}
          {rol === 'veterinario' && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors shrink-0"
            >
              <Plus size={15} /> Nueva consulta
            </button>
          )}
        </div>
      )}

      {/* Lista de registros */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Historial clínico
        </h2>
        <span className="text-xs text-zinc-600">{historial.length} registros</span>
      </div>

      {historial.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center text-zinc-600 text-sm">
          Sin registros clínicos para este animal.
        </div>
      ) : (
        <div className="space-y-3">
          {historial.map((entry) => (
            <HistorialCard
              key={(entry as { id: string }).id}
              entry={entry as Parameters<typeof HistorialCard>[0]['entry']}
            />
          ))}
        </div>
      )}

      {/* Modal con caballo pre-seleccionado */}
      {showModal && id && (
        <NuevaConsultaModal
          caballoId={id}
          onClose={() => setShowModal(false)}
          onSuccess={cargarHistorial}
        />
      )}
    </div>
  )
}
