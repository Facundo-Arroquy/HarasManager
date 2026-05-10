import { useEffect, useState } from 'react'
import { X, ArrowRight } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { caballoService } from '../../services/caballoService'
import { marcaService, type Marca } from '../../services/marcaService'
import { hoyAR } from '../../utils/fecha'

interface Props {
  caballo: {
    id: string
    nombre: string
    categoria?: string | null
    marca_id?: string | null
    marca?: { nombre: string } | null
  }
  onClose: () => void
  onSuccess: () => void
}

export default function TransferirMarcaModal({ caballo, onClose, onSuccess }: Props) {
  const user     = useAuthStore((s) => s.user)
  const sociedad = useAuthStore((s) => s.sociedadActiva)

  const [marcas,        setMarcas]        = useState<Marca[]>([])
  const [marcaNuevaId,  setMarcaNuevaId]  = useState('')
  const [fecha,         setFecha]         = useState(hoyAR())
  const [observaciones, setObs]           = useState('')
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState('')

  useEffect(() => {
    if (!sociedad?.id) return
    marcaService.listar(sociedad.id).then((m) => {
      const otras = m.filter((x) => x.id !== caballo.marca_id)
      setMarcas(otras)
      if (otras[0]) setMarcaNuevaId(otras[0].id)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!marcaNuevaId) return setError('Seleccioná la nueva marca.')
    if (!fecha)        return setError('La fecha es requerida.')

    setSaving(true)
    setError('')
    try {
      await caballoService.transferir(
        caballo.id,
        { marca_nueva_id: marcaNuevaId, fecha_transferencia: fecha, observaciones: observaciones.trim() || undefined },
        user?.id ?? ''
      )
      onSuccess()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al transferir.')
    } finally {
      setSaving(false)
    }
  }

  const marcaNueva = marcas.find((m) => m.id === marcaNuevaId)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h2 className="text-sm font-semibold text-zinc-100">Transferir propiedad</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Caballo info */}
          <div className="rounded-lg bg-zinc-800 px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-200 truncate">{caballo.nombre}</p>
              <p className="text-xs text-zinc-500">{caballo.categoria} · {caballo.marca?.nombre ?? '—'}</p>
            </div>
            <ArrowRight size={16} className="text-zinc-600 shrink-0" />
            <p className="text-sm font-medium text-emerald-400 truncate max-w-[120px]">
              {marcaNueva?.nombre ?? '…'}
            </p>
          </div>

          {/* Advertencia */}
          <p className="text-xs text-amber-400/80 bg-amber-900/20 border border-amber-800/30 rounded-md px-3 py-2">
            Al confirmar, la transferencia queda registrada en el historial de propiedad.
          </p>

          {/* Nueva marca */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">Transferir a *</label>
            <select
              value={marcaNuevaId}
              onChange={(e) => setMarcaNuevaId(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {marcas.length === 0 && <option value="">No hay otras marcas disponibles</option>}
              {marcas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}{m.dominio_email ? ` (@${m.dominio_email})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Fecha */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">Fecha de transferencia *</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Observaciones */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">Observaciones</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Precio de venta, condiciones, etc."
              rows={2}
              className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {error && <p className="text-xs text-rose-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || marcas.length === 0}
              className="px-4 py-2 text-sm font-medium rounded-md bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-50"
            >
              {saving ? 'Transfiriendo…' : 'Confirmar transferencia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
