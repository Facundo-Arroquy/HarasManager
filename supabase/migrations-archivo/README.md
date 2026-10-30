# Migraciones archivadas (historial hasta 2026-10-23)

Estas 137 migraciones **ya no se ejecutan**: el CLI de Supabase solo lee `supabase/migrations/`.

Se archivaron en la F1 de `docs/PLAN-MIGRACION-BACKEND.md` porque tenían drift
respecto a producción: había migraciones que nunca se aplicaron, cambios hechos
desde el SQL Editor y versiones distintas (prod tiene 115 aplicadas, con
timestamps propios del MCP; por ejemplo `20261023130000_registrar_acto_reproductivo_1pg`
en el repo es `20261023203259` en prod). Reconstruir la base local reproduciéndolas
daba un schema distinto al real.

El punto de partida ahora es `supabase/migrations/20261025000000_baseline_prod.sql`,
generado del schema vivo de producción.

**Para qué sirven acá:** historia y contexto (el porqué de cada cambio). `docs/SKILL.md`
y `docs/BACKEND-API-TASKS.md` citan estas migraciones por nombre.

**No agregar archivos nuevos acá.** Las migraciones nuevas van en `supabase/migrations/`.
