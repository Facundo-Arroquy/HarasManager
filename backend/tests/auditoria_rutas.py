"""Auditoría de las rutas de una app: ninguna puede quedar sin regla de acceso.

Es la red contra el olvido más caro de un backend multi-tenant: un endpoint que devuelve datos de
negocio sin decir quién puede verlos. En modo A las políticas RLS cubren ese olvido (devuelve
vacío en vez de filtrar), pero un endpoint así igual es un bug: este chequeo lo hace imposible de
mergear sin querer.

Reglas:
  1. Toda ruta declara al menos una dependency marcada con `@permiso`, salvo las de
     `RUTAS_PUBLICAS`.
  2. Si la ruta recibe `sociedad_id` (en el path o en el query), alguna de sus reglas es de
     ámbito `sociedad` o `superadmin`; si recibe `caballo_id`, de ámbito `caballo` o `superadmin`.
     Una ruta `/sociedades/{sociedad_id}/...` protegida solo con `require_usuario` es el error
     típico: parece protegida y cualquier usuario activo entra a la sociedad que quiera.
"""

from fastapi import FastAPI
from fastapi.dependencies.models import Dependant
from fastapi.routing import APIRoute

from app.api.permisos import AMBITO_DE_PERMISO, RUTAS_PUBLICAS

# parámetro de la ruta → ámbitos de regla que lo resuelven
AMBITOS_POR_PARAMETRO = {
    "sociedad_id": {"sociedad", "superadmin"},
    "caballo_id": {"caballo", "superadmin"},
}


def _ambitos(dependant: Dependant) -> set[str]:
    encontrados: set[str] = set()
    for sub in dependant.dependencies:
        if sub.call in AMBITO_DE_PERMISO:
            encontrados.add(AMBITO_DE_PERMISO[sub.call])
        encontrados |= _ambitos(sub)
    return encontrados


def auditar(app: FastAPI) -> list[str]:
    """Devuelve un texto por cada problema encontrado. Lista vacía = todo en orden."""
    problemas: list[str] = []
    for ruta in app.routes:
        if not isinstance(ruta, APIRoute):
            continue  # /docs, /openapi.json y similares los sirve FastAPI
        ambitos = _ambitos(ruta.dependant)
        parametros = {p.name for p in ruta.dependant.path_params} | {
            p.name for p in ruta.dependant.query_params
        }
        for metodo in sorted((ruta.methods or set()) - {"HEAD", "OPTIONS"}):
            if (metodo, ruta.path) in RUTAS_PUBLICAS:
                continue
            nombre = f"{metodo} {ruta.path}"
            if not ambitos:
                problemas.append(f"{nombre}: no declara ninguna dependency de autorización")
                continue
            for parametro, aceptados in AMBITOS_POR_PARAMETRO.items():
                if parametro in parametros and not (ambitos & aceptados):
                    tiene = ", ".join(sorted(ambitos))
                    pide = " o ".join(sorted(aceptados))
                    problemas.append(
                        f"{nombre}: recibe `{parametro}` pero sus reglas ({tiene}) "
                        f"no son de ámbito {pide}"
                    )
    return problemas
