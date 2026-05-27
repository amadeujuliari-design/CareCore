# CARECORE+

Sistema de gestão para ONGs, casas de recuperação e projetos de convivência (FastAPI + React).

## Desenvolvimento local

### Backend

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy env.example .env
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend

```bash
cd carecore-front
copy .env.example .env
npm install
npm run dev
```

A variável `VITE_API_BASE_URL` no frontend deve apontar para a mesma origem do FastAPI (padrão: `http://127.0.0.1:8000`).

### Validação local

Para rodar a validação local completa:

```bash
testar_local.bat
```

Esse script instala dependências do backend, compila Python, roda `pytest` e executa `npm run build` no frontend.

### Documentos e fotos

Arquivos em `uploads/` são servidos pela rota autenticada `GET /api/arquivos/...` (não exponha a pasta diretamente em produção).

## Segurança

- Não commite `.env`, bancos `*.db` nem a pasta `uploads/`.
- Em `APP_ENV=production`, defina `SECRET_KEY` forte; chaves de desenvolvimento são recusadas.

## Migrações (Alembic)

O projeto possui uma baseline Alembic com o schema atual. Para criar/evoluir o banco via migrations:

```bash
alembic upgrade head
```

Em ambiente local, `CARECORE_AUTO_CREATE_TABLES=true` mantém o fallback de criar tabelas no startup para facilitar desenvolvimento. Em produção, use `APP_ENV=production` e `CARECORE_AUTO_CREATE_TABLES=false`, deixando o schema sob controle do Alembic.

## Licença

Uso interno do projeto CareCore+.
