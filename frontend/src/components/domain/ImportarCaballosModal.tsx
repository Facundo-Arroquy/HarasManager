import { useCallback, useEffect, useRef, useState } from 'react'
import { X, Download, CheckCircle2, AlertCircle, AlertTriangle, FileSpreadsheet } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { catalogoService } from '../../services/catalogoService'
import { campoService } from '../../services/campoService'
import { marcaService } from '../../services/marcaService'
import { caballoService } from '../../services/caballoService'
import {
  generarPlantillaExcel,
  parsearExcel,
  validarYMapear,
  type CatalogContext,
  type ParsedRow,
} from '../../utils/importarCaballos'
import Spinner from '../ui/Spinner'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

// Pasos: prepare (descarga + upload juntos) → preview → importing → result
type Step = 'prepare' | 'preview' | 'importing' | 'result'

const COLUMN_INFO = [
  { col: 'nombre',           req: true,  hint: 'Texto libre' },
  { col: 'fecha_nacimiento', req: false, hint: 'YYYY-MM-DD o DD/MM/YYYY' },
  { col: 'categoria',        req: false, hint: 'Caballo · Yegua · Padrillo · Potrillo (default: Caballo)' },
  { col: 'rol_reproductivo', req: false, hint: 'Donante · Receptora (solo para Yegua)' },
  { col: 'raza',             req: false, hint: 'Ver hoja "Catálogos"' },
  { col: 'pelaje',           req: false, hint: 'Ver hoja "Catálogos"' },
  { col: 'campo',            req: false, hint: 'Ver hoja "Catálogos"' },
  { col: 'numero_chip',      req: false, hint: 'Texto libre' },
  { col: 'numero_registro',  req: false, hint: 'Texto libre' },
  { col: 'padre_nombre',     req: false, hint: 'Texto libre' },
  { col: 'madre_nombre',     req: false, hint: 'Texto libre' },
]

