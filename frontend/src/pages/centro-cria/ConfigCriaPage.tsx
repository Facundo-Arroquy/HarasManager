import { useState, useEffect, useCallback } from 'react'
import { Settings2, RotateCcw, Check, Plus, AlertCircle, Bell } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useCrianzaStore } from '../../store/crianzaStore'
import { crianzaService } from '../../services/crianzaService'
import { mensajeError } from '../../utils/error'
import {
  PLAZOS_VET_DEFAULTS,
  CHIPS_CON_RECORDATORIO,
  CHIPS_OBS_SUGERIDOS,
  type PlazosVet,
  type CatChipObs,
} from '../../types/crianza'
import RankingPadrillosConfig from './RankingPadrillosConfig'

// =============================================================================
// Configuración del centro de cría — por veterinario
// =============================================================================
// Definición de Gero (2026-07-30): la lista de acciones la define cada
// veterinario, y el plazo que se aplica es el del vet que hace el registro.
// Por eso esta pantalla es del vet: no hay configuración por sociedad.
// =============================================================================

export default function ConfigCriaPage() {
  const { rol } = useAuth()
  const esVet = rol === 'veterinario'

  // El ranking de padrillos sí es del establecimiento: lo arman admin o vet
  // (definición de Gero, 2026-08-02). Acciones y plazos siguen siendo del vet.
  return (
    <div className="space-y-6 p-1 max-w-lg">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Configuración del centro</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {esVet
            ? 'Tus acciones y tus plazos de recordatorios se aplican en todos los establecimientos donde trabajás. El ranking de padrillos es del establecimiento.'
            : 'Ranking de padrillos por donante. Las acciones y los plazos de recordatorios los configura cada veterinario.'}
        </p>
      </div>

      <RankingPadrillosConfig />

      {esVet && (
        <>
          <CatalogoChips />
          <PlazosSection />
        </>
      )}
    </div>
  )
}

// ── Sección: acciones / tratamientos del veterinario ─────────────────────────

