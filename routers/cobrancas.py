from __future__ import annotations

import asyncio
from datetime import date, datetime, timedelta
import hmac
import json
import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from asaas_client import (
    ASAAS_URLS,
    AsaasClient,
    AsaasConfigErro,
    AsaasErro,
    obter_config_asaas,
    validar_config_asaas,
)
from billing import (
    DIAS_ANTECEDENCIA_EXCLUSAO_INATIVO,
    calcular_rateio_organizacao,
    convivente_conta_para_faturamento,
    usuario_conta_para_faturamento,
)
from database import get_db
from models import (
    CobrancaCicloDB,
    CobrancaEventoAsaasDB,
    CobrancaLiberacaoTemporariaDB,
    CobrancaProjetoRateioDB,
    ConviventeDB,
    InstituicaoDB,
    OrganizacaoDB,
    UsuarioDB,
)
from security import get_usuario_logado, usuario_eh_gestor, usuario_eh_manutencao


router = APIRouter(
    prefix="/api/cobrancas",
    tags=["Cobranças"],
)


class CobrancaTesteAsaasRequest(BaseModel):
    nome_cliente: str = Field(default="Cliente Teste CareCore+", min_length=3, max_length=120)
    cpf_cnpj: str = Field(default="24971563792", min_length=11, max_length=14)
    email: str | None = None
    valor: float = Field(default=5.0, gt=0, le=1000)
    vencimento: date | None = None
    billing_type: str = "UNDEFINED"

    @field_validator("cpf_cnpj")
    @classmethod
    def limpar_cpf_cnpj(cls, valor: str) -> str:
        documento = "".join(ch for ch in valor if ch.isdigit())
        if len(documento) not in {11, 14}:
            raise ValueError("CPF/CNPJ deve ter 11 ou 14 dígitos.")
        return documento

    @field_validator("billing_type")
    @classmethod
    def validar_billing_type(cls, valor: str) -> str:
        normalizado = (valor or "").strip().upper()
        permitidos = {"UNDEFINED", "BOLETO", "PIX"}
        if normalizado not in permitidos:
            raise ValueError("Forma de pagamento de teste deve ser UNDEFINED, BOLETO ou PIX.")
        return normalizado


class SimularStatusCobrancaRequest(BaseModel):
    status_asaas: str = Field(min_length=3, max_length=40)

    @field_validator("status_asaas")
    @classmethod
    def validar_status(cls, valor: str) -> str:
        normalizado = (valor or "").strip().upper()
        permitidos = {
            "PENDING",
            "OVERDUE",
            "RECEIVED",
            "CONFIRMED",
            "RECEIVED_IN_CASH",
            "CANCELLED",
        }
        if normalizado not in permitidos:
            raise ValueError("Status de simulação inválido.")
        return normalizado


class LiberacaoTemporariaRequest(BaseModel):
    dias: int = Field(ge=1, le=30)
    motivo: str = Field(min_length=10, max_length=600)


class RevogarLiberacaoRequest(BaseModel):
    motivo: str = Field(default="Revogação manual pela manutenção.", min_length=5, max_length=600)


def exigir_usuario_financeiro_global(usuario_atual: dict) -> None:
    if usuario_atual.get("is_global") or usuario_eh_manutencao(usuario_atual):
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Apenas usuários globais podem gerenciar a integração de cobrança.",
    )


def exigir_usuario_manutencao_financeira(usuario_atual: dict) -> None:
    if usuario_eh_manutencao(usuario_atual):
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Apenas usuários de manutenção podem acessar a operação financeira.",
    )


def simulacoes_cobranca_ativas() -> bool:
    valor = os.getenv("CARECORE_COBRANCAS_SIMULACAO_ATIVA")
    if valor is not None:
        return valor.strip().lower() in {"1", "true", "sim", "yes", "on"}

    app_env = os.getenv("APP_ENV", "local").strip().lower()
    return app_env in {"local", "development", "dev"}


def env_int_cobrancas(nome: str, padrao: int, minimo: int = 1, maximo: int = 31) -> int:
    try:
        valor = int(os.getenv(nome, str(padrao)) or padrao)
    except (TypeError, ValueError):
        valor = padrao
    return max(minimo, min(maximo, valor))


def cobrancas_automacao_config() -> dict:
    fechamento_automatico_ativo = os.getenv(
        "CARECORE_COBRANCAS_FECHAMENTO_AUTOMATICO_ATIVO",
        "false",
    ).strip().lower() in {"1", "true", "sim", "yes", "on"}
    geracao_asaas_automatica = os.getenv(
        "CARECORE_COBRANCAS_GERACAO_ASAAS_AUTOMATICA",
        "false",
    ).strip().lower() in {"1", "true", "sim", "yes", "on"}
    visibilidade_cliente = os.getenv("CARECORE_COBRANCAS_MODULO_CLIENTE_VISIVEL")
    modulo_cliente_visivel = (
        visibilidade_cliente.strip().lower() in {"1", "true", "sim", "yes", "on"}
        if visibilidade_cliente is not None
        else fechamento_automatico_ativo
    )

    return {
        "preparado": True,
        "fechamento_automatico_ativo": fechamento_automatico_ativo,
        "geracao_asaas_automatica": geracao_asaas_automatica,
        "modulo_cliente_visivel": modulo_cliente_visivel,
        "dia_fechamento": env_int_cobrancas("CARECORE_COBRANCAS_DIA_FECHAMENTO", 25),
        "dia_vencimento": env_int_cobrancas("CARECORE_COBRANCAS_DIA_VENCIMENTO", 5),
        "modo": "preparado_desligado",
    }


