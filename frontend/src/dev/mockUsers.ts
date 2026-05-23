// Usuarios de demo.
//
// Sin concepto de marca — todos los usuarios ven todos los caballos de la empresa.
// El acceso del veterinario se controla por caballo individual.

export interface MockUser {
  id: string
  nombre: string
  apellido: string
  email: string
  telefono: string
  rol: string
  accesosCentroC: boolean
  sociedad: {
    id: string
    nombre: string
    activa: boolean
  } | null
}

export const MOCK_SOCIEDAD = {
  id: 'mock-sociedad-001',
  nombre: 'Haras San Antonio',
  activa: true,
}

export const MOCK_USERS: MockUser[] = [
  {
    id: 'mock-admin',
    nombre: 'Carlos',
    apellido: 'Mendoza',
    email: 'admin@haras-demo.com',
    telefono: '+54 11 4500-0001',
    rol: 'admin',
    accesosCentroC: true,
    sociedad: MOCK_SOCIEDAD,
  },
  {
    id: 'mock-veterinario',
    nombre: 'Dra. Valentina',
    apellido: 'Ríos',
    email: 'vet@haras-demo.com',
    telefono: '+54 11 4500-0002',
    rol: 'veterinario',
    accesosCentroC: true,
    sociedad: MOCK_SOCIEDAD,
  },
  {
    id: 'mock-jugador',
    nombre: 'Martín',
    apellido: 'Urquiza',
    email: 'martin@haras-demo.com',
    telefono: '+54 11 4500-0004',
    rol: 'jugador',
    accesosCentroC: false,
    sociedad: MOCK_SOCIEDAD,
  },
  {
    id: 'mock-peticero',
    nombre: 'Diego',
    apellido: 'Suárez',
    email: 'diego@haras-demo.com',
    telefono: '+54 11 4500-0005',
    rol: 'peticero',
    accesosCentroC: false,
    sociedad: MOCK_SOCIEDAD,
  },
  {
    id: 'mock-superadmin',
    nombre: 'Super',
    apellido: 'Admin',
    email: 'super@haras.com',
    telefono: '',
    rol: 'superadmin',
    accesosCentroC: false,
    sociedad: null,
  },
]

export function getMockUser(id: string): MockUser {
  return MOCK_USERS.find((u) => u.id === id) ?? MOCK_USERS[0]
}

