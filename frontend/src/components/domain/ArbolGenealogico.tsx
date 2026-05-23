import { useState } from 'react'
import { Pencil, Link2Off } from 'lucide-react'
import type { Caballo } from '../../services/caballoService'
import EditarCaballoModal from './EditarCaballoModal'

interface Props {
  caballo: Caballo
  caballos: Caballo[]
}

interface NodeData {
  nombre: string
  categoria?: string
  registered: boolean
  raw?: Caballo
}

function resolveNode(
  id: string | null | undefined,
  nombre: string | null | undefined,
  caballos: Caballo[]
): NodeData | null {
  if (id) {
    const found = caballos.find((c) => c.id === id)
    if (found) return { nombre: found.nombre, categoria: found.categoria, registered: true, raw: found }
  }
  if (nombre) {
    return { nombre, registered: false }
  }
  return null
}

// ── Individual node box ──────────────────────────────────────────────────────

interface NodeBoxProps {
  data: NodeData | null
  label?: string
  small?: boolean
  onEdit?: () => void
}

function NodeBox({ data, label, small, onEdit }: NodeBoxProps) {
  const baseClass = small ? 'w-36 px-2.5 py-2' : 'w-44 px-3 py-2.5'

  if (!data) {
    return (
      <div className={`${baseClass} rounded-lg border border-dashed border-zinc-800 bg-zinc-950`}>
        {label && <p className="text-[10px] text-zinc-700 mb-0.5 uppercase tracking-wide">{label}</p>}
        <p className="text-xs text-zinc-700">—</p>
      </div>
    )
  }

  if (data.registered) {
    return (
      <div className={`${baseClass} rounded-lg border border-emerald-800 bg-emerald-950/30 relative group`}>
        {label && <p className="text-[10px] text-emerald-700 mb-0.5 uppercase tracking-wide">{label}</p>}
        <p className={`font-medium text-zinc-100 leading-snug ${small ? 'text-xs' : 'text-sm'}`}>{data.nombre}</p>
        {data.categoria && (
          <p className="text-[10px] text-zinc-500 mt-0.5">{data.categoria}</p>
        )}
        {onEdit && data.raw && (
          <button
            type="button"
            onClick={onEdit}
            className="absolute top-1.5 right-1.5 text-zinc-600 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Editar"
          >
            <Pencil size={11} />
          </button>
        )}
      </div>
    )
  }

  // Free text node
  return (
    <div className={`${baseClass} rounded-lg border border-zinc-700 bg-zinc-900/50`}>
      {label && <p className="text-[10px] text-zinc-600 mb-0.5 uppercase tracking-wide">{label}</p>}
      <div className="flex items-center gap-1.5">
        <Link2Off size={11} className="text-zinc-600 shrink-0" />
        <p className={`text-zinc-400 leading-snug ${small ? 'text-xs' : 'text-sm'}`}>{data.nombre}</p>
      </div>
      <p className="text-[10px] text-zinc-700 mt-0.5">Sin registro</p>
    </div>
  )
}

// ── Fork connector ────────────────────────────────────────────────────────────

function Fork() {
  return (
    <div className="flex flex-col w-7 shrink-0 self-stretch">
      <div className="flex-1 border-r border-b border-zinc-700" />
      <div className="flex-1 border-r border-t border-zinc-700" />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ArbolGenealogico({ caballo, caballos }: Props) {
  const [editingCaballo, setEditingCaballo] = useState<Caballo | null>(null)

  const padre = resolveNode(caballo.padre_id, caballo.padre_nombre, caballos)
  const madre = resolveNode(caballo.madre_id, caballo.madre_nombre, caballos)

  const abPat  = resolveNode(padre?.raw?.padre_id, padre?.raw?.padre_nombre, caballos)
  const abPat2 = resolveNode(padre?.raw?.madre_id, padre?.raw?.madre_nombre, caballos)
  const abMat  = resolveNode(madre?.raw?.padre_id, madre?.raw?.padre_nombre, caballos)
  const abMat2 = resolveNode(madre?.raw?.madre_id, madre?.raw?.madre_nombre, caballos)

  const hasAnyData = padre || madre

  if (!hasAnyData) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center">
        <p className="text-sm text-zinc-600">Sin datos genealógicos registrados.</p>
        <p className="text-xs text-zinc-700 mt-1">Usá "Editar caballo" para agregar padre y madre.</p>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto pb-2">
        <div className="flex items-stretch min-h-[220px] min-w-max">

          {/* Level 1: Subject */}
          <div className="flex items-center pr-0">
            <NodeBox
              data={{ nombre: caballo.nombre, categoria: caballo.categoria, registered: true, raw: caballo }}
            />
          </div>

          {/* Fork 1 */}
          <Fork />

          {/* Level 2: Parents + their branches */}
          <div className="flex flex-col">

            {/* Padre row */}
            <div className="flex-1 flex items-center">
              <div className="flex items-stretch" style={{ minHeight: '100%' }}>
                <div className="flex items-center">
                  <NodeBox
                    data={padre}
                    label="Padre"
                    onEdit={padre?.raw ? () => setEditingCaballo(padre.raw!) : undefined}
                  />
                </div>
                {/* Fork 2 */}
                <Fork />
                {/* Grandparents paternal */}
                <div className="flex flex-col self-stretch">
                  <div className="flex-1 flex items-center">
                    <NodeBox data={abPat} label="Abuelo paterno" small />
                  </div>
                  <div className="flex-1 flex items-center">
                    <NodeBox data={abPat2} label="Abuela paterna" small />
                  </div>
                </div>
              </div>
            </div>

            {/* Madre row */}
            <div className="flex-1 flex items-center">
              <div className="flex items-stretch" style={{ minHeight: '100%' }}>
                <div className="flex items-center">
                  <NodeBox
                    data={madre}
                    label="Madre"
                    onEdit={madre?.raw ? () => setEditingCaballo(madre.raw!) : undefined}
                  />
                </div>
                {/* Fork 3 */}
                <Fork />
                {/* Grandparents maternal */}
                <div className="flex flex-col self-stretch">
                  <div className="flex-1 flex items-center">
                    <NodeBox data={abMat} label="Abuelo materno" small />
                  </div>
                  <div className="flex-1 flex items-center">
                    <NodeBox data={abMat2} label="Abuela materna" small />
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Edit modal for parent horse */}
      {editingCaballo && (
        <EditarCaballoModal
          caballo={editingCaballo}
          caballos={caballos}
          onClose={() => setEditingCaballo(null)}
          onSuccess={() => setEditingCaballo(null)}
        />
      )}
    </>
  )
}
