# =====================================================================
# ARQUIVO: main.py
# =====================================================================

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.exceptions import RequestValidationError
import asyncio
import contextlib
import logging
import os
import re
import time
import uuid
from datetime import datetime, timedelta
from sqlalchemy import text

from config_utils import env_bool, env_int
from database import engine, Base, AsyncSessionLocal
from licenciamento import middleware_licenciamento
from logging_config import configurar_logging_carecore
from manutencao_usuario import provisionar_usuario_manutencao
from observability import configurar_observabilidade_carecore
from presenca_operacional import PRESENCA_REGRAS_BUILD
from revisao_texto import gemini_configurado
from security import (
    caminho_api_permitido_para_adm_compras,
    caminho_api_permitido_para_adm_global,
    caminho_api_permitido_para_adm_pedidos,
    caminho_api_permitido_para_adm_producao,
    caminho_api_permitido_para_oficineiro,
    extrair_payload_autorizacao_bearer,
    usuario_eh_adm_compras,
    usuario_eh_adm_global,
    usuario_eh_adm_pedidos,
    usuario_eh_adm_producao,
    usuario_eh_oficineiro,
)

from routers import usuarios
from routers import auth
from routers import quartos
from routers import carteirinha
from routers import conviventes
from routers import avisos
from routers import arquivos
from routers import organizacoes
from routers import historico_legado
from routers import chat
from routers import rotina_operacional
from routers import passkeys
from routers import suporte
from routers import cobrancas
from routers import acompanhamentos
from routers import atividades
from routers import atividades_sisa
from routers import texto
from routers import nfp
from routers import compras


configurar_logging_carecore()
configurar_observabilidade_carecore()
logger = logging.getLogger("carecore.api")

APP_ENV = os.getenv("APP_ENV", "local").strip().lower()
AMBIENTE_LOCAL = APP_ENV in {"local", "development", "dev"}

ORIGENS_PERMITIDAS = set()
if AMBIENTE_LOCAL:
    ORIGENS_PERMITIDAS.update({
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8765",
        "http://127.0.0.1:8765",
    })

ORIGEM_LAN_REGEX_VALOR = r"^http://(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}):5173$"
ORIGEM_LAN_REGEX = ORIGEM_LAN_REGEX_VALOR if AMBIENTE_LOCAL else None

ORIGENS_PRODUCAO = {
    origem.strip()
    for origem in os.getenv("CARECORE_CORS_ORIGINS", "").split(",")
    if origem.strip()
}
ORIGENS_PERMITIDAS.update(ORIGENS_PRODUCAO)
ORIGEM_EXTRA_REGEX = os.getenv("CARECORE_CORS_ORIGIN_REGEX", "").strip()

AUTO_CREATE_TABLES_PADRAO = "true" if APP_ENV in {"local", "development", "dev"} else "false"
AUTO_CREATE_TABLES = env_bool("CARECORE_AUTO_CREATE_TABLES", AUTO_CREATE_TABLES_PADRAO)
SLOW_REQUEST_MS = env_int("CARECORE_SLOW_REQUEST_MS", 2000, minimo=0)


def definir_header_se_ausente(response: Response, chave: str, valor: str) -> None:
    if chave not in response.headers:
        response.headers[chave] = valor


def origem_corresponde_regex(padrao: str | None, origin: str | None) -> bool:
    if not padrao or not origin:
        return False

    try:
        return bool(re.match(padrao, origin))
    except re.error:
        logger.warning(
            "Regex CORS inválida ignorada",
            extra={
                "cors_regex": padrao,
            },
        )
        return False


