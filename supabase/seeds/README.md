# Seed de la base local

Datos **ficticios** para desarrollar sin tocar producción. Se cargan solos con
`supabase db reset` (ver `docs/ENTORNO-LOCAL.md`), en orden alfabético:

| Archivo | Qué carga |
|---|---|
| `01_catalogos.sql` | Catálogos globales copiados de prod (razas, pelajes, tipos de consulta, partes del cuerpo, roles, módulos, tag), el plan de suscripción de veterinarios y términos y condiciones de prueba |
| `02_usuarios.sql` | 2 sociedades, 12 usuarios en el Auth local, membresías, módulos, suscripciones y aceptación de términos |
| `03_campos_caballos.sql` | 7 campos, 34 caballos y los accesos de los veterinarios |
| `04_clinico_sanidad.sql` | Historial clínico, planes sanitarios, alertas, notificaciones y parámetros por sociedad |
| `05_torneos.sql` | Un torneo activo por haras |
| `06_centro_cria.sql` | Acciones y plazos de los vets, registros, flushings, embriones, transferencias y ecografías |
| `99_limpieza.sql` | Vacía la tabla de auditoría (los INSERT del seed la llenan) |

## Usuarios

Contraseña de **todos**: `Local-dev-2026` (solo vale en la base local).

| Email | Rol | Para probar |
|---|---|---|
| `superadmin.demo@haras.com` | superadmin | Panel de superadmin; ve todo |
| `admin.demo1@haras.com` | admin de Haras Demo 1 | Administración de un haras |
| `admin.demo2@haras.com` | admin de Haras Demo 2 | Aislamiento: no ve nada de Demo 1 |
| `vet.demo1@haras.com` | veterinario con membresía en Demo 1 | Suscripción activa, 6 caballos propios |
| `vet.demo2@haras.com` | veterinario con membresía en Demo 2 | Suscripción cancelada |
| `vet.independiente.demo@haras.com` | veterinario **sin** membresía | Solo accesos a caballos y a una sociedad; plazos propios |
| `jugador.demo1/2`, `peticero.demo1/2`, `piloto.demo1/2` | un usuario de cada rol por haras | Permisos por rol |

Los emails coinciden con los demo de producción, pero son cuentas distintas en otra
base: no se copió ningún hash ni dato de prod (salvo los catálogos).

## Reglas

- Los UUID son fijos (`a0000001-…` usuarios, `b0000001-…` sociedades, `d0000001-…`
  caballos, etc.) para poder referenciarlos entre archivos y desde los tests.
- Las fechas son relativas a hoy (`current_date - 42`): el calendario siempre tiene
  algo cercano.
- Los registros del centro de cría se cargan **llamando a las funciones de la app**
  (`registrar_acto_reproductivo`, `registrar_transferencia_embrionaria`,
  `registrar_resultado_ecografia`), no con INSERT directos, para que recordatorios,
  preñez y pipeline queden como los dejaría el uso real.
- Cada archivo califica los objetos con `public.`: el `search_path` de la sesión que
  carga el seed viene vacío.
- No poner acá datos reales de clientes ni credenciales: el repo es público.

## Lo que no está cargado

Propietarios y propiedades (modelo viejo), ventas, pagos de MercadoPago, leads y
fichas históricas. Se agregan cuando alguna fase del plan los necesite.
