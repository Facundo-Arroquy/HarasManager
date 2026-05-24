import { useState, useEffect } from 'react'
import { Plus, Trash2, X, Eye, EyeOff } from 'lucide-react'
import { superAdminService, type UsuarioEmpresa, type NuevoUsuarioPayload } from '../../services/superAdminService'

const ROLES = ['admin', 'veterinario', 'jugador', 'piloto', 'peticero']

const ROL_BADGE: Record<string, string> = {
  admin:       'bg-emerald-900/50 text-emerald-300 border-emerald-700/50',
  veterinario: 'bg-sky-900/50 text-sky-300 border-sky-700/50',
  jugador:     'bg-violet-900/50 text-violet-300 border-violet-700/50',
  piloto:      'bg-rose-900/50 text-rose-300 border-rose-700/50',
  peticero:    'bg-amber-900/50 text-amber-300 border-amber-700/50',
}

interface Props {
  sociedadIdInicial?: string | null
}

// ── Componente Toggle ─────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer select-none">
      <div
        onClick={() => onChange(!checked)}
        className={`relative h-4 w-7 rounded-full transition-colors ${checked ? 'bg-emerald-600' : 'bg-zinc-700'}`}
      >
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
      </div>
      <span className="text-[11px] text-zinc-400">{label}</span>
    </label>
  )
}

// ── Modal crear usuario ───────────────────────────────────────────────────────

interface CrearUsuarioModalProps {
  sociedadNombre: string
  onClose: () => void
  onCreado: () => void
  sociedadId: string
}

function PasswordInput({ value, onChange, placeholder, error }: {
  value: string; onChange: (v: string) => void; placeholder: string; error?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 pr-9 text-sm text-zinc-200 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
          tabIndex={-1}
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      {error && <p className="text-[10px] text-rose-400 mt-0.5">{error}</p>}
    </div>
  )
}

