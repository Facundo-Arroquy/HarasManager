import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Tag,
  Stethoscope,
  FlaskConical,
  TreePine,
  Bell,
  ShieldCheck,
  ChevronDown,
  Mail,
} from 'lucide-react'
import { insertarLead } from '../../services/leadsService'

// ─── Paleta y tipografías ────────────────────────────────────────────────────

const C = {
  charcoal: '#2C2C2C',
  gold: '#8B6914',
  goldLight: '#A67C1A',
  goldSoft: '#D4B483',
  goldPale: '#F5EDD8',
  cream: '#FAF8F3',
  offWhite: '#F0EDE6',
  white: '#FFFFFF',
}

const display: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif" }
const body: React.CSSProperties = { fontFamily: "'DM Sans', sans-serif" }

const EMAILS = {
  tomas: 'tomas.perezzorraquin@harasmanager.com',
  facundo: 'facundo.arroquy@harasmanager.com',
}

const DEMO_MAILTO =
  `mailto:${EMAILS.tomas},${EMAILS.facundo}` +
  '?subject=Solicitud%20de%20demo%20%E2%80%94%20HarasManager' +
  '&body=Hola%2C%20me%20gustar%C3%ADa%20conocer%20m%C3%A1s%20sobre%20HarasManager.'

const MODULOS = [
  'Fichas de animales',
  'Historial clínico',
  'Centro de cría',
  'Alertas sanitarias',
  'Árbol genealógico',
  'Revisión pre-venta',
]

// ─── Hook scroll reveal ──────────────────────────────────────────────────────

function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )
    document.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])
}

// ─── Componentes auxiliares ──────────────────────────────────────────────────

function Overline({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        ...body,
        fontSize: '0.65rem',
        letterSpacing: '0.3em',
        textTransform: 'uppercase',
        color: C.gold,
        fontWeight: 500,
        margin: 0,
      }}
    >
      {children}
    </p>
  )
}

function Divider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '12px 0' }}>
      <div style={{ flex: 1, height: '1px', backgroundColor: C.goldSoft }} />
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: C.gold, flexShrink: 0 }} />
      <div style={{ flex: 1, height: '1px', backgroundColor: C.goldSoft }} />
    </div>
  )
}

function PrimaryButton({
  children,
  href,
  onClick,
  type = 'button',
  loading = false,
}: {
  children: React.ReactNode
  href?: string
  onClick?: () => void
  type?: 'button' | 'submit'
  loading?: boolean
}) {
  const style: React.CSSProperties = {
    ...body,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: C.charcoal,
    color: C.white,
    border: 'none',
    padding: '14px 32px',
    borderRadius: '4px',
    fontWeight: 500,
    fontSize: '0.9rem',
    cursor: loading ? 'wait' : 'pointer',
    letterSpacing: '0.02em',
    transition: 'background-color 0.2s',
    textDecoration: 'none',
    opacity: loading ? 0.7 : 1,
  }
  if (href) {
    return (
      <a
        href={href}
        style={style}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = C.gold)}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = C.charcoal)}
      >
        {children}
      </a>
    )
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={loading}
      style={style}
      onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = C.gold }}
      onMouseLeave={(e) => { if (!loading) e.currentTarget.style.backgroundColor = C.charcoal }}
    >
      {children}
    </button>
  )
}

function OutlineButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...body,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        backgroundColor: 'transparent',
        color: C.white,
        border: `1px solid rgba(255,255,255,0.5)`,
        padding: '13px 32px',
        borderRadius: '4px',
        fontWeight: 400,
        fontSize: '0.9rem',
        cursor: 'pointer',
        letterSpacing: '0.02em',
        transition: 'border-color 0.2s, color 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = C.goldSoft
        e.currentTarget.style.color = C.goldSoft
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'
        e.currentTarget.style.color = C.white
      }}
    >
      {children}
    </button>
  )
}

function LogoImg({ height = 64, style: extraStyle }: { height?: number; style?: React.CSSProperties }) {
  return (
    <img
      src="/logo_H_sin_fondo.png"
      onError={(e) => { e.currentTarget.src = '/logo-harasmanager.jpg' }}
      alt="HarasManager"
      style={{ height, width: 'auto', objectFit: 'contain', display: 'block', mixBlendMode: 'multiply', ...extraStyle }}
    />
  )
}

// ─── NAVBAR ─────────────────────────────────────────────────────────────────

