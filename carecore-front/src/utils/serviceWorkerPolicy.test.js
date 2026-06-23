import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const swSource = readFileSync(resolve(__dirname, '../../public/sw.js'), 'utf8');

describe('service worker cache policy', () => {
  it('nao intercepta chamadas da API', () => {
    assert.match(swSource, /url\.pathname\.startsWith\('\/api\/'\)/);
    assert.match(swSource, /return;/);
  });

  it('usa network-first para navegacao', () => {
    assert.match(swSource, /request\.mode === 'navigate'/);
    assert.match(swSource, /fetch\(request\)/);
    assert.match(swSource, /catch\(\(\) => caches\.match\('\/'\)\)/);
  });

  it('usa network-first para assets versionados', () => {
    assert.match(swSource, /url\.pathname\.startsWith\('\/assets\/'\)/);
    assert.match(swSource, /fetch\(request\)/);
    assert.match(swSource, /catch\(\(\) => caches\.match\(request\)\)/);
  });

  it('versiona o cache pelo parametro cv do service worker', () => {
    assert.match(swSource, /searchParams\.get\('cv'\)/);
    assert.match(swSource, /carecore-shell-\$\{APP_VERSION\}/);
  });

  it('nao usa cache-first para scripts em /assets', () => {
    assert.doesNotMatch(swSource, /if \(cachedResponse\) return cachedResponse/);
  });

  it('busca version.json sem cache', () => {
    assert.match(swSource, /url\.pathname === '\/version\.json'/);
    assert.match(swSource, /cache:\s*'no-store'/);
  });
});
