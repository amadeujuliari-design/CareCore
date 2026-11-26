"""Patrimônio a partir de pedido bem/imobilizado (linhas ou descrição livre)."""

from __future__ import annotations

import asyncio
from datetime import datetime
from types import SimpleNamespace

from compras_pedido_fluxo import (
    _descricao_patrimonio_fallback_pedido,
    _valor_centavos_patrimonio_pedido,
    garantir_patrimonio_imobilizado_apos_conclusao,
    resgatar_patrimonios_imobilizado_pendentes,
)
from compras_regras import (
    FONTE_TIPO_CONVENIO,
    PATRIMONIO_PROPRIEDADE_AEB,
    PATRIMONIO_PROPRIEDADE_PUBLICO,
    STATUS_AGUARDANDO_PAGAMENTO,
    STATUS_RECEBIDO,
    TIPO_ANEXO_ORCAMENTO_ASSINADO,
    TIPO_IMOBILIZADO,
)
from models import ComprasPatrimonioAnexoDB, ComprasPatrimonioDB


class _ScalarResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return list(self._rows)

    def scalar_one_or_none(self):
        return self._rows[0] if self._rows else None


class _ExecResult:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return _ScalarResult(self._rows)

    def scalar_one_or_none(self):
        return self._rows[0] if self._rows else None


class _FakeDb:
    def __init__(self, *, existentes=None, itens=None, fonte=None):
        self.added = []
        self._existentes = list(existentes or [])
        self._itens = list(itens or [])
        self._fonte = fonte
        self._exec_i = 0

    def add(self, obj):
        if isinstance(obj, ComprasPatrimonioDB) and not getattr(obj, "id", None):
            obj.id = f"bem-{len([x for x in self.added if isinstance(x, ComprasPatrimonioDB)]) + 1}"
        self.added.append(obj)

    async def flush(self):
        return None

    async def execute(self, _stmt):
        # Ordem típica: existentes → itens → (fonte opcional)
        passo = self._exec_i
        self._exec_i += 1
        if passo == 0:
            return _ExecResult(self._existentes)
        if passo == 1:
            return _ExecResult(self._itens)
        return _ExecResult([self._fonte] if self._fonte is not None else [])


def _pedido(**kwargs):
    base = dict(
        id="ped-imo-1",
        tipo=TIPO_IMOBILIZADO,
        organizacao_id="org-1",
        instituicao_id="inst-1",
        escopo_unidade="projeto",
        fonte_recurso_id=None,
        info_pedido="ROÇADEIRA LATERAL A GASOLINA RT52L-B",
        titulo="ROÇADEIRA",
        valor_estimado_centavos=None,
        status=STATUS_RECEBIDO,
    )
    base.update(kwargs)
    return SimpleNamespace(**base)


def _nota(**kwargs):
    base = dict(
        tipo_nf="produto",
        numero="12345",
        chave_acesso=None,
        anexo_id="anexo-nf-1",
    )
    base.update(kwargs)
    return SimpleNamespace(**base)


def _anexo_nf():
    return SimpleNamespace(
        id="anexo-nf-1",
        ativo=True,
        tipo="nf_pdf",
        nome_arquivo="nf.pdf",
        caminho_arquivo="/storage/nf.pdf",
        content_type="application/pdf",
        tamanho_bytes=10,
    )


def _cotacao_escolhida(valor=150000):
    return SimpleNamespace(escolhida=True, valor_centavos=valor, ativa=True)


def _patch_helpers(monkeypatch, *, notas=None, cotacoes=None, anexos=None):
    import compras_pedido_fluxo as fluxo

    async def _notas(_db, _pid):
        return list(notas if notas is not None else [_nota()])

    async def _cots(_db, _pid):
        return list(cotacoes if cotacoes is not None else [_cotacao_escolhida()])

    async def _anexos(_db, _pid):
        return list(anexos if anexos is not None else [_anexo_nf()])

    monkeypatch.setattr(fluxo, "_notas_pedido", _notas)
    monkeypatch.setattr(fluxo, "_cotacoes_ativas", _cots)
    monkeypatch.setattr(fluxo, "_anexos_pedido", _anexos)


