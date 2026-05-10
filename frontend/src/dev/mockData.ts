// Datos de demo realistas para el haras argentino.
// Se usan cuando isMockMode() === true en los servicios.

// ── Catálogos ────────────────────────────────────────────────────────────────

export const MOCK_RAZAS = [
  { id: 1, nombre: 'Polo Argentino' },
  { id: 2, nombre: 'Pura Sangre de Carrera' },
  { id: 3, nombre: 'Criollo' },
]

export const MOCK_PELAJES = [
  { id: 1, nombre: 'Zaino' },
  { id: 2, nombre: 'Tordillo' },
  { id: 3, nombre: 'Alazán' },
  { id: 4, nombre: 'Bayo' },
]

export const MOCK_TIPOS_CONSULTA = [
  { id: 1, nombre: 'Revisión general' },
  { id: 2, nombre: 'Vacuna' },
  { id: 3, nombre: 'Tratamiento ortopédico' },
  { id: 4, nombre: 'Ecografía' },
  { id: 5, nombre: 'Desparasitación' },
]

// ── Marcas (reemplazan a propietarios) ───────────────────────────────────────
//
// Las marcas se identifican por dominio de email.
// Usuarios con @losalamos.com → Estancia Los Álamos
// Usuarios con @pcba.com.ar   → Polo Club Buenos Aires

export const MOCK_MARCAS = [
  {
    id: 'mock-marca-001',
    nombre: 'Estancia Los Álamos',
    dominio_email: 'losalamos.com',
    sociedad_id: 'mock-sociedad-001',
    activa: true,
  },
  {
    id: 'mock-marca-002',
    nombre: 'Polo Club Buenos Aires',
    dominio_email: 'pcba.com.ar',
    sociedad_id: 'mock-sociedad-001',
    activa: true,
  },
]

// ── Caballos ─────────────────────────────────────────────────────────────────
// cab-001 a cab-006 → Estancia Los Álamos (mock-marca-001)
// cab-007 a cab-008 → Polo Club BA (mock-marca-002)

export const MOCK_CABALLOS = [
  {
    id: 'cab-001',
    nombre: 'Compadre',
    fecha_nacimiento: '2016-09-12',
    categoria: 'Caballo',
    raza_id: 1,
    pelaje_id: 1,
    numero_chip: '941000024850001',
    numero_registro: 'SA-0001',
    sociedad_id: 'mock-sociedad-001',
    marca_id: 'mock-marca-001',
    activo: true,
    cat_raza: { nombre: 'Polo Argentino' },
    cat_pelaje: { nombre: 'Zaino' },
    marca: { nombre: 'Estancia Los Álamos', dominio_email: 'losalamos.com' },
  },
  {
    id: 'cab-002',
    nombre: 'Tormenta',
    fecha_nacimiento: '2018-03-05',
    categoria: 'Yegua',
    raza_id: 1,
    pelaje_id: 2,
    numero_chip: '941000024850002',
    numero_registro: 'SA-0002',
    sociedad_id: 'mock-sociedad-001',
    marca_id: 'mock-marca-001',
    activo: true,
    cat_raza: { nombre: 'Polo Argentino' },
    cat_pelaje: { nombre: 'Tordillo' },
    marca: { nombre: 'Estancia Los Álamos', dominio_email: 'losalamos.com' },
  },
  {
    id: 'cab-003',
    nombre: 'Relámpago',
    fecha_nacimiento: '2015-11-28',
    categoria: 'Padrillo',
    raza_id: 2,
    pelaje_id: 3,
    numero_chip: '941000024850003',
    numero_registro: 'SA-0003',
    sociedad_id: 'mock-sociedad-001',
    marca_id: 'mock-marca-001',
    activo: true,
    cat_raza: { nombre: 'Pura Sangre de Carrera' },
    cat_pelaje: { nombre: 'Alazán' },
    marca: { nombre: 'Estancia Los Álamos', dominio_email: 'losalamos.com' },
  },
  {
    id: 'cab-004',
    nombre: 'Pampero',
    fecha_nacimiento: '2019-06-18',
    categoria: 'Caballo',
    raza_id: 3,
    pelaje_id: 4,
    numero_chip: '941000024850004',
    numero_registro: 'SA-0004',
    sociedad_id: 'mock-sociedad-001',
    marca_id: 'mock-marca-001',
    activo: true,
    cat_raza: { nombre: 'Criollo' },
    cat_pelaje: { nombre: 'Bayo' },
    marca: { nombre: 'Estancia Los Álamos', dominio_email: 'losalamos.com' },
  },
  {
    id: 'cab-005',
    nombre: 'Ciclón',
    fecha_nacimiento: '2017-08-03',
    categoria: 'Caballo',
    raza_id: 1,
    pelaje_id: 1,
    numero_chip: '941000024850005',
    numero_registro: 'SA-0005',
    sociedad_id: 'mock-sociedad-001',
    marca_id: 'mock-marca-001',
    activo: true,
    cat_raza: { nombre: 'Polo Argentino' },
    cat_pelaje: { nombre: 'Zaino' },
    marca: { nombre: 'Estancia Los Álamos', dominio_email: 'losalamos.com' },
  },
  {
    id: 'cab-006',
    nombre: 'Brisa',
    fecha_nacimiento: '2020-01-22',
    categoria: 'Yegua',
    raza_id: 1,
    pelaje_id: 2,
    numero_chip: '941000024850006',
    numero_registro: 'SA-0006',
    sociedad_id: 'mock-sociedad-001',
    marca_id: 'mock-marca-001',
    activo: true,
    cat_raza: { nombre: 'Polo Argentino' },
    cat_pelaje: { nombre: 'Tordillo' },
    marca: { nombre: 'Estancia Los Álamos', dominio_email: 'losalamos.com' },
  },
  {
    id: 'cab-007',
    nombre: 'Trueno Negro',
    fecha_nacimiento: '2014-05-09',
    categoria: 'Caballo',
    raza_id: 2,
    pelaje_id: 1,
    numero_chip: '941000024850007',
    numero_registro: 'SA-0007',
    sociedad_id: 'mock-sociedad-001',
    marca_id: 'mock-marca-002',
    activo: true,
    cat_raza: { nombre: 'Pura Sangre de Carrera' },
    cat_pelaje: { nombre: 'Zaino' },
    marca: { nombre: 'Polo Club Buenos Aires', dominio_email: 'pcba.com.ar' },
  },
  {
    id: 'cab-008',
    nombre: 'Luna',
    fecha_nacimiento: '2021-04-15',
    categoria: 'Potrillo',
    raza_id: 3,
    pelaje_id: 3,
    numero_chip: '',
    numero_registro: '',
    sociedad_id: 'mock-sociedad-001',
    marca_id: 'mock-marca-002',
    activo: true,
    cat_raza: { nombre: 'Criollo' },
    cat_pelaje: { nombre: 'Alazán' },
    marca: { nombre: 'Polo Club Buenos Aires', dominio_email: 'pcba.com.ar' },
  },
]

