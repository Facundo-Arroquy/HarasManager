import { useEffect, useState } from 'react'
import { BadgeCheck } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { perfilService, type Perfil } from '../../services/perfilService'
import { mensajeError } from '../../utils/error'
import Spinner from '../../components/ui/Spinner'

/**
 * Datos personales del veterinario. Solo lectura por ahora: el DNI y la
 * matrícula se cargan al registrarse y no se editan desde la app (el trigger
 * `bloquear_self_escalation` también los bloquea del lado de la base).
 */
export default function DatosVetPage() {
  const { user } = useAuth()
  const userId = user?.id

  const [perfil,  setPerfil]  = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    perfilService.obtenerMio(userId)
      .then(setPerfil)
      .catch((err) => setError(mensajeError(err, 'No se pudieron cargar tus datos.')))
      .finally(() => setLoading(false))
  }, [userId])

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-slate-200 px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Mis datos</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Datos de tu cuenta profesional
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : error ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600 max-w-2xl">
            {error}
          </p>
        ) : perfil && (
          <div className="max-w-2xl space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100">
              <Dato label="Nombre"    valor={`${perfil.nombre} ${perfil.apellido}`.trim()} />
              <Dato label="Correo"    valor={perfil.email} />
              <Dato label="DNI"       valor={perfil.dni} />
              <Dato
                label="Matrícula"
                valor={perfil.matricula}
                vacio="Sin matrícula cargada"
                icono={perfil.matricula ? <BadgeCheck size={13} className="text-brand-600" /> : undefined}
              />
            </div>

            <p className="text-xs text-slate-400">
              Estos datos no se pueden editar desde la app. Si algo está mal o te
              falta cargar la matrícula, escribinos y lo corregimos.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function Dato({
  label, valor, vacio = 'Sin cargar', icono,
}: {
  label: string
  valor?: string | null
  vacio?: string
  icono?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="text-xs font-medium text-slate-500 shrink-0">{label}</span>
      {valor
        ? (
          <span className="flex items-center gap-1.5 text-sm text-slate-800 text-right break-words">
            {icono}
            {valor}
          </span>
        )
        : <span className="text-sm text-slate-300 italic text-right">{vacio}</span>}
    </div>
  )
}
