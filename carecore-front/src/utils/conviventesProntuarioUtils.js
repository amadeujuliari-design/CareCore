import {
  formatarCEP,
  formatarCPF,
  formatarTelefone,
  validarCEP,
  validarCPF,
  validarEmail,
  validarTelefone,
} from './conviventesUtils.js';

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
};

export function dataLocalISO(data = new Date()) {
  const pad = (numero) => String(numero).padStart(2, '0');
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`;
}

export function criarEstadoInicialConvivente() {
  return {
    status: 'Ativo',
    data_entrada: dataLocalISO(),
    origem_encaminhamento_id: '',
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

export function formatarDadosConviventeParaTela(convivente = {}) {
  return {
    ...convivente,
    cpf: convivente.cpf ? formatarCPF(convivente.cpf) : '',
    telefone_celular: convivente.telefone_celular ? formatarTelefone(convivente.telefone_celular) : '',
    contato_emergencia_telefone: convivente.contato_emergencia_telefone ? formatarTelefone(convivente.contato_emergencia_telefone) : '',
    cep: convivente.cep ? formatarCEP(convivente.cep) : '',
    numero_nis: convivente.numero_nis ? formatarNumeroNIS(convivente.numero_nis) : '',
  };
}

export function montarPayloadProntuario(formData, statusOriginal) {
  const payload = { ...formData };

  if (payload.status !== statusOriginal) {
    payload.observacao_status = `[${payload.motivo_status.toUpperCase()}] - ${payload.relato_status}`;
  }

  delete payload.motivo_status;
  delete payload.relato_status;

  Object.keys(payload).forEach((key) => {
    if (payload[key] === '') payload[key] = null;
  });

  return payload;
}

export function statusConviventeClasse(status) {
  if (status === 'Ativo') return 'bg-green-100 text-green-800';
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

  [
    ['cpf', 'pessoais'],
    ['cep', 'pessoais'],
    ['telefone_celular', 'pessoais'],
    ['contato_emergencia_telefone', 'saude'],
    ['email_pessoal', 'saude'],
  ].forEach(([campo, aba]) => {
    const mensagem = validarCampoProntuario(campo, formData[campo]);
    if (!mensagem) return;

    erros[campo] = mensagem;
    abaComErro = abaComErro || aba;
  });

  if (abaComErro) {
    return {
      valido: false,
      mensagem: 'Salvamento bloqueado: Existem campos incorretos na ficha.',
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
