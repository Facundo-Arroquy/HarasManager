import { useEffect, useState } from 'react'
import { Pencil, Trash2, Check, X, Plus, MapPin } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { campoService, type CampoConConteo } from '../../services/campoService'

export default function CamposConfig() {
  const { sociedadActiva } = useAuth()

  const [campos,   setCampos]   = useState<CampoConConteo[]>([])
  const [loading,  setLoading]  = useState(true)
  const [editId,   setEditId]   = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editDesc,   setEditDesc]   = useState('')
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  // Nuevo campo
  const [showForm,  setShowForm]  = useState(false)
  const [newNombre, setNewNombre] = useState('')
  const [newDesc,   setNewDesc]   = useState('')

  async function cargar() {
    if (!sociedadActiva) return
    setLoading(true)
    campoService.listarConConteo(sociedadActiva.id)
      .then(setCampos)
      .finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [sociedadActiva]) // eslint-disable-line react-hooks/exhaustive-deps

  function startEdit(campo: CampoConConteo) {
    setEditId(campo.id)
    setEditNombre(campo.nombre)
    setEditDesc(campo.descripcion ?? '')
  }

  function cancelEdit() {
    setEditId(null)
    setEditNombre('')
    setEditDesc('')
  }

  async function saveEdit() {
    if (!editId || !editNombre.trim()) return
    setSaving(true)
    setError('')
    try {
      await campoService.actualizar(editId, editNombre, editDesc || undefined)
      await cargar()
      cancelEdit()
    } catch (err: unknown) {
      setError((err as any)?.message ?? 'Error al actualizar el campo.')
    } finally {
      setSaving(false)
    }
  }

  async function handleEliminar(id: string) {
    setSaving(true)
    setError('')
    try {
      await campoService.eliminar(id)
      await cargar()
      setConfirmDel(null)
    } catch (err: unknown) {
      setError((err as any)?.message ?? 'Error al eliminar el campo.')
    } finally {
      setSaving(false)
    }
  }

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault()
    if (!newNombre.trim() || !sociedadActiva) return
    setSaving(true)
    setError('')
    try {
      await campoService.crear(newNombre.trim(), newDesc.trim() || undefined, sociedadActiva.id)
      await cargar()
      setNewNombre('')
      setNewDesc('')
      setShowForm(false)
    } catch (err: unknown) {
      setError((err as any)?.message ?? 'Error al crear el campo.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-slate-400">Cargando campos…</p>

  return (
    <div className="space-y-4 max-w-2xl">
      {error && (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>
      )}
      {/* Header + botón agregar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {campos.length} campo{campos.length !== 1 ? 's' : ''} registrado{campos.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => { setShowForm((v) => !v); setNewNombre(''); setNewDesc('') }}
          className="flex items-center gap-1.5 rounded-md bg-brand-500 hover:bg-brand-500 px-3 py-1.5 text-xs font-medium text-white transition-colors"
        >
          <Plus size={13} />
          Nuevo campo
        </button>
      </div>

      {/* Formulario nuevo campo */}
      {showForm && (
        <form
          onSubmit={handleCrear}
          className="rounded-lg border border-slate-300 bg-slate-100/60 p-4 space-y-3"
        >
          <p className="text-xs font-semibold text-slate-600">Nuevo campo / caballeriza</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400">Nombre *</label>
              <input
                type="text"
                value={newNombre}
                onChange={(e) => setNewNombre(e.target.value)}
                placeholder="Potrero Norte"
                autoFocus
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400">Descripción</label>
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Capacidad, uso, etc."
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!newNombre.trim() || saving}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-brand-500 hover:bg-brand-500 text-white disabled:opacity-40 transition-colors"
            >
              {saving ? 'Creando…' : 'Crear'}
            </button>
          </div>
        </form>
      )}

      {/* Lista de campos */}
      <div className="rounded-lg border border-slate-200 overflow-hidden divide-y divide-slate-200">
        {campos.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-slate-400">
            No hay campos. Creá uno con el botón de arriba.
          </p>
        )}

        {campos.map((campo) => (
          <div key={campo.id} className="px-4 py-3 bg-white hover:bg-white/80 transition-colors">
            {editId === campo.id ? (
              /* Fila en modo edición */
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={editNombre}
                    onChange={(e) => setEditNombre(e.target.value)}
                    placeholder="Nombre"
                    autoFocus
                    className="rounded-md border border-slate-300 bg-slate-100 px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  <input
                    type="text"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    placeholder="Descripción (opcional)"
                    className="rounded-md border border-slate-300 bg-slate-100 px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={cancelEdit}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X size={12} /> Cancelar
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={!editNombre.trim() || saving}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-brand-600 hover:text-brand-500 disabled:opacity-40 transition-colors"
                  >
                    <Check size={12} /> Guardar
                  </button>
                </div>
              </div>
            ) : confirmDel === campo.id ? (
              /* Confirmación de eliminación */
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-brand-600">
                  {campo.caballos_count > 0
                    ? `¿Eliminar "${campo.nombre}"? Sus ${campo.caballos_count} caballos quedarán sin campo.`
                    : `¿Eliminar "${campo.nombre}"?`}
                </p>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setConfirmDel(null)}
                    className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleEliminar(campo.id)}
                    disabled={saving}
                    className="px-2 py-1 text-xs font-medium text-rose-600 hover:text-rose-700 disabled:opacity-40 transition-colors"
                  >
                    {saving ? 'Eliminando…' : 'Eliminar'}
                  </button>
                </div>
              </div>
            ) : (
              /* Fila normal */
              <div className="flex items-center gap-3">
                <MapPin size={13} className="text-brand-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{campo.nombre}</p>
                  {campo.descripcion && (
                    <p className="text-xs text-slate-400 truncate">{campo.descripcion}</p>
                  )}
                </div>
                <span className="text-xs text-slate-400 shrink-0">
                  {campo.caballos_count} animal{campo.caballos_count !== 1 ? 'es' : ''}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => startEdit(campo)}
                    className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    title="Renombrar"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => setConfirmDel(campo.id)}
                    className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
