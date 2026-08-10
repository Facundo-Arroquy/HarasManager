import { useEffect, useState } from 'react'
import { FlaskConical, Lock } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useAuthStore } from '../../store/authStore'
import { useToastStore } from '../../store/toastStore'
import { mensajeError } from '../../utils/error'
import {
  listarModulos,
  listarAccesoMembresiasPorModulo,
  toggleMembresiaModulo,
  type UserAccesoModulo,
} from '../../services/moduloService'
import type { Modulo, ModuloCodigo } from '../../types/modulo'

const ROL_BADGE: Record<string, string> = {
  admin:       'bg-violet-100 text-violet-700',
  veterinario: 'bg-brand-100 text-brand-700',
  piloto:      'bg-sky-100 text-sky-700',
  jugador:     'bg-green-100 text-green-700',
  peticero:    'bg-rose-100 text-rose-700',
}

export default function PermisosCentroTab() {
  const { sociedadActiva } = useAuth()
  const modulos = useAuthStore((s) => s.modulos)
  const [catalogo, setCatalogo] = useState<Modulo[]>([])
  const [loadingCatalogo, setLoadingCatalogo] = useState(true)
  const pushToast = useToastStore((s) => s.pushToast)

  useEffect(() => {
    listarModulos()
      .then(setCatalogo)
      .catch((e) => pushToast('error', mensajeError(e, 'No se pudo cargar el catálogo de módulos.')))
      .finally(() => setLoadingCatalogo(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Solo los módulos habilitados a nivel org para la propia empresa (ya
  // vienen en el store, sin query extra: get_mis_accesos_modulo los trae
  // en la carga de perfil).
  const modulosHabilitados = catalogo.filter((m) => modulos[m.codigo]?.org)

  if (loadingCatalogo) return <p className="text-sm text-slate-400">Cargando permisos…</p>

  if (!sociedadActiva) return null

  if (modulosHabilitados.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        No hay módulos habilitados para tu empresa todavía.
      </p>
    )
  }

  return (
    <div className="space-y-8 max-w-lg">
      {modulosHabilitados.map((modulo) => (
        <ModuloPermisosSection key={modulo.codigo} sociedadId={sociedadActiva.id} modulo={modulo} />
      ))}
    </div>
  )
}

function ModuloPermisosSection({ sociedadId, modulo }: { sociedadId: string; modulo: Modulo }) {
  const { user } = useAuth()
  const setModuloUsuario = useAuthStore((s) => s.setModuloUsuario)
  const pushToast = useToastStore((s) => s.pushToast)
  const [usuarios, setUsuarios] = useState<UserAccesoModulo[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  async function cargar() {
    try {
      const data = await listarAccesoMembresiasPorModulo(sociedadId, modulo.codigo)
      setUsuarios(data)
    } catch (e) {
      pushToast('error', mensajeError(e, `No se pudieron cargar los permisos de ${modulo.nombre}.`))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [sociedadId, modulo.codigo]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleToggle(u: UserAccesoModulo) {
    if (u.rol === 'admin') return // admin siempre tiene acceso
    setToggling(u.membresiaId)
    try {
      await toggleMembresiaModulo(u.membresiaId, modulo.codigo, !u.tieneAcceso)
      // Si el toggle afecta al usuario actual, actualizar el store
      if (u.id === user?.id) {
        setModuloUsuario(modulo.codigo as ModuloCodigo, !u.tieneAcceso)
      }
      pushToast('success', 'Acceso actualizado.')
      await cargar()
    } catch (e) {
      pushToast('error', mensajeError(e, 'No se pudo actualizar el acceso.'))
    } finally {
      setToggling(null)
    }
  }

  return (
    <div>
      <div>
        <h2 className="text-sm font-medium text-slate-600 flex items-center gap-2">
          <FlaskConical size={14} className="text-brand-600" />
          Acceso a {modulo.nombre}
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Activá o desactivá el módulo {modulo.nombre} para cada usuario.
          Los administradores siempre tienen acceso.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 mt-2">Cargando…</p>
      ) : (
        <div className="mt-2 rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-200">
          {usuarios.map((u) => {
            const esAdmin = u.rol === 'admin'
            const isToggling = toggling === u.membresiaId
            return (
              <div key={u.membresiaId} className="flex items-center gap-3 px-4 py-3 bg-white">
                {/* Avatar */}
                <div className="shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-500">
                  {(u.nombre?.[0] ?? '?').toUpperCase()}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">
                    {u.nombre} {u.apellido}
                  </p>
                  <p className="text-xs text-slate-400 font-mono truncate">{u.email}</p>
                </div>
                {/* Rol badge */}
                <span
                  className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${
                    ROL_BADGE[u.rol] ?? 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {u.rol}
                </span>
                {/* Toggle */}
                {esAdmin ? (
                  <div
                    title="El admin siempre tiene acceso"
                    className="shrink-0 flex items-center gap-1 text-xs text-slate-400"
                  >
                    <Lock size={12} />
                  </div>
                ) : (
                  <button
                    onClick={() => handleToggle(u)}
                    disabled={isToggling}
                    className={`shrink-0 relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-40 ${
                      u.tieneAcceso ? 'bg-brand-500' : 'bg-slate-200'
                    }`}
                    title={u.tieneAcceso ? 'Quitar acceso' : 'Dar acceso'}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        u.tieneAcceso ? 'translate-x-[18px]' : 'translate-x-[3px]'
                      }`}
                    />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