def _garantir_schema_compras_escopo_sede(sync_conn):
    """Local/SQLite: escopo_unidade e instituicao_id nullable (alembic q3r4s5t6u7v8)."""
    import sqlalchemy as sa
    from alembic.operations import Operations
    from alembic.runtime.migration import MigrationContext
    from sqlalchemy import inspect

    inspector = inspect(sync_conn)
    tabelas = set(inspector.get_table_names())
    if "compras_pedidos" not in tabelas:
        return

    cols = {c["name"] for c in inspector.get_columns("compras_pedidos")}
    if "escopo_unidade" not in cols:
        sync_conn.execute(text(
            "ALTER TABLE compras_pedidos ADD COLUMN escopo_unidade VARCHAR NOT NULL DEFAULT 'projeto'"
        ))
        inspector = inspect(sync_conn)
        cols = {c["name"] for c in inspector.get_columns("compras_pedidos")}
    if "data_envio_prevista" not in cols:
        sync_conn.execute(text("ALTER TABLE compras_pedidos ADD COLUMN data_envio_prevista DATE"))
        cols.add("data_envio_prevista")
    if "envio_automatico" not in cols:
        sync_conn.execute(text("ALTER TABLE compras_pedidos ADD COLUMN envio_automatico BOOLEAN DEFAULT 0"))
        cols.add("envio_automatico")
    for ddl in (
        "ALTER TABLE compras_pedidos ADD COLUMN status_anterior VARCHAR",
        "ALTER TABLE compras_pedidos ADD COLUMN reprovado_em DATETIME",
        "ALTER TABLE compras_pedidos ADD COLUMN reprovado_por_id VARCHAR",
        "ALTER TABLE compras_pedidos ADD COLUMN motivo_reprovacao TEXT",
        "ALTER TABLE compras_pedidos ADD COLUMN pedido_compra_anexo_id VARCHAR",
    ):
        col = ddl.split("ADD COLUMN ")[1].split(" ")[0]
        if col not in cols:
            sync_conn.execute(text(ddl))
            cols.add(col)

    if "compras_cotacoes" in tabelas:
        cols_cot = {c["name"] for c in inspector.get_columns("compras_cotacoes")}
        if "ativa" not in cols_cot:
            sync_conn.execute(text("ALTER TABLE compras_cotacoes ADD COLUMN ativa BOOLEAN NOT NULL DEFAULT 1"))
        if "substituida_por_id" not in cols_cot:
            sync_conn.execute(text("ALTER TABLE compras_cotacoes ADD COLUMN substituida_por_id VARCHAR"))

    if "compras_pedido_anexos" not in tabelas:
        sync_conn.execute(text(
            "CREATE TABLE IF NOT EXISTS compras_pedido_anexos ("
            "id VARCHAR PRIMARY KEY, "
            "pedido_id VARCHAR NOT NULL, "
            "cotacao_id VARCHAR, "
            "nota_fiscal_id VARCHAR, "
            "tipo VARCHAR NOT NULL, "
            "nome_arquivo VARCHAR NOT NULL, "
            "caminho_arquivo VARCHAR NOT NULL, "
            "content_type VARCHAR, "
            "tamanho_bytes INTEGER, "
            "ativo BOOLEAN NOT NULL DEFAULT 1, "
            "substituido_por_id VARCHAR, "
            "criado_por_id VARCHAR, "
            "criado_em DATETIME"
            ")"
        ))
        sync_conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_compras_pedido_anexo_pedido ON compras_pedido_anexos (pedido_id)"
        ))

    if "compras_pedido_notas_fiscais" not in tabelas:
        sync_conn.execute(text(
            "CREATE TABLE IF NOT EXISTS compras_pedido_notas_fiscais ("
            "id VARCHAR PRIMARY KEY, "
            "pedido_id VARCHAR NOT NULL, "
            "anexo_id VARCHAR, "
            "tipo_nf VARCHAR NOT NULL DEFAULT 'produto', "
            "numero VARCHAR, "
            "serie VARCHAR, "
            "chave_acesso VARCHAR, "
            "emitente_nome VARCHAR, "
            "emitente_cnpj VARCHAR, "
            "data_emissao DATE, "
            "valor_centavos INTEGER, "
            "origem_dados VARCHAR NOT NULL DEFAULT 'manual', "
            "observacao TEXT, "
            "criado_por_id VARCHAR, "
            "criado_em DATETIME"
            ")"
        ))
        sync_conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_compras_pedido_nf_pedido ON compras_pedido_notas_fiscais (pedido_id)"
        ))

    if "compras_pedido_eventos" not in tabelas:
        sync_conn.execute(text(
            "CREATE TABLE IF NOT EXISTS compras_pedido_eventos ("
            "id VARCHAR PRIMARY KEY, "
            "pedido_id VARCHAR NOT NULL, "
            "tipo VARCHAR NOT NULL, "
            "texto TEXT, "
            "usuario_id VARCHAR, "
            "cotacao_id VARCHAR, "
            "anexo_id VARCHAR, "
            "status_anterior VARCHAR, "
            "status_novo VARCHAR, "
            "criado_em DATETIME"
            ")"
        ))
        sync_conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_compras_pedido_evento_pedido ON compras_pedido_eventos (pedido_id)"
        ))

    inst_col = next(
        (c for c in inspector.get_columns("compras_pedidos") if c["name"] == "instituicao_id"),
        None,
    )
    if inst_col and not inst_col.get("nullable"):
        ctx = MigrationContext.configure(sync_conn)
        op = Operations(ctx)
        with op.batch_alter_table("compras_pedidos") as batch_op:
            batch_op.alter_column("instituicao_id", existing_type=sa.String(), nullable=True)

    if "compras_patrimonio" in tabelas:
        pat_col = next(
            (c for c in inspector.get_columns("compras_patrimonio") if c["name"] == "instituicao_id"),
            None,
        )
        if pat_col and not pat_col.get("nullable"):
            ctx = MigrationContext.configure(sync_conn)
            op = Operations(ctx)
            with op.batch_alter_table("compras_patrimonio") as batch_op:
                batch_op.alter_column("instituicao_id", existing_type=sa.String(), nullable=True)
        cols_pat = {c["name"] for c in inspector.get_columns("compras_patrimonio")}
        for ddl in (
            "ALTER TABLE compras_patrimonio ADD COLUMN numero_etiqueta VARCHAR",
            "ALTER TABLE compras_patrimonio ADD COLUMN departamento VARCHAR",
            "ALTER TABLE compras_patrimonio ADD COLUMN propriedade VARCHAR DEFAULT 'aeb'",
            "ALTER TABLE compras_patrimonio ADD COLUMN data_aquisicao DATE",
            "ALTER TABLE compras_patrimonio ADD COLUMN forma_aquisicao VARCHAR",
            "ALTER TABLE compras_patrimonio ADD COLUMN situacao VARCHAR DEFAULT 'bom'",
            "ALTER TABLE compras_patrimonio ADD COLUMN motivo_baixa VARCHAR",
            "ALTER TABLE compras_patrimonio ADD COLUMN data_baixa DATE",
            "ALTER TABLE compras_patrimonio ADD COLUMN observacao TEXT",
            "ALTER TABLE compras_patrimonio ADD COLUMN escopo_unidade VARCHAR DEFAULT 'projeto'",
            "ALTER TABLE compras_patrimonio ADD COLUMN atualizado_em DATETIME",
        ):
            col = ddl.split("ADD COLUMN ")[1].split(" ")[0]
            if col not in cols_pat:
                sync_conn.execute(text(ddl))
                cols_pat.add(col)

    if "compras_fornecedores" in tabelas:
        cols_forn = {c["name"] for c in inspector.get_columns("compras_fornecedores")}
        if "atende_geral" not in cols_forn:
            sync_conn.execute(text(
                "ALTER TABLE compras_fornecedores ADD COLUMN atende_geral BOOLEAN NOT NULL DEFAULT 1"
            ))

    if "compras_fornecedor_projetos" not in tabelas:
        sync_conn.execute(text(
            "CREATE TABLE IF NOT EXISTS compras_fornecedor_projetos ("
            "id VARCHAR PRIMARY KEY, "
            "fornecedor_id VARCHAR NOT NULL, "
            "instituicao_id VARCHAR NOT NULL, "
            "criado_em DATETIME, "
            "UNIQUE (fornecedor_id, instituicao_id)"
            ")"
        ))

    if "compras_itens_consumo" not in tabelas:
        sync_conn.execute(text(
            "CREATE TABLE IF NOT EXISTS compras_itens_consumo ("
            "id VARCHAR PRIMARY KEY, "
            "organizacao_id VARCHAR NOT NULL, "
            "categoria_id VARCHAR, "
            "descricao VARCHAR NOT NULL, "
            "chave VARCHAR NOT NULL, "
            "unidade_medida VARCHAR, "
            "embalagem VARCHAR, "
            "marca_preferencial VARCHAR, "
            "observacao TEXT, "
            "ativo BOOLEAN NOT NULL DEFAULT 1, "
            "criado_em DATETIME, "
            "atualizado_em DATETIME"
            ")"
        ))
        sync_conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_compras_item_consumo_org ON compras_itens_consumo (organizacao_id)"
        ))
        sync_conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_compras_item_consumo_org_ativo "
            "ON compras_itens_consumo (organizacao_id, ativo)"
        ))
        sync_conn.execute(text("DROP INDEX IF EXISTS ix_compras_item_consumo_chave"))
        sync_conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_compras_item_consumo_org_chave "
            "ON compras_itens_consumo (organizacao_id, chave)"
        ))
    elif "compras_itens_consumo" in tabelas:
        sync_conn.execute(text("DROP INDEX IF EXISTS ix_compras_item_consumo_chave"))
        sync_conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_compras_item_consumo_org_chave "
            "ON compras_itens_consumo (organizacao_id, chave)"
        ))
        inspector = inspect(sync_conn)
        cols_cons = {c["name"] for c in inspector.get_columns("compras_itens_consumo")}
        if "embalagem" not in cols_cons:
            sync_conn.execute(text("ALTER TABLE compras_itens_consumo ADD COLUMN embalagem VARCHAR"))

    if "compras_pedido_itens" in tabelas:
        cols_item = {c["name"] for c in inspector.get_columns("compras_pedido_itens")}
        if "catalogo_item_id" not in cols_item:
            sync_conn.execute(text(
                "ALTER TABLE compras_pedido_itens ADD COLUMN catalogo_item_id VARCHAR"
            ))
        if "embalagem" not in cols_item:
            sync_conn.execute(text(
                "ALTER TABLE compras_pedido_itens ADD COLUMN embalagem VARCHAR"
            ))


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    if AUTO_CREATE_TABLES:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_registros_rotina_sisa_periodo "
                "ON registros_rotina (instituicao_id, cancelado, data_registro, convivente_id, tipo_registro)"
            ))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_registros_rotina_ultimo_movimento "
                "ON registros_rotina (instituicao_id, cancelado, tipo_registro, convivente_id, data_registro)"
            ))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_conviventes_instituicao_status "
                "ON conviventes (instituicao_id, status)"
            ))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_conviventes_lista_resumo "
                "ON conviventes (instituicao_id, status, nome_completo, numero_institucional)"
            ))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_sisa_lancamentos_instituicao_mes "
                "ON sisa_lancamentos (instituicao_id, ano, mes, convivente_id)"
            ))
            with contextlib.suppress(Exception):
                await conn.execute(text(
                    "ALTER TABLE ocorrencias_conviventes "
                    "ADD COLUMN prioridade VARCHAR DEFAULT 'Média'"
                ))
            for ddl in (
                "ALTER TABLE documentos_conviventes ADD COLUMN sensivel BOOLEAN DEFAULT 0",
                "ALTER TABLE registros_rotina ADD COLUMN observacao TEXT",
                "ALTER TABLE registros_pia ADD COLUMN registro_pai_id VARCHAR",
                "ALTER TABLE registros_pia ADD COLUMN subtitulo VARCHAR",
                "ALTER TABLE ocorrencias_conviventes ADD COLUMN convivente_autor_ocorrencia BOOLEAN DEFAULT 0",
                "ALTER TABLE ocorrencias_conviventes ADD COLUMN funcionario_envolvido_id VARCHAR",
                "ALTER TABLE ocorrencias_conviventes ADD COLUMN assinatura_convivente_metodo VARCHAR",
                "ALTER TABLE ocorrencias_conviventes ADD COLUMN assinatura_convivente_codigo VARCHAR",
                "ALTER TABLE ocorrencias_conviventes ADD COLUMN assinatura_convivente_validada_em DATETIME",
                "ALTER TABLE sisa_presencas_importadas ADD COLUMN data_referencia DATE",
                "ALTER TABLE conviventes ADD COLUMN tem_mandado_prisao BOOLEAN DEFAULT 0",
                "ALTER TABLE conviventes ADD COLUMN inativado_em DATETIME",
                "ALTER TABLE instituicoes ADD COLUMN organizacao_id VARCHAR",
                "ALTER TABLE instituicoes ADD COLUMN email VARCHAR",
                "ALTER TABLE instituicoes ADD COLUMN cep VARCHAR",
                "ALTER TABLE instituicoes ADD COLUMN logradouro VARCHAR",
                "ALTER TABLE instituicoes ADD COLUMN numero VARCHAR",
                "ALTER TABLE instituicoes ADD COLUMN complemento VARCHAR",
                "ALTER TABLE instituicoes ADD COLUMN bairro VARCHAR",
                "ALTER TABLE instituicoes ADD COLUMN cidade VARCHAR",
                "ALTER TABLE instituicoes ADD COLUMN uf VARCHAR",
                "ALTER TABLE instituicoes ADD COLUMN tipo_projeto VARCHAR DEFAULT 'Projeto'",
                "ALTER TABLE instituicoes ADD COLUMN projeto_unico BOOLEAN DEFAULT 1",
                "ALTER TABLE instituicoes ADD COLUMN relatorio_logo_url VARCHAR",
                "ALTER TABLE instituicoes ADD COLUMN relatorio_nome_exibicao VARCHAR",
                "ALTER TABLE instituicoes ADD COLUMN relatorio_rodape_linha1 VARCHAR",
                "ALTER TABLE instituicoes ADD COLUMN relatorio_rodape_linha2 VARCHAR",
                "ALTER TABLE instituicoes ADD COLUMN relatorio_telefone VARCHAR",
                "ALTER TABLE instituicoes ADD COLUMN relatorio_email VARCHAR",
                "ALTER TABLE instituicoes ADD COLUMN relatorio_site VARCHAR",
                "ALTER TABLE instituicoes ADD COLUMN historico_legado_ativo BOOLEAN DEFAULT 0",
                "ALTER TABLE instituicoes ADD COLUMN config_operacional_json TEXT",
                "ALTER TABLE organizacoes ADD COLUMN relatorio_logo_url VARCHAR",
                "ALTER TABLE organizacoes ADD COLUMN relatorio_nome_exibicao VARCHAR",
                "ALTER TABLE organizacoes ADD COLUMN relatorio_rodape_linha1 VARCHAR",
                "ALTER TABLE organizacoes ADD COLUMN relatorio_rodape_linha2 VARCHAR",
                "ALTER TABLE organizacoes ADD COLUMN relatorio_telefone VARCHAR",
                "ALTER TABLE organizacoes ADD COLUMN relatorio_email VARCHAR",
                "ALTER TABLE organizacoes ADD COLUMN relatorio_site VARCHAR",
                "ALTER TABLE usuarios ADD COLUMN organizacao_id VARCHAR",
                "ALTER TABLE usuarios ADD COLUMN is_global BOOLEAN DEFAULT 0",
                "ALTER TABLE usuarios ADD COLUMN token_version INTEGER DEFAULT 0 NOT NULL",
                "ALTER TABLE ocorrencias_conviventes ADD COLUMN motivo_original TEXT",
                "ALTER TABLE ocorrencias_conviventes ADD COLUMN descricao_original TEXT",
                "ALTER TABLE interacoes_ocorrencias ADD COLUMN mensagem_original TEXT",
                "ALTER TABLE avisos ADD COLUMN titulo_original TEXT",
                "ALTER TABLE avisos ADD COLUMN mensagem_original TEXT",
                "ALTER TABLE compras_pedidos ADD COLUMN escopo_unidade VARCHAR DEFAULT 'projeto'",
                "ALTER TABLE compras_pedidos ADD COLUMN data_envio_prevista DATE",
                "ALTER TABLE compras_pedidos ADD COLUMN envio_automatico BOOLEAN DEFAULT 0",
                "ALTER TABLE compras_fornecedores ADD COLUMN segmento VARCHAR",
                "ALTER TABLE compras_fornecedores ADD COLUMN email_empresa VARCHAR",
                "ALTER TABLE compras_fornecedores ADD COLUMN projetos_atendidos TEXT",
                "ALTER TABLE compras_fornecedores ADD COLUMN cep VARCHAR",
                "ALTER TABLE compras_fornecedores ADD COLUMN logradouro VARCHAR",
                "ALTER TABLE compras_fornecedores ADD COLUMN numero VARCHAR",
                "ALTER TABLE compras_fornecedores ADD COLUMN complemento VARCHAR",
                "ALTER TABLE compras_fornecedores ADD COLUMN bairro VARCHAR",
                "ALTER TABLE compras_fornecedores ADD COLUMN uf VARCHAR",
                "ALTER TABLE compras_fornecedores ADD COLUMN atende_geral BOOLEAN DEFAULT 1",
                "ALTER TABLE compras_patrimonio ADD COLUMN numero_etiqueta VARCHAR",
                "ALTER TABLE compras_patrimonio ADD COLUMN departamento VARCHAR",
                "ALTER TABLE compras_patrimonio ADD COLUMN propriedade VARCHAR DEFAULT 'aeb'",
                "ALTER TABLE compras_patrimonio ADD COLUMN data_aquisicao DATE",
                "ALTER TABLE compras_patrimonio ADD COLUMN forma_aquisicao VARCHAR",
                "ALTER TABLE compras_patrimonio ADD COLUMN situacao VARCHAR DEFAULT 'bom'",
                "ALTER TABLE compras_patrimonio ADD COLUMN motivo_baixa VARCHAR",
                "ALTER TABLE compras_patrimonio ADD COLUMN data_baixa DATE",
                "ALTER TABLE compras_patrimonio ADD COLUMN observacao TEXT",
                "ALTER TABLE compras_patrimonio ADD COLUMN escopo_unidade VARCHAR DEFAULT 'projeto'",
                "ALTER TABLE compras_patrimonio ADD COLUMN atualizado_em DATETIME",
            ):
                with contextlib.suppress(Exception):
                    await conn.execute(text(ddl))
            with contextlib.suppress(Exception):
                await conn.run_sync(_garantir_schema_compras_escopo_sede)
            with contextlib.suppress(Exception):
                await conn.execute(text(
                    "INSERT INTO organizacoes (id, nome, cnpj, telefone, is_active, criado_em) "
                    "SELECT i.id, i.nome_fantasia, i.cnpj, i.telefone, i.is_active, CURRENT_TIMESTAMP "
                    "FROM instituicoes i "
                    "WHERE i.organizacao_id IS NULL "
                    "AND NOT EXISTS (SELECT 1 FROM organizacoes o WHERE o.id = i.id)"
                ))
                await conn.execute(text(
                    "UPDATE instituicoes SET organizacao_id = id "
                    "WHERE organizacao_id IS NULL"
                ))
                await conn.execute(text(
                    "UPDATE usuarios SET organizacao_id = ("
                    "SELECT i.organizacao_id FROM instituicoes i WHERE i.id = usuarios.instituicao_id"
                    ") WHERE organizacao_id IS NULL"
                ))
                await conn.execute(text(
                    "UPDATE usuarios SET is_global = 1 "
                    "WHERE lower(email) = 'diretor@carecore.com'"
                ))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_sisa_importacoes_instituicao_data "
                "ON sisa_importacoes (instituicao_id, data_referencia, importado_em)"
            ))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_instituicoes_organizacao "
                "ON instituicoes (organizacao_id)"
            ))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_usuarios_organizacao "
                "ON usuarios (organizacao_id, is_global)"
            ))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_sisa_presencas_numero_data "
                "ON sisa_presencas_importadas (instituicao_id, numero_sisa, data_referencia)"
            ))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_sisa_divergencias_importacao_tipo "
                "ON sisa_divergencias (instituicao_id, importacao_id, tipo, prioridade, status)"
            ))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_ocorrencias_dashboard "
                "ON ocorrencias_conviventes (instituicao_id, status_resolucao, prioridade, tecnico_responsavel_id, data_ocorrencia)"
            ))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_historico_legado_filtros "
                "ON historico_legado_siat (instituicao_id, ano_origem, data_original, tipo_sugerido, status_revisao)"
            ))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_historico_legado_busca_nome "
                "ON historico_legado_siat (instituicao_id, nome_identificado, operador_origem)"
            ))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_historico_legado_ordem "
                "ON historico_legado_siat (instituicao_id, data_original DESC, ano_origem DESC, pagina_origem, sequencia_origem)"
            ))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_historicos_conviventes_lookup "
                "ON historicos_conviventes (instituicao_id, convivente_id, data_origem, criado_em)"
            ))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_quartos_instituicao "
                "ON quartos (instituicao_id)"
            ))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_leitos_quarto_status "
                "ON leitos (quarto_id, status)"
            ))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_chat_participantes_usuario "
                "ON chat_participantes (instituicao_id, usuario_id, ativo, conversa_id)"
            ))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_chat_mensagens_conversa_data "
                "ON chat_mensagens (conversa_id, criado_em)"
            ))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_chat_conversas_ordem "
                "ON chat_conversas (instituicao_id, atualizado_em)"
            ))

    async with AsyncSessionLocal() as session:
        await provisionar_usuario_manutencao(session)
        await session.commit()

    async def _job_snapshots_dashboard_operacional():
        """Captura retrato 22:40 SP (um por dia/instituição); não sobrescreve."""
        from dashboard_operacional_snapshot import (
            capturar_snapshots_pendentes_todas_instituicoes,
            ja_passou_horario_captura,
            momento_captura_do_dia,
        )
        from time_operacional import agora_operacional_naive

        await asyncio.sleep(45)
        while True:
            try:
                agora = agora_operacional_naive()
                if ja_passou_horario_captura(agora):
                    async with AsyncSessionLocal() as session:
                        resultado = await capturar_snapshots_pendentes_todas_instituicoes(session)
                    logger.info("Snapshots dashboard operacional: %s", resultado)
                    proximo = momento_captura_do_dia(agora.date() + timedelta(days=1)) + timedelta(minutes=5)
                else:
                    # Acorda poucos minutos após o horário da foto.
                    proximo = momento_captura_do_dia(agora.date()) + timedelta(minutes=5)
                    if agora >= proximo:
                        proximo = momento_captura_do_dia(agora.date() + timedelta(days=1)) + timedelta(minutes=5)
                segundos = max((proximo - agora).total_seconds(), 60.0)
                await asyncio.sleep(min(segundos, 3600.0))
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Falha no job de snapshots do dashboard operacional")
                await asyncio.sleep(300)

    job_snapshots = asyncio.create_task(_job_snapshots_dashboard_operacional())

    async def _job_compras_envio_automatico():
        from compras_service import processar_envios_automaticos
        await asyncio.sleep(90)
        while True:
            try:
                async with AsyncSessionLocal() as session:
                    resultado = await processar_envios_automaticos(session)
                if resultado.get("enviados"):
                    logger.info("Compras envio automático: %s", resultado)
                await asyncio.sleep(120)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Falha no job de envio automático de compras")
                await asyncio.sleep(120)

    job_compras = asyncio.create_task(_job_compras_envio_automatico())
    try:
        yield
    finally:
        job_snapshots.cancel()
        job_compras.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await job_snapshots
        with contextlib.suppress(asyncio.CancelledError):
            await job_compras


