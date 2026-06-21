// =====================================================================
// ARQUIVO: src/RotinaDiaria.jsx
// CONTROLE DE FLUXO DIÁRIO: QR CODE, LEITOR USB, MODO AUTOMÁTICO E MANUAL
// =====================================================================
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Sidebar from './Sidebar';
import AuthenticatedImage from './components/AuthenticatedImage';
import { AppShell, MainShell, PageHeader, PremiumButton, ScrollArea } from './components/PremiumUI';
import { API_ROOT } from './config/apiBase';
import { useDeviceInfo } from './hooks/useDeviceInfo';
import { criarHeadersAutenticados } from './utils/requestIdUtils';
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
import {
  deveIgnorarLeituraCodigoRepetida,
  deveIgnorarLeituraConviventeRepetida,
} from './utils/leituraCodigoUtils';

const OPCOES_INTERACAO_ROTINA = [
  { valor: 'Café da manhã', label: 'Café da manhã', grupo: 'refeicao' },
  { valor: 'Almoço', label: 'Almoço', grupo: 'refeicao' },
  { valor: 'Jantar', label: 'Jantar', grupo: 'refeicao' },
  { valor: 'Lanche noturno', label: 'Lanche noturno', grupo: 'refeicao' },
  { valor: 'Banho', label: 'Banho', grupo: 'simples' },
  { valor: 'Cobertor', label: 'Cobertor (sugerir retirada/entrega)', grupo: 'par' },
  { valor: 'Toalha', label: 'Toalha (sugerir retirada/entrega)', grupo: 'par' },
  { valor: 'Movimentação de Bagageiro', label: 'Movimentação de Bagageiro', grupo: 'observacao' },
  { valor: 'Bipar documentos guardados', label: 'Documentos guardados', grupo: 'observacao' },
  { valor: 'Bipar documentos retirados', label: 'Documentos retirados', grupo: 'observacao' },
];

const TIPOS_ROTINA_REFEICOES = ['Café da manhã', 'Almoço', 'Jantar', 'Lanche noturno'];

const ROTULOS_REFEICAO_EXTRA = {
  'Café da manhã': 'café da manhã',
  Almoço: 'almoço',
  Jantar: 'jantar',
  'Lanche noturno': 'lanche noturno',
};

