import { useState } from 'react';
import logoAeb from './assets/logo-aeb.png';
import logoCarecore from './assets/logo.PNG';
import { API_ROOT } from './config/apiBase';

const ILUSTRACOES = {
  alimentacao: { arquivo: 'alimentacao.jpg', alt: 'Uma mesa posta com uma refeição simples' },
  horario_refeicoes: { arquivo: 'horario-refeicoes.jpg', alt: 'Um relógio ao lado da refeição' },
  modulos: { arquivo: 'modulos.jpg', alt: 'Três módulos de moradia lado a lado' },
  acolhida: { arquivo: 'acolhida-v3.jpg', alt: 'Alguém da equipe recebe um casal e o filho na porta do projeto' },
  equipe_tecnica: { arquivo: 'equipe-tecnica-v3.jpg', alt: 'Um técnico e uma moradora conversam à mesa' },
  assistentes_campo: { arquivo: 'assistentes-campo-v2.jpg', alt: 'Funcionário circulando quadra, refeitório, lavanderia e módulos' },
  supervisao: { arquivo: 'supervisao-v3.jpg', alt: 'Coordenação e supervisão olhando juntas a planta do projeto' },
  termos: { arquivo: 'termos.jpg', alt: 'Papéis organizados com uma fita' },
  encaminhamentos: { arquivo: 'encaminhamentos-v2.jpg', alt: 'Encaminhamento para trabalho, escola, curso e cuidado de saúde' },
  atividades: { arquivo: 'atividades-v3.jpg', alt: 'Moradores participando de uma oficina dentro do projeto' },
  capelania: { arquivo: 'capelania.jpg', alt: 'Uma janela iluminada, um livro e uma vela' },
  cogestao: { arquivo: 'cogestao-v3.jpg', alt: 'Moradores reunidos em volta da mesa na cogestão' },
  participacao_atividades: { arquivo: 'participacao-atividades-v3.jpg', alt: 'Moradores participando de uma roda de atividade' },
  higienizacao: { arquivo: 'higienizacao.jpg', alt: 'Roupas de cama dobradas e um ambiente organizado' },
  convivio: { arquivo: 'convivio.jpg', alt: 'Duas portas vizinhas e um banco no pátio' },
  respeito_equipe: { arquivo: 'respeito-equipe-v3.jpg', alt: 'Um morador e alguém da equipe conversam com respeito' },
  respeito_regras: { arquivo: 'respeito-regras-v2.jpg', alt: 'Pessoas aguardando a vez com calma no refeitório' },
  respeito_orientacoes: { arquivo: 'respeito-orientacoes-v3.jpg', alt: 'Uma pessoa da equipe orienta e a outra escuta' },
  sugestoes: { arquivo: 'sugestoes.jpg', alt: 'Um envelope fechado sobre a mesa' },
  agradecimento: { arquivo: 'agradecimento.jpg', alt: 'Um envelope sendo colocado na urna' },
};

const TEXTO_PERGUNTA = {
  cogestao: 'Como você avalia sua participação na cogestão?',
  participacao_atividades: 'Como você avalia sua participação nas atividades e eventos?',
  higienizacao: 'Como você avalia seus cuidados com a higienização e a organização do módulo?',
  convivio: 'Como você avalia seu convívio com os vizinhos?',
  respeito_equipe: 'Como você avalia seu respeito com a equipe?',
  respeito_regras: 'Como você avalia seu respeito com as regras do serviço?',
  respeito_orientacoes: 'Como você avalia seu respeito com as orientações recebidas?',
};

function textoDaPergunta(pergunta) {
  return TEXTO_PERGUNTA[pergunta?.id] || pergunta?.texto || '';
}

function Ilustracao({ id }) {
  const ilustracao = ILUSTRACOES[id];
  if (!ilustracao) return null;
  return (
    <img
      src={`/avaliacao/${ilustracao.arquivo}`}
      alt={ilustracao.alt}
      className="mt-6 h-44 w-full rounded-2xl object-cover"
    />
  );
}

const VILAS = [
  { codigo: 'anhangabau', rotulo: 'VILA REENCONTRO ANHANGABAÚ', nome: 'Vila Reencontro Anhangabaú' },
  { codigo: 'cruzeiro', rotulo: 'VILA REENCONTRO CRUZEIRO DO SUL', nome: 'Vila Reencontro Cruzeiro do Sul' },
  { codigo: 'jabaquara', rotulo: 'VILA REENCONTRO JABAQUARA', nome: 'Vila Reencontro Jabaquara' },
  { codigo: 'pari', rotulo: 'VILA REENCONTRO PARI', nome: 'Vila Reencontro Pari' },
];

function mensagemDaResposta(data) {
  if (data && typeof data.detail === 'string' && data.detail.trim()) {
    return data.detail;
  }
  return 'Não foi possível continuar. Tente de novo.';
}

