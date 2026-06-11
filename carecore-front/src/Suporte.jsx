import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  LifeBuoy,
  MessageSquare,
  Send,
  Ticket,
} from 'lucide-react';

import Sidebar from './Sidebar';
import { AppShell, MainShell, PageHeader, PremiumButton, ScrollArea } from './components/PremiumUI';
import {
  atualizarStatusChamadoSuporte,
  criarChamadoSuporte,
  listarChamadosSuporte,
  obterChamadoSuporte,
  responderChamadoSuporte,
} from './services/suporteService';
import { decodificarPayloadJwt } from './utils/jwtUtils';

const MAPA_SISTEMA = [
  {
    modulo: 'Acesso e Segurança',
    telas: [
      { tela: 'Login', problemas: ['Não consigo entrar', 'Senha não funciona', 'Biometria/passkey', 'Sessão expirando'] },
      { tela: 'Usuários', problemas: ['Criar usuário', 'Permissão incorreta', 'Foto do usuário', 'Alterar senha'] },
    ],
  },
  {
    modulo: 'Cadastros e Prontuário',
    telas: [
      { tela: 'Conviventes', problemas: ['Cadastrar convivente', 'Editar dados', 'Foto do convivente', 'Carteirinha', 'Abas do prontuário'] },
      { tela: 'Acomodações', problemas: ['Quartos', 'Leitos', 'Atribuir convivente', 'Ocupação'] },
    ],
  },
  {
    modulo: 'Rotina Diária',
    telas: [
      { tela: 'Registro da rotina', problemas: ['Leitura QR/código de barras', 'Entrada', 'Saída', 'Refeição', 'Refeição extra'] },
      { tela: 'Histórico da rotina', problemas: ['Filtros', 'Relatório', 'Registro não aparece', 'Correção/cancelamento'] },
      { tela: 'Lavanderia', problemas: ['Entrega de peças', 'Retirada', 'Alerta de prazo', 'Leitura da carteirinha'] },
      { tela: 'Pertences recolhidos', problemas: ['Item recolhido', 'Retirada', 'Baixa administrativa', 'Quarto incorreto'] },
    ],
  },
  {
    modulo: 'Comunicação',
    telas: [
      { tela: 'Ocorrências', problemas: ['Abrir ocorrência', 'Interações', 'Criticidade', 'Relatório'] },
      { tela: 'Avisos', problemas: ['Criar aviso', 'Aviso não aparece', 'Marcar como lido', 'Destinatários'] },
      { tela: 'Chat', problemas: ['Mensagem não envia', 'Notificações', 'Conversa não aparece'] },
    ],
  },
  {
    modulo: 'Gestão e Relatórios',
    telas: [
      { tela: 'Dashboard', problemas: ['Indicadores', 'Cards', 'Carregamento lento'] },
      { tela: 'Dashboard Operacional', problemas: ['Ocupação', 'Rotina', 'Pendências'] },
      { tela: 'Convênio / SISA', problemas: ['Importação', 'Divergências', 'Fechamento', 'Exportação'] },
      { tela: 'Relatórios', problemas: ['Filtros', 'Impressão', 'XLSX', 'Identidade visual'] },
      { tela: 'Visão Gerencial', problemas: ['Projetos', 'Comparação', 'Indicadores globais'] },
    ],
  },
  {
    modulo: 'Outro',
    telas: [
      { tela: 'Não sei informar', problemas: ['Dúvida de uso', 'Erro inesperado', 'Sugestão de melhoria'] },
    ],
  },
];

const STATUS_BADGES = {
  Aberto: 'border-blue-100 bg-blue-50 text-blue-700',
  'Em análise': 'border-amber-100 bg-amber-50 text-amber-700',
  'Aguardando usuário': 'border-purple-100 bg-purple-50 text-purple-700',
  'Em desenvolvimento': 'border-cyan-100 bg-cyan-50 text-cyan-700',
  Resolvido: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  Cancelado: 'border-slate-200 bg-slate-100 text-slate-600',
};

const estadoInicial = {
  modulo: '',
  tela: '',
  tipo_problema: '',
  prioridade: 'normal',
  assunto: '',
  relato: '',
};