def exigir_usuario_pode_ver_cobrancas(usuario_atual: dict) -> None:
    if (
        usuario_atual.get("is_global")
        or usuario_eh_gestor(usuario_atual)
        or usuario_eh_manutencao(usuario_atual)
    ):
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Apenas usuários globais da organização e gestores podem acessar cobranças.",
    )


async def obter_organizacao_cobranca_id(
    db: AsyncSession,
    usuario_atual: dict,
    organizacao_id_param: str | None,
) -> str:
    if usuario_atual.get("is_global") or usuario_eh_manutencao(usuario_atual):
        organizacao_id = organizacao_id_param or usuario_atual.get("organizacao_id")
    else:
        organizacao_id = usuario_atual.get("organizacao_id")

    if organizacao_id:
        return str(organizacao_id)

    instituicao_id = usuario_atual.get("instituicao_id")
    if instituicao_id:
        projeto = (
            await db.execute(
                select(InstituicaoDB.organizacao_id).where(InstituicaoDB.id == instituicao_id)
            )
        ).scalar_one_or_none()
        if projeto:
            return str(projeto)

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Organização não identificada para cálculo de cobrança.",
    )


def data_fechamento_padrao(hoje: date | None = None) -> date:
    referencia = hoje or date.today()
    if referencia.day <= 25:
        return referencia.replace(day=25)
    proximo_mes = referencia.month + 1
    ano = referencia.year
    if proximo_mes == 13:
        proximo_mes = 1
        ano += 1
    return date(ano, proximo_mes, 25)


def data_vencimento_ciclo(data_fechamento: date) -> date:
    mes = data_fechamento.month + 1
    ano = data_fechamento.year
    if mes == 13:
        mes = 1
        ano += 1
    return date(ano, mes, 5)


def limpar_documento_asaas(valor: str | None) -> str:
    return "".join(ch for ch in (valor or "") if ch.isdigit())


def status_pagamento_asaas_para_carecore(status_asaas: str | None) -> str:
    status_normalizado = (status_asaas or "").strip().upper()
    if status_normalizado in {"RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"}:
        return "Pago"
    if status_normalizado in {"OVERDUE"}:
        return "Vencido"
    if status_normalizado in {"REFUNDED", "CANCELLED"}:
        return "Cancelado"
    return "Pendente"


def status_asaas_do_webhook(evento_tipo: str, payment: dict) -> str:
    status_payload = str(payment.get("status") or "").strip().upper()
    if status_payload:
        return status_payload

    evento_normalizado = (evento_tipo or "").strip().upper()
    if "OVERDUE" in evento_normalizado:
        return "OVERDUE"
    if "RECEIVED" in evento_normalizado or "CONFIRMED" in evento_normalizado:
        return "RECEIVED"
    if "CANCELLED" in evento_normalizado or "REFUNDED" in evento_normalizado:
        return "CANCELLED"
    return "PENDING"


def extrair_token_webhook_asaas(request: Request) -> str:
    return (
        request.headers.get("asaas-access-token")
        or request.headers.get("x-asaas-webhook-token")
        or request.headers.get("x-carecore-asaas-token")
        or request.query_params.get("token")
        or ""
    ).strip()


def validar_token_webhook_asaas(request: Request) -> None:
    token_configurado = (os.getenv("ASAAS_WEBHOOK_TOKEN") or "").strip()
    app_env = os.getenv("APP_ENV", "local").strip().lower()

    if not token_configurado:
        if app_env in {"local", "development", "dev"}:
            return
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Token do webhook Asaas não configurado.",
        )

    token_recebido = extrair_token_webhook_asaas(request)
    if not token_recebido or not hmac.compare_digest(token_recebido, token_configurado):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token do webhook Asaas inválido.",
        )


def extrair_referencia_ciclo_asaas(payment: dict) -> str | None:
    referencia = str(payment.get("externalReference") or "").strip()
    prefixo = "carecore-ciclo-"
    if referencia.startswith(prefixo):
        return referencia.removeprefix(prefixo)
    return None


def aplicar_status_asaas_no_ciclo(ciclo: CobrancaCicloDB, status_asaas: str) -> None:
    status_carecore = status_pagamento_asaas_para_carecore(status_asaas)
    agora = datetime.utcnow()

    ciclo.status_pagamento = status_carecore
    ciclo.atualizado_em = agora
    if status_carecore == "Pago":
        ciclo.pago_em = agora
        ciclo.cancelado_em = None
    elif status_carecore == "Cancelado":
        ciclo.cancelado_em = agora
        ciclo.pago_em = None
    elif status_carecore in {"Pendente", "Vencido"}:
        ciclo.pago_em = None
        ciclo.cancelado_em = None


def resumo_alerta_cobrancas(ciclos: list[CobrancaCicloDB]) -> dict:
    vencidas = [ciclo for ciclo in ciclos if ciclo.status_pagamento == "Vencido"]
    pendentes = [
        ciclo
        for ciclo in ciclos
        if ciclo.status_pagamento == "Pendente" and ciclo.data_vencimento and ciclo.data_vencimento < date.today()
    ]

    ciclo_critico = None
    if vencidas:
        ciclo_critico = sorted(vencidas, key=lambda item: item.data_vencimento or date.max)[0]
    elif pendentes:
        ciclo_critico = sorted(pendentes, key=lambda item: item.data_vencimento or date.max)[0]

    return {
        "possui_fatura_vencida": bool(vencidas or pendentes),
        "total_faturas_vencidas": len(vencidas) + len(pendentes),
        "ciclo_mais_antigo_vencido_id": getattr(ciclo_critico, "id", None),
        "data_vencimento_mais_antiga": (
            ciclo_critico.data_vencimento.isoformat()
            if ciclo_critico and ciclo_critico.data_vencimento
            else None
        ),
    }


