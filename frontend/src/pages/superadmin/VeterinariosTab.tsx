import { useState, useEffect } from 'react'
import { FlaskConical, Stethoscope } from 'lucide-react'
import { superAdminService, type VeterinarioAcceso } from '../../services/superAdminService'
import Spinner from '../../components/ui/Spinner'

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-40 ${
        checked ? 'bg-brand-500' : 'bg-zinc-700'
      }`}
      title={checked ? 'Desactivar acceso' : 'Activar acceso'}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  )
}

// ── Tab principal ─────────────────────────────────────────────────────────────

export default function VeterinariosTab() {
  const [veterinarios, setVeterinarios] = useState<VeterinarioAcceso[]>([])
  const [loading, setLoading] = useState(true)
  const [mutando, setMutando] = useState<string | null>(null)

  async function recargar() {
    setLoading(true)
    try {
      setVeterinarios(await superAdminService.listarVeterinarios())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { recargar() }, [])

  async function handleToggleAcceso(usuarioId: string, valor: boolean) {
    setMutando(usuarioId)
    try {
      await superAdminService.toggleAccesoCentroCVeterinario(usuarioId, valor)
      await recargar()
    } finally {
      setMutando(null)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Spinner size="md" /></div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">{veterinarios.length} veterinario{veterinarios.length !== 1 ? 's' : ''} registrado{veterinarios.length !== 1 ? 's' : ''}</p>
      </div>

      {veterinarios.length === 0 ? (
        <p className="py-12 text-center text-sm text-zinc-600">Sin veterinarios registrados en la plataforma.</p>
      ) : (
        <div className="divide-y divide-zinc-800 rounded-xl border border-zinc-800 overflow-hidden">
          {veterinarios.map((v) => {
            const enMutacion = mutando === v.id
            return (
              <div
                key={v.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 bg-zinc-900 hover:bg-zinc-800/60 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-800">
                    <Stethoscope size={16} className="text-sky-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-zinc-100">{v.nombre} {v.apellido}</p>
                      {!v.activo && (
                        <span className="rounded border border-red-800/50 bg-red-900/30 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
                          Inactivo
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-500 truncate">{v.email}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 sm:w-56">
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <FlaskConical size={13} className={v.accesoCentroC ? 'text-brand-400' : 'text-zinc-600'} />
                    Centro de Embriones
                  </div>
                  <Toggle
                    checked={v.accesoCentroC}
                    onChange={(valor) => handleToggleAcceso(v.id, valor)}
                    disabled={enMutacion}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