app = FastAPI(
    title="CARECORE+ API",
    lifespan=lifespan,
    docs_url=None if APP_ENV in {"production", "prod"} else "/docs",
    redoc_url=None if APP_ENV in {"production", "prod"} else "/redoc",
    openapi_url=None if APP_ENV in {"production", "prod"} else "/openapi.json",
)

# =====================================================================
# MIDDLEWARE LICENÇA
# =====================================================================

app.middleware("http")(middleware_licenciamento)


@app.middleware("http")
async def rbac_oficineiro_middleware(request: Request, call_next):
    path = request.url.path
    if not path.startswith("/api/"):
        return await call_next(request)

    payload = extrair_payload_autorizacao_bearer(request.headers.get("authorization"))
    if not payload or not usuario_eh_oficineiro(payload):
        return await call_next(request)

    if caminho_api_permitido_para_oficineiro(path, request.method):
        return await call_next(request)

    return JSONResponse(
        status_code=403,
        content={
            "detail": "Perfil Oficineiro(a) tem acesso apenas ao módulo de Atividades.",
        },
    )


@app.middleware("http")
async def rbac_adm_global_middleware(request: Request, call_next):
    path = request.url.path
    if not path.startswith("/api/"):
        return await call_next(request)

    payload = extrair_payload_autorizacao_bearer(request.headers.get("authorization"))
    if not payload or not usuario_eh_adm_global(payload):
        return await call_next(request)

    if caminho_api_permitido_para_adm_global(path, request.method):
        return await call_next(request)

    return JSONResponse(
        status_code=403,
        content={
            "detail": "Perfil ADM Global tem acesso apenas ao módulo NFP – Créditos.",
        },
    )


