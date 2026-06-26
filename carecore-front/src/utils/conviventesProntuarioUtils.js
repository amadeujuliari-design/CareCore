import {
  formatarCEP,
  formatarCPF,
  formatarTelefone,
  validarCEP,
  validarCPF,
  validarEmail,
  validarTelefone,
} from './conviventesUtils.js';
import { EQUIPAMENTO_ANTERIOR_OUTROS } from '../config/piaFichaConfig.js';
import { montarNaturalidade, parseNaturalidade } from './naturalidadeUtils.js';

function normalizarOrigemEncaminhamentoId(valor) {
  if (!valor || valor === EQUIPAMENTO_ANTERIOR_OUTROS) return null;
  return valor;
}

export const TEMAS_EVOLUCAO_PIA = [
  'Acolhimento inicial',
  'Saúde',
  'Documentação',
  'Família e vínculos',
  'Trabalho e renda',
  'Educação',
  'Moradia',
  'Convivência',
  'Encaminhamento externo',
  'Revisão de metas',
  'Ocorrência acompanhada',
];

export const FORM_HISTORICO_CONVIVENTE_INICIAL = {
  origem_informacao: '',
  data_origem: '',
  titulo: '',
  descricao: '',
};

export const FORM_PIA_INICIAL = {
  registro_pai_id: '',
  tipo_registro: 'PIA',
  titulo: '',
  subtitulo: '',
  descricao: '',
  objetivos: '',
  encaminhamentos: '',
  status: 'Em acompanhamento',
  expectativas_servico: '',
  expectativas_vida_projetos: '',
  destino_siat_iii: false,
  destino_moradia_autonoma: false,
  destino_retorno_familiar: false,
  destino_explicacao: '',
  dificuldades_planos: '',
};