function Navbar() {
  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  const linkStyle: React.CSSProperties = {
    ...body,
    fontSize: '0.82rem',
    color: C.charcoal,
    textDecoration: 'none',
    letterSpacing: '0.02em',
    opacity: 0.75,
    transition: 'opacity 0.15s',
  }

  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: C.cream,
        borderBottom: `1px solid ${C.goldSoft}`,
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 24px',
          height: '80px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '24px',
        }}
      >
        <LogoImg height={64} />

        {/* Links desktop */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '32px',
            flex: 1,
            justifyContent: 'center',
          }}
          className="hidden sm:flex"
        >
          {[
            ['Por qué HarasManager', 'problema'],
            ['Funcionalidades', 'features'],
            ['Para quién', 'para-quien'],
          ].map(([label, id]) => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              style={{ ...linkStyle, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.75')}
            >
              {label}
            </button>
          ))}
        </div>

        <PrimaryButton onClick={() => scrollTo('contacto')}>Solicitar demo</PrimaryButton>
      </div>
    </nav>
  )
}

// ─── HERO ────────────────────────────────────────────────────────────────────

function Hero() {
  function scrollToFeatures() {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
  }
  function scrollToContacto() {
    document.getElementById('contacto')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section style={{ position: 'relative', minHeight: '92vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {/* Video */}
      <video
        autoPlay muted loop playsInline
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        aria-hidden="true"
      >
        <source src="/video-caballos.mp4" type="video/mp4" />
      </video>
      {/* Overlay */}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(20,18,14,0.62)' }} />

      <div
        style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '80px 24px', maxWidth: '860px', margin: '0 auto' }}
        data-reveal
      >
        <Overline>La plataforma equina profesional</Overline>
        <div style={{ height: '20px' }} />
        <h1
          style={{
            ...display,
            fontSize: 'clamp(2.6rem, 6vw, 4.8rem)',
            fontWeight: 700,
            color: C.white,
            lineHeight: 1.1,
            margin: '0 0 24px',
            letterSpacing: '-0.01em',
          }}
        >
          Gestión de caballos<br />
          <em style={{ color: C.goldSoft, fontStyle: 'italic' }}>de punta a punta</em>
        </h1>
        <p
          style={{
            ...body,
            fontSize: 'clamp(1rem, 2vw, 1.15rem)',
            color: 'rgba(255,255,255,0.78)',
            fontWeight: 300,
            lineHeight: 1.7,
            maxWidth: '580px',
            margin: '0 auto 40px',
          }}
        >
          Controlá cada aspecto de tu haras: animales, sanidad, pedigree y centro de cría,
          todo centralizado en una sola plataforma.
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <PrimaryButton onClick={scrollToContacto}>
            <Mail size={16} /> Solicitar demo gratuita
          </PrimaryButton>
          <OutlineButton onClick={scrollToFeatures}>
            Ver funcionalidades <ChevronDown size={16} />
          </OutlineButton>
        </div>
      </div>
    </section>
  )
}

// ─── PROBLEMA / SOLUCIÓN ─────────────────────────────────────────────────────