export default function RotinaDiaria() {
  const navigate = useNavigate();
  const token = localStorage.getItem('@CareCore:token');
  const deviceInfo = useDeviceInfo();

  const [conviventes, setConviventes] = useState([]);
  const [resumoHoje, setResumoHoje] = useState({});
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [processandoAcao, setProcessandoAcao] = useState(null);

  const [scannerAberto, setScannerAberto] = useState(false);
  const [scannerErro, setScannerErro] = useState('');
  const [codigoManualScanner, setCodigoManualScanner] = useState('');
  const [pacienteEscaneado, setPacienteEscaneado] = useState(null);

  const [feedback, setFeedback] = useState(null);
  const [modoAutomatico, setModoAutomatico] = useState(true);
  const [tipoBipagemAutomatica, setTipoBipagemAutomatica] = useState('fluxo');
  const [interacaoSelecionada, setInteracaoSelecionada] = useState('Almoço');
  const [interacaoConfirmacao, setInteracaoConfirmacao] = useState(null);
  const [refeicaoExtraPendente, setRefeicaoExtraPendente] = useState(null);
  const [interacaoObservacaoPendente, setInteracaoObservacaoPendente] = useState(null);
  const [observacaoInteracao, setObservacaoInteracao] = useState('');
  const [resumoInteracoesAberto, setResumoInteracoesAberto] = useState(false);
  const [historicoLeituras, setHistoricoLeituras] = useState([]);
  const [agoraDesfazer, setAgoraDesfazer] = useState(Date.now());
  const [retornoRapidoPendente, setRetornoRapidoPendente] = useState(null);
  const [justificativaRetornoRapido, setJustificativaRetornoRapido] = useState('');

  const ultimaLeituraRef = useRef({ codigo: '', horario: 0 });
  const ultimaLeituraConviventeRef = useRef({ conviventeId: '', horario: 0 });
  const assinaturaSyncRotinaRef = useRef(null);
  const processarCodigoLidoRef = useRef(null);
  const leituraUsbBufferRef = useRef('');
  const leituraUsbUltimaTeclaRef = useRef(0);
  const campoLeitorPistolaRef = useRef(null);

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
      setScannerErro('');

      if (!navigator.mediaDevices?.getUserMedia) {
        setScannerErro('Este navegador não disponibilizou acesso à câmera. Use o campo manual abaixo.');
        return;
      }

      // Garante que o modal e o elemento #leitor-camera já foram renderizados.
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (!ativo) return;

      const elementoLeitor = document.getElementById("leitor-camera");
      if (!elementoLeitor) {
        setScannerErro('Não foi possível preparar o leitor da câmera. Feche e abra o leitor novamente.');
        return;
      }

      const { Html5Qrcode } = await import('html5-qrcode');
      if (!ativo) return;

      const cameras = await Html5Qrcode.getCameras();
      if (!cameras?.length) {
        setScannerErro('Nenhuma câmera foi encontrada neste computador. Verifique as permissões do Windows e do navegador.');
        return;
      }

      const cameraPreferida = cameras.find((camera) => {
        const label = String(camera.label || '').toLowerCase();
        return deviceInfo.isTouchDevice
          ? /back|rear|environment|traseira/.test(label)
          : /front|user|integrated|webcam|camera|câmera/.test(label);
      }) || cameras[0];

      leitor = new Html5Qrcode("leitor-camera");

      await leitor.start(
        cameraPreferida.id,
        {
          fps: 10,
          qrbox: {
            width: 250,
            height: 250
          }
        },
        async (codigoLido) => {

  if (!ativo) return;

  processarCodigoLidoRef.current?.(codigoLido);

},
        () => {}
      );
    } catch (error) {
      console.error("Erro ao iniciar câmera QR:", error);
      const nomeErro = error?.name || '';
      const mensagemErro = String(error?.message || error || '');
      const detalhe =
        nomeErro === 'NotAllowedError'
          ? 'A câmera foi bloqueada pelo navegador ou pelo Windows.'
          : nomeErro === 'NotFoundError'
            ? 'Nenhuma câmera foi encontrada neste computador.'
            : nomeErro === 'NotReadableError'
              ? 'A câmera pode estar em uso por outro aplicativo.'
              : mensagemErro.includes('Permission')
                ? 'A permissão da câmera ainda parece bloqueada.'
                : '';

      setScannerErro(
        deviceInfo.isSecureCameraContext
          ? `Não foi possível iniciar a câmera para leitura do QR Code. ${detalhe || 'Verifique se a câmera está livre e permitida no navegador.'}`
          : "O navegador do celular pode bloquear câmera em endereço local HTTP. Use o campo manual abaixo ou acesse por HTTPS quando publicado."
      );
    }
  };

  iniciarCamera();

  return () => {
  ativo = false;

  if (leitor) {
    try {
      leitor.stop?.();
      leitor.clear();
    } catch {
      // Leitor pode já ter sido encerrado pelo navegador.
    }
  }
};
}, [scannerAberto, deviceInfo.isSecureCameraContext, deviceInfo.isTouchDevice]);

  const carregarDados = async ({ silencioso = false } = {}) => {
    if (!silencioso) {
      setLoading(true);
    }

    try {
      const config = {
        headers: criarHeadersAutenticados(token)
      };

      const [resConv, resRotina] = await Promise.all([
        axios.get(`${API_ROOT}/conviventes/resumo`, config),
        axios.get(`${API_ROOT}/rotina/hoje`, config)
      ]);

      const ativos = resConv.data.filter(c => c.status === 'Ativo');

      setConviventes(ativos);
      setResumoHoje(resRotina.data || {});
    } catch (error) {
      console.error('Erro ao carregar dados da rotina', error);
      if (!silencioso) {
        setFeedback({
          tipo: 'Erro',
          nome: 'Erro ao carregar os dados da portaria.',
          horario: new Date().toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
          })
        });
      }
    } finally {
      if (!silencioso) {
        setLoading(false);
      }
    }
  };

  const obterAssinaturaSyncRotina = (status) => {
    return [
      status?.total_registros_hoje ?? 0,
      status?.ultimo_evento ?? 'sem-evento',
    ].join('|');
  };

  const verificarSincronizacaoRotina = async () => {
    try {
      const response = await axios.get(`${API_ROOT}/rotina/sync-status`, {
        headers: criarHeadersAutenticados(token)
      });
      const assinaturaAtual = obterAssinaturaSyncRotina(response.data || {});

      if (!assinaturaSyncRotinaRef.current) {
        assinaturaSyncRotinaRef.current = assinaturaAtual;
        return;
      }

      if (assinaturaSyncRotinaRef.current !== assinaturaAtual) {
        assinaturaSyncRotinaRef.current = assinaturaAtual;
        await carregarDados({ silencioso: true });
      }
    } catch (error) {
      console.warn('Não foi possível verificar sincronização da rotina', error);
    }
  };

  useEffect(() => {
    if (!token) return undefined;

    const sincronizar = () => verificarSincronizacaoRotina();
    const intervalo = window.setInterval(sincronizar, 5000);
    const sincronizarAoVoltar = () => {
      if (document.visibilityState === 'visible') {
        sincronizar();
      }
    };

    window.addEventListener('focus', sincronizar);
    document.addEventListener('visibilitychange', sincronizarAoVoltar);

    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener('focus', sincronizar);
      document.removeEventListener('visibilitychange', sincronizarAoVoltar);
    };
  }, [token]);

  const adicionarHistorico = ({ convivente, tipo, status = 'Sucesso', mensagem = '', registroId = null, retornoRapido = false, dataRegistro = null, desfazerExpiraEm = null }) => {
    const novoItem = criarItemHistoricoLeitura({
      convivente,
      tipo,
      status,
      mensagem,
      registroId,
      retornoRapido,
      dataRegistro,
      desfazerExpiraEm,
    });

    setHistoricoLeituras(prev => [novoItem, ...prev].slice(0, 8));
  };

  const definirAcaoAutomatica = (conviventeId) => {
    return definirAcaoAutomaticaRotina(resumoHoje, conviventeId);
  };

  const registroAindaPodeSerDesfeito = (itemOuDataRegistro) => {
    if (itemOuDataRegistro?.desfazerExpiraEm) {
      return registroAindaPodeSerDesfeitoRotina(itemOuDataRegistro.desfazerExpiraEm, agoraDesfazer);
    }

    return registroAindaPodeSerDesfeitoRotina(itemOuDataRegistro, agoraDesfazer);
  };

  const exigeJustificativaRetornoRapido = (conviventeId, tipoRegistro) => {
    return exigeJustificativaRetornoRapidoRotina(resumoHoje, conviventeId, tipoRegistro);
  };

  const obterProximaInteracaoPar = (conviventeId, grupo) => {
    const ultima = resumoHoje[conviventeId]?.ultimas_interacoes?.[grupo]?.tipo_registro || '';

    if (grupo === 'Toalha') {
      return ultima === 'Retirada de Toalha' ? 'Entrega de Toalha' : 'Retirada de Toalha';
    }

    if (grupo === 'Cobertor') {
      return ultima === 'Retirada de Cobertor' ? 'Entrega de Cobertor' : 'Retirada de Cobertor';
    }

    return null;
  };

  const conviventeEstaFora = (conviventeId) => resumoHoje[conviventeId]?.ultimo_movimento === 'Saída';

  const obterResumoRefeicao = (conviventeId, tipoRegistro) => {
    const resumo = resumoHoje[conviventeId] || {};
    const refeicao = resumo.refeicoes?.[tipoRegistro] || null;
    const registros = Array.isArray(refeicao?.registros)
      ? refeicao.registros
      : (refeicao ? [refeicao] : []);
    const quantidade = Number(refeicao?.quantidade ?? registros.length);

    if (quantidade > 0) {
      return {
        quantidade,
        ultimoRegistro: refeicao?.ultimo_registro || registros[registros.length - 1] || refeicao,
      };
    }

    const presencas = Array.isArray(resumo.presencas) ? resumo.presencas : [];
    const registrosDoTipo = presencas.filter(registro => registro.tipo_registro === tipoRegistro);

    return {
      quantidade: registrosDoTipo.length,
      ultimoRegistro: registrosDoTipo[registrosDoTipo.length - 1] || null,
    };
  };

  const abrirConfirmacaoRefeicaoExtra = (convivente, tipoRegistro, resumoRefeicao) => {
    setRefeicaoExtraPendente({
      convivente,
      tipoRegistro,
      quantidadeAtual: resumoRefeicao.quantidade,
      ultimoRegistro: resumoRefeicao.ultimoRegistro,
    });
  };

  const avisarConviventeFora = (convivente, tipoRegistro = 'Interação') => {
    const mensagem = 'Convivente está fora da unidade. Registre uma entrada antes de qualquer interação.';

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
      convivente,
      tipo: tipoRegistro,
      status: 'Erro',
      mensagem
    });
  };

  const solicitarRegistroInteracao = (convivente) => {
    const opcao = OPCOES_INTERACAO_ROTINA.find(item => item.valor === interacaoSelecionada);
    if (!opcao) return;

    if (conviventeEstaFora(convivente.id)) {
      avisarConviventeFora(convivente, opcao.valor);
      return;
    }

    if (opcao.grupo === 'par') {
      const tipoSugerido = obterProximaInteracaoPar(convivente.id, opcao.valor);
      const ultima = resumoHoje[convivente.id]?.ultimas_interacoes?.[opcao.valor] || null;
      setInteracaoConfirmacao({ convivente, tipoRegistro: tipoSugerido, grupo: opcao.valor, ultima });
      return;
    }

    if (opcao.grupo === 'observacao') {
      setInteracaoObservacaoPendente({ convivente, tipoRegistro: opcao.valor });
      setObservacaoInteracao('');
      return;
    }

    if (opcao.grupo === 'refeicao') {
      const resumoRefeicao = obterResumoRefeicao(convivente.id, opcao.valor);

      if (resumoRefeicao.quantidade > 0) {
        abrirConfirmacaoRefeicaoExtra(convivente, opcao.valor, resumoRefeicao);
        return;
      }
    }

    handleRegistrar(convivente.id, opcao.valor, convivente);
  };

  const processarCodigoLido = (codigoBruto) => {
    if (deveIgnorarLeituraCodigoRepetida(ultimaLeituraRef, codigoBruto)) {
      return;
    }

    const codigo = ultimaLeituraRef.current.codigo || normalizarCodigo(codigoBruto);
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
      if (processandoAcao) {
        return;
      }

      if (deveIgnorarLeituraConviventeRepetida(ultimaLeituraConviventeRef, pacienteEncontrado.id)) {
        return;
      }

      if (tipoBipagemAutomatica === 'interacao') {
        solicitarRegistroInteracao(pacienteEncontrado);
        return;
      }

      const acao = definirAcaoAutomatica(pacienteEncontrado.id);
      handleRegistrar(pacienteEncontrado.id, acao, pacienteEncontrado);
    } else {
      setPacienteEscaneado(pacienteEncontrado);
    }
  };

  useEffect(() => {
    processarCodigoLidoRef.current = processarCodigoLido;
  });

  useEffect(() => {
    if (!scannerAberto) return;

    const timer = setTimeout(() => {
      campoLeitorPistolaRef.current?.focus();
    }, 180);

    return () => clearTimeout(timer);
  }, [scannerAberto]);

  useEffect(() => {
    const handleLeitorUsbGlobal = (event) => {
      const tag = event.target?.tagName?.toLowerCase();
      const editandoTexto =
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        event.target?.isContentEditable;

      if (editandoTexto || event.ctrlKey || event.altKey || event.metaKey) return;

      const agora = Date.now();
      if (agora - leituraUsbUltimaTeclaRef.current > 120) {
        leituraUsbBufferRef.current = '';
      }
      leituraUsbUltimaTeclaRef.current = agora;

      if (event.key === 'Enter') {
        const codigo = leituraUsbBufferRef.current.trim();
        leituraUsbBufferRef.current = '';
        if (codigo) {
          event.preventDefault();
          processarCodigoLidoRef.current?.(codigo);
        }
        return;
      }

      if (event.key?.length === 1) {
        leituraUsbBufferRef.current += event.key;
      }
    };

    window.addEventListener('keydown', handleLeitorUsbGlobal);
    return () => window.removeEventListener('keydown', handleLeitorUsbGlobal);
  }, []);

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
    const convivente =
      conviventePreCarregado ||
      conviventes.find(c => c.id === conviventeId);

    if (tipoRegistro !== 'Entrada' && conviventeEstaFora(conviventeId)) {
      avisarConviventeFora(convivente, tipoRegistro);
      return;
    }

    if (
      TIPOS_ROTINA_REFEICOES.includes(tipoRegistro) &&
      !opcoes.confirmarRefeicaoExtra
    ) {
      const resumoRefeicao = obterResumoRefeicao(conviventeId, tipoRegistro);

      if (resumoRefeicao.quantidade > 0) {
        abrirConfirmacaoRefeicaoExtra(convivente, tipoRegistro, resumoRefeicao);
        return;
      }
    }

    setProcessandoAcao(`${conviventeId}-${tipoRegistro}`);

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

      if (opcoes.observacao) {
        payload.observacao = opcoes.observacao;
      }

      if (opcoes.justificativaRetornoRapido) {
        payload.justificativa_retorno_rapido = opcoes.justificativaRetornoRapido;
      }

      if (opcoes.confirmarRefeicaoExtra) {
        payload.confirmar_refeicao_extra = true;
      }

      const resposta = await axios.post(`${API_ROOT}/rotina`, payload, {
        headers: criarHeadersAutenticados(token)
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

        if (TIPOS_ROTINA_REFEICOES.includes(tipoRegistro)) {
          const refeicaoAtual = novoResumo.refeicoes?.[tipoRegistro] || {};
          const registrosAtuais = Array.isArray(refeicaoAtual.registros)
            ? refeicaoAtual.registros
            : (refeicaoAtual.id ? [refeicaoAtual] : []);
          const novoItemRefeicao = {
            id: registroCriado.id || null,
            data_registro: registroCriado.data_registro || new Date().toISOString(),
          };

          novoResumo.refeicoes = {
            ...(novoResumo.refeicoes || {}),
            [tipoRegistro]: {
              quantidade: registrosAtuais.length + 1,
              registros: [...registrosAtuais, novoItemRefeicao],
              primeiro_registro: refeicaoAtual.primeiro_registro || registrosAtuais[0] || novoItemRefeicao,
              ultimo_registro: novoItemRefeicao,
              id: novoItemRefeicao.id,
              data_registro: novoItemRefeicao.data_registro,
            },
          };
        }

        if (['Retirada de Cobertor', 'Entrega de Cobertor'].includes(tipoRegistro)) {
          novoResumo.ultimas_interacoes = {
            ...(novoResumo.ultimas_interacoes || {}),
            Cobertor: {
              tipo_registro: tipoRegistro,
              data_registro: registroCriado.data_registro || new Date().toISOString(),
            },
          };
        }

        if (['Retirada de Toalha', 'Entrega de Toalha'].includes(tipoRegistro)) {
          novoResumo.ultimas_interacoes = {
            ...(novoResumo.ultimas_interacoes || {}),
            Toalha: {
              tipo_registro: tipoRegistro,
              data_registro: registroCriado.data_registro || new Date().toISOString(),
            },
          };
        }

        if (registroCriado.id) {
          novoResumo.presencas.push({
            id: registroCriado.id,
            tipo_registro: tipoRegistro,
            observacao: registroCriado.observacao || opcoes.observacao || null,
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
      setRefeicaoExtraPendente(null);
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
        dataRegistro: registroCriado.data_registro || new Date().toISOString(),
        desfazerExpiraEm: Date.now() + 60 * 1000
      });

      setTimeout(() => {
        setFeedback(null);
      }, 2600);
    } catch (error) {
      console.error('Erro ao registrar ação', error);

      const mensagem =
        error.response?.data?.detail ||
        'Erro ao registrar a ação.';

      if (
        !opcoes.ignorarChecagemRetornoRapido &&
        typeof mensagem === 'string' &&
        mensagem.toLowerCase().includes('menos de 10 minutos')
      ) {
        setRetornoRapidoPendente({
          conviventeId,
          tipoRegistro,
          convivente
        });
        setJustificativaRetornoRapido('');
        return;
      }

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
      setFeedback({
        tipo: 'Erro',
        nome: 'Informe a justificativa do retorno em menos de 10 minutos.',
        horario: new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit'
        })
      });
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
          headers: criarHeadersAutenticados(token)
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

      setFeedback({
        tipo: 'Erro',
        nome: mensagem,
        horario: new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit'
        })
      });
    } finally {
      setProcessandoAcao(null);
    }
  };

  const conviventesFiltrados = filtrarConviventesRotina(conviventes, busca);
  const { totalFora, totalDentro, totalInteracoesRotina } =
    calcularResumoRotinaDiaria(conviventes, resumoHoje);
  const resumoInteracoesPorTipo = Object.values(resumoHoje).reduce((acc, resumo) => {
    const presencas = Array.isArray(resumo?.presencas) ? resumo.presencas : [];
    presencas.forEach((registro) => {
      if (['Entrada', 'Saída'].includes(registro.tipo_registro)) return;
      acc[registro.tipo_registro] = (acc[registro.tipo_registro] || 0) + 1;
    });
    return acc;
  }, {});
  const resumoInteracoesLista = Object.entries(resumoInteracoesPorTipo)
    .sort(([, totalA], [, totalB]) => totalB - totalA);
  const resumoInteracoesTooltip = resumoInteracoesLista.length
    ? resumoInteracoesLista.map(([tipo, total]) => `${tipo}: ${total}`).join('\n')
    : 'Nenhuma interação de rotina registrada hoje.';
  const placeholderBusca = modoAutomatico && tipoBipagemAutomatica === 'interacao'
    ? 'Digite o código do prontuário para registrar a interação selecionada...'
    : 'Buscar nome, prontuário, CPF ou bipar leitor USB...';
  const ultimoRegistroDesfazivel = historicoLeituras.find(
    item => item.registroId && item.status === 'Sucesso' && registroAindaPodeSerDesfeito(item)
  );

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

            {modoAutomatico && (
              <select
                value={tipoBipagemAutomatica}
                onChange={(event) => setTipoBipagemAutomatica(event.target.value)}
                className="min-h-10 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700 shadow-sm outline-none"
                title="Escolha o que o bip automático deve registrar"
              >
                <option value="fluxo">Bipar entrada/saída</option>
                <option value="interacao">Bipar interação</option>
              </select>
            )}

            <PremiumButton
              type="button"
              variant="brand"
              onClick={() => {
                setScannerErro('');
                setCodigoManualScanner('');
                setScannerAberto(true);
              }}
            >
              Câmera / Leitor
            </PremiumButton>

            <div className="hidden sm:flex bg-brand/10 text-brand px-4 py-2 rounded-lg font-bold text-sm shadow-sm items-center gap-2 border border-brand/20">
              Hoje
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
                {">"}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setResumoInteracoesAberto(true)}
              title={resumoInteracoesTooltip}
              className="group relative bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between text-left hover:border-blue-200 hover:shadow-md transition-all"
            >
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wide">
                  Interações de Rotina
                </p>
                <p className="text-2xl font-black text-gray-800 mt-1">
                  {totalInteracoesRotina}
                </p>
                <p className="mt-1 text-[11px] font-bold text-blue-600">
                  Clique para ver por tipo
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xl shadow-sm">
                ◌
              </div>
              <div className="pointer-events-none absolute right-4 top-full z-20 mt-2 hidden w-64 rounded-xl border border-gray-100 bg-white p-3 text-xs font-semibold text-gray-700 shadow-xl group-hover:block">
                {resumoInteracoesLista.length === 0 ? (
                  <p className="text-gray-400">Nenhuma interação registrada hoje.</p>
                ) : (
                  resumoInteracoesLista.slice(0, 8).map(([tipo, total]) => (
                    <div key={tipo} className="flex items-center justify-between gap-3 py-1">
                      <span className="truncate">{tipo}</span>
                      <span className="font-black text-blue-700">{total}</span>
                    </div>
                  ))
                )}
              </div>
            </button>
          </div>

          <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
              <div className="flex w-full flex-col gap-2 md:w-[560px] sm:flex-row">
                <input
                  type="text"
                  placeholder={placeholderBusca}
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  onKeyDown={handleBuscaKeyDown}
                  className="min-h-12 flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand outline-none bg-gray-50 text-sm font-medium shadow-inner"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!busca.trim()) return;
                    processarCodigoLido(busca.trim());
                  }}
                  className="min-h-12 rounded-xl bg-gray-900 px-4 py-2 text-xs font-black text-white hover:bg-black"
                >
                  Registrar manual
                </button>
              </div>

              <div className="text-xs text-gray-400 flex items-center gap-2">
                <span className="font-bold bg-gray-200 px-2 py-1 rounded">
                  Modo atual:
                </span>
                {modoAutomatico
                  ? tipoBipagemAutomatica === 'interacao'
                    ? `Bipou, registra interação: ${OPCOES_INTERACAO_ROTINA.find(item => item.valor === interacaoSelecionada)?.label || interacaoSelecionada}.`
                    : 'Bipou, registra Entrada/Saída automaticamente.'
                  : 'Bipou, abre modal para escolher a ação.'}
              </div>
            </div>

            {modoAutomatico && (
              <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-blue-700">
                      Tipo de bipagem automática
                    </p>
                    <p className="mt-1 text-sm font-semibold text-blue-900">
                      {tipoBipagemAutomatica === 'interacao'
                        ? 'Cada leitura registra ou confirma a interação de rotina selecionada.'
                        : 'Cada leitura alterna Entrada ou Saída conforme o último movimento.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTipoBipagemAutomatica('fluxo')}
                      className={`min-h-11 rounded-xl px-4 py-2 text-xs font-black transition-colors ${
                        tipoBipagemAutomatica === 'fluxo'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-white text-blue-700 border border-blue-100'
                      }`}
                    >
                      Entrada/Saída
                    </button>

                    <button
                      type="button"
                      onClick={() => setTipoBipagemAutomatica('interacao')}
                      className={`min-h-11 rounded-xl px-4 py-2 text-xs font-black transition-colors ${
                        tipoBipagemAutomatica === 'interacao'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-white text-blue-700 border border-blue-100'
                      }`}
                    >
                      Interação
                    </button>
                  </div>
                </div>

                {tipoBipagemAutomatica === 'interacao' && (
                  <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto] md:items-end">
                    <div>
                      <label className="mb-1 block text-[10px] font-black uppercase tracking-wide text-blue-700">
                        Tipo de interação
                      </label>
                      <select
                        value={interacaoSelecionada}
                        onChange={(event) => setInteracaoSelecionada(event.target.value)}
                        className="min-h-11 w-full rounded-xl border border-blue-100 bg-white px-3 py-2 text-sm font-bold text-blue-800 outline-none"
                      >
                        {OPCOES_INTERACAO_ROTINA.map((opcao) => (
                          <option key={opcao.valor} value={opcao.valor}>
                            {opcao.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-blue-700 border border-blue-100">
                      Refeições repetidas pedem confirmação e entram como extras; toalha/cobertor sugerem a próxima ação.
                    </p>
                  </div>
                )}
              </div>
            )}

            {ultimoRegistroDesfazivel && (
              <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-wide text-red-500">
                      Desfazer disponível por 1 minuto
                    </p>
                    <p className="mt-1 truncate text-sm font-black text-slate-900">
                      {ultimoRegistroDesfazivel.nome}
                    </p>
                    <p className="text-xs text-slate-600">
                      {ultimoRegistroDesfazivel.tipo} registrado às {ultimoRegistroDesfazivel.horario}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDesfazerRegistro(ultimoRegistroDesfazivel)}
                    disabled={processandoAcao === `desfazer-${ultimoRegistroDesfazivel.registroId}`}
                    className="min-h-11 rounded-2xl bg-red-600 px-5 py-2 text-sm font-black text-white shadow-sm disabled:opacity-60"
                  >
                    Desfazer registro
                  </button>
                </div>
              </div>
            )}

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
                      className="flex flex-col gap-3 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
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

                      <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0 sm:justify-end">
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

                        {item.registroId && item.status === 'Sucesso' && registroAindaPodeSerDesfeito(item) && (
                          <button
                            onClick={() => handleDesfazerRegistro(item)}
                            disabled={processandoAcao === `desfazer-${item.registroId}`}
                            className="min-h-9 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-black text-red-700 hover:bg-red-100 disabled:opacity-50"
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
                              lazy
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

                      <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3 md:mt-0 md:flex md:w-[380px] md:flex-shrink-0 md:items-center md:justify-end">
                        <button
                          onClick={() => handleRegistrar(c.id, 'Entrada')}
                          disabled={!isFora || processandoAcao === `${c.id}-Entrada`}
                          className={`min-h-11 md:min-h-0 px-3 py-2 md:py-1.5 rounded-md text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5
                            ${!isFora ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-60' : 'bg-emerald-500 hover:bg-emerald-600 text-white active:scale-95'}`}
                        >
                          <span className="text-[11px] sm:text-xs">Entrada</span>
                        </button>

                        <button
                          onClick={() => handleRegistrar(c.id, 'Saída')}
                          disabled={isFora || processandoAcao === `${c.id}-Saída`}
                          className={`min-h-11 md:min-h-0 px-3 py-2 md:py-1.5 rounded-md text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5
                            ${isFora ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-60' : 'bg-orange-500 hover:bg-orange-600 text-white active:scale-95'}`}
                        >
                          <span className="text-[11px] sm:text-xs">Saída</span>
                        </button>

                        <button
                          onClick={() => solicitarRegistroInteracao(c)}
                          disabled={isFora || processandoAcao === `${c.id}-${interacaoSelecionada}`}
                          className={`min-h-11 md:min-h-0 px-3 py-2 md:py-1.5 rounded-md text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 md:min-w-[90px]
                            ${isFora ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-60' : 'bg-blue-500 hover:bg-blue-600 text-white active:scale-95'}`}
                        >
                          <span className="text-[11px] sm:text-xs">Interação</span>
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
        <div className="carecore-modal-overlay fixed inset-0 bg-gray-900/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="carecore-modal-panel bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex max-h-[calc(100vh-2rem)] flex-col">
            <div className="bg-gray-800 p-4 flex items-center justify-between gap-3 text-white">
              <h2 className="font-bold">Posicione o QR Code na câmera</h2>
              <button
                onClick={() => {
                  setScannerAberto(false);
                  setScannerErro('');
                }}
                className="text-gray-400 hover:text-white font-bold text-xl px-2"
              >
                ✕
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto">
            <div className="p-4 bg-black flex justify-center">
              <div
                id="leitor-camera"
                className="w-full max-w-[400px] border-2 border-brand rounded-lg overflow-hidden"
              />
            </div>

            {scannerErro && (
              <div className="mx-4 mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-left text-sm font-semibold text-amber-800">
                {scannerErro}
              </div>
            )}

            {modoAutomatico && (
              <div className="mx-4 mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-3">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-blue-700">
                  Registro automático da leitura
                </label>
                <select
                  value={tipoBipagemAutomatica}
                  onChange={(event) => setTipoBipagemAutomatica(event.target.value)}
                  className="min-h-11 w-full rounded-xl border border-blue-100 bg-white px-3 py-2 text-sm font-bold text-blue-800 outline-none"
                >
                  <option value="fluxo">Entrada/Saída conforme presença</option>
                  <option value="interacao">Interação selecionada</option>
                </select>
                {tipoBipagemAutomatica === 'interacao' && (
                  <select
                    value={interacaoSelecionada}
                    onChange={(event) => setInteracaoSelecionada(event.target.value)}
                    className="mt-2 min-h-11 w-full rounded-xl border border-blue-100 bg-white px-3 py-2 text-sm font-bold text-blue-800 outline-none"
                  >
                    {OPCOES_INTERACAO_ROTINA.map((opcao) => (
                      <option key={opcao.valor} value={opcao.valor}>
                        {opcao.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <form
              className="p-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!codigoManualScanner.trim()) return;
                processarCodigoLido(codigoManualScanner);
                setCodigoManualScanner('');
                setTimeout(() => campoLeitorPistolaRef.current?.focus(), 0);
              }}
            >
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-500">
                Leitor de pistola ou digitação manual
              </label>

              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  ref={campoLeitorPistolaRef}
                  value={codigoManualScanner}
                  onChange={(event) => setCodigoManualScanner(event.target.value)}
                  className="min-h-11 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                  placeholder="Aponte a pistola ou digite o prontuário, CPF ou QR Code"
                />
                <button
                  type="submit"
                  className="min-h-11 rounded-xl bg-gray-900 px-4 py-2 text-sm font-bold text-white"
                >
                  Processar
                </button>
              </div>
            </form>

            <div className="p-4 bg-gray-50 text-center text-sm text-gray-600">
              {modoAutomatico
                ? tipoBipagemAutomatica === 'interacao'
                  ? 'Modo automático ativo: a leitura registra a interação selecionada.'
                  : 'Modo automático ativo: a leitura registra Entrada ou Saída automaticamente.'
                : 'Modo manual ativo: a leitura abre o painel de ações.'}
            </div>
            </div>
          </div>
        </div>
      )}

      {pacienteEscaneado && (() => {
        const pInfo = resumoHoje[pacienteEscaneado.id] || {};
        const isFora = pInfo.ultimo_movimento === 'Saída';
        const fotoUrl = getFotoUrl(pacienteEscaneado);

        return (
          <div className="carecore-modal-overlay fixed inset-0 bg-gray-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="carecore-modal-panel bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden max-h-[calc(100vh-2rem)] flex flex-col">
              <div className="bg-brand p-5 flex justify-between items-center gap-3 text-white">
                <h2 className="text-lg font-bold">Acolhido Identificado</h2>
                <button
                  onClick={() => setPacienteEscaneado(null)}
                  className="text-white/80 hover:text-white text-xl"
                >
                  ✕
                </button>
              </div>

              <div className="min-h-0 overflow-y-auto p-4 text-center space-y-4 sm:p-6">
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
                    Registrar entrada
                  </button>

                  <button
                    onClick={() => handleRegistrar(pacienteEscaneado.id, 'Saída')}
                    disabled={isFora}
                    className={`py-3 rounded-xl font-bold transition-all flex justify-center items-center gap-2 text-sm shadow-md
                      ${isFora ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600 text-white'}`}
                  >
                    Registrar saída
                  </button>

                  <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3 text-left">
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-wide text-blue-700">
                      Registrar interação
                    </label>
                    <select
                      value={interacaoSelecionada}
                      onChange={(event) => setInteracaoSelecionada(event.target.value)}
                      className="mb-2 min-h-11 w-full rounded-xl border border-blue-100 bg-white px-3 py-2 text-sm font-bold text-blue-800 outline-none"
                    >
                      {OPCOES_INTERACAO_ROTINA.map((opcao) => (
                        <option key={opcao.valor} value={opcao.valor}>
                          {opcao.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => solicitarRegistroInteracao(pacienteEscaneado)}
                      disabled={isFora}
                      className={`w-full py-3 rounded-xl font-bold transition-all flex justify-center items-center gap-2 text-sm shadow-md
                        ${isFora ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
                    >
                      Registrar interação selecionada
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {interacaoConfirmacao && (
        <div className="carecore-modal-overlay fixed inset-0 bg-gray-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="carecore-modal-panel bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden max-h-[calc(100vh-2rem)] flex flex-col">
            <div className="bg-blue-600 p-5 flex justify-between items-center gap-3 text-white">
              <h2 className="text-lg font-bold">Confirmar interação</h2>
              <button
                onClick={() => setInteracaoConfirmacao(null)}
                className="text-white/80 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto p-4 space-y-4 sm:p-6">
              <p className="text-sm text-gray-700 leading-relaxed">
                {interacaoConfirmacao.ultima
                  ? `Última movimentação de ${interacaoConfirmacao.grupo}: ${interacaoConfirmacao.ultima.tipo_registro} em ${new Date(interacaoConfirmacao.ultima.data_registro).toLocaleString('pt-BR')}.`
                  : `Não há movimentação anterior de ${interacaoConfirmacao.grupo} hoje.`}
              </p>
              <p className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-sm font-black text-blue-800">
                Vou registrar: {interacaoConfirmacao.tipoRegistro}. Confirma?
              </p>

              <div className="grid grid-cols-1 gap-2 pt-2 sm:flex sm:justify-end sm:gap-3">
                <button
                  onClick={() => setInteracaoConfirmacao(null)}
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-gray-100 text-gray-600 hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    handleRegistrar(
                      interacaoConfirmacao.convivente.id,
                      interacaoConfirmacao.tipoRegistro,
                      interacaoConfirmacao.convivente,
                    );
                    setInteracaoConfirmacao(null);
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {refeicaoExtraPendente && (
        <div className="carecore-modal-overlay fixed inset-0 bg-gray-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="carecore-modal-panel bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden max-h-[calc(100vh-2rem)] flex flex-col">
            <div className="bg-amber-600 p-5 flex justify-between items-center gap-3 text-white">
              <h2 className="text-lg font-bold">Confirmar refeição extra</h2>
              <button
                onClick={() => setRefeicaoExtraPendente(null)}
                className="text-white/80 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto p-4 space-y-4 sm:p-6">
              <p className="text-sm text-gray-700 leading-relaxed">
                {refeicaoExtraPendente.convivente?.nome_social ||
                  refeicaoExtraPendente.convivente?.nome_completo ||
                  'Este convivente'} já teve{' '}
                {refeicaoExtraPendente.quantidadeAtual}{' '}
                {ROTULOS_REFEICAO_EXTRA[refeicaoExtraPendente.tipoRegistro] ||
                  refeicaoExtraPendente.tipoRegistro.toLowerCase()}{' '}
                registrado hoje.
              </p>
              <p className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-sm font-black text-amber-800">
                Deseja registrar mais uma refeição como extra?
              </p>

              {refeicaoExtraPendente.ultimoRegistro?.data_registro && (
                <p className="text-xs font-semibold text-gray-500">
                  Último registro:{' '}
                  {new Date(refeicaoExtraPendente.ultimoRegistro.data_registro).toLocaleString('pt-BR')}
                </p>
              )}

              <div className="grid grid-cols-1 gap-2 pt-2 sm:flex sm:justify-end sm:gap-3">
                <button
                  onClick={() => setRefeicaoExtraPendente(null)}
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-gray-100 text-gray-600 hover:bg-gray-200"
                >
                  Não
                </button>
                <button
                  onClick={() => {
                    handleRegistrar(
                      refeicaoExtraPendente.convivente.id,
                      refeicaoExtraPendente.tipoRegistro,
                      refeicaoExtraPendente.convivente,
                      { confirmarRefeicaoExtra: true },
                    );
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-amber-600 text-white hover:bg-amber-700 shadow-sm"
                >
                  Sim, registrar extra
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {interacaoObservacaoPendente && (
        <div className="carecore-modal-overlay fixed inset-0 bg-gray-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="carecore-modal-panel bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden max-h-[calc(100vh-2rem)] flex flex-col">
            <div className="bg-slate-800 p-5 flex justify-between items-center gap-3 text-white">
              <h2 className="text-lg font-bold">Relato obrigatório</h2>
              <button
                onClick={() => {
                  setInteracaoObservacaoPendente(null);
                  setObservacaoInteracao('');
                }}
                className="text-white/80 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto p-4 space-y-4 sm:p-6">
              <p className="text-sm font-semibold text-gray-700">
                {interacaoObservacaoPendente.tipoRegistro}
              </p>
              <textarea
                value={observacaoInteracao}
                onChange={(e) => setObservacaoInteracao(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand"
                placeholder="Descreva a movimentação ou especifique os documentos..."
                autoFocus
              />

              <div className="grid grid-cols-1 gap-2 pt-2 sm:flex sm:justify-end sm:gap-3">
                <button
                  onClick={() => {
                    setInteracaoObservacaoPendente(null);
                    setObservacaoInteracao('');
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-gray-100 text-gray-600 hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    const observacao = observacaoInteracao.trim();
                    if (!observacao) return;
                    handleRegistrar(
                      interacaoObservacaoPendente.convivente.id,
                      interacaoObservacaoPendente.tipoRegistro,
                      interacaoObservacaoPendente.convivente,
                      { observacao },
                    );
                    setInteracaoObservacaoPendente(null);
                    setObservacaoInteracao('');
                  }}
                  disabled={!observacaoInteracao.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-brand text-white hover:bg-brandDark shadow-sm disabled:opacity-50"
                >
                  Registrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {retornoRapidoPendente && (
        <div className="carecore-modal-overlay fixed inset-0 bg-gray-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="carecore-modal-panel bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden max-h-[calc(100vh-2rem)] flex flex-col">
            <div className="bg-yellow-500 p-5 flex justify-between items-center gap-3 text-white">
              <h2 className="text-lg font-bold">Movimento rápido detectado</h2>
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

            <div className="min-h-0 overflow-y-auto p-4 space-y-4 sm:p-6">
              <p className="text-sm text-gray-700 leading-relaxed">
                Este acolhido está registrando {retornoRapidoPendente.tipoRegistro?.toLowerCase() || 'movimento'} em menos de 10 minutos após o movimento anterior.
                Informe a justificativa operacional para permitir o registro.
              </p>

              <textarea
                value={justificativaRetornoRapido}
                onChange={(e) => setJustificativaRetornoRapido(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-yellow-400"
                placeholder="Ex.: saída/entrada registrada por engano, retorno por orientação da equipe, correção de fluxo..."
                autoFocus
              />

              <div className="grid grid-cols-1 gap-2 pt-2 sm:flex sm:justify-end sm:gap-3">
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
                  Confirmar {retornoRapidoPendente.tipoRegistro || 'movimento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {resumoInteracoesAberto && (
        <div className="carecore-modal-overlay fixed inset-0 bg-gray-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="carecore-modal-panel bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden max-h-[calc(100vh-2rem)] flex flex-col">
            <div className="bg-blue-600 p-5 flex justify-between items-center gap-3 text-white">
              <div>
                <h2 className="text-lg font-bold">Interações de rotina</h2>
                <p className="text-xs text-blue-100 mt-1">Somas registradas hoje por tipo.</p>
              </div>
              <button
                onClick={() => setResumoInteracoesAberto(false)}
                className="text-white/80 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 mb-4">
                <p className="text-[10px] font-black uppercase tracking-wide text-blue-600">Total de interações</p>
                <p className="text-3xl font-black text-blue-900 mt-1">{totalInteracoesRotina}</p>
              </div>

              {resumoInteracoesLista.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm font-semibold text-gray-500">
                  Nenhuma interação de rotina registrada hoje.
                </div>
              ) : (
                <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                  {resumoInteracoesLista.map(([tipo, total]) => (
                    <div key={tipo} className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                      <span className="text-sm font-bold text-gray-700">{tipo}</span>
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-black text-blue-700">{total}</span>
                    </div>
                  ))}
                </div>
              )}
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

