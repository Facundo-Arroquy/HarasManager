import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Settings, ChevronDown, ChevronUp, CreditCard, MapPin, IdCard } from 'lucide-react'

/** Apartados de la configuración del vet. */
const ITEMS = [
  { to: '/config-vet/datos',       label: 'Mis datos',   icon: <IdCard size={15} /> },
  { to: '/config-vet/campos',      label: 'Mis campos',  icon: <MapPin size={15} /> },
  { to: '/config-vet/suscripcion', label: 'Suscripción', icon: <CreditCard size={15} /> },
]

/**
 * Configuración del veterinario independiente, plegable, al pie del menú —
 * arriba de "Cerrar sesión".
 *
 * Va en el pie y no entre las secciones de trabajo (Caballos, Sanidad,
 * Calendario) porque no es una tarea del día a día: es la cuenta. Ese lugar,
 * junto al mail y la sesión, es donde uno la busca.
 *
 * Es un contenedor desde el principio aunque tenga un solo apartado: cuando
 * entren datos de la cuenta o notificaciones, no hay que rediseñar el menú.
 */
export default function ConfigVetMenu({ onNavegar }: { onNavegar?: () => void }) {
  const location = useLocation()
  // Abierta si el vet ya está parado en una de sus pantallas; si no, plegada
  // para no competir con el menú principal.
  const [abierto, setAbierto] = useState(() => location.pathname.startsWith('/config-vet'))

  return (
    <div>
      <button
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
      >
        <span className="flex items-center gap-2.5">
          <Settings size={15} className="text-slate-400" />
          Configuración
        </span>
        {abierto
          ? <ChevronUp size={13} className="text-slate-300" />
          : <ChevronDown size={13} className="text-slate-300" />}
      </button>

      {abierto && (
        <div className="mt-0.5 space-y-0.5 pl-4">
          {ITEMS.map((item) => {
            const isActive = location.pathname.startsWith(item.to)
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onNavegar}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 font-semibold'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className={isActive ? 'text-brand-500' : 'text-slate-400'}>
                  {item.icon}
                </span>
                {item.label}
              </NavLink>
            )
          })}
        </div>
      )}
    </div>
  )
}
