import { useState } from 'react'
import { MOCK_USERS } from './mockUsers'
import { getMockUserId, setMockUserId, isMockMode, enableMock, disableMock } from './mockMode'
import { useAuthStore } from '../store/authStore'

const ROL_COLOR: Record<string, string> = {
  admin:       'bg-violet-600',
  veterinario: 'bg-emerald-600',
  piloto:      'bg-sky-600',
  jugador:     'bg-amber-600',
  peticero:    'bg-rose-600',
}

// Etiqueta descriptiva para el DevPanel
const USER_LABEL: Record<string, string> = {
  'mock-admin-haras':  'Admin haras (ve todo)',
  'mock-veterinario':  'Vet (acceso concedido)',
  'mock-admin-marca':  'Admin @losalamos.com',
  'mock-jugador':      'Jugador @losalamos.com',
  'mock-peticero':     'Peticero @pcba.com.ar',
}

// Solo se renderiza en desarrollo
export default function DevPanel() {
  if (!import.meta.env.DEV) return null

  const [open, setOpen] = useState(false)
  const [mockOn, setMockOn] = useState(isMockMode)
  const [activeId, setActiveId] = useState(getMockUserId)
  const setSociedadActiva = useAuthStore((s) => s.setSociedadActiva)
  const setSession = useAuthStore((s) => s.setSession)

  function toggleMock() {
    if (mockOn) {
      disableMock()
      setMockOn(false)
      setSession(null)
    } else {
      enableMock()
      setMockOn(true)
      applyUser(activeId)
    }
  }

  function applyUser(userId: string) {
    const user = MOCK_USERS.find((u) => u.id === userId)
    if (!user) return

    setMockUserId(userId)
    setActiveId(userId)

    // Simular sesión y sociedad activa en el store
    setSession({ user: { id: user.id, email: user.email } } as never)
    setSociedadActiva(user.sociedad, user.rol, user.marcaId)
  }

  const activeUser = MOCK_USERS.find((u) => u.id === activeId) ?? MOCK_USERS[0]
  const rolColor = ROL_COLOR[activeUser.rol] ?? 'bg-zinc-600'

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {/* Panel expandido */}
      {open && (
        <div className="w-64 rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl text-sm">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-700 px-3 py-2">
            <span className="font-semibold text-zinc-200">Dev — Cambiar usuario</span>
            <button
              onClick={() => setOpen(false)}
              className="text-zinc-500 hover:text-zinc-200 text-xs"
            >
              ✕
            </button>
          </div>

          {/* Toggle mock */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
            <span className="text-zinc-400 text-xs">Mock activo</span>
            <button
              onClick={toggleMock}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                mockOn ? 'bg-violet-600' : 'bg-zinc-600'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  mockOn ? 'translate-x-4' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Lista de usuarios */}
          <div className="py-1">
            {MOCK_USERS.map((user) => {
              const isActive = user.id === activeId && mockOn
              return (
                <button
                  key={user.id}
                  onClick={() => { enableMock(); setMockOn(true); applyUser(user.id) }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                    isActive
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full flex-shrink-0 mt-0.5 ${ROL_COLOR[user.rol] ?? 'bg-zinc-600'}`}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate">
                      {user.nombre} {user.apellido}
                    </span>
                    <span className="block truncate text-[10px] text-zinc-500">
                      {USER_LABEL[user.id] ?? user.rol}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>

          <div className="border-t border-zinc-800 px-3 py-2 text-xs text-zinc-600">
            Haras San Antonio (demo)
          </div>
        </div>
      )}

      {/* Botón flotante */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-white shadow-lg transition-opacity ${
          mockOn ? rolColor : 'bg-zinc-700'
        } opacity-80 hover:opacity-100`}
        title="Dev: cambiar usuario de prueba"
      >
        <span className="font-mono">DEV</span>
        {mockOn && (
          <span>
            {activeUser.nombre} · {activeUser.rol}
          </span>
        )}
      </button>
    </div>
  )
}