@app.middleware("http")
async def rbac_adm_producao_middleware(request: Request, call_next):
    path = request.url.path
    if not path.startswith("/api/"):
        return await call_next(request)

    payload = extrair_payload_autorizacao_bearer(request.headers.get("authorization"))
    if not payload or not usuario_eh_adm_producao(payload):
        return await call_next(request)

    if caminho_api_permitido_para_adm_producao(path, request.method):
        return await call_next(request)

    return JSONResponse(
        status_code=403,
        content={
            "detail": "Perfil ADM Produção tem acesso apenas à Leitura de Cupons (NFP).",
        },
    )


@app.middleware("http")
async def rbac_adm_compras_middleware(request: Request, call_next):
    path = request.url.path
    if not path.startswith("/api/"):
        return await call_next(request)

    payload = extrair_payload_autorizacao_bearer(request.headers.get("authorization"))
    if not payload or not usuario_eh_adm_compras(payload):
        return await call_next(request)

    if caminho_api_permitido_para_adm_compras(path, request.method):
        return await call_next(request)

    return JSONResponse(
        status_code=403,
        content={
            "detail": "Perfil ADM Compras tem acesso apenas ao módulo Compras.",
        },
    )


@app.middleware("http")
async def rbac_adm_pedidos_middleware(request: Request, call_next):
    path = request.url.path
    if not path.startswith("/api/"):
        return await call_next(request)

    payload = extrair_payload_autorizacao_bearer(request.headers.get("authorization"))
    if not payload or not usuario_eh_adm_pedidos(payload):
        return await call_next(request)

    if caminho_api_permitido_para_adm_pedidos(path, request.method):
        return await call_next(request)

    return JSONResponse(
        status_code=403,
        content={
            "detail": "Perfil ADM Pedidos tem acesso apenas ao módulo Compras da unidade.",
        },
    )


