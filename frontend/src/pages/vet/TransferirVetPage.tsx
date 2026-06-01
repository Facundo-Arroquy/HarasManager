import { useEffect, useState } from 'react'
import { ArrowRight, Building2, CheckSquare, Square } from 'lucide-react'
import { caballoService, type Caballo } from '../../services/caballoService'
import { transferEmpresaService, type SociedadItem } from '../../services/transferEmpresaService'
import Spinner from '../../components/ui/Spinner'

export default function TransferirVetPage() {
  const [caballos, setCaballos]       = useState<Caballo[]>([])
  const [sociedades, setSociedades]   = useState<SociedadItem[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)

  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [destino, setDestino]             = useState<string>('')
  const [transfiriendo, setTransfiriendo] = useState(false)
  const [exito, setExito]                 = useState(false)

  useEffect(() => {
    Promise.all([
      caballoService.listarDelVeterinario(''),
      transferEmpresaService.listarTodasSociedades(),
    ])
      .then(([cabs, socs]) => {
        // Solo caballos sin organización (creados por el vet)
        const propios = cabs.filter((c: any) => !c.sociedad_id || c.sociedad_id === null)
        setCaballos(propios as Caballo[])
        setSociedades(socs)
      })
      .catch((e) => setError((e as any)?.message ?? 'Error al cargar datos'))
      .finally(() => setLoading(false))
  }, [])

  function toggleSeleccion(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleTodos() {
    if (seleccionados.size === caballos.length) {
      setSeleccionados(new Set())
    } else {
      setSeleccionados(new Set(caballos.map((c) => c.id)))
    }
  }

  async function handleTransferir() {
    if (seleccionados.size === 0 || !destino) return
    setTransfiriendo(true)
    setError(null)
    try {
      await transferEmpresaService.transferirVet([...seleccionados], destino)
      // Quitar los caballos transferidos de la lista
      setCaballos((prev) => prev.filter((c) => !seleccionados.has(c.id)))
      setSeleccionados(new Set())
      setDestino('')
      setExito(true)
      setTimeout(() => setExito(false), 4000)
    } catch (e) {
      setError((e as any)?.message ?? 'Error al transferir')
    } finally {
      setTransfiriendo(false)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Transferir caballos</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Enviá caballos propios a una organización registrada
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {exito && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Caballos transferidos correctamente.
        </div>
      )}

      {/* Lista de caballos propios */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Building2 size={15} className="text-slate-400" />
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Mis caballos
            </span>
            {caballos.length > 0 && (
              <span className="text-xs text-slate-400">({caballos.length})</span>
            )}
          </div>
          {caballos.length > 0 && (
            <button
              onClick={toggleTodos}
              className="text-xs text-brand-600 hover:text-brand-700 font-medium"
            >
              {seleccionados.size === caballos.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
            </button>
          )}
        </div>

        {caballos.length === 0 ? (
          <p className="px-4 py-8 text-sm text-slate-400 text-center">
            No tenés caballos propios para transferir.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {caballos.map((c) => {
              const selec = seleccionados.has(c.id)
              return (
                <button
                  key={c.id}
                  onClick={() => toggleSeleccion(c.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${
                    selec ? 'bg-brand-50' : 'hover:bg-slate-50'
                  }`}
                >
                  {selec
                    ? <CheckSquare size={18} className="text-brand-500 shrink-0" />
                    : <Square size={18} className="text-slate-300 shrink-0" />
                  }
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{c.nombre}</p>
                    <p className="text-xs text-slate-400">{c.categoria}</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Destino + acción */}
      {caballos.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Building2 size={15} className="text-slate-400" />
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Organización destino
            </span>
          </div>

          {sociedades.length === 0 ? (
            <p className="text-sm text-slate-400">No hay organizaciones registradas.</p>
          ) : (
            <select
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              <option value="">Seleccioná una organización…</option>
              {sociedades.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          )}

          <button
            onClick={handleTransferir}
            disabled={seleccionados.size === 0 || !destino || transfiriendo}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {transfiriendo ? (
              <Spinner size="sm" />
            ) : (
              <>
                <ArrowRight size={16} />
                Transferir {seleccionados.size > 0 ? `${seleccionados.size} caballo${seleccionados.size > 1 ? 's' : ''}` : ''}
              </>
            )}
          </button>
        </div>
      )}

    </div>
  )
}
