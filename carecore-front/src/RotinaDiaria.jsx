// =====================================================================
// ARQUIVO: src/RotinaDiaria.jsx
// CONTROLE DE FLUXO DIÁRIO: QR CODE, LEITOR USB, MODO AUTOMÁTICO E MANUAL
// =====================================================================
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Html5Qrcode } from 'html5-qrcode';
import Sidebar from './Sidebar';
import AuthenticatedImage from './components/AuthenticatedImage';
import { AppShell, MainShell, PageHeader, PremiumButton, ScrollArea } from './components/PremiumUI';
import { API_ROOT } from './config/apiBase';
import {
  calcularResumoRotinaDiaria,
  criarItemHistoricoLeitura,
  definirAcaoAutomaticaRotina,
  exigeJustificativaRetornoRapidoRotina,
  filtrarConviventesRotina,
  getFotoUrl,
  normalizarCodigo,
  normalizarCpf,
  registroAindaPodeSerDesfeitoRotina,
  tocarBeep,
} from './utils/rotinaDiariaUtils';

export default function RotinaDiaria() {
  const navigate = useNavigate();
  const token = localStorage.getItem('@CareCore:token');

  const [conviventes, setConviventes] = useState([]);
  const [resumoHoje, setResumoHoje] = useState({});
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [processandoAcao, setProcessandoAcao] = useState(null);

  const [scannerAberto, setScannerAberto] = useState(false);
  const [pacienteEscaneado, setPacienteEscaneado] = useState(null);

  const [feedback, setFeedback] = useState(null);
  const [modoAutomatico, setModoAutomatico] = useState(true);
  const [historicoLeituras, setHistoricoLeituras] = useState([]);
  const [agoraDesfazer, setAgoraDesfazer] = useState(Date.now());
  const [retornoRapidoPendente, setRetornoRapidoPendente] = useState(null);
  const [justificativaRetornoRapido, setJustificativaRetornoRapido] = useState('');

  const ultimaLeituraRef = useRef('');
  const ultimaLeituraTempoRef = useRef(0);

  useEffect(() => {
    if (!token) {
      navigate('/');
      return;
    }

    carregarDados();
  }, [token]);

  useEffect(() => {
    const intervalo = setInterval(() => {
      setAgoraDesfazer(Date.now());
    }, 1000);

    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
  let leitor = null;
  let ativo = true;

  const iniciarCamera = async () => {
    if (!scannerAberto) return;

    try {
      leitor = new Html5Qrcode("leitor-camera");

      await leitor.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: {
            width: 250,
            height: 250
          }
        },
        async (codigoLido) => {

  if (!ativo) return;

  processarCodigoLido(codigoLido);

},
        () => {}
      );
    } catch (error) {
      console.error("Erro ao iniciar câmera QR:", error);
      alert("Não foi possível iniciar a câmera para leitura do QR Code.");
      setScannerAberto(false);
    }
  };

  iniciarCamera();

  return () => {
  ativo = false;

  if (leitor) {
    try {
      leitor.clear();
    } catch {
      // Leitor pode já ter sido encerrado pelo navegador.
    }
  }
};
}, [scannerAberto]);

  const carregarDados = async () => {
    setLoading(true);

    try {
      const config = {
        headers: { Authorization: `Bearer ${token}` }
      };

      const [resConv, resRotina] = await Promise.all([
        axios.get(`${API_ROOT}/conviventes`, config),
        axios.get(`${API_ROOT}/rotina/hoje`, config)
      ]);

      const ativos = resConv.data.filter(c => c.status === 'Ativo');

      setConviventes(ativos);
      setResumoHoje(resRotina.data || {});
    } catch (error) {
      console.error('Erro ao carregar dados da rotina', error);
      alert('Erro ao carregar os dados da portaria.');
    } finally {
      setLoading(false);
    }
  };

  const adicionarHistorico = ({ convivente, tipo, status = 'Sucesso', mensagem = '', registroId = null, retornoRapido = false, dataRegistro = null }) => {
    const novoItem = criarItemHistoricoLeitura({
      convivente,
      tipo,
      status,
      mensagem,
      registroId,
      retornoRapido,
      dataRegistro,
    });

    setHistoricoLeituras(prev => [novoItem, ...prev].slice(0, 8));
  };

  const definirAcaoAutomatica = (conviventeId) => {
    return definirAcaoAutomaticaRotina(resumoHoje, conviventeId);
  };

  const registroAindaPodeSerDesfeito = (dataRegistro) => {
    return registroAindaPodeSerDesfeitoRotina(dataRegistro, agoraDesfazer);
  };

  const exigeJustificativaRetornoRapido = (conviventeId, tipoRegistro) => {
    return exigeJustificativaRetornoRapidoRotina(resumoHoje, conviventeId, tipoRegistro);
  };


  const processarCodigoLido = (codigoBruto) => {
    const codigo = normalizarCodigo(codigoBruto);

    if (!codigo) return;

    const agora = Date.now();

    if (
      ultimaLeituraRef.current === codigo &&
      agora - ultimaLeituraTempoRef.current < 1800
    ) {
      return;
    }

    ultimaLeituraRef.current = codigo;
    ultimaLeituraTempoRef.current = agora;

    const codigoNumerico = codigo.replace(/\D/g, '');

    const pacienteEncontrado = conviventes.find(c => {
      const cpfLimpo = normalizarCpf(c.cpf);
      const prontuario = c.numero_institucional ? String(c.numero_institucional) : '';

      return (
        c.id === codigo ||
        cpfLimpo === codigoNumerico ||
        prontuario === codigo ||
        prontuario === codigoNumerico
      );
    });

    if (!pacienteEncontrado) {
      const mensagem = `Código [${codigo}] não pertence a nenhum acolhido ativo.`;

      setFeedback({
        tipo: 'Erro',
        nome: mensagem,
        horario: new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit'
        })
      });

      setTimeout(() => {
        setFeedback(null);
      }, 3200);

      adicionarHistorico({
        convivente: null,
        tipo: 'Leitura inválida',
        status: 'Erro',
        mensagem
      });

      return;
    }

    tocarBeep();
    setBusca('');

    if (modoAutomatico) {
      const acao = definirAcaoAutomatica(pacienteEncontrado.id);
      handleRegistrar(pacienteEncontrado.id, acao, pacienteEncontrado);
    } else {
      setPacienteEscaneado(pacienteEncontrado);
    }
  };

  const handleBuscaKeyDown = (e) => {
    if (e.key === 'Enter' && busca.trim() !== '') {
      processarCodigoLido(busca.trim());
    }
  };

  const handleRegistrar = async (
    conviventeId,
    tipoRegistro,
    conviventePreCarregado = null,
    opcoes = {}
  ) => {
    setProcessandoAcao(`${conviventeId}-${tipoRegistro}`);

    const convivente =
      conviventePreCarregado ||
      conviventes.find(c => c.id === conviventeId);

    if (
      exigeJustificativaRetornoRapido(conviventeId, tipoRegistro) &&
      !opcoes.ignorarChecagemRetornoRapido
    ) {
      setRetornoRapidoPendente({
        conviventeId,
        tipoRegistro,
        convivente
      });
      setJustificativaRetornoRapido('');
      setProcessandoAcao(null);
      return;
    }

    try {
      const payload = {
        convivente_id: conviventeId,
        tipo_registro: tipoRegistro
      };

      if (opcoes.justificativaRetornoRapido) {
        payload.justificativa_retorno_rapido = opcoes.justificativaRetornoRapido;
      }

      const resposta = await axios.post(`${API_ROOT}/rotina`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const registroCriado = resposta.data || {};

      setResumoHoje(prev => {
        const atual = prev[conviventeId] || {};
        const novoResumo = {
          ...atual,
          presencas: [...(atual.presencas || [])]
        };

        if (tipoRegistro === 'Entrada' || tipoRegistro === 'Saída') {
          novoResumo.ultimo_movimento = tipoRegistro;
          novoResumo.ultimo_movimento_id = registroCriado.id || null;
          novoResumo.ultimo_movimento_data =
            registroCriado.data_registro || new Date().toISOString();
        }

        if (tipoRegistro === 'Almoço') {
          novoResumo.almocou = true;
        }

        if (registroCriado.id) {
          novoResumo.presencas.push({
            id: registroCriado.id,
            tipo_registro: tipoRegistro,
            data_registro: registroCriado.data_registro || new Date().toISOString(),
            usuario_id: registroCriado.usuario_id,
            retorno_rapido: registroCriado.retorno_rapido === true,
            justificativa_retorno_rapido:
              registroCriado.justificativa_retorno_rapido || null
          });
        }

        return {
          ...prev,
          [conviventeId]: novoResumo
        };
      });

      setPacienteEscaneado(null);
      setRetornoRapidoPendente(null);
      setJustificativaRetornoRapido('');

      const nome = convivente?.nome_social || convivente?.nome_completo || 'Acolhido';

      setFeedback({
        tipo: tipoRegistro,
        nome,
        horario: new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit'
        })
      });

      adicionarHistorico({
        convivente,
        tipo: tipoRegistro,
        status: 'Sucesso',
        registroId: registroCriado.id || null,
        retornoRapido: registroCriado.retorno_rapido === true,
        dataRegistro: registroCriado.data_registro || new Date().toISOString()
      });

      setTimeout(() => {
        setFeedback(null);
      }, 2600);
    } catch (error) {
      console.error('Erro ao registrar ação', error);

      const mensagem =
        error.response?.data?.detail ||
        'Erro ao registrar a ação.';

      setFeedback({
        tipo: 'Erro',
        nome: mensagem,
        horario: new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit'
        })
      });

      adicionarHistorico({
        convivente,
        tipo: tipoRegistro,
        status: 'Erro',
        mensagem
      });

      setTimeout(() => {
        setFeedback(null);
      }, 3200);
    } finally {
      setProcessandoAcao(null);
    }
  };

  const handleConfirmarRetornoRapido = () => {
    const justificativa = justificativaRetornoRapido.trim();

    if (!justificativa) {
      alert('Informe a justificativa do retorno em menos de 10 minutos.');
      return;
    }

    if (!retornoRapidoPendente) return;

    handleRegistrar(
      retornoRapidoPendente.conviventeId,
      retornoRapidoPendente.tipoRegistro,
      retornoRapidoPendente.convivente,
      {
        justificativaRetornoRapido: justificativa,
        ignorarChecagemRetornoRapido: true
      }
    );
  };

  const handleDesfazerRegistro = async (item) => {
    if (!item?.registroId) return;

    try {
      setProcessandoAcao(`desfazer-${item.registroId}`);

      await axios.patch(
        `${API_ROOT}/rotina/${item.registroId}/desfazer`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setHistoricoLeituras(prev =>
        prev.map(h =>
          h.id === item.id || h.registroId === item.registroId
            ? {
                ...h,
                status: 'Desfeito',
                mensagem: 'Registro desfeito'
              }
            : h
        )
      );

      await carregarDados();

      setFeedback({
        tipo: 'Erro',
        nome: 'Registro desfeito com sucesso.',
        horario: new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit'
        })
      });

      setTimeout(() => {
        setFeedback(null);
      }, 2600);
    } catch (error) {
      const mensagem =
        error.response?.data?.detail ||
        'Não foi possível desfazer o registro.';

      alert(mensagem);
    } finally {
      setProcessandoAcao(null);
    }
  };

  const conviventesFiltrados = filtrarConviventesRotina(conviventes, busca);
  const { totalFora, totalDentro, totalAlmocos } =
    calcularResumoRotinaDiaria(conviventes, resumoHoje);

  return (
    <AppShell>
      <Sidebar />

      <MainShell>
        <PageHeader
          eyebrow="Rotina"
          title="Controle de Fluxo Diário"
          subtitle="Entradas, saídas e alimentação da população acolhida."
          icon="◷"
          actions={(
            <>
            <button
              onClick={() => setModoAutomatico(prev => !prev)}
              className={`px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-all flex items-center gap-2 border
                ${
                  modoAutomatico
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-gray-100 text-gray-600 border-gray-200'
                }`}
            >
              {modoAutomatico ? 'Automático' : 'Manual'}
            </button>

            <PremiumButton
              type="button"
              variant="brand"
              onClick={() => setScannerAberto(true)}
            >
              Câmera / Leitor
            </PremiumButton>

            <div className="hidden sm:flex bg-brand/10 text-brand px-4 py-2 rounded-lg font-bold text-sm shadow-sm items-center gap-2 border border-brand/20">
              📅 Hoje
            </div>
            </>
          )}
        />

        <ScrollArea className="pb-24">
          <div className="w-full max-w-7xl mx-auto space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wide">
                  Presentes na Unidade
                </p>
                <p className="text-2xl font-black text-gray-800 mt-1">
                  {totalDentro}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xl shadow-sm">
                ◇
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wide">
                  Acolhidos na Rua
                </p>
                <p className="text-2xl font-black text-gray-800 mt-1">
                  {totalFora}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-xl shadow-sm">
                ↗
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wide">
                  Almoços Servidos
                </p>
                <p className="text-2xl font-black text-gray-800 mt-1">
                  {totalAlmocos}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xl shadow-sm">
                ◌
              </div>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
              <input
                type="text"
                placeholder="🔍 Buscar nome, prontuário, CPF ou bipar leitor USB..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={handleBuscaKeyDown}
                className="w-full md:w-[450px] px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand outline-none bg-gray-50 text-sm font-medium shadow-inner"
                autoFocus
              />

              <div className="text-xs text-gray-400 flex items-center gap-2">
                <span className="font-bold bg-gray-200 px-2 py-1 rounded">
                  Modo atual:
                </span>
                {modoAutomatico
                  ? 'Bipou, registra Entrada/Saída automaticamente.'
                  : 'Bipou, abre modal para escolher a ação.'}
              </div>
            </div>

            {historicoLeituras.length > 0 && (
              <div className="mb-6 bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                  <h2 className="text-xs font-black text-gray-600 uppercase tracking-wider">
                    Últimas Leituras
                  </h2>
                  <button
                    onClick={() => setHistoricoLeituras([])}
                    className="text-[11px] font-bold text-gray-400 hover:text-gray-600"
                  >
                    Limpar
                  </button>
                </div>

                <div className="divide-y divide-gray-200">
                  {historicoLeituras.map(item => (
                    <div
                      key={item.id}
                      className="px-4 py-2 flex items-center justify-between gap-3 bg-white"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-800 uppercase truncate">
                          {item.nome}
                        </p>
                        <p className="text-[10px] text-gray-500 font-mono truncate">
                          Prontuário: #{item.prontuario}
                          {item.mensagem ? ` | ${item.mensagem}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className={`text-[10px] font-black px-2 py-1 rounded border
                            ${
                              item.status === 'Erro'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : item.status === 'Desfeito'
                                  ? 'bg-gray-100 text-gray-600 border-gray-200'
                                  : item.tipo === 'Entrada'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : item.tipo === 'Saída'
                                    ? 'bg-orange-50 text-orange-700 border-orange-200'
                                    : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}
                        >
                          {item.status === 'Erro' ? 'ERRO' : item.status === 'Desfeito' ? 'DESFEITO' : item.tipo}
                        </span>
                        {item.retornoRapido && item.status === 'Sucesso' && (
                          <span className="text-[10px] font-black px-2 py-1 rounded border bg-yellow-50 text-yellow-700 border-yellow-200">
                            RETORNO RÁPIDO
                          </span>
                        )}

                        {item.registroId && item.status === 'Sucesso' && registroAindaPodeSerDesfeito(item.dataRegistro) && (
                          <button
                            onClick={() => handleDesfazerRegistro(item)}
                            disabled={processandoAcao === `desfazer-${item.registroId}`}
                            className="text-[10px] font-black px-2 py-1 rounded border bg-red-50 text-red-700 border-red-200 hover:bg-red-100 disabled:opacity-50"
                          >
                            Desfazer
                          </button>
                        )}

                        <span className="text-[10px] text-gray-400 font-mono">
                          {item.horario}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center p-12">
                <p className="text-brand font-medium animate-pulse text-lg">
                  Carregando lista...
                </p>
              </div>
            ) : conviventesFiltrados.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl">
                <p className="text-gray-500 font-medium">
                  Nenhum acolhido encontrado.
                </p>
              </div>
            ) : (
              <div className="flex flex-col border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-gray-50 px-4 py-3 flex justify-between items-center border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <div className="flex-1">Acolhido e Prontuário</div>
                  <div className="w-24 text-center mr-4 hidden sm:block">Status</div>
                  <div className="w-[380px] text-center hidden md:block">Ações Rápidas</div>
                </div>

                {conviventesFiltrados.map((c, index) => {
                  const resumo = resumoHoje[c.id] || {};
                  const isFora = resumo.ultimo_movimento === 'Saída';
                  const almocou = resumo.almocou === true;
                  const isLast = index === conviventesFiltrados.length - 1;
                  const fotoUrl = getFotoUrl(c);

                  return (
                    <div
                      key={c.id}
                      className={`flex flex-col md:flex-row justify-between items-start md:items-center px-4 py-3 bg-white hover:bg-gray-50 transition-colors gap-4 ${!isLast ? 'border-b border-gray-100' : ''}`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0 w-full md:w-auto">
                        <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                          {fotoUrl ? (
                            <AuthenticatedImage
                              caminhoOuUrl={fotoUrl}
                              alt="Foto"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-lg opacity-40">○</span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-800 text-sm truncate uppercase">
                              {c.nome_social || c.nome_completo}
                            </span>

                            <span className="md:hidden flex-shrink-0">
                              {isFora ? (
                                <span className="bg-orange-100 text-orange-700 text-[9px] font-black px-1.5 py-0.5 rounded border border-orange-200">
                                  SAIU
                                </span>
                              ) : (
                                <span className="bg-green-100 text-green-700 text-[9px] font-black px-1.5 py-0.5 rounded border border-green-200">
                                  DENTRO
                                </span>
                              )}
                            </span>
                          </div>

                          <p className="text-[10px] text-gray-500 font-mono mt-0.5 truncate">
                            Prontuário: {c.numero_institucional ? `#${c.numero_institucional}` : 'S/N'} | CPF: {c.cpf || 'Não informado'}
                          </p>
                        </div>
                      </div>

                      <div className="w-24 flex-shrink-0 text-center hidden md:block">
                        {isFora ? (
                          <span className="bg-orange-100 text-orange-700 text-[10px] font-black px-2 py-1 rounded shadow-sm border border-orange-200 block w-16 mx-auto">
                            SAIU
                          </span>
                        ) : (
                          <span className="bg-green-100 text-green-700 text-[10px] font-black px-2 py-1 rounded shadow-sm border border-green-200 block w-16 mx-auto">
                            DENTRO
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 w-full md:w-[380px] justify-between md:justify-end flex-shrink-0 mt-2 md:mt-0">
                        <button
                          onClick={() => handleRegistrar(c.id, 'Entrada')}
                          disabled={!isFora || processandoAcao === `${c.id}-Entrada`}
                          className={`flex-1 md:flex-none px-3 py-2 md:py-1.5 rounded-md text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5
                            ${!isFora ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-60' : 'bg-emerald-500 hover:bg-emerald-600 text-white active:scale-95'}`}
                        >
                          🟢 <span className="hidden sm:inline">Entrada</span>
                        </button>

                        <button
                          onClick={() => handleRegistrar(c.id, 'Saída')}
                          disabled={isFora || processandoAcao === `${c.id}-Saída`}
                          className={`flex-1 md:flex-none px-3 py-2 md:py-1.5 rounded-md text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5
                            ${isFora ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-60' : 'bg-orange-500 hover:bg-orange-600 text-white active:scale-95'}`}
                        >
                          🔴 <span className="hidden sm:inline">Saída</span>
                        </button>

                        <button
                          onClick={() => handleRegistrar(c.id, 'Almoço')}
                          disabled={almocou || isFora || processandoAcao === `${c.id}-Almoço`}
                          className={`flex-1 md:flex-none px-3 py-2 md:py-1.5 rounded-md text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 min-w-[90px]
                            ${almocou || isFora ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-60' : 'bg-blue-500 hover:bg-blue-600 text-white active:scale-95'}`}
                        >
                          {almocou ? 'Almoçou' : 'Almoço'}
                        </button>

                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          </div>
        </ScrollArea>

      {scannerAberto && (
        <div className="fixed inset-0 bg-gray-900/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-gray-800 p-4 flex justify-between items-center text-white">
              <h2 className="font-bold">Posicione o QR Code na câmera</h2>
              <button
                onClick={() => setScannerAberto(false)}
                className="text-gray-400 hover:text-white font-bold text-xl px-2"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-black flex justify-center">
              <div
                id="leitor-camera"
                className="w-full max-w-[400px] border-2 border-brand rounded-lg overflow-hidden"
              />
            </div>

            <div className="p-4 bg-gray-50 text-center text-sm text-gray-600">
              {modoAutomatico
                ? 'Modo automático ativo: a leitura registra Entrada ou Saída automaticamente.'
                : 'Modo manual ativo: a leitura abre o painel de ações.'}
            </div>
          </div>
        </div>
      )}

      {pacienteEscaneado && (() => {
        const pInfo = resumoHoje[pacienteEscaneado.id] || {};
        const isFora = pInfo.ultimo_movimento === 'Saída';
        const almocou = pInfo.almocou === true;
        const fotoUrl = getFotoUrl(pacienteEscaneado);

        return (
          <div className="fixed inset-0 bg-gray-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
              <div className="bg-brand p-5 flex justify-between items-center text-white">
                <h2 className="text-lg font-bold">Acolhido Identificado</h2>
                <button
                  onClick={() => setPacienteEscaneado(null)}
                  className="text-white/80 hover:text-white text-xl"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 text-center space-y-4">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-3xl mx-auto shadow-inner border border-gray-200 overflow-hidden">
                  {fotoUrl ? (
                    <AuthenticatedImage
                      caminhoOuUrl={fotoUrl}
                      alt="Foto"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="opacity-40">○</span>
                  )}
                </div>

                <div>
                  <h3 className="font-black text-xl text-gray-800 uppercase">
                    {pacienteEscaneado.nome_social || pacienteEscaneado.nome_completo}
                  </h3>
                  <p className="text-sm text-gray-500 font-mono mt-1">
                    Prontuário: #{pacienteEscaneado.numero_institucional || 'S/N'}
                  </p>
                </div>

                <div className="inline-block px-3 py-1 bg-gray-100 rounded-full text-xs font-bold text-gray-600 uppercase tracking-wide border border-gray-200">
                  Status Atual:{' '}
                  {isFora ? (
                    <span className="text-orange-600">Fora da Unidade</span>
                  ) : (
                    <span className="text-green-600">Dentro da Unidade</span>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-100 grid grid-cols-1 gap-3">
                  <button
                    onClick={() => handleRegistrar(pacienteEscaneado.id, 'Entrada')}
                    disabled={!isFora}
                    className={`py-3 rounded-xl font-bold transition-all flex justify-center items-center gap-2 text-sm shadow-md
                      ${!isFora ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-600 text-white'}`}
                  >
                    🟢 Registrar Entrada
                  </button>

                  <button
                    onClick={() => handleRegistrar(pacienteEscaneado.id, 'Saída')}
                    disabled={isFora}
                    className={`py-3 rounded-xl font-bold transition-all flex justify-center items-center gap-2 text-sm shadow-md
                      ${isFora ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600 text-white'}`}
                  >
                    🔴 Registrar Saída
                  </button>

                  <button
                    onClick={() => handleRegistrar(pacienteEscaneado.id, 'Almoço')}
                    disabled={almocou || isFora}
                    className={`py-3 rounded-xl font-bold transition-all flex justify-center items-center gap-2 text-sm shadow-md
                      ${almocou || isFora ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
                  >
                    {almocou ? 'Almoço já registrado' : 'Registrar almoço'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {retornoRapidoPendente && (
        <div className="fixed inset-0 bg-gray-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-yellow-500 p-5 flex justify-between items-center text-white">
              <h2 className="text-lg font-bold">Retorno rápido detectado</h2>
              <button
                onClick={() => {
                  setRetornoRapidoPendente(null);
                  setJustificativaRetornoRapido('');
                }}
                className="text-white/80 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-700 leading-relaxed">
                Este acolhido está retornando em menos de 10 minutos após a saída.
                Informe a justificativa operacional para registrar a entrada.
              </p>

              <textarea
                value={justificativaRetornoRapido}
                onChange={(e) => setJustificativaRetornoRapido(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-yellow-400"
                placeholder="Ex.: saiu por engano, retorno por orientação da equipe, correção de fluxo..."
                autoFocus
              />

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => {
                    setRetornoRapidoPendente(null);
                    setJustificativaRetornoRapido('');
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-gray-100 text-gray-600 hover:bg-gray-200"
                >
                  Cancelar
                </button>

                <button
                  onClick={handleConfirmarRetornoRapido}
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-yellow-500 text-white hover:bg-yellow-600 shadow-sm"
                >
                  Confirmar Entrada
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {feedback && (
        <div className="fixed bottom-6 right-6 z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden w-[320px]">
          <div
            className={`
              px-5 py-4 text-white
              ${
                feedback.tipo === 'Entrada'
                  ? 'bg-emerald-500'
                  : feedback.tipo === 'Saída'
                    ? 'bg-orange-500'
                    : feedback.tipo === 'Erro'
                      ? 'bg-red-500'
                      : 'bg-blue-500'
              }
            `}
          >
            <p className="text-xs font-bold uppercase opacity-90">
              {feedback.tipo === 'Erro' ? 'Atenção' : 'Registro realizado'}
            </p>
            <h3 className="text-lg font-black">
              {feedback.tipo}
            </h3>
          </div>

          <div className="p-4">
            <p className="font-bold text-gray-800 uppercase text-sm">
              {feedback.nome}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Horário: {feedback.horario}
            </p>
          </div>
        </div>
      )}
      </MainShell>
    </AppShell>
  );
}

