// Usuarios de demo.
//
// Roles y acceso en el nuevo modelo:
//   admin (haras)    → email @haras-demo.com, sin marca → ve TODO el haras
//   admin (marca)    → email @losalamos.com → ve solo caballos de Estancia Los Álamos
//   veterinario      → email @haras-demo.com → ve caballos con acceso concedido
//   jugador/piloto   → email @losalamos.com → ve caballos de su marca
//   peticero         → email @losalamos.com → ve caballos de su marca

export interface MockUser {
  id: string
  nombre: string
  apellido: string
  email: string
  telefono: string
  rol: string
  sociedad: {
    id: string
    nombre: string
    activa: boolean
  }
  /** marcaId: si existe, el usuario es de esa marca (propietario). Null = haras staff */
  marcaId: string | null
}

export const MOCK_SOCIEDAD = {
  id: 'mock-sociedad-001',
  nombre: 'Haras San Antonio',
  activa: true,
}

export const MOCK_USERS: MockUser[] = [
  {
    id: 'mock-admin-haras',
    nombre: 'Carlos',
    apellido: 'Mendoza',
    email: 'admin@haras-demo.com',
    telefono: '+54 11 4500-0001',
    rol: 'admin',
    sociedad: MOCK_SOCIEDAD,
    marcaId: null,               // admin del haras, ve todo
  },
  {
    id: 'mock-veterinario',
    nombre: 'Dra. Valentina',
    apellido: 'Ríos',
    email: 'vet@haras-demo.com',
    telefono: '+54 11 4500-0002',
    rol: 'veterinario',
    sociedad: MOCK_SOCIEDAD,
    marcaId: null,               // vet del haras, acceso concedido por marcas
  },
  {
    id: 'mock-admin-marca',
    nombre: 'Rodrigo',
    apellido: 'Benavídez',
    email: 'admin@losalamos.com',
    telefono: '+54 9 351 555-0101',
    rol: 'admin',
    sociedad: MOCK_SOCIEDAD,
    marcaId: 'mock-marca-001',   // admin de Estancia Los Álamos
  },
  {
    id: 'mock-jugador',
    nombre: 'Martín',
    apellido: 'Urquiza',
    email: 'martin@losalamos.com',
    telefono: '+54 11 4500-0004',
    rol: 'jugador',
    sociedad: MOCK_SOCIEDAD,
    marcaId: 'mock-marca-001',   // jugador de Estancia Los Álamos
  },
  {
    id: 'mock-peticero',
    nombre: 'Diego',
    apellido: 'Suárez',
    email: 'diego@pcba.com.ar',
    telefono: '+54 11 4500-0005',
    rol: 'peticero',
    sociedad: MOCK_SOCIEDAD,
    marcaId: 'mock-marca-002',   // peticero de Polo Club BA
  },
]

export function getMockUser(id: string): MockUser {
  return MOCK_USERS.find((u) => u.id === id) ?? MOCK_USERS[0]
}
