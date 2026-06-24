from __future__ import annotations

from datetime import date

from atividades_sisa_parser import normalizar_horario_sisa, normalizar_texto_sisa


def chave_sessao_carecore(
    data_sessao: date,
    horario: str | None,
    descricao_atividade: str | None,
    descricao_tema: str | None,
) -> str:
    return "|".join(
        [
            data_sessao.isoformat(),
            normalizar_horario_sisa(horario),
            normalizar_texto_sisa(descricao_atividade),
            normalizar_texto_sisa(descricao_tema),
        ]
    )


def montar_comparativo_sisa_carecore(
    *,
    linhas_sisa: list[dict],
    vinculos_por_chave: dict[str, str],
    atividades_por_id: dict[str, dict],
    ocorrencias_por_id: dict[str, dict],
    presencas_por_ocorrencia: dict[str, int],
    sugestoes_vinculo: dict[str, str | None],
) -> dict:
    linhas_resultado = []
    chaves_sisa_processadas: set[str] = set()
    totais = {
        "conferidas": 0,
        "divergencias_quantidade": 0,
        "sem_vinculo": 0,
        "sem_ocorrencia_carecore": 0,
        "somente_sisa": 0,
        "somente_carecore": 0,
    }

    for indice, linha in enumerate(linhas_sisa):
        chave = linha["chave"]
        chaves_sisa_processadas.add(chave)
        atividade_id = vinculos_por_chave.get(chave) or sugestoes_vinculo.get(chave)
        atividade = atividades_por_id.get(atividade_id) if atividade_id else None

        status = "sem_vinculo"
        participacoes_carecore = 0
        ocorrencia_id = None
        delta = None
        mensagem = "Vincule esta linha a uma atividade do CareCore+."

        if atividade:
            ocorrencia = None
            for candidata in atividade.get("ocorrencias", []):
                horario_ocorrencia = candidata.get("horario_sessao") or atividade.get("sisa_horario_padrao") or ""
                if (
                    candidata.get("data_sessao") == linha["data_sessao"]
                    and normalizar_horario_sisa(horario_ocorrencia) == linha["horario_norm"]
                ):
                    ocorrencia = candidata
                    break

            if not ocorrencia:
                status = "sem_ocorrencia_carecore"
                mensagem = "Atividade vinculada, mas não há sessão no CareCore+ para esta data e horário."
                totais["sem_ocorrencia_carecore"] += 1
            else:
                ocorrencia_id = ocorrencia["id"]
                participacoes_carecore = int(presencas_por_ocorrencia.get(ocorrencia_id, 0))
                delta = participacoes_carecore - int(linha["participacoes_sisa"])
                if delta == 0:
                    status = "conferida"
                    mensagem = "Quantidades conferem."
                    totais["conferidas"] += 1
                else:
                    status = "divergencia_quantidade"
                    mensagem = f"SISA {linha['participacoes_sisa']} × CareCore {participacoes_carecore}."
                    totais["divergencias_quantidade"] += 1
        else:
            totais["sem_vinculo"] += 1
            if linha["participacoes_sisa"] > 0:
                totais["somente_sisa"] += 1

        linhas_resultado.append(
            {
                "indice": indice,
                "chave": chave,
                "dimensao": linha.get("dimensao"),
                "descricao_atividade": linha.get("descricao_atividade"),
                "descricao_tema": linha.get("descricao_tema"),
                "data_sessao": linha["data_sessao"],
                "horario": linha.get("horario"),
                "participacoes_sisa": linha["participacoes_sisa"],
                "participacoes_carecore": participacoes_carecore,
                "delta": delta,
                "atividade_id": atividade_id,
                "atividade_nome": atividade.get("nome") if atividade else None,
                "ocorrencia_id": ocorrencia_id,
                "status": status,
                "mensagem": mensagem,
                "sugestao_atividade_id": sugestoes_vinculo.get(chave),
            }
        )

    somente_carecore = []
    for atividade in atividades_por_id.values():
        if not atividade.get("sisa_descricao_atividade") and not atividade.get("sisa_descricao_tema"):
            continue
        for ocorrencia in atividade.get("ocorrencias", []):
            horario = ocorrencia.get("horario_sessao") or atividade.get("sisa_horario_padrao")
            chave_carecore = chave_sessao_carecore(
                ocorrencia["data_sessao"],
                horario,
                atividade.get("sisa_descricao_atividade"),
                atividade.get("sisa_descricao_tema"),
            )
            if chave_carecore in chaves_sisa_processadas:
                continue
            presencas = int(presencas_por_ocorrencia.get(ocorrencia["id"], 0))
            if presencas <= 0:
                continue
            totais["somente_carecore"] += 1
            somente_carecore.append(
                {
                    "chave": chave_carecore,
                    "data_sessao": ocorrencia["data_sessao"],
                    "horario": horario or "",
                    "descricao_atividade": atividade.get("sisa_descricao_atividade"),
                    "descricao_tema": atividade.get("sisa_descricao_tema"),
                    "atividade_id": atividade["id"],
                    "atividade_nome": atividade.get("nome"),
                    "ocorrencia_id": ocorrencia["id"],
                    "participacoes_carecore": presencas,
                    "status": "somente_carecore",
                    "mensagem": "Sessão com presenças no CareCore+, sem linha equivalente no SISA.",
                }
            )

    return {
        "linhas": linhas_resultado,
        "somente_carecore": somente_carecore,
        "resumo": totais,
    }
