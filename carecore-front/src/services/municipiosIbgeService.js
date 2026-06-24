const cacheMunicipiosPorUf = new Map();

export async function listarMunicipiosPorUf(uf) {
  const sigla = String(uf || '').trim().toUpperCase();
  if (!sigla) return [];

  if (cacheMunicipiosPorUf.has(sigla)) {
    return cacheMunicipiosPorUf.get(sigla);
  }

  const response = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${sigla}/municipios?orderBy=nome`,
  );

  if (!response.ok) {
    throw new Error('Não foi possível carregar as cidades deste estado.');
  }

  const dados = await response.json();
  const nomes = (Array.isArray(dados) ? dados : [])
    .map((item) => item?.nome)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));

  cacheMunicipiosPorUf.set(sigla, nomes);
  return nomes;
}
