# Frontend — HarasManager

App web de gestión equina. React 19, Vite, TypeScript, Tailwind v4, Zustand y React Router v7.
Hoy habla directo con Supabase; el plan para que pase a usar una API propia, fase por fase,
está en [`docs/PLAN-MIGRACION-BACKEND.md`](../docs/PLAN-MIGRACION-BACKEND.md).

## Correr

Desde `frontend/`:

```bash
npm install
cp .env.example .env.local   # completar las variables (ver .env.example)
npm run dev                  # http://localhost:5173
```

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm run build` | Chequeo de tipos (`tsc -b`) y build de producción |
| `npm run lint` | ESLint |
| `npm test` | Tests (Vitest) |
| `npm run preview` | Sirve el build de producción |

## Dónde está cada cosa

Reglas del proyecto, estructura de carpetas y convenciones: [`CLAUDE.md`](../CLAUDE.md).
Arquitectura, modelo de datos y permisos: [`docs/SKILL.md`](../docs/SKILL.md).

- `src/services/`: todas las llamadas a Supabase
- `src/store/`, `src/hooks/`: estado y lógica de negocio (nunca en los componentes)
- `src/pages/`: una carpeta por sección
- `public/`: archivos estáticos (logos, video de la landing). Lo que no se usa no se versiona.

El deploy es en Vercel; su configuración (`vercel.json`, con la política de seguridad de
contenido) vive en esta carpeta.
