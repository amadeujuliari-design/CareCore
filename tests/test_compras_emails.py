from compras_emails import (
    CID_ASSINATURA,
    LARGURA_IMG_ASSINATURA,
    chave_assinatura_usuario,
    corpo_padrao_pedido_compra,
    corpo_padrao_solicitacao_cotacao,
    montar_corpo_html,
    preparar_envio_email_compras,
    sanitizar_corpo_email,
)
from compras_regras import (
    PERFIL_ADM_COMPRAS_INFRAESTRUTURA,
    PERFIL_ADM_COMPRAS_SUPRIMENTOS,
    perfil_adm_compras_sede,
)
from security import PERFIL_ADM_PEDIDOS


def test_assinatura_robson_infraestrutura():
    usuario = {"perfil_acesso": PERFIL_ADM_COMPRAS_INFRAESTRUTURA}
    assert perfil_adm_compras_sede(usuario) == "infraestrutura"
    assert chave_assinatura_usuario(usuario) == "robson"
    _, html, imagens = preparar_envio_email_compras(
        usuario=usuario,
        corpo="Prezado(a),\n\nPedido de teste.",
        padrao="padrao",
    )
    assert f'cid:{CID_ASSINATURA}' in html
    assert f'width="{LARGURA_IMG_ASSINATURA}"' in html
    assert "Robson" in html
    assert len(imagens) == 1
    assert imagens[0]["cid"] == CID_ASSINATURA
    assert imagens[0]["bytes"][:3] == b"\xff\xd8\xff"


def test_assinatura_isabella_suprimentos():
    usuario = {"perfil_acesso": PERFIL_ADM_COMPRAS_SUPRIMENTOS}
    assert perfil_adm_compras_sede(usuario) == "suprimentos"
    assert chave_assinatura_usuario(usuario) == "isabella"
    html = montar_corpo_html("Texto livre", usuario)
    assert "Isabella" in html
    assert "cid:assinatura-aeb" in html


def test_projeto_nao_recebe_cartao_aeb():
    usuario = {"perfil_acesso": PERFIL_ADM_PEDIDOS}
    assert perfil_adm_compras_sede(usuario) is None
    assert chave_assinatura_usuario(usuario) is None
    _, html, imagens = preparar_envio_email_compras(
        usuario=usuario,
        corpo=None,
        padrao=corpo_padrao_solicitacao_cotacao(projeto="Casa Porto", competencia="2026-09"),
    )
    assert "cid:" not in html
    assert imagens == []
    assert "Casa Porto" in html


def test_corpo_editado_escapa_html_e_respeita_limite():
    usuario = {"perfil_acesso": PERFIL_ADM_COMPRAS_SUPRIMENTOS}
    texto, html, _ = preparar_envio_email_compras(
        usuario=usuario,
        corpo='Urgente <script>alert(1)</script>\nPrazo: 5 dias.',
        padrao="padrao",
    )
    assert "<script>" in texto
    assert "&lt;script&gt;" in html
    assert "<script>" not in html
    assert sanitizar_corpo_email("   ", "padrao") == "padrao"
    longo = "x" * 9000
    assert len(sanitizar_corpo_email(longo, "p")) == 8000


def test_textos_padrao_pedido_compra():
    com_assinado = corpo_padrao_pedido_compra(projeto="AEB Sede", com_orcamento_assinado=True)
    sem_assinado = corpo_padrao_pedido_compra(projeto="AEB Sede", com_orcamento_assinado=False)
    assert "orçamento" in com_assinado.lower()
    assert "orçamento" not in sem_assinado.lower()
    assert "AEB Sede" in sem_assinado
