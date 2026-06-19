import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const appSource = readFileSync(resolve(__dirname, 'App.jsx'), 'utf8');
const appRouterSource = readFileSync(resolve(__dirname, 'routes/AppRouter.jsx'), 'utf8');
const rotasSource = `${appSource}\n${appRouterSource}`;

const ROTAS_CRITICAS = [
  '/',
  '/dashboard',
  '/quartos',
  '/conviventes',
  '/ocorrencias',
  '/rotina',
  '/rotina/lavanderia',
  '/rotina/pertences-recolhidos',
  '/rotina/dashboard',
  '/rotina/historico',
  '/avisos',
  '/relatorios',
  '/historico-legado',
  '/usuarios',
  '/organizacao',
  '/gestao-global',
  '/convenio-sisa',
];

const ROTAS_PROTEGIDAS = ROTAS_CRITICAS.filter((rota) => rota !== '/');

describe('App routes contract', () => {
  it('mantem lazy loading nas telas principais', () => {
    const lazyImports = [
      '../Login',
      '../ManutencaoProgramada',
      '../Dashboard',
      '../Cadastro',
      '../Quartos',
      '../Conviventes',
      '../CentralOcorrencias',
      '../RotinaDiaria',
      '../Lavanderia',
      '../PertencesRecolhidos',
      '../RotinaHistorico',
      '../DashboardOperacional',
      '../ConvenioSisa',
      '../Avisos',
      '../Usuarios',
      '../Relatorios',
      '../Organizacao',
      '../GestaoGlobal',
      '../HistoricoLegado',
      '../Suporte',
      '../Cobrancas',
      '../CobrancasAdmin',
    ];

    for (const importPath of lazyImports) {
      assert.match(
        appRouterSource,
        new RegExp(`lazy\\(\\(\\) => import\\('${importPath.replace('.', '\\.')}'\\)\\)`),
      );
    }
  });

  it('declara as rotas criticas do SaaS', () => {
    for (const rota of ROTAS_CRITICAS) {
      assert.match(rotasSource, new RegExp(`path="${rota.replaceAll('/', '\\/')}"`));
    }
  });

  it('mantem rotas internas protegidas por ProtectedRoute', () => {
    for (const rota of ROTAS_PROTEGIDAS) {
      const indiceRota = rotasSource.indexOf(`path="${rota}"`);
      assert.notEqual(indiceRota, -1, `rota ausente: ${rota}`);

      const trecho = rotasSource.slice(indiceRota, indiceRota + 260);
      assert.match(trecho, /<ProtectedRoute/, `rota sem ProtectedRoute: ${rota}`);
    }
  });
});
