// ⚠️ BORRADOR DE REFERENCIA — NO es un texto legal certificado.
// Antes de publicar en producción, un abogado debe revisar estos textos, en
// particular el tratamiento del historial clínico y las implicancias de la
// Ley 25.326 de Protección de Datos Personales. Ver TASKS.md.

import { Link } from 'react-router-dom'
import { C, display, body, EMAIL_EMPRESA } from '../landing/landingUI'

type Tipo = 'terminos' | 'privacidad'

interface Seccion {
  n: number
  titulo: string
  texto: string
}

const TERMINOS: Seccion[] = [
  {
    n: 1,
    titulo: 'Objeto',
    texto:
      'HarasManager es una plataforma web para la gestión de establecimientos equinos (haras), operada por el equipo de HarasManager. El producto se encuentra actualmente en etapa de desarrollo (MVP): sus funcionalidades, apariencia y disponibilidad pueden cambiar sin aviso previo.',
  },
  {
    n: 2,
    titulo: 'Cuentas y accesos',
    texto:
      'Las cuentas se crean por invitación del administrador de cada haras. Cada usuario es responsable de mantener la confidencialidad de sus credenciales y de la actividad realizada desde su cuenta.',
  },
  {
    n: 3,
    titulo: 'Uso permitido',
    texto:
      'La plataforma debe usarse exclusivamente para gestionar información de los animales, el personal y las operaciones del establecimiento del usuario. No está permitido cargar información de terceros sin su consentimiento, ni usar la plataforma con fines distintos a los previstos.',
  },
  {
    n: 4,
    titulo: 'Historial clínico',
    texto:
      'El registro es de los caballos: lo que se documenta en la plataforma es la historia sanitaria de cada animal, que lo acompaña a lo largo de su vida y de sus cambios de establecimiento, y no información clínica de personas. Los registros cargados por un veterinario son inmutables una vez guardados: solo pueden ser editados por el profesional que los creó. Esto garantiza la trazabilidad del historial sanitario de cada animal.',
  },
  {
    n: 5,
    titulo: 'Disponibilidad del servicio',
    texto:
      'Por tratarse de un producto en desarrollo activo, no se garantiza disponibilidad ininterrumpida ni ausencia total de errores. Se recomienda a los usuarios conservar registros propios de la información crítica hasta que la plataforma alcance una etapa de producción estable.',
  },
  {
    n: 6,
    titulo: 'Propiedad',
    texto:
      'El software, el diseño y la marca de HarasManager son propiedad de sus desarrolladores. Los datos cargados por cada haras (fichas de animales, historial clínico, pedigree, etc.) son propiedad de ese haras.',
  },
  {
    n: 7,
    titulo: 'Limitación de responsabilidad',
    texto:
      'Durante su etapa de desarrollo, HarasManager se ofrece "tal cual". En la medida permitida por la ley, no se asume responsabilidad por pérdidas derivadas del uso de la plataforma.',
  },
  {
    n: 8,
    titulo: 'Modificaciones',
    texto:
      'Estos términos pueden actualizarse; los cambios relevantes se notificarán a los usuarios registrados.',
  },
  {
    n: 9,
    titulo: 'Ley aplicable',
    texto: 'Estos términos se rigen por las leyes de la República Argentina.',
  },
]

const PRIVACIDAD: Seccion[] = [
  {
    n: 1,
    titulo: 'Para qué los usamos',
    texto:
      'Para operar la plataforma (autenticación, permisos por rol, registros sanitarios de los animales), para coordinar la demo comercial cuando se completa el formulario de contacto, y para mejorar el producto durante esta etapa de desarrollo.',
  },
  {
    n: 2,
    titulo: 'Con quién se comparten',
    texto:
      'Compartimos datos únicamente en la medida necesaria para prestar el servicio, y nunca con fines comerciales: no los vendemos ni los cedemos. Dentro de la plataforma rigen los controles de acceso por rol, de modo que cada usuario ve solo la información que corresponde a su función dentro de su establecimiento. Fuera de ella, los destinatarios posibles son prestadores de servicios de alojamiento y almacenamiento en la nube, de autenticación y de procesamiento de pagos, limitados a lo necesario para prestar ese servicio. Estos destinatarios pueden encontrarse en jurisdicciones que no ofrecen un nivel de protección de los datos personales equivalente al de la República Argentina.',
  },
  {
    n: 3,
    titulo: 'Tus derechos',
    texto:
      `Podés solicitar acceso, rectificación, actualización o eliminación de tus datos personales escribiéndonos a ${EMAIL_EMPRESA}. Como usuario alcanzado por la Ley 25.326 de Protección de Datos Personales de la República Argentina, tenés derecho de acceso, rectificación, actualización y supresión de tus datos. Al iniciar sesión vas a encontrar un instructivo que explica cómo ejercer estos derechos dentro de la aplicación.`,
  },
  {
    n: 4,
    titulo: 'Cambios',
    texto:
      'Esta política puede actualizarse a medida que el producto evoluciona; la fecha de la última actualización figura al pie.',
  },
  {
    n: 5,
    titulo: 'Contacto',
    texto: `Para consultas sobre privacidad, escribinos a ${EMAIL_EMPRESA}.`,
  },
]