export function dataLocalISO(data = new Date()) {
  const pad = (numero) => String(numero).padStart(2, '0');
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`;
}

export function criarEstadoInicialConvivente() {
  return {
    status: 'Ativo',
    data_entrada: dataLocalISO(),
    data_inclusao: dataLocalISO(),
    data_inativacao: '',
    data_nova_vinculacao: '',
    preferencial: false,
    prontuario_saude: '',
    origem_encaminhamento_id: '',
    origem_encaminhamento_outros: '',
    leito_id: '',
    tecnico_id: '',
    foto_url: '',
    nome_completo: '',
    nome_social: '',
    cpf: '',
    rg: '',
    data_nascimento: '',
    identidade_genero: '',
    orientacao_sexual: '',
    naturalidade: '',
    naturalidade_uf: '',
    naturalidade_cidade: '',
    estado_civil: '',
    escolaridade: '',
    telefone_celular: '',
    nome_mae: '',
    nome_pai: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    numero_sisa: '',
    numero_nis: '',
    status_cadunico: '',
    programas_beneficios: '',
    possui_renda: false,
    renda_mensal: '',
    contato_emergencia_nome: '',
    contato_emergencia_telefone: '',
    observacoes_saude: '',
    email_pessoal: '',
    senha_email: '',
    senha_govbr: '',
    egresso_prisional: false,
    usa_tornozeleira: false,
    tem_mandado_prisao: false,
    medidas_protetivas: '',
    acompanhamento_caps: '',
    uso_substancias: '',
    transtorno_mental: '',
    cor_raca: '',
    possui_religiao: false,
    religiao_qual: '',
    relacao_familiar_situacao: '',
    relacao_familiar_outra: '',
    data_inicio_pia: '',
    em_sao_paulo_desde: '',
    alfabetizado: null,
    ef_concluido: null,
    ef_incompleto: null,
    ef_incompleto_serie: '',
    em_concluido: null,
    em_incompleto: null,
    em_incompleto_serie: '',
    es_concluido: null,
    es_incompleto: null,
    es_incompleto_periodo: '',
    estuda_atualmente: null,
    estuda_curso: '',
    interesse_eja: null,
    profissao: '',
    situacoes_trabalho: [],
    trabalho_nao_remunerada_qual: '',
    trabalho_cursos_participou: null,
    trabalho_cursos_quais: '',
    trabalho_certificados: null,
    trabalho_certificados_quais: '',
    trabalho_pretende_curso: null,
    trabalho_pretende_curso_quais: '',
    beneficios_pia: {},
    rua_desde: '',
    rua_relato: '',
    saude_hist_familia: null,
    saude_hist_familia_qual: '',
    saude_problema: null,
    saude_problema_qual: '',
    saude_laudo: null,
    saude_cid: '',
    saude_outro_equipamento: null,
    saude_outro_equipamento_onde: '',
    pendencia_judiciaria: null,
    pendencia_judiciaria_qual: '',
    pendencia_eleitoral: null,
    pendencia_eleitoral_qual: '',
    egresso_artigo_motivo: '',
    egresso_ano: '',
    familiares: [],
    documentos_civis: [],
    substancias: [],
    medicamentos: [],
    internacoes: [],
    equipamentos_anteriores: [],
    observacao_status: '',
    motivo_status: '',
    relato_status: '',
  };
}

export function montarFormPiaPrincipal() {
  return { ...FORM_PIA_INICIAL };
}

export function montarFormEvolucaoPia(registroPrincipal) {
  return {
    ...FORM_PIA_INICIAL,
    registro_pai_id: registroPrincipal?.id || '',
    tipo_registro: 'Evolução',
    titulo: 'Evolução',
    status: registroPrincipal?.status || FORM_PIA_INICIAL.status,
  };
}

export function ordenarRegistrosPiaPrincipais(registrosPia = []) {
  return registrosPia
    .filter(registro => !registro.registro_pai_id)
    .sort((a, b) => new Date(b.data_registro) - new Date(a.data_registro));
}

export function agruparEvolucoesPiaPorRegistro(registrosPia = []) {
  return registrosPia
    .filter(registro => registro.registro_pai_id)
    .reduce((agrupado, registro) => {
      const lista = agrupado[registro.registro_pai_id] || [];
      return {
        ...agrupado,
        [registro.registro_pai_id]: [...lista, registro].sort((a, b) => new Date(a.data_registro) - new Date(b.data_registro)),
      };
    }, {});
}

export function formatarNumeroNIS(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 11);
}

export function criarFamiliarInicial() {
  return {
    parentesco: '',
    nome: '',
    idade: '',
    telefone: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    endereco: '',
  };
}

export function montarEnderecoFamiliarResumo(familiar = {}) {
  if (!familiar) return null;

  const legado = (familiar.endereco || '').trim();
  const temEstruturado = [
    familiar.cep,
    familiar.logradouro,
    familiar.numero,
    familiar.complemento,
    familiar.bairro,
    familiar.cidade,
    familiar.uf,
  ].some((valor) => String(valor || '').trim());

  if (!temEstruturado) {
    return legado || null;
  }

  const partes = [];
  if (familiar.logradouro) {
    partes.push(familiar.numero ? `${familiar.logradouro}, ${familiar.numero}` : familiar.logradouro);
  } else if (familiar.numero) {
    partes.push(`nº ${familiar.numero}`);
  }
  if (familiar.complemento) partes.push(familiar.complemento);
  if (familiar.bairro) partes.push(familiar.bairro);
  if (familiar.cidade && familiar.uf) {
    partes.push(`${familiar.cidade}/${familiar.uf}`);
  } else if (familiar.cidade) {
    partes.push(familiar.cidade);
  }
  if (familiar.cep) partes.push(`CEP ${familiar.cep}`);

  return partes.join(' — ') || legado || null;
}

export function formatarFamiliarParaTela(familiar = {}) {
  const item = { ...familiar };
  item.telefone = item.telefone ? formatarTelefone(item.telefone) : '';
  item.cep = item.cep ? formatarCEP(item.cep) : '';
  if (!item.logradouro && item.endereco) {
    item.logradouro = item.endereco;
  }
  return item;
}

export function formatarDadosConviventeParaTela(convivente = {}) {
  let beneficios = convivente.beneficios_pia;
  if (typeof beneficios === 'string') {
    try {
      beneficios = JSON.parse(beneficios);
    } catch {
      beneficios = {};
    }
  }

  let situacoesTrabalho = convivente.situacoes_trabalho;
  if (typeof situacoesTrabalho === 'string') {
    try {
      situacoesTrabalho = JSON.parse(situacoesTrabalho);
    } catch {
      situacoesTrabalho = [];
    }
  }

  const naturalidadeParsed = parseNaturalidade(convivente.naturalidade);

  return {
    ...convivente,
    naturalidade_uf: naturalidadeParsed.uf,
    naturalidade_cidade: naturalidadeParsed.cidade,
    cpf: convivente.cpf ? formatarCPF(convivente.cpf) : '',
    telefone_celular: convivente.telefone_celular ? formatarTelefone(convivente.telefone_celular) : '',
    contato_emergencia_telefone: convivente.contato_emergencia_telefone ? formatarTelefone(convivente.contato_emergencia_telefone) : '',
    cep: convivente.cep ? formatarCEP(convivente.cep) : '',
    numero_nis: convivente.numero_nis ? formatarNumeroNIS(convivente.numero_nis) : '',
    data_inicio_pia: convivente.data_inicio_pia ? String(convivente.data_inicio_pia).split('T')[0] : '',
    data_inclusao: convivente.data_inclusao ? String(convivente.data_inclusao).split('T')[0] : '',
    data_inativacao: convivente.data_inativacao ? String(convivente.data_inativacao).split('T')[0] : '',
    data_nova_vinculacao: convivente.data_nova_vinculacao ? String(convivente.data_nova_vinculacao).split('T')[0] : '',
    em_sao_paulo_desde: convivente.em_sao_paulo_desde ? String(convivente.em_sao_paulo_desde).split('T')[0] : '',
    beneficios_pia: beneficios || {},
    situacoes_trabalho: Array.isArray(situacoesTrabalho) ? situacoesTrabalho : [],
    familiares: (convivente.familiares || []).map(formatarFamiliarParaTela),
    documentos_civis: convivente.documentos_civis || [],
    substancias: convivente.substancias || [],
    medicamentos: convivente.medicamentos || [],
    internacoes: convivente.internacoes || [],
    equipamentos_anteriores: convivente.equipamentos_anteriores || [],
  };
}

export function montarPayloadProntuario(formData, statusOriginal) {
  const payload = { ...formData };

  if (payload.status !== statusOriginal) {
    payload.observacao_status = `[${payload.motivo_status.toUpperCase()}] - ${payload.relato_status}`;
  }

  delete payload.motivo_status;
  delete payload.relato_status;
  delete payload.foto_url;

  Object.keys(payload).forEach((key) => {
    if (payload[key] === '') payload[key] = null;
  });

  if (payload.senha_email == null) delete payload.senha_email;
  if (payload.senha_govbr == null) delete payload.senha_govbr;

  if (Array.isArray(payload.familiares)) {
    payload.familiares = payload.familiares
      .filter((item) => (item.parentesco || '').trim() && (item.nome || '').trim())
      .map((item) => ({
        ...item,
        idade: item.idade === '' || item.idade == null ? null : Number(item.idade),
        telefone: (item.telefone || '').trim() || null,
        endereco: montarEnderecoFamiliarResumo(item),
      }));
  }

  if (Object.prototype.hasOwnProperty.call(formData, 'origem_encaminhamento_id')) {
    payload.origem_encaminhamento_id = normalizarOrigemEncaminhamentoId(payload.origem_encaminhamento_id);
  }

  if (Array.isArray(payload.equipamentos_anteriores)) {
    payload.equipamentos_anteriores = payload.equipamentos_anteriores.map((item) => ({
      ...item,
      origem_encaminhamento_id: normalizarOrigemEncaminhamentoId(item?.origem_encaminhamento_id),
    }));
  }

  if (
    Object.prototype.hasOwnProperty.call(formData, 'naturalidade_uf')
    || Object.prototype.hasOwnProperty.call(formData, 'naturalidade_cidade')
  ) {
    payload.naturalidade = montarNaturalidade(
      formData.naturalidade_cidade,
      formData.naturalidade_uf,
    );
  }
  delete payload.naturalidade_uf;
  delete payload.naturalidade_cidade;

  return payload;
}

export function statusConviventeClasse(status) {
  if (status === 'Ativo') return 'bg-green-100 text-green-800';
  if (status === 'Em acolhimento') return 'bg-purple-100 text-purple-800';
  if (status === 'Saída qualificada') return 'bg-emerald-100 text-emerald-800';
  if (status === 'Ausência justificada') return 'bg-blue-100 text-blue-800';
  if (status === 'Bloqueado') return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
}

export function statusNaoAtivo(status) {
  return status && status !== 'Ativo';
}

export function validarCampoProntuario(nomeCampo, valor) {
  if (!valor || String(valor).trim() === '') return '';

  if (nomeCampo === 'email_pessoal' && !validarEmail(valor)) return 'DIGITE UM E-MAIL VÁLIDO';
  if (nomeCampo === 'cpf' && !validarCPF(valor)) return 'CPF INVÁLIDO';
  if (nomeCampo === 'cep' && !validarCEP(valor)) return 'CEP INCOMPLETO';
  if (
    (nomeCampo === 'telefone_celular' || nomeCampo === 'contato_emergencia_telefone') &&
    !validarTelefone(valor)
  ) {
    return 'TELEFONE INVÁLIDO';
  }

  return '';
}

export function validarProntuarioAntesSalvar(formData, statusOriginal, errosValidacao = {}) {
  if (!formData.nome_completo || !formData.nome_completo.trim()) {
    return {
      valido: false,
      mensagem: 'Informe o nome civil completo antes de salvar o prontuário.',
      abaComErro: 'pessoais',
      erros: errosValidacao,
    };
  }

  if (formData.status !== statusOriginal) {
    if (formData.status === 'Bloqueado') {
      return {
        valido: false,
        mensagem: 'Para bloquear/suspender, registre em Conviventes → Acompanhamentos → Suspensão provisória.',
        abaComErro: 'pessoais',
        erros: errosValidacao,
      };
    }

    if (!formData.motivo_status || formData.motivo_status.trim() === '') {
      return {
        valido: false,
        mensagem: 'Salvamento bloqueado: Escolha o Motivo Principal da alteração (Ex: Evasão).',
        abaComErro: 'pessoais',
        erros: errosValidacao,
      };
    }

    if (!formData.relato_status || formData.relato_status.trim() === '') {
      return {
        valido: false,
        mensagem: 'Salvamento bloqueado: Preencha o Relato Detalhado descrevendo o que houve.',
        abaComErro: 'pessoais',
        erros: errosValidacao,
      };
    }
  }

  const erros = { ...errosValidacao };
  let abaComErro = null;

  const marcarErro = (campo, aba, mensagem) => {
    erros[campo] = mensagem;
    abaComErro = abaComErro || aba;
  };

  if (formData.possui_religiao && !(formData.religiao_qual || '').trim()) {
    marcarErro('religiao_qual', 'pessoais', 'Informe qual religião.');
  }

  const origemOutrosTexto = (formData.origem_encaminhamento_outros || '').trim();
  if (!formData.origem_encaminhamento_id && origemOutrosTexto && origemOutrosTexto.length < 2) {
    marcarErro('origem_encaminhamento_outros', 'pessoais', 'Descreva a origem com pelo menos 2 caracteres.');
  }

  if (formData.relacao_familiar_situacao === 'outra' && !(formData.relacao_familiar_outra || '').trim()) {
    marcarErro('relacao_familiar_outra', 'pessoais', 'Especifique a situação familiar.');
  }

  (formData.familiares || []).forEach((item, indice) => {
    const parentesco = (item?.parentesco || '').trim();
    const nome = (item?.nome || '').trim();
    const telefone = (item?.telefone || '').trim();
    const cep = (item?.cep || '').trim();
    const temConteudo = parentesco || nome || telefone || cep || (item?.logradouro || '').trim();

    if (!temConteudo) return;

    if (!parentesco) {
      marcarErro(`familiares_${indice}_parentesco`, 'pessoais', 'Informe o parentesco do familiar.');
    }
    if (!nome) {
      marcarErro(`familiares_${indice}_nome`, 'pessoais', 'Informe o nome do familiar.');
    }
    if (telefone && !validarTelefone(telefone)) {
      marcarErro(`familiares_${indice}_telefone`, 'pessoais', 'TELEFONE INVÁLIDO');
    }
    if (cep && !validarCEP(cep)) {
      marcarErro(`familiares_${indice}_cep`, 'pessoais', 'CEP INCOMPLETO');
    }
  });

  [
    ['cpf', 'pessoais'],
    ['cep', 'pessoais'],
    ['telefone_celular', 'pessoais'],
    ['contato_emergencia_telefone', 'saude'],
    ['email_pessoal', 'documentos'],
  ].forEach(([campo, aba]) => {
    const mensagem = validarCampoProntuario(campo, formData[campo]);
    if (!mensagem) return;
    marcarErro(campo, aba, mensagem);
  });

  if (abaComErro) {
    const camposComErro = Object.entries(erros)
      .filter(([, mensagem]) => mensagem)
      .map(([, mensagem]) => mensagem);
    const resumo = camposComErro.slice(0, 2).join(' ');
    return {
      valido: false,
      mensagem: resumo || 'Salvamento bloqueado: Existem campos incorretos ou incompletos na ficha.',
      abaComErro,
      erros,
    };
  }

  return {
    valido: true,
    mensagem: '',
    abaComErro: null,
    erros,
  };
}