// ── Accesos veterinario ──────────────────────────────────────────────────────
// El vet mock-veterinario tiene acceso masivo a mock-marca-001

export const MOCK_ACCESOS_VET = [
  {
    id: 'av-001',
    vet_id: 'mock-veterinario',
    vet: { nombre: 'Dra. Valentina', apellido: 'Ríos', email: 'vet@haras-demo.com' },
    marca_id: 'mock-marca-001',
    marca: { nombre: 'Estancia Los Álamos' },
    caballo_id: null,
    caballo: null,
    activo: true,
    otorgado_por: 'mock-admin-haras',
  },
]

// ── Historial clínico ────────────────────────────────────────────────────────

export const MOCK_HISTORIAL: Record<string, object[]> = {
  'cab-001': [
    {
      id: 'hc-001',
      caballo_id: 'cab-001',
      fecha_consulta: '2026-04-10T10:00:00Z',
      diagnostico: 'Leve inflamación en menudillo delantero izquierdo. Sin compromiso articular.',
      tratamiento: 'Reposo 7 días, AINEs (Fenilbutazona 2g/día), compresas frías locales.',
      observaciones: 'El animal respondió bien. Retomar entrenamiento gradual.',
      proxima_consulta: '2026-04-17',
      creado_por: 'mock-veterinario',
      cat_tipo_consulta: { nombre: 'Tratamiento ortopédico' },
      usuario: { nombre: 'Dra. Valentina', apellido: 'Ríos' },
      historial_parte_afectada: [
        {
          id: 'hpa-001',
          lado: 'izquierdo',
          descripcion: 'Inflamación moderada, sin calor excesivo.',
          cat_parte_cuerpo: { nombre: 'Menudillo delantero izquierdo' },
        },
      ],
      historial_medicamento: [
        {
          id: 'hm-001',
          medicamento: 'Fenilbutazona',
          dosis: '2g',
          via_administracion: 'Oral',
          duracion_dias: 7,
        },
      ],
    },
    {
      id: 'hc-002',
      caballo_id: 'cab-001',
      fecha_consulta: '2026-02-14T09:00:00Z',
      diagnostico: 'Control anual. Buen estado general.',
      tratamiento: 'Vacunación triple equina + rabia.',
      observaciones: null,
      proxima_consulta: '2027-02-14',
      creado_por: 'mock-veterinario',
      cat_tipo_consulta: { nombre: 'Vacuna' },
      usuario: { nombre: 'Dra. Valentina', apellido: 'Ríos' },
      historial_parte_afectada: [],
      historial_medicamento: [
        { id: 'hm-002', medicamento: 'Triple equina', dosis: '1 dosis', via_administracion: 'IM', duracion_dias: null },
        { id: 'hm-003', medicamento: 'Anti-rábica',   dosis: '1 dosis', via_administracion: 'IM', duracion_dias: null },
      ],
    },
  ],
  'cab-002': [
    {
      id: 'hc-003',
      caballo_id: 'cab-002',
      fecha_consulta: '2026-05-01T11:30:00Z',
      diagnostico: 'Preñez confirmada. Aproximadamente 45 días de gestación.',
      tratamiento: 'Suplemento vitamínico E + selenio. Monitoreo mensual.',
      observaciones: 'Parto estimado: diciembre 2026.',
      proxima_consulta: '2026-06-01',
      creado_por: 'mock-veterinario',
      cat_tipo_consulta: { nombre: 'Control de preñez' },
      usuario: { nombre: 'Dra. Valentina', apellido: 'Ríos' },
      historial_parte_afectada: [],
      historial_medicamento: [
        { id: 'hm-004', medicamento: 'Vitamina E + Selenio', dosis: '1 ampolla', via_administracion: 'IM', duracion_dias: null },
      ],
    },
  ],
}
