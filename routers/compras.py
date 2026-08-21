"""API do modulo Compras."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from compras_itens_consumo_planilha import extrair_itens_consumo
from compras_pedido_fluxo import (
    confirmar_revisao_itens_pedido,
    desativar_cotacao,
    enviar_email_fornecedor,
    enviar_solicitacao_cotacao_fornecedores,
    gerar_pedido_compra,
    ler_bytes_anexo,
    registrar_comunicacao_pedido,
    registrar_nota_fiscal,
    reabrir_pedido,
    reprovar_pedido,
    upload_anexo_pedido,
)
from compras_service import (
    aprovar_sede,
    aprovar_unidade,
    cancelar_pedido,
    criar_pedido,
    excluir_rascunho_pedido,
    definir_modulo_ativo,
    escolher_cotacao,
    enviar_fornecedor,
    exigir_modulo,
    garantir_cadastros_padrao,
    listar_categorias,
    listar_fontes,
    listar_fornecedores,
    listar_itens_consumo,
    listar_janelas,
    listar_patrimonio,
    listar_pedidos,
    listar_unidades,
    liberar_unidade_janela,
    obter_pedido,
    org_compras_ativo,
    publicar_janelas_ano,
    receber_pedido,
    registrar_cotacao,
    relatorio_economia,
    salvar_categoria,
    salvar_fonte,
    salvar_fornecedor,
    salvar_janela,
    excluir_janela,
    salvar_item_consumo,
    importar_itens_consumo,
    sanear_itens_consumo,
    salvar_patrimonio,
    atualizar_rascunho,
    _nome_organizacao,
    _nomes_instituicao,
    _serializar_patrimonio,
    serializar_pedido,
    submeter_pedido,
    substituir_itens,
    sugestao_janela,
    _mapa_projetos_fornecedores,
    _mapa_categorias_fornecedores,
    _serializar_fornecedor,
)
from compras_regras import usuario_e_sede_compras, usuario_ve_modulo_compras
from database import get_db
from security import get_usuario_logado

router = APIRouter(prefix="/api/compras", tags=["Compras"])


class PedidoItemIn(BaseModel):
    descricao: str
    quantidade: float = 1
    unidade_medida: Optional[str] = None
    marca_preferencial: Optional[str] = None
    categoria_id: Optional[str] = None
    observacao: Optional[str] = None
    catalogo_item_id: Optional[str] = None
    embalagem: Optional[str] = None


class PedidoCreateIn(BaseModel):
    tipo: str = "consumo"
    competencia: Optional[str] = None
    escopo_unidade: Optional[str] = "projeto"
    instituicao_id: Optional[str] = None
    fonte_recurso_id: Optional[str] = None
    observacao: Optional[str] = None
    data_envio_prevista: Optional[str] = None
    envio_automatico: Optional[bool] = False
    itens: list[PedidoItemIn] = Field(default_factory=list)


class PedidoRascunhoIn(BaseModel):
    data_envio_prevista: Optional[str] = None
    envio_automatico: Optional[bool] = None


class PedidoItensIn(BaseModel):
    itens: list[PedidoItemIn] = Field(default_factory=list)


class CotacaoIn(BaseModel):
    fornecedor_id: Optional[str] = None
    fornecedor_nome: Optional[str] = None
    valor_centavos: Optional[int] = None
    valor_reais: Optional[float] = None
    observacao: Optional[str] = None


class RecebimentoItemIn(BaseModel):
    id: str
    quantidade_recebida: Optional[float] = None
    validade_lote: Optional[str] = None


class RecebimentoIn(BaseModel):
    observacao: Optional[str] = None
    divergencia: bool = False
    documento_nf: Optional[str] = None
    itens: list[RecebimentoItemIn] = Field(default_factory=list)


class CancelarIn(BaseModel):
    motivo: Optional[str] = None


class ComunicacaoIn(BaseModel):
    tipo: str
    texto: str
    cotacao_id: Optional[str] = None


class ReprovarIn(BaseModel):
    motivo: str


class DesativarCotacaoIn(BaseModel):
    motivo: Optional[str] = None


class SolicitacaoCotacaoIn(BaseModel):
    fornecedor_ids: list[str] = Field(default_factory=list, min_length=1)


class JanelaIn(BaseModel):
    competencia: str
    data_inicio: str
    data_fim: str


class JanelaAnoIn(BaseModel):
    ano: int
    semana: int = Field(default=2, ge=1, le=4)


class LiberacaoIn(BaseModel):
    instituicao_id: str
    motivo: Optional[str] = None


class NomeCadastroIn(BaseModel):
    nome: str
    ativo: Optional[bool] = True


class FonteIn(NomeCadastroIn):
    tipo: Optional[str] = None
    vigencia_inicio: Optional[str] = None
    vigencia_fim: Optional[str] = None


class FornecedorIn(BaseModel):
    nome: str
    categoria_id: Optional[str] = None
    cnpj: Optional[str] = None
    segmento: Optional[str] = None
    contato: Optional[str] = None
    telefone: Optional[str] = None
    email: Optional[str] = None
    email_empresa: Optional[str] = None
    cep: Optional[str] = None
    logradouro: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    uf: Optional[str] = None
    atende_geral: Optional[bool] = True
    prazo_entrega_dias: Optional[int] = None
    categoria_ids: Optional[list[str]] = None
    projeto_ids: Optional[list[str]] = None
    ativo: Optional[bool] = True
    bloqueado: Optional[bool] = False
    observacao: Optional[str] = None


class PatrimonioIn(BaseModel):
    descricao: str
    escopo_unidade: Optional[str] = "projeto"
    instituicao_id: Optional[str] = None
    numero_etiqueta: Optional[str] = None
    localizacao: Optional[str] = None
    departamento: Optional[str] = None
    propriedade: Optional[str] = "aeb"
    origem: Optional[str] = "inventario"
    forma_aquisicao: Optional[str] = None
    documento_nf: Optional[str] = None
    data_aquisicao: Optional[str] = None
    valor_centavos: Optional[int] = None
    valor_reais: Optional[str] = None
    situacao: Optional[str] = "bom"
    motivo_baixa: Optional[str] = None
    data_baixa: Optional[str] = None
    observacao: Optional[str] = None
    categoria_id: Optional[str] = None


class ModuloIn(BaseModel):
    ativo: bool


async def _ctx(db: AsyncSession, usuario: dict) -> None:
    await exigir_modulo(db, usuario)
    org_id = usuario.get("organizacao_id")
    if org_id:
        await garantir_cadastros_padrao(db, org_id)


@router.get("/me/acesso")
async def me_acesso(
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    org_id = usuario_atual.get("organizacao_id")
    ativo = await org_compras_ativo(db, org_id) if org_id else False
    permitido = usuario_ve_modulo_compras(
        perfil=usuario_atual.get("perfil_acesso") or "",
        compras_modulo_ativo=bool(usuario_atual.get("compras_modulo_ativo")),
        is_manutencao=bool(usuario_atual.get("is_manutencao")),
        org_compras_ativo=ativo,
    )
    sede = usuario_e_sede_compras(
        perfil=usuario_atual.get("perfil_acesso") or "",
        is_manutencao=bool(usuario_atual.get("is_manutencao")),
    )
    return {
        "permitido": permitido,
        "compras_ativo": ativo,
        "sede": sede,
        "pode_ativar": sede
        or bool(usuario_atual.get("is_global"))
        or (usuario_atual.get("perfil_acesso") == "Global"),
        "compras_modulo_ativo": bool(usuario_atual.get("compras_modulo_ativo")),
        "perfil": usuario_atual.get("perfil_acesso"),
        "instituicao_id": usuario_atual.get("instituicao_id"),
    }


@router.patch("/modulo")
async def patch_modulo(
    payload: ModuloIn,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    resultado = await definir_modulo_ativo(db, usuario_atual, payload.ativo)
    await db.commit()
    return resultado


@router.get("/janela/sugestao")
async def get_sugestao_janela(
    competencia: str = Query(...),
    semana: Optional[int] = Query(default=None, ge=1, le=4),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await exigir_modulo(db, usuario_atual)
    return sugestao_janela(competencia, semana=semana)


@router.get("/unidades")
async def get_unidades(
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    return {"itens": await listar_unidades(db, usuario_atual["organizacao_id"])}


@router.get("/janelas")
async def get_janelas(
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    return await listar_janelas(db, usuario_atual)


@router.post("/janelas")
async def post_janela(
    payload: JanelaIn,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    janela = await salvar_janela(db, usuario_atual, payload.model_dump())
    await db.commit()
    await db.refresh(janela)
    return {
        "id": janela.id,
        "competencia": janela.competencia,
        "data_inicio": janela.data_inicio.isoformat(),
        "data_fim": janela.data_fim.isoformat(),
    }


@router.post("/janelas/ano")
async def post_janelas_ano(
    payload: JanelaAnoIn,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    resultado = await publicar_janelas_ano(db, usuario_atual, payload.ano, semana=payload.semana)
    await db.commit()
    return resultado


@router.delete("/janelas/{janela_id}")
async def delete_janela(
    janela_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    await excluir_janela(db, usuario_atual, janela_id)
    await db.commit()
    return {"ok": True}


@router.post("/janelas/{janela_id}/liberar")
async def post_liberar(
    janela_id: str,
    payload: LiberacaoIn,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    lib = await liberar_unidade_janela(
        db, usuario_atual, janela_id, payload.instituicao_id, payload.motivo
    )
    await db.commit()
    return {"id": lib.id, "instituicao_id": lib.instituicao_id, "motivo": lib.motivo}


@router.get("/categorias")
async def get_categorias(
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    return {"itens": await listar_categorias(db, usuario_atual)}


@router.post("/categorias")
async def post_categoria(
    payload: NomeCadastroIn,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    row = await salvar_categoria(db, usuario_atual, payload.model_dump())
    await db.commit()
    await db.refresh(row)
    return {"id": row.id, "nome": row.nome, "ativo": row.ativo}


@router.put("/categorias/{categoria_id}")
async def put_categoria(
    categoria_id: str,
    payload: NomeCadastroIn,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    row = await salvar_categoria(db, usuario_atual, payload.model_dump(), categoria_id)
    await db.commit()
    return {"id": row.id, "nome": row.nome, "ativo": row.ativo}


class ItemConsumoIn(BaseModel):
    descricao: str
    categoria_id: Optional[str] = None
    unidade_medida: Optional[str] = None
    embalagem: Optional[str] = None
    marca_preferencial: Optional[str] = None
    sinonimos: Optional[str] = None
    fator_embalagem: Optional[float] = None
    perecivel: Optional[bool] = None
    equivalente_item_id: Optional[str] = None
    observacao: Optional[str] = None
    ativo: Optional[bool] = True


@router.get("/itens-consumo")
async def get_itens_consumo(
    ativos: Optional[bool] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    return {"itens": await listar_itens_consumo(db, usuario_atual, ativos)}


async def _resposta_item_consumo(db, usuario, row) -> dict:
    cats = await listar_categorias(db, usuario)
    nomes = {c["id"]: c["nome"] for c in cats}
    return {
        "id": row.id,
        "categoria_id": row.categoria_id,
        "categoria_nome": nomes.get(row.categoria_id) if row.categoria_id else None,
        "descricao": row.descricao,
        "chave": row.chave,
        "unidade_medida": row.unidade_medida,
        "embalagem": getattr(row, "embalagem", None),
        "marca_preferencial": row.marca_preferencial,
        "sinonimos": getattr(row, "sinonimos", None),
        "fator_embalagem": getattr(row, "fator_embalagem", None),
        "perecivel": bool(getattr(row, "perecivel", False)),
        "equivalente_item_id": getattr(row, "equivalente_item_id", None),
        "observacao": row.observacao,
        "ativo": bool(row.ativo),
    }


@router.post("/itens-consumo")
async def post_item_consumo(
    payload: ItemConsumoIn,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    row = await salvar_item_consumo(db, usuario_atual, payload.model_dump())
    await db.commit()
    await db.refresh(row)
    return await _resposta_item_consumo(db, usuario_atual, row)


@router.put("/itens-consumo/{item_id}")
async def put_item_consumo(
    item_id: str,
    payload: ItemConsumoIn,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    row = await salvar_item_consumo(db, usuario_atual, payload.model_dump(), item_id)
    await db.commit()
    await db.refresh(row)
    return await _resposta_item_consumo(db, usuario_atual, row)


@router.post("/itens-consumo/importar")
async def post_importar_itens_consumo(
    arquivo: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    conteudo = await arquivo.read()
    linhas = extrair_itens_consumo(conteudo, arquivo.filename or "")
    if not linhas:
        raise HTTPException(status_code=400, detail="Nenhum item encontrado na planilha.")
    resumo = await importar_itens_consumo(db, usuario_atual, linhas)
    await db.commit()
    return resumo


@router.post("/itens-consumo/sanear")
async def post_sanear_itens_consumo(
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    resumo = await sanear_itens_consumo(db, usuario_atual)
    await db.commit()
    return resumo


@router.get("/fontes")
async def get_fontes(
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    return {"itens": await listar_fontes(db, usuario_atual)}


@router.post("/fontes")
async def post_fonte(
    payload: FonteIn,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    row = await salvar_fonte(db, usuario_atual, payload.model_dump())
    await db.commit()
    await db.refresh(row)
    return {"id": row.id, "nome": row.nome, "ativo": row.ativo, "tipo": getattr(row, "tipo", None)}


@router.put("/fontes/{fonte_id}")
async def put_fonte(
    fonte_id: str,
    payload: FonteIn,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    row = await salvar_fonte(db, usuario_atual, payload.model_dump(), fonte_id)
    await db.commit()
    return {"id": row.id, "nome": row.nome, "ativo": row.ativo}


@router.get("/fornecedores")
async def get_fornecedores(
    ativos: Optional[bool] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    return {"itens": await listar_fornecedores(db, usuario_atual, ativos)}


async def _resposta_fornecedor(db, row) -> dict:
    mapa = await _mapa_projetos_fornecedores(db, [row.id])
    cats = await _mapa_categorias_fornecedores(db, [row.id])
    return _serializar_fornecedor(row, mapa.get(row.id, []), cats.get(row.id, []))


@router.post("/fornecedores")
async def post_fornecedor(
    payload: FornecedorIn,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    row = await salvar_fornecedor(db, usuario_atual, payload.model_dump())
    await db.commit()
    await db.refresh(row)
    return await _resposta_fornecedor(db, row)


@router.put("/fornecedores/{fornecedor_id}")
async def put_fornecedor(
    fornecedor_id: str,
    payload: FornecedorIn,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    row = await salvar_fornecedor(db, usuario_atual, payload.model_dump(), fornecedor_id)
    await db.commit()
    await db.refresh(row)
    return await _resposta_fornecedor(db, row)


@router.get("/pedidos")
async def get_pedidos(
    competencia: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None, alias="status_pedido"),
    tipo: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    return {
        "itens": await listar_pedidos(
            db, usuario_atual, competencia=competencia, status_filtro=status, tipo=tipo
        )
    }


@router.post("/pedidos")
async def post_pedido(
    payload: PedidoCreateIn,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    pedido = await criar_pedido(db, usuario_atual, payload.model_dump())
    await db.commit()
    await db.refresh(pedido)
    return await serializar_pedido(db, pedido, incluir_detalhe=True)


@router.get("/pedidos/{pedido_id}")
async def get_pedido(
    pedido_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    pedido = await obter_pedido(db, usuario_atual, pedido_id)
    return await serializar_pedido(db, pedido, incluir_detalhe=True)


@router.patch("/pedidos/{pedido_id}")
async def patch_pedido(
    pedido_id: str,
    payload: PedidoRascunhoIn,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    pedido = await obter_pedido(db, usuario_atual, pedido_id)
    await atualizar_rascunho(db, usuario_atual, pedido, payload.model_dump(exclude_unset=True))
    await db.commit()
    await db.refresh(pedido)
    return await serializar_pedido(db, pedido, incluir_detalhe=True)


@router.put("/pedidos/{pedido_id}/itens")
async def put_itens(
    pedido_id: str,
    payload: PedidoItensIn,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    pedido = await obter_pedido(db, usuario_atual, pedido_id)
    await substituir_itens(db, usuario_atual, pedido, [i.model_dump() for i in payload.itens])
    await db.commit()
    return await serializar_pedido(db, pedido, incluir_detalhe=True)


@router.post("/pedidos/{pedido_id}/submeter")
async def post_submeter(
    pedido_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    pedido = await obter_pedido(db, usuario_atual, pedido_id)
    await submeter_pedido(db, usuario_atual, pedido)
    await db.commit()
    return await serializar_pedido(db, pedido, incluir_detalhe=True)


@router.post("/pedidos/{pedido_id}/cotacoes")
async def post_cotacao(
    pedido_id: str,
    payload: CotacaoIn,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    pedido = await obter_pedido(db, usuario_atual, pedido_id)
    await registrar_cotacao(db, usuario_atual, pedido, payload.model_dump())
    await db.commit()
    return await serializar_pedido(db, pedido, incluir_detalhe=True)


@router.post("/pedidos/{pedido_id}/cotacoes/{cotacao_id}/escolher")
async def post_escolher(
    pedido_id: str,
    cotacao_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    pedido = await obter_pedido(db, usuario_atual, pedido_id)
    await escolher_cotacao(db, usuario_atual, pedido, cotacao_id)
    await db.commit()
    return await serializar_pedido(db, pedido, incluir_detalhe=True)


@router.post("/pedidos/{pedido_id}/aprovar-unidade")
async def post_aprovar_unidade(
    pedido_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    pedido = await obter_pedido(db, usuario_atual, pedido_id)
    await aprovar_unidade(db, usuario_atual, pedido)
    await db.commit()
    return await serializar_pedido(db, pedido, incluir_detalhe=True)


@router.post("/pedidos/{pedido_id}/aprovar-sede")
async def post_aprovar_sede(
    pedido_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    pedido = await obter_pedido(db, usuario_atual, pedido_id)
    await aprovar_sede(db, usuario_atual, pedido)
    await db.commit()
    return await serializar_pedido(db, pedido, incluir_detalhe=True)


@router.post("/pedidos/{pedido_id}/enviar")
async def post_enviar(
    pedido_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    pedido = await obter_pedido(db, usuario_atual, pedido_id)
    await enviar_fornecedor(db, usuario_atual, pedido)
    await db.commit()
    return await serializar_pedido(db, pedido, incluir_detalhe=True)


@router.post("/pedidos/{pedido_id}/receber")
async def post_receber(
    pedido_id: str,
    payload: RecebimentoIn,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    pedido = await obter_pedido(db, usuario_atual, pedido_id)
    await receber_pedido(db, usuario_atual, pedido, payload.model_dump())
    await db.commit()
    return await serializar_pedido(db, pedido, incluir_detalhe=True)


@router.post("/pedidos/{pedido_id}/cancelar")
async def post_cancelar(
    pedido_id: str,
    payload: CancelarIn,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    pedido = await obter_pedido(db, usuario_atual, pedido_id)
    await cancelar_pedido(db, usuario_atual, pedido, payload.motivo)
    await db.commit()
    return await serializar_pedido(db, pedido, incluir_detalhe=True)


@router.post("/pedidos/{pedido_id}/excluir")
async def post_excluir_rascunho(
    pedido_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    pedido = await obter_pedido(db, usuario_atual, pedido_id)
    await excluir_rascunho_pedido(db, usuario_atual, pedido)
    await db.commit()
    return {"ok": True}


@router.post("/pedidos/{pedido_id}/reprovar")
async def post_reprovar(
    pedido_id: str,
    payload: ReprovarIn,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    pedido = await obter_pedido(db, usuario_atual, pedido_id)
    await reprovar_pedido(db, usuario_atual, pedido, payload.motivo)
    await db.commit()
    return await serializar_pedido(db, pedido, incluir_detalhe=True)


@router.post("/pedidos/{pedido_id}/reabrir")
async def post_reabrir(
    pedido_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    pedido = await obter_pedido(db, usuario_atual, pedido_id)
    await reabrir_pedido(db, usuario_atual, pedido)
    await db.commit()
    return await serializar_pedido(db, pedido, incluir_detalhe=True)


@router.post("/pedidos/{pedido_id}/comunicacao")
async def post_comunicacao(
    pedido_id: str,
    payload: ComunicacaoIn,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    pedido = await obter_pedido(db, usuario_atual, pedido_id)
    await registrar_comunicacao_pedido(
        db,
        usuario_atual,
        pedido,
        tipo=payload.tipo,
        texto=payload.texto,
        cotacao_id=payload.cotacao_id,
    )
    await db.commit()
    return await serializar_pedido(db, pedido, incluir_detalhe=True)


@router.post("/pedidos/{pedido_id}/itens-revisados")
async def post_itens_revisados(
    pedido_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    """Confirma conferência da última alteração de itens (aviso âmbar → padrão)."""
    await _ctx(db, usuario_atual)
    pedido = await obter_pedido(db, usuario_atual, pedido_id)
    await confirmar_revisao_itens_pedido(db, usuario_atual, pedido)
    await db.commit()
    return await serializar_pedido(db, pedido, incluir_detalhe=True)


@router.post("/pedidos/{pedido_id}/anexos")
async def post_anexo(
    pedido_id: str,
    tipo: str = Form(...),
    cotacao_id: Optional[str] = Form(default=None),
    substituir_anexo_id: Optional[str] = Form(default=None),
    arquivo: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    pedido = await obter_pedido(db, usuario_atual, pedido_id)
    await upload_anexo_pedido(
        db,
        usuario_atual,
        pedido,
        file=arquivo,
        tipo=tipo,
        cotacao_id=cotacao_id,
        substituir_anexo_id=substituir_anexo_id,
    )
    await db.commit()
    return await serializar_pedido(db, pedido, incluir_detalhe=True)


@router.get("/pedidos/{pedido_id}/anexos/{anexo_id}/arquivo")
async def get_anexo_arquivo(
    pedido_id: str,
    anexo_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    pedido = await obter_pedido(db, usuario_atual, pedido_id)
    from models import ComprasPedidoAnexoDB
    from sqlalchemy import select

    anexo = (
        await db.execute(
            select(ComprasPedidoAnexoDB).where(
                ComprasPedidoAnexoDB.id == anexo_id,
                ComprasPedidoAnexoDB.pedido_id == pedido.id,
            )
        )
    ).scalar_one_or_none()
    if not anexo:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Anexo não encontrado.")
    conteudo, content_type = ler_bytes_anexo(anexo.caminho_arquivo)
    return Response(
        content=conteudo,
        media_type=content_type or anexo.content_type or "application/octet-stream",
        headers={"Content-Disposition": f'inline; filename="{anexo.nome_arquivo}"'},
    )


@router.post("/pedidos/{pedido_id}/notas-fiscais")
async def post_nota_fiscal(
    pedido_id: str,
    tipo_nf: str = Form(default="produto"),
    numero: Optional[str] = Form(default=None),
    serie: Optional[str] = Form(default=None),
    chave_acesso: Optional[str] = Form(default=None),
    emitente_nome: Optional[str] = Form(default=None),
    emitente_cnpj: Optional[str] = Form(default=None),
    data_emissao: Optional[str] = Form(default=None),
    valor_reais: Optional[str] = Form(default=None),
    observacao: Optional[str] = Form(default=None),
    arquivo: Optional[UploadFile] = File(default=None),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    pedido = await obter_pedido(db, usuario_atual, pedido_id)
    payload = {
        "tipo_nf": tipo_nf,
        "numero": numero,
        "serie": serie,
        "chave_acesso": chave_acesso,
        "emitente_nome": emitente_nome,
        "emitente_cnpj": emitente_cnpj,
        "data_emissao": data_emissao,
        "valor_reais": valor_reais,
        "observacao": observacao,
    }
    await registrar_nota_fiscal(db, usuario_atual, pedido, file=arquivo, conteudo_xml=None, payload=payload)
    await db.commit()
    return await serializar_pedido(db, pedido, incluir_detalhe=True)


@router.post("/pedidos/{pedido_id}/gerar-pedido-compra")
async def post_gerar_pedido_compra(
    pedido_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    pedido = await obter_pedido(db, usuario_atual, pedido_id)
    await gerar_pedido_compra(db, usuario_atual, pedido)
    await db.commit()
    return await serializar_pedido(db, pedido, incluir_detalhe=True)


@router.post("/pedidos/{pedido_id}/enviar-email")
async def post_enviar_email(
    pedido_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    pedido = await obter_pedido(db, usuario_atual, pedido_id)
    resultado = await enviar_email_fornecedor(db, usuario_atual, pedido)
    await db.commit()
    return resultado


@router.post("/pedidos/{pedido_id}/solicitar-cotacao")
async def post_solicitar_cotacao(
    pedido_id: str,
    payload: SolicitacaoCotacaoIn,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    """Pede cotação por e-mail a N fornecedores (To individual em cada envio)."""
    await _ctx(db, usuario_atual)
    pedido = await obter_pedido(db, usuario_atual, pedido_id)
    resultado = await enviar_solicitacao_cotacao_fornecedores(
        db, usuario_atual, pedido, payload.fornecedor_ids,
    )
    await db.commit()
    detalhe = await serializar_pedido(db, pedido, incluir_detalhe=True)
    return {**resultado, "pedido": detalhe}


@router.post("/pedidos/{pedido_id}/cotacoes/{cotacao_id}/desativar")
async def post_desativar_cotacao(
    pedido_id: str,
    cotacao_id: str,
    payload: DesativarCotacaoIn,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    pedido = await obter_pedido(db, usuario_atual, pedido_id)
    await desativar_cotacao(db, usuario_atual, pedido, cotacao_id, payload.motivo)
    await db.commit()
    return await serializar_pedido(db, pedido, incluir_detalhe=True)


@router.get("/patrimonio")
async def get_patrimonio(
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    return {"itens": await listar_patrimonio(db, usuario_atual)}


async def _resposta_patrimonio(db, usuario, row) -> dict:
    nomes = await _nomes_instituicao(db, [row.instituicao_id] if row.instituicao_id else [])
    org_nome = await _nome_organizacao(db, usuario["organizacao_id"])
    return _serializar_patrimonio(row, nomes, org_nome)


@router.post("/patrimonio")
async def post_patrimonio(
    payload: PatrimonioIn,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    row = await salvar_patrimonio(db, usuario_atual, payload.model_dump())
    await db.commit()
    await db.refresh(row)
    return await _resposta_patrimonio(db, usuario_atual, row)


@router.put("/patrimonio/{item_id}")
async def put_patrimonio(
    item_id: str,
    payload: PatrimonioIn,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    row = await salvar_patrimonio(db, usuario_atual, payload.model_dump(), item_id)
    await db.commit()
    await db.refresh(row)
    return await _resposta_patrimonio(db, usuario_atual, row)


@router.get("/economia")
async def get_economia(
    competencia: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _ctx(db, usuario_atual)
    return await relatorio_economia(db, usuario_atual, competencia)