# =====================================================================
# HARDENING HTTP / REQUEST ID
# =====================================================================

@app.middleware("http")
async def security_headers_carecore(request: Request, call_next):
    request_id = request.headers.get("X-CareCore-Request-Id") or uuid.uuid4().hex
    inicio = time.perf_counter()

    try:
        response = await call_next(request)
    except Exception:
        duracao_ms = round((time.perf_counter() - inicio) * 1000, 2)
        logger.exception(
            "Erro inesperado na API",
            extra={
                "request_id": request_id,
                "path": request.url.path,
                "method": request.method,
                "duration_ms": duracao_ms,
            },
        )
        raise

    duracao_ms = round((time.perf_counter() - inicio) * 1000, 2)
    definir_header_se_ausente(response, "X-CareCore-Request-Id", request_id)
    definir_header_se_ausente(response, "X-CareCore-Process-Time-Ms", str(duracao_ms))
    definir_header_se_ausente(response, "X-Content-Type-Options", "nosniff")
    definir_header_se_ausente(response, "X-Frame-Options", "DENY")
    definir_header_se_ausente(response, "Referrer-Policy", "strict-origin-when-cross-origin")
    definir_header_se_ausente(
        response,
        "Permissions-Policy",
        "geolocation=(), payment=(), usb=(), serial=()",
    )

    if request.url.scheme == "https" or APP_ENV in {"production", "prod"}:
        definir_header_se_ausente(
            response,
            "Strict-Transport-Security",
            "max-age=31536000; includeSubDomains",
        )

    if request.url.path.startswith("/api/") and not request.url.path.startswith("/api/arquivos/"):
        definir_header_se_ausente(response, "Cache-Control", "no-store")

    if SLOW_REQUEST_MS > 0 and duracao_ms >= SLOW_REQUEST_MS:
        logger.warning(
            "Requisição lenta na API",
            extra={
                "request_id": request_id,
                "path": request.url.path,
                "method": request.method,
                "status_code": response.status_code,
                "duration_ms": duracao_ms,
            },
        )

    return response