export default function ImportarCaballosModal({ onClose, onSuccess }: Props) {
  const { sociedadActiva } = useAuth()

  const [step,         setStep]         = useState<Step>('prepare')
  const [catalogs,     setCatalogs]     = useState<CatalogContext | null>(null)
  const [catalogsError, setCatalogsError] = useState<string | null>(null)
  const [parsedRows,   setParsedRows]   = useState<ParsedRow[]>([])
  const [parseError,   setParseError]   = useState<string | null>(null)
  const [dragOver,     setDragOver]     = useState(false)
  const [importResult, setImportResult] = useState<{ insertados: number; errores: { index: number; message: string }[] } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!sociedadActiva?.id) return
    const id = sociedadActiva.id
    Promise.allSettled([
      catalogoService.razas(),
      catalogoService.pelajes(),
      campoService.listar(id),
      marcaService.listar(id),
    ]).then(([razasR, pelajesR, camposR, marcasR]) => {
      const razas   = razasR.status   === 'fulfilled' ? (razasR.value   ?? []) : []
      const pelajes = pelajesR.status === 'fulfilled' ? (pelajesR.value ?? []) : []
      const campos  = camposR.status  === 'fulfilled' ? camposR.value         : []
      const marcas  = marcasR.status  === 'fulfilled' ? marcasR.value         : []
      if (razasR.status === 'rejected' || pelajesR.status === 'rejected') {
        setCatalogsError('No se pudieron cargar los catálogos de razas o pelajes.')
        return
      }
      setCatalogs({ razas, pelajes, campos, marcas })
    })
  }, [sociedadActiva?.id])

  async function handleFile(file: File) {
    setParseError(null)
    try {
      const rows = await parsearExcel(file)
      if (rows.length === 0) {
        setParseError('El archivo no contiene filas de datos.')
        return
      }
      const parsed = validarYMapear(rows, catalogs!)
      setParsedRows(parsed)
      setStep('preview')
    } catch {
      setParseError('No se pudo leer el archivo. Asegurate de subir un .xlsx o .xls válido.')
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }, [catalogs]) // eslint-disable-line react-hooks/exhaustive-deps

  async function confirmarImport() {
    if (!sociedadActiva?.id) return
    const validas = parsedRows.filter((r) => r.payload !== null).map((r) => r.payload!)
    setStep('importing')
    const result = await caballoService.importarMasivo(validas, sociedadActiva.id)
    setImportResult(result)
    setStep('result')
  }

  function reiniciar() {
    setParsedRows([])
    setParseError(null)
    setImportResult(null)
    setStep('prepare')
  }

  const validas    = parsedRows.filter((r) => r.payload && r.issues.length === 0).length
  const advertidas = parsedRows.filter((r) => r.payload && r.issues.length > 0).length
  const errores    = parsedRows.filter((r) => !r.payload).length
  const stepNum    = step === 'prepare' ? 1 : 2

  // Ícono y color del resultado según cantidad importada
  const resultIcon = importResult
    ? importResult.insertados === 0
      ? <AlertCircle size={20} className="text-rose-500 shrink-0 mt-0.5" />
      : importResult.errores.length > 0
        ? <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
        : <CheckCircle2 size={20} className="text-emerald-500 shrink-0 mt-0.5" />
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-xl border border-slate-200 bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Importar caballos por Excel</h2>
            {step === 'prepare' || step === 'preview' ? (
              <div className="flex items-center gap-1.5 mt-1.5">
                {[1, 2].map((n) => (
                  <span key={n} className="inline-flex items-center gap-1 text-xs font-medium">
                    <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] transition-colors ${
                      n === stepNum
                        ? 'bg-slate-900 text-white'
                        : n < stepNum
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-400'
                    }`}>{n}</span>
                    <span className={`hidden sm:inline transition-colors ${n === stepNum ? 'text-slate-900' : 'text-slate-400'}`}>
                      {n === 1 ? 'Preparar' : 'Vista previa'}
                    </span>
                    {n < 2 && <span className="ml-1 text-slate-200">›</span>}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* Loading catálogos */}
          {!catalogs && !catalogsError && (
            <div className="flex items-center justify-center py-16">
              <Spinner size="lg" />
            </div>
          )}

          {catalogsError && (
            <div className="m-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {catalogsError}
            </div>
          )}

          {/* Paso 1 — Preparar (descarga + upload juntos) */}
          {catalogs && step === 'prepare' && (
            <div className="p-6 space-y-5">

              {/* Descarga */}
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Si es la primera vez, descargá la plantilla, completá los datos y después subí el archivo.
                  Solo <span className="font-medium text-slate-800">nombre</span> es obligatorio — el resto es opcional.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => generarPlantillaExcel(catalogs)}
                    className="flex items-center gap-2 rounded-lg border border-slate-300 hover:border-slate-400 hover:bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition-colors"
                  >
                    <Download size={14} />
                    Descargar plantilla
                  </button>
                  <span className="text-xs text-slate-400">La plantilla incluye la hoja "Catálogos" con los valores válidos de tu haras.</span>
                </div>
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  La plantilla incluye 2 filas de ejemplo — borralas antes de completar con tus caballos.
                </div>
              </div>

              {/* Upload zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 cursor-pointer transition-colors ${
                  dragOver ? 'border-slate-400 bg-slate-50' : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                }`}
              >
                <FileSpreadsheet size={28} className="text-slate-300" />
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-600">Arrastrá el Excel acá o hacé click para buscarlo</p>
                  <p className="text-xs text-slate-400 mt-0.5">.xlsx o .xls</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={onFileChange}
                />
              </div>

              {parseError && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  {parseError}
                </div>
              )}

              {/* Referencia de columnas (secundaria) */}
              <details className="group">
                <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600 transition-colors select-none list-none flex items-center gap-1">
                  <span className="group-open:hidden">▸</span>
                  <span className="hidden group-open:inline">▾</span>
                  Ver referencia de columnas
                </summary>
                <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-3 py-2 font-medium text-slate-500 whitespace-nowrap">Columna</th>
                        <th className="text-left px-3 py-2 font-medium text-slate-500">Descripción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {COLUMN_INFO.map(({ col, req, hint }) => (
                        <tr key={col}>
                          <td className="px-3 py-2 font-mono text-slate-700 whitespace-nowrap">
                            {col}
                            {req && <span className="ml-1.5 text-[10px] font-medium text-rose-500 bg-rose-50 rounded px-1">obligatorio</span>}
                          </td>
                          <td className="px-3 py-2 text-slate-500">{hint}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          )}

          {/* Paso 2 — Vista previa */}
          {catalogs && step === 'preview' && (
            <div className="p-6 space-y-4">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                  <CheckCircle2 size={12} />
                  {validas + advertidas} válidas
                </span>
                {advertidas > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                    <AlertTriangle size={12} />
                    {advertidas} con advertencias
                  </span>
                )}
                {errores > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-700">
                    <AlertCircle size={12} />
                    {errores} con errores — se omitirán
                  </span>
                )}
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200 max-h-72">
                <table className="w-full text-xs min-w-[600px]">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-slate-500 w-10">#</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-500">Nombre</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-500">Categoría</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-500">Raza</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-500">Pelaje</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-500">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map((row) => {
                      const hasError   = !row.payload
                      const hasWarning = !!row.payload && row.issues.length > 0
                      return (
                        <tr
                          key={row.rowIndex}
                          className={hasError ? 'bg-rose-50' : hasWarning ? 'bg-amber-50' : 'bg-white'}
                        >
                          <td className={`px-3 py-2 font-medium ${hasError ? 'border-l-4 border-rose-400' : hasWarning ? 'border-l-4 border-amber-400' : 'border-l-4 border-emerald-400'}`}>
                            {row.rowIndex}
                          </td>
                          <td className="px-3 py-2 font-medium text-slate-700">{row.raw.nombre || <span className="text-slate-300">—</span>}</td>
                          <td className="px-3 py-2 text-slate-500">{row.raw.categoria || 'Caballo'}</td>
                          <td className="px-3 py-2 text-slate-500">{row.raw.raza || <span className="text-slate-300">—</span>}</td>
                          <td className="px-3 py-2 text-slate-500">{row.raw.pelaje || <span className="text-slate-300">—</span>}</td>
                          <td className="px-3 py-2 max-w-[200px]">
                            {row.issues.length === 0 ? (
                              <span className="text-emerald-600">OK</span>
                            ) : (
                              <ul className="space-y-0.5">
                                {row.issues.map((issue, i) => (
                                  <li key={i} className={`flex items-start gap-1 ${issue.severity === 'error' ? 'text-rose-600' : 'text-amber-600'}`}>
                                    {issue.severity === 'error'
                                      ? <AlertCircle size={11} className="shrink-0 mt-0.5" />
                                      : <AlertTriangle size={11} className="shrink-0 mt-0.5" />}
                                    <span className="leading-tight">{issue.message}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Importando */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <Spinner size="lg" />
              <p className="text-sm text-slate-500">
                Importando {parsedRows.filter((r) => r.payload).length} caballos…
              </p>
            </div>
          )}

          {/* Resultado */}
          {step === 'result' && importResult && (
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                {resultIcon}
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {importResult.insertados === 0
                      ? 'No se pudo importar ningún caballo.'
                      : `Se importaron ${importResult.insertados} caballo${importResult.insertados !== 1 ? 's' : ''} correctamente.`}
                  </p>
                  {importResult.errores.length > 0 && (
                    <p className="text-sm text-slate-500 mt-0.5">
                      {importResult.errores.length} fila{importResult.errores.length !== 1 ? 's' : ''} no se{' '}
                      {importResult.errores.length !== 1 ? 'pudieron' : 'pudo'} importar.
                    </p>
                  )}
                </div>
              </div>

              {importResult.errores.length > 0 && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 space-y-1">
                  {importResult.errores.map((e) => (
                    <p key={e.index} className="text-xs text-rose-700">
                      <span className="font-medium">Fila {e.index}:</span> {e.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== 'importing' && (
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
            <div>
              {step === 'preview' && (
                <button
                  onClick={() => { setParsedRows([]); setStep('prepare') }}
                  className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
                >
                  ← Otro archivo
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {step === 'result' && (
                <button
                  onClick={reiniciar}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Importar otro archivo
                </button>
              )}
              {step === 'preview' && (
                <button
                  onClick={confirmarImport}
                  disabled={validas + advertidas === 0}
                  className="rounded-lg bg-slate-900 hover:bg-slate-700 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Confirmar e importar {validas + advertidas > 0 ? `(${validas + advertidas})` : ''}
                </button>
              )}
              {step === 'result' && (
                <button
                  onClick={onSuccess}
                  className="rounded-lg bg-slate-900 hover:bg-slate-700 px-4 py-2 text-sm font-medium text-white transition-colors"
                >
                  Cerrar
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
