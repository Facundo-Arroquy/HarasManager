import * as XLSX from 'xlsx'

export interface BulkCaballoPayload {
  nombre: string
  fecha_nacimiento: string | null
  categoria: 'Caballo' | 'Yegua' | 'Padrillo' | 'Potrillo'
  rol_reproductivo: 'Donante' | 'Receptora' | null
  raza_id: number | null
  pelaje_id: number | null
  campo_id: string | null
  marca_id: string | null
  numero_chip?: string
  numero_registro?: string
  padre_nombre: string | null
  madre_nombre: string | null
}

export interface CatalogContext {
  razas: { id: number; nombre: string }[]
  pelajes: { id: number; nombre: string }[]
  campos: { id: string; nombre: string }[]
  marcas: { id: string; nombre: string }[]
}

export type ErrorSeverity = 'error' | 'warning'

export interface RowIssue {
  severity: ErrorSeverity
  field: string
  message: string
}

export interface ExcelRow {
  nombre?: string
  fecha_nacimiento?: string
  categoria?: string
  rol_reproductivo?: string
  raza?: string
  pelaje?: string
  campo?: string
  marca?: string
  numero_chip?: string
  numero_registro?: string
  padre_nombre?: string
  madre_nombre?: string
}

export interface ParsedRow {
  rowIndex: number
  raw: ExcelRow
  issues: RowIssue[]
  payload: BulkCaballoPayload | null
}

const HEADERS = [
  'nombre',
  'fecha_nacimiento',
  'categoria',
  'rol_reproductivo',
  'raza',
  'pelaje',
  'campo',
  'numero_chip',
  'numero_registro',
  'padre_nombre',
  'madre_nombre',
]

const CATEGORIAS_VALIDAS = new Set(['Yegua', 'Padrillo', 'Caballo', 'Potrillo'])
const ROL_VALIDOS = new Set(['Donante', 'Receptora'])

function parseDate(val: unknown): string | null {
  if (!val) return null
  if (val instanceof Date) return val.toISOString().slice(0, 10)
  const s = String(val).trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/')
    return `${y}-${m}-${d}`
  }
  return null
}

