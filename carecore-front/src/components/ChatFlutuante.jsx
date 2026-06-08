import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, MessageCircle, Minus, Search, Send, X } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import {
  criarConversaChat,
  enviarMensagemChat,
  listarConversasChat,
  listarMensagensChat,
  listarUsuariosChat,
  obterResumoChat,
} from '../services/chatService';

const STORAGE_POSICAO = '@CareCore:chat-posicao';
const LARGURA_BOLHA = 64;
const ALTURA_BOLHA = 64;
const LARGURA_PAINEL = 380;
const ALTURA_PAINEL = 560;
const INTERVALO_RESUMO_FECHADO_MS = 15000;
const INTERVALO_RESUMO_ABERTO_MS = 60000;
const INTERVALO_CONVERSAS_MS = 60000;
const INTERVALO_MENSAGENS_MS = 30000;
const MAX_PARTICIPANTES_GRUPO = 15;

function limitarPosicao(posicao, aberto) {
  const largura = aberto ? LARGURA_PAINEL : LARGURA_BOLHA;
  const altura = aberto ? ALTURA_PAINEL : ALTURA_BOLHA;
  const margem = 12;
  const larguraEfetiva = Math.min(largura, window.innerWidth - margem * 2);
  const alturaEfetiva = Math.min(altura, window.innerHeight - margem * 2);
  const maxX = Math.max(margem, window.innerWidth - larguraEfetiva - margem);
  const maxY = Math.max(margem, window.innerHeight - alturaEfetiva - margem);

  return {
    x: Math.min(Math.max(posicao.x, margem), maxX),
    y: Math.min(Math.max(posicao.y, margem), maxY),
  };
}

function obterPosicaoInicial() {
  try {
    const salvo = JSON.parse(localStorage.getItem(STORAGE_POSICAO) || 'null');

    if (salvo && Number.isFinite(salvo.x) && Number.isFinite(salvo.y)) {
      return limitarPosicao(salvo, false);
    }
  } catch {
    localStorage.removeItem(STORAGE_POSICAO);
  }

  return {
    x: Math.max(16, window.innerWidth - LARGURA_BOLHA - 28),
    y: Math.max(16, window.innerHeight - LARGURA_BOLHA - 28),
  };
}

function obterPosicaoBolhaPadrao() {
  return limitarPosicao({
    x: window.innerWidth - LARGURA_BOLHA - 28,
    y: window.innerHeight - ALTURA_BOLHA - 28,
  }, false);
}