function CrearUsuarioModal({ sociedadNombre, sociedadId, onClose, onCreado }: CrearUsuarioModalProps) {
  const [form, setForm] = useState<NuevoUsuarioPayload>({
    nombre: '', apellido: '', email: '', password: '', rol: 'admin', accesosCentroC: false,
  })
  const [confirmar, setConfirmar] = useState('')
  const [errors, setErrors] = useState<Partial<Record<keyof NuevoUsuarioPayload | 'confirmar', string>>>({})

  function set(field: keyof NuevoUsuarioPayload, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  function validate(): boolean {
    const e: typeof errors = {}
    if (!form.nombre.trim())   e.nombre   = 'Requerido'
    if (!form.apellido.trim()) e.apellido = 'Requerido'
    if (!form.email.trim())    e.email    = 'Requerido'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Email inválido'
    if (!form.password)              e.password  = 'Requerido'
    else if (form.password.length < 8) e.password = 'Mínimo 8 caracteres'
    if (form.password && confirmar !== form.password) e.confirmar = 'Las contraseñas no coinciden'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    superAdminService.crearUsuario(sociedadId, form)
    onCreado()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Nuevo usuario</h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">{sociedadNombre}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {/* Nombre + Apellido */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Nombre</label>
              <input
                autoFocus
                type="text"
                value={form.nombre}
                onChange={(e) => set('nombre', e.target.value)}
                placeholder="Juan"
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
              />
              {errors.nombre && <p className="text-[10px] text-rose-400">{errors.nombre}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Apellido</label>
              <input
                type="text"
                value={form.apellido}
                onChange={(e) => set('apellido', e.target.value)}
                placeholder="Pérez"
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
              />
              {errors.apellido && <p className="text-[10px] text-rose-400">{errors.apellido}</p>}
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="juan@haras.com"
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
            />
            {errors.email && <p className="text-[10px] text-rose-400">{errors.email}</p>}
          </div>

          {/* Contraseña */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400">Contraseña</label>
            <PasswordInput
              value={form.password}
              onChange={(v) => set('password', v)}
              placeholder="Mínimo 8 caracteres"
              error={errors.password}
            />
          </div>

          {/* Confirmar contraseña */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400">Confirmar contraseña</label>
            <PasswordInput
              value={confirmar}
              onChange={(v) => { setConfirmar(v); setErrors((prev) => ({ ...prev, confirmar: undefined })) }}
              placeholder="Repetí la contraseña"
              error={errors.confirmar}
            />
          </div>

          {/* Rol */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400">Rol</label>
            <select
              value={form.rol}
              onChange={(e) => set('rol', e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* Acceso Centro C */}
          <div className="flex items-center gap-3 pt-1">
            <Toggle
              checked={form.accesosCentroC}
              onChange={(v) => set('accesosCentroC', v)}
              label="Acceso Centro de Cría"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            >
              Crear usuario
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Tab principal ─────────────────────────────────────────────────────────────

export default function UsuariosEmpresaTab({ sociedadIdInicial }: Props) {
  const [empresas, setEmpresas] = useState(() => superAdminService.getTodasEmpresas())
  const [sociedadId, setSociedadId] = useState(sociedadIdInicial ?? empresas[0]?.id ?? '')
  const [usuarios, setUsuarios] = useState<UsuarioEmpresa[]>([])
  const [showModal, setShowModal] = useState(false)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState<string | null>(null)

  useEffect(() => {
    setEmpresas(superAdminService.getTodasEmpresas())
  }, [])

  useEffect(() => {
    if (sociedadIdInicial) setSociedadId(sociedadIdInicial)
  }, [sociedadIdInicial])

  useEffect(() => {
    setUsuarios(superAdminService.listarUsuariosPorEmpresa(sociedadId))
  }, [sociedadId])

  function recargar() {
    setUsuarios(superAdminService.listarUsuariosPorEmpresa(sociedadId))
  }

  function handleRolChange(membresiaId: string, nuevoRol: string) {
    superAdminService.cambiarRol(membresiaId, nuevoRol)
    recargar()
  }

  function handleToggleActivo(membresiaId: string, valor: boolean) {
    superAdminService.toggleActivo(membresiaId, valor)
    recargar()
  }

  function handleToggleCentroC(membresiaId: string, valor: boolean) {
    superAdminService.toggleAccesosCentroC(membresiaId, valor)
    recargar()
  }

  function handleEliminarUsuario(membresiaId: string) {
    superAdminService.eliminarUsuario(membresiaId)
    setConfirmandoEliminar(null)
    recargar()
  }

  const nombreEmpresa = superAdminService.getNombreEmpresa(sociedadId)

  return (
    <div className="space-y-4">
      {/* Header con selector y botón */}
      <div className="flex items-center gap-3 flex-wrap justify-between">
        <div className="flex items-center gap-3">
          <label className="text-xs text-zinc-400 shrink-0">Empresa</label>
          <select
            value={sociedadId}
            onChange={(e) => { setSociedadId(e.target.value); setConfirmandoEliminar(null) }}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
          >
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>{e.nombre}</option>
            ))}
          </select>
          <span className="text-xs text-zinc-500">{usuarios.length} usuario{usuarios.length !== 1 ? 's' : ''}</span>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white transition-colors"
        >
          <Plus size={14} />
          Nuevo usuario
        </button>
      </div>

      {/* Lista */}
      {usuarios.length === 0 ? (
        <p className="text-sm text-zinc-500 py-8 text-center">Sin usuarios en esta empresa.</p>
      ) : (
        <div className="divide-y divide-zinc-800 rounded-xl border border-zinc-800 overflow-hidden">
          {usuarios.map((u) => {
            const eliminando = confirmandoEliminar === u.id
            return (
              <div
                key={u.id}
                className={`flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 transition-colors ${eliminando ? 'bg-rose-950/30' : 'bg-zinc-900 hover:bg-zinc-800/60'}`}
              >
                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-zinc-100">{u.nombre} {u.apellido}</p>
                    {!u.activo && (
                      <span className="rounded border border-red-800/50 bg-red-900/30 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
                        Inactivo
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 truncate">{u.email}</p>
                  {eliminando && (
                    <p className="text-[11px] text-rose-400 mt-1">¿Eliminar este usuario?</p>
                  )}
                </div>

                {/* Controles */}
                {!eliminando ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ROL_BADGE[u.rol] ?? 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
                      {u.rol}
                    </span>
                    <select
                      value={u.rol}
                      onChange={(e) => handleRolChange(u.id, e.target.value)}
                      className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <Toggle checked={u.activo}         onChange={(v) => handleToggleActivo(u.id, v)}  label="Activo" />
                    <Toggle checked={u.accesosCentroC} onChange={(v) => handleToggleCentroC(u.id, v)} label="Centro Cría" />
                    <button
                      onClick={() => setConfirmandoEliminar(u.id)}
                      className="p-1.5 rounded-md text-zinc-600 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
                      title="Eliminar usuario"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setConfirmandoEliminar(null)}
                      className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleEliminarUsuario(u.id)}
                      className="px-3 py-1.5 text-xs font-medium rounded-md bg-rose-700 hover:bg-rose-600 text-white transition-colors"
                    >
                      Confirmar
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <CrearUsuarioModal
          sociedadId={sociedadId}
          sociedadNombre={nombreEmpresa}
          onClose={() => setShowModal(false)}
          onCreado={() => { setShowModal(false); recargar() }}
        />
      )}
    </div>
  )
}
