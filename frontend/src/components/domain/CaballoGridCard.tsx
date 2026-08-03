import { CheckSquare, ClipboardList, Dna, Hash, MapPin, Square, Tag } from 'lucide-react'
import { calcularEdadDetallada } from '../../utils/fecha'
import { nombreCaballo } from '../../utils/caballo'
import FotoCaballo from './FotoCaballo'

interface CaballoGridCardProps {
  caballo: {
    id: string
    nombre: string
    fecha_nacimiento?: string | null
    categoria?: string | null
    rol_reproductivo?: string | null
    prenada?: boolean | null
    numero_registro?: string | null
    numero_chip?: string | null
    cat_raza?: { nombre: string } | null
    cat_pelaje?: { nombre: string } | null
    campo?: { nombre: string } | null
    tags?: { id: number; nombre: string }[]
  }
  /** Abre el detalle rápido del animal. */
  onVerFicha?: () => void
  /** Navega al historial clínico. */
  onHistorial?: () => void
  seleccionado?: boolean
  onToggle?: () => void
  empresaNombre?: string
  /** Marca la tarjeta como inactiva (subsección "Dados de baja"). */
  dadoDeBaja?: boolean
}

const CATEGORIA_STYLE: Record<string, string> = {
  Yegua:    'bg-pink-100 text-pink-700 ring-1 ring-pink-200',
  Padrillo: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200',
  Caballo:  'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  Potrillo: 'bg-brand-100 text-brand-700 ring-1 ring-brand-200',
}

export default function CaballoGridCard({
  caballo,
  onVerFicha,
  onHistorial,
  seleccionado,
  onToggle,
  empresaNombre,
  dadoDeBaja,
}: CaballoGridCardProps) {
  const enModoSeleccion = onToggle !== undefined
  const badgeClass      = CATEGORIA_STYLE[caballo.categoria ?? ''] ?? CATEGORIA_STYLE['Caballo']
  const edad            = calcularEdadDetallada(caballo.fecha_nacimiento)
  const nombreMostrado  = nombreCaballo(caballo)
  // El RP solo se muestra como dato aparte si además hay nombre; si no, ya se
  // está mostrando como identificador principal ("RP 1234").
  const mostrarRP = Boolean(caballo.numero_registro && caballo.nombre?.trim())

  return (
    <div
      onClick={enModoSeleccion ? onToggle : undefined}
      className={`flex flex-col overflow-hidden rounded-xl border bg-white transition ${
        enModoSeleccion ? 'cursor-pointer' : ''
      } ${
        seleccionado
          ? 'border-brand-500 ring-2 ring-brand-500/30'
          : 'border-slate-200 hover:shadow-lg'
      }`}
    >
      {/* Foto */}
      <div className="relative">
        <FotoCaballo
          caballoId={caballo.id}
          nombre={nombreMostrado}
          canEdit={false}
          shape="rect"
          height={176}
        />
        {enModoSeleccion && (
          <span className="absolute left-2 top-2 rounded-md bg-white/90 p-1 shadow-sm">
            {seleccionado
              ? <CheckSquare size={18} className="text-brand-600" />
              : <Square size={18} className="text-slate-400" />
            }
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        {/* Nombre + badges */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 truncate font-semibold text-slate-900" title={nombreMostrado}>
            {nombreMostrado}
          </h3>
          <span className="flex shrink-0 items-center gap-1.5">
            {dadoDeBaja ? (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-700 ring-1 ring-rose-200">
                Dado de baja
              </span>
            ) : (
              <>
                {caballo.categoria && (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badgeClass}`}>
                    {caballo.categoria}
                  </span>
                )}
                {caballo.categoria === 'Yegua' && caballo.prenada && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                    Preñada
                  </span>
                )}
                {(caballo.tags ?? []).map((t) => (
                  <span
                    key={t.id}
                    className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-medium text-teal-700 ring-1 ring-teal-200"
                  >
                    {t.nombre}
                  </span>
                ))}
              </>
            )}
          </span>
        </div>

        {/* Edad + empresa (la empresa solo aparece en el listado del veterinario) */}
        <p className="mt-2 truncate text-sm text-slate-500">
          {edad}
          {empresaNombre && <span className="text-slate-400"> · {empresaNombre}</span>}
        </p>

        {/* Datos */}
        <div className="mt-3 space-y-1 text-sm text-slate-600">
          <div className="flex items-center gap-1.5">
            <MapPin size={13} className="shrink-0 text-brand-500" />
            {caballo.campo
              ? <span className="truncate">{caballo.campo.nombre}</span>
              : <span className="text-slate-400">Sin campo asignado</span>
            }
          </div>
          {caballo.rol_reproductivo && (
            <div className="flex items-center gap-1.5">
              <Dna size={13} className="shrink-0 text-slate-400" />
              <span className="truncate">{caballo.rol_reproductivo}</span>
            </div>
          )}
          {mostrarRP && (
            <div className="flex items-center gap-1.5">
              <Tag size={13} className="shrink-0 text-slate-400" />
              <span className="truncate font-mono text-xs">RP {caballo.numero_registro}</span>
            </div>
          )}
          {caballo.numero_chip && (
            <div className="flex items-center gap-1.5">
              <Hash size={13} className="shrink-0 text-slate-400" />
              <span className="truncate font-mono text-xs">{caballo.numero_chip}</span>
            </div>
          )}
        </div>

        {/* Acciones — ocultas en modo selección, donde toda la tarjeta es el toggle.
            `mt-auto` las ancla abajo para que queden alineadas entre tarjetas de
            la misma fila, que muestran distinta cantidad de datos. */}
        {!enModoSeleccion && (
          <div className="mt-auto flex gap-2 pt-4">
            <button
              onClick={onVerFicha}
              className="flex-1 rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
            >
              Ver ficha
            </button>
            <button
              onClick={onHistorial}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-500 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
            >
              <ClipboardList size={14} />
              Historial
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
