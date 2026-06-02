import { useState, useEffect } from 'react'
import { getSupabaseClient } from '../../lib/supabase'
import Spinner from '../../components/ui/Spinner'
import { Mail, Building2, RefreshCw } from 'lucide-react'

interface Lead {
  id: string
  nombre: string
  email: string
  nombre_establecimiento: string
  cantidad_animales: string | null
  modulos_interes: string[] | null
  mensaje: string | null
  created_at: string
}

export default function LeadsTab() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function cargarLeads() {
    setLoading(true)
    setError(null)
    try {
      const supabase = getSupabaseClient()
      const { data, error: err } = await supabase
        .from('lead')
        .select('*')
        .order('created_at', { ascending: false })
      if (err) throw err
      setLeads(data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar leads.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargarLeads() }, [])

  function formatFecha(iso: string) {
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-zinc-300">
            {leads.length} lead{leads.length !== 1 ? 's' : ''} registrado{leads.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={cargarLeads}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
        >
          <RefreshCw size={12} />
          Actualizar
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-800/50 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && leads.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
          <Mail size={32} className="mb-3 opacity-40" />
          <p className="text-sm">Todavía no hay leads registrados.</p>
          <p className="text-xs mt-1 opacity-60">Los contactos desde la landing aparecerán aquí.</p>
        </div>
      )}

      {!loading && leads.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60">
                {['Nombre', 'Email', 'Establecimiento', 'Animales', 'Módulos', 'Mensaje', 'Fecha'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-zinc-400 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.map((lead, i) => (
                <tr
                  key={lead.id}
                  className={`border-b border-zinc-800/50 ${i % 2 === 0 ? 'bg-zinc-950' : 'bg-zinc-900/30'} hover:bg-zinc-800/40 transition-colors`}
                >
                  <td className="px-4 py-3 text-zinc-200 font-medium whitespace-nowrap">{lead.nombre}</td>
                  <td className="px-4 py-3">
                    <a href={`mailto:${lead.email}`} className="text-emerald-400 hover:underline">
                      {lead.email}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-zinc-300 whitespace-nowrap">
                    <span className="flex items-center gap-1">
                      <Building2 size={11} className="text-zinc-500" />
                      {lead.nombre_establecimiento}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">
                    {lead.cantidad_animales ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(lead.modulos_interes ?? []).map((m) => (
                        <span
                          key={m}
                          className="rounded px-1.5 py-0.5 text-[10px] bg-emerald-900/40 text-emerald-400 border border-emerald-800/50 whitespace-nowrap"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 max-w-[200px] truncate">
                    {lead.mensaje || '—'}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">
                    {formatFecha(lead.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
