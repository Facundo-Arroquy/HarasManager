import {
  LayoutDashboard, LayoutGrid, Settings, SlidersHorizontal,
  ClipboardList, Droplets, Bell, ArrowLeftRight, FlaskConical,
  CalendarDays, BellRing, Settings2,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  roles?: string[]
  matchPrefix?: boolean
  requiresAccesoCentro?: boolean
}

export interface NavGroup {
  label: string
  requiresAccesoCentro?: boolean
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'General',
    items: [
      { to: '/dashboard',  label: 'Panel', icon: <LayoutDashboard size={18} />, roles: ['admin', 'jugador', 'piloto', 'peticero'] },
      { to: '/panel-vet', label: 'Panel', icon: <LayoutDashboard size={18} />, roles: ['veterinario'] },
      { to: '/caballos',          label: 'Caballos',           icon: <LayoutGrid size={18} /> },
      { to: '/revision-preventa', label: 'Revisión pre-venta', icon: <ClipboardList size={18} />, roles: ['veterinario'] },
      { to: '/transferir-vet',    label: 'Transferencias',     icon: <ArrowLeftRight size={18} />, roles: ['veterinario'] },
      { to: '/transferencias',    label: 'Transferencias',     icon: <ArrowLeftRight size={18} />, roles: ['admin'] },
      { to: '/admin',             label: 'Administración',     icon: <Settings size={18} />,       roles: ['admin'] },
      { to: '/alertas',           label: 'Alertas',            icon: <BellRing size={18} />,          roles: ['admin', 'jugador', 'piloto', 'veterinario'] },
      { to: '/config',            label: 'Configuración',      icon: <SlidersHorizontal size={18} />, roles: ['admin', 'jugador', 'piloto'] },
    ],
  },
  {
    label: 'Centro de Embriones',
    requiresAccesoCentro: true,
    items: [
      { to: '/centro-cria',                label: 'Panel reproductivo', icon: <FlaskConical size={18} /> },
      { to: '/centro-cria/caballos',       label: 'Caballos Centro',    icon: <LayoutGrid size={18} /> },
      { to: '/centro-cria/programa',       label: 'Programa semanal',   icon: <CalendarDays size={18} /> },
      { to: '/centro-cria/recordatorios',  label: 'Recordatorios',      icon: <Bell size={18} /> },
      { to: '/centro-cria/flushings',      label: 'Flushings',                    icon: <Droplets size={18} /> },
      { to: '/centro-cria/transferencias', label: 'Transferencias de embriones', icon: <ArrowLeftRight size={18} /> },
      { to: '/centro-cria/config',         label: 'Configuración',               icon: <Settings2 size={18} /> },
    ],
  },
]
