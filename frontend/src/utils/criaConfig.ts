const STORAGE_KEY = 'haras_cria_config'

export interface CriaConfigData {
  donante_strelin_a_in: number
  donante_in_a_oxi: number
  donante_ov_a_flushing: number
  donante_pg_a_revision_pg: number
  donante_flushing_a_revision: number
  receptora_pg_a_revision_pg: number
  receptora_ov_a_dar_pg: number
}

export const CRIA_CONFIG_DEFAULTS: CriaConfigData = {
  donante_strelin_a_in: 1,
  donante_in_a_oxi: 1,
  donante_ov_a_flushing: 6,
  donante_pg_a_revision_pg: 3,
  donante_flushing_a_revision: 4,
  receptora_pg_a_revision_pg: 4,
  receptora_ov_a_dar_pg: 3,
}

export function getCriaConfig(): CriaConfigData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return CRIA_CONFIG_DEFAULTS
    return { ...CRIA_CONFIG_DEFAULTS, ...JSON.parse(stored) }
  } catch {
    return CRIA_CONFIG_DEFAULTS
  }
}

export function saveCriaConfig(config: CriaConfigData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export function resetCriaConfig(): void {
  localStorage.removeItem(STORAGE_KEY)
}