async function postAvaliacao(caminho, corpo) {
  const resposta = await fetch(`${API_ROOT}/avaliacao-mensal/${caminho}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  const data = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    const erro = new Error(mensagemDaResposta(data));
    erro.dados = data;
    throw erro;
  }
  return data;
}

function TextoAgradecimento({ nome }) {
  const vila = nome || 'vila';
  return (
    <div className="mt-4 space-y-4 text-base leading-relaxed text-slate-700">
      <p>
        Sua avaliação é muito importante para nós. Com ela, vamos trabalhar para tornar a {vila} ainda melhor para você e sua família.
      </p>
      <p>A {vila} agradece a sua participação.</p>
    </div>
  );
}

function nomeDeTratamento(nome) {
  const limpo = (nome || '').trim();
  if (!limpo) return '';
  return limpo.charAt(0).toUpperCase() + limpo.slice(1).toLowerCase();
}

function BotaoEscolha({ ativo, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`min-h-[4rem] w-full rounded-2xl border-2 px-4 py-3 text-center text-base font-semibold leading-snug transition ${
        ativo
          ? 'border-teal-800 bg-teal-800 text-white shadow-md'
          : 'border-slate-200 bg-white text-slate-800 hover:border-teal-700'
      }`}
    >
      {children}
    </button>
  );
}

export default function AvaliacaoMensalPublica() {
  const [etapa, setEtapa] = useState('vila');
  const [projeto, setProjeto] = useState('');
  const [numero, setNumero] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [bloqueio, setBloqueio] = useState('');
  const [sessao, setSessao] = useState(null);
  const [indice, setIndice] = useState(0);
  const [respostas, setRespostas] = useState({});
  const [sugestoes, setSugestoes] = useState('');

  const vilaEscolhida = VILAS.find((vila) => vila.codigo === projeto);
  const perguntas = sessao?.perguntas || [];
  const perguntaAtual = perguntas[indice];
  const progresso = perguntas.length
    ? Math.round(((indice + (etapa === 'sugestoes' ? 1 : 0)) / perguntas.length) * 100)
    : 0;

  async function identificar(evento) {
    evento.preventDefault();
    setErro('');
    setOcupado(true);
    try {
      const data = await postAvaliacao('identificar', {
        projeto,
        numero_prontuario: numero.trim(),
      });
      if (data.situacao === 'respondido') {
        setBloqueio(data.mensagem);
        setEtapa('bloqueado');
        return;
      }
      setSessao(data);
      setIndice(0);
      setRespostas({});
      setEtapa('pergunta');
    } catch (erroIdentificar) {
      setErro(erroIdentificar.message);
    } finally {
      setOcupado(false);
    }
  }

  function escolherOpcao(opcaoId) {
    setRespostas((atual) => ({ ...atual, [perguntaAtual.id]: opcaoId }));
    setErro('');
  }

  function continuarPergunta() {
    if (!respostas[perguntaAtual.id]) {
      setErro('Escolha uma resposta para continuar.');
      return;
    }
    setErro('');
    if (indice + 1 >= perguntas.length) {
      setEtapa('sugestoes');
      return;
    }
    setIndice((atual) => atual + 1);
  }

  async function enviar(evento) {
    evento.preventDefault();
    setErro('');
    setOcupado(true);
    try {
      await postAvaliacao('responder', {
        projeto,
        numero_prontuario: numero.trim(),
        respostas,
        sugestoes: sugestoes.trim(),
      });
      setEtapa('enviado');
    } catch (erroEnvio) {
      setErro(erroEnvio.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f3f0e8] text-slate-900">
      <header className="bg-[#071c22] px-4 py-5 text-white">
        <div className="mx-auto flex max-w-lg items-center justify-center gap-6">
          <img
            src={logoAeb}
            alt="Associação Evangélica Beneficente"
            className="h-16 w-auto object-contain mix-blend-screen"
          />
          <img
            src={logoCarecore}
            alt="CareCore+"
            className="h-14 w-auto object-contain mix-blend-screen"
          />
        </div>
        <p className="mx-auto mt-3 max-w-lg text-center text-sm font-medium tracking-wide text-teal-100">
          Avaliação mensal
        </p>
        {vilaEscolhida && etapa !== 'vila' ? (
          <p className="mx-auto mt-1 max-w-lg text-center text-base font-semibold tracking-wide text-white">
            {vilaEscolhida.nome}
          </p>
        ) : null}
      </header>

      <main className="mx-auto max-w-lg px-4 py-6 pb-28">
        <section className="rounded-3xl bg-white p-5 shadow-xl shadow-slate-900/5 sm:p-7">
          {erro ? (
            <p className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800" role="alert">
              {erro}
            </p>
          ) : null}

          {etapa === 'vila' ? (
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-800">Passo 1 de 2</p>
              <h1 className="mt-2 text-2xl font-bold leading-tight">Qual é a sua vila?</h1>
              <p className="mt-2 text-sm text-slate-600">Toque no nome da vila em que você mora.</p>
              <div className="mt-5 grid gap-3">
                {VILAS.map((vila) => (
                  <BotaoEscolha
                    key={vila.codigo}
                    ativo={projeto === vila.codigo}
                    onClick={() => {
                      setProjeto(vila.codigo);
                      setErro('');
                    }}
                  >
                    {vila.rotulo}
                  </BotaoEscolha>
                ))}
              </div>
              <button
                type="button"
                disabled={!projeto}
                onClick={() => setEtapa('prontuario')}
                className="mt-6 h-14 w-full rounded-2xl bg-slate-900 text-base font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Continuar
              </button>
            </div>
          ) : null}

          {etapa === 'prontuario' ? (
            <form onSubmit={identificar}>
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-800">Passo 2 de 2</p>
              <h1 className="mt-2 text-2xl font-bold leading-tight">Número de prontuário</h1>
              <p className="mt-2 text-sm text-slate-600">{vilaEscolhida?.rotulo}</p>
              <label className="mt-5 block text-sm font-semibold text-slate-700" htmlFor="prontuario">
                Digite o seu número
              </label>
              <input
                id="prontuario"
                inputMode="numeric"
                autoComplete="off"
                value={numero}
                onChange={(evento) => setNumero(evento.target.value.replace(/\D/g, '').slice(0, 6))}
                className="mt-2 h-16 w-full rounded-2xl border-2 border-slate-200 text-center text-3xl font-bold tracking-[0.2em] outline-none focus:border-teal-800"
              />
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setErro('');
                    setEtapa('vila');
                  }}
                  className="h-14 rounded-2xl border-2 border-slate-200 text-base font-bold text-slate-700"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={ocupado || !numero}
                  className="h-14 rounded-2xl bg-slate-900 text-base font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {ocupado ? 'Conferindo...' : 'Abrir'}
                </button>
              </div>
            </form>
          ) : null}

          {etapa === 'bloqueado' ? (
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-800">Avaliação do mês</p>
              <h1 className="mt-2 text-2xl font-bold leading-tight">Já respondido</h1>
              <p className="mt-4 text-base leading-relaxed text-slate-700">{bloqueio}</p>
              <button
                type="button"
                onClick={() => {
                  setErro('');
                  setNumero('');
                  setEtapa('prontuario');
                }}
                className="mt-6 h-14 w-full rounded-2xl border-2 border-slate-200 text-base font-bold text-slate-700"
              >
                Voltar
              </button>
            </div>
          ) : null}

          {etapa === 'pergunta' && perguntaAtual ? (
            <div>
              <p className="text-sm font-semibold text-teal-800">
                {sessao?.rotulo_competencia}
                {sessao?.primeiro_nome ? ` · Olá, ${nomeDeTratamento(sessao.primeiro_nome)}` : ''}
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-teal-800" style={{ width: `${Math.max(progresso, 6)}%` }} />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-500">
                Pergunta {indice + 1} de {perguntas.length}
              </p>
              <h1 className="mt-2 text-2xl font-bold leading-tight">{textoDaPergunta(perguntaAtual)}</h1>
              <div className="mt-5 grid gap-3">
                {perguntaAtual.opcoes.map((opcao) => (
                  <BotaoEscolha
                    key={opcao.id}
                    ativo={respostas[perguntaAtual.id] === opcao.id}
                    onClick={() => escolherOpcao(opcao.id)}
                  >
                    {opcao.rotulo}
                  </BotaoEscolha>
                ))}
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setErro('');
                    if (indice === 0) {
                      setEtapa('prontuario');
                      return;
                    }
                    setIndice((atual) => atual - 1);
                  }}
                  className="h-14 rounded-2xl border-2 border-slate-200 text-base font-bold text-slate-700"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={continuarPergunta}
                  className="h-14 rounded-2xl bg-slate-900 text-base font-bold text-white"
                >
                  Continuar
                </button>
              </div>
              <Ilustracao id={perguntaAtual.id} />
            </div>
          ) : null}

          {etapa === 'sugestoes' ? (
            <form onSubmit={enviar}>
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-800">Último passo</p>
              <h1 className="mt-2 text-2xl font-bold leading-tight">Sugestões e elogios</h1>
              <p className="mt-2 text-sm text-slate-600">Se quiser, escreva aqui. Este campo pode ficar em branco.</p>
              <textarea
                value={sugestoes}
                onChange={(evento) => setSugestoes(evento.target.value.slice(0, 2000))}
                rows={6}
                className="mt-4 w-full rounded-2xl border-2 border-slate-200 p-4 text-base outline-none focus:border-teal-800"
              />
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setErro('');
                    setEtapa('pergunta');
                  }}
                  className="h-14 rounded-2xl border-2 border-slate-200 text-base font-bold text-slate-700"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={ocupado}
                  className="h-14 rounded-2xl bg-teal-800 text-base font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {ocupado ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
              <Ilustracao id="sugestoes" />
            </form>
          ) : null}

          {etapa === 'enviado' ? (
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-800">Pronto</p>
              <h1 className="mt-2 text-2xl font-bold leading-tight">Avaliação enviada</h1>
              <TextoAgradecimento nome={vilaEscolhida?.nome} />
              <Ilustracao id="agradecimento" />
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
