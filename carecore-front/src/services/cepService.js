export async function consultarCep(cep) {
  const cepLimpo = String(cep || '').replace(/\D/g, '');

  if (cepLimpo.length !== 8) {
    return null;
  }

  const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);

  if (!response.ok) {
    throw new Error('Não foi possível consultar o CEP.');
  }

  const dados = await response.json();

  if (dados.erro) {
    return null;
  }

  return {
    logradouro: dados.logradouro || '',
    bairro: dados.bairro || '',
    cidade: dados.localidade || '',
    uf: dados.uf || '',
  };
}
