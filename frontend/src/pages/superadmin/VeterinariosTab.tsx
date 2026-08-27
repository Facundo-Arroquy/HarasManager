import { useState, useEffect, useCallback } from 'react'
import { FlaskConical, Stethoscope, LayoutGrid, Trash2, X, AlertTriangle } from 'lucide-react'
import { superAdminService, type VeterinarioAcceso } from '../../services/superAdminService'
import { listarModulos } from '../../services/moduloService'
import { vetLimiteService } from '../../services/vetLimiteService'
import { useToastStore } from '../../store/toastStore'
import { mensajeError } from '../../utils/error'
import type { Modulo, ModuloCodigo } from '../../types/modulo'
import Spinner from '../../components/ui/Spinner'

// Torneo/Polo restringe roles a admin/jugador/piloto — nunca veterinario — así
// que mostrar ese toggle acá sería UI muerta. Se filtra el catálogo en vez de
// agregar una columna nueva en cat_modulo para este único caso.
const MODULOS_VETERINARIO: ModuloCodigo[] = ['centro_cria']

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

function BadgeSuscripcion({ estado, caballosPropios, limiteGratis }: {
  estado: VeterinarioAcceso['suscripcionEstado']
  caballosPropios: number
  limiteGratis: number | null
}) {
  if (estado === 'activa') {
    return (
      <span className="rounded border border-emerald-800/50 bg-emerald-900/30 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
        Suscripción activa
      </span>
    )
  }
  if (limiteGratis !== null && caballosPropios >= limiteGratis) {
    return (
      <span className="rounded border border-amber-800/50 bg-amber-900/30 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
        Límite alcanzado
      </span>
    )
  }
  return (
    <span className="text-[10px] text-zinc-500">
      {caballosPropios}{limiteGratis !== null ? `/${limiteGratis}` : ''} caballos gratis
    </span>
  )
}

// ── Tab principal ─────────────────────────────────────────────────────────────

export default function VeterinariosTab() {
  const [veterinarios, setVeterinarios] = useState<VeterinarioAcceso[]>([])
  const [catalogo, setCatalogo] = useState<Modulo[]>([])
  const [limiteGratis, setLimiteGratis] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [mutando, setMutando] = useState<string | null>(null)
  // Veterinario en proceso de baja definitiva, junto con el email que el
  // superadmin va tipeando para confirmar. La acción no tiene vuelta atrás, así
  // que no alcanza con un click.
  const [aEliminar, setAEliminar] = useState<VeterinarioAcceso | null>(null)
  const [emailConfirmacion, setEmailConfirmacion] = useState('')
  const [eliminando, setEliminando] = useState(false)
  const pushToast = useToastStore((s) => s.pushToast)

  const recargar = useCallback(async () => {
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
  }, [pushToast])

  useEffect(() => {
    recargar()
    vetLimiteService.limiteGratis().then(setLimiteGratis).catch(() => {})
  }, [recargar])

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

  async function handleEliminar() {
    if (!aEliminar) return
    setEliminando(true)
    try {
      await superAdminService.eliminarVeterinarioDefinitivo(aEliminar.id)
      pushToast('success', `${aEliminar.email} fue eliminado. El email quedó libre para registrarse de nuevo.`)
      setAEliminar(null)
      setEmailConfirmacion('')
      await recargar()
    } catch (e) {
      // El mensaje de la función enumera qué impide el borrado, así que se
      // muestra tal cual y el modal queda abierto para poder leerlo.
      pushToast('error', mensajeError(e, 'No se pudo eliminar el veterinario.'))
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
                    <BadgeSuscripcion estado={v.suscripcionEstado} caballosPropios={v.caballosPropios} limiteGratis={limiteGratis} />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {v.suscripcionEstado === 'activa' ? (
                      <button
                        onClick={() => handleToggleSuscripcion(v.id, false)}
                        disabled={enMutacion}
                        className="rounded-md border border-zinc-700 px-2.5 py-1 text-[11px] font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors disabled:opacity-40"
                      >
                        Desactivar suscripción
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleSuscripcion(v.id, true)}
                        disabled={enMutacion}
                        className="rounded-md border border-emerald-700/50 bg-emerald-900/30 px-2.5 py-1 text-[11px] font-medium text-emerald-400 hover:bg-emerald-900/50 transition-colors disabled:opacity-40"
                      >
                        Activar suscripción
                      </button>
                    )}
                    <button
                      onClick={() => { setAEliminar(v); setEmailConfirmacion('') }}
                      disabled={enMutacion}
                      title="Eliminar definitivamente"
                      aria-label={`Eliminar definitivamente a ${v.email}`}
                      className="rounded-md border border-zinc-700 p-1.5 text-zinc-500 hover:border-red-800/60 hover:bg-red-900/30 hover:text-red-400 transition-colors disabled:opacity-40"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {aEliminar && (
        <ModalEliminar
          vet={aEliminar}
          emailConfirmacion={emailConfirmacion}
          onEmailChange={setEmailConfirmacion}
          eliminando={eliminando}
          onCancelar={() => { setAEliminar(null); setEmailConfirmacion('') }}
          onConfirmar={handleEliminar}
        />
      )}
    </div>
  )
}

// ── Modal de baja definitiva ──────────────────────────────────────────────────
// Pide tipear el email completo: es la única acción del panel que destruye datos
// sin vuelta atrás, y el botón vive al lado de los toggles de uso cotidiano.

function ModalEliminar({ vet, emailConfirmacion, onEmailChange, eliminando, onCancelar, onConfirmar }: {
  vet: VeterinarioAcceso
  emailConfirmacion: string
  onEmailChange: (v: string) => void
  eliminando: boolean
  onCancelar: () => void
  onConfirmar: () => void
}) {
  const confirmado = emailConfirmacion.trim().toLowerCase() === vet.email.toLowerCase()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !eliminando) onCancelar() }}
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-400" />
            <h2 className="text-sm font-semibold text-zinc-100">Eliminar veterinario</h2>
          </div>
          <button
            onClick={onCancelar}
            disabled={eliminando}
            className="text-zinc-500 hover:text-zinc-300 disabled:opacity-40"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-zinc-300">
            Se va a eliminar a <strong className="text-zinc-100">{vet.nombre} {vet.apellido}</strong> de
            forma definitiva: sus datos, su suscripción y su acceso. El email queda libre para
            volver a registrarse desde cero.
          </p>

          <ul className="space-y-1 text-xs text-zinc-500">
            <li>· Se cancela primero la suscripción en MercadoPago, si tiene una activa.</li>
            <li>· Se eliminan sus {vet.caballosPropios} caballo{vet.caballosPropios !== 1 ? 's' : ''} propio{vet.caballosPropios !== 1 ? 's' : ''}.</li>
            <li>· El historial clínico <strong className="text-zinc-400">no se elimina</strong>: si escribió alguno, la baja se cancela y te avisa.</li>
          </ul>

          <p className="text-xs text-zinc-400 pt-1">
            Escribí <span className="font-mono text-zinc-200">{vet.email}</span> para confirmar:
          </p>
          <input
            type="text"
            value={emailConfirmacion}
            onChange={(e) => onEmailChange(e.target.value)}
            disabled={eliminando}
            autoFocus
            placeholder={vet.email}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-red-700 disabled:opacity-50"
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-800 px-5 py-3">
          <button
            onClick={onCancelar}
            disabled={eliminando}
            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            disabled={!confirmado || eliminando}
            className="rounded-md bg-red-900/60 border border-red-800 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {eliminando ? 'Eliminando…' : 'Eliminar definitivamente'}
          </button>
        </div>
      </div>
    </div>
  )
}
