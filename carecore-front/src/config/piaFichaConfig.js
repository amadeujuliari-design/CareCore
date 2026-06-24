export const PARENTESCOS_FAMILIARES = [
  'Filho(a)',
  'Companheiro(a)',
  'Irmão(ã)',
  'Avô/Avó',
  'Tio(a)',
  'Primo(a)',
  'Neto(a)',
  'Sobrinho(a)',
  'Amigo(a) / referência afetiva',
  'Outros',
];

export const RELACAO_FAMILIAR_SITUACOES = [
  { value: 'nao_dispoe_dados', label: 'Não se dispõe de dados sobre a família natural' },
  { value: 'vinculacao_positiva', label: 'Possui família natural, com vinculação afetiva positiva' },
  { value: 'sem_vinculacao_positiva', label: 'Possui família natural, mas não apresenta vinculação afetiva positiva' },
  { value: 'impedimento_judicial', label: 'Há impedimento judicial para contato com a família natural' },
  { value: 'outra', label: 'Outra situação (especificar)' },
];

export const CORES_RACA_IBGE = [
  'Branca',
  'Preta',
  'Parda',
  'Amarela',
  'Indígena',
  'Prefiro não informar',
];

export const UFS_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

export const IDENTIDADES_GENERO = [
  'Homem Cisgênero',
  'Mulher Cisgênero',
  'Homem Transgênero',
  'Mulher Transgênero',
  'Não-Binário',
  'Outro',
  'Prefiro não informar',
];

export const ORIENTACOES_SEXUAIS = [
  'Heterossexual',
  'Homossexual',
  'Bissexual',
  'Pansexual',
  'Assexual',
  'Outra',
  'Prefiro não informar',
];

export const TIPOS_DOCUMENTO_CIVIL = [
  'Carteira de trabalho (CTPS)',
  'Título de eleitor',
  'Carteira do SUS',
  'Certidão de nascimento',
  'Alistamento militar',
  'Carteirinha de vacinação',
  'Histórico escolar',
  'Comprovante de residência',
  'Certidão de casamento',
  'PIS / PASEP / NIT',
  'CNH',
  'Passaporte',
  'Cartão / comprovante CadÚnico',
  'Certidão de divórcio',
  'Declaração escolar / comprovante de matrícula',
  'Outros',
];

export const SUBSTANCIAS_PIA = [
  'Cigarros',
  'Bebida alcoólica',
  'Maconha',
  'Cocaína',
  'Crack',
  'Outras drogas',
];

/** Valor interno do select quando origem/equipamento não está na lista cadastrada. */
export const EQUIPAMENTO_ANTERIOR_OUTROS = '__outros__';

export const SITUACOES_TRABALHO_PIA = [
  'Não informado',
  'Nunca trabalhou',
  'Trabalha com carteira assinada',
  'Trabalha sem carteira assinada',
  'Não trabalha atualmente',
  'Exerce atividade não remunerada',
];

export const BENEFICIOS_PIA_OPCOES = [
  { key: 'bolsa_familia', label: 'Bolsa Família', temValor: true },
  { key: 'aposentadoria', label: 'Aposentadoria', temValor: true },
  { key: 'bpc', label: 'BPC', temValor: true },
  { key: 'bilhete_unico_especial', label: 'Bilhete Único Especial' },
  { key: 'top_especial', label: 'TOP Especial' },
  { key: 'passe_livre', label: 'Passe Livre' },
  { key: 'outros', label: 'Outro(s)', temTexto: true },
];
