from routers.rotina_operacional import usuario_pode_baixa_administrativa_pertences


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