def liberacao_temporaria_ativa(liberacao: CobrancaLiberacaoTemporariaDB | None) -> bool:
    return bool(
        liberacao
        and liberacao.ativo
        and liberacao.liberado_ate
        and liberacao.liberado_ate > datetime.utcnow()
    )


def serializar_liberacao(liberacao: CobrancaLiberacaoTemporariaDB | None) -> dict | None:
    if not liberacao:
        return None

    return {
        "id": liberacao.id,
        "motivo": liberacao.motivo,
        "ativo": bool(liberacao.ativo),
        "liberado_ate": liberacao.liberado_ate.isoformat() if liberacao.liberado_ate else None,
        "criado_em": liberacao.criado_em.isoformat() if liberacao.criado_em else None,
        "revogado_em": liberacao.revogado_em.isoformat() if liberacao.revogado_em else None,
    }


def classificar_status_operacao_financeira(
    ciclos: list[CobrancaCicloDB],
    liberacao: CobrancaLiberacaoTemporariaDB | None,
    dias_tolerancia: int = 5,
) -> dict:
    if liberacao_temporaria_ativa(liberacao):
        return {
            "status": "Liberada temporariamente",
            "tone": "blue",
            "dias_ate_bloqueio": None,
            "motivo": "Liberação temporária ativa.",
        }

    ciclos_abertos = [
        ciclo for ciclo in ciclos if ciclo.status_pagamento in {"Pendente", "Vencido"}
    ]
    vencidos = [ciclo for ciclo in ciclos_abertos if ciclo.status_pagamento == "Vencido"]
    if vencidos:
        ciclo = sorted(vencidos, key=lambda item: item.data_vencimento or date.max)[0]
        return {
            "status": "Bloqueada",
            "tone": "red",
            "dias_ate_bloqueio": 0,
            "motivo": f"Fatura vencida em {ciclo.data_vencimento.isoformat() if ciclo.data_vencimento else 'data não informada'}.",
        }

    pendentes_vencidas = [
        ciclo
        for ciclo in ciclos_abertos
        if ciclo.status_pagamento == "Pendente"
        and ciclo.data_vencimento
        and ciclo.data_vencimento < date.today()
    ]
    if pendentes_vencidas:
        ciclo = sorted(pendentes_vencidas, key=lambda item: item.data_vencimento)[0]
        limite = ciclo.data_vencimento + timedelta(days=dias_tolerancia)
        dias_ate_bloqueio = (limite - date.today()).days
        if dias_ate_bloqueio < 0:
            return {
                "status": "Bloqueada",
                "tone": "red",
                "dias_ate_bloqueio": 0,
                "motivo": "Tolerância de cobrança expirada.",
            }
        return {
            "status": "Em alerta",
            "tone": "amber",
            "dias_ate_bloqueio": dias_ate_bloqueio,
            "motivo": "Fatura pendente dentro da tolerância.",
        }

    pendentes_futuras = [
        ciclo
        for ciclo in ciclos_abertos
        if ciclo.status_pagamento == "Pendente" and ciclo.data_vencimento
    ]
    if pendentes_futuras:
        ciclo = sorted(pendentes_futuras, key=lambda item: item.data_vencimento)[0]
        dias_para_vencer = (ciclo.data_vencimento - date.today()).days
        if dias_para_vencer <= 3:
            return {
                "status": "Perto do vencimento",
                "tone": "amber",
                "dias_ate_bloqueio": dias_para_vencer + dias_tolerancia,
                "motivo": "Fatura próxima do vencimento.",
            }
        return {
            "status": "Pendente",
            "tone": "slate",
            "dias_ate_bloqueio": dias_para_vencer + dias_tolerancia,
            "motivo": "Fatura pendente ainda dentro do prazo.",
        }

    return {
        "status": "Em dia",
        "tone": "green",
        "dias_ate_bloqueio": None,
        "motivo": "Sem faturas bloqueantes.",
    }


def serializar_ciclo(ciclo: CobrancaCicloDB, rateios: list[CobrancaProjetoRateioDB] | None = None) -> dict:
    return {
        "id": ciclo.id,
        "organizacao_id": ciclo.organizacao_id,
        "data_fechamento": ciclo.data_fechamento.isoformat() if ciclo.data_fechamento else None,
        "data_corte_inativacao": ciclo.data_corte_inativacao.isoformat() if ciclo.data_corte_inativacao else None,
        "data_vencimento": ciclo.data_vencimento.isoformat() if ciclo.data_vencimento else None,
        "modo": ciclo.modo,
        "total_cadastros_faturaveis": ciclo.total_cadastros_faturaveis,
        "valor_total_mensalidade": ciclo.valor_total_mensalidade,
        "status": ciclo.status,
        "status_pagamento": ciclo.status_pagamento,
        "asaas_payment_id": ciclo.asaas_payment_id,
        "invoice_url": ciclo.asaas_invoice_url,
        "bank_slip_url": ciclo.asaas_bank_slip_url,
        "pago_em": ciclo.pago_em.isoformat() if ciclo.pago_em else None,
        "projetos": [
            {
                "projeto_id": rateio.instituicao_id,
                "projeto_nome": rateio.projeto_nome,
                "conviventes_faturaveis": rateio.conviventes_faturaveis,
                "usuarios_faturaveis": rateio.usuarios_faturaveis,
                "cadastros_faturaveis": rateio.cadastros_faturaveis,
                "percentual_rateio": rateio.percentual_rateio,
                "valor_mensalidade": rateio.valor_mensalidade,
            }
            for rateio in (rateios or [])
        ],
    }


