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

  it('cacheia apenas recursos publicos e assets estaticos GET', () => {
    assert.match(swSource, /request\.method !== 'GET'/);
    assert.match(swSource, /request\.destination/);
    assert.match(swSource, /style'.*'script'.*'image'.*'font/s);
  });
});
