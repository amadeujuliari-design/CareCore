from revisao_texto import (
    _extrair_json_resposta,
    aplicar_correcoes_ortografia_frequente,
    corrigir_ortografia_frequente,
    sanitizar_aviso_para_usuario,
    sanitizar_ocorrencia_para_usuario,
)
from security import PERFIL_GESTOR, PERFIL_MANUTENCAO


def test_extrair_json_resposta():
    dados = _extrair_json_resposta('{"titulo": "Ofensa", "texto": "Relato corrigido."}')
    assert dados["titulo"] == "Ofensa"
    assert dados["texto"] == "Relato corrigido."


def test_sanitizar_ocorrencia_remove_original_para_orientador():
    usuario = {"perfil_acesso": "Orientador"}
    ocorrencia = {
        "motivo": "Título revisado",
        "descricao": "Texto revisado",
        "motivo_original": "TITULO",
        "descricao_original": "texto bruto",
        "interacoes": [{"mensagem": "Ok", "mensagem_original": "okkk"}],
    }

    resultado = sanitizar_ocorrencia_para_usuario(ocorrencia, usuario)

    assert "motivo_original" not in resultado
    assert "descricao_original" not in resultado
    assert "mensagem_original" not in resultado["interacoes"][0]


def test_sanitizar_ocorrencia_mantem_original_para_gestor():
    usuario = {"perfil_acesso": PERFIL_GESTOR}
    ocorrencia = {
        "motivo": "Título revisado",
        "descricao": "Texto revisado",
        "motivo_original": "TITULO",
        "descricao_original": "texto bruto",
    }

    resultado = sanitizar_ocorrencia_para_usuario(ocorrencia, usuario)

    assert resultado["motivo_original"] == "TITULO"
    assert resultado["descricao_original"] == "texto bruto"


def test_sanitizar_aviso_mantem_original_para_manutencao():
    usuario = {"perfil_acesso": PERFIL_MANUTENCAO, "is_manutencao": True}
    aviso = {
        "titulo": "Banheiro masculino",
        "mensagem": "Caixa quebrada.",
        "titulo_original": "banheiro masculino",
        "mensagem_original": "CAIXA QUEBRADA",
    }

    resultado = sanitizar_aviso_para_usuario(aviso, usuario)

    assert resultado["mensagem_original"] == "CAIXA QUEBRADA"


def test_corrigir_chingamentos_para_xingamentos():
    assert corrigir_ortografia_frequente("Houve chingamentos durante o jantar.") == (
        "Houve xingamentos durante o jantar."
    )
    assert corrigir_ortografia_frequente("Chingamentos") == "Xingamentos"


def test_aplicar_correcoes_ortografia_frequente_no_resultado():
    corrigido = aplicar_correcoes_ortografia_frequente({
        "titulo": "Chingamento",
        "texto": "Relato com chingou e chingando.",
    })
    assert corrigido["titulo"] == "Xingamento"
    assert corrigido["texto"] == "Relato com xingou e xingando."