def montar_cliente_asaas_organizacao(organizacao: OrganizacaoDB) -> dict:
    documento = limpar_documento_asaas(organizacao.cnpj)
    if len(documento) not in {11, 14}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A organização precisa ter CPF/CNPJ válido para gerar cobrança Asaas.",
        )

    dados_cliente = {
        "name": organizacao.nome.strip(),
        "cpfCnpj": documento,
        "externalReference": f"carecore-organizacao-{organizacao.id}",
        "notificationDisabled": True,
    }
    if organizacao.email:
        dados_cliente["email"] = organizacao.email.strip()

    return dados_cliente


async def calcular_resumo_cobranca_organizacao(
    db: AsyncSession,
    usuario_atual: dict,
    data_fechamento: date | None,
    organizacao_id: str | None,
) -> dict:
    data_fechamento_calculo = data_fechamento or data_fechamento_padrao()
    data_corte_inativacao = data_fechamento_calculo - timedelta(days=DIAS_ANTECEDENCIA_EXCLUSAO_INATIVO)
    data_vencimento = data_vencimento_ciclo(data_fechamento_calculo)
    organizacao_id_escopo = await obter_organizacao_cobranca_id(db, usuario_atual, organizacao_id)

    organizacao = (
        await db.execute(
            select(OrganizacaoDB).where(OrganizacaoDB.id == organizacao_id_escopo)
        )
    ).scalar_one_or_none()

    projetos = (
        await db.execute(
            select(InstituicaoDB)
            .where(
                InstituicaoDB.organizacao_id == organizacao_id_escopo,
                InstituicaoDB.is_active == True,  # noqa: E712
            )
            .order_by(InstituicaoDB.nome_fantasia)
        )
    ).scalars().all()

    projetos_para_rateio = []
    for projeto in projetos:
        conviventes = (
            await db.execute(
                select(
                    ConviventeDB.status,
                    ConviventeDB.inativado_em,
                ).where(ConviventeDB.instituicao_id == projeto.id)
            )
        ).all()
        cadastros_faturaveis = sum(
            1
            for status_convivente, inativado_em in conviventes
            if convivente_conta_para_faturamento(
                status=status_convivente or "",
                inativado_em=inativado_em,
                data_fechamento=data_fechamento_calculo,
            )
        )
        usuarios = (
            await db.execute(
                select(
                    UsuarioDB.ativo,
                    UsuarioDB.inativado_em,
                ).where(
                    UsuarioDB.instituicao_id == projeto.id,
                    UsuarioDB.perfil_acesso != "Manutenção",
                )
            )
        ).all()
        usuarios_faturaveis = sum(
            1
            for ativo, inativado_em in usuarios
            if usuario_conta_para_faturamento(
                ativo=bool(ativo),
                inativado_em=inativado_em,
                data_fechamento=data_fechamento_calculo,
            )
        )
        projetos_para_rateio.append({
            "projeto_id": projeto.id,
            "projeto_nome": projeto.nome_fantasia,
            "conviventes_faturaveis": cadastros_faturaveis,
            "usuarios_faturaveis": usuarios_faturaveis,
            "cadastros_faturaveis": cadastros_faturaveis + usuarios_faturaveis,
        })

    rateio = calcular_rateio_organizacao(projetos_para_rateio)

    return {
        "organizacao_id": organizacao_id_escopo,
        "organizacao_nome": getattr(organizacao, "nome", None),
        "data_fechamento": data_fechamento_calculo.isoformat(),
        "data_corte_inativacao": data_corte_inativacao.isoformat(),
        "data_vencimento": data_vencimento.isoformat(),
        "dias_corte_inativacao": DIAS_ANTECEDENCIA_EXCLUSAO_INATIVO,
        **rateio,
    }