def test_fallback_descricao_prioriza_info_pedido():
    pedido = _pedido(info_pedido="DESC DETALHADA", titulo="TITULO")
    assert _descricao_patrimonio_fallback_pedido(pedido) == "DESC DETALHADA"
    assert _descricao_patrimonio_fallback_pedido(_pedido(info_pedido="", titulo="SO TITULO")) == "SO TITULO"
    assert _descricao_patrimonio_fallback_pedido(_pedido(info_pedido="  ", titulo="")) == ""


def test_valor_usa_cotacao_depois_estimado():
    pedido = _pedido(valor_estimado_centavos=9000)
    assert _valor_centavos_patrimonio_pedido(pedido, _cotacao_escolhida(55000)) == 55000
    assert _valor_centavos_patrimonio_pedido(pedido, None) == 9000
    assert _valor_centavos_patrimonio_pedido(_pedido(valor_estimado_centavos=None), None) is None


def test_cria_patrimonio_pela_descricao_sem_linhas(monkeypatch):
    _patch_helpers(monkeypatch)
    db = _FakeDb(existentes=[], itens=[])
    pedido = _pedido()

    criados = asyncio.run(garantir_patrimonio_imobilizado_apos_conclusao(db, pedido))
    assert criados == 1
    bens = [x for x in db.added if isinstance(x, ComprasPatrimonioDB)]
    assert len(bens) == 1
    bem = bens[0]
    assert bem.descricao == "ROÇADEIRA LATERAL A GASOLINA RT52L-B"
    assert bem.pedido_id == "ped-imo-1"
    assert bem.pedido_item_id is None
    assert bem.valor_centavos == 150000
    assert bem.documento_nf == "12345"
    assert bem.propriedade == PATRIMONIO_PROPRIEDADE_AEB
    assert bem.instituicao_id == "inst-1"
    anexos = [x for x in db.added if isinstance(x, ComprasPatrimonioAnexoDB)]
    assert len(anexos) == 1
    assert anexos[0].patrimonio_id == bem.id


def test_nao_recria_se_ja_existe_patrimonio(monkeypatch):
    _patch_helpers(monkeypatch)
    db = _FakeDb(existentes=["bem-ja"], itens=[])
    criados = asyncio.run(garantir_patrimonio_imobilizado_apos_conclusao(db, _pedido()))
    assert criados == 0
    assert not any(isinstance(x, ComprasPatrimonioDB) for x in db.added)


def test_ignora_tipo_nao_imobilizado(monkeypatch):
    _patch_helpers(monkeypatch)
    db = _FakeDb()
    criados = asyncio.run(
        garantir_patrimonio_imobilizado_apos_conclusao(db, _pedido(tipo="consumo"))
    )
    assert criados == 0


def test_sem_nf_nao_cria(monkeypatch):
    _patch_helpers(monkeypatch, notas=[])
    db = _FakeDb(existentes=[], itens=[])
    criados = asyncio.run(garantir_patrimonio_imobilizado_apos_conclusao(db, _pedido()))
    assert criados == 0


def test_com_linhas_cria_um_bem_por_item(monkeypatch):
    _patch_helpers(monkeypatch, cotacoes=[_cotacao_escolhida(100000)])
    itens = [
        SimpleNamespace(id="i1", descricao="TABLET A", categoria_id="cat-1"),
        SimpleNamespace(id="i2", descricao="TABLET B", categoria_id="cat-1"),
    ]
    db = _FakeDb(existentes=[], itens=itens)
    criados = asyncio.run(garantir_patrimonio_imobilizado_apos_conclusao(db, _pedido(info_pedido="IGNORAR")))
    assert criados == 2
    bens = [x for x in db.added if isinstance(x, ComprasPatrimonioDB)]
    assert [b.descricao for b in bens] == ["TABLET A", "TABLET B"]
    assert bens[0].valor_centavos == 50000
    assert bens[0].pedido_item_id == "i1"


