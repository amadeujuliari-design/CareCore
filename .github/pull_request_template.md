## Resumo

<!-- O que mudou e por quê -->

## Checklist de entrega

- [ ] Commit local (somente arquivos da tarefa)
- [ ] Push no GitHub
- [ ] `fly deploy -a carecoreplus-api` (se backend)
- [ ] `alembic upgrade head` + `alembic current` (se schema)
- [ ] Health OK (`./scripts/pos_deploy.sh` ou curl manual)
- [ ] Vercel / versão no sidebar (se frontend)

Detalhes: [docs/checklist-entrega.md](../docs/checklist-entrega.md)

## Testes

- [ ] `pytest -q` local ou CI verde
- [ ] Frontend lint/build (se aplicável)

## Nota de entrega

```
Commit/push:
Fly deploy:
Migration:
Health:
Vercel/versão:
```
