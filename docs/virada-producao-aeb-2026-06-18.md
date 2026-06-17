# Virada Producao AEB - 2026-06-18

Este runbook prepara a base AEB para producao a partir do relatorio SISA
`RelatorioCidadaoVinculado` exportado no proprio dia da virada.

## Arquivos

- Backup oficial congelado: `backups/carecore_aeb_backup_validacao_sistema_20260607_102124.db`
- Script local de importacao: `scripts/importar_conviventes_sisa_vinculados.py`
- Script unico de preparo: `scripts/preparar_base_producao_aeb.py`
- Validador independente: `scripts/validar_base_producao_aeb.py`
- Relatorio SISA de entrada: arquivo `.xls` exportado do SISA no dia 18.
- Copia operacional sugerida: `carecore_aeb_producao_preparada_20260618.db`

Nunca executar importacao diretamente no backup oficial congelado.
O backup oficial esta na migration `c9e3a1b5d7f0`; a copia operacional precisa ser atualizada
para a head atual antes da importacao SISA.

## Caminho Preferencial

Rodar primeiro em dry-run:

```powershell
python "scripts\preparar_base_producao_aeb.py" --source-xls "C:\Users\user\Downloads\RelatorioCidadaoVinculado (1).xls" --overwrite
```

Se o dry-run estiver correto, executar de verdade na copia operacional:

```powershell
python "scripts\preparar_base_producao_aeb.py" --source-xls "C:\Users\user\Downloads\RelatorioCidadaoVinculado (1).xls" --overwrite --yes
```

Validar a base preparada:

```powershell
python "scripts\validar_base_producao_aeb.py" --database "carecore_aeb_producao_preparada_20260618.db"
```

## Preparacao Manual

1. Exportar do SISA o relatorio de cidadaos vinculados no dia 18.
2. Copiar o banco base congelado para uma copia operacional:

```powershell
Copy-Item -LiteralPath "backups\carecore_aeb_backup_validacao_sistema_20260607_102124.db" -Destination "carecore_aeb_producao_preparada_20260618.db"
```

3. Atualizar a copia operacional com as migrations atuais:

```powershell
$env:DATABASE_URL = "sqlite+aiosqlite:///./carecore_aeb_producao_preparada_20260618.db"
alembic current
alembic upgrade head
alembic current
```

O `alembic current` final esperado deve apontar para a head atual do projeto.

4. Rodar dry-run:

```powershell
python "scripts\importar_conviventes_sisa_vinculados.py" --source-xls "C:\Users\user\Downloads\RelatorioCidadaoVinculado (1).xls" --database "carecore_aeb_producao_preparada_20260618.db"
```

5. Conferir o CSV gerado em `relatorios_importacao/`.

## Execucao

Executar somente se o dry-run nao apontar acoes `revisar_*`:

```powershell
python "scripts\importar_conviventes_sisa_vinculados.py" --source-xls "C:\Users\user\Downloads\RelatorioCidadaoVinculado (1).xls" --database "carecore_aeb_producao_preparada_20260618.db" --yes
```

O script cria backup automatico da copia operacional antes de gravar.

## Validacao Local

Resultado esperado apos a importacao:

- Total de ativos deve ser igual ao total de cidadaos do relatorio SISA.
- Todos os ativos devem ter `numero_sisa`.
- Nao pode existir `numero_sisa` duplicado entre ativos.
- Conviventes fora do relatorio devem ficar `Inativado`.

Consulta rapida:

```powershell
$code = @'
import sqlite3
con = sqlite3.connect("carecore_aeb_producao_preparada_20260618.db")
cur = con.cursor()
print("total_conviventes=", cur.execute("select count(*) from conviventes").fetchone()[0])
print("por_status=", cur.execute("select status, count(*) from conviventes group by status order by status").fetchall())
print("ativos_sem_sisa=", cur.execute("select count(*) from conviventes where status='Ativo' and (numero_sisa is null or trim(numero_sisa)='')").fetchone()[0])
print("ativos_numero_sisa_distintos=", cur.execute("select count(distinct numero_sisa) from conviventes where status='Ativo'").fetchone()[0])
print("duplicados_sisa_ativos=", cur.execute("select count(*) from (select numero_sisa from conviventes where status='Ativo' and numero_sisa is not null and trim(numero_sisa) <> '' group by numero_sisa having count(*) > 1)").fetchone()[0])
con.close()
'@
$code | python -
```

## Validacao Com Relatorio Atual

Em 2026-06-16, usando o relatorio atual de teste, a execucao em copia descartavel resultou em:

- Backup congelado atualizado de `c9e3a1b5d7f0` para `b1c2d3e4f5a6`.
- `39` tabelas apos migrations.
- `222` cidadaos no relatorio.
- `222` conviventes ativos apos importacao.
- `0` ativos sem `numero_sisa`.
- `222` `numero_sisa` distintos entre ativos.
- `0` duplicidades de `numero_sisa` entre ativos.
- Dry-run de migracao SQLite -> Postgres planejado com `38` tabelas de dados.

## Depois Da Base Preparada

Antes de substituir o banco online:

1. Fazer backup/snapshot do banco online atual.
2. Confirmar que a copia operacional tem usuarios, instituicao, organizacao e configuracoes corretas.
3. Migrar/substituir o banco online usando o procedimento definido para Supabase/Fly.
4. Validar API, login, dashboard operacional e listagem de conviventes ativos.
