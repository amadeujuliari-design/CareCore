# CARECORE+

Sistema de gestão para ONGs, casas de recuperação e projetos de convivência (FastAPI + React).

## Desenvolvimento local

### Inicio rapido para demonstracao

No Windows, use:

```bat
iniciar.bat
```

O script confere Python, Node/npm, dependencias do backend e frontend, para instancias antigas, inicia a API na porta `8020`, inicia o Vite na porta `5173` e abre o sistema no navegador.

Portas e health check: `scripts/dev_local.json` (fonte unica). Orquestrador: `scripts/dev_local.py`.

| Script | Funcao |
|--------|--------|
| `iniciar.bat` | Primeira vez (venv + deps) e sobe tudo |
| `reiniciar_local.bat` | Para zumbis, sobe API + Vite, abre navegador |
| `parar_local.bat` | Para backend/frontend e libera portas |
| `validar_api_local.bat` | Confere health e rotas criticas |

Para evitar conflito entre computadores usando a mesma pasta sincronizada, o ambiente virtual Python e criado por maquina em `%LOCALAPPDATA%\CareCorePlus\venv`. Nao copie nem sincronize `venv/` entre computadores.

Para acessar pelo celular ou tablet na mesma rede, use o endereco mostrado no final do script, por exemplo:

```text
http://192.168.0.10:5173
```

O notebook pode estar no cabo e o celular no Wi-Fi, desde que ambos estejam na mesma rede e as portas `5173` e `8020` estejam liberadas no Firewall do Windows.

Observacao importante: navegadores de celular geralmente bloqueiam camera em endereco local `http://IP`. Por isso o sistema oferece upload/camera nativa como alternativa em cadastros. Leitura direta por `getUserMedia` fica mais confiavel quando houver HTTPS em producao.

### Backend

```bash
python -m venv "%LOCALAPPDATA%\CareCorePlus\venv"
"%LOCALAPPDATA%\CareCorePlus\venv\Scripts\activate"
pip install -r requirements.txt
copy env.example .env
python scripts/dev_local.py start-backend
```

API local padrao: `http://127.0.0.1:8020` (ver `scripts/dev_local.json`).

### Frontend

```bash
cd carecore-front
copy .env.example .env
npm install
set CARECORE_DEV_API_PORT=8020
npm run dev
```

Recomendado no Windows: `reiniciar_local.bat` sobe backend e frontend juntos com portas alinhadas.

A variavel `VITE_API_BASE_URL` no frontend pode sobrescrever a origem da API. Sem `.env`, o Vite faz proxy de `/api` para a porta definida em `scripts/dev_local.json`.

### Validação local

Para rodar a validação local completa:

```bash
testar_local.bat
```

Esse script instala dependências do backend, compila Python, roda `pytest` e executa `npm run build` no frontend.

### Backup local

Antes de uma demonstracao importante ou antes de mexer em dados reais, rode:

```bat
backup_local.bat
```

O script cria um `.zip` em `backups/` com o banco local `carecore_local.db` e a pasta `uploads/`, quando existirem.

### Dados para demonstracao

Para uma apresentacao comercial, prepare previamente:

- usuario gestor de teste com senha conhecida;
- alguns conviventes ativos e inativos;
- quartos/leitos com ocupacao realista;
- registros de entrada, saida e almoco do dia;
- ocorrencias pendentes e resolvidas;
- avisos internos;
- um mes SISA com lancamentos suficientes para mostrar relatorio e exportacao.

### Documentos e fotos

Arquivos em `uploads/` são servidos pela rota autenticada `GET /api/arquivos/...` (não exponha a pasta diretamente em produção).
Uploads de documentos sao limitados a arquivos comuns de imagem, PDF, Word e Excel, com tamanho maximo de 10 MB por arquivo.

## Segurança

- Não commite `.env`, bancos `*.db` nem a pasta `uploads/`.
- Em `APP_ENV=production`, defina `SECRET_KEY` forte; chaves de desenvolvimento são recusadas.
- Use `CREDENCIAIS_CONVIVENTE_KEY` própria e diferente da `SECRET_KEY` para criptografar credenciais sensíveis.
- Configure `CARECORE_RATE_LIMIT_REDIS_URL` em produção para que o bloqueio de tentativas de login funcione entre múltiplas instâncias.
- Configure `CARECORE_SENTRY_DSN` quando houver monitoramento externo; o backend inicializa Sentry com envio de PII desativado.
- Mantenha `CARECORE_ONBOARDING_PUBLICO=false` em produção, salvo decisão comercial explícita.
- Mantenha `CARECORE_AUTO_CREATE_TABLES=false` em produção e rode migrations antes do deploy.

## Migrações (Alembic)

O projeto possui uma baseline Alembic com o schema atual. Para criar/evoluir o banco via migrations:

```bash
alembic upgrade head
```

Em ambiente local, `CARECORE_AUTO_CREATE_TABLES=true` mantém o fallback de criar tabelas no startup para facilitar desenvolvimento. Em produção, use `APP_ENV=production` e `CARECORE_AUTO_CREATE_TABLES=false`, deixando o schema sob controle do Alembic.

Regra do projeto: toda alteração de schema em `models.py` ou em tabelas/índices do banco deve ser acompanhada por uma nova migration Alembic versionada. O fallback local de `create_all`/`ALTER TABLE` não substitui migration para produção.

## Checklist De Produção

Use também o guia versionado `docs/operacao-producao.md` antes de deploys, migrations ou manutenções em dados reais.

Antes de publicar uma nova versão:

```bash
pytest -q
alembic check
cd carecore-front
npm ci
npm run lint
npm test
npm run build
```

Verifique também:

- `DATABASE_URL` aponta para o banco correto.
- `alembic upgrade head` foi executado no banco de destino.
- `CARECORE_CORS_ORIGINS` contém apenas os domínios oficiais do app.
- `CARECORE_RATE_LIMIT_REDIS_URL` usa Redis compartilhado em produção.
- `CARECORE_SENTRY_DSN` está configurado se houver monitoramento de erros.
- `uploads/` não é servido como pasta pública; arquivos devem passar por `GET /api/arquivos/...`.
- O frontend publicado contém `manifest.webmanifest`, ícones e `sw.js`.

## Licença

Uso interno do projeto CareCore+.
