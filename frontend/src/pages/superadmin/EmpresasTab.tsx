import { Building2, Footprints, Users, MapPin, ChevronRight } from 'lucide-react'
import { superAdminService, type EmpresaStats } from '../../services/superAdminService'

interface Props {
  onGestionarUsuarios: (sociedadId: string) => void
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-zinc-500">{icon}</div>
      <div>
        <p className="text-lg font-semibold text-zinc-100 leading-none">{value}</p>
        <p className="text-[11px] text-zinc-500 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

function EmpresaCard({ empresa, onGestionar }: { empresa: EmpresaStats; onGestionar: () => void }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800">
          <Building2 size={18} className="text-emerald-400" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-zinc-100 truncate">{empresa.nombre}</h3>
          <p className="text-[11px] text-zinc-500 mt-0.5">{empresa.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 border-t border-zinc-800 pt-4">
        <Stat icon={<Footprints size={14} />} value={empresa.cantidadCaballos} label="Caballos" />
        <Stat icon={<Users size={14} />}    value={empresa.cantidadUsuarios} label="Usuarios" />
        <Stat icon={<MapPin size={14} />}   value={empresa.cantidadCampos}   label="Campos" />
      </div>

      <button
        onClick={onGestionar}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors"
      >
        Gestionar usuarios
        <ChevronRight size={13} />
      </button>
    </div>
  )
}

export default function EmpresasTab({ onGestionarUsuarios }: Props) {
  const empresas = superAdminService.listarEmpresas()

  return (
    <div>
      <p className="text-xs text-zinc-500 mb-4">{empresas.length} empresas registradas</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {empresas.map((emp) => (
          <EmpresaCard
            key={emp.id}
            empresa={emp}
            onGestionar={() => onGestionarUsuarios(emp.id)}
          />
        ))}
      </div>
    </div>
  )
}
