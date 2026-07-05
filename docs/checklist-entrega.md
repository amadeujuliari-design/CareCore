# Checklist de entrega CareCore+

Use em toda entrega com mudança visível ou deploy. **Cada etapa é independente** — commit e push não publicam backend nem aplicam migration.

**Agentes Cursor:** esta leitura e obrigatoria antes de `fly deploy` ou de afirmar que o backend esta no ar — regra `carecore-deploy.mdc` (`alwaysApply: true`).

## Ordem obrigatória quando há migration de schema

Em produção, `CARECORE_AUTO_CREATE_TABLES=false` (`fly.toml`). O backend **não** cria colunas no Postgres no startup — só o Alembic.

**Sempre:** migration no banco de produção **antes** de `fly deploy` com código que usa a coluna nova.

Se inverter a ordem, a API entra em crash loop (health falha, máquina reinicia) até a migration ser aplicada ou o deploy revertido. Detalhes e recuperação: [operacao-producao.md](./operacao-producao.md#deploy-backend-com-migration-de-schema).

## Checklist rápido

- [ ] **Commit local** — somente arquivos da tarefa (sem `.env`, backups, caches)
- [ ] **Push GitHub** — branch remota atualizada (`git status` limpo ou intencional)
- [ ] **Migration** (se mudou `models.py` / schema) — `alembic upgrade head` no **Postgres de produção** + `alembic current` na head esperada — **antes** do deploy Fly
- [ ] **Deploy Fly** — `fly deploy -a carecoreplus-api` (se mudou backend)
- [ ] **Health** — `curl https://carecoreplus-api.fly.dev/api/health` → `status: ok`
- [ ] **Vercel** — app online com versão nova no sidebar (se mudou frontend)

## Validação local antes do push

```bash
pytest -q
alembic check
```

Frontend (se alterado):

```bash
cd carecore-front && npm run lint && npm test && npm run build
```

## Pós-deploy automatizado (parcial)

```bash
./scripts/pos_deploy.sh
```

O script valida **health** e tenta **`alembic current`** no Fly. Push, deploy e migration continuam manuais.

## Modelo de nota na entrega (chat/PR)

```
Entrega: <resumo>

- Commit/push: feito (branch main, commit abc1234)
- Fly deploy: feito / não necessário
- Migration: aplicada em head xyz / não houve migration
- Health: ok
- Vercel: versão v1.3.xx visível no sidebar / não houve mudança de frontend
```

## CI no GitHub

O workflow `.github/workflows/quality.yml` roda em push/PR para `main`/`master`:

- `pytest -q`
- `alembic upgrade head` + `alembic check`
- lint, testes e build do frontend

Falha no CI = corrigir antes de considerar a entrega fechada.
