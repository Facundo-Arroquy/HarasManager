import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutGrid, AlertTriangle, ClipboardList, ChevronRight, Clock, Building2, Stethoscope } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { caballoService, type Caballo } from '../../services/caballoService'
import { historialService, type AlertaVet } from '../../services/historialService'
import { mensajeError } from '../../utils/error'
import Spinner from '../../components/ui/Spinner'
import CaballosDadosDeBajaVet from '../../components/domain/CaballosDadosDeBajaVet'

type HistorialResumen = Awaited<ReturnType<typeof historialService.listarRecientesVet>>[number]

/**
 * Un renglón del desglose: una empresa, o el grupo de caballos propios.
 *
 * El vet trabaja para varios establecimientos a la vez y el total suelto no le
 * dice a dónde tiene que ir. Los propios van aparte porque no son de nadie más:
 * los creó él y nunca los transfirió a la empresa dueña.
 */
interface GrupoPanel {
  clave:    string
  nombre:   string
  /** Los propios y el cajón de descarte se pintan distinto y van al final. */
  tipo:     'empresa' | 'propios' | 'otros'
  caballos: number
  alertas:  number
}

function formatFecha(iso: string): string {
  const [y, m, d] = iso.split('-')
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${parseInt(d)} ${meses[parseInt(m) - 1]} ${y}`
}

function diasLabel(dias: number): { texto: string; clase: string } {
  if (dias < 0)  return { texto: `Vencida hace ${Math.abs(dias)}d`, clase: 'text-rose-600 bg-rose-50 border-rose-200' }
  if (dias === 0) return { texto: 'Hoy',                            clase: 'text-rose-600 bg-rose-50 border-rose-200' }
  if (dias <= 3)  return { texto: `En ${dias}d`,                    clase: 'text-brand-600 bg-brand-50 border-brand-200' }
  return              { texto: `En ${dias}d`,                    clase: 'text-slate-600 bg-slate-50 border-slate-200' }
}

export default function PanelVetPage() {
  const user   = useAuthStore((s) => s.user)
  const userId = user?.id
  const navigate = useNavigate()

  // Se guarda la lista y no solo el total: el desglose por empresa sale de acá,
  // y pedir un conteo por separado sería una segunda fuente de verdad.
  const [caballos,  setCaballos]  = useState<Caballo[]>([])
  const [consultas, setConsultas] = useState<HistorialResumen[]>([])
  const [alertas,   setAlertas]   = useState<AlertaVet[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  const cantCaballos = caballos.length

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    Promise.allSettled([
      caballoService.listarDelVeterinario().then(setCaballos),
      historialService.listarRecientesVet(5).then(setConsultas),
      historialService.listarAlertasVet().then(setAlertas),
    ]).then((results) => {
      const err = results.find((r) => r.status === 'rejected')
      if (err && err.status === 'rejected') {
        setError(mensajeError(err.reason, 'Error al cargar el panel'))
      }
    }).finally(() => setLoading(false))
  }, [userId])

  /**
   * Caballos y alertas por empresa.
   *
   * Las alertas se atribuyen por caballo (`get_alertas_vet` devuelve
   * `caballo_id`). Una alerta puede apuntar a un caballo que ya no está en la
   * lista —el vet escribió la consulta y después perdió el acceso—: esas van a
   * "Otros" en vez de perderse, así el desglose suma igual que la tarjeta.
   */
  const grupos = useMemo<GrupoPanel[]>(() => {
    const mapa = new Map<string, GrupoPanel>()
    const grupoDe = new Map<string, string>()   // caballo_id → clave de grupo

    for (const c of caballos) {
      const propio = c.vet_owner_id != null && c.vet_owner_id === userId
      const clave  = propio ? 'propios' : c.sociedad_id ?? 'sin-empresa'
      const nombre = propio
        ? 'Mis caballos'
        : c.empresa_nombre ?? 'Sin empresa'
      const tipo: GrupoPanel['tipo'] = propio ? 'propios' : 'empresa'

      const g = mapa.get(clave) ?? { clave, nombre, tipo, caballos: 0, alertas: 0 }
      g.caballos += 1
      mapa.set(clave, g)
      grupoDe.set(c.id, clave)
    }

    for (const a of alertas) {
      const clave = grupoDe.get(a.caballo_id) ?? 'otros'
      const g = mapa.get(clave)
        ?? { clave: 'otros', nombre: 'Otros', tipo: 'otros' as const, caballos: 0, alertas: 0 }
      g.alertas += 1
      mapa.set(g.clave, g)
    }

    // Empresas primero, de mayor a menor. Los propios y los sueltos, al final.
    const orden: Record<GrupoPanel['tipo'], number> = { empresa: 0, propios: 1, otros: 2 }
    return [...mapa.values()].sort((a, b) =>
      orden[a.tipo] - orden[b.tipo] ||
      b.caballos - a.caballos ||
      a.nombre.localeCompare(b.nombre, 'es'))
  }, [caballos, alertas, userId])

  // Con un solo grupo el desglose repite las tarjetas de arriba.
  const mostrarDesglose = grupos.length > 1

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  const meta = (user as { user_metadata?: { nombre?: string; full_name?: string } } | null)?.user_metadata
  const nombre = meta?.nombre
    ?? meta?.full_name
    ?? user?.email
    ?? 'Veterinario'

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Panel</h1>
        <p className="text-sm text-slate-400 mt-0.5 truncate">{nombre}</p>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <LayoutGrid size={15} />
            <span className="text-xs font-medium uppercase tracking-wide">Caballos</span>
          </div>
          {/* Si la carga falló, la lista quedó vacía: mostrar 0 mentiría. */}
          <p className="text-3xl font-bold text-slate-900">
            {error && cantCaballos === 0 ? '—' : cantCaballos}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">asignados</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <Clock size={15} />
            <span className="text-xs font-medium uppercase tracking-wide">Alertas</span>
          </div>
          <p className={`text-3xl font-bold ${alertas.length > 0 ? 'text-brand-600' : 'text-slate-900'}`}>
            {alertas.length}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">próximas consultas</p>
        </div>
      </div>

      {/* Desglose por empresa — el total suelto no dice a dónde hay que ir */}
      {mostrarDesglose && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
            <Building2 size={15} className="text-slate-400" />
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Por empresa
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {grupos.map((g) => (
              <div key={g.clave} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-2 min-w-0">
                  {g.tipo === 'empresa'
                    ? <Building2 size={14} className="shrink-0 text-slate-300" />
                    : <Stethoscope size={14} className="shrink-0 text-slate-300" />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{g.nombre}</p>
                    {g.tipo === 'propios' && (
                      <p className="text-[11px] text-slate-400">Creados por vos, sin empresa</p>
                    )}
                    {g.tipo === 'otros' && (
                      <p className="text-[11px] text-slate-400">Consultas tuyas sobre caballos que ya no tenés asignados</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 tabular-nums">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-800">{g.caballos}</p>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">caballos</p>
                  </div>
                  <div className="text-right w-12">
                    <p className={`text-sm font-semibold ${g.alertas > 0 ? 'text-brand-600' : 'text-slate-300'}`}>
                      {g.alertas}
                    </p>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">alertas</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="rounded-xl border border-brand-200 bg-brand-50/40 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-brand-200">
            <AlertTriangle size={15} className="text-brand-500" />
            <span className="text-xs font-semibold uppercase tracking-wide text-brand-700">
              Próximas consultas
            </span>
          </div>
          <div className="divide-y divide-brand-100">
            {alertas.map((a) => {
              const { texto, clase } = diasLabel(a.dias_restantes)
              return (
                <button
                  key={a.historial_id}
                  onClick={() => navigate(`/caballos/${a.caballo_id}/historial`)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-brand-50/60 transition-colors text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{a.caballo_nombre}</p>
                    {a.tipo && <p className="text-xs text-slate-400 truncate">{a.tipo}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${clase}`}>
                      {texto}
                    </span>
                    <ChevronRight size={14} className="text-slate-300" />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Dados de baja — solo se renderiza si el vet tiene alguno */}
      <CaballosDadosDeBajaVet
        onCambio={() => {
          caballoService.listarDelVeterinario()
            .then(setCaballos)
            .catch(() => { /* el desglose queda como estaba; no vale romper el panel */ })
        }}
      />

      {/* Últimas consultas */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
          <ClipboardList size={15} className="text-slate-400" />
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Últimas consultas
          </span>
        </div>

        {consultas.length === 0 ? (
          <p className="px-4 py-8 text-sm text-slate-400 text-center">
            Aún no registraste consultas.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {consultas.map((c) => (
              <button
                key={c.id}
                onClick={() => navigate(`/caballos/${c.caballo_id}/historial`)}
                className="w-full flex items-start justify-between px-4 py-3.5 hover:bg-slate-50 transition-colors text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-slate-400">{formatFecha(c.fecha_consulta)}</span>
                    <span className="text-xs font-medium text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">
                      {c.tipo}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-800 mt-0.5 truncate">
                    {c.caballo_nombre}
                  </p>
                  {c.diagnostico && (
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                      {c.diagnostico}
                    </p>
                  )}
                </div>
                <ChevronRight size={14} className="text-slate-300 shrink-0 mt-1 ml-2" />
              </button>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
