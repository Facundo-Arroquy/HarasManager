import { useState, useEffect } from 'react'
import { superAdminService, type UsuarioEmpresa } from '../../services/superAdminService'

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

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer select-none">
      <div
        onClick={() => onChange(!checked)}
        className={`relative h-4 w-7 rounded-full transition-colors ${checked ? 'bg-emerald-600' : 'bg-zinc-700'}`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-3.5' : 'translate-x-0.5'}`}
        />
      </div>
      <span className="text-[11px] text-zinc-400">{label}</span>
    </label>
  )
}

export default function UsuariosEmpresaTab({ sociedadIdInicial }: Props) {
  const empresas = superAdminService.getTodasEmpresas()
  const [sociedadId, setSociedadId] = useState(sociedadIdInicial ?? empresas[0]?.id ?? '')
  const [usuarios, setUsuarios] = useState<UsuarioEmpresa[]>([])

  useEffect(() => {
    if (sociedadIdInicial) setSociedadId(sociedadIdInicial)
  }, [sociedadIdInicial])

  useEffect(() => {
    setUsuarios(superAdminService.listarUsuariosPorEmpresa(sociedadId))
  }, [sociedadId])

  function handleRolChange(membresiaId: string, nuevoRol: string) {
    superAdminService.cambiarRol(membresiaId, nuevoRol)
    setUsuarios(superAdminService.listarUsuariosPorEmpresa(sociedadId))
  }

  function handleToggleActivo(membresiaId: string, valor: boolean) {
    superAdminService.toggleActivo(membresiaId, valor)
    setUsuarios(superAdminService.listarUsuariosPorEmpresa(sociedadId))
  }

  function handleToggleCentroC(membresiaId: string, valor: boolean) {
    superAdminService.toggleAccesosCentroC(membresiaId, valor)
    setUsuarios(superAdminService.listarUsuariosPorEmpresa(sociedadId))
  }

  return (
    <div className="space-y-4">
      {/* Selector de empresa */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-zinc-400 shrink-0">Empresa</label>
        <select
          value={sociedadId}
          onChange={(e) => setSociedadId(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
        >
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>{e.nombre}</option>
          ))}
        </select>
        <span className="text-xs text-zinc-500">{usuarios.length} usuarios</span>
      </div>

      {/* Lista */}
      {usuarios.length === 0 ? (
        <p className="text-sm text-zinc-500 py-8 text-center">Sin usuarios en esta empresa.</p>
      ) : (
        <div className="divide-y divide-zinc-800 rounded-xl border border-zinc-800 overflow-hidden">
          {usuarios.map((u) => (
            <div key={u.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 bg-zinc-900 hover:bg-zinc-800/60 transition-colors">
              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-zinc-100">{u.nombre} {u.apellido}</p>
                  {!u.activo && (
                    <span className="rounded border border-red-800/50 bg-red-900/30 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
                      Inactivo
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-500 truncate">{u.email}</p>
              </div>

              {/* Controles */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Badge rol actual */}
                <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ROL_BADGE[u.rol] ?? 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
                  {u.rol}
                </span>

                {/* Select cambio de rol */}
                <select
                  value={u.rol}
                  onChange={(e) => handleRolChange(u.id, e.target.value)}
                  className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>

                {/* Toggles */}
                <Toggle
                  checked={u.activo}
                  onChange={(v) => handleToggleActivo(u.id, v)}
                  label="Activo"
                />
                <Toggle
                  checked={u.accesosCentroC}
                  onChange={(v) => handleToggleCentroC(u.id, v)}
                  label="Centro Cría"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
