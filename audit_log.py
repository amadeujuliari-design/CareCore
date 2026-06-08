import logging
from typing import Any


audit_logger = logging.getLogger("carecore.audit")
audit_logger.setLevel(logging.INFO)

_CAMPOS_SENSIVEIS = {
    "senha",
    "senha_atual",
    "nova_senha",
    "senha_hash",
    "cpf",
    "rg",
    "token",
    "access_token",
}


def _valor_seguro(valor: Any) -> Any:
    if isinstance(valor, (str, int, float, bool)) or valor is None:
        return valor

    return str(valor)


def _limpar_dados(dados: dict[str, Any]) -> dict[str, Any]:
    return {
        chave: _valor_seguro(valor)
        for chave, valor in dados.items()
        if valor is not None and chave not in _CAMPOS_SENSIVEIS
    }


def registrar_evento_auditoria(
    evento: str,
    *,
    usuario_atual: dict | None = None,
    **dados: Any,
) -> None:
    contexto = _limpar_dados(dados)

    if usuario_atual:
        contexto.update(
            _limpar_dados({
                "ator_id": usuario_atual.get("sub") or usuario_atual.get("id") or usuario_atual.get("usuario_id"),
                "ator_perfil": usuario_atual.get("perfil_acesso"),
                "instituicao_id": usuario_atual.get("instituicao_id"),
                "organizacao_id": usuario_atual.get("organizacao_id"),
                "ator_global": usuario_atual.get("is_global"),
            })
        )

    audit_logger.info(
        "evento_auditoria",
        extra={
            "audit_event": evento,
            "audit_context": contexto,
        },
    )
