"""El oráculo: compara la implementación vieja (Postgres) con la nueva (el backend).

Para migrar un dominio sin cambiar su comportamiento, cada operación se corre dos veces sobre la
MISMA base y con el MISMO usuario, una por la función de Postgres de hoy y otra por el endpoint
nuevo, y se comparan dos cosas:

  - la respuesta, normalizada a algo comparable (un `RAISE` de Postgres y un 403 de la API son
    el mismo "denegado");
  - el estado final de la base (lo que cada una dejó escrito).

Cada corrida va en su propio SAVEPOINT y se deshace, así las dos arrancan del mismo estado y el
seed queda intacto. Los tests se escriben con `comparar(...)`; ver `tests/test_oraculo_ejemplo.py`.
"""

import json
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session


@contextmanager
def como_usuario(sesion: Session, usuario: UUID) -> Iterator[None]:
    """Corre lo que haya adentro con la identidad de `usuario`: role authenticated y su auth.uid().

    Es lo que hace el backend en cada request (modo A) y lo que hace Supabase cuando el front
    consulta directo: por eso sirve para ejecutar las funciones viejas "como las vería ese usuario".
    """
    claims = json.dumps({"sub": str(usuario), "role": "authenticated"})
    sesion.execute(
        text(
            "SELECT set_config('role', 'authenticated', true), "
            "set_config('request.jwt.claims', :claims, true)"
        ),
        {"claims": claims},
    )
    try:
        yield
    finally:
        try:
            sesion.execute(text("RESET ROLE"))
            sesion.execute(text("SELECT set_config('request.jwt.claims', '', true)"))
        except Exception:
            # Si adentro falló algo en Postgres la transacción quedó abortada y estas
            # sentencias también fallarían, tapando el error de verdad. No hace falta
            # deshacerlas: el ROLLBACK al SAVEPOINT las revierte (son locales a la transacción).
            pass


def como_administrador(sesion: Session) -> None:
    """Vuelve al rol de administrador (para leer el estado sin que RLS filtre)."""
    sesion.execute(text("RESET ROLE"))


@dataclass(frozen=True)
class Corrida:
    resultado: Any  # ya normalizado
    estado: Any


@dataclass(frozen=True)
class Comparacion:
    vieja: Corrida
    nueva: Corrida

    @property
    def iguales(self) -> bool:
        return self.vieja == self.nueva

    @property
    def diferencias(self) -> list[str]:
        """Qué difiere, en palabras, para que el mensaje del test sirva sin depurar."""
        out: list[str] = []
        if self.vieja.resultado != self.nueva.resultado:
            out.append(f"resultado: vieja={self.vieja.resultado!r} nueva={self.nueva.resultado!r}")
        if self.vieja.estado != self.nueva.estado:
            solo_vieja = [f for f in self.vieja.estado if f not in self.nueva.estado]
            solo_nueva = [f for f in self.nueva.estado if f not in self.vieja.estado]
            out.append(f"estado: solo en la vieja={solo_vieja!r} solo en la nueva={solo_nueva!r}")
        return out


def comparar[R, E](
    sesion: Session,
    *,
    usuario: UUID,
    vieja: Callable[[Session], R],
    nueva: Callable[[], E],
    estado: Callable[[Session], Any],
    normalizar_vieja: Callable[[R | BaseException], Any],
    normalizar_nueva: Callable[[E | BaseException], Any],
) -> Comparacion:
    """Corre `vieja` y `nueva` por separado, cada una desde el mismo estado, y las compara.

    - `vieja(sesion)`: llama a la función de Postgres. Corre como `usuario`.
    - `nueva()`: llama al endpoint (con un cliente cuya sesión es la misma `sesion`).
    - `estado(sesion)`: lee lo que importa del estado final, como administrador, en una forma
      comparable (lista ordenada de tuplas, sin timestamps ni ids generados).
    - `normalizar_*`: llevan la respuesta, o la excepción, a algo comparable entre las dos.
    """
    return Comparacion(
        vieja=_correr(sesion, lambda: _como(sesion, usuario, vieja), estado, normalizar_vieja),
        nueva=_correr(sesion, nueva, estado, normalizar_nueva),
    )


def _como[R](sesion: Session, usuario: UUID, operacion: Callable[[Session], R]) -> R:
    with como_usuario(sesion, usuario):
        return operacion(sesion)


def _correr[R](
    sesion: Session,
    operacion: Callable[[], R],
    estado: Callable[[Session], Any],
    normalizar: Callable[[Any], Any],
) -> Corrida:
    savepoint = sesion.begin_nested()
    try:
        try:
            resultado: Any = normalizar(operacion())
        except Exception as error:  # lo que falle también se compara
            savepoint.rollback()  # un error de Postgres deja la transacción abortada
            savepoint = sesion.begin_nested()
            resultado = normalizar(error)
        como_administrador(sesion)
        return Corrida(resultado=resultado, estado=estado(sesion))
    finally:
        savepoint.rollback()