def test_linhas_vazias_de_descricao_cai_no_fallback(monkeypatch):
    _patch_helpers(monkeypatch)
    itens = [SimpleNamespace(id="i1", descricao="  ", categoria_id=None)]
    db = _FakeDb(existentes=[], itens=itens)
    criados = asyncio.run(garantir_patrimonio_imobilizado_apos_conclusao(db, _pedido()))
    assert criados == 1
    bem = next(x for x in db.added if isinstance(x, ComprasPatrimonioDB))
    assert bem.descricao.startswith("ROÇADEIRA")


def test_fonte_convenio_marca_publico(monkeypatch):
    _patch_helpers(monkeypatch)
    fonte = SimpleNamespace(tipo=FONTE_TIPO_CONVENIO)
    db = _FakeDb(existentes=[], itens=[], fonte=fonte)
    pedido = _pedido(fonte_recurso_id="fonte-1")
    asyncio.run(garantir_patrimonio_imobilizado_apos_conclusao(db, pedido))
    bem = next(x for x in db.added if isinstance(x, ComprasPatrimonioDB))
    assert bem.propriedade == PATRIMONIO_PROPRIEDADE_PUBLICO


def test_valor_pelo_estimado_sem_cotacao(monkeypatch):
    _patch_helpers(monkeypatch, cotacoes=[])
    db = _FakeDb(existentes=[], itens=[])
    pedido = _pedido(valor_estimado_centavos=22200)
    asyncio.run(garantir_patrimonio_imobilizado_apos_conclusao(db, pedido))
    bem = next(x for x in db.added if isinstance(x, ComprasPatrimonioDB))
    assert bem.valor_centavos == 22200


def test_documento_nf_usa_chave_se_sem_numero(monkeypatch):
    _patch_helpers(
        monkeypatch,
        notas=[_nota(numero=None, chave_acesso="3526CHAVE")],
    )
    db = _FakeDb(existentes=[], itens=[])
    asyncio.run(garantir_patrimonio_imobilizado_apos_conclusao(db, _pedido()))
    bem = next(x for x in db.added if isinstance(x, ComprasPatrimonioDB))
    assert bem.documento_nf == "3526CHAVE"


def test_copia_orcamento_assinado_alem_da_nf(monkeypatch):
    orc = SimpleNamespace(
        id="anexo-orc-1",
        ativo=True,
        tipo=TIPO_ANEXO_ORCAMENTO_ASSINADO,
        nome_arquivo="orc.pdf",
        caminho_arquivo="/storage/orc.pdf",
        content_type="application/pdf",
        tamanho_bytes=20,
    )
    _patch_helpers(monkeypatch, anexos=[_anexo_nf(), orc])
    db = _FakeDb(existentes=[], itens=[])
    asyncio.run(garantir_patrimonio_imobilizado_apos_conclusao(db, _pedido()))
    anexos = [x for x in db.added if isinstance(x, ComprasPatrimonioAnexoDB)]
    assert len(anexos) == 2
    nomes = {a.nome_arquivo for a in anexos}
    assert nomes == {"nf.pdf", "orc.pdf"}


def test_resgatar_so_concluidos_imobilizado(monkeypatch):
    _patch_helpers(monkeypatch)
    calls = []

    async def _garantir(_db, pedido):
        calls.append(pedido.id)
        return 1

    import compras_pedido_fluxo as fluxo
    monkeypatch.setattr(fluxo, "garantir_patrimonio_imobilizado_apos_conclusao", _garantir)

    pedidos = [
        _pedido(id="ok", status=STATUS_RECEBIDO),
        _pedido(id="pago", status=STATUS_AGUARDANDO_PAGAMENTO),
        _pedido(id="consumo", tipo="consumo", status=STATUS_RECEBIDO),
    ]
    total = asyncio.run(resgatar_patrimonios_imobilizado_pendentes(_FakeDb(), {"organizacao_id": "org-1"}, pedidos))
    assert total == 1
    assert calls == ["ok"]


def test_sem_descricao_e_sem_linhas_nao_cria(monkeypatch):
    _patch_helpers(monkeypatch)
    db = _FakeDb(existentes=[], itens=[])
    criados = asyncio.run(
        garantir_patrimonio_imobilizado_apos_conclusao(
            db,
            _pedido(info_pedido="", titulo=""),
        )
    )
    assert criados == 0
