# Operacao de Producao CareCore+

Este guia concentra os cuidados obrigatorios para manter o CareCore+ em padrao SaaS de producao. Ele nao substitui revisao tecnica da mudanca, mas deve ser usado antes de commits, deploys, migrations e manutencoes em dados reais.

**Agentes Cursor:** regras obrigatorias em `.cursor/rules/carecore-deploy.mdc` e `carecore-git-entrega.mdc` (`alwaysApply: true`). Ler `docs/checklist-entrega.md` antes de todo `fly deploy`.

## Ambientes

| Camada | Tecnologia | Producao | Cuidados |
| --- | --- | --- | --- |
| API | FastAPI / Uvicorn | Fly.io app `carecoreplus-api`, regiao `gru` | Secrets ficam no Fly; validar `/api/health` apos deploy. |
| Banco | PostgreSQL / Alembic | Supabase Postgres | Fazer backup/ponto de restauracao antes de migration relevante. |
| App | React / Vite | Vercel, dominio `app.carecoreplus.com.br` | Conferir `VITE_API_BASE_URL` e CORS da API. |
| Site | Astro / Tailwind | Vercel, dominio `carecoreplus.com.br` | Projeto separado do app operacional. |
| Storage | Supabase Storage ou fallback local | Configurado por env no backend | Nunca expor `uploads/` como pasta publica. |
| Observabilidade | Logs JSON, Sentry opcional | Configurado por env | Nao enviar PII; confirmar alertas quando ativado. |

## Antes de Alterar

- Ler os arquivos da area afetada e seguir o padrao local antes de editar.
- Verificar `git status` e preservar arquivos/alteracoes que nao pertencem a tarefa.
- Nunca ler, expor ou commitar `.env`, secrets, bancos locais, uploads, backups, checkpoints, relatorios temporarios ou documentos locais.
- Em mudanca de permissao, conferir backend e frontend: `security.py`, rota afetada, `ProtectedRoute.jsx` e `Sidebar.jsx`.
- Em mudanca multi-tenant, validar escopo por `instituicao_id` e `organizacao_id`.
- Em mudanca de schema, criar migration Alembic versionada junto com a alteracao de modelo.

## Checklist de Validacao Local

Backend:

```bash
pytest -q
alembic check
```

Checklist completo de entrega (commit, push, Fly, migration, health, Vercel): ver [checklist-entrega.md](./checklist-entrega.md).

Pos-deploy parcial (health + `alembic current` no Fly):

```bash
./scripts/pos_deploy.sh
```

Frontend operacional:

```bash
cd carecore-front
npm run lint
npm test
npm run build
```

Site publico, quando alterado:

```bash
cd carecore-site
npm run build
```

Use validacoes focadas quando a mudanca for pequena, mas rode a bateria completa antes de publicar alteracoes sensiveis de autenticacao, RBAC, banco, cobranca, uploads ou rotina assistencial.

## CI no GitHub

O workflow `.github/workflows/quality.yml` executa em push e pull request para `main`/`master`:

- `pytest -q`
- `alembic upgrade head` e `alembic check`
- lint, testes unitarios e build do `carecore-front`

Falha no CI deve ser corrigida antes de considerar a entrega concluida.

## Deploy Backend

1. Confirmar que migrations necessarias existem em `alembic/versions/`.
2. Confirmar backup/ponto de restauracao do Supabase quando houver mudanca de schema ou dados.
3. **Aplicar migration no Postgres de producao antes do deploy** (ver secao abaixo se houver schema novo).
4. Publicar API a partir da raiz:

```bash
fly deploy -a carecoreplus-api
```

5. Validar health:

```bash
curl https://carecoreplus-api.fly.dev/api/health
```

O retorno esperado em producao deve conter `status: ok` e `environment: production`.

### Deploy backend com migration de schema

**Por que a ordem importa**

| Ambiente | `CARECORE_AUTO_CREATE_TABLES` | Efeito |
| --- | --- | --- |
| Local (`.env`) | normalmente `true` | `main.py` pode criar tabelas/colunas no startup |
| Producao (Fly) | `false` em `fly.toml` | schema so via **Alembic**; codigo novo + banco antigo = crash |

Sintomas tipicos ao subir codigo sem migration: health check `critical`, logs com erro de coluna inexistente no Postgres, maquina Fly reiniciando ate o limite.

**Procedimento correto (schema novo)**

