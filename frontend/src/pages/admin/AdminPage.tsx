import { useState } from 'react'
import UsuariosTab from './UsuariosTab'
import AccesosVetTab from './AccesosVetTab'
import InvitarUsuarioTab from './InvitarUsuarioTab'

type Tab = 'usuarios' | 'accesos' | 'invitar'

const TABS: { id: Tab; label: string }[] = [
  { id: 'usuarios', label: 'Usuarios' },
  { id: 'accesos',  label: 'Accesos veterinario' },
  { id: 'invitar',  label: 'Invitar usuario' },
]

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('usuarios')

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-zinc-800 px-4 md:px-6 py-4">
        <h1 className="text-lg font-semibold text-zinc-100">Administración</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Gestión del establecimiento</p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 px-4 md:px-6 pt-4 border-b border-zinc-800 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2 whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-emerald-500 text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {activeTab === 'usuarios' && <UsuariosTab />}
        {activeTab === 'accesos'  && <AccesosVetTab />}
        {activeTab === 'invitar'  && <InvitarUsuarioTab />}
      </div>
    </div>
  )
}
