# CARECORE+

Sistema de gestão para ONGs, casas de recuperação e projetos de convivência (FastAPI + React).

## Desenvolvimento local

### Inicio rapido para demonstracao

No Windows, use:

```bat
iniciar.bat
```

O script confere Python, Node/npm, dependencias do backend e frontend, inicia a API na porta `8000`, inicia o Vite na porta `5173` e abre o sistema no navegador.

Para acessar pelo celular ou tablet na mesma rede, use o endereco mostrado no final do script, por exemplo:

```text
http://192.168.0.10:5173
```

O notebook pode estar no cabo e o celular no Wi-Fi, desde que ambos estejam na mesma rede e as portas `5173` e `8000` estejam liberadas no Firewall do Windows.

Observacao importante: navegadores de celular geralmente bloqueiam camera em endereco local `http://IP`. Por isso o sistema oferece upload/camera nativa como alternativa em cadastros. Leitura direta por `getUserMedia` fica mais confiavel quando houver HTTPS em producao.

### Backend

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy env.example .env
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd carecore-front
copy .env.example .env
npm install
npm run dev
```

A variavel `VITE_API_BASE_URL` no frontend pode sobrescrever a origem da API. Sem `.env`, o frontend usa automaticamente o mesmo hostname aberto no navegador e troca apenas a porta para `8000`, o que permite acesso pelo IP da rede local.

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

## Migrações (Alembic)

O projeto possui uma baseline Alembic com o schema atual. Para criar/evoluir o banco via migrations:

```bash
alembic upgrade head
```

Em ambiente local, `CARECORE_AUTO_CREATE_TABLES=true` mantém o fallback de criar tabelas no startup para facilitar desenvolvimento. Em produção, use `APP_ENV=production` e `CARECORE_AUTO_CREATE_TABLES=false`, deixando o schema sob controle do Alembic.

## Licença

Uso interno do projeto CareCore+.
