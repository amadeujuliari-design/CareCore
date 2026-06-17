from routers.conviventes import usuario_pode_excluir_importacao_sisa


def test_gestor_pode_excluir_importacao_sisa():
    usuario = {"perfil_acesso": "Gestor"}

    assert usuario_pode_excluir_importacao_sisa(usuario)


def test_manutencao_pode_excluir_importacao_sisa():
    usuario = {"perfil_acesso": "Manutenção"}

    assert usuario_pode_excluir_importacao_sisa(usuario)


def test_orientador_nao_pode_excluir_importacao_sisa():
    usuario = {"perfil_acesso": "Orientador"}

    assert not usuario_pode_excluir_importacao_sisa(usuario)
