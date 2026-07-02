import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const configPath = resolve(raiz, 'scripts', 'dev_local.json');

export function lerConfigDevLocal() {
  const bruto = readFileSync(configPath, 'utf8');
  return JSON.parse(bruto);
}

export function lerPortaApiLocal() {
  const config = lerConfigDevLocal();
  const porta = Number(config.api_port);
  if (!Number.isFinite(porta) || porta <= 0) {
    throw new Error(`api_port inválida em ${configPath}`);
  }
  return porta;
}

export function lerPortaFrontendLocal() {
  const config = lerConfigDevLocal();
  const porta = Number(config.frontend_port ?? 5173);
  if (!Number.isFinite(porta) || porta <= 0) {
    throw new Error(`frontend_port inválida em ${configPath}`);
  }
  return porta;
}
