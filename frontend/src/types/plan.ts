/** Plan comercial de la empresa. Espeja el enum `plan_sociedad` de Postgres. */
export type PlanSociedad = 'silver' | 'gold' | 'diamond'

export const PLANES: PlanSociedad[] = ['silver', 'gold', 'diamond']

export const PLAN_LABEL: Record<PlanSociedad, string> = {
  silver:  'Silver',
  gold:    'Gold',
  diamond: 'Diamond',
}

/** Estilos del tag, sobre fondo claro (app) y sobre fondo oscuro (superadmin). */
export const PLAN_STYLE: Record<PlanSociedad, string> = {
  silver:  'bg-slate-100 text-slate-600 border-slate-200',
  gold:    'bg-amber-100 text-amber-700 border-amber-200',
  diamond: 'bg-violet-100 text-violet-700 border-violet-200',
}

export const PLAN_STYLE_DARK: Record<PlanSociedad, string> = {
  silver:  'bg-zinc-800 text-zinc-300 border-zinc-700',
  gold:    'bg-amber-500/15 text-amber-300 border-amber-500/30',
  diamond: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
}

/**
 * El Centro de Cría lo incluyen Gold y Diamond. Es la misma regla que la
 * columna generada `sociedad.acceso_centro_cria`; se duplica acá sólo para
 * poder anticipar el efecto en la UI antes de guardar.
 */
export function planIncluyeCentroCria(plan: PlanSociedad): boolean {
  return plan !== 'silver'
}
