from routers.rotina_operacional import usuario_pode_baixa_administrativa_pertences
from schemas import PertenceRecolhidoBaixaAdministrativaLote
import pytest
from pydantic import ValidationError


def test_gestor_pode_baixa_administrativa_pertences():
    assert usuario_pode_baixa_administrativa_pertences({
        "perfil_acesso": "Gestor",
        "is_master": False,
    })


def test_tecnico_pode_baixa_administrativa_pertences():
    assert usuario_pode_baixa_administrativa_pertences({
        "perfil_acesso": "Técnico",
        "is_master": False,
    })


def test_manutencao_pode_baixa_administrativa_pertences():
    assert usuario_pode_baixa_administrativa_pertences({
        "perfil_acesso": "Manutenção",
        "is_manutencao": True,
    })


def test_orientador_nao_pode_baixa_administrativa_pertences():
    assert not usuario_pode_baixa_administrativa_pertences({
        "perfil_acesso": "Orientador",
        "is_master": False,
    })


def test_administrativo_nao_pode_baixa_administrativa_pertences():
    assert not usuario_pode_baixa_administrativa_pertences({
        "perfil_acesso": "Administrativo",
        "is_master": False,
    })


def test_payload_baixa_administrativa_lote_remove_duplicados():
    payload = PertenceRecolhidoBaixaAdministrativaLote(
        registro_ids=["a", "a", "b"],
        justificativa="Descarte de itens sem identificação após prazo.",
        destino="Descarte",
    )
    assert payload.registro_ids == ["a", "b"]


def test_payload_baixa_administrativa_lote_exige_selecao():
    with pytest.raises(ValidationError):
        PertenceRecolhidoBaixaAdministrativaLote(
            registro_ids=[],
            justificativa="Descarte de itens sem identificação após prazo.",
            destino="Descarte",
        )
