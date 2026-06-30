import { lerConfigDevLocal, lerPortaApiLocal } from './carecoreDevPort.mjs';

const HOST = '127.0.0.1';
const porta = lerPortaApiLocal();
const config = lerConfigDevLocal();
const healthEsperado = config.health || {};

async function validar() {
  if (process.env.CI === 'true' || process.env.CARECORE_SKIP_API_CHECK === '1') {
    return;
  }

  const url = `http://${HOST}:${porta}/api/health`;

  let dados;
  try {
    const resposta = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!resposta.ok) {
      throw new Error(`HTTP ${resposta.status}`);
    }
    dados = await resposta.json();
  } catch (erro) {
    console.error('');
    console.error('CareCore+ — API local indisponível');
    console.error(`  Esperado em: ${url}`);
    console.error('  Execute na raiz do projeto: reiniciar_local.bat');
    console.error('');
    throw erro;
  }

  const divergencias = Object.entries(healthEsperado).filter(
    ([chave, valor]) => dados[chave] !== valor,
  );

  if (divergencias.length) {
    console.error('');
    console.error('CareCore+ — API local desatualizada (backend antigo ou porta errada)');
    divergencias.forEach(([chave, valor]) => {
      console.error(`  ${chave}: recebido=${JSON.stringify(dados[chave])} esperado=${JSON.stringify(valor)}`);
    });
    console.error('  Execute: parar_local.bat e depois reiniciar_local.bat');
    console.error('');
    process.exit(1);
  }

  const contagensUrl = `http://${HOST}:${porta}/api/dashboard/contagens-conviventes`;
  const respostaContagens = await fetch(contagensUrl, { signal: AbortSignal.timeout(5000) });
  if (respostaContagens.status === 404) {
    console.error('');
    console.error('CareCore+ — endpoint de contagens ausente (backend antigo)');
    console.error(`  ${contagensUrl} retornou 404`);
    console.error('  Execute: reiniciar_local.bat');
    console.error('');
    process.exit(1);
  }

  console.log(`CareCore+ dev: API ok na porta ${porta} (${dados.dashboard_api})`);
}

await validar();
