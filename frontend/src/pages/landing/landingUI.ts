// Paleta, tipografías y datos de contacto compartidos entre la landing pública
// (`LandingPage.tsx`) y las páginas legales (`pages/legales/LegalPage.tsx`).
// Espeja las CSS vars de `index.css` pero se mantiene acá en hex porque estas
// páginas usan estilos inline.

export const C = {
  charcoal: '#2C2C2C',
  gold: '#8B6914',
  goldLight: '#A67C1A',
  goldSoft: '#D4B483',
  goldPale: '#F5EDD8',
  cream: '#FAF8F3',
  offWhite: '#F0EDE6',
  white: '#FFFFFF',
}

export const display: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif" }
export const body: React.CSSProperties = { fontFamily: "'DM Sans', sans-serif" }

export const EMAILS = {
  tomas: 'tomas.perezzorraquin@harasmanager.com',
  facundo: 'facundo.arroquy@harasmanager.com',
}
