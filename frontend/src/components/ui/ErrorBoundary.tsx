import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, Copy, RefreshCw, Check } from 'lucide-react'

interface Props { children: ReactNode }

interface State {
  error: Error | null
  componentStack: string | null
  copiado: boolean
}

/**
 * Red de contención de toda la app.
 *
 * Sin esto, cualquier excepción durante el render desmonta el árbol entero y
 * deja `#root` vacío sobre el fondo casi negro del body: el usuario ve una
 * pantalla negra, sin mensaje y sin forma de contar qué pasó. Acá el error se
 * muestra, se puede copiar de una y queda además en la consola.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null, copiado: false }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? null })
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  /** Todo lo que sirve para diagnosticar, en un solo bloque pegable. */
  private detalle(): string {
    const { error, componentStack } = this.state
    return [
      `Error: ${error?.message ?? 'desconocido'}`,
      `Página: ${window.location.href}`,
      `Fecha: ${new Date().toISOString()}`,
      `Navegador: ${navigator.userAgent}`,
      '',
      error?.stack ?? '',
      componentStack ? `\nComponentes:${componentStack}` : '',
    ].join('\n')
  }

  private copiar = () => {
    navigator.clipboard.writeText(this.detalle())
      .then(() => {
        this.setState({ copiado: true })
        setTimeout(() => this.setState({ copiado: false }), 2000)
      })
      .catch(() => {})
  }

  render() {
    const { error, componentStack, copiado } = this.state
    if (!error) return this.props.children

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-red-50 p-2 shrink-0">
              <AlertTriangle size={20} className="text-red-600" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Algo salió mal</h1>
              <p className="mt-1 text-sm text-slate-500">
                La pantalla se cerró por un error inesperado. Tus datos no se perdieron:
                recargá para volver a entrar. Si vuelve a pasar, copiá el detalle y mandalo
                para que lo podamos arreglar.
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-600 break-words">
              {error.message || 'Error desconocido'}
            </p>
            {(error.stack || componentStack) && (
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] text-slate-400 hover:text-slate-600">
                  Ver detalle técnico
                </summary>
                <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-relaxed text-slate-500">
                  {error.stack}
                  {componentStack}
                </pre>
              </details>
            )}
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={this.copiar}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50"
            >
              {copiado ? <Check size={15} /> : <Copy size={15} />}
              {copiado ? 'Copiado' : 'Copiar detalle'}
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-400"
            >
              <RefreshCw size={15} /> Recargar
            </button>
          </div>
        </div>
      </div>
    )
  }
}
