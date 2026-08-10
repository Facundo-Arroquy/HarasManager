import {
  LayoutDashboard, LayoutGrid, Settings, SlidersHorizontal,
  ClipboardList, Bell, ArrowLeftRight, FlaskConical,
  CalendarDays, Settings2, Syringe, Trophy,
} from 'lucide-react'
import type { ModuloCodigo } from '../../types/modulo'

export interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  roles?: string[]
  matchPrefix?: boolean
}

export interface NavGroup {
  label: string
  requiresModulo?: ModuloCodigo
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'General',
    items: [
      { to: '/dashboard',  label: 'Panel', icon: <LayoutDashboard size={18} />, roles: ['admin', 'jugador', 'piloto', 'peticero'] },
      { to: '/panel-vet', label: 'Panel', icon: <LayoutDashboard size={18} />, roles: ['veterinario'] },
      { to: '/calendario',        label: 'Calendario',         icon: <CalendarDays size={18} />,      roles: ['admin', 'jugador', 'piloto', 'veterinario'] },
      { to: '/caballos',          label: 'Caballos',           icon: <LayoutGrid size={18} /> },
      { to: '/sanidad',           label: 'Sanidad',            icon: <Syringe size={18} />,           roles: ['admin', 'jugador', 'piloto', 'veterinario'] },
      { to: '/revision-preventa', label: 'Revisión pre-venta', icon: <ClipboardList size={18} />, roles: ['veterinario'] },
      // Traspaso de caballos entre dueños/empresas. Una entrada por rol: el vet
      // mueve los caballos que creó él, el admin los de la sociedad.
      { to: '/transferir-vet',    label: 'Compra/Venta Caballos', icon: <ArrowLeftRight size={18} />, roles: ['veterinario'] },
      { to: '/transferencias',    label: 'Compra/Venta Caballos', icon: <ArrowLeftRight size={18} />, roles: ['admin'] },
      { to: '/admin',             label: 'Administración',     icon: <Settings size={18} />,       roles: ['admin'] },
      { to: '/config',            label: 'Configuración',      icon: <SlidersHorizontal size={18} />, roles: ['admin', 'jugador', 'piloto'] },
    ],
  },
  {
    label: 'Centro de Embriones',
    requiresModulo: 'centro_cria',
    items: [
      { to: '/centro-cria/programa',       label: 'Programa semanal',   icon: <CalendarDays size={18} /> },
      { to: '/centro-cria/caballos',       label: 'Caballos Centro',    icon: <LayoutGrid size={18} /> },
      { to: '/centro-cria/recordatorios',  label: 'Recordatorios',      icon: <Bell size={18} /> },
      // Los flushings se registran desde "Embriones": la sección
      // propia se eliminó para tener el stock y su origen en un solo lugar.
      { to: '/centro-cria/embriones',      label: 'Embriones',        icon: <FlaskConical size={18} /> },
      { to: '/centro-cria/transferencias', label: 'Transferencias Hechas/Ecografías', icon: <ArrowLeftRight size={18} /> },
      // Acciones y plazos son propios de cada veterinario; el ranking de
      // padrillos por donante sí es del establecimiento, así que el admin
      // también entra acá (definición de Gero, 2026-08-02).
      { to: '/centro-cria/config',         label: 'Configuración',               icon: <Settings2 size={18} />, roles: ['veterinario', 'admin'] },
    ],
  },
  {
    label: 'Polo',
    requiresModulo: 'polo',
    items: [
      // El armado del torneo lo hace el admin; el jugador y el piloto entran a
      // ver la conformación de equipos (la escritura la corta la RLS igual).
      { to: '/torneos', label: 'Torneos', icon: <Trophy size={18} />, matchPrefix: true, roles: ['admin', 'jugador', 'piloto'] },
    ],
  },
]
