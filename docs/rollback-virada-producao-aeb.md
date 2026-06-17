# Rollback Da Virada Producao AEB

Este checklist deve ser usado antes e durante a virada da AEB. A regra e simples:
nenhuma substituicao de banco online deve acontecer sem snapshot/restauracao testavel.

## Antes Da Virada

1. Registrar identificadores dos ambientes atuais:
   - app Fly: `carecoreplus-api`
   - URL API: `https://carecoreplus-api.fly.dev`
   - app frontend: `app.carecoreplus.com.br`
   - banco Postgres online atual

2. Fazer backup/snapshot do banco online atual.

3. Confirmar que o snapshot pode ser restaurado.

4. Salvar, sem expor no Git ou chat:
   - `DATABASE_URL` online atual;
   - secrets Fly relacionados a banco;
   - envs Vercel que apontam para a API;
   - revision/commit atual publicado.

5. Validar API antes da troca:

```powershell
Invoke-RestMethod -Uri "https://carecoreplus-api.fly.dev/api/health" -Method Get
```

## Ponto De Decisao

So continuar a virada se todos estes itens estiverem OK:

- Base preparada esta na migration esperada.
- Total de ativos bate com o relatorio SISA.
- Nao existem ativos sem `numero_sisa`.
- Nao existem duplicidades de `numero_sisa` entre ativos.
- Usuarios, instituicao e organizacao foram conferidos.
- Existe backup/snapshot do banco online atual.

## Rollback Antes De Publicar

Se a falha acontecer antes de mudar o banco online:

1. Parar a operacao.
2. Manter o banco online atual intocado.
3. Arquivar os relatorios gerados em `relatorios_importacao/` para diagnostico.
4. Corrigir a causa em base descartavel.

## Rollback Depois De Trocar Banco

Se a falha acontecer depois da troca do banco online:

1. Colocar a API em modo seguro, se necessario, interrompendo novas operacoes assistenciais.
2. Restaurar o snapshot do banco online anterior ou voltar `DATABASE_URL` para o banco anterior.
3. Reiniciar/republicar a API no Fly se algum secret/env tiver sido alterado.
4. Validar health:

```powershell
Invoke-RestMethod -Uri "https://carecoreplus-api.fly.dev/api/health" -Method Get
```

5. Validar login no app.
6. Validar uma chamada autenticada simples.
7. Conferir dashboard operacional e listagem de conviventes.

## Validacoes Pos-Rollback

Depois do rollback, confirmar:

- API responde `status: ok`.
- Login funciona.
- Banco mostra a migration esperada do ambiente anterior.
- Conviventes ativos voltaram ao total anterior.
- Nao ha erro 500 nos logs da API.

## Comandos Uteis

Health da API:

```powershell
Invoke-RestMethod -Uri "https://carecoreplus-api.fly.dev/api/health" -Method Get
```

Status Fly:

```powershell
fly status -a carecoreplus-api
```

Logs Fly:

```powershell
fly logs -a carecoreplus-api
```

## Regra De Ouro

Se houver duvida entre corrigir em producao ou voltar ao snapshot, voltar ao snapshot.
Correcao deve ser feita em copia controlada e validada antes de nova tentativa.
