"""Filtro por técnico no histórico da rotina."""

from routers.conviventes import (
    FILTRO_TECNICO_SEM_VINCULADO_ROTINA,
    _aplicar_filtros_historico_rotina,
)
from models import ConviventeDB, RegistroRotinaDB
from sqlalchemy.future import select


def test_filtro_tecnico_sem_vinculado_constante():
    assert FILTRO_TECNICO_SEM_VINCULADO_ROTINA == "__sem_tecnico__"


def test_aplicar_filtro_tecnico_especifico_adiciona_where():
    query = select(RegistroRotinaDB).join(
        ConviventeDB, RegistroRotinaDB.convivente_id == ConviventeDB.id
    )
    filtrada = _aplicar_filtros_historico_rotina(query=query, tecnico_id="tec-123")
    sql = str(filtrada.compile(compile_kwargs={"literal_binds": True}))
    assert "tecnico_id" in sql.lower()
    assert "tec-123" in sql


def test_aplicar_filtro_sem_tecnico_vinculado():
    query = select(RegistroRotinaDB).join(
        ConviventeDB, RegistroRotinaDB.convivente_id == ConviventeDB.id
    )
    filtrada = _aplicar_filtros_historico_rotina(
        query=query,
        tecnico_id=FILTRO_TECNICO_SEM_VINCULADO_ROTINA,
    )
    sql = str(filtrada.compile(compile_kwargs={"literal_binds": True}))
    assert "tecnico_id" in sql.lower()
    assert "is null" in sql.lower()