function ProblemaSolucion() {
  return (
    <section id="problema" style={{ backgroundColor: C.white, padding: '100px 24px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <div data-reveal style={{ textAlign: 'center', marginBottom: '64px' }}>
          <Overline>Por qué existe HarasManager</Overline>
          <div style={{ height: '16px' }} />
          <h2 style={{ ...display, fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 700, color: C.charcoal, margin: 0, lineHeight: 1.2 }}>
            La gestión equina merece una herramienta a su altura
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '48px', alignItems: 'start' }}>
          {/* El problema */}
          <div data-reveal data-delay="100">
            <p style={{ ...body, fontSize: '0.65rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#9B8B7A', fontWeight: 500, margin: '0 0 16px' }}>
              El problema
            </p>
            <h3 style={{ ...display, fontSize: '1.5rem', fontWeight: 600, color: C.charcoal, margin: '0 0 16px', lineHeight: 1.3 }}>
              Planillas, papel y WhatsApp
            </h3>
            <div style={{ width: '40px', height: '2px', backgroundColor: C.goldSoft, margin: '0 0 20px' }} />
            <p style={{ ...body, fontSize: '0.95rem', color: '#6B6055', lineHeight: 1.75, margin: 0 }}>
              Los haras manejan información crítica dispersa en múltiples herramientas.
              Historiales clínicos perdidos, alertas que se olvidan, datos de pedigree
              en papeles amarillentos. La falta de trazabilidad cuesta tiempo y dinero.
            </p>
          </div>

          {/* Separador vertical */}
          <div data-reveal style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0' }}>
            <div style={{ flex: 1, width: '1px', minHeight: '120px', backgroundColor: C.goldSoft }} />
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: C.gold, margin: '12px 0', flexShrink: 0 }} />
            <div style={{ flex: 1, width: '1px', minHeight: '120px', backgroundColor: C.goldSoft }} />
          </div>

          {/* La solución */}
          <div data-reveal data-delay="200">
            <p style={{ ...body, fontSize: '0.65rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: C.gold, fontWeight: 500, margin: '0 0 16px' }}>
              La solución
            </p>
            <h3 style={{ ...display, fontSize: '1.5rem', fontWeight: 600, color: C.charcoal, margin: '0 0 16px', lineHeight: 1.3 }}>
              Todo en un solo lugar
            </h3>
            <div style={{ width: '40px', height: '2px', backgroundColor: C.gold, margin: '0 0 20px' }} />
            <p style={{ ...body, fontSize: '0.95rem', color: '#6B6055', lineHeight: 1.75, margin: 0 }}>
              Haras Manager centraliza la gestión completa de tu establecimiento.
              Fichas de animales, historial clínico inmutable, alertas automáticas,
              árbol genealógico y centro de embriones. Una plataforma diseñada
              específicamente para el mundo equino profesional.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── FEATURES ────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: <Tag size={22} />,
    title: 'Fichas de animales',
    desc: 'Registro completo de cada caballo: chip electrónico, categoría, campo asignado, fotos y documentación. Toda la información en un solo lugar.',
  },
  {
    icon: <Stethoscope size={22} />,
    title: 'Historial clínico',
    desc: 'Consultas y tratamientos registrados de forma inmutable por veterinario. Acceso controlado para profesionales externos.',
  },
  {
    icon: <Bell size={22} />,
    title: 'Alertas sanitarias',
    desc: 'Recordatorios automáticos de vacunas, desparasitaciones y revisiones. No se te escapa ningún vencimiento sanitario.',
  },
  {
    icon: <FlaskConical size={22} />,
    title: 'Centro de cría',
    desc: 'Gestión completa de flushings, transferencias de embriones y programa semanal. Trazabilidad del proceso reproductivo de punta a punta.',
  },
  {
    icon: <TreePine size={22} />,
    title: 'Árbol genealógico',
    desc: 'Pedigree visual con registro de padres, madres y abuelos. Documentación lista para compraventa y certificaciones.',
  },
  {
    icon: <ShieldCheck size={22} />,
    title: 'Revisión pre-venta',
    desc: 'Checklist sanitario integrado para preparar la venta de un animal. Historial clínico verificable para el comprador.',
  },
]

