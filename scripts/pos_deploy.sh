#!/usr/bin/env bash
# Validação pós-deploy CareCore+ (health + migration remota).
# Uso: ./scripts/pos_deploy.sh
# Variáveis opcionais: CARECORE_API_URL, FLY_APP

set -euo pipefail

API_URL="${CARECORE_API_URL:-https://carecoreplus-api.fly.dev}"
FLY_APP="${FLY_APP:-carecoreplus-api}"

echo "== CareCore+ pós-deploy =="
echo "API: ${API_URL}"
echo "Fly app: ${FLY_APP}"
echo ""

echo "== 1/2 Health =="
if command -v python >/dev/null 2>&1; then
  curl -fsS "${API_URL}/api/health" | python -m json.tool
else
  curl -fsS "${API_URL}/api/health"
fi
echo ""

echo "== 2/2 Alembic current (Fly) =="
if command -v fly >/dev/null 2>&1; then
  fly ssh console -a "${FLY_APP}" -C "sh -c 'cd /app && alembic current'"
else
  echo "AVISO: CLI fly não encontrada — rode manualmente:"
  echo "  fly ssh console -a ${FLY_APP} -C \"sh -c 'cd /app && alembic current'\""
fi
echo ""

echo "== Checklist de entrega (confirmar manualmente) =="
echo "  [ ] Commit local apenas com arquivos da tarefa"
echo "  [ ] Push no GitHub (branch remota atualizada)"
echo "  [ ] fly deploy -a ${FLY_APP} (se mudou backend)"
echo "  [ ] alembic upgrade head + alembic current no destino (se mudou schema)"
echo "  [ ] Health OK (comando acima)"
echo "  [ ] Vercel publicou o frontend (versão no sidebar do app)"
echo ""
echo "Concluído."
