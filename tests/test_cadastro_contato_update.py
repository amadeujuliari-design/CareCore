import pytest
from pydantic import ValidationError

from schemas import CadastroContatoUpdate


def test_cadastro_contato_normaliza_telefone_email_e_uf():
    payload = CadastroContatoUpdate(
        telefone="(11) 3326-3305",
        email="  siat@aeb.org.br ",
        cep="01133-000",
        logradouro="Rua Armênia",
        numero="100",
        bairro="Bom Retiro",
        cidade="São Paulo",
        uf="sp",
    )

    assert payload.telefone == "1133263305"
    assert payload.email == "siat@aeb.org.br"
    assert payload.uf == "SP"
    assert payload.cep == "01133000"


def test_cadastro_contato_rejeita_email_invalido():
    with pytest.raises(ValidationError):
        CadastroContatoUpdate(email="sem-arroba")


def test_emails_adicionais_normaliza_lista():
    payload = CadastroContatoUpdate(
        emails_adicionais=" Financeiro@AEB.org.br ; gestao@aeb.org.br,financeiro@aeb.org.br ",
    )
    assert payload.emails_adicionais == "financeiro@aeb.org.br, gestao@aeb.org.br"


def test_emails_adicionais_rejeita_item_invalido():
    with pytest.raises(ValidationError):
        CadastroContatoUpdate(emails_adicionais="ok@aeb.org.br, invalido")
