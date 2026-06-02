import {
  Tag,
  Stethoscope,
  FlaskConical,
  MapPin,
  TreePine,
  Bell,
  Mail,
  ChevronDown,
} from 'lucide-react'
import { Link } from 'react-router-dom'

const DEMO_MAILTO =
  'mailto:tperezzorraquin@gmail.com,Facundoarroquy.w@gmail.com' +
  '?subject=Solicitud%20de%20demo%20-%20Haras%20Manager' +
  '&body=Hola%2C%20me%20gustar%C3%ADa%20conocer%20m%C3%A1s%20sobre%20Haras%20Manager.'

function HorseshoeSVG({ color = '#8B6914', size = 16 }: { color?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={Math.round(size * 0.875)}
      viewBox="0 0 32 28"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 28 L5 13 Q5 2 16 2 Q27 2 27 13 L27 28"
        stroke={color}
        strokeWidth="6"
        fill="none"
        strokeLinecap="square"
      />
    </svg>
  )
}

function Logo({ inverted = false }: { inverted?: boolean }) {
  if (!inverted) {
    return (
      <img
        src="/logo-harasmanager.jpg"
        alt="HarasManager — Gestión de caballos de punta a punta"
        className="h-16 w-auto object-contain"
      />
    )
  }
  return (
    <div className="flex flex-col items-start leading-none">
      <div className="text-xl font-black tracking-tight select-none">
        <span style={{ color: '#ffffff' }}>HARAS</span>
        <span style={{ color: '#8B6914' }}>MANAGER</span>
      </div>
      <div className="flex items-center gap-1.5 mt-0.5">
        <HorseshoeSVG color="#8B6914" size={11} />
        <span className="text-[7px] font-semibold tracking-widest uppercase" style={{ color: '#9ca3af' }}>
          Gestión de caballos de punta a punta
        </span>
      </div>
    </div>
  )
}

function HorseVisual() {
  return (
    <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ backgroundColor: '#2C2C3A' }}>
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg" style={{ backgroundColor: '#8B691422' }}>
          <Tag className="w-6 h-6" style={{ color: '#8B6914' }} />
        </div>
        <div>
          <div className="text-white font-semibold text-sm">Fortuna Real</div>
          <div className="text-gray-400 text-xs">Yegua · 7 años · Pura Sangre</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Campo', value: 'Lote Norte' },
          { label: 'Chip', value: '94100...' },
          { label: 'Categoría', value: 'Reproductora' },
          { label: 'Estado', value: 'Activa' },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg p-2.5" style={{ backgroundColor: '#1a1a26' }}>
            <div className="text-gray-500 text-xs">{label}</div>
            <div className="text-white text-sm font-medium mt-0.5">{value}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {['Pedigree', 'Historial', 'Fotos'].map((tab) => (
          <div
            key={tab}
            className="text-xs px-3 py-1 rounded-full"
            style={
              tab === 'Pedigree'
                ? { backgroundColor: '#8B6914', color: '#fff' }
                : { backgroundColor: '#1a1a26', color: '#9ca3af' }
            }
          >
            {tab}
          </div>
        ))}
      </div>
    </div>
  )
}