@router.get("/organizacao/resumo")
async def resumo_cobranca_organizacao(
    data_fechamento: date | None = Query(None),
    organizacao_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    exigir_usuario_pode_ver_cobrancas(usuario_atual)
    return await calcular_resumo_cobranca_organizacao(
        db,
        usuario_atual,
        data_fechamento,
        organizacao_id,
    )


@router.get("/modulo/status")
async def status_modulo_cobrancas(
    usuario_atual: dict = Depends(get_usuario_logado),
):
    config = cobrancas_automacao_config()
    manutencao = usuario_eh_manutencao(usuario_atual)
    return {
        "preparado": config["preparado"],
        "cliente_visivel": bool(config["modulo_cliente_visivel"]),
        "manutencao_visivel": manutencao,
        "fechamento_automatico_ativo": config["fechamento_automatico_ativo"],
        "geracao_asaas_automatica": config["geracao_asaas_automatica"],
    }


@router.post("/asaas/webhook")
async def webhook_asaas_cobrancas(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    validar_token_webhook_asaas(request)

    payload = await request.json()
    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payload do webhook Asaas inválido.",
        )

    evento_tipo = str(payload.get("event") or payload.get("type") or "").strip() or "UNKNOWN"
    payment = payload.get("payment") or {}
    if not isinstance(payment, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payload do webhook Asaas sem dados de pagamento.",
        )

    payment_id = str(payment.get("id") or "").strip()
    ciclo_id_referencia = extrair_referencia_ciclo_asaas(payment)
    ciclo = None

    if payment_id:
        ciclo = (
            await db.execute(
                select(CobrancaCicloDB).where(CobrancaCicloDB.asaas_payment_id == payment_id)
            )
        ).scalar_one_or_none()

    if not ciclo and ciclo_id_referencia:
        ciclo = (
            await db.execute(
                select(CobrancaCicloDB).where(CobrancaCicloDB.id == ciclo_id_referencia)
            )
        ).scalar_one_or_none()

    if not ciclo:
        evento_id_sem_ciclo = str(payload.get("id") or f"webhook-sem-ciclo-{uuid.uuid4()}")
        evento_existente = (
            await db.execute(
                select(CobrancaEventoAsaasDB).where(CobrancaEventoAsaasDB.asaas_event_id == evento_id_sem_ciclo)
            )
        ).scalar_one_or_none()
        if evento_existente:
            return {
                "ok": True,
                "ciclo_encontrado": False,
                "duplicado": True,
            }

        evento = CobrancaEventoAsaasDB(
            ciclo_id=None,
            organizacao_id=None,
            asaas_event_id=evento_id_sem_ciclo,
            evento_tipo=evento_tipo,
            payload=json.dumps(payload, ensure_ascii=False),
            recebido_em=datetime.utcnow(),
        )
        db.add(evento)
        await db.commit()
        return {
            "ok": True,
            "ciclo_encontrado": False,
        }

    aplicar_status_asaas_no_ciclo(ciclo, status_asaas_do_webhook(evento_tipo, payment))
    if payment_id and not ciclo.asaas_payment_id:
        ciclo.asaas_payment_id = payment_id
    ciclo.asaas_invoice_url = payment.get("invoiceUrl") or ciclo.asaas_invoice_url
    ciclo.asaas_bank_slip_url = payment.get("bankSlipUrl") or ciclo.asaas_bank_slip_url

    evento_id = str(payload.get("id") or f"{evento_tipo}-{payment_id or ciclo.id}-{uuid.uuid4()}")
    evento_existente = (
        await db.execute(
            select(CobrancaEventoAsaasDB).where(CobrancaEventoAsaasDB.asaas_event_id == evento_id)
        )
    ).scalar_one_or_none()
    if not evento_existente:
        evento = CobrancaEventoAsaasDB(
            ciclo_id=ciclo.id,
            organizacao_id=ciclo.organizacao_id,
            asaas_event_id=evento_id,
            evento_tipo=evento_tipo,
            payload=json.dumps(payload, ensure_ascii=False),
            recebido_em=datetime.utcnow(),
        )
        db.add(evento)

    await db.commit()
    await db.refresh(ciclo)

    return {
        "ok": True,
        "ciclo_encontrado": True,
        "ciclo": serializar_ciclo(ciclo),
    }


@router.get("/admin/operacao")
async def painel_operacao_financeira(
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    exigir_usuario_manutencao_financeira(usuario_atual)

    organizacoes = (
        await db.execute(select(OrganizacaoDB).order_by(OrganizacaoDB.nome))
    ).scalars().all()

    itens = []
    totais = {
        "organizacoes": 0,
        "em_dia": 0,
        "pendentes": 0,
        "alertas": 0,
        "bloqueadas": 0,
        "liberadas_temporariamente": 0,
        "pagamentos_efetuados": 0,
        "valor_total_pendente": 0,
    }

    for organizacao in organizacoes:
        projetos = (
            await db.execute(
                select(InstituicaoDB).where(InstituicaoDB.organizacao_id == organizacao.id)
            )
        ).scalars().all()
        ciclos = (
            await db.execute(
                select(CobrancaCicloDB)
                .where(CobrancaCicloDB.organizacao_id == organizacao.id)
                .order_by(CobrancaCicloDB.data_fechamento.desc())
            )
        ).scalars().all()
        liberacao = (
            await db.execute(
                select(CobrancaLiberacaoTemporariaDB)
                .where(CobrancaLiberacaoTemporariaDB.organizacao_id == organizacao.id)
                .order_by(CobrancaLiberacaoTemporariaDB.criado_em.desc())
            )
        ).scalars().first()

        ciclo_atual = ciclos[0] if ciclos else None
        status_operacao = classificar_status_operacao_financeira(ciclos, liberacao)
        total_pendente = sum(
            float(ciclo.valor_total_mensalidade or 0)
            for ciclo in ciclos
            if ciclo.status_pagamento in {"Pendente", "Vencido"}
        )
        pagamentos_efetuados = sum(1 for ciclo in ciclos if ciclo.status_pagamento == "Pago")

        totais["organizacoes"] += 1
        totais["pagamentos_efetuados"] += pagamentos_efetuados
        totais["valor_total_pendente"] += total_pendente
        if status_operacao["status"] == "Em dia":
            totais["em_dia"] += 1
        elif status_operacao["status"] in {"Pendente", "Perto do vencimento"}:
            totais["pendentes"] += 1
        elif status_operacao["status"] == "Em alerta":
            totais["alertas"] += 1
        elif status_operacao["status"] == "Bloqueada":
            totais["bloqueadas"] += 1
        elif status_operacao["status"] == "Liberada temporariamente":
            totais["liberadas_temporariamente"] += 1

        itens.append({
            "organizacao_id": organizacao.id,
            "organizacao_nome": organizacao.nome,
            "cnpj": organizacao.cnpj,
            "email": organizacao.email,
            "projetos_total": len(projetos),
            "projetos_ativos": sum(1 for projeto in projetos if projeto.is_active),
            "status_operacao": status_operacao,
            "liberacao_temporaria": serializar_liberacao(liberacao),
            "ciclo_atual": serializar_ciclo(ciclo_atual) if ciclo_atual else None,
            "faturas": {
                "total": len(ciclos),
                "pendentes": sum(1 for ciclo in ciclos if ciclo.status_pagamento == "Pendente"),
                "vencidas": sum(1 for ciclo in ciclos if ciclo.status_pagamento == "Vencido"),
                "pagas": pagamentos_efetuados,
                "canceladas": sum(1 for ciclo in ciclos if ciclo.status_pagamento == "Cancelado"),
                "valor_pendente": total_pendente,
            },
            "ultimas_faturas": [serializar_ciclo(ciclo) for ciclo in ciclos[:4]],
        })

    return {
        "totais": totais,
        "itens": itens,
        "automacao": cobrancas_automacao_config(),
    }


@router.post("/admin/organizacoes/{organizacao_id}/liberacao-temporaria")
async def criar_liberacao_temporaria_cobranca(
    organizacao_id: str,
    payload: LiberacaoTemporariaRequest,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    exigir_usuario_manutencao_financeira(usuario_atual)

    organizacao = (
        await db.execute(select(OrganizacaoDB).where(OrganizacaoDB.id == organizacao_id))
    ).scalar_one_or_none()
    if not organizacao:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organização não encontrada.")

    agora = datetime.utcnow()
    liberacoes_ativas = (
        await db.execute(
            select(CobrancaLiberacaoTemporariaDB).where(
                CobrancaLiberacaoTemporariaDB.organizacao_id == organizacao_id,
                CobrancaLiberacaoTemporariaDB.ativo == True,  # noqa: E712
                CobrancaLiberacaoTemporariaDB.liberado_ate > agora,
            )
        )
    ).scalars().all()
    for liberacao_antiga in liberacoes_ativas:
        liberacao_antiga.ativo = False
        liberacao_antiga.revogado_por_id = usuario_atual.get("sub") or usuario_atual.get("id")
        liberacao_antiga.revogado_em = agora
        liberacao_antiga.observacao_revogacao = "Substituída por nova liberação temporária."

    liberacao = CobrancaLiberacaoTemporariaDB(
        organizacao_id=organizacao_id,
        motivo=payload.motivo.strip(),
        liberado_ate=agora + timedelta(days=payload.dias),
        ativo=True,
        criado_por_id=usuario_atual.get("sub") or usuario_atual.get("id"),
        criado_em=agora,
    )
    db.add(liberacao)
    await db.commit()
    await db.refresh(liberacao)

    return {
        "ok": True,
        "liberacao": serializar_liberacao(liberacao),
    }


@router.post("/admin/liberacoes/{liberacao_id}/revogar")
async def revogar_liberacao_temporaria_cobranca(
    liberacao_id: str,
    payload: RevogarLiberacaoRequest,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    exigir_usuario_manutencao_financeira(usuario_atual)

    liberacao = (
        await db.execute(
            select(CobrancaLiberacaoTemporariaDB).where(CobrancaLiberacaoTemporariaDB.id == liberacao_id)
        )
    ).scalar_one_or_none()
    if not liberacao:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Liberação não encontrada.")

    liberacao.ativo = False
    liberacao.revogado_por_id = usuario_atual.get("sub") or usuario_atual.get("id")
    liberacao.revogado_em = datetime.utcnow()
    liberacao.observacao_revogacao = payload.motivo.strip()

    await db.commit()
    await db.refresh(liberacao)

    return {
        "ok": True,
        "liberacao": serializar_liberacao(liberacao),
    }


@router.get("/organizacao/historico")
async def listar_historico_cobrancas_organizacao(
    limite: int = Query(12, ge=1, le=36),
    organizacao_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    exigir_usuario_pode_ver_cobrancas(usuario_atual)
    organizacao_id_escopo = await obter_organizacao_cobranca_id(db, usuario_atual, organizacao_id)

    ciclos = (
        await db.execute(
            select(CobrancaCicloDB)
            .where(CobrancaCicloDB.organizacao_id == organizacao_id_escopo)
            .order_by(CobrancaCicloDB.data_fechamento.desc())
            .limit(limite)
        )
    ).scalars().all()

    itens = []
    for ciclo in ciclos:
        rateios = (
            await db.execute(
                select(CobrancaProjetoRateioDB)
                .where(CobrancaProjetoRateioDB.ciclo_id == ciclo.id)
                .order_by(CobrancaProjetoRateioDB.projeto_nome)
            )
        ).scalars().all()
        itens.append(serializar_ciclo(ciclo, list(rateios)))

    return {
        "organizacao_id": organizacao_id_escopo,
        "alerta": resumo_alerta_cobrancas(list(ciclos)),
        "itens": itens,
    }


@router.post("/organizacao/ciclos/fechar")
async def fechar_ciclo_cobranca_organizacao(
    data_fechamento: date | None = Query(None),
    organizacao_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    exigir_usuario_financeiro_global(usuario_atual)
    resumo = await calcular_resumo_cobranca_organizacao(
        db,
        usuario_atual,
        data_fechamento,
        organizacao_id,
    )

    ciclo = (
        await db.execute(
            select(CobrancaCicloDB).where(
                CobrancaCicloDB.organizacao_id == resumo["organizacao_id"],
                CobrancaCicloDB.data_fechamento == date.fromisoformat(resumo["data_fechamento"]),
            )
        )
    ).scalar_one_or_none()

    agora = datetime.utcnow()
    if not ciclo:
        ciclo = CobrancaCicloDB(
            organizacao_id=resumo["organizacao_id"],
            data_fechamento=date.fromisoformat(resumo["data_fechamento"]),
            data_corte_inativacao=date.fromisoformat(resumo["data_corte_inativacao"]),
            data_vencimento=date.fromisoformat(resumo["data_vencimento"]),
            criado_por_id=usuario_atual.get("sub") or usuario_atual.get("id"),
            criado_em=agora,
        )
        db.add(ciclo)
    else:
        if ciclo.asaas_payment_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Este ciclo já possui cobrança vinculada ao Asaas e não pode ser recalculado.",
            )
        ciclo.atualizado_em = agora

    ciclo.modo = resumo["modo"]
    ciclo.total_cadastros_faturaveis = resumo["total_cadastros_faturaveis"]
    ciclo.valor_total_mensalidade = resumo["valor_total_mensalidade"]
    ciclo.status = "Calculado"
    ciclo.status_pagamento = ciclo.status_pagamento or "Pendente"

    await db.flush()
    await db.execute(delete(CobrancaProjetoRateioDB).where(CobrancaProjetoRateioDB.ciclo_id == ciclo.id))

    rateios_criados = []
    for projeto in resumo["projetos"]:
        rateio = CobrancaProjetoRateioDB(
            ciclo_id=ciclo.id,
            organizacao_id=resumo["organizacao_id"],
            instituicao_id=projeto["projeto_id"],
            projeto_nome=projeto["projeto_nome"],
            conviventes_faturaveis=projeto.get("conviventes_faturaveis") or 0,
            usuarios_faturaveis=projeto.get("usuarios_faturaveis") or 0,
            cadastros_faturaveis=projeto.get("cadastros_faturaveis") or 0,
            percentual_rateio=projeto.get("percentual_rateio"),
            valor_mensalidade=projeto.get("valor_mensalidade") or 0,
        )
        db.add(rateio)
        rateios_criados.append(rateio)

    await db.commit()
    await db.refresh(ciclo)

    return {
        "ok": True,
        "ciclo": serializar_ciclo(ciclo, rateios_criados),
    }


@router.post("/organizacao/ciclos/{ciclo_id}/gerar-cobranca-asaas")
async def gerar_cobranca_asaas_ciclo(
    ciclo_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    exigir_usuario_financeiro_global(usuario_atual)

    ciclo = (
        await db.execute(select(CobrancaCicloDB).where(CobrancaCicloDB.id == ciclo_id))
    ).scalar_one_or_none()
    if not ciclo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ciclo de cobrança não encontrado.",
        )
    if ciclo.asaas_payment_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este ciclo já possui cobrança Asaas vinculada.",
        )
    if not ciclo.valor_total_mensalidade or ciclo.valor_total_mensalidade <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ciclo sem valor de mensalidade para cobrança.",
        )

    organizacao = (
        await db.execute(
            select(OrganizacaoDB).where(OrganizacaoDB.id == ciclo.organizacao_id)
        )
    ).scalar_one_or_none()
    if not organizacao:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organização do ciclo não encontrada.",
        )

    try:
        cliente = AsaasClient()
        if cliente.config.ambiente != "sandbox":
            raise AsaasConfigErro(
                "Nesta fase, cobranças de ciclo só podem ser geradas no ambiente Sandbox."
            )

        dados_cliente = montar_cliente_asaas_organizacao(organizacao)
        cliente_asaas = await asyncio.to_thread(cliente.criar_cliente, dados_cliente)
        cliente_id = cliente_asaas.get("id")
        if not cliente_id:
            raise AsaasErro(None, "Asaas não retornou o identificador do cliente.")

        referencia = f"carecore-ciclo-{ciclo.id}"
        dados_cobranca = {
            "customer": cliente_id,
            "billingType": "UNDEFINED",
            "value": round(float(ciclo.valor_total_mensalidade), 2),
            "dueDate": ciclo.data_vencimento.isoformat(),
            "description": (
                f"Mensalidade CareCore+ - {organizacao.nome} - "
                f"ciclo {ciclo.data_fechamento.strftime('%m/%Y')}"
            ),
            "externalReference": referencia,
        }
        cobranca_asaas = await asyncio.to_thread(cliente.criar_cobranca, dados_cobranca)
    except AsaasConfigErro as erro:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(erro),
        ) from erro
    except AsaasErro as erro:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(erro),
        ) from erro

    payment_id = cobranca_asaas.get("id")
    if not payment_id:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Asaas não retornou o identificador da cobrança.",
        )

    ciclo.asaas_customer_id = cliente_id
    ciclo.asaas_payment_id = payment_id
    ciclo.asaas_invoice_url = cobranca_asaas.get("invoiceUrl")
    ciclo.asaas_bank_slip_url = cobranca_asaas.get("bankSlipUrl")
    ciclo.status = "CobrancaGerada"
    ciclo.status_pagamento = status_pagamento_asaas_para_carecore(cobranca_asaas.get("status"))
    ciclo.atualizado_em = datetime.utcnow()

    await db.commit()
    await db.refresh(ciclo)

    rateios = (
        await db.execute(
            select(CobrancaProjetoRateioDB)
            .where(CobrancaProjetoRateioDB.ciclo_id == ciclo.id)
            .order_by(CobrancaProjetoRateioDB.projeto_nome)
        )
    ).scalars().all()

    return {
        "ok": True,
        "ambiente": cliente.config.ambiente,
        "ciclo": serializar_ciclo(ciclo, list(rateios)),
        "cobranca": {
            "id": payment_id,
            "status": cobranca_asaas.get("status"),
            "billing_type": cobranca_asaas.get("billingType"),
            "valor": cobranca_asaas.get("value"),
            "vencimento": cobranca_asaas.get("dueDate"),
            "invoice_url": cobranca_asaas.get("invoiceUrl"),
            "bank_slip_url": cobranca_asaas.get("bankSlipUrl"),
        },
    }