# =====================================================================
# CORS PADRÃO
# =====================================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(ORIGENS_PERMITIDAS),
    allow_origin_regex=ORIGEM_LAN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================================
# CORS DE SEGURANÇA — RESOLVE PREFLIGHT/RETORNOS SEM HEADER
# =====================================================================

@app.middleware("http")
async def cors_seguro_carecore(request: Request, call_next):
    origin = request.headers.get("origin")

    if request.method == "OPTIONS":
        response = Response(status_code=204)
    else:
        try:
            response = await call_next(request)
        except Exception:
            logger.exception(
                "Erro inesperado antes da aplicação dos headers CORS",
                extra={
                    "path": request.url.path,
                    "method": request.method,
                },
            )
            response = JSONResponse(
                status_code=500,
                content={"detail": "Erro interno do servidor."},
            )

    origem_regex_ok = origem_corresponde_regex(ORIGEM_LAN_REGEX, origin)
    origem_extra_ok = origem_corresponde_regex(ORIGEM_EXTRA_REGEX, origin)

    if origin in ORIGENS_PERMITIDAS or origem_regex_ok or origem_extra_ok:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = (
            "Authorization, Content-Type, Accept, Origin, X-CareCore-Request-Id"
        )
        response.headers["Access-Control-Expose-Headers"] = (
            "X-CareCore-Request-Id, X-CareCore-Process-Time-Ms"
        )
        response.headers["Vary"] = "Origin"

    return response


