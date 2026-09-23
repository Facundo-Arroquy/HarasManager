import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDownAZ, ArrowUpAZ, Filter, Search } from 'lucide-react'
import { useEscapeClose } from '../../hooks/useEscapeClose'
import type { DireccionOrden } from '../../hooks/useFiltrosTabla'

interface Props {
  titulo:     string
  opciones:   string[]
  /** `null` = sin filtro (todo tildado). */
  seleccion:  Set<string> | null
  onCambiar:  (sel: Set<string> | null) => void
  orden:      DireccionOrden | null
  onOrdenar:  (dir: DireccionOrden | null) => void
}

const ETIQUETA_VACIO = '(Vacío)'
const ANCHO_POPOVER  = 240
/** Alto aproximado del popover antes de montarlo (orden + buscador + lista + pie). */
const ALTO_ESTIMADO  = 380
const ES_TACTIL      = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

/**
 * Encabezado de columna con filtro tipo Excel: ordenar, buscar y tildar los
 * valores a mostrar. El popover va en un portal para que no lo recorte el
 * `overflow-x-auto` de la tabla.
 */
export default function FiltroColumna({ titulo, opciones, seleccion, onCambiar, orden, onOrdenar }: Props) {
  const [abierto, setAbierto] = useState(false)
  const botonRef = useRef<HTMLButtonElement>(null)
  const activo = seleccion !== null || orden !== null

  return (
    <div className="inline-flex items-center gap-1">
      <span>{titulo}</span>
      <button
        ref={botonRef}
        type="button"
        onClick={() => setAbierto((v) => !v)}
        title={`Filtrar ${titulo.toLowerCase()}`}
        className={`rounded p-1 transition-colors ${
          activo
            ? 'bg-brand-50 text-brand-600'
            : 'text-slate-300 hover:bg-slate-100 hover:text-slate-500'
        }`}
      >
        <Filter size={12} fill={seleccion ? 'currentColor' : 'none'} />
      </button>
      {abierto && (
        <Popover
          anchor={botonRef}
          opciones={opciones}
          seleccion={seleccion}
          onCambiar={onCambiar}
          orden={orden}
          onOrdenar={onOrdenar}
          onCerrar={() => setAbierto(false)}
        />
      )}
    </div>
  )
}

function Popover({
  anchor, opciones, seleccion, onCambiar, orden, onOrdenar, onCerrar,
}: Omit<Props, 'titulo'> & {
  anchor: React.RefObject<HTMLButtonElement | null>
  onCerrar: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [busqueda, setBusqueda] = useState('')
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  const cerrar = useCallback(() => onCerrar(), [onCerrar])
  useEscapeClose(cerrar)

  const ubicar = useEffectEvent(() => {
    const r = anchor.current?.getBoundingClientRect()
    if (!r) return
    const left = Math.max(8, Math.min(r.left, window.innerWidth - ANCHO_POPOVER - 8))
    // Si no entra abajo (la tabla suele estar al pie de la pantalla), se abre arriba.
    const alto = ref.current?.offsetHeight ?? ALTO_ESTIMADO
    const top  = r.bottom + 4 + alto > window.innerHeight - 8
      ? Math.max(8, r.top - alto - 4)
      : r.bottom + 4
    setPos({ top, left })
  })

  useLayoutEffect(() => ubicar(), [])

  // Click afuera cierra (el botón no cuenta, él mismo alterna). Scroll y resize
  // solo lo reubican junto a su columna: en el celular el teclado que abre el
  // buscador achica la pantalla y la scrollea, y cerrar ahí hacía que el
  // popover se abriera y cerrara solo.
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node
      if (ref.current?.contains(t) || anchor.current?.contains(t)) return
      cerrar()
    }
    function onScroll(e: Event) {
      if (ref.current?.contains(e.target as Node)) return
      ubicar()
    }
    document.addEventListener('mousedown', onMouseDown)
    window.addEventListener('scroll', onScroll, true)
    const onResize = () => ubicar()
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [anchor, cerrar])

  const q = busqueda.trim().toLowerCase()
  const visibles = q
    ? opciones.filter((o) => (o || ETIQUETA_VACIO).toLowerCase().includes(q))
    : opciones
  const tildado = (v: string) => seleccion === null || seleccion.has(v)
  const todosVisiblesTildados = visibles.length > 0 && visibles.every(tildado)

  /** Si queda todo tildado se vuelve a `null`: sin filtro, como Excel. */
  function aplicar(sel: Set<string>) {
    onCambiar(opciones.every((o) => sel.has(o)) ? null : sel)
  }

  function toggle(v: string) {
    const sel = new Set(seleccion ?? opciones)
    if (sel.has(v)) sel.delete(v)
    else sel.add(v)
    aplicar(sel)
  }

  function toggleTodos() {
    const sel = new Set(seleccion ?? opciones)
    for (const v of visibles) {
      if (todosVisiblesTildados) sel.delete(v)
      else sel.add(v)
    }
    aplicar(sel)
  }

  if (!pos) return null

  return createPortal(
    <div
      ref={ref}
      style={{ top: pos.top, left: pos.left, width: ANCHO_POPOVER }}
      className="fixed z-50 rounded-xl border border-slate-200 bg-white text-sm font-normal text-slate-700 shadow-lg"
    >
      <div className="border-b border-slate-100 p-1">
        <BotonOrden activo={orden === 'asc'} onClick={() => onOrdenar(orden === 'asc' ? null : 'asc')}>
          <ArrowDownAZ size={14} /> Ordenar de A a Z
        </BotonOrden>
        <BotonOrden activo={orden === 'desc'} onClick={() => onOrdenar(orden === 'desc' ? null : 'desc')}>
          <ArrowUpAZ size={14} /> Ordenar de Z a A
        </BotonOrden>
      </div>

      <div className="p-2">
        <div className="relative mb-2">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            // En pantallas táctiles no: abriría el teclado y taparía la lista.
            autoFocus={!ES_TACTIL}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar"
            className="w-full rounded-lg border border-slate-300 py-1.5 pl-7 pr-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>

        <div className="max-h-56 overflow-y-auto">
          {visibles.length === 0 ? (
            <p className="px-2 py-2 text-xs text-slate-400">Sin coincidencias</p>
          ) : (
            <>
              <Opcion checked={todosVisiblesTildados} onChange={toggleTodos}>
                <span className="font-medium">(Seleccionar todo)</span>
              </Opcion>
              {visibles.map((v) => (
                <Opcion key={v} checked={tildado(v)} onChange={() => toggle(v)}>
                  <span className={v ? '' : 'italic text-slate-400'}>{v || ETIQUETA_VACIO}</span>
                </Opcion>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="flex justify-between border-t border-slate-100 p-2">
        <button
          type="button"
          onClick={() => { onCambiar(null); onOrdenar(null) }}
          disabled={seleccion === null && orden === null}
          className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          Borrar filtro
        </button>
        <button
          type="button"
          onClick={cerrar}
          className="rounded-lg bg-brand-500 px-3 py-1 text-xs font-medium text-white hover:bg-brand-600"
        >
          Listo
        </button>
      </div>
    </div>,
    document.body,
  )
}

function BotonOrden({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${
        activo ? 'bg-brand-50 text-brand-700' : 'hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  )
}

function Opcion({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-slate-50">
      <input type="checkbox" checked={checked} onChange={onChange} className="rounded border-slate-300" />
      <span className="truncate">{children}</span>
    </label>
  )
}
