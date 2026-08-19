function soDigitos(valor) {
  return String(valor ?? '').replace(/\D/g, '');
}

function textoConsulta(valor) {
  const texto = String(valor ?? '').trim();
  if (!texto || texto.toLowerCase() === 'null' || texto.toLowerCase() === 'undefined') return '';
  return texto;
}

function formatarCepConsulta(valor) {
  const v = soDigitos(valor).slice(0, 8);
  return v.replace(/^(\d{5})(\d)/, '$1-$2');
}

function formatarTelefoneConsulta(valor) {
  let v = soDigitos(valor).slice(0, 11);
  if (v.length <= 10) {
    v = v.replace(/^(\d{2})(\d)/, '($1) $2');
    return v.replace(/(\d{4})(\d)/, '$1-$2');
  }
  v = v.replace(/^(\d{2})(\d)/, '($1) $2');
  return v.replace(/(\d{5})(\d)/, '$1-$2');
}

function inscricaoEstadualConsulta(dados = {}) {
  const direta = textoConsulta(dados.inscricao_estadual);
  if (direta) return direta;
  const lista = Array.isArray(dados.inscricoes_estaduais) ? dados.inscricoes_estaduais : [];
  const ativa = lista.find((item) => item && item.ativo !== false && item.inscricao_estadual);
  return textoConsulta(ativa?.inscricao_estadual || lista[0]?.inscricao_estadual);
}

function logradouroConsulta(dados = {}) {
  const tipo = textoConsulta(dados.descricao_tipo_de_logradouro || dados.descricao_tipo_logradouro);
  const rua = textoConsulta(dados.logradouro);
  if (!rua) return '';
  if (tipo && !rua.toLowerCase().startsWith(tipo.toLowerCase())) return `${tipo} ${rua}`;
  return rua;
}

export function mapearConsultaCnpj(dados) {
  if (!dados || typeof dados !== 'object') return null;
  if (dados.erro || String(dados.status || '').toUpperCase() === 'ERROR') return null;

  const razao_social = textoConsulta(dados.razao_social || dados.nome);
  const fantasia = textoConsulta(dados.nome_fantasia || dados.fantasia);
  const loja = fantasia || razao_social;
  const email = textoConsulta(dados.email);
  const telefone = soDigitos(dados.ddd_telefone_1 || dados.telefone);
  const cep = soDigitos(dados.cep).slice(0, 8);
  const logradouro = logradouroConsulta(dados);
  const numero = textoConsulta(dados.numero);
  const complemento = textoConsulta(dados.complemento);
  const bairro = textoConsulta(dados.bairro);
  const cidade = textoConsulta(dados.municipio || dados.cidade);
  const uf = textoConsulta(dados.uf).toUpperCase();
  const inscricao_estadual = inscricaoEstadualConsulta(dados);
  const situacao = textoConsulta(dados.descricao_situacao_cadastral || dados.situacao);

  if (!loja && !razao_social && !logradouro && !cep) return null;

  return {
    loja,
    razao_social,
    email,
    telefone,
    inscricao_estadual,
    cep,
    logradouro,
    numero,
    complemento,
    bairro,
    cidade,
    uf,
    situacao,
  };
}

function preencherSugerido(atual, valor, somenteVazios) {
  if (!valor) return atual || '';
  if (somenteVazios && String(atual || '').trim()) return atual;
  return valor;
}

export function aplicarConsultaCnpjNoForm(form = {}, consulta, { somenteVazios = false } = {}) {
  if (!consulta) return form;
  return {
    ...form,
    loja: preencherSugerido(form.loja, consulta.loja, somenteVazios),
    razao_social: preencherSugerido(form.razao_social, consulta.razao_social, somenteVazios),
    email: preencherSugerido(form.email, consulta.email, somenteVazios),
    telefone: preencherSugerido(
      form.telefone,
      consulta.telefone ? formatarTelefoneConsulta(consulta.telefone) : '',
      somenteVazios,
    ),
    inscricao_estadual: preencherSugerido(form.inscricao_estadual, consulta.inscricao_estadual, somenteVazios),
    cep: preencherSugerido(form.cep, consulta.cep ? formatarCepConsulta(consulta.cep) : '', somenteVazios),
    logradouro: preencherSugerido(form.logradouro, consulta.logradouro, somenteVazios),
    numero: preencherSugerido(form.numero, consulta.numero, somenteVazios),
    complemento: preencherSugerido(form.complemento, consulta.complemento, somenteVazios),
    bairro: preencherSugerido(form.bairro, consulta.bairro, somenteVazios),
    cidade: preencherSugerido(form.cidade, consulta.cidade, somenteVazios),
    uf: preencherSugerido(form.uf, consulta.uf, somenteVazios),
  };
}

export function aplicarConsultaCnpjNoFornecedor(form = {}, consulta, { somenteVazios = false } = {}) {
  if (!consulta) return form;
  const nomeSugerido = consulta.razao_social || consulta.loja;
  const endereco = aplicarConsultaCnpjNoForm(
    {
      email: form.email_empresa,
      telefone: form.telefone,
      cep: form.cep,
      logradouro: form.logradouro,
      numero: form.numero,
      complemento: form.complemento,
      bairro: form.bairro,
      cidade: form.cidade,
      uf: form.uf,
    },
    consulta,
    { somenteVazios },
  );
  return {
    ...form,
    nome: preencherSugerido(form.nome, nomeSugerido, somenteVazios),
    email_empresa: endereco.email,
    telefone: endereco.telefone,
    cep: endereco.cep,
    logradouro: endereco.logradouro,
    numero: endereco.numero,
    complemento: endereco.complemento,
    bairro: endereco.bairro,
    cidade: endereco.cidade,
    uf: endereco.uf,
  };
}

export function textoAvisoConsultaCnpj(situacao) {
  const extraSituacao = situacao && String(situacao).trim().toUpperCase() !== 'ATIVA'
    ? ` Situação cadastral: ${String(situacao).trim()}.`
    : '';
  return `Confira os dados encontrados. Se não estiverem certos, corrija antes de salvar.${extraSituacao}`;
}