# =====================================================================
# HANDLER VALIDAÇÃO
# =====================================================================

@app.get("/api/health", tags=["Sistema"])
async def healthcheck():
    return {
        "status": "ok",
        "service": "CARECORE+ API",
        "environment": APP_ENV,
        "presenca_regras": PRESENCA_REGRAS_BUILD,
        "cadastro_datas": "ajuste-automatico-v1",
        "revisao_texto_configurada": gemini_configurado(),
        "dashboard_api": "contagens-v1",
        "rotina_ajustes_resumo": "historico-v1",
    }


# =====================================================================
# HANDLER VALIDAÇÃO
# =====================================================================

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError
):
    erros = []

    for erro in exc.errors():
        erros.append({
            "campo": ".".join([str(x) for x in erro["loc"]]),
            "mensagem": erro["msg"]
        })

    return JSONResponse(
        status_code=422,
        content={
            "detail": "Erro de validação.",
            "erros": erros
        }
    )


# =====================================================================
# UPLOADS
# =====================================================================

os.makedirs("uploads/documentos", exist_ok=True)


# =====================================================================
# ROTAS
# =====================================================================

app.include_router(auth.router)
app.include_router(passkeys.router)
app.include_router(arquivos.router)
app.include_router(quartos.router)
app.include_router(carteirinha.router)
app.include_router(conviventes.router)
app.include_router(rotina_operacional.router)
app.include_router(avisos.router)
app.include_router(organizacoes.router)
app.include_router(historico_legado.router)
app.include_router(chat.router)
app.include_router(suporte.router)
app.include_router(cobrancas.router)
app.include_router(usuarios.router)
app.include_router(acompanhamentos.router)
app.include_router(atividades_sisa.router)
app.include_router(atividades.router)
app.include_router(texto.router)
app.include_router(nfp.router)
app.include_router(compras.router)