1. Commit com migration em `alembic/versions/` junto da mudanca em `models.py`.
2. Aplicar no banco de **producao** (nao apenas no SQLite local):

```bash
# Opcao A — da maquina de trabalho, com URL do Postgres de producao:
# obter URL sem expor em chat/log: fly ssh console -a carecoreplus-api -C "printenv DATABASE_URL"
# export DATABASE_URL='postgresql+asyncpg://...'   # usar a URL obtida
alembic upgrade head
alembic current
```

```bash
# Opcao B — via SSH na imagem que JA contem o arquivo da migration (codigo atual no repo):
fly ssh console -a carecoreplus-api -C "sh -c 'cd /app && alembic upgrade head && alembic current'"
```

A opcao B so funciona se a imagem em execucao tiver o revision novo. Apos um deploy falho, a imagem antiga pode nao ter o arquivo — use a opcao A ou faca rollback antes (ver recuperacao).

3. So entao: `fly deploy -a carecoreplus-api`.
4. Confirmar health e `alembic current` na head esperada.

**Recuperacao se o deploy ja foi feito sem migration**

1. Restaurar API rapidamente — rollback para release anterior:

```bash
fly releases -a carecoreplus-api --image
fly deploy -a carecoreplus-api --image registry.fly.io/carecoreplus-api:<tag-da-release-anterior> --strategy immediate
```

2. Com a API estavel, aplicar `alembic upgrade head` no Postgres (opcao A acima).
3. Redeploy da versao nova: `fly deploy -a carecoreplus-api`.
4. Validar `/api/health`.

Incidente de referencia: entrega config operacional (2026-07-05) — deploy antes da migration; resolvido com rollback v57, migration `w8x9y0z1a2b3`, redeploy v60.

## Deploy Frontend e Site

- O app operacional fica em `carecore-front` e deve publicar via Vercel para `app.carecoreplus.com.br`.
- O site institucional fica em `carecore-site` e deve publicar via Vercel para `carecoreplus.com.br`.
- Commit/push no GitHub pode acionar Vercel, mas isso nao significa que o backend Fly foi publicado.
- Depois de deploy do app, validar login, carregamento do dashboard e chamadas para a API oficial.

## Flags Criticas

As cobrancas SaaS estao preparadas, mas devem permanecer desligadas salvo decisao explicita:

```text
CARECORE_COBRANCAS_FECHAMENTO_AUTOMATICO_ATIVO=false
CARECORE_COBRANCAS_GERACAO_ASAAS_AUTOMATICA=false
CARECORE_COBRANCAS_SIMULACAO_ATIVA=false
CARECORE_COBRANCAS_MODULO_CLIENTE_VISIVEL=false
SAAS_BLOQUEIO_ATIVO=false
```

Ativacao futura deve ser gradual: primeiro visibilidade, depois fechamento, geracao Asaas, ambiente de producao Asaas e, por ultimo, bloqueio por cobranca.

Secrets Asaas em producao (Fly), quando a cobranca real estiver liberada:

```text
ASAAS_ENV=production
ASAAS_API_KEY_PRODUCTION=$aact_prod_...
ASAAS_WEBHOOK_TOKEN=<mesmo token do webhook no painel Asaas>
```

Manter `CARECORE_COBRANCAS_GERACAO_ASAAS_AUTOMATICA=false` enquanto a emissao for manual.

## Regras Assistenciais Sensiveis

- Orientador pode alocar/liberar cama apenas pelo modulo `Acomodacoes`.
- Orientador nao deve alterar `leito_id` diretamente pelo cadastro/prontuario do convivente.
- Movimento rapido de entrada/saida em menos de 10 minutos exige justificativa.
- Carteirinhas novas devem manter compatibilidade com numero de prontuario, CPF limpo ou fallback de ID.
- Modulos de conviventes, rotina, SISA, ocorrencias e historico legado carregam dados sensiveis; preferir seguranca e rastreabilidade a atalhos.

## Pos-Deploy

- Rodar `./scripts/pos_deploy.sh` (health + `alembic current` remoto quando `fly` estiver disponível).
- Validar `/api/health`.
- Conferir logs do Fly nas primeiras chamadas.
- Confirmar que rotas protegidas retornam `401` sem token, nao `404` nem `500`.
- Em frontend, testar login/logout, timeout de sessao, menu por perfil e uma chamada autenticada.
- Em alteracoes de permissao, testar pelo menos um perfil permitido e um perfil negado.
- Em alteracoes de banco, confirmar `alembic current` no destino.
