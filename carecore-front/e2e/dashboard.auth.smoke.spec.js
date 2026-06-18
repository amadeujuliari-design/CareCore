import { Buffer } from 'node:buffer';
import { expect, test } from '@playwright/test';

function criarTokenTeste() {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const payload = Buffer.from(JSON.stringify({
    sub: 'usuario-e2e',
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64');

  return `${header}.${payload}.assinatura-e2e`;
}

const usuarioTeste = {
  id: 'usuario-e2e',
  sub: 'usuario-e2e',
  nome: 'Usuário E2E',
  email: 'e2e@carecore.test',
  perfil_acesso: 'Gestor',
  instituicao_id: 'projeto-e2e',
  organizacao_id: 'org-e2e',
  projeto_nome: 'Projeto E2E',
  is_master: false,
  is_global: false,
  ativo: true,
};

test('acessa dashboard protegido com sessao local e APIs mockadas', async ({ page }) => {
  const token = criarTokenTeste();
  let validouHeadersDashboard = false;

  await page.addInitScript(({ tokenSessao, usuarioSessao }) => {
    localStorage.setItem('@CareCore:token', tokenSessao);
    localStorage.setItem('@CareCore:user', JSON.stringify(usuarioSessao));
    localStorage.setItem('token', tokenSessao);
    localStorage.setItem('usuario', JSON.stringify(usuarioSessao));
  }, {
    tokenSessao: token,
    usuarioSessao: usuarioTeste,
  });

  await page.route('http://127.0.0.1:8000/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = request.headers();

    expect(headers.authorization).toBe(`Bearer ${token}`);
    expect(headers['x-carecore-request-id']).toBeTruthy();

    if (url.pathname === '/api/dashboard/resumo') {
      validouHeadersDashboard = true;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalConviventes: 12,
          ativos: 10,
          leitosOcupados: 8,
          totalLeitos: 16,
          atendimentosMes: 44,
          atendimentosHoje: 3,
          alertasOcorrencias: 1,
          pendenciasTecnicas: 1,
          ocorrenciasEmAlerta: [],
          pendenciasTecnicos: [],
          resumoPrioridades: {
            Baixa: { total: 1, pendentes: 0 },
            Média: { total: 1, pendentes: 1 },
            Alta: { total: 0, pendentes: 0 },
            Crítica: { total: 0, pendentes: 0 },
          },
          series: {
            diario_7_dias: [
              { chave: '2026-06-08', rotulo: '08/06', atendimentos: 3, novos_conviventes: 1 },
            ],
            semanal_6_semanas: [],
            mensal_6_meses: [],
          },
        }),
      });
      return;
    }

    if (url.pathname === '/api/avisos/me') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
      return;
    }

    if (url.pathname === '/api/avisos/me/resumo') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total_visiveis: 0,
          total_nao_lidos: 0,
          total_alertas_ativos: 0,
        }),
      });
      return;
    }

    if (url.pathname.startsWith('/api/chat/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(url.pathname.endsWith('/resumo')
          ? { total_nao_lidas: 0, total_conversas: 0 }
          : []),
      });
      return;
    }

    if (url.pathname === '/api/ausencias-justificadas/pendencias') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });

  await page.goto('/dashboard');

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Conviventes ativos')).toBeVisible();
  await expect(page.getByText('Avisos Importantes')).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(validouHeadersDashboard).toBe(true);
});