function formatarHora(valor) {
  if (!valor) return '';

  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) return '';

  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function iniciais(nome) {
  return (nome || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
    .toUpperCase();
}

function obterUsuarioIdSessao(usuario) {
  if (usuario?.id || usuario?.sub || usuario?.usuario_id) {
    return usuario.id || usuario.sub || usuario.usuario_id;
  }

  try {
    const token = localStorage.getItem('@CareCore:token') || localStorage.getItem('token');
    const payload = token ? JSON.parse(atob(token.split('.')[1])) : null;
    return payload?.id || payload?.sub || payload?.usuario_id || '';
  } catch {
    return '';
  }
}

export default function ChatFlutuante() {
  const { usuario } = useAuth();
  const usuarioId = obterUsuarioIdSessao(usuario);
  const [aberto, setAberto] = useState(false);
  const [posicao, setPosicao] = useState(obterPosicaoInicial);
  const [resumo, setResumo] = useState({ total_nao_lidas: 0, total_conversas: 0 });
  const [conversas, setConversas] = useState([]);
  const [conversaAtiva, setConversaAtiva] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [buscaUsuario, setBuscaUsuario] = useState('');
  const [modoGrupo, setModoGrupo] = useState(false);
  const [tituloGrupo, setTituloGrupo] = useState('');
  const [participantesGrupo, setParticipantesGrupo] = useState(() => new Set());
  const [textoMensagem, setTextoMensagem] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const arrastouRef = useRef(false);
  const mensagensRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioLiberadoRef = useRef(false);
  const totalNaoLidasAnteriorRef = useRef(null);
  const mensagensConhecidasPorConversaRef = useRef(new Map());

  const totalNaoLidas = Number(resumo.total_nao_lidas || 0);
  const participantesGrupoIds = useMemo(
    () => Array.from(participantesGrupo),
    [participantesGrupo]
  );
  const totalParticipantesGrupo = participantesGrupoIds.length + 1;

  const salvarPosicao = useCallback((novaPosicao) => {
    localStorage.setItem(STORAGE_POSICAO, JSON.stringify(novaPosicao));
  }, []);

  const obterContextoAudioChat = useCallback(() => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    const contexto = audioContextRef.current || new AudioContextClass();
    audioContextRef.current = contexto;

    return contexto;
  }, []);

  const liberarAudioChat = useCallback(() => {
    try {
      const contexto = obterContextoAudioChat();
      if (!contexto) return;

      if (contexto.state === 'suspended') {
        contexto.resume().catch(() => {});
      }

      audioLiberadoRef.current = true;
    } catch {
      // Alguns navegadores móveis só liberam áudio após interação explícita.
    }
  }, [obterContextoAudioChat]);

  const tocarSomNotificacaoChat = useCallback(() => {
    try {
      const contexto = obterContextoAudioChat();
      if (!contexto) return;

      if (contexto.state === 'suspended') {
        contexto.resume().catch(() => {});
      }

      const oscilador = contexto.createOscillator();
      const ganho = contexto.createGain();
      const agoraAudio = contexto.currentTime;

      oscilador.type = 'sine';
      oscilador.frequency.setValueAtTime(880, agoraAudio);
      oscilador.frequency.exponentialRampToValueAtTime(1175, agoraAudio + 0.12);

      ganho.gain.setValueAtTime(0.0001, agoraAudio);
      ganho.gain.exponentialRampToValueAtTime(0.12, agoraAudio + 0.015);
      ganho.gain.exponentialRampToValueAtTime(0.0001, agoraAudio + 0.18);

      oscilador.connect(ganho);
      ganho.connect(contexto.destination);
      oscilador.start(agoraAudio);
      oscilador.stop(agoraAudio + 0.2);
    } catch {
      // Navegadores podem bloquear áudio até haver interação do usuário.
    }
  }, [obterContextoAudioChat]);

  useEffect(() => {
    const prepararAudio = () => liberarAudioChat();

    window.addEventListener('pointerdown', prepararAudio, { passive: true });
    window.addEventListener('touchstart', prepararAudio, { passive: true });
    window.addEventListener('keydown', prepararAudio);

    return () => {
      window.removeEventListener('pointerdown', prepararAudio);
      window.removeEventListener('touchstart', prepararAudio);
      window.removeEventListener('keydown', prepararAudio);
    };
  }, [liberarAudioChat]);

  const carregarResumo = useCallback(async () => {
    if (!usuario || document.visibilityState === 'hidden') return;

    try {
      const dados = await obterResumoChat();
      const totalAnterior = totalNaoLidasAnteriorRef.current;
      const totalAtual = Number(dados.total_nao_lidas || 0);

      if (totalAnterior !== null && totalAtual > totalAnterior) {
        tocarSomNotificacaoChat();
      }

      totalNaoLidasAnteriorRef.current = totalAtual;
      setResumo(dados);
    } catch (error) {
      console.error('Erro ao carregar resumo do chat', error);
    }
  }, [tocarSomNotificacaoChat, usuario]);

  const carregarConversas = useCallback(async () => {
    if (!usuario || document.visibilityState === 'hidden') return;

    try {
      const lista = await listarConversasChat();
      setConversas(lista);
    } catch (error) {
      console.error('Erro ao carregar conversas do chat', error);
      setErro('Não foi possível carregar as conversas.');
    }
  }, [usuario]);

  const carregarUsuarios = useCallback(async (busca = '') => {
    if (!usuario || document.visibilityState === 'hidden') return;

    try {
      const lista = await listarUsuariosChat(busca);
      setUsuarios(lista);
    } catch (error) {
      console.error('Erro ao carregar usuários do chat', error);
      setErro('Não foi possível carregar usuários.');
    }
  }, [usuario]);

  const carregarMensagens = useCallback(async (conversa) => {
    if (!conversa?.id || document.visibilityState === 'hidden') return;

    try {
      const resultado = await listarMensagensChat(conversa.id, { limite: 30 });
      const idsConhecidos = mensagensConhecidasPorConversaRef.current.get(conversa.id);
      const mensagensRecebidasNovas = idsConhecidos
        ? resultado.items.filter((mensagem) => {
            const enviadaPorMim = mensagem?.remetente_id && usuarioId
              ? String(mensagem.remetente_id) === String(usuarioId)
              : Boolean(mensagem?.enviada_por_mim);

            return !idsConhecidos.has(mensagem.id) && !enviadaPorMim;
          })
        : [];

      mensagensConhecidasPorConversaRef.current.set(
        conversa.id,
        new Set(resultado.items.map((mensagem) => mensagem.id))
      );

      if (mensagensRecebidasNovas.length > 0) {
        tocarSomNotificacaoChat();
      }

      setMensagens(resultado.items);
      await carregarResumo();
    } catch (error) {
      console.error('Erro ao carregar mensagens do chat', error);
      setErro('Não foi possível carregar as mensagens.');
    }
  }, [carregarResumo, tocarSomNotificacaoChat, usuarioId]);

  useEffect(() => {
    carregarResumo();
    const intervalo = window.setInterval(
      carregarResumo,
      aberto ? INTERVALO_RESUMO_ABERTO_MS : INTERVALO_RESUMO_FECHADO_MS
    );

    return () => window.clearInterval(intervalo);
  }, [aberto, carregarResumo]);

  useEffect(() => {
    const atualizarAoVoltar = () => {
      if (document.visibilityState !== 'hidden') {
        carregarResumo();
        if (aberto) {
          carregarConversas();
        }
      }
    };

    window.addEventListener('focus', atualizarAoVoltar);
    document.addEventListener('visibilitychange', atualizarAoVoltar);

    return () => {
      window.removeEventListener('focus', atualizarAoVoltar);
      document.removeEventListener('visibilitychange', atualizarAoVoltar);
    };
  }, [aberto, carregarConversas, carregarResumo]);

  useEffect(() => {
    if (!aberto) return undefined;

    carregarConversas();

    const intervalo = window.setInterval(carregarConversas, INTERVALO_CONVERSAS_MS);

    return () => window.clearInterval(intervalo);
  }, [aberto, carregarConversas]);

  useEffect(() => {
    if (!conversaAtiva || !aberto) return undefined;

    carregarMensagens(conversaAtiva);
    const intervalo = window.setInterval(
      () => carregarMensagens(conversaAtiva),
      INTERVALO_MENSAGENS_MS
    );

    return () => window.clearInterval(intervalo);
  }, [aberto, carregarMensagens, conversaAtiva]);

  useEffect(() => {
    const elemento = mensagensRef.current;

    if (elemento) {
      elemento.scrollTop = elemento.scrollHeight;
    }
  }, [mensagens]);

  useEffect(() => {
    const ajustar = () => {
      setPosicao((atual) => {
        const ajustada = limitarPosicao(atual, aberto);
        salvarPosicao(ajustada);
        return ajustada;
      });
    };

    ajustar();
    window.addEventListener('resize', ajustar);

    return () => window.removeEventListener('resize', ajustar);
  }, [aberto, salvarPosicao]);

  const tituloConversa = useCallback((conversa) => {
    if (!conversa) return 'Conversa';
    if (conversa.titulo) return conversa.titulo;

    const outros = (conversa.participantes || []).filter((participante) => participante.id !== usuarioId);

    if (outros.length > 0) {
      return outros.map((participante) => participante.nome).join(', ');
    }

    return 'Conversa';
  }, [usuarioId]);

  const conversasOrdenadas = useMemo(() => {
    return [...conversas].sort((a, b) => {
      return new Date(b.atualizado_em || 0).getTime() - new Date(a.atualizado_em || 0).getTime();
    });
  }, [conversas]);

  const mensagemFoiEnviadaPorMim = useCallback((mensagem) => {
    if (mensagem?.remetente_id && usuarioId) {
      return String(mensagem.remetente_id) === String(usuarioId);
    }

    return Boolean(mensagem?.enviada_por_mim);
  }, [usuarioId]);

  function iniciarArrasto(event) {
    if (event.button !== 0) return;

    const inicioX = event.clientX;
    const inicioY = event.clientY;
    const posicaoInicial = posicao;
    arrastouRef.current = false;

    function aoMover(moveEvent) {
      const deltaX = moveEvent.clientX - inicioX;
      const deltaY = moveEvent.clientY - inicioY;

      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        arrastouRef.current = true;
      }

      setPosicao(limitarPosicao({
        x: posicaoInicial.x + deltaX,
        y: posicaoInicial.y + deltaY,
      }, aberto));
    }

    function aoSoltar() {
      window.removeEventListener('pointermove', aoMover);
      window.removeEventListener('pointerup', aoSoltar);

      setPosicao((atual) => {
        const ajustada = limitarPosicao(atual, aberto);
        salvarPosicao(ajustada);
        return ajustada;
      });
    }

    window.addEventListener('pointermove', aoMover);
    window.addEventListener('pointerup', aoSoltar);
  }

  function recolherParaCanto() {
    const novaPosicao = obterPosicaoBolhaPadrao();

    setAberto(false);
    setPosicao(novaPosicao);
    salvarPosicao(novaPosicao);
    carregarResumo();
  }

  async function abrirPainel() {
    if (arrastouRef.current) return;

    liberarAudioChat();
    setAberto(true);
    setErro('');
    setCarregando(true);

    try {
      await Promise.all([carregarResumo(), carregarConversas(), carregarUsuarios('')]);
    } finally {
      setCarregando(false);
    }
  }

  async function selecionarConversa(conversa) {
    setConversaAtiva(conversa);
    setErro('');
    await carregarMensagens(conversa);
  }

  async function iniciarConversa(usuarioDestino) {
    setErro('');
    setCarregando(true);

    try {
      const conversa = await criarConversaChat([usuarioDestino.id]);
      setConversaAtiva(conversa);
      await Promise.all([carregarConversas(), carregarMensagens(conversa)]);
    } catch (error) {
      console.error('Erro ao iniciar conversa', error);
      setErro(error?.response?.data?.detail || 'Não foi possível iniciar a conversa.');
    } finally {
      setCarregando(false);
    }
  }

  function alternarModoGrupo() {
    setModoGrupo((ativo) => !ativo);
    setParticipantesGrupo(new Set());
    setTituloGrupo('');
    setErro('');
  }

  function alternarParticipanteGrupo(usuarioDestino) {
    setErro('');

    setParticipantesGrupo((atuais) => {
      const proximos = new Set(atuais);

      if (proximos.has(usuarioDestino.id)) {
        proximos.delete(usuarioDestino.id);
        return proximos;
      }

      if (proximos.size + 2 > MAX_PARTICIPANTES_GRUPO) {
        setErro(`Grupo limitado a ${MAX_PARTICIPANTES_GRUPO} participantes, incluindo você.`);
        return proximos;
      }

      proximos.add(usuarioDestino.id);
      return proximos;
    });
  }

  async function iniciarGrupo() {
    if (participantesGrupoIds.length < 2) {
      setErro('Selecione ao menos 2 usuários para criar um grupo.');
      return;
    }

    setErro('');
    setCarregando(true);

    try {
      const conversa = await criarConversaChat(participantesGrupoIds, tituloGrupo.trim());
      setConversaAtiva(conversa);
      setModoGrupo(false);
      setTituloGrupo('');
      setParticipantesGrupo(new Set());
      await Promise.all([carregarConversas(), carregarMensagens(conversa)]);
    } catch (error) {
      console.error('Erro ao iniciar grupo', error);
      setErro(error?.response?.data?.detail || 'Não foi possível criar o grupo.');
    } finally {
      setCarregando(false);
    }
  }

  async function enviarMensagemAtual() {
    const conteudo = textoMensagem.trim();

    if (!conteudo || !conversaAtiva || enviando) return;

    setEnviando(true);
    setErro('');

    try {
      const novaMensagem = await enviarMensagemChat(conversaAtiva.id, conteudo);
      setMensagens((atuais) => [...atuais, novaMensagem]);
      setTextoMensagem('');
      await Promise.all([carregarConversas(), carregarResumo()]);
    } catch (error) {
      console.error('Erro ao enviar mensagem', error);
      setErro(error?.response?.data?.detail || 'Não foi possível enviar a mensagem.');
    } finally {
      setEnviando(false);
    }
  }

  async function enviarMensagem(event) {
    event.preventDefault();
    await enviarMensagemAtual();
  }

  async function enviarMensagemPeloTeclado(event) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent?.isComposing) {
      return;
    }

    event.preventDefault();
    await enviarMensagemAtual();
  }

  async function pesquisarUsuarios(event) {
    const valor = event.target.value;
    setBuscaUsuario(valor);
    await carregarUsuarios(valor);
  }

  async function carregarUsuariosAoFocar() {
    if (usuarios.length > 0) return;

    await carregarUsuarios('');
  }

  if (!usuario) {
    return null;
  }

  if (!aberto) {
    return createPortal(
      <button
        type="button"
        onPointerDown={iniciarArrasto}
        onClick={abrirPainel}
        className={`fixed z-[10000] flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 text-white shadow-2xl shadow-slate-900/30 transition hover:scale-105 hover:bg-slate-800 ${
          totalNaoLidas > 0 ? 'animate-pulse ring-4 ring-red-300/70' : ''
        }`}
        style={{ left: posicao.x, top: posicao.y }}
        title={totalNaoLidas > 0 ? `${totalNaoLidas} mensagem(ns) não lida(s)` : 'Chat interno'}
      >
        <MessageCircle size={28} />
        {totalNaoLidas > 0 && (
          <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-black text-white ring-2 ring-white">
            {totalNaoLidas > 99 ? '99+' : totalNaoLidas}
          </span>
        )}
      </button>,
      document.body
    );
  }

  return createPortal(
    <section
      className="fixed z-[10000] flex h-[min(560px,calc(100vh-24px))] w-[min(380px,calc(100vw-24px))] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/25"
      style={{ left: posicao.x, top: posicao.y }}
      aria-label="Chat interno"
    >
      <header
        onPointerDown={iniciarArrasto}
        className="flex cursor-move items-center justify-between bg-slate-900 px-4 py-3 text-white"
      >
        <div>
          <p className="text-sm font-black">Comunicação interna</p>
          <p className="text-xs text-slate-300">Arraste para reposicionar</p>
        </div>

        <div className="flex items-center gap-2">
          {totalNaoLidas > 0 && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-black">
              {totalNaoLidas}
            </span>
          )}
          <button
            type="button"
            onClick={recolherParaCanto}
            className="rounded-full p-1.5 text-slate-200 hover:bg-white/10 hover:text-white"
            title="Recolher"
          >
            <Minus size={18} />
          </button>
          <button
            type="button"
            onClick={() => {
              setConversaAtiva(null);
              recolherParaCanto();
            }}
            className="rounded-full p-1.5 text-slate-200 hover:bg-white/10 hover:text-white"
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {erro && (
        <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700">
          {erro}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col bg-slate-50">
        {conversaAtiva ? (
          <>
            <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-3 py-3">
              <button
                type="button"
                onClick={() => {
                  setConversaAtiva(null);
                  setMensagens([]);
                  setTextoMensagem('');
                  carregarResumo();
                }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                title="Voltar para conversas"
              >
                <ArrowLeft size={18} />
              </button>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-600">
                {iniciais(tituloConversa(conversaAtiva))}
              </span>
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-black leading-5 text-slate-900">
                  {tituloConversa(conversaAtiva)}
                </p>
                <p className="text-xs text-slate-400">
                  {conversaAtiva.participantes?.length || 0} participante(s)
                </p>
              </div>
            </div>

            <div ref={mensagensRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              {mensagens.length === 0 && (
                <div className="mt-10 text-center text-xs text-slate-400">
                  Envie a primeira mensagem desta conversa.
                </div>
              )}

              {mensagens.map((mensagem) => {
                const enviadaPorMim = mensagemFoiEnviadaPorMim(mensagem);

                return (
                  <div
                    key={mensagem.id}
                    className={`flex min-w-0 ${enviadaPorMim ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[88%] overflow-hidden rounded-2xl px-3 py-2 text-xs shadow-sm sm:max-w-[82%] ${
                        enviadaPorMim
                          ? 'rounded-br-md bg-slate-900 text-white'
                          : 'rounded-bl-md bg-white text-slate-700'
                      }`}
                    >
                      {!enviadaPorMim && (
                        <p className="mb-1 break-words font-black text-slate-500">
                          {mensagem.remetente_nome || 'Usuário'}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words leading-5">{mensagem.conteudo}</p>
                      <p className={`mt-1 text-[10px] ${enviadaPorMim ? 'text-slate-300' : 'text-slate-400'}`}>
                        {formatarHora(mensagem.criado_em)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <form onSubmit={enviarMensagem} className="border-t border-slate-200 bg-white p-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={textoMensagem}
                  onChange={(event) => setTextoMensagem(event.target.value)}
                  onKeyDown={enviarMensagemPeloTeclado}
                  placeholder="Digite sua mensagem..."
                  enterKeyHint="send"
                  rows={2}
                  maxLength={4000}
                  className="max-h-24 min-h-10 min-w-0 flex-1 resize-none rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
                />
                <button
                  type="submit"
                  disabled={!textoMensagem.trim() || enviando}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Enviar"
                >
                  <Send size={18} />
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <div className="border-b border-slate-100 bg-white p-3">
              <div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2">
                <Search size={16} className="shrink-0 text-slate-400" />
                <input
                  value={buscaUsuario}
                  onChange={pesquisarUsuarios}
                  onFocus={carregarUsuariosAoFocar}
                  placeholder="Buscar usuários"
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                  Conversas
                </p>
                <button
                  type="button"
                  onClick={alternarModoGrupo}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black text-slate-600 hover:bg-slate-100"
                >
                  {modoGrupo ? 'Chat individual' : 'Criar grupo'}
                </button>
              </div>

              {conversasOrdenadas.length === 0 && (
                <p className="px-4 py-2 text-sm text-slate-400">Nenhuma conversa ainda.</p>
              )}

              {conversasOrdenadas.map((conversa) => (
                <button
                  key={conversa.id}
                  type="button"
                  onClick={() => selecionarConversa(conversa)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-white"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-600">
                    {iniciais(tituloConversa(conversa))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words font-black leading-5">
                      {tituloConversa(conversa)}
                    </span>
                    <span className="mt-0.5 block line-clamp-2 text-xs text-slate-400">
                      {conversa.ultima_mensagem?.conteudo || 'Sem mensagens.'}
                    </span>
                  </span>
                  {conversa.nao_lidas > 0 && (
                    <span className="shrink-0 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">
                      {conversa.nao_lidas}
                    </span>
                  )}
                </button>
              ))}

              <div className="px-4 pb-2 pt-4">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                  {modoGrupo ? 'Selecionar participantes' : 'Usuários'}
                </p>

                {modoGrupo && (
                  <div className="mt-2 space-y-2 rounded-2xl border border-slate-100 bg-white p-3">
                    <input
                      value={tituloGrupo}
                      onChange={(event) => setTituloGrupo(event.target.value)}
                      placeholder="Nome do grupo (opcional)"
                      maxLength={80}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-500">
                        {totalParticipantesGrupo}/{MAX_PARTICIPANTES_GRUPO} participantes
                      </p>
                      <button
                        type="button"
                        onClick={iniciarGrupo}
                        disabled={carregando || participantesGrupoIds.length < 2}
                        className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Criar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {usuarios.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => (modoGrupo ? alternarParticipanteGrupo(item) : iniciarConversa(item))}
                  disabled={carregando}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition disabled:opacity-50 ${
                    participantesGrupo.has(item.id)
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  {modoGrupo && (
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px] font-black ${
                        participantesGrupo.has(item.id)
                          ? 'border-white bg-white text-slate-900'
                          : 'border-slate-300 bg-white text-transparent'
                      }`}
                    >
                      OK
                    </span>
                  )}
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                    participantesGrupo.has(item.id)
                      ? 'bg-white/15 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {iniciais(item.nome)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words font-black leading-5">{item.nome}</span>
                    <span className={`mt-0.5 block break-words text-xs ${
                      participantesGrupo.has(item.id) ? 'text-slate-200' : 'text-slate-400'
                    }`}>{item.perfil_acesso}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </section>,
    document.body
  );
}