function lerUsuarioLogado() {
  const token = localStorage.getItem('@CareCore:token') || localStorage.getItem('token');

  try {
    const payload = decodificarPayloadJwt(token) || {};
    const perfil = payload.perfil_acesso || payload.perfil || '';
    const isManutencao = payload.is_manutencao === true || perfil === 'Manutenção';
    return {
      token,
      nome: payload.nome || payload.email || 'Usuário',
      isGestor: Boolean(payload.is_master || payload.is_global || isManutencao || ['Gestor', 'Global', 'Manutenção'].includes(perfil)),
      isManutencao,
    };
  } catch {
    return { token, nome: 'Usuário', isGestor: false, isManutencao: false };
  }
}

function formatarDataHora(valor) {
  if (!valor) return '-';

  try {
    return new Date(valor).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
}

function badgeStatus(status) {
  return STATUS_BADGES[status] || STATUS_BADGES.Aberto;
}

export default function Suporte() {
  const usuario = useMemo(() => lerUsuarioLogado(), []);
  const [formulario, setFormulario] = useState(estadoInicial);
  const [chamados, setChamados] = useState([]);
  const [chamadoSelecionado, setChamadoSelecionado] = useState(null);
  const [resposta, setResposta] = useState('');
  const [escopo, setEscopo] = useState(usuario.isManutencao ? 'todos' : 'meus');
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const moduloAtual = MAPA_SISTEMA.find((item) => item.modulo === formulario.modulo);
  const telaAtual = moduloAtual?.telas.find((item) => item.tela === formulario.tela);
  const caminhoSistema = [formulario.modulo, formulario.tela, formulario.tipo_problema]
    .filter(Boolean)
    .join(' > ');

  async function carregarChamados() {
    try {
      setCarregando(true);
      const dados = await listarChamadosSuporte(usuario.token, {
        escopo,
        busca,
        limit: 30,
      });
      setChamados(dados.items);
    } catch (error) {
      setErro(error?.response?.data?.detail || 'Não foi possível carregar os chamados.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarChamados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escopo]);

  function atualizarFormulario(campo, valor) {
    setFormulario((atual) => {
      const proximo = { ...atual, [campo]: valor };

      if (campo === 'modulo') {
        proximo.tela = '';
        proximo.tipo_problema = '';
      }

      if (campo === 'tela') {
        proximo.tipo_problema = '';
      }

      return proximo;
    });
  }

  async function abrirChamado(event) {
    event.preventDefault();
    setErro('');
    setSucesso('');

    if (!formulario.modulo || !formulario.tela || !formulario.tipo_problema) {
      setErro('Selecione o módulo, a tela e o tipo de problema.');
      return;
    }

    if (!formulario.assunto.trim() || formulario.relato.trim().length < 10) {
      setErro('Informe um assunto e descreva o problema com mais detalhes.');
      return;
    }

    try {
      setSalvando(true);
      const chamado = await criarChamadoSuporte(usuario.token, {
        ...formulario,
        caminho_sistema: caminhoSistema,
        url_origem: window.location.href,
      });

      setFormulario(estadoInicial);
      setChamadoSelecionado(chamado);
      setSucesso(`Chamado ${chamado.numero_ticket} aberto com sucesso.`);
      await carregarChamados();
    } catch (error) {
      setErro(error?.response?.data?.detail || 'Não foi possível abrir o chamado.');
    } finally {
      setSalvando(false);
    }
  }

  async function selecionarChamado(chamadoId) {
    try {
      setErro('');
      setChamadoSelecionado(await obterChamadoSuporte(usuario.token, chamadoId));
    } catch (error) {
      setErro(error?.response?.data?.detail || 'Não foi possível abrir o chamado.');
    }
  }

  async function enviarResposta(event) {
    event.preventDefault();

    if (!chamadoSelecionado || !resposta.trim()) {
      return;
    }

    try {
      setSalvando(true);
      const atualizado = await responderChamadoSuporte(
        usuario.token,
        chamadoSelecionado.id,
        resposta,
      );
      setResposta('');
      setChamadoSelecionado(atualizado);
      await carregarChamados();
    } catch (error) {
      setErro(error?.response?.data?.detail || 'Não foi possível enviar a resposta.');
    } finally {
      setSalvando(false);
    }
  }

  async function alterarStatusChamado(status) {
    if (!chamadoSelecionado) return;

    try {
      setErro('');
      setSalvando(true);
      const atualizado = await atualizarStatusChamadoSuporte(
        usuario.token,
        chamadoSelecionado.id,
        status,
      );
      setChamadoSelecionado(atualizado);
      await carregarChamados();
    } catch (error) {
      setErro(error?.response?.data?.detail || 'Não foi possível atualizar o status do chamado.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          eyebrow="Suporte CareCore+"
          title="Abertura e acompanhamento de chamados"
          subtitle="Informe onde está o problema, descreva o ocorrido e acompanhe o ticket pelo sistema."
          icon={<LifeBuoy size={19} />}
          actions={(
            <PremiumButton variant="secondary" onClick={carregarChamados}>
              Atualizar chamados
            </PremiumButton>
          )}
        />

        <ScrollArea className="space-y-5 p-5">
          {(erro || sucesso) && (
            <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
              erro
                ? 'border-red-100 bg-red-50 text-red-700'
                : 'border-emerald-100 bg-emerald-50 text-emerald-700'
            }`}
            >
              {erro || sucesso}
            </div>
          )}

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
            <section className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-5">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">Novo chamado</p>
                <h2 className="text-xl font-black text-slate-950">Mapa do sistema</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Escolha o caminho mais próximo do problema. Isso ajuda a direcionar o atendimento.
                </p>
              </div>

              <form className="space-y-5" onSubmit={abrirChamado}>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="space-y-1">
                    <span className="text-xs font-black uppercase text-slate-400">Módulo</span>
                    <select
                      value={formulario.modulo}
                      onChange={(event) => atualizarFormulario('modulo', event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700"
                    >
                      <option value="">Selecione</option>
                      {MAPA_SISTEMA.map((item) => (
                        <option key={item.modulo} value={item.modulo}>{item.modulo}</option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-black uppercase text-slate-400">Tela</span>
                    <select
                      value={formulario.tela}
                      onChange={(event) => atualizarFormulario('tela', event.target.value)}
                      disabled={!moduloAtual}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 disabled:bg-slate-50"
                    >
                      <option value="">Selecione</option>
                      {moduloAtual?.telas.map((item) => (
                        <option key={item.tela} value={item.tela}>{item.tela}</option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-black uppercase text-slate-400">Problema</span>
                    <select
                      value={formulario.tipo_problema}
                      onChange={(event) => atualizarFormulario('tipo_problema', event.target.value)}
                      disabled={!telaAtual}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 disabled:bg-slate-50"
                    >
                      <option value="">Selecione</option>
                      {telaAtual?.problemas.map((problema) => (
                        <option key={problema} value={problema}>{problema}</option>
                      ))}
                    </select>
                  </label>
                </div>

                {caminhoSistema && (
                  <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-black text-blue-700">
                    {caminhoSistema.split(' > ').map((parte, index, partes) => (
                      <span key={`${parte}-${index}`} className="inline-flex items-center gap-2">
                        {parte}
                        {index < partes.length - 1 && <ChevronRight size={14} />}
                      </span>
                    ))}
                  </div>
                )}

                <div className="grid gap-3 md:grid-cols-[1fr_180px]">
                  <label className="space-y-1">
                    <span className="text-xs font-black uppercase text-slate-400">Assunto</span>
                    <input
                      value={formulario.assunto}
                      onChange={(event) => atualizarFormulario('assunto', event.target.value)}
                      maxLength={160}
                      placeholder="Resumo curto do problema"
                      className="w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm font-bold text-slate-700"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-black uppercase text-slate-400">Prioridade</span>
                    <select
                      value={formulario.prioridade}
                      onChange={(event) => atualizarFormulario('prioridade', event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700"
                    >
                      <option value="baixa">Baixa</option>
                      <option value="normal">Normal</option>
                      <option value="media">Média</option>
                      <option value="alta">Alta</option>
                      <option value="critica">Crítica</option>
                    </select>
                  </label>
                </div>

                <label className="space-y-1">
                  <span className="text-xs font-black uppercase text-slate-400">Relato</span>
                  <textarea
                    value={formulario.relato}
                    onChange={(event) => atualizarFormulario('relato', event.target.value)}
                    rows={7}
                    placeholder="Descreva o que aconteceu, o que você estava tentando fazer e se apareceu alguma mensagem de erro."
                    className="w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm font-semibold leading-6 text-slate-700"
                  />
                </label>

                <div className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-semibold text-slate-500 md:flex-row md:items-center md:justify-between">
                  <span>Ao enviar, será gerado um número de ticket para acompanhamento.</span>
                  <PremiumButton type="submit" disabled={salvando} className="inline-flex items-center gap-2">
                    <Send size={16} />
                    {salvando ? 'Enviando...' : 'Abrir chamado'}
                  </PremiumButton>
                </div>
              </form>
            </section>

            <section className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">Acompanhamento</p>
                  <h2 className="text-xl font-black text-slate-950">Meus chamados</h2>
                </div>
                <div className="flex gap-2">
                  {usuario.isGestor && (
                    <select
                      value={escopo}
                      onChange={(event) => setEscopo(event.target.value)}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600"
                    >
                      <option value="meus">Meus</option>
                      <option value="todos">Todos</option>
                    </select>
                  )}
                  <input
                    value={busca}
                    onChange={(event) => setBusca(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') carregarChamados();
                    }}
                    placeholder="Buscar ticket"
                    className="w-36 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-bold"
                  />
                </div>
              </div>

              <div className="space-y-3">
                {carregando ? (
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-bold text-slate-400">
                    Carregando chamados...
                  </div>
                ) : chamados.length === 0 ? (
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-bold text-slate-400">
                    Nenhum chamado encontrado.
                  </div>
                ) : chamados.map((chamado) => (
                  <button
                    key={chamado.id}
                    type="button"
                    onClick={() => selecionarChamado(chamado.id)}
                    className="w-full rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm transition hover:border-blue-100 hover:bg-blue-50/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-black text-slate-900">
                          <Ticket size={16} />
                          {chamado.numero_ticket}
                        </p>
                        <p className="mt-1 truncate text-sm font-bold text-slate-700">{chamado.assunto}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-400">{chamado.caminho_sistema}</p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-black ${badgeStatus(chamado.status)}`}>
                        {chamado.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-semibold text-slate-400">
                      Aberto por {chamado.usuario_nome || 'Usuário'} em {formatarDataHora(chamado.criado_em)}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          </div>

          {chamadoSelecionado && (
            <section className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">Ticket selecionado</p>
                  <h2 className="flex items-center gap-2 text-xl font-black text-slate-950">
                    <Ticket size={20} />
                    {chamadoSelecionado.numero_ticket}
                  </h2>
                  <p className="mt-1 text-sm font-bold text-slate-600">{chamadoSelecionado.assunto}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">{chamadoSelecionado.caminho_sistema}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                      Aberto por: {chamadoSelecionado.usuario_nome || 'Usuário'}
                    </span>
                    {chamadoSelecionado.usuario_email && (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                        {chamadoSelecionado.usuario_email}
                      </span>
                    )}
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                      {formatarDataHora(chamadoSelecionado.criado_em)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-start gap-2 md:items-end">
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${badgeStatus(chamadoSelecionado.status)}`}>
                    {chamadoSelecionado.status}
                  </span>
                  {usuario.isGestor && (
                    <select
                      value={chamadoSelecionado.status}
                      onChange={(event) => alterarStatusChamado(event.target.value)}
                      disabled={salvando}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600"
                    >
                      <option value="Aberto">Aberto</option>
                      <option value="Em análise">Em análise</option>
                      <option value="Aguardando usuário">Aguardando usuário</option>
                      <option value="Em desenvolvimento">Em desenvolvimento</option>
                      <option value="Resolvido">Resolvido</option>
                      <option value="Cancelado">Cancelado</option>
                    </select>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {(chamadoSelecionado.mensagens || []).map((mensagem) => (
                  <div
                    key={mensagem.id}
                    className={`rounded-2xl border p-4 ${
                      mensagem.autor_tipo === 'suporte'
                        ? 'border-emerald-100 bg-emerald-50'
                        : 'border-slate-100 bg-slate-50'
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="flex items-center gap-2 text-sm font-black text-slate-800">
                        {mensagem.autor_tipo === 'suporte' ? <CheckCircle2 size={16} /> : <MessageSquare size={16} />}
                        {mensagem.autor_nome}
                      </p>
                      <span className="text-xs font-bold text-slate-400">{formatarDataHora(mensagem.criado_em)}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{mensagem.mensagem}</p>
                  </div>
                ))}
              </div>

              <form className="mt-4 flex flex-col gap-3" onSubmit={enviarResposta}>
                <textarea
                  value={resposta}
                  onChange={(event) => setResposta(event.target.value)}
                  rows={4}
                  placeholder="Adicionar uma resposta ou informação complementar..."
                  className="w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm font-semibold leading-6 text-slate-700"
                />
                <div className="flex justify-end">
                  <PremiumButton type="submit" disabled={salvando || !resposta.trim()}>
                    Enviar resposta
                  </PremiumButton>
                </div>
              </form>
            </section>
          )}
        </ScrollArea>
      </MainShell>
    </AppShell>
  );
}
