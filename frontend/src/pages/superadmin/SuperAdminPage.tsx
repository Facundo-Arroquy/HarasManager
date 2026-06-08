import { useState } from 'react'
import { LogOut, Building2, Users, Mail, Stethoscope } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import EmpresasTab from './EmpresasTab'
import UsuariosEmpresaTab from './UsuariosEmpresaTab'
import VeterinariosTab from './VeterinariosTab'
import LeadsTab from './LeadsTab'

type Tab = 'empresas' | 'usuarios' | 'veterinarios' | 'leads'

export default function SuperAdminPage() {
  const { signOut } = useAuth()
  const [tab, setTab] = useState<Tab>('empresas')
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState<string | null>(null)

  function handleGestionarUsuarios(sociedadId: string) {
    setEmpresaSeleccionada(sociedadId)
    setTab('usuarios')
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-sm">
              H
            </div>
            <div>
              <h1 className="text-sm font-semibold text-zinc-100 leading-tight">Panel SuperAdmin</h1>
              <p className="text-[11px] text-zinc-500">HarasManager</p>
            </div>
            <span className="rounded-md border border-emerald-700/50 bg-emerald-900/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300 ml-1">
              superadmin
            </span>
          </div>

          <button
            onClick={signOut}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          >
            <LogOut size={13} />
            Salir
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-zinc-800 bg-zinc-900">
        <div className="mx-auto max-w-6xl px-4 flex gap-1">
          <TabButton
            active={tab === 'empresas'}
            icon={<Building2 size={13} />}
            label="Empresas"
            onClick={() => setTab('empresas')}
          />
          <TabButton
            active={tab === 'usuarios'}
            icon={<Users size={13} />}
            label="Usuarios"
            onClick={() => setTab('usuarios')}
          />
          <TabButton
            active={tab === 'veterinarios'}
            icon={<Stethoscope size={13} />}
            label="Veterinarios"
            onClick={() => setTab('veterinarios')}
          />
          <TabButton
            active={tab === 'leads'}
            icon={<Mail size={13} />}
            label="Leads"
            onClick={() => setTab('leads')}
          />
        </div>
      </div>

      {/* Contenido */}
      <main className="mx-auto max-w-6xl px-4 py-6">
        {tab === 'empresas' && (
          <EmpresasTab onGestionarUsuarios={handleGestionarUsuarios} />
        )}
        {tab === 'usuarios' && (
          <UsuariosEmpresaTab sociedadIdInicial={empresaSeleccionada} />
        )}
        {tab === 'veterinarios' && <VeterinariosTab />}
        {tab === 'leads' && <LeadsTab />}
      </main>
    </div>
  )
}

function TabButton({ active, icon, label, onClick }: {
  active: boolean
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
        active
          ? 'border-emerald-500 text-emerald-400'
          : 'border-transparent text-zinc-500 hover:text-zinc-300'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}
