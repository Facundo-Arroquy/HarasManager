// Utilidad central del modo mock.
// Solo activo en desarrollo (import.meta.env.DEV).
// El estado se persiste en localStorage para sobrevivir recargas.

const KEY_MOCK_ON    = 'hm_dev_mock_on'
const KEY_MOCK_USER  = 'hm_dev_mock_user'

export function isMockMode(): boolean {
  // Activo en desarrollo O si se setea VITE_DEMO_MODE=true en Vercel
  if (import.meta.env.VITE_DEMO_MODE === 'true') return true
  if (!import.meta.env.DEV) return false
  return localStorage.getItem(KEY_MOCK_ON) !== 'false'
}

export function enableMock()  { localStorage.setItem(KEY_MOCK_ON, 'true') }
export function disableMock() { localStorage.setItem(KEY_MOCK_ON, 'false') }

export function getMockUserId(): string {
  return localStorage.getItem(KEY_MOCK_USER) ?? 'mock-admin'
}

export function setMockUserId(id: string) {
  localStorage.setItem(KEY_MOCK_USER, id)
}
