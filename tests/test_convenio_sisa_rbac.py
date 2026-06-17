from routers.conviventes import (
    usuario_pode_excluir_importacao_sisa,
    usuario_visivel_como_equipe,
)


def test_gestor_pode_excluir_importacao_sisa():
    usuario = {"perfil_acesso": "Gestor"}

    assert usuario_pode_excluir_importacao_sisa(usuario)


def test_manutencao_pode_excluir_importacao_sisa():
    usuario = {"perfil_acesso": "Manutenção"}

    assert usuario_pode_excluir_importacao_sisa(usuario)


def test_orientador_nao_pode_excluir_importacao_sisa():
    usuario = {"perfil_acesso": "Orientador"}

    assert not usuario_pode_excluir_importacao_sisa(usuario)


def test_orientador_aparece_como_equipe_operacional():
    usuario = {"perfil_acesso": "Orientador", "is_global": False}

    assert usuario_visivel_como_equipe(usuario)


def test_manutencao_nao_aparece_como_equipe_operacional():
    usuario = {"perfil_acesso": "Manutenção", "is_global": False}

    assert not usuario_visivel_como_equipe(usuario)


def test_usuario_global_nao_aparece_como_equipe_operacional():
    usuario = {"perfil_acesso": "Gestor", "is_global": True}

    assert not usuario_visivel_como_equipe(usuario)
