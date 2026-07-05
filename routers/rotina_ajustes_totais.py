from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from audit_log import registrar_evento_auditoria
from database import get_db
from rotina_ajustes_totais import (
    JUSTIFICATIVA_AJUSTE_MIN_CHARS,
    data_operacional_hoje,
    mes_tem_importacao_sisa,
    montar_itens_painel_dia,
    obter_ajustes_por_tipo_dia,
    validar_data_ajuste_permitida,
)
from config_operacional import obter_tipos_ajuste_totais
from config_operacional_service import carregar_config_operacional_instituicao
from models import RotinaAjusteDiarioDB
from schemas import (
    RotinaAjusteDiarioItemResponse,
    RotinaAjusteDiarioPainelResponse,
    RotinaAjusteDiarioSalvarRequest,
)
from security import (
    bloquear_usuario_global_puro,
    get_usuario_logado,
    usuario_eh_gestor,
    usuario_eh_manutencao,
)
from tenant_scope import obter_instituicao_escopo
from time_operacional import agora_operacional_naive


router = APIRouter(prefix="/ajustes-totais", tags=["Rotina — Ajustes de totais"])


def _exigir_gestor_ajuste_totais(usuario_atual: dict) -> None:
    if usuario_eh_gestor(usuario_atual) or usuario_eh_manutencao(usuario_atual):
        return
    raise HTTPException(
        status_code=403,
        detail="Apenas Gestor pode lançar ajustes manuais de totais da rotina.",
    )


def _parse_data_referencia(valor: str) -> date:
    try:
        return date.fromisoformat((valor or "").strip())
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail="Data inválida. Use o formato AAAA-MM-DD.",
        ) from exc


@router.get("/dia", response_model=RotinaAjusteDiarioPainelResponse)
async def obter_painel_ajustes_dia(
    data: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    bloquear_usuario_global_puro(usuario_atual)
    _exigir_gestor_ajuste_totais(usuario_atual)

    instituicao_id = obter_instituicao_escopo(usuario_atual)
    config_operacional, _, _ = await carregar_config_operacional_instituicao(db, instituicao_id)
    tipos_ajuste = obter_tipos_ajuste_totais(config_operacional)
    tipos_ajuste_set = frozenset(tipos_ajuste)
    data_referencia = _parse_data_referencia(data)

    bloqueado_sisa = await mes_tem_importacao_sisa(db, instituicao_id, data_referencia)
    itens_db = await montar_itens_painel_dia(
        db, instituicao_id, data_referencia, tipos_ajuste=tipos_ajuste
    )
    ajustes = await obter_ajustes_por_tipo_dia(db, instituicao_id, data_referencia)
    justificativa_existente = next(
        (item.justificativa for item in ajustes.values() if (item.justificativa or "").strip()),
        None,
    )

    return RotinaAjusteDiarioPainelResponse(
        data_referencia=data_referencia,
        bloqueado=bloqueado_sisa or data_referencia >= data_operacional_hoje(),
        motivo_bloqueio=(
            "Este mês já possui importação SISA. Ajustes manuais estão bloqueados."
            if bloqueado_sisa
            else (
                "Só é possível ajustar dias já encerrados (anteriores a hoje)."
                if data_referencia >= data_operacional_hoje()
                else None
            )
        ),
        justificativa_existente=justificativa_existente,
        itens=[RotinaAjusteDiarioItemResponse(**item) for item in itens_db],
        tem_ajuste_manual=any(item["ajuste_manual"] > 0 for item in itens_db),
    )


@router.post("/dia", response_model=RotinaAjusteDiarioPainelResponse)
async def salvar_ajustes_dia(
    payload: RotinaAjusteDiarioSalvarRequest,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    bloquear_usuario_global_puro(usuario_atual)
    _exigir_gestor_ajuste_totais(usuario_atual)

    instituicao_id = obter_instituicao_escopo(usuario_atual)
    config_operacional, _, _ = await carregar_config_operacional_instituicao(db, instituicao_id)
    tipos_ajuste = obter_tipos_ajuste_totais(config_operacional)
    tipos_ajuste_set = frozenset(tipos_ajuste)
    data_referencia = payload.data_referencia

    try:
        validar_data_ajuste_permitida(data_referencia)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if await mes_tem_importacao_sisa(db, instituicao_id, data_referencia):
        raise HTTPException(
            status_code=409,
            detail="Este mês já possui importação SISA. Ajustes manuais estão bloqueados.",
        )

    justificativa = (payload.justificativa or "").strip()
    if len(justificativa) < JUSTIFICATIVA_AJUSTE_MIN_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"Informe uma justificativa com pelo menos {JUSTIFICATIVA_AJUSTE_MIN_CHARS} caracteres.",
        )

    ajustes_map = {item.tipo_registro: item for item in payload.ajustes}
    for tipo in ajustes_map:
        if tipo not in tipos_ajuste_set:
            raise HTTPException(status_code=400, detail=f"Tipo de ajuste inválido: {tipo}.")

    existentes = await obter_ajustes_por_tipo_dia(db, instituicao_id, data_referencia)
    agora = agora_operacional_naive()

    for tipo in tipos_ajuste:
        item = ajustes_map.get(tipo)
        quantidade = int(item.quantidade_ajuste if item else 0)
        if quantidade < 0:
            raise HTTPException(
                status_code=400,
                detail=f"Quantidade de ajuste inválida para {tipo}.",
            )

        registro = existentes.get(tipo)
        if quantidade == 0:
            if registro:
                await db.delete(registro)
            continue

        if registro:
            registro.quantidade_ajuste = quantidade
            registro.justificativa = justificativa
            registro.usuario_id = usuario_atual["sub"]
            registro.atualizado_em = agora
        else:
            db.add(
                RotinaAjusteDiarioDB(
                    instituicao_id=instituicao_id,
                    data_referencia=data_referencia,
                    tipo_registro=tipo,
                    quantidade_ajuste=quantidade,
                    justificativa=justificativa,
                    usuario_id=usuario_atual["sub"],
                    criado_em=agora,
                    atualizado_em=agora,
                )
            )

    await db.commit()

    registrar_evento_auditoria(
        "rotina_ajuste_totais_dia",
        usuario_atual=usuario_atual,
        data_referencia=data_referencia.isoformat(),
        ajustes=[
            {
                "tipo_registro": tipo,
                "quantidade_ajuste": int(ajustes_map[tipo].quantidade_ajuste),
            }
            for tipo in ajustes_map
            if int(ajustes_map[tipo].quantidade_ajuste) > 0
        ],
    )

    itens_db = await montar_itens_painel_dia(
        db, instituicao_id, data_referencia, tipos_ajuste=tipos_ajuste
    )
    ajustes = await obter_ajustes_por_tipo_dia(db, instituicao_id, data_referencia)

    return RotinaAjusteDiarioPainelResponse(
        data_referencia=data_referencia,
        bloqueado=False,
        motivo_bloqueio=None,
        justificativa_existente=justificativa,
        itens=[RotinaAjusteDiarioItemResponse(**item) for item in itens_db],
        tem_ajuste_manual=any(item["ajuste_manual"] > 0 for item in itens_db),
    )
