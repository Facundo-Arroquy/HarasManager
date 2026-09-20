import { useState } from 'react'
import { Eye, Pencil, Trash2, ShieldUser, X } from 'lucide-react'
import { useEscapeClose } from '../../hooks/useEscapeClose'
import { EMAIL_SOPORTE, mailtoSoporte } from '../../utils/contacto'

/**
 * Punto de entrada al ejercicio de los derechos de acceso, rectificación y
 * supresión (art. 6 inc. e y art. 14/16 de la Ley 25.326).
 *
 * La pantalla que va a resolverlo dentro de la app todavía no existe: hasta
 * entonces el botón abre un aviso que explica los tres derechos y deriva al
 * correo de soporte, que es el canal por el que hoy se ejercen. Está acá y no
 * escrito dos veces porque lo muestran tanto `ConfigPage` (usuarios del haras)
 * como `DatosVetPage` (veterinarios independientes).
 *
 * Al implementar la pantalla real, reemplazar el `onClick` por la navegación
 * correspondiente y borrar el modal — ver `docs/POLITICA-DE-PRIVACIDAD.md`.
 */
export default function DatosPersonalesCard() {
  const [abierto, setAbierto] = useState(false)

  return (
    <>
      <div className="max-w-2xl rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start gap-3">
          <ShieldUser size={16} className="text-slate-400 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-slate-800">Tus datos personales</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Podés consultar qué datos tuyos están guardados, corregirlos o pedir
              que los eliminemos.
            </p>
            <button
              type="button"
              onClick={() => setAbierto(true)}
              className="mt-3 px-3 py-2 text-xs font-medium rounded-md bg-brand-500 hover:bg-brand-400 text-white transition-colors"
            >
              Modificar datos personales
            </button>
          </div>
        </div>
      </div>

      {abierto && <AvisoProximamente onClose={() => setAbierto(false)} />}
    </>
  )
}

function AvisoProximamente({ onClose }: { onClose: () => void }) {
  useEscapeClose(onClose)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md sm:mx-4 rounded-t-2xl sm:rounded-xl border border-slate-300 bg-white shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Modificar datos personales</h2>
            <p className="text-xs text-slate-500 mt-0.5">Próximamente</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Estamos preparando una pantalla desde la que vas a poder gestionar vos
            mismo tus datos personales:
          </p>

          <ul className="space-y-2.5">
            <Derecho
              icono={<Eye size={13} />}
              titulo="Acceder"
              texto="Ver qué datos tuyos tenemos guardados en la base."
            />
            <Derecho
              icono={<Pencil size={13} />}
              titulo="Rectificar y actualizar"
              texto="Corregir los que estén mal o incompletos."
            />
            <Derecho
              icono={<Trash2 size={13} />}
              titulo="Eliminar"
              texto="Pedir que los borremos, con los límites que exige la trazabilidad del historial clínico."
            />
          </ul>

          <p className="text-xs text-slate-600 leading-relaxed">
            Hasta que esté lista, escribinos a{' '}
            <a
              href={mailtoSoporte('Datos personales', 'Hola, quiero ejercer mis derechos sobre mis datos personales:')}
              className="text-brand-600 hover:underline break-all"
            >
              {EMAIL_SOPORTE}
            </a>{' '}
            desde el correo de tu cuenta y lo resolvemos por esa vía.
          </p>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            Derechos de acceso, rectificación y supresión reconocidos por la Ley
            25.326 de Protección de Datos Personales.
          </p>
        </div>

        <div className="flex justify-end border-t border-slate-200 px-5 py-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-md bg-brand-500 hover:bg-brand-400 text-white transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}

function Derecho({ icono, titulo, texto }: { icono: React.ReactNode; titulo: string; texto: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="text-brand-600 mt-0.5 shrink-0">{icono}</span>
      <span className="text-xs text-slate-600 leading-relaxed">
        <span className="font-medium text-slate-800">{titulo}. </span>
        {texto}
      </span>
    </li>
  )
}
