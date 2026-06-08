import logging

from audit_log import registrar_evento_auditoria


def test_audit_log_remove_campos_sensiveis(caplog):
    caplog.set_level(logging.INFO, logger="carecore.audit")

    registrar_evento_auditoria(
        "teste_sanitizacao",
        senha="Segredo@123",
        nova_senha="OutroSegredo@123",
        senha_hash="hash-interno",
        cpf="12345678900",
        rg="MG123456",
        token="jwt",
        access_token="bearer",
        usuario_alvo_id="usuario-1",
        perfil_acesso="Gestor",
    )

    registro = caplog.records[-1]
    contexto = registro.audit_context

    assert registro.audit_event == "teste_sanitizacao"
    assert contexto == {
        "usuario_alvo_id": "usuario-1",
        "perfil_acesso": "Gestor",
    }


def test_audit_log_inclui_contexto_seguro_do_ator(caplog):
    caplog.set_level(logging.INFO, logger="carecore.audit")

    registrar_evento_auditoria(
        "usuario_editado",
        usuario_atual={
            "sub": "ator-1",
            "perfil_acesso": "Gestor",
            "instituicao_id": "projeto-1",
            "organizacao_id": "org-1",
            "is_global": False,
            "cpf": "nao-deve-sair",
        },
        usuario_alvo_id="usuario-2",
        campos_alterados="nome,perfil_acesso",
    )

    registro = caplog.records[-1]

    assert registro.audit_event == "usuario_editado"
    assert registro.audit_context == {
        "usuario_alvo_id": "usuario-2",
        "campos_alterados": "nome,perfil_acesso",
        "ator_id": "ator-1",
        "ator_perfil": "Gestor",
        "instituicao_id": "projeto-1",
        "organizacao_id": "org-1",
        "ator_global": False,
    }


def test_audit_log_converte_valores_complexos_para_texto(caplog):
    caplog.set_level(logging.INFO, logger="carecore.audit")

    registrar_evento_auditoria(
        "evento_complexo",
        usuario_alvo_id="usuario-3",
        detalhes={"campo": "valor"},
    )

    contexto = caplog.records[-1].audit_context

    assert contexto["usuario_alvo_id"] == "usuario-3"
    assert contexto["detalhes"] == "{'campo': 'valor'}"
