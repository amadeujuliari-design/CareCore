import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const appSource = readFileSync(resolve(__dirname, 'App.jsx'), 'utf8');

const ROTAS_CRITICAS = [
  '/',
  '/dashboard',
  '/quartos',
  '/conviventes',
  '/ocorrencias',
  '/rotina',
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
      './Login',
      './Dashboard',
      './Quartos',
      './Conviventes',
      './CentralOcorrencias',
      './RotinaDiaria',
      './RotinaHistorico',
      './DashboardOperacional',
      './ConvenioSisa',
      './Avisos',
      './Usuarios',
      './Relatorios',
      './Organizacao',
      './GestaoGlobal',
      './HistoricoLegado',
    ];

    for (const importPath of lazyImports) {
      assert.match(appSource, new RegExp(`lazy\\(\\(\\) => import\\('${importPath.replace('.', '\\.')}'\\)\\)`));
    }
  });

  it('declara as rotas criticas do SaaS', () => {
    for (const rota of ROTAS_CRITICAS) {
      assert.match(appSource, new RegExp(`path="${rota.replaceAll('/', '\\/')}"`));
    }
  });

  it('mantem rotas internas protegidas por ProtectedRoute', () => {
    for (const rota of ROTAS_PROTEGIDAS) {
      const indiceRota = appSource.indexOf(`path="${rota}"`);
      assert.notEqual(indiceRota, -1, `rota ausente: ${rota}`);

      const trecho = appSource.slice(indiceRota, indiceRota + 260);
      assert.match(trecho, /<ProtectedRoute/, `rota sem ProtectedRoute: ${rota}`);
    }
  });
});