function CatalogoChips() {
  const { user } = useAuth()
  const [chips, setChips] = useState<CatChipObs[]>([])
  const [loading, setLoading] = useState(true)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const recargar = useCallback(() => {
    setLoading(true)
    crianzaService.listarMisChipsConInactivos()
      .then(setChips)
      .catch((e) => setError(mensajeError(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { recargar() }, [recargar])

  async function agregar(nombre: string) {
    if (!nombre.trim() || !user?.id) return
    setError('')
    setGuardando(true)
    try {
      await crianzaService.crearChipObs({ veterinario_id: user.id, nombre: nombre.trim() })
      setNuevoNombre('')
      recargar()
    } catch (err) {
      setError(mensajeError(err, 'No se pudo agregar la acción.'))
    } finally {
      setGuardando(false)
    }
  }

  async function handleToggle(chip: CatChipObs) {
    setError('')
    try {
      await crianzaService.actualizarChipObs(chip.id, !chip.activo)
      recargar()
    } catch (err) {
      setError(mensajeError(err, 'No se pudo actualizar la acción.'))
    }
  }

  const nombresExistentes = chips.map((c) => c.nombre)
  const sugerenciasPendientes = CHIPS_OBS_SUGERIDOS.filter((s) => !nombresExistentes.includes(s))

  return (
    <Section title="Mis acciones" icon={<Settings2 size={14} />}>
      <div className="p-4 space-y-3">
        <p className="text-xs text-slate-400">
          Son los chips que vas a poder marcar al cargar un registro. Los que
          tienen <Bell size={10} className="inline -mt-0.5" /> generan
          recordatorios automáticos — si los sacás, dejás de recibirlos.
        </p>

        {loading ? (
          <p className="text-xs text-slate-400">Cargando…</p>
        ) : chips.length === 0 ? (
          <p className="text-xs text-slate-500 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-3">
            Todavía no tenés acciones. Agregá las que uses, o sumá las habituales
            de una con los botones de abajo.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {chips.map((chip) => (
              <li key={chip.id} className="flex items-center justify-between gap-3 py-2">
                <span className={`text-sm flex items-center gap-1.5 ${chip.activo ? 'text-slate-700' : 'text-slate-400 line-through'}`}>
                  {chip.nombre}
                  {(CHIPS_CON_RECORDATORIO as readonly string[]).includes(chip.nombre) && (
                    <Bell size={11} className="text-brand-500" />
                  )}
                </span>
                <button
                  onClick={() => handleToggle(chip)}
                  className="text-xs text-brand-600 hover:text-brand-500 transition-colors"
                >
                  {chip.activo ? 'Sacar' : 'Volver a poner'}
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Sugerencias rápidas */}
        {sugerenciasPendientes.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
              Habituales
            </p>
            <div className="flex flex-wrap gap-1.5">
              {sugerenciasPendientes.map((s) => (
                <button
                  key={s}
                  onClick={() => agregar(s)}
                  disabled={guardando}
                  className="flex items-center gap-1 px-2 py-1 rounded-full border border-slate-300 bg-slate-50 text-xs text-slate-500 hover:border-brand-400 hover:text-brand-600 transition-colors disabled:opacity-50"
                >
                  <Plus size={11} />
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <form
          onSubmit={(e) => { e.preventDefault(); agregar(nuevoNombre) }}
          className="flex items-center gap-2 pt-1"
        >
          <input
            type="text"
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
            placeholder="Otra acción (ej: Doble PG)"
            className="flex-1 rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <button
            type="submit"
            disabled={guardando || !nuevoNombre.trim()}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-brand-500 hover:bg-brand-400 text-xs font-medium text-white transition-colors disabled:opacity-50"
          >
            <Plus size={13} />
            Agregar
          </button>
        </form>

        {error && (
          <p className="flex items-center gap-1.5 text-xs text-red-600">
            <AlertCircle size={12} />
            {error}
          </p>
        )}
      </div>
    </Section>
  )
}

// ── Sección: plazos de recordatorios ─────────────────────────────────────────

function PlazosSection() {
  const { user } = useAuth()
  const { plazos, guardarPlazos } = useCrianzaStore()
  const [local, setLocal] = useState<PlazosVet>(plazos)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState('')

  // Sincronizar cuando el store termina de cargar los plazos del vet
  useEffect(() => { setLocal(plazos) }, [plazos])

  function setField(key: keyof PlazosVet, value: number) {
    setLocal((prev) => ({ ...prev, [key]: value }))
    setGuardado(false)
  }

  async function handleGuardar() {
    if (!user?.id) return
    setError('')
    try {
      await guardarPlazos(user.id, local)
      setGuardado(true)
    } catch (err) {
      setError(mensajeError(err, 'No se pudieron guardar los plazos.'))
    }
  }

  function handleReset() {
    setLocal(PLAZOS_VET_DEFAULTS)
    setGuardado(false)
  }

  return (
    <>
      <Section title="Donante" icon={<Settings2 size={14} />}>
        <Regla
          label="Strelin → Inseminación (IN)"
          valor={local.donante_strelin_a_in}
          default_={PLAZOS_VET_DEFAULTS.donante_strelin_a_in}
          onChange={(v) => setField('donante_strelin_a_in', v)}
        />
        <Regla
          label="Inseminación (IN) → OXI"
          valor={local.donante_in_a_oxi}
          default_={PLAZOS_VET_DEFAULTS.donante_in_a_oxi}
          onChange={(v) => setField('donante_in_a_oxi', v)}
        />
        <Regla
          label="Ovulación (OV) → Flushing"
          valor={local.donante_ov_a_flushing}
          default_={PLAZOS_VET_DEFAULTS.donante_ov_a_flushing}
          onChange={(v) => setField('donante_ov_a_flushing', v)}
        />
        <Regla
          label="PG → Revisión PG"
          valor={local.donante_pg_a_revision_pg}
          default_={PLAZOS_VET_DEFAULTS.donante_pg_a_revision_pg}
          onChange={(v) => setField('donante_pg_a_revision_pg', v)}
        />
        <Regla
          label="Flushing → Revisión Flushing"
          valor={local.donante_flushing_a_revision}
          default_={PLAZOS_VET_DEFAULTS.donante_flushing_a_revision}
          onChange={(v) => setField('donante_flushing_a_revision', v)}
        />
      </Section>

      <Section title="Receptora" icon={<Settings2 size={14} />}>
        <Regla
          label="PG → Revisión PG"
          valor={local.receptora_pg_a_revision_pg}
          default_={PLAZOS_VET_DEFAULTS.receptora_pg_a_revision_pg}
          onChange={(v) => setField('receptora_pg_a_revision_pg', v)}
        />
        <Regla
          label="Ovulación (OV) → Dar PG"
          valor={local.receptora_ov_a_dar_pg}
          default_={PLAZOS_VET_DEFAULTS.receptora_ov_a_dar_pg}
          onChange={(v) => setField('receptora_ov_a_dar_pg', v)}
        />
      </Section>

      <p className="text-xs text-slate-400">
        Las revisiones de Strelin (Receptora) y revisiones manuales se agendan al
        próximo lunes, miércoles o viernes — no son configurables.
      </p>

      <div className="flex items-center gap-3">
        <button
          onClick={handleGuardar}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-brand-500 hover:bg-brand-400 text-sm font-medium text-white transition-colors"
        >
          {guardado ? <Check size={14} /> : null}
          {guardado ? 'Guardado' : 'Guardar plazos'}
        </button>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <RotateCcw size={13} />
          Restablecer valores por defecto
        </button>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertCircle size={12} />
          {error}
        </p>
      )}
    </>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function Section({
  title, icon, children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 text-xs font-medium text-slate-500 uppercase tracking-wider">
        {icon}
        {title}
      </div>
      <div className="divide-y divide-slate-100">{children}</div>
    </div>
  )
}

function Regla({
  label, valor, default_, onChange,
}: {
  label: string
  valor: number
  default_: number
  onChange: (v: number) => void
}) {
  const [raw, setRaw] = useState(String(valor))
  const modificado = valor !== default_

  // Sincronizar si el valor externo cambia (ej: reset, o carga desde la DB)
  useEffect(() => {
    setRaw(String(valor))
  }, [valor])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setRaw(e.target.value)
  }

  function handleBlur() {
    const v = parseInt(raw, 10)
    if (!isNaN(v) && v >= 1 && v <= 30) {
      onChange(v)
      setRaw(String(v))
    } else {
      // Revertir al valor válido actual
      setRaw(String(valor))
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className={`text-sm flex-1 ${modificado ? 'text-slate-700' : 'text-slate-500'}`}>
        {label}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        {modificado && (
          <span className="text-[10px] text-brand-600 border border-brand-300 rounded px-1.5 py-0.5">
            modificado
          </span>
        )}
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={1}
            max={30}
            value={raw}
            onChange={handleChange}
            onBlur={handleBlur}
            className="w-14 rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-sm text-center text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <span className="text-xs text-slate-400">días</span>
        </div>
      </div>
    </div>
  )
}
