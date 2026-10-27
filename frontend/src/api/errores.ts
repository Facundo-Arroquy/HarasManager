/**
 * Error de la API con la misma forma que los de Supabase: un `code` y un `message`.
 *
 * `utils/error.ts` ya decide por `code` (HM001, HM002…) y muestra `message`, así que un dominio
 * que pasa de Supabase a la API no tiene que tocar cómo se manejan los errores en las pantallas.
 */
export class ErrorApi extends Error {
  readonly code: string
  /** Estado HTTP; 0 si ni siquiera hubo respuesta (sin conexión, CORS, servidor caído). */
  readonly status: number

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ErrorApi'
    this.status = status
    this.code = code
  }
}

/** Arma un `ErrorApi` desde el cuerpo de un error de la API (`{code, message}`), o uno genérico. */
export function errorDesdeRespuesta(status: number, cuerpo: unknown): ErrorApi {
  if (cuerpo && typeof cuerpo === 'object') {
    const { code, message } = cuerpo as { code?: unknown; message?: unknown }
    if (typeof code === 'string' && typeof message === 'string') {
      return new ErrorApi(status, code, message)
    }
  }
  return new ErrorApi(status, 'error_desconocido', 'La API respondió con un error inesperado.')
}