const CONTENIDO: Record<Tipo, { titulo: string; secciones: Seccion[]; actualizacion?: string }> = {
  terminos: { titulo: 'Términos y condiciones', secciones: TERMINOS },
  privacidad: {
    titulo: 'Política de privacidad',
    secciones: PRIVACIDAD,
    actualizacion: 'Última actualización: 2 de septiembre de 2026.',
  },
}

export default function LegalPage({ tipo }: { tipo: Tipo }) {
  const { titulo, secciones, actualizacion } = CONTENIDO[tipo]

  return (
    <div
      style={{
        backgroundColor: C.cream,
        color: C.charcoal,
        fontFamily: "'DM Sans', sans-serif",
        minHeight: '100svh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Barra superior */}
      <header
        style={{
          borderBottom: `1px solid ${C.goldSoft}`,
          backgroundColor: C.cream,
        }}
      >
        <div
          style={{
            maxWidth: '1100px',
            margin: '0 auto',
            padding: '0 20px',
            height: '72px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <Link to="/landing" aria-label="Volver a la landing">
            <img
              src="/logo_H_sin_fondo.png"
              onError={(e) => { e.currentTarget.src = '/logo-harasmanager.jpg' }}
              alt="HarasManager"
              style={{ height: 44, width: 'auto', objectFit: 'contain', display: 'block', mixBlendMode: 'multiply' }}
            />
          </Link>
          <Link
            to="/landing"
            style={{
              ...body,
              fontSize: '0.85rem',
              color: C.charcoal,
              textDecoration: 'none',
              opacity: 0.75,
            }}
          >
            ← Volver
          </Link>
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: '720px', margin: '0 auto', padding: '48px 24px 80px', width: '100%' }}>
        <h1 style={{ ...display, fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 700, margin: '0 0 8px', lineHeight: 1.2 }}>
          {titulo}
        </h1>
        <p style={{ ...body, fontSize: '0.8rem', color: '#9B8B7A', margin: '0 0 40px' }}>
          Borrador de referencia. Podés escribirnos a{' '}
          <a href={`mailto:${EMAIL_EMPRESA}`} style={{ color: C.gold }}>{EMAIL_EMPRESA}</a> por cualquier consulta.
        </p>

        {secciones.map((s) => (
          <section key={s.n} style={{ marginBottom: '28px' }}>
            <h2 style={{ ...display, fontSize: '1.35rem', fontWeight: 600, color: C.charcoal, margin: '0 0 8px', lineHeight: 1.3 }}>
              {s.n}. {s.titulo}
            </h2>
            <p style={{ ...body, fontSize: '0.95rem', color: '#4A403A', lineHeight: 1.75, margin: 0 }}>
              {s.texto}
            </p>
          </section>
        ))}

        {actualizacion && (
          <p style={{ ...body, fontSize: '0.82rem', color: '#9B8B7A', marginTop: '40px' }}>
            {actualizacion}
          </p>
        )}
      </main>

      <footer
        style={{
          backgroundColor: C.charcoal,
          padding: '32px 24px',
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px 28px', marginBottom: '16px' }}>
          <Link to="/legales/terminos" style={legalFooterLink}>Términos y condiciones</Link>
          <Link to="/legales/privacidad" style={legalFooterLink}>Política de privacidad</Link>
          <Link to="/landing" style={legalFooterLink}>Inicio</Link>
        </div>
        <p style={{ ...body, fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', margin: 0 }}>
          © 2026 HarasManager. Todos los derechos reservados.
        </p>
      </footer>
    </div>
  )
}

const legalFooterLink: React.CSSProperties = {
  ...body,
  fontSize: '0.8rem',
  color: 'rgba(255,255,255,0.55)',
  textDecoration: 'none',
}