@router.post("/organizacao/ciclos/{ciclo_id}/simular-status")
async def simular_status_cobranca_ciclo(
    ciclo_id: str,
    payload: SimularStatusCobrancaRequest,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    exigir_usuario_financeiro_global(usuario_atual)
    if not simulacoes_cobranca_ativas():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Simulação de status desativada neste ambiente.",
        )

    ciclo = (
        await db.execute(select(CobrancaCicloDB).where(CobrancaCicloDB.id == ciclo_id))
    ).scalar_one_or_none()
    if not ciclo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ciclo de cobrança não encontrado.",
        )

    aplicar_status_asaas_no_ciclo(ciclo, payload.status_asaas)

    evento_payload = {
        "simulado": True,
        "payment": {
            "id": ciclo.asaas_payment_id,
            "status": payload.status_asaas,
            "externalReference": f"carecore-ciclo-{ciclo.id}",
        },
        "origem": "carecore-local-sandbox",
    }
    evento = CobrancaEventoAsaasDB(
        ciclo_id=ciclo.id,
        organizacao_id=ciclo.organizacao_id,
        asaas_event_id=f"sim-{ciclo.id}-{payload.status_asaas.lower()}-{uuid.uuid4()}",
        evento_tipo=f"PAYMENT_{payload.status_asaas}",
        payload=json.dumps(evento_payload, ensure_ascii=False),
        recebido_em=datetime.utcnow(),
    )
    db.add(evento)

    await db.commit()
    await db.refresh(ciclo)

    rateios = (
        await db.execute(
            select(CobrancaProjetoRateioDB)
            .where(CobrancaProjetoRateioDB.ciclo_id == ciclo.id)
            .order_by(CobrancaProjetoRateioDB.projeto_nome)
        )
    ).scalars().all()

    return {
        "ok": True,
        "simulado": True,
        "ciclo": serializar_ciclo(ciclo, list(rateios)),
    }


