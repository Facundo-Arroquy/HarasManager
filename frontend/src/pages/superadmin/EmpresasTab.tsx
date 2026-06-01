import { useState, useEffect } from 'react'
import { Building2, Footprints, Users, MapPin, ChevronRight, Plus, Trash2, X, FlaskConical } from 'lucide-react'
import { superAdminService, type EmpresaStats } from '../../services/superAdminService'
import Spinner from '../../components/ui/Spinner'

interface Props {
  onGestionarUsuarios: (sociedadId: string) => void
}

// ── Modal crear empresa ────────────────────────────────────────────────────────

function CrearEmpresaModal({ onClose, onCreada }: { onClose: () => void; onCreada: () => void }) {
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return setError('Ingresá el nombre de la empresa.')
    setLoading(true)
    try {
      await superAdminService.crearEmpresa(nombre)
      onCreada()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear empresa.')
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h2 className="text-sm font-semibold text-zinc-100">Nueva empresa</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">Nombre de la empresa</label>
            <input
              autoFocus
              type="text"
              value={nombre}
              onChange={(e) => { setNombre(e.target.value); setError('') }}
              placeholder="Ej: Haras Los Alamos"
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
            >
              {loading ? 'Creando...' : 'Crear empresa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Card empresa ──────────────────────────────────────────────────────────────

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-zinc-500">{icon}</div>
      <div>
        <p className="text-lg font-semibold text-zinc-100 leading-none">{value}</p>
        <p className="text-[11px] text-zinc-500 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

interface CardProps {
  empresa: EmpresaStats
  onGestionar: () => void
  onEliminar: () => void
  confirmandoEliminar: boolean
  onConfirmarEliminar: () => void
  onCancelarEliminar: () => void
  eliminando: boolean
  onToggloCentroC: (valor: boolean) => void
  toglandoCentroC: boolean
}

function EmpresaCard({ empresa, onGestionar, onEliminar, confirmandoEliminar, onConfirmarEliminar, onCancelarEliminar, eliminando, onToggloCentroC, toglandoCentroC }: CardProps) {
  return (
    <div className={`rounded-xl border bg-zinc-900 p-5 flex flex-col gap-4 transition-colors ${confirmandoEliminar ? 'border-rose-800/60' : 'border-zinc-800'}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800">
          <Building2 size={18} className="text-emerald-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-zinc-100 truncate">{empresa.nombre}</h3>
          <p className="text-[11px] text-zinc-500 mt-0.5 font-mono">{empresa.id}</p>
        </div>
        {!confirmandoEliminar ? (
          <button
            onClick={onEliminar}
            className="shrink-0 p-1.5 rounded-md text-zinc-600 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
            title="Eliminar empresa"
          >
            <Trash2 size={14} />
          </button>
        ) : (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onCancelarEliminar}
              className="px-2 py-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              No
            </button>
            <button
              onClick={onConfirmarEliminar}
              disabled={eliminando}
              className="px-2 py-1 text-[11px] font-medium rounded bg-rose-700 hover:bg-rose-600 text-white transition-colors disabled:opacity-50"
            >
              {eliminando ? '...' : 'Eliminar'}
            </button>
          </div>
        )}
      </div>

      {confirmandoEliminar && (
        <p className="text-xs text-rose-400 -mt-1">
          {empresa.cantidadUsuarios > 0
            ? `Se eliminarán también ${empresa.cantidadUsuarios} usuario${empresa.cantidadUsuarios !== 1 ? 's' : ''}. ¿Confirmar?`
            : '¿Confirmar eliminación?'}
        </p>
      )}

      <div className="grid grid-cols-3 gap-3 border-t border-zinc-800 pt-4">
        <Stat icon={<Footprints size={14} />} value={empresa.cantidadCaballos} label="Caballos" />
        <Stat icon={<Users size={14} />}      value={empresa.cantidadUsuarios} label="Usuarios" />
        <Stat icon={<MapPin size={14} />}     value={empresa.cantidadCampos}   label="Campos" />
      </div>

      {/* Toggle Centro de Cría */}
      <div className="flex items-center justify-between border-t border-zinc-800 pt-3">
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <FlaskConical size={13} className={empresa.accesosCentroC ? 'text-brand-400' : 'text-zinc-600'} />
          Centro de Embriones
        </div>
        <button
          onClick={() => onToggloCentroC(!empresa.accesosCentroC)}
          disabled={toglandoCentroC}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-40 ${
            empresa.accesosCentroC ? 'bg-brand-500' : 'bg-zinc-700'
          }`}
          title={empresa.accesosCentroC ? 'Desactivar módulo' : 'Activar módulo'}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              empresa.accesosCentroC ? 'translate-x-[18px]' : 'translate-x-[3px]'
            }`}
          />
        </button>
      </div>

      <button
        onClick={onGestionar}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors"
      >
        Gestionar usuarios
        <ChevronRight size={13} />
      </button>
    </div>
  )
}

// ── Tab principal ─────────────────────────────────────────────────────────────

export default function EmpresasTab({ onGestionarUsuarios }: Props) {
  const [empresas, setEmpresas] = useState<EmpresaStats[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const [toglandoCentroC, setToglandoCentroC] = useState<string | null>(null)

  async function recargar() {
    setLoading(true)
    try {
      setEmpresas(await superAdminService.listarEmpresas())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { recargar() }, [])

  async function handleToggloCentroC(sociedadId: string, valor: boolean) {
    setToglandoCentroC(sociedadId)
    try {
      await superAdminService.toggleAccesoCentroCOrg(sociedadId, valor)
      await recargar()
    } finally {
      setToglandoCentroC(null)
    }
  }

  async function handleEliminar(sociedadId: string) {
    setEliminando(true)
    try {
      await superAdminService.eliminarEmpresa(sociedadId)
      setConfirmando(null)
      await recargar()
    } finally {
      setEliminando(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Spinner size="md" /></div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">{empresas.length} empresa{empresas.length !== 1 ? 's' : ''} registrada{empresas.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white transition-colors"
        >
          <Plus size={14} />
          Nueva empresa
        </button>
      </div>

      {empresas.length === 0 ? (
        <p className="py-12 text-center text-sm text-zinc-600">Sin empresas. Creá la primera.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {empresas.map((emp) => (
            <EmpresaCard
              key={emp.id}
              empresa={emp}
              onGestionar={() => onGestionarUsuarios(emp.id)}
              onEliminar={() => setConfirmando(emp.id)}
              confirmandoEliminar={confirmando === emp.id}
              onConfirmarEliminar={() => handleEliminar(emp.id)}
              onCancelarEliminar={() => setConfirmando(null)}
              eliminando={eliminando}
              onToggloCentroC={(valor) => handleToggloCentroC(emp.id, valor)}
              toglandoCentroC={toglandoCentroC === emp.id}
            />
          ))}
        </div>
      )}

      {showModal && (
        <CrearEmpresaModal
          onClose={() => setShowModal(false)}
          onCreada={() => { setShowModal(false); recargar() }}
        />
      )}
    </div>
  )
}
