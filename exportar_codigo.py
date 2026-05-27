import os
from pathlib import Path

# =========================================================
# CONFIGURAÇÕES
# =========================================================

PASTA_PROJETO = Path(__file__).parent
ARQUIVO_SAIDA = PASTA_PROJETO / "SNAPSHOT_COMPLETO_PROJETO.txt"

EXTENSOES_VALIDAS = {
    ".py",
    ".jsx",
    ".js",
    ".ts",
    ".tsx",
    ".css",
    ".html",
    ".json",
    ".md",
    ".sql",
}

PASTAS_IGNORADAS = {
    "venv",
    "__pycache__",
    "node_modules",
    ".git",
    "dist",
    "build",
    ".idea",
    ".vscode",
}

ARQUIVOS_IGNORADOS = {
    "SNAPSHOT_COMPLETO_PROJETO.txt",
}

# =========================================================
# FUNÇÕES
# =========================================================

def deve_ignorar_pasta(nome):
    return nome.lower() in PASTAS_IGNORADAS

def deve_ignorar_arquivo(nome):
    return nome in ARQUIVOS_IGNORADOS

def gerar_estrutura():
    linhas = []

    for root, dirs, files in os.walk(PASTA_PROJETO):

        dirs[:] = [
            d for d in dirs
            if not deve_ignorar_pasta(d)
        ]

        nivel = root.replace(str(PASTA_PROJETO), "").count(os.sep)

        indentacao = "    " * nivel

        nome_pasta = os.path.basename(root)

        linhas.append(f"{indentacao}[PASTA] {nome_pasta}")

        sub_indentacao = "    " * (nivel + 1)

        for arquivo in sorted(files):

            if deve_ignorar_arquivo(arquivo):
                continue

            caminho = Path(root) / arquivo

            if caminho.suffix.lower() in EXTENSOES_VALIDAS:
                linhas.append(f"{sub_indentacao}- {arquivo}")

    return "\n".join(linhas)

def ler_arquivo(caminho):

    try:
        return caminho.read_text(
            encoding="utf-8",
            errors="ignore"
        )

    except Exception as e:
        return f"<< ERRO AO LER ARQUIVO: {e} >>"

# =========================================================
# GERAÇÃO
# =========================================================

print("Gerando snapshot completo do projeto...")

estrutura = gerar_estrutura()

conteudo_final = []

conteudo_final.append("=" * 120)
conteudo_final.append("ESTRUTURA COMPLETA DO PROJETO")
conteudo_final.append("=" * 120)
conteudo_final.append("")
conteudo_final.append(estrutura)
conteudo_final.append("")

# =========================================================
# VARREDURA DOS ARQUIVOS
# =========================================================

for root, dirs, files in os.walk(PASTA_PROJETO):

    dirs[:] = [
        d for d in dirs
        if not deve_ignorar_pasta(d)
    ]

    for arquivo in sorted(files):

        if deve_ignorar_arquivo(arquivo):
            continue

        caminho = Path(root) / arquivo

        if caminho.suffix.lower() not in EXTENSOES_VALIDAS:
            continue

        caminho_relativo = caminho.relative_to(PASTA_PROJETO)

        print(f"Lendo: {caminho_relativo}")

        conteudo = ler_arquivo(caminho)

        conteudo_final.append("")
        conteudo_final.append("=" * 120)
        conteudo_final.append(f"ARQUIVO: {caminho_relativo}")
        conteudo_final.append("=" * 120)
        conteudo_final.append("")
        conteudo_final.append(conteudo)
        conteudo_final.append("")

# =========================================================
# SALVAR
# =========================================================

ARQUIVO_SAIDA.write_text(
    "\n".join(conteudo_final),
    encoding="utf-8"
)

print("")
print("=" * 120)
print("SNAPSHOT COMPLETO GERADO COM SUCESSO")
print(f"ARQUIVO: {ARQUIVO_SAIDA}")
print("=" * 120)