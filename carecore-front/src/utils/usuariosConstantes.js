export const PERFIS = [
  'Gestor',
  'Global',
  'ADM Produção NFP',
  'ADM Pedidos',
  'Técnico',
  'Orientador',
  'Administrativo',
  'Consulta',
  'Oficineiro(a)',
];

export const GENEROS = [
  'Feminino',
  'Masculino',
  'Não binário',
  'Prefere não informar',
  'Outro',
];

export const ESTADOS_CIVIS = [
  'Solteiro(a)',
  'Casado(a)',
  'União estável',
  'Separado(a)',
  'Divorciado(a)',
  'Viúvo(a)',
  'Prefere não informar',
];

export const NACIONALIDADES = [
  'Brasileira',
  'Estrangeira',
];

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

export const FORM_INICIAL = {
  nome: '',
  email: '',
  senha: '',
  perfil_acesso: 'Consulta',
  is_global: false,
  ativo: true,
  cpf: '',
  telefone: '',
  avatar_url: '',
  data_nascimento: '',
  genero: '',
  rg: '',
  orgao_emissor: '',
  estado_civil: '',
  nacionalidade: '',
  naturalidade: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
  cargo: '',
  setor: '',
  nfp_captador_vinculo: '',
  compras_modulo_ativo: false,
  instituicao_id: '',
  conselho_profissional: '',
  numero_conselho: '',
  carga_horaria: '',
  data_admissao: '',
  data_desligamento: '',
  motivo_desligamento: '',
  observacoes_profissionais: '',
};

/** Captadores/unidades NFP (espelha CAPTADORES_PADRAO do backend). */
export const NFP_CAPTADORES_VINCULO = [
  'SEDE AEB',
  'CEI LIBERDADE',
  'CEI BELÉM',
  'CEI MONTE AZUL',
  'CEI VILA NOVA CACHOEIRINHA',
  'CEI VILA LEOPOLDINA',
  'CEI VILA GUSTAVO',
  'SIAT II ARMÊNIA',
  'CTA 17 – LIBERDADE',
  'CTA 18 – CANINDÉ',
  'CASA PORTO SEGURO',
  'CAE F PAULICEIA',
  'CAE F RIVOLI',
  'CAE F DOWN TOWN',
  'CAE F VICTORY',
  'CAE F SAMARITANO',
  'CA Grants',
  'CAE I CENTRO',
  'CECOM',
  'CENTRO DIA IDOSOS',
  'CRIAR & TOCAR',
  'CEDESP',
  'REPUBLICA RECOMEÇAR',
  'REENCONTRO JABAQUARA',
  'REENCONTRO ANHANGABAÚ',
  'REENCONTRO CRUZEIRO DO SUL',
  'REENCONTRO PARI',
];
