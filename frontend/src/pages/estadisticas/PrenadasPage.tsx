import { useEffect, useMemo, useState } from 'react'
import { Baby } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { caballoService, type Caballo } from '../../services/caballoService'
import { crianzaService, type InseminacionRegistrada } from '../../services/crianzaService'
import type { TransferenciaEmbrionaria } from '../../types/crianza'
import { mensajeError } from '../../utils/error'
import { formatFecha, hoyAR, sumarDias } from '../../utils/fecha'
import Spinner from '../../components/ui/Spinner'
import NombreCaballoLink from '../../components/domain/NombreCaballoLink'
import type { NuevoCaballoInitialValues } from '../../components/domain/NuevoCaballoModal'

const DIAS_GESTACION = 340
const VACIO = <span className="text-slate-300">—</span>

interface ProgenitorRef {
  id: string
  nombre: string
}

interface GestacionRow {
  yegua: Caballo
  madre: ProgenitorRef | null
  padre: ProgenitorRef | null
  fechaParto: string | null
}

export default function PrenadasPage() {
  const navigate    = useNavigate()
  const sociedadId = useAuthStore((s) => s.sociedadActiva?.id)
  const rol        = useAuthStore((s) => s.rol)

  const [caballos, setCaballos] = useState<Caballo[]>([])
  const [transferencias, setTransferencias] = useState<TransferenciaEmbrionaria[]>([])
  const [inseminaciones, setInseminaciones] = useState<InseminacionRegistrada[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    const caballosPromise = rol === 'veterinario' && !sociedadId
      ? caballoService.listarDelVeterinario()
      : sociedadId
        ? caballoService.listar(sociedadId)
        : Promise.resolve([] as Caballo[])

    // Si las relaciones reproductivas no están disponibles, las yeguas igual
    // se muestran y el alta permite elegir los progenitores manualmente.
    const relacionesPromise = rol === 'veterinario' && !sociedadId
      ? Promise.all([
          crianzaService.listarTransferenciasVet().catch(() => [] as TransferenciaEmbrionaria[]),
          crianzaService.listarInseminaciones().catch(() => [] as InseminacionRegistrada[]),
        ])
      : sociedadId
        ? Promise.all([
            crianzaService.listarTransferencias(sociedadId).catch(() => [] as TransferenciaEmbrionaria[]),
            crianzaService.listarInseminaciones(sociedadId).catch(() => [] as InseminacionRegistrada[]),
          ])
        : Promise.resolve([[], []] as [TransferenciaEmbrionaria[], InseminacionRegistrada[]])

    Promise.all([caballosPromise, relacionesPromise])
      .then(([listaCaballos, [listaTransferencias, listaInseminaciones]]) => {
        setCaballos(listaCaballos)
        setTransferencias(listaTransferencias)
        setInseminaciones(listaInseminaciones)
      })
      .catch((e) => setError(mensajeError(e)))
      .finally(() => setLoading(false))
  }, [rol, sociedadId])

  const gestaciones = useMemo<GestacionRow[]>(() => {
    return caballos
      // `prenada` queda activo tanto por carga manual como cuando la ecografía
      // de la transferencia (incluida la 3.ª Eco) confirma resultado positivo.
      .filter((c) => c.activo && c.categoria === 'Yegua' && c.prenada === true)
      .map((yegua) => {
        const transferenciasYegua = transferencias.filter(
          (t) => t.caballo_receptora_id === yegua.id,
        )
        // La fecha de preñez de una receptora es la fecha de transferencia. El
        // match exacto evita tomar progenitores de un ciclo anterior.
        const transferencia = transferenciasYegua.find((t) => t.fecha === yegua.fecha_prenez)
          ?? transferenciasYegua[0]

        const madre = transferencia
          ? {
              id: transferencia.caballo_donante_id,
              nombre: transferencia.donante?.nombre ?? 'Donante sin nombre',
            }
          : yegua.rol_reproductivo !== 'Receptora'
            ? { id: yegua.id, nombre: yegua.nombre }
            : null

        let padre: ProgenitorRef | null = transferencia?.padrillo_id
          ? {
              id: transferencia.padrillo_id,
              nombre: transferencia.padrillo?.nombre ?? 'Padrillo sin nombre',
            }
          : null

        // En una preñez directa (sin transferencia), usar el padrillo de la
        // última inseminación registrada hasta la fecha de preñez.
        if (!padre && madre) {
          const inseminacion = inseminaciones.find((r) =>
            r.caballo_id === madre.id &&
            (!yegua.fecha_prenez || r.fecha <= yegua.fecha_prenez),
          )
          if (inseminacion) {
            padre = {
              id: inseminacion.padrillo_id,
              nombre: inseminacion.padrillo?.nombre ?? 'Padrillo sin nombre',
            }
          }
        }

        return {
          yegua,
          madre,
          padre,
          fechaParto: yegua.fecha_prenez
            ? sumarDias(yegua.fecha_prenez, DIAS_GESTACION)
            : null,
        }
      })
      .sort((a, b) => {
        if (a.fechaParto && b.fechaParto) return a.fechaParto.localeCompare(b.fechaParto)
        if (a.fechaParto) return -1
        if (b.fechaParto) return 1
        return a.yegua.nombre.localeCompare(b.yegua.nombre)
      })
  }, [caballos, inseminaciones, transferencias])

  function registrarNacimiento(gestacion: GestacionRow) {
    const initialValues: NuevoCaballoInitialValues = {
      fecha_nacimiento: hoyAR(),
      categoria: 'Potrillo',
      padre: gestacion.padre
        ? { id: gestacion.padre.id, nombre: gestacion.padre.nombre }
        : undefined,
      madre: gestacion.madre
        ? { id: gestacion.madre.id, nombre: gestacion.madre.nombre }
        : undefined,
    }
    navigate('/caballos', { state: { nuevoCaballo: initialValues } })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <Baby className="mt-0.5 text-emerald-600" size={24} />
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Yeguas preñadas</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Gestaciones activas y fecha estimada de parto ({DIAS_GESTACION} días desde la preñez).
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : gestaciones.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 py-16 text-center text-sm text-slate-400">
          No hay yeguas preñadas registradas.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Yegua gestante</th>
                <th className="px-4 py-2">Madre (donante)</th>
                <th className="px-4 py-2">Padre (padrillo)</th>
                <th className="px-4 py-2">Fecha de preñez</th>
                <th className="px-4 py-2">Parto estimado</th>
                <th className="px-4 py-2 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {gestaciones.map((gestacion) => (
                <tr key={gestacion.yegua.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 font-medium">
                    <NombreCaballoLink id={gestacion.yegua.id} nombre={gestacion.yegua.nombre} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {gestacion.madre
                      ? <NombreCaballoLink id={gestacion.madre.id} nombre={gestacion.madre.nombre} />
                      : VACIO}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {gestacion.padre
                      ? <NombreCaballoLink id={gestacion.padre.id} nombre={gestacion.padre.nombre} />
                      : VACIO}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {gestacion.yegua.fecha_prenez ? formatFecha(gestacion.yegua.fecha_prenez) : VACIO}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">
                    {gestacion.fechaParto ? formatFecha(gestacion.fechaParto) : VACIO}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => registrarNacimiento(gestacion)}
                      className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-500"
                    >
                      <Baby size={13} />
                      Nació
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