function MedicalVisual() {
  const entries = [
    { date: 'Hoy', text: 'Vacuna antigripal', icon: <Bell className="w-4 h-4" /> },
    { date: '15/05', text: 'Revisión podal — Dr. Sosa', icon: <Stethoscope className="w-4 h-4" /> },
    { date: '02/05', text: 'Alerta: próxima desparasitación', icon: <Bell className="w-4 h-4" /> },
  ]
  return (
    <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ backgroundColor: '#2C2C3A' }}>
      <div className="flex items-center justify-between">
        <span className="text-white font-semibold text-sm">Historial clínico</span>
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{ backgroundColor: '#8B6914', color: '#fff' }}
        >
          2 alertas
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {entries.map((e, i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-2.5 rounded-lg"
            style={{ backgroundColor: '#1a1a26' }}
          >
            <div style={{ color: '#8B6914' }}>{e.icon}</div>
            <div className="flex-1">
              <div className="text-white text-xs font-medium">{e.text}</div>
              <div className="text-gray-500 text-xs">{e.date}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PedigreeVisual() {
  return (
    <div className="rounded-2xl p-6 flex flex-col gap-5" style={{ backgroundColor: '#2C2C3A' }}>
      <div className="flex items-center gap-3">
        <TreePine className="w-5 h-5" style={{ color: '#8B6914' }} />
        <span className="text-white font-semibold text-sm">Árbol genealógico</span>
      </div>
      <div className="flex flex-col items-center gap-3">
        <div
          className="px-4 py-2 rounded-lg text-white text-xs font-semibold"
          style={{ backgroundColor: '#8B6914' }}
        >
          Fortuna Real
        </div>
        <div className="w-px h-3" style={{ backgroundColor: '#8B6914' }} />
        <div className="flex gap-6">
          {['Padre: Eclipse', 'Madre: Luna Azul'].map((name) => (
            <div
              key={name}
              className="px-3 py-1.5 rounded-lg text-gray-300 text-xs text-center"
              style={{ backgroundColor: '#1a1a26' }}
            >
              {name}
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          {['Abuelo P.', 'Abuela P.', 'Abuelo M.', 'Abuela M.'].map((name) => (
            <div
              key={name}
              className="px-2 py-1 rounded text-gray-500 text-[10px] text-center"
              style={{ backgroundColor: '#1a1a26' }}
            >
              {name}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function EmbrionVisual() {
  const rows = [
    { donante: 'Luna Azul', receptor: 'Yegua #3', estado: 'Confirmada' },
    { donante: 'Fortuna Real', receptor: 'Yegua #7', estado: 'Pendiente' },
    { donante: 'Storm Queen', receptor: 'Yegua #1', estado: 'Confirmada' },
  ]
  return (
    <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ backgroundColor: '#2C2C3A' }}>
      <div className="flex items-center gap-3">
        <FlaskConical className="w-5 h-5" style={{ color: '#8B6914' }} />
        <span className="text-white font-semibold text-sm">Centro de embriones</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="grid grid-cols-3 gap-2 text-gray-500 text-[10px] uppercase tracking-wide px-1">
          <span>Donante</span>
          <span>Receptora</span>
          <span>Estado</span>
        </div>
        {rows.map((row, i) => (
          <div
            key={i}
            className="grid grid-cols-3 gap-2 p-2 rounded-lg items-center"
            style={{ backgroundColor: '#1a1a26' }}
          >
            <span className="text-gray-300 text-xs">{row.donante}</span>
            <span className="text-gray-300 text-xs">{row.receptor}</span>
            <span
              className="text-xs px-2 py-0.5 rounded-full text-center"
              style={
                row.estado === 'Confirmada'
                  ? { backgroundColor: '#8B691433', color: '#8B6914' }
                  : { backgroundColor: '#1e3a5f', color: '#60a5fa' }
              }
            >
              {row.estado}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item} className="flex items-center gap-2 text-sm text-gray-600">
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: '#8B6914' }}
          />
          {item}
        </li>
      ))}
    </ul>
  )
}

function FeatureTag({
  icon,
  label,
}: {
  icon: React.ReactNode
  label: string
}) {
  return (
    <div
      className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest mb-4 px-3 py-1 rounded-full"
      style={{ backgroundColor: '#8B691418', color: '#8B6914' }}
    >
      {icon}
      {label}
    </div>
  )
}

export default function LandingPage() {
  function scrollToFeatures() {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* ── NAVBAR ── */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Logo />
          <Link
            to="/login"
            className="text-sm font-semibold px-4 py-2 rounded-lg border transition-colors hover:bg-[#8B6914] hover:text-white"
            style={{ borderColor: '#8B6914', color: '#8B6914' }}
          >
            Iniciar sesión
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          src="/video-caballos.mp4"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0"
          style={{ backgroundColor: 'rgba(44, 44, 58, 0.72)' }}
        />
        <div className="relative z-10 text-center px-4 sm:px-6 max-w-4xl mx-auto py-20">
          <p
            className="text-sm font-semibold tracking-widest uppercase mb-5"
            style={{ color: '#8B6914' }}
          >
            Gestión de caballos de punta a punta
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight mb-6">
            La plataforma de gestión equina para haras profesionales
          </h1>
          <p className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto mb-10">
            Controlá cada aspecto de tu establecimiento: sanidad, pedigree, campos y centro de
            cría, todo en un solo lugar.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={DEMO_MAILTO}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-white text-base transition-colors bg-[#8B6914] hover:bg-[#A07820]"
            >
              <Mail className="w-5 h-5" />
              Solicitar una demo
            </a>
            <button
              onClick={scrollToFeatures}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-white text-base border border-white/40 hover:bg-white/10 transition-colors"
            >
              Ver funcionalidades
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* ── PROPUESTA DE VALOR ── */}
      <section className="bg-slate-50 py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-black text-center mb-3" style={{ color: '#2C2C3A' }}>
            Todo lo que tu haras necesita
          </h2>
          <p className="text-center text-gray-500 mb-12 max-w-xl mx-auto">
            Un sistema pensado para la gestión profesional del haras, desde la ficha del animal
            hasta el centro de cría.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                emoji: '🐴',
                title: 'Gestión de animales',
                desc: 'Fichas completas, chip electrónico, categorías, campos y caballerizas. Toda la información de tu tropilla en un lugar.',
              },
              {
                emoji: '🩺',
                title: 'Seguimiento veterinario',
                desc: 'Historial clínico, consultas, alertas sanitarias y revisión pre-venta. Acceso para vets externos con permisos controlados.',
              },
              {
                emoji: '🔬',
                title: 'Centro de cría',
                desc: 'Flushings, transferencias de embriones y programa semanal. Trazabilidad completa del proceso reproductivo.',
              },
            ].map(({ emoji, title, desc }) => (
              <div
                key={title}
                className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
              >
                <div className="text-4xl mb-4">{emoji}</div>
                <h3 className="text-lg font-bold mb-2" style={{ color: '#2C2C3A' }}>
                  {title}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES DETALLADAS ── */}
      <section id="features" className="py-20 px-4">
        <div className="max-w-6xl mx-auto flex flex-col gap-24">

          {/* a) Control total de tu tropilla */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <FeatureTag icon={<Tag className="w-3.5 h-3.5" />} label="Módulo de caballos" />
              <h3 className="text-3xl font-black mb-4" style={{ color: '#2C2C3A' }}>
                Control total de tu tropilla
              </h3>
              <p className="text-gray-600 leading-relaxed mb-6">
                Registrá cada animal con su ficha completa: chip electrónico, pedigree, categoría,
                distribución en campos y caballerizas, y galería de fotos. Toda la información
                centralizada y accesible desde cualquier dispositivo.
              </p>
              <BulletList
                items={[
                  'Fichas con chip y datos sanitarios',
                  'Distribución por campos y caballerizas',
                  'Galería de fotos y documentos',
                  'Filtros y búsqueda avanzada',
                ]}
              />
            </div>
            <HorseVisual />
          </div>

          {/* b) Historial clínico y alertas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <MedicalVisual />
            </div>
            <div className="order-1 lg:order-2">
              <FeatureTag
                icon={<Stethoscope className="w-3.5 h-3.5" />}
                label="Módulo veterinario"
              />
              <h3 className="text-3xl font-black mb-4" style={{ color: '#2C2C3A' }}>
                Historial clínico y alertas
              </h3>
              <p className="text-gray-600 leading-relaxed mb-6">
                Cada consulta y tratamiento queda registrado en el historial del animal. Configurá
                alertas y recordatorios sanitarios, y habilitá el acceso a veterinarios externos
                de forma controlada.
              </p>
              <BulletList
                items={[
                  'Historial clínico por animal',
                  'Alertas y recordatorios sanitarios',
                  'Acceso para veterinarios externos',
                  'Revisión pre-venta integrada',
                ]}
              />
            </div>
          </div>

          {/* c) Árbol genealógico y pedigree */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <FeatureTag icon={<TreePine className="w-3.5 h-3.5" />} label="Módulo de pedigree" />
              <h3 className="text-3xl font-black mb-4" style={{ color: '#2C2C3A' }}>
                Árbol genealógico y pedigree
              </h3>
              <p className="text-gray-600 leading-relaxed mb-6">
                Visualizá el árbol genealógico completo de cada animal. Registrá padres, madres y
                abuelos para tener la trazabilidad de linajes y facilitar la documentación de
                compra-venta.
              </p>
              <BulletList
                items={[
                  'Árbol genealógico visual',
                  'Registro de padres y madres',
                  'Trazabilidad de linajes',
                  'Documentación para compra-venta',
                ]}
              />
            </div>
            <PedigreeVisual />
          </div>

          {/* d) Centro de embriones */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <EmbrionVisual />
            </div>
            <div className="order-1 lg:order-2">
              <FeatureTag
                icon={<FlaskConical className="w-3.5 h-3.5" />}
                label="Centro de embriones"
              />
              <h3 className="text-3xl font-black mb-4" style={{ color: '#2C2C3A' }}>
                Centro de embriones
              </h3>
              <p className="text-gray-600 leading-relaxed mb-6">
                Gestioná flushings, transferencias y el programa semanal desde un módulo
                especializado. Trazabilidad completa: donante, receptora y estado de cada
                embrión en tiempo real.
              </p>
              <BulletList
                items={[
                  'Registro de flushings y embriones',
                  'Gestión de transferencias',
                  'Programa semanal de cría',
                  'Seguimiento de receptoras',
                ]}
              />
            </div>
          </div>

        </div>
      </section>

      {/* ── ¿PARA QUIÉN? ── */}
      <section className="bg-slate-50 py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-black text-center mb-3" style={{ color: '#2C2C3A' }}>
            Diseñado para profesionales del mundo equino
          </h2>
          <p className="text-center text-gray-500 mb-12 max-w-xl mx-auto">
            HarasManager fue pensado para los dos roles que mueven un haras: el propietario y el
            veterinario.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                icon: <MapPin className="w-8 h-8" style={{ color: '#8B6914' }} />,
                title: 'Propietarios de haras',
                desc: 'Controlá tu establecimiento, tus animales y tu equipo desde cualquier lugar. Tomá decisiones con información precisa y en tiempo real.',
                items: [
                  'Visión 360° de tu tropilla',
                  'Gestión de campos y caballerizas',
                  'Control de accesos y permisos',
                  'Historial completo por animal',
                ],
              },
              {
                icon: <Stethoscope className="w-8 h-8" style={{ color: '#8B6914' }} />,
                title: 'Veterinarios',
                desc: 'Accedé al historial de tus pacientes, registrá consultas y coordiná con los establecimientos que atendés, todo desde una sola plataforma.',
                items: [
                  'Panel propio con tus pacientes',
                  'Registro de consultas y tratamientos',
                  'Alertas sanitarias configurables',
                  'Acceso multi-establecimiento',
                ],
              },
            ].map(({ icon, title, desc, items }) => (
              <div
                key={title}
                className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100"
              >
                <div className="mb-4">{icon}</div>
                <h3 className="text-xl font-bold mb-3" style={{ color: '#2C2C3A' }}>
                  {title}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-5">{desc}</p>
                <BulletList items={items} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="py-24 px-4" style={{ backgroundColor: '#2C2C3A' }}>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-black text-white mb-4">
            ¿Listo para digitalizar tu haras?
          </h2>
          <p className="text-gray-300 text-lg mb-10">
            Pedinos una demo y te mostramos cómo funciona.
          </p>
          <a
            href={DEMO_MAILTO}
            className="inline-flex items-center gap-2 px-10 py-4 rounded-xl font-bold text-white text-base transition-colors bg-[#8B6914] hover:bg-[#A07820]"
          >
            <Mail className="w-5 h-5" />
            Solicitar demo
          </a>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer
        className="py-12 px-4"
        style={{ backgroundColor: '#2C2C3A', borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <Logo inverted />
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 text-sm text-gray-400">
              <Link to="/terminos" className="hover:text-white transition-colors">
                Términos y condiciones
              </Link>
              <a
                href="mailto:tperezzorraquin@gmail.com"
                className="hover:text-white transition-colors"
              >
                tperezzorraquin@gmail.com
              </a>
              <a
                href="mailto:Facundoarroquy.w@gmail.com"
                className="hover:text-white transition-colors"
              >
                Facundoarroquy.w@gmail.com
              </a>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-white/10 text-center text-gray-500 text-xs">
            © 2025 HarasManager. Todos los derechos reservados.
          </div>
        </div>
      </footer>
    </div>
  )
}
