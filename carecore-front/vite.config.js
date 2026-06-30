import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

function extrairVersaoCareCore() {
  const versaoPath = resolve(__dirname, 'src/config/versao.js');
  const conteudo = readFileSync(versaoPath, 'utf8');
  const match = conteudo.match(/CARECORE_VERSAO\s*=\s*['"]([^'"]+)['"]/);

  if (!match) {
    throw new Error('CARECORE_VERSAO não encontrado em src/config/versao.js');
  }

  return match[1];
}

function sincronizarVersionJson() {
  const versao = extrairVersaoCareCore();
  const payload = {
    versao,
    publicado_em: new Date().toISOString(),
  };

  writeFileSync(
    resolve(__dirname, 'public/version.json'),
    `${JSON.stringify(payload, null, 2)}\n`,
    'utf8',
  );
}

function carecoreVersaoBuildPlugin() {
  return {
    name: 'carecore-versao-build',
    buildStart() {
      sincronizarVersionJson();
    },
    configureServer() {
      sincronizarVersionJson();
    },
  };
}

/** Porta do backend local em dev (8011 — evita zumbis acumulados na 8010). */
const DEV_API_PORT = Number(process.env.CARECORE_DEV_API_PORT || 8011);

export default defineConfig({
  plugins: [react(), carecoreVersaoBuildPlugin()],
  server: {
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${DEV_API_PORT}`,
        changeOrigin: true,
      },
      '/uploads': {
        target: `http://127.0.0.1:${DEV_API_PORT}`,
        changeOrigin: true,
      },
    },
  },
});
