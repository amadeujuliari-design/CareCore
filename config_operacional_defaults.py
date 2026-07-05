"""Defaults operacionais compartilhados e textos genéricos (sem referência a SIAT/AEB)."""
from __future__ import annotations

TERMO_COMPROMISSO_TITULO_PADRAO = (
    "TERMO DE COMPROMISSO E RESPONSABILIDADE DO CONVIVENTE"
)

TERMO_COMPROMISSO_TEXTO_PADRAO = """DADOS DO SERVIÇO
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

O(A) convivente declara estar ciente das normas de funcionamento apresentadas pela equipe e compromete-se a cumpri-las."""

TERMO_LGPD_TITULO_PADRAO = "TERMO DE CONSENTIMENTO PARA FINS DE LGPD"
TERMO_LGPD_SUBTITULO_PADRAO = "AUTORIZAÇÃO DE USO DE IMAGEM E VOZ"

TERMO_LGPD_TEXTO_PADRAO = (
    "Eu, abaixo assinado(a), AUTORIZO a instituição responsável pelo serviço a fazer uso de meus "
    "elementos pessoais, característicos de minha personalidade (imagem, som ou dados biográficos "
    "dispostos em materiais impressos e/ou audiovisuais), em mídias institucionais e de comunicação, "
    "podendo a instituição fazer uso próprio ou licenciar terceiros, com cunho informativo ou "
    "institucional, conforme a legislação aplicável. Estou ciente de que o presente termo caracteriza "
    "meu CONSENTIMENTO expresso na Lei Geral de Proteção de Dados (LGPD), pela qual concordo com o "
    "tratamento dos meus dados pessoais e eventuais dados sensíveis coletados para fins assistenciais "
    "e operacionais do serviço. Declaro que a autorização é emitida de forma gratuita e que fui "
    "informado(a) sobre a finalidade do tratamento, podendo exercer meus direitos conforme a LGPD."
)

TERMO_BAGAGEIRO_TITULO_PADRAO = "Termo de Responsabilidade — Guarda Volumes"

TERMO_BAGAGEIRO_ITENS_PADRAO = [
    "É disponibilizado guarda-volumes aos conviventes que estão frequentando o serviço;",
    "O uso do guarda-volumes restringe-se ao período de permanência do convivente na unidade;",
    "O guarda-volumes destina-se a objetos de uso pessoal, vedados itens impróprios, perecíveis, "
    "substâncias ilícitas, valores em dinheiro e pertences de terceiros;",
    "Cada convivente poderá deixar 1 (um) volume, conforme regras internas da unidade;",
    "Ausências prolongadas podem exigir retirada dos pertences, conforme norma do serviço;",
    "No ato da entrega, a equipe poderá verificar o conteúdo do volume;",
    "A unidade não se responsabiliza por pertences deixados fora do guarda-volumes ou em áreas comuns;",
    "Casos omissos serão resolvidos pela gestão do serviço.",
]

TERMO_BAGAGEIRO_COMPROMISSO_PADRAO = (
    "Comprometo-me a respeitar o presente termo e estou ciente das minhas responsabilidades "
    "referentes ao uso do guarda-volumes."
)

TERMO_BAGAGEIRO_RETIRADA_TITULO_PADRAO = "Retirada do volume"
TERMO_BAGAGEIRO_RETIRADA_SUBTITULO_PADRAO = (
    "(Caso de desligamento, interdição, transferência, saída autônoma e outros)"
)
TERMO_BAGAGEIRO_RETIRADA_TEXTO_PADRAO = (
    "Declaro que retirei em _____/______/______ o meu volume deixado no guarda-volumes do serviço."
)

TERMO_BAGAGEIRO_ROTULO_FUNCIONARIO_PADRAO = "Funcionário do projeto"

REFEICOES_PADRAO = [
    {"id": "cafe", "nome": "Café da manhã", "inicio": "06:55", "fim": "08:30", "ativo": True},
    {"id": "almoco", "nome": "Almoço", "inicio": "11:50", "fim": "14:30", "ativo": True},
    {"id": "jantar", "nome": "Jantar", "inicio": "17:50", "fim": "20:30", "ativo": True},
    {"id": "lanche", "nome": "Lanche noturno", "inicio": "21:00", "fim": "22:30", "ativo": True},
]

INTERACOES_ROTINA_PADRAO = [
    {"valor": "Banho", "label": "Banho", "grupo": "simples", "ativo": True},
    {
        "valor": "Cobertor",
        "label": "Cobertor (sugerir retirada/entrega)",
        "grupo": "par",
        "ativo": True,
        "tipo_retirada": "Retirada de Cobertor",
        "tipo_entrega": "Entrega de Cobertor",
    },
    {
        "valor": "Toalha",
        "label": "Toalha (sugerir retirada/entrega)",
        "grupo": "par",
        "ativo": True,
        "tipo_retirada": "Retirada de Toalha",
        "tipo_entrega": "Entrega de Toalha",
    },
    {"valor": "Bagageiro", "label": "Bagageiro (entrada/saída)", "grupo": "par_bagageiro", "ativo": True},
    {
        "valor": "Bipar documentos guardados",
        "label": "Documentos guardados",
        "grupo": "observacao",
        "ativo": True,
    },
    {
        "valor": "Bipar documentos retirados",
        "label": "Documentos retirados",
        "grupo": "observacao",
        "ativo": True,
    },
]

MODULOS_PADRAO = {
    "tb": True,
    "sisa": True,
    "pot": True,
    "discussoes_hospitalares": True,
    "suspensoes": True,
    "transferencias": True,
    "tuberculose": True,
    "historico_legado": False,
}

PORTARIA_PADRAO = {
    "hora_saida_padrao": "17:00",
    "hora_entrada_padrao": "19:00",
    "hora_entrada_apos_pernoite_fora": "11:00",
    "hora_movimento_pernoite_dentro": "04:00",
    "min_caracteres_justificativa": 30,
    "motivos_excecao": ["estudante", "trabalho", "saude", "eventual"],
}
