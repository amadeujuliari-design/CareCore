from fastapi.params import Depends

from routers.quartos import atualizar_quarto, criar_quarto, excluir_quarto, listar_quartos
from security import exigir_tecnico_ou_gestor, get_usuario_logado


def _dependencia_usuario(funcao_rota):
    for default in funcao_rota.__defaults__ or ():
        if isinstance(default, Depends) and getattr(default, "dependency", None):
            dep = default.dependency
            if dep in {get_usuario_logado, exigir_tecnico_ou_gestor}:
                return dep
    return None


def test_listar_quartos_fica_liberado_para_usuario_logado():
    assert _dependencia_usuario(listar_quartos) is get_usuario_logado


def test_manutencao_quartos_exige_tecnico_ou_gestor():
    assert _dependencia_usuario(criar_quarto) is exigir_tecnico_ou_gestor
    assert _dependencia_usuario(atualizar_quarto) is exigir_tecnico_ou_gestor
    assert _dependencia_usuario(excluir_quarto) is exigir_tecnico_ou_gestor
