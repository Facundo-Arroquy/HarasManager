from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base de los modelos. Son parciales: solo las columnas que el backend usa."""
