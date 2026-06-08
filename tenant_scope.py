from fastapi import HTTPException, status


def obter_instituicao_escopo(usuario_atual: dict) -> str:
    instituicao_id = usuario_atual.get("instituicao_id")
    if not instituicao_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário sem projeto ativo para esta operação.",
        )

    return str(instituicao_id)


def obter_organizacao_escopo(usuario_atual: dict) -> str | None:
    organizacao_id = usuario_atual.get("organizacao_id")
    return str(organizacao_id) if organizacao_id else None