@router.get("/asaas/status")
async def status_integracao_asaas(
    usuario_atual: dict = Depends(get_usuario_logado),
):
    exigir_usuario_financeiro_global(usuario_atual)
    config = obter_config_asaas()

    valido = False
    mensagem = "Asaas configurado."
    try:
        validar_config_asaas(config)
        valido = True
    except AsaasConfigErro as erro:
        mensagem = str(erro)

    return {
        "provedor": "asaas",
        "ambiente": config.ambiente,
        "base_url": config.base_url,
        "base_url_esperada": ASAAS_URLS[config.ambiente],
        "configurado": config.configurado,
        "valido": valido,
        "api_key_mascarada": config.api_key_mascarada,
        "mensagem": mensagem,
        "simulacao_ativa": simulacoes_cobranca_ativas(),
        "webhook_configurado": bool((os.getenv("ASAAS_WEBHOOK_TOKEN") or "").strip()),
        "automacao": cobrancas_automacao_config(),
    }


@router.post("/asaas/testar-conexao")
async def testar_conexao_asaas(
    usuario_atual: dict = Depends(get_usuario_logado),
):
    exigir_usuario_financeiro_global(usuario_atual)

    try:
        cliente = AsaasClient()
        resposta = await asyncio.to_thread(cliente.testar_conexao)
    except AsaasConfigErro as erro:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(erro),
        ) from erro
    except AsaasErro as erro:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(erro),
        ) from erro

    return {
        "ok": True,
        "ambiente": cliente.config.ambiente,
        "base_url": cliente.config.base_url,
        "total_clientes_amostra": len(resposta.get("data", [])) if isinstance(resposta, dict) else 0,
    }


