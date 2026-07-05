export const TERMO_COMPROMISSO_TITULO_GENERICO =
  'TERMO DE COMPROMISSO E RESPONSABILIDADE DO CONVIVENTE';

export const TERMO_COMPROMISSO_TEXTO_GENERICO = `DADOS DO SERVIÇO
• Tipo de serviço: [informar tipo de serviço]
• Modalidade: [informar modalidade]
• Nome fantasia do serviço: [informar nome fantasia]
• Capacidade de atendimento: [informar capacidade]

IDENTIFICAÇÃO DA INSTITUIÇÃO RESPONSÁVEL
• Nome: [informar razão social ou nome da instituição]
• CNPJ: [informar CNPJ]
• Endereço: [informar endereço completo]

ORIENTAÇÕES INICIAIS
O(A) convivente deverá observar as regras de convivência, frequência e participação definidas pelo serviço e acompanhadas pela equipe técnica.

Responsabilidades do(a) convivente:
• Comparecer às atividades, consultas e encaminhamentos definidos no Plano Individual de Atendimento (PIA);
• Manter comunicação com a equipe técnica e respeitar as normas internas do serviço;
• Zelar pelo uso adequado dos espaços e pela convivência com demais participantes.

O(A) convivente declara estar ciente das normas de funcionamento apresentadas pela equipe e compromete-se a cumpri-las.`;

export const TERMO_LGPD_TEXTO_GENERICO =
  'Eu, abaixo assinado(a), AUTORIZO a instituição responsável pelo serviço a fazer uso de meus '
  + 'elementos pessoais, característicos de minha personalidade (imagem, som ou dados biográficos '
  + 'dispostos em materiais impressos e/ou audiovisuais), em mídias institucionais e de comunicação, '
  + 'podendo a instituição fazer uso próprio ou licenciar terceiros, com cunho informativo ou '
  + 'institucional, conforme a legislação aplicável. Estou ciente de que o presente termo caracteriza '
  + 'meu CONSENTIMENTO expresso na Lei Geral de Proteção de Dados (LGPD), pela qual concordo com o '
  + 'tratamento dos meus dados pessoais e eventuais dados sensíveis coletados para fins assistenciais '
  + 'e operacionais do serviço. Declaro que a autorização é emitida de forma gratuita e que fui '
  + 'informado(a) sobre a finalidade do tratamento, podendo exercer meus direitos conforme a LGPD.';

export const TERMO_BAGAGEIRO_ITENS_GENERICO = [
  'É disponibilizado guarda-volumes aos conviventes que estão frequentando o serviço;',
  'O uso do guarda-volumes restringe-se ao período de permanência do convivente na unidade;',
  'O guarda-volumes destina-se a objetos de uso pessoal, vedados itens impróprios, perecíveis, substâncias ilícitas, valores em dinheiro e pertences de terceiros;',
  'Cada convivente poderá deixar 1 (um) volume, conforme regras internas da unidade;',
  'Ausências prolongadas podem exigir retirada dos pertences, conforme norma do serviço;',
  'No ato da entrega, a equipe poderá verificar o conteúdo do volume;',
  'A unidade não se responsabiliza por pertences deixados fora do guarda-volumes ou em áreas comuns;',
  'Casos omissos serão resolvidos pela gestão do serviço.',
];

export const TERMO_BAGAGEIRO_RETIRADA_TEXTO_GENERICO =
  'Declaro que retirei em _____/______/______ o meu volume deixado no guarda-volumes do serviço.';

export const MODULOS_GENERICO = {
  tb: true,
  sisa: true,
  pot: true,
  discussoes_hospitalares: true,
  suspensoes: true,
  transferencias: true,
  tuberculose: true,
  historico_legado: false,
};

export const MODULOS_SIAT = {
  ...MODULOS_GENERICO,
  historico_legado: true,
};
