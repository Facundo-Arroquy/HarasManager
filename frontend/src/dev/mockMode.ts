// Mock mode desactivado — la app siempre usa Supabase.
// Las funciones se mantienen para no romper imports existentes en servicios.

export function isMockMode(): boolean { return false }

export function enableMock()  { /* no-op */ }
export function disableMock() { /* no-op */ }

export function getMockUserId(): string { return '' }
export function setMockUserId(_id: string) { /* no-op */ }
