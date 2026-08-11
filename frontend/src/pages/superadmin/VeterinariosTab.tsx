import { useState, useEffect } from 'react'
import { FlaskConical, Stethoscope, LayoutGrid } from 'lucide-react'
import { superAdminService, type VeterinarioAcceso } from '../../services/superAdminService'
import { listarModulos } from '../../services/moduloService'
import { useToastStore } from '../../store/toastStore'
import { mensajeError } from '../../utils/error'
import type { Modulo, ModuloCodigo } from '../../types/modulo'
import Spinner from '../../components/ui/Spinner'

// Torneo/Polo restringe roles a admin/jugador/piloto — nunca veterinario — así
// que mostrar ese toggle acá sería UI muerta. Se filtra el catálogo en vez de
// agregar una columna nueva en cat_modulo para este único caso.
const MODULOS_VETERINARIO: ModuloCodigo[] = ['centro_cria']

const LIMITE_GRATIS = 5

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

function BadgeSuscripcion({ estado, caballosPropios }: {
  estado: VeterinarioAcceso['suscripcionEstado']
  caballosPropios: number
}) {
  if (estado === 'activa') {
    return (
      <span className="rounded border border-emerald-800/50 bg-emerald-900/30 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
        Suscripción activa
      </span>
    )
  }
  if (caballosPropios >= LIMITE_GRATIS) {
    return (
      <span className="rounded border border-amber-800/50 bg-amber-900/30 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
        Límite alcanzado
      </span>
    )
  }
  return (
    <span className="text-[10px] text-zinc-500">
      {caballosPropios}/{LIMITE_GRATIS} caballos gratis
    </span>
  )
}

// ── Tab principal ─────────────────────────────────────────────────────────────

export default function VeterinariosTab() {
  const [veterinarios, setVeterinarios] = useState<VeterinarioAcceso[]>([])
  const [catalogo, setCatalogo] = useState<Modulo[]>([])
  const [loading, setLoading] = useState(true)
  const [mutando, setMutando] = useState<string | null>(null)
  const pushToast = useToastStore((s) => s.pushToast)

  async function recargar() {
    setLoading(true)
    try {
      const [vets, mods] = await Promise.all([superAdminService.listarVeterinarios(), listarModulos()])
      setVeterinarios(vets)
      setCatalogo(mods.filter((m) => MODULOS_VETERINARIO.includes(m.codigo)))
    } catch (e) {
      pushToast('error', mensajeError(e, 'No se pudieron cargar los veterinarios.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { recargar() }, [])

  async function handleToggleModulo(usuarioId: string, codigo: ModuloCodigo, valor: boolean) {
    setMutando(usuarioId)
    try {
      await superAdminService.toggleModuloUsuario(usuarioId, codigo, valor)
      await recargar()
      pushToast('success', 'Acceso actualizado.')
    } catch (e) {
      pushToast('error', mensajeError(e, 'No se pudo actualizar el acceso.'))
    } finally {
      setMutando(null)
    }
  }

  async function handleToggleSuscripcion(usuarioId: string, activar: boolean) {
    setMutando(usuarioId)
    try {
      if (activar) {
        await superAdminService.activarSuscripcionVeterinario(usuarioId)
      } else {
        await superAdminService.desactivarSuscripcionVeterinario(usuarioId)
      }
      await recargar()
      pushToast('success', activar ? 'Suscripción activada.' : 'Suscripción desactivada.')
    } catch (e) {
      pushToast('error', mensajeError(e, 'No se pudo actualizar la suscripción.'))
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
                className="flex flex-col gap-3 px-4 py-3 bg-zinc-900 hover:bg-zinc-800/60 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
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

                  <div className="flex flex-col items-end gap-2 shrink-0 sm:w-56">
                    {catalogo.map((modulo) => {
                      const habilitado = v.modulos[modulo.codigo] ?? false
                      return (
                        <div key={modulo.codigo} className="flex items-center justify-between w-full sm:justify-end gap-2">
                          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                            <FlaskConical size={13} className={habilitado ? 'text-brand-400' : 'text-zinc-600'} />
                            {modulo.nombre}
                          </div>
                          <Toggle
                            checked={habilitado}
                            onChange={(valor) => handleToggleModulo(v.id, modulo.codigo, valor)}
                            disabled={enMutacion}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-zinc-800/70 pt-2.5 pl-12">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                      <LayoutGrid size={13} className="text-zinc-600" />
                      {v.caballosPropios} propio{v.caballosPropios !== 1 ? 's' : ''}
                    </div>
                    <BadgeSuscripcion estado={v.suscripcionEstado} caballosPropios={v.caballosPropios} />
                  </div>
                  {v.suscripcionEstado === 'activa' ? (
                    <button
                      onClick={() => handleToggleSuscripcion(v.id, false)}
                      disabled={enMutacion}
                      className="shrink-0 rounded-md border border-zinc-700 px-2.5 py-1 text-[11px] font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors disabled:opacity-40"
                    >
                      Desactivar suscripción
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggleSuscripcion(v.id, true)}
                      disabled={enMutacion}
                      className="shrink-0 rounded-md border border-emerald-700/50 bg-emerald-900/30 px-2.5 py-1 text-[11px] font-medium text-emerald-400 hover:bg-emerald-900/50 transition-colors disabled:opacity-40"
                    >
                      Activar suscripción
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
