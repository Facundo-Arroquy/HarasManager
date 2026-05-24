import { useState } from 'react'
import { MOCK_USERS } from './mockUsers'
import { getMockUserId, setMockUserId, isMockMode, enableMock, disableMock } from './mockMode'
import { useAuthStore } from '../store/authStore'

const ROL_COLOR: Record<string, string> = {
  admin:       'bg-violet-600',
  veterinario: 'bg-amber-500',
  piloto:      'bg-sky-600',
  jugador:     'bg-amber-600',
  peticero:    'bg-rose-600',
}

// Etiqueta descriptiva para el DevPanel
const USER_LABEL: Record<string, string> = {
  'mock-admin-haras':  'Admin (ve todo)',
  'mock-veterinario':  'Vet (acceso concedido)',
  'mock-jugador':      'Jugador',
  'mock-peticero':     'Peticero',
}

// Solo se renderiza en desarrollo
export default function DevPanel() {
  if (!import.meta.env.DEV) return null

  const [open, setOpen] = useState(false)
  const [mockOn, setMockOn] = useState(isMockMode)
  const [activeId, setActiveId] = useState(getMockUserId)
  const setSociedadActiva = useAuthStore((s) => s.setSociedadActiva)
  const setSession = useAuthStore((s) => s.setSession)
  const clear = useAuthStore((s) => s.clear)

  function toggleMock() {
    if (mockOn) {
      disableMock()
      setMockOn(false)
      clear() // limpia session + rol + sociedadActiva
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
    setSociedadActiva(user.sociedad, user.rol)
  }

  const activeUser = MOCK_USERS.find((u) => u.id === activeId) ?? MOCK_USERS[0]
  const rolColor = ROL_COLOR[activeUser.rol] ?? 'bg-zinc-600'

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {/* Panel expandido */}
      {open && (
        <div className="w-64 rounded-xl border border-slate-300 bg-white shadow-2xl text-sm">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-300 px-3 py-2">
            <span className="font-semibold text-slate-700">Dev — Cambiar usuario</span>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-slate-700 text-xs"
            >
              ✕
            </button>
          </div>

          {/* Toggle mock */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200">
            <span className="text-slate-500 text-xs">Mock activo</span>
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
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full flex-shrink-0 mt-0.5 ${ROL_COLOR[user.rol] ?? 'bg-zinc-600'}`}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate">
                      {user.nombre} {user.apellido}
                    </span>
                    <span className="block truncate text-[10px] text-slate-400">
                      {USER_LABEL[user.id] ?? user.rol}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>

          <div className="border-t border-slate-200 px-3 py-2 text-xs text-slate-400">
            Haras San Antonio (demo)
          </div>
        </div>
      )}

      {/* Botón flotante */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-white shadow-lg transition-opacity ${
          mockOn ? rolColor : 'bg-slate-200'
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
