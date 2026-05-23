import { useState, useEffect, useCallback } from 'react'
import { ArrowLeftRight, CheckSquare, Square, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { caballoService } from '../../services/caballoService'
import {
  transferEmpresaService,
  type SociedadItem,
  type TransferenciaEmpresa,
} from '../../services/transferEmpresaService'

export default function TransferirEmpresaPage() {
  const { sociedadActiva } = useAuth()
  const sociedadId = sociedadActiva?.id ?? ''

  const [caballos, setCaballos] = useState<any[]>([])
  const [sociedades, setSociedades] = useState<SociedadItem[]>([])
  const [historial, setHistorial] = useState<TransferenciaEmpresa[]>([])

  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [tipo, setTipo] = useState<'registrada' | 'no_registrada'>('registrada')
  const [sociedadDestinoId, setSociedadDestinoId] = useState('')
  const [entidadNombre, setEntidadNombre] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)

  const cargarDatos = useCallback(async () => {
    if (!sociedadId) return
    const [listaCaballos, listaSociedades, listaHistorial] = await Promise.all([
      caballoService.listar(sociedadId),
      transferEmpresaService.listarSociedades(sociedadId),
      transferEmpresaService.listarHistorial(sociedadId),
    ])
    setCaballos(listaCaballos)
    setSociedades(listaSociedades)
    setHistorial(listaHistorial)
  }, [sociedadId])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  const toggleSeleccion = (id: string) => {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleTodos = () => {
    if (seleccionados.size === caballos.length) {
      setSeleccionados(new Set())
    } else {
      setSeleccionados(new Set(caballos.map((c) => c.id)))
    }
  }

  const puedeConfirmar =
    seleccionados.size > 0 &&
    (tipo === 'registrada' ? !!sociedadDestinoId : entidadNombre.trim().length > 0)

  const confirmar = async () => {
    if (!puedeConfirmar) return
    setSaving(true)
    setError(null)
    setExito(null)
    try {
      const sociedadDest = sociedades.find((s) => s.id === sociedadDestinoId)
      await transferEmpresaService.transferir(
        {
          caballoIds: Array.from(seleccionados),
          tipo,
          sociedadDestinoId: tipo === 'registrada' ? sociedadDestinoId : undefined,
          sociedadDestinoNombre: tipo === 'registrada' ? sociedadDest?.nombre : undefined,
          entidadNombre: tipo === 'no_registrada' ? entidadNombre.trim() : undefined,
        },
        sociedadId
      )
      setExito(
        `${seleccionados.size} caballo${seleccionados.size > 1 ? 's' : ''} transferido${seleccionados.size > 1 ? 's' : ''} correctamente.`
      )
      setSeleccionados(new Set())
      setSociedadDestinoId('')
      setEntidadNombre('')
      await cargarDatos()
    } catch (e: any) {
      setError(e?.message ?? 'Error al transferir')
    } finally {
      setSaving(false)
    }
  }

  const todosSeleccionados = caballos.length > 0 && seleccionados.size === caballos.length

  return (
    <div className="min-h-screen bg-zinc-950 pb-24 md:pb-8">
      {/* Header */}
      <div className="border-b border-zinc-800 px-4 py-4 md:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800">
            <ArrowLeftRight size={18} className="text-zinc-300" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-zinc-100">Transferir caballos</h1>
            <p className="text-xs text-zinc-500">Movimiento entre empresas o entidades externas</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 md:px-8 space-y-6 max-w-3xl">
        {/* Mensajes */}
        {exito && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-950 border border-emerald-800 px-4 py-3 text-sm text-emerald-300">
            <CheckCircle2 size={16} className="shrink-0" />
            {exito}
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-red-950 border border-red-800 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Lista de caballos */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          {/* Cabecera */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 bg-zinc-800/40">
            <button
              onClick={toggleTodos}
              className="flex items-center gap-2 text-sm text-zinc-300 hover:text-zinc-100 transition-colors"
            >
              {todosSeleccionados ? (
                <CheckSquare size={16} className="text-emerald-400" />
              ) : (
                <Square size={16} className="text-zinc-500" />
              )}
              Seleccionar todos
            </button>
            {seleccionados.size > 0 && (
              <span className="ml-auto text-xs font-medium text-emerald-400">
                {seleccionados.size} seleccionado{seleccionados.size > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Filas */}
          {caballos.length === 0 ? (
            <p className="px-4 py-6 text-sm text-zinc-500 text-center">
              No hay caballos disponibles para transferir.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {caballos.map((caballo) => {
                const activo = seleccionados.has(caballo.id)
                return (
                  <li key={caballo.id}>
                    <button
                      onClick={() => toggleSeleccion(caballo.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                        activo ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
                      }`}
                    >
                      {activo ? (
                        <CheckSquare size={16} className="shrink-0 text-emerald-400" />
                      ) : (
                        <Square size={16} className="shrink-0 text-zinc-600" />
                      )}
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-zinc-100 truncate">
                          {caballo.nombre}
                        </span>
                        <span className="block text-xs text-zinc-500">
                          {caballo.categoria}
                          {caballo.campo?.nombre ? ` · ${caballo.campo.nombre}` : ' · Sin campo'}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Panel destino — visible solo si hay seleccionados */}
        {seleccionados.size > 0 && (
          <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 space-y-4">
            <p className="text-sm font-medium text-zinc-200">Destino</p>

            {/* Selector de tipo */}
            <div className="flex gap-4">
              {(['registrada', 'no_registrada'] as const).map((t) => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="tipo"
                    value={t}
                    checked={tipo === t}
                    onChange={() => setTipo(t)}
                    className="accent-emerald-500"
                  />
                  <span className="text-sm text-zinc-300">
                    {t === 'registrada' ? 'Empresa registrada' : 'Entidad no registrada'}
                  </span>
                </label>
              ))}
            </div>

            {/* Selector de destino */}
            {tipo === 'registrada' ? (
              <select
                value={sociedadDestinoId}
                onChange={(e) => setSociedadDestinoId(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-600 focus:outline-none"
              >
                <option value="">— Seleccionar empresa —</option>
                {sociedades.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Nombre de la entidad"
                  value={entidadNombre}
                  onChange={(e) => setEntidadNombre(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-600 focus:outline-none"
                />
                <div className="flex items-start gap-2 rounded-lg bg-amber-950/50 border border-amber-800/60 px-3 py-2">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-400" />
                  <p className="text-xs text-amber-300">
                    Los caballos quedarán inactivos pero se guardará un registro histórico.
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={confirmar}
              disabled={!puedeConfirmar || saving}
              className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? 'Transfiriendo…' : 'Confirmar transferencia'}
            </button>
          </div>
        )}

        {/* Historial */}
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-600 mb-3">
            Historial
          </p>
          {historial.length === 0 ? (
            <p className="text-sm text-zinc-600">Sin transferencias registradas.</p>
          ) : (
            <ul className="space-y-2">
              {historial.map((t) => {
                const fecha = new Date(t.fecha).toLocaleDateString('es-AR', {
                  day: '2-digit',
                  month: '2-digit',
                })
                const destino =
                  t.tipo === 'registrada'
                    ? t.sociedadDestinoNombre ?? t.sociedadDestinoId
                    : t.entidadNombre
                return (
                  <li
                    key={t.id}
                    className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3"
                  >
                    <ArrowLeftRight size={14} className="mt-0.5 shrink-0 text-zinc-600" />
                    <div className="min-w-0">
                      <p className="text-sm text-zinc-200">
                        <span className="font-medium">{fecha}</span>
                        {' · '}
                        {t.caballoNombres.length === 1
                          ? t.caballoNombres[0]
                          : `${t.caballoNombres.length} caballos`}
                        {' → '}
                        <span className="text-zinc-300">{destino}</span>
                      </p>
                      <p className="text-xs text-zinc-600">
                        {t.tipo === 'registrada' ? 'Empresa registrada' : 'Entidad no registrada'}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
