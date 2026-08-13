import MembresiaVetCard from '../../components/domain/MembresiaVetCard'

/**
 * Configuración → Suscripción, del veterinario independiente.
 *
 * La membresía estaba en el medio de `/panel-vet`, compitiendo con las alertas
 * y las consultas, que es lo que el vet entra a ver. Acá tiene su lugar, y el
 * menú deja lugar a los apartados que vengan.
 */
export default function SuscripcionVetPage() {
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Suscripción</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Tu membresía de veterinario y el estado de los pagos.
        </p>
      </div>

      <MembresiaVetCard />
    </div>
  )
}