function str(val: unknown): string {
  return val == null ? '' : String(val).trim()
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

export function generarPlantillaExcel(catalogs: CatalogContext): void {
  const wb = XLSX.utils.book_new()

  const r1    = catalogs.razas[0]?.nombre   ?? ''
  const r2    = catalogs.razas[1]?.nombre   ?? r1
  const p1    = catalogs.pelajes[0]?.nombre ?? ''
  const p2    = catalogs.pelajes[1]?.nombre ?? p1
  const campo = catalogs.campos[0]?.nombre  ?? ''

  const sheetData = [
    HEADERS,
    ['Compadre', '2020-05-15', 'Caballo', '', r1, p1, campo, '941000024850001', 'SA-001', 'Don Quijote III', ''],
    ['La Niña',  '2019-03-20', 'Yegua',   'Donante', r2, p2, campo, '', '', '', 'Yegua Bonita'],
  ]

  const ws = XLSX.utils.aoa_to_sheet(sheetData)
  ws['!cols'] = HEADERS.map((h) => ({ wch: Math.max(h.length + 4, 18) }))
  XLSX.utils.book_append_sheet(wb, ws, 'Importar Caballos')

  const maxRows = Math.max(catalogs.razas.length, catalogs.pelajes.length, catalogs.campos.length, 1)
  const catData: (string | null)[][] = [
    ['Razas válidas', 'Pelajes válidos', 'Campos disponibles'],
  ]
  for (let i = 0; i < maxRows; i++) {
    catData.push([
      catalogs.razas[i]?.nombre   ?? null,
      catalogs.pelajes[i]?.nombre ?? null,
      catalogs.campos[i]?.nombre  ?? null,
    ])
  }
  const wsCat = XLSX.utils.aoa_to_sheet(catData)
  wsCat['!cols'] = [{ wch: 22 }, { wch: 22 }, { wch: 24 }]
  XLSX.utils.book_append_sheet(wb, wsCat, 'Catálogos')

  XLSX.writeFile(wb, 'plantilla_caballos.xlsx')
}

export async function parsearExcel(file: File): Promise<ExcelRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array', cellDates: true })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

        const get = (row: Record<string, unknown>, key: string): unknown => {
          const entry = Object.entries(row).find(([k]) => k.toLowerCase().trim() === key)
          return entry ? entry[1] : ''
        }

        const result: ExcelRow[] = rows.map((row) => {
          const raw = get(row, 'fecha_nacimiento')
          return {
            nombre:           str(get(row, 'nombre')),
            fecha_nacimiento: raw instanceof Date ? raw.toISOString().slice(0, 10) : str(raw),
            categoria:        str(get(row, 'categoria')),
            rol_reproductivo: str(get(row, 'rol_reproductivo')),
            raza:             str(get(row, 'raza')),
            pelaje:           str(get(row, 'pelaje')),
            campo:            str(get(row, 'campo')),
            marca:            str(get(row, 'marca')),
            numero_chip:      str(get(row, 'numero_chip')),
            numero_registro:  str(get(row, 'numero_registro')),
            padre_nombre:     str(get(row, 'padre_nombre')),
            madre_nombre:     str(get(row, 'madre_nombre')),
          }
        })
        resolve(result)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

export function validarYMapear(rows: ExcelRow[], catalogs: CatalogContext): ParsedRow[] {
  const razaMap   = new Map(catalogs.razas.map((r) => [r.nombre.toLowerCase(), r.id]))
  const pelajeMap = new Map(catalogs.pelajes.map((p) => [p.nombre.toLowerCase(), p.id]))
  const campoMap  = new Map(catalogs.campos.map((c) => [c.nombre.toLowerCase(), c.id]))
  const marcaMap  = new Map(catalogs.marcas.map((m) => [m.nombre.toLowerCase(), m.id]))

  return rows.map((raw, idx) => {
    const issues: RowIssue[] = []
    let hardError = false

    const err = (field: string, message: string) => { issues.push({ severity: 'error', field, message }); hardError = true }
    const warn = (field: string, message: string) => { issues.push({ severity: 'warning', field, message }) }

    const nombre = raw.nombre?.trim() ?? ''
    if (!nombre) err('nombre', 'El nombre es obligatorio')

    const razaNombre = raw.raza?.trim() ?? ''
    let raza_id: number | null = null
    if (razaNombre) {
      const found = razaMap.get(razaNombre.toLowerCase())
      if (found !== undefined) raza_id = found
      else warn('raza', `Raza "${razaNombre}" no encontrada — se importará sin raza`)
    }

    const pelajeNombre = raw.pelaje?.trim() ?? ''
    let pelaje_id: number | null = null
    if (pelajeNombre) {
      const found = pelajeMap.get(pelajeNombre.toLowerCase())
      if (found !== undefined) pelaje_id = found
      else warn('pelaje', `Pelaje "${pelajeNombre}" no encontrado — se importará sin pelaje`)
    }

    let categoria: 'Caballo' | 'Yegua' | 'Padrillo' | 'Potrillo' = 'Caballo'
    const catRaw = raw.categoria?.trim() ?? ''
    if (catRaw) {
      const norm = capitalize(catRaw)
      if (CATEGORIAS_VALIDAS.has(norm)) {
        categoria = norm as typeof categoria
      } else {
        warn('categoria', `Categoría "${catRaw}" inválida — se usará "Caballo"`)
      }
    }

    let rol_reproductivo: 'Donante' | 'Receptora' | null = null
    const rolRaw = raw.rol_reproductivo?.trim() ?? ''
    if (rolRaw) {
      const norm = capitalize(rolRaw)
      if (ROL_VALIDOS.has(norm)) {
        if (categoria === 'Yegua') {
          rol_reproductivo = norm as 'Donante' | 'Receptora'
        } else {
          warn('rol_reproductivo', 'Rol reproductivo solo aplica a Yeguas — se omitirá')
        }
      } else {
        warn('rol_reproductivo', `Rol "${rolRaw}" inválido (usar Donante o Receptora) — se omitirá`)
      }
    }

    let campo_id: string | null = null
    const campoNombre = raw.campo?.trim() ?? ''
    if (campoNombre) {
      const found = campoMap.get(campoNombre.toLowerCase())
      if (found) campo_id = found
      else warn('campo', `Campo "${campoNombre}" no encontrado — se importará sin campo`)
    }

    let marca_id: string | null = null
    const marcaNombre = raw.marca?.trim() ?? ''
    if (marcaNombre) {
      const found = marcaMap.get(marcaNombre.toLowerCase())
      if (found) marca_id = found
      else warn('marca', `Marca "${marcaNombre}" no encontrada — se importará sin marca`)
    }

    const fecha_nacimiento = parseDate(raw.fecha_nacimiento)
    if (raw.fecha_nacimiento && !fecha_nacimiento) {
      warn('fecha_nacimiento', `Fecha "${raw.fecha_nacimiento}" inválida — se importará sin fecha`)
    }

    if (hardError) {
      return { rowIndex: idx + 1, raw, issues, payload: null }
    }

    return {
      rowIndex: idx + 1,
      raw,
      issues,
      payload: {
        nombre,
        fecha_nacimiento,
        categoria,
        rol_reproductivo,
        raza_id,
        pelaje_id,
        campo_id,
        marca_id,
        numero_chip:    raw.numero_chip?.trim()     || undefined,
        numero_registro: raw.numero_registro?.trim() || undefined,
        padre_nombre:   raw.padre_nombre?.trim()    || null,
        madre_nombre:   raw.madre_nombre?.trim()    || null,
      },
    }
  })
}
