import { useRef, useState, useEffect } from 'react'
import { FileText, CheckCircle, ArrowLeft, BookOpen } from 'lucide-react'
import type { TerminosVigentes } from '../../services/terminosService'

interface Props {
  terminos: TerminosVigentes
  onAceptar: () => Promise<void>
}

/** Renderiza markdown mínimo: encabezados, negrita, listas y párrafos. */
function renderContenido(texto: string) {
  const lineas = texto.split('\n')
  const elementos: React.ReactNode[] = []

  lineas.forEach((linea, i) => {
    if (linea.startsWith('# ')) {
      elementos.push(
        <h2 key={i} className="text-base font-bold text-zinc-100 mt-4 mb-1">
          {linea.slice(2)}
        </h2>
      )
    } else if (linea.startsWith('## ')) {
      elementos.push(
        <h3 key={i} className="text-sm font-semibold text-emerald-400 mt-4 mb-1">
          {linea.slice(3)}
        </h3>
      )
    } else if (linea.startsWith('---')) {
      elementos.push(<hr key={i} className="border-zinc-700 my-3" />)
    } else if (linea.startsWith('- ')) {
      elementos.push(
        <li key={i} className="text-xs text-zinc-300 ml-4 list-disc leading-relaxed">
          {parseInline(linea.slice(2))}
        </li>
      )
    } else if (linea.trim() === '') {
      elementos.push(<div key={i} className="h-1" />)
    } else {
      elementos.push(
        <p key={i} className="text-xs text-zinc-300 leading-relaxed">
          {parseInline(linea)}
        </p>
      )
    }
  })

  return elementos
}

function parseInline(texto: string): React.ReactNode {
  const partes = texto.split(/(\*\*[^*]+\*\*)/)
  if (partes.length === 1) return texto
  return partes.map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i} className="font-semibold text-zinc-100">{p.slice(2, -2)}</strong>
      : p
  )
}

export default function TerminosModal({ terminos, onAceptar }: Props) {
  const [vista, setVista] = useState<'resumen' | 'leyendo'>('resumen')
  const scrollRef = useRef<HTMLDivElement>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const [scrollado, setScrollado] = useState(false)
  const [aceptando, setAceptando] = useState(false)
  const [error, setError] = useState('')

  // Al abrir la vista de lectura, verificar scroll
  useEffect(() => {
    if (vista !== 'leyendo') return
    setScrollado(false)

    // Pequeño delay para que el DOM renderice el contenido antes de medir
    const timer = setTimeout(() => {
      const el = scrollRef.current
      if (!el) return
      if (el.scrollHeight <= el.clientHeight + 20) {
        setScrollado(true)
        return
      }
      function onScroll() {
        if (!el) return
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
          setScrollado(true)
        }
      }
      el.addEventListener('scroll', onScroll)
      cleanupRef.current = () => el.removeEventListener('scroll', onScroll)
    }, 50)

    return () => {
      clearTimeout(timer)
      cleanupRef.current?.()
      cleanupRef.current = null
    }
  }, [vista])

  async function handleAceptar() {
    if (!scrollado || aceptando) return
    setError('')
    setAceptando(true)
    try {
      await onAceptar()
    } catch {
      setError('No se pudo registrar la aceptación. Intentá de nuevo.')
      setAceptando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl flex flex-col max-h-[90vh]">

        {/* ── VISTA RESUMEN ── */}
        {vista === 'resumen' && (
          <>
            <div className="px-8 py-8 flex flex-col items-center text-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600/20 border border-emerald-600/30">
                <FileText size={24} className="text-emerald-400" />
              </div>

              <div>
                <h2 className="text-base font-bold text-zinc-100">{terminos.titulo}</h2>
                <p className="mt-1 text-[11px] text-zinc-500">Versión {terminos.version}</p>
              </div>

              <p className="text-sm text-zinc-400 leading-relaxed max-w-xs">
                Antes de continuar necesitamos que leas y aceptes nuestros Términos y Condiciones de uso.
              </p>

              <div className="w-full pt-2 space-y-2">
                <button
                  onClick={() => setVista('leyendo')}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-emerald-600/50 bg-emerald-600/10 py-2.5 text-sm font-semibold text-emerald-400 transition hover:bg-emerald-600/20 active:scale-[0.98]"
                >
                  <BookOpen size={15} />
                  Ver Términos y Condiciones
                </button>

                <p className="text-[10px] text-zinc-600">
                  Debés leerlos completos para poder aceptarlos.
                </p>
              </div>
            </div>
          </>
        )}

        {/* ── VISTA LECTURA ── */}
        {vista === 'leyendo' && (
          <>
            {/* Cabecera */}
            <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-zinc-800">
              <button
                onClick={() => setVista('resumen')}
                className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 -ml-1 rounded-md"
              >
                <ArrowLeft size={16} />
              </button>
              <div>
                <h2 className="text-sm font-bold text-zinc-100">{terminos.titulo}</h2>
                <p className="text-[11px] text-zinc-500">Leé hasta el final para habilitar la aceptación</p>
              </div>
            </div>

            {/* Contenido scrolleable */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-6 py-4 space-y-0.5"
              style={{ minHeight: 0 }}
            >
              {renderContenido(terminos.contenido)}
              <div className="h-4" />
            </div>

            {/* Indicador de scroll */}
            {!scrollado && (
              <p className="text-center text-[11px] text-zinc-500 py-1.5 border-t border-zinc-800">
                ↓ Desplazate hasta el final para habilitar la aceptación
              </p>
            )}

            {/* Pie */}
            <div className="px-6 py-4 border-t border-zinc-800 space-y-3">
              {error && (
                <p className="text-xs text-rose-400 text-center">{error}</p>
              )}

              <button
                onClick={handleAceptar}
                disabled={!scrollado || aceptando}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-700 py-2.5 text-sm font-semibold text-white transition
                  hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {aceptando ? (
                  'Registrando…'
                ) : (
                  <>
                    <CheckCircle size={15} />
                    Acepto los Términos y Condiciones
                  </>
                )}
              </button>

              <p className="text-center text-[10px] text-zinc-600">
                Al aceptar, confirmás haber leído y comprendido estos términos.
              </p>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