function Features() {
  return (
    <section id="features" style={{ backgroundColor: C.cream, padding: '100px 24px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <div data-reveal style={{ textAlign: 'center', marginBottom: '64px' }}>
          <Overline>Funcionalidades</Overline>
          <div style={{ height: '16px' }} />
          <h2 style={{ ...display, fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 700, color: C.charcoal, margin: 0, lineHeight: 1.2 }}>
            Todo lo que tu haras necesita
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '24px',
          }}
        >
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              data-reveal
              data-delay={String(((i % 3) + 1) * 100) as '100' | '200' | '300'}
              style={{
                backgroundColor: C.white,
                border: `1px solid ${C.goldSoft}`,
                borderRadius: '4px',
                padding: '32px',
                transition: 'box-shadow 0.2s, border-color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = `0 8px 32px rgba(139,105,20,0.12)`
                e.currentTarget.style.borderColor = C.gold
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.borderColor = C.goldSoft
              }}
            >
              <div style={{ color: C.gold, marginBottom: '16px' }}>{f.icon}</div>
              <h3 style={{ ...display, fontSize: '1.3rem', fontWeight: 600, color: C.charcoal, margin: '0 0 8px', lineHeight: 1.3 }}>
                {f.title}
              </h3>
              <div style={{ width: '28px', height: '1px', backgroundColor: C.goldSoft, margin: '0 0 14px' }} />
              <p style={{ ...body, fontSize: '0.88rem', color: '#7A6E64', lineHeight: 1.7, margin: 0 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── PARA QUIÉN ──────────────────────────────────────────────────────────────

function ParaQuien() {
  const perfiles = [
    {
      numero: '01',
      titulo: 'Propietarios de haras',
      subtitulo: 'Visión completa de tu establecimiento',
      desc: 'Controlá tu tropilla, tus campos y tu equipo desde cualquier lugar y dispositivo. Toda la información de tu haras centralizada y al instante.',
      items: [
        'Panel con estado en tiempo real de tus animales',
        'Control de accesos y permisos por rol',
        'Historial y documentación de cada caballo',
        'Gestión del centro de embriones y reproducción',
      ],
    },
    {
      numero: '02',
      titulo: 'Veterinarios',
      subtitulo: 'Tu panel profesional, todos tus pacientes',
      desc: 'Accedé al historial de tus pacientes equinos, registrá consultas y coordiná con los establecimientos que atendés, todo desde un panel propio.',
      items: [
        'Panel personalizado con tus pacientes asignados',
        'Registro de consultas y tratamientos firmado',
        'Acceso multi-establecimiento desde una cuenta',
        'Alertas sanitarias y recordatorios por animal',
      ],
    },
  ]

  return (
    <section id="para-quien" style={{ backgroundColor: C.white, padding: '100px 24px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <div data-reveal style={{ textAlign: 'center', marginBottom: '72px' }}>
          <Overline>Para quién es</Overline>
          <div style={{ height: '16px' }} />
          <h2 style={{ ...display, fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 700, color: C.charcoal, margin: 0, lineHeight: 1.2 }}>
            Diseñado para los profesionales del mundo equino
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px' }}>
          {perfiles.map((p, i) => (
            <div
              key={p.titulo}
              data-reveal
              data-delay={i === 0 ? '100' : '200'}
              style={{
                backgroundColor: C.cream,
                border: `1px solid ${C.goldSoft}`,
                borderRadius: '4px',
                padding: '48px 40px',
              }}
            >
              <p style={{ ...display, fontSize: '3.5rem', fontWeight: 700, color: C.goldPale, margin: '0 0 24px', lineHeight: 1 }}>
                {p.numero}
              </p>
              <h3 style={{ ...display, fontSize: '1.6rem', fontWeight: 700, color: C.charcoal, margin: '0 0 6px', lineHeight: 1.2 }}>
                {p.titulo}
              </h3>
              <p style={{ ...body, fontSize: '0.75rem', color: C.gold, letterSpacing: '0.08em', fontWeight: 500, margin: '0 0 16px' }}>
                {p.subtitulo}
              </p>
              <Divider />
              <p style={{ ...body, fontSize: '0.92rem', color: '#6B6055', lineHeight: 1.75, margin: '16px 0 24px' }}>
                {p.desc}
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {p.items.map((item) => (
                  <li key={item} style={{ ...body, display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.87rem', color: '#4A403A' }}>
                    <span style={{ color: C.gold, flexShrink: 0, marginTop: '2px', fontSize: '0.6rem', letterSpacing: '0.1em' }}>◆</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}


// ─── FORMULARIO DE CONTACTO ──────────────────────────────────────────────────

interface FormState {
  nombre: string
  email: string
  telefono: string
  nombre_establecimiento: string
  cantidad_animales: string
  modulos_interes: string[]
  mensaje: string
}

const FORM_INICIAL: FormState = {
  nombre: '',
  email: '',
  telefono: '',
  nombre_establecimiento: '',
  cantidad_animales: '',
  modulos_interes: [],
  mensaje: '',
}

const inputStyle: React.CSSProperties = {
  ...body,
  width: '100%',
  padding: '12px 16px',
  border: `1px solid ${C.goldSoft}`,
  borderRadius: '4px',
  backgroundColor: C.white,
  color: C.charcoal,
  fontSize: '0.9rem',
  outline: 'none',
  transition: 'border-color 0.15s',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  ...body,
  display: 'block',
  fontSize: '0.78rem',
  fontWeight: 500,
  color: C.charcoal,
  marginBottom: '8px',
  letterSpacing: '0.02em',
}

function ContactForm() {
  const [form, setForm] = useState<FormState>(FORM_INICIAL)
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  function toggleModulo(modulo: string) {
    setForm((prev) => ({
      ...prev,
      modulos_interes: prev.modulos_interes.includes(modulo)
        ? prev.modulos_interes.filter((m) => m !== modulo)
        : [...prev.modulos_interes, modulo],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitState('loading')
    try {
      await insertarLead(form)
      setSubmitState('success')
      setForm(FORM_INICIAL)
    } catch {
      setSubmitState('error')
    }
  }

  return (
    <section id="contacto" style={{ backgroundColor: C.white, padding: '100px 24px' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>
        <div data-reveal style={{ textAlign: 'center', marginBottom: '56px' }}>
          <Overline>Demo gratuita</Overline>
          <div style={{ height: '16px' }} />
          <h2 style={{ ...display, fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 700, color: C.charcoal, margin: '0 0 16px', lineHeight: 1.2 }}>
            Hablemos de tu haras
          </h2>
          <p style={{ ...body, fontSize: '0.95rem', color: '#7A6E64', lineHeight: 1.7, margin: 0 }}>
            Completá el formulario y te contactamos para coordinar una demo personalizada.
          </p>
        </div>

        {submitState === 'success' ? (
          <div
            data-reveal
            style={{
              textAlign: 'center',
              padding: '48px 32px',
              border: `1px solid ${C.goldSoft}`,
              borderRadius: '4px',
              backgroundColor: C.cream,
            }}
          >
            <p style={{ ...display, fontSize: '2rem', color: C.charcoal, margin: '0 0 12px' }}>¡Muchas gracias!</p>
            <p style={{ ...body, fontSize: '0.95rem', color: '#7A6E64', lineHeight: 1.7, margin: 0 }}>
              Recibimos tu consulta. Nos ponemos en contacto a la brevedad para coordinar la demo.
            </p>
          </div>
        ) : (
          <form data-reveal onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Nombre y apellido */}
            <div>
              <label style={labelStyle}>Nombre y apellido *</label>
              <input
                type="text"
                required
                value={form.nombre}
                onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = C.gold)}
                onBlur={(e) => (e.target.style.borderColor = C.goldSoft)}
                placeholder="Juan García"
              />
            </div>

            {/* Email */}
            <div>
              <label style={labelStyle}>Email de contacto *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = C.gold)}
                onBlur={(e) => (e.target.style.borderColor = C.goldSoft)}
                placeholder="juan@miharas.com.ar"
              />
            </div>

            {/* Teléfono / WhatsApp */}
            <div>
              <label style={labelStyle}>
                Teléfono{' '}
                <span style={{ color: '#9B8B7A', fontWeight: 300 }}>(WhatsApp)</span>
              </label>
              <input
                type="tel"
                value={form.telefono}
                onChange={(e) => setForm((p) => ({ ...p, telefono: e.target.value }))}
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = C.gold)}
                onBlur={(e) => (e.target.style.borderColor = C.goldSoft)}
                placeholder="+54 9 11 1234-5678"
              />
            </div>

            {/* Nombre establecimiento */}
            <div>
              <label style={labelStyle}>Nombre del establecimiento *</label>
              <input
                type="text"
                required
                value={form.nombre_establecimiento}
                onChange={(e) => setForm((p) => ({ ...p, nombre_establecimiento: e.target.value }))}
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = C.gold)}
                onBlur={(e) => (e.target.style.borderColor = C.goldSoft)}
                placeholder="Haras La Estrella"
              />
            </div>

            {/* Cantidad de animales */}
            <div>
              <label style={labelStyle}>Cantidad aproximada de animales</label>
              <select
                value={form.cantidad_animales}
                onChange={(e) => setForm((p) => ({ ...p, cantidad_animales: e.target.value }))}
                style={{ ...inputStyle, appearance: 'auto' }}
                onFocus={(e) => (e.target.style.borderColor = C.gold)}
                onBlur={(e) => (e.target.style.borderColor = C.goldSoft)}
              >
                <option value="">Seleccioná una opción</option>
                <option value="1-20">1 a 20 animales</option>
                <option value="21-50">21 a 50 animales</option>
                <option value="51-100">51 a 100 animales</option>
                <option value="+100">Más de 100 animales</option>
              </select>
            </div>

            {/* Módulos de interés */}
            <div>
              <label style={labelStyle}>Módulos que te interesan</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                {MODULOS.map((modulo) => {
                  const checked = form.modulos_interes.includes(modulo)
                  return (
                    <label
                      key={modulo}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        cursor: 'pointer',
                        padding: '10px 14px',
                        border: `1px solid ${checked ? C.gold : C.goldSoft}`,
                        borderRadius: '4px',
                        backgroundColor: checked ? C.goldPale : C.cream,
                        transition: 'all 0.15s',
                        ...body,
                        fontSize: '0.85rem',
                        color: C.charcoal,
                        userSelect: 'none',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleModulo(modulo)}
                        style={{ accentColor: C.gold, width: '14px', height: '14px', flexShrink: 0 }}
                      />
                      {modulo}
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Mensaje */}
            <div>
              <label style={labelStyle}>Mensaje adicional <span style={{ color: '#9B8B7A', fontWeight: 300 }}>(opcional)</span></label>
              <textarea
                value={form.mensaje}
                onChange={(e) => setForm((p) => ({ ...p, mensaje: e.target.value }))}
                rows={4}
                style={{ ...inputStyle, resize: 'vertical', minHeight: '100px' }}
                onFocus={(e) => (e.target.style.borderColor = C.gold)}
                onBlur={(e) => (e.target.style.borderColor = C.goldSoft)}
                placeholder="Contanos en qué etapa está tu haras, qué problemas querés resolver..."
              />
            </div>

            {submitState === 'error' && (
              <p style={{ ...body, fontSize: '0.85rem', color: '#C0392B', margin: 0 }}>
                Hubo un error al enviar. Escribinos directamente a{' '}
                <a href={`mailto:${EMAILS.tomas}`} style={{ color: C.gold }}>{EMAILS.tomas}</a>.
              </p>
            )}

            <PrimaryButton type="submit" loading={submitState === 'loading'}>
              <Mail size={16} />
              {submitState === 'loading' ? 'Enviando...' : 'Enviar consulta'}
            </PrimaryButton>
          </form>
        )}
      </div>
    </section>
  )
}

// ─── FOOTER ──────────────────────────────────────────────────────────────────

function Footer() {
  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  const linkStyle: React.CSSProperties = {
    ...body,
    fontSize: '0.82rem',
    color: 'rgba(255,255,255,0.55)',
    textDecoration: 'none',
    transition: 'color 0.15s',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
  }

  return (
    <footer style={{ backgroundColor: C.charcoal, padding: '64px 24px 40px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {/* Logo + tagline */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <img
            src="/Logo_V_sin_fondo.png"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
            alt="HarasManager"
            style={{ height: '100px', width: 'auto', objectFit: 'contain', display: 'block', margin: '0 auto 16px' }}
          />
          <p style={{ ...body, fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>
            Gestión de caballos de punta a punta
          </p>
        </div>

        {/* Links */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '24px 40px',
            marginBottom: '40px',
          }}
        >
          {[
            { label: 'Por qué HarasManager', id: 'problema' },
            { label: 'Funcionalidades', id: 'features' },
            { label: 'Para quién', id: 'para-quien' },
            { label: 'Contacto', id: 'contacto' },
          ].map(({ label, id }) => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              style={linkStyle}
              onMouseEnter={(e) => (e.currentTarget.style.color = C.goldSoft)}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
            >
              {label}
            </button>
          ))}
          <Link
            to="/login"
            style={linkStyle}
            onMouseEnter={(e) => (e.currentTarget.style.color = C.goldSoft)}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
          >
            Iniciar sesión
          </Link>
        </div>

        {/* Emails */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 32px', marginBottom: '40px' }}>
          {[EMAILS.tomas, EMAILS.facundo].map((email) => (
            <a
              key={email}
              href={`mailto:${email}`}
              style={{ ...linkStyle, fontSize: '0.78rem' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = C.goldSoft)}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
            >
              {email}
            </a>
          ))}
        </div>

        {/* Divider */}
        <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: '28px' }} />

        {/* Copyright */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <p style={{ ...body, fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', margin: 0 }}>
            © 2025 HarasManager. Todos los derechos reservados.
          </p>
          <Link
            to="/terminos"
            style={{ ...linkStyle, fontSize: '0.75rem' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = C.goldSoft)}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
          >
            Términos y condiciones
          </Link>
        </div>
      </div>
    </footer>
  )
}

// ─── LANDING PAGE ────────────────────────────────────────────────────────────

export default function LandingPage() {
  useScrollReveal()

  return (
    <div style={{ backgroundColor: C.cream, color: C.charcoal, fontFamily: "'DM Sans', sans-serif" }}>
      <Navbar />
      <Hero />
      <ProblemaSolucion />
      <Features />
      <ParaQuien />
      <ContactForm />
      <Footer />
    </div>
  )
}
