from types import SimpleNamespace

from routers.chat import origem_pode_listar_destino, usuarios_podem_conversar


def _usuario(**kwargs):
    dados = {
        "id": kwargs.get("id", "u1"),
        "perfil_acesso": kwargs.get("perfil_acesso", "Técnico"),
        "instituicao_id": kwargs.get("instituicao_id", "proj-a"),
        "is_global": kwargs.get("is_global", False),
        "is_manutencao": kwargs.get("is_manutencao", False),
        "ativo": kwargs.get("ativo", True),
        "email": kwargs.get("email", "user@carecore.com"),
    }
    dados.update(kwargs)
    return SimpleNamespace(**dados)


def test_adm_global_lista_hq_gestor_e_adm_producao_mas_nao_tecnico():
    origem = _usuario(id="dheneffy", perfil_acesso="ADM Global", instituicao_id="sede")

    assert origem_pode_listar_destino(origem, _usuario(id="g1", perfil_acesso="Gestor", instituicao_id="proj-a"))
    assert origem_pode_listar_destino(
        origem, _usuario(id="ap1", perfil_acesso="ADM Produção", instituicao_id="proj-b")
    )
    assert origem_pode_listar_destino(
        origem, _usuario(id="ag2", perfil_acesso="ADM Global", instituicao_id="sede")
    )
    assert origem_pode_listar_destino(
        origem, _usuario(id="glob", perfil_acesso="Global", instituicao_id="sede", is_global=True)
    )
    assert origem_pode_listar_destino(
        origem, _usuario(id="man", perfil_acesso="Manutenção", instituicao_id="sede", is_manutencao=True)
    )
    assert not origem_pode_listar_destino(
        origem, _usuario(id="tec", perfil_acesso="Técnico", instituicao_id="proj-a")
    )
    assert not origem_pode_listar_destino(
        origem, _usuario(id="ofi", perfil_acesso="Oficineiro(a)", instituicao_id="proj-a")
    )
    assert not origem_pode_listar_destino(
        origem, _usuario(id="adm", perfil_acesso="Administrativo", instituicao_id="proj-a")
    )


def test_adm_producao_so_ve_gestor_do_proprio_projeto():
    origem = _usuario(id="ap", perfil_acesso="ADM Produção", instituicao_id="proj-a")

    assert origem_pode_listar_destino(
        origem, _usuario(id="g-a", perfil_acesso="Gestor", instituicao_id="proj-a")
    )
    assert not origem_pode_listar_destino(
        origem, _usuario(id="g-b", perfil_acesso="Gestor", instituicao_id="proj-b")
    )
    assert origem_pode_listar_destino(
        origem, _usuario(id="ap2", perfil_acesso="ADM Produção", instituicao_id="proj-b")
    )
    assert origem_pode_listar_destino(
        origem, _usuario(id="ag", perfil_acesso="ADM Global", instituicao_id="sede")
    )
    assert not origem_pode_listar_destino(
        origem, _usuario(id="tec", perfil_acesso="Técnico", instituicao_id="proj-a")
    )
    assert not origem_pode_listar_destino(
        origem, _usuario(id="ofi", perfil_acesso="Oficineiro(a)", instituicao_id="proj-a")
    )


def test_oficineiro_ve_colegas_do_projeto_e_nao_outros_projetos():
    origem = _usuario(id="ofi", perfil_acesso="Oficineiro(a)", instituicao_id="proj-a")

    assert origem_pode_listar_destino(
        origem, _usuario(id="tec", perfil_acesso="Técnico", instituicao_id="proj-a")
    )
    assert origem_pode_listar_destino(
        origem, _usuario(id="g-a", perfil_acesso="Gestor", instituicao_id="proj-a")
    )
    assert not origem_pode_listar_destino(
        origem, _usuario(id="tec-b", perfil_acesso="Técnico", instituicao_id="proj-b")
    )
    assert origem_pode_listar_destino(
        origem, _usuario(id="ag", perfil_acesso="ADM Global", instituicao_id="sede")
    )


def test_nao_lista_a_si_mesmo_nem_inativo():
    origem = _usuario(id="g1", perfil_acesso="Gestor", instituicao_id="proj-a")
    assert not origem_pode_listar_destino(origem, origem)
    assert not origem_pode_listar_destino(
        origem, _usuario(id="g2", perfil_acesso="Gestor", instituicao_id="proj-a", ativo=False)
    )


def test_adm_compras_lista_sede_e_nao_tecnico():
    origem = _usuario(id="ac", perfil_acesso="ADM Compras", instituicao_id="sede")
    assert origem_pode_listar_destino(origem, _usuario(id="g1", perfil_acesso="Gestor", instituicao_id="proj-a"))
    assert origem_pode_listar_destino(
        origem, _usuario(id="ap", perfil_acesso="ADM Pedidos", instituicao_id="proj-b")
    )
    assert not origem_pode_listar_destino(
        origem, _usuario(id="tec", perfil_acesso="Técnico", instituicao_id="proj-a")
    )


def test_adm_pedidos_so_ve_gestor_do_proprio_projeto():
    origem = _usuario(id="aped", perfil_acesso="ADM Pedidos", instituicao_id="proj-a")
    assert origem_pode_listar_destino(
        origem, _usuario(id="g-a", perfil_acesso="Gestor", instituicao_id="proj-a")
    )
    assert not origem_pode_listar_destino(
        origem, _usuario(id="g-b", perfil_acesso="Gestor", instituicao_id="proj-b")
    )
    assert not origem_pode_listar_destino(
        origem, _usuario(id="tec", perfil_acesso="Técnico", instituicao_id="proj-a")
    )


def test_criar_conversa_exige_origem_enxergar_destino():
    adm = _usuario(id="ag", perfil_acesso="ADM Global", instituicao_id="sede")
    gestor = _usuario(id="g", perfil_acesso="Gestor", instituicao_id="proj-a")
    oficineiro = _usuario(id="ofi", perfil_acesso="Oficineiro(a)", instituicao_id="proj-a")

    assert origem_pode_listar_destino(adm, gestor)
    assert not origem_pode_listar_destino(adm, oficineiro)
    assert usuarios_podem_conversar(adm, gestor)
    assert not origem_pode_listar_destino(adm, oficineiro)