@router.post("/asaas/sandbox/cobranca-teste")
async def criar_cobranca_teste_sandbox(
    payload: CobrancaTesteAsaasRequest,
    usuario_atual: dict = Depends(get_usuario_logado),
):
    exigir_usuario_financeiro_global(usuario_atual)

    try:
        cliente = AsaasClient()
        if cliente.config.ambiente != "sandbox":
            raise AsaasConfigErro("Cobranças teste só podem ser criadas no ambiente Sandbox.")

        vencimento = payload.vencimento or (date.today() + timedelta(days=5))
        referencia = f"carecore-sandbox-{uuid.uuid4()}"

        dados_cliente = {
            "name": payload.nome_cliente.strip(),
            "cpfCnpj": payload.cpf_cnpj,
            "externalReference": referencia,
            "notificationDisabled": True,
        }
        if payload.email:
            dados_cliente["email"] = payload.email.strip()

        cliente_asaas = await asyncio.to_thread(cliente.criar_cliente, dados_cliente)
        cliente_id = cliente_asaas.get("id")
        if not cliente_id:
            raise AsaasErro(None, "Asaas não retornou o identificador do cliente teste.")

        dados_cobranca = {
            "customer": cliente_id,
            "billingType": payload.billing_type,
            "value": round(float(payload.valor), 2),
            "dueDate": vencimento.isoformat(),
            "description": "Cobrança teste CareCore+ Sandbox",
            "externalReference": referencia,
        }
        cobranca_asaas = await asyncio.to_thread(cliente.criar_cobranca, dados_cobranca)
    except AsaasConfigErro as erro:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(erro),
        ) from erro
    except AsaasErro as erro:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(erro),
        ) from erro

    return {
        "ok": True,
        "ambiente": cliente.config.ambiente,
        "cliente": {
            "id": cliente_id,
            "nome": cliente_asaas.get("name"),
        },
        "cobranca": {
            "id": cobranca_asaas.get("id"),
            "status": cobranca_asaas.get("status"),
            "billing_type": cobranca_asaas.get("billingType"),
            "valor": cobranca_asaas.get("value"),
            "vencimento": cobranca_asaas.get("dueDate"),
            "invoice_url": cobranca_asaas.get("invoiceUrl"),
            "bank_slip_url": cobranca_asaas.get("bankSlipUrl"),
        },
    }
