// =====================================================================
import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import Sidebar from './Sidebar';
import { AppShell, MainShell, PageHeader, PremiumButton, ReportActionButton, ScrollArea } from './components/PremiumUI';
import { exportarRelatorioXlsx } from './utils/exportarRelatorioXlsx';
import { abrirPreviewHtml, imprimirRelatorio } from './utils/imprimirRelatorio';
import { API_ROOT } from './config/apiBase';
import { BadgePrioridadeOcorrencia } from './components/OcorrenciasUI';
import {
  DIREITOS_RESERVADOS_TITULO,
  obterUrlDireitosReservados,
} from './utils/direitosReservados';
import {
  buscarIdentidadeRelatorios,
  obterLogoRelatorioDataUrl,
  obterLogoRelatorioSrc,
} from './utils/relatorioIdentidadePrint';
import {
  PRIORIDADES_OCORRENCIA,
  classesPrioridade,
  montarRelatorioOcorrencias,
  normalizarPrioridade,
  resumirPrioridadesOcorrencias,
} from './utils/ocorrenciasUtils';
import { filtrarOrdenarConviventesPorBusca } from './utils/conviventeBuscaUtils';
import { criarHeadersAutenticados } from './utils/requestIdUtils';


const TAMANHO_PAGINA_OCORRENCIAS = 50;

export default function CentralOcorrencias() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = localStorage.getItem('@CareCore:token');

  let perfilUsuario = '';
  let idUsuarioLogado = '';
  try {
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]));
      perfilUsuario = payload.perfil_acesso || '';
      idUsuarioLogado = payload.sub || '';
    }
  } catch (e) {
    console.error('Erro ao ler token', e);
  }

  const isGestor = ['Gestor', 'Gestao', 'Gestão', 'Gerente'].includes(perfilUsuario);

  const [ocorrencias, setOcorrencias] = useState([]);
  const [totalOcorrencias, setTotalOcorrencias] = useState(0);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [resumoServidor, setResumoServidor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  
  const [chamadoSelecionado, setChamadoSelecionado] = useState(null);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [encerrarChamado, setEncerrarChamado] = useState(false);

  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [listaConviventes, setListaConviventes] = useState([]);
  const [listaEquipe, setListaEquipe] = useState([]);
  const [listaFuncionarios, setListaFuncionarios] = useState([]);
  const [enviandoNovo, setEnviandoNovo] = useState(false);
  const [erroNovoChamado, setErroNovoChamado] = useState('');

  const [buscaPaciente, setBuscaPaciente] = useState('');
  const [mostrarDropdownPaciente, setMostrarDropdownPaciente] = useState(false);
  const [scannerAssinaturaAberto, setScannerAssinaturaAberto] = useState(false);
  const [scannerAssinaturaErro, setScannerAssinaturaErro] = useState('');

  const [filtroPrioridade, setFiltroPrioridade] = useState(searchParams.get('prioridade') || 'Todas');
  const [filtroStatus, setFiltroStatus] = useState(searchParams.get('status') || 'Todos');

  const [selecionados, setSelecionados] = useState([]);
  const [baixandoLote, setBaixandoLote] = useState(false);
  const [identidadeRelatorio, setIdentidadeRelatorio] = useState(null);

  const estadoNovoChamado = {
    convivente_id: '',
    tipo_ocorrencia: 'Comportamental',
    motivo: '',
    descricao: '',
    requer_acao_tecnica: false,
    prioridade: 'Média',
    convivente_autor_ocorrencia: false,
    funcionario_envolvido_id: '',
    assinatura_convivente_metodo: 'Carteirinha',
    assinatura_convivente_codigo: '',
    observadores_ids: []
  };
  const [formNovo, setFormNovo] = useState(estadoNovoChamado);

  useEffect(() => {
    if (!token) { navigate('/'); return; }
    carregarDadosFormularioNovo();
    buscarIdentidadeRelatorios().then(setIdentidadeRelatorio);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setPaginaAtual(1);
    carregarOcorrencias(1);
  }, [token, filtroPrioridade, filtroStatus]);

  useEffect(() => {
    let leitor = null;
    let ativo = true;

    const iniciarCameraAssinatura = async () => {
      if (!scannerAssinaturaAberto) return;

      try {
        setScannerAssinaturaErro('');

        if (!navigator.mediaDevices?.getUserMedia) {
          setScannerAssinaturaErro('Este navegador não liberou acesso à câmera. Use o campo manual.');
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 150));
        if (!ativo) return;

        const elementoLeitor = document.getElementById('leitor-camera-assinatura-ocorrencia');
        if (!elementoLeitor) {
          setScannerAssinaturaErro('Não foi possível preparar o leitor. Feche e tente novamente.');
          return;
        }

        const { Html5Qrcode } = await import('html5-qrcode');
        if (!ativo) return;

        const cameras = await Html5Qrcode.getCameras();
        if (!cameras?.length) {
          setScannerAssinaturaErro('Nenhuma câmera foi encontrada neste dispositivo.');
          return;
        }

        const cameraPreferida = cameras.find((camera) => {
          const label = String(camera.label || '').toLowerCase();
          return /back|rear|environment|traseira/.test(label);
        }) || cameras[0];

        leitor = new Html5Qrcode('leitor-camera-assinatura-ocorrencia');
        await leitor.start(
          cameraPreferida.id,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (codigoLido) => {
            if (!ativo) return;
            setFormNovo((atual) => ({
              ...atual,
              assinatura_convivente_codigo: String(codigoLido || '').trim(),
              assinatura_convivente_metodo: 'QR Code da carteirinha',
            }));
            setScannerAssinaturaAberto(false);
          },
          () => {},
        );
      } catch (error) {
        console.error('Erro ao iniciar câmera para assinatura:', error);
        const nomeErro = error?.name || '';
        const detalhe = nomeErro === 'NotAllowedError'
          ? 'A câmera foi bloqueada pelo navegador ou pelo Windows.'
          : nomeErro === 'NotReadableError'
            ? 'A câmera pode estar em uso por outro aplicativo.'
            : 'Verifique se a câmera está disponível e permitida.';
        setScannerAssinaturaErro(`Não foi possível iniciar a câmera. ${detalhe}`);
      }
    };

    iniciarCameraAssinatura();

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
  }, [scannerAssinaturaAberto]);

  const carregarOcorrencias = async (pagina = paginaAtual) => {
    setLoading(true);
    try {
      const paginaNormalizada = Math.max(1, Number(pagina) || 1);
      const response = await axios.get(`${API_ROOT}/ocorrencias`, {
        headers: criarHeadersAutenticados(token),
        params: {
          limit: TAMANHO_PAGINA_OCORRENCIAS,
          offset: (paginaNormalizada - 1) * TAMANHO_PAGINA_OCORRENCIAS,
          prioridade: filtroPrioridade,
          status: filtroStatus,
        },
      });
      const dados = response.data;
      if (Array.isArray(dados)) {
        setOcorrencias(dados);
        setTotalOcorrencias(dados.length);
        setResumoServidor(null);
      } else {
        setOcorrencias(dados.items || []);
        setTotalOcorrencias(dados.total || 0);
        setResumoServidor(dados.resumo || null);
      }
      setPaginaAtual(paginaNormalizada);
      setSelecionados([]);
    } catch {
      setErro('Erro ao carregar a fila de ocorrências.');
    } finally {
      setLoading(false);
    }
  };

  const carregarDadosFormularioNovo = async () => {
    try {
      const config = { headers: criarHeadersAutenticados(token) };
      const [resConv, resEquipe] = await Promise.all([
        axios.get(`${API_ROOT}/conviventes`, config),
        axios.get(`${API_ROOT}/tecnicos`, config) 
      ]);
      setListaConviventes(resConv.data);
      setListaFuncionarios(resEquipe.data);
      setListaEquipe(resEquipe.data.filter(u => u.id !== idUsuarioLogado)); 
    } catch (error) {
      console.error("Erro ao carregar dados complementares", error);
    }
  };

  const ocorrenciasFiltradas = ocorrencias;
  const ocorrenciasOrdenadas = ocorrencias;
  const conviventesPacienteFiltrados = useMemo(
    () => filtrarOrdenarConviventesPorBusca(listaConviventes, buscaPaciente),
    [listaConviventes, buscaPaciente],
  );
  const resumoPrioridades = resumoServidor?.porPrioridade || resumirPrioridadesOcorrencias(ocorrencias);
  const relatorioOcorrencias = resumoServidor
    ? {
      geral: {
        total: resumoServidor.total || 0,
        pendentes: resumoServidor.pendentes || 0,
        resolvidas: resumoServidor.resolvidas || 0,
        altaCriticaPendentes: resumoServidor.altaCriticaPendentes || 0,
        porPrioridade: Object.fromEntries(
          Object.entries(resumoServidor.porPrioridade || {}).map(([chave, valor]) => [chave, valor?.total || 0]),
        ),
        porTipo: {},
        porTecnico: {},
      },
      filtrado: {
        total: resumoServidor.total || 0,
        pendentes: resumoServidor.pendentes || 0,
        resolvidas: resumoServidor.resolvidas || 0,
        altaCriticaPendentes: resumoServidor.altaCriticaPendentes || 0,
        porPrioridade: Object.fromEntries(
          Object.entries(resumoServidor.porPrioridade || {}).map(([chave, valor]) => [chave, valor?.total || 0]),
        ),
        porTipo: {},
        porTecnico: {},
      },
    }
    : montarRelatorioOcorrencias(ocorrencias, ocorrenciasFiltradas);
  const totalPaginas = Math.max(1, Math.ceil(totalOcorrencias / TAMANHO_PAGINA_OCORRENCIAS));

  const montarDadosRelatorioOcorrencias = () => {
    return (Array.isArray(ocorrenciasFiltradas) ? ocorrenciasFiltradas : []).map((oc) => {
      const paciente = listaConviventes.find((c) => c.id === oc.convivente_id);
      const nomePaciente = oc.convivente_nome || (paciente ? (paciente.nome_social || paciente.nome_completo) : "-");
      const funcionario = listaFuncionarios.find((u) => u.id === oc.funcionario_envolvido_id);

      return {
        Data: oc.data_ocorrencia ? new Date(oc.data_ocorrencia).toLocaleString("pt-BR") : "-",
        Convivente: nomePaciente,
        "Autor convivente": oc.convivente_autor_ocorrencia ? "Sim" : "Não",
        "Funcionário citado": funcionario?.nome || "-",
        Tipo: oc.tipo_ocorrencia || "-",
        Motivo: oc.motivo || "-",
        Prioridade: normalizarPrioridade(oc.prioridade),
        Status: oc.status_resolucao || "-",
        "Responsável técnico": oc.tecnico_responsavel_nome || oc.tecnico_nome || oc.responsavel_nome || "Equipe",
        "Requer ação técnica": oc.requer_acao_tecnica ? "Sim" : "Não",
        Descrição: oc.descricao || "-",
      };
    });
  };

  const colunasRelatorioOcorrencias = [
    "Data",
    "Convivente",
    "Autor convivente",
    "Funcionário citado",
    "Tipo",
    "Motivo",
    "Prioridade",
    "Status",
    "Responsável técnico",
    "Requer ação técnica",
    "Descrição",
  ];

  const exportarRelatorioOcorrenciasXLSX = () => {
    exportarRelatorioXlsx({
      nomeArquivo: `relatorio-ocorrencias-${new Date().toISOString().slice(0, 10)}`,
      titulo: "Relatório de Ocorrências",
      filtros: {
        "Prioridade": filtroPrioridade,
        "Status": filtroStatus,
        "Total filtrado": relatorioOcorrencias.filtrado.total,
        "Pendentes": relatorioOcorrencias.filtrado.pendentes,
        "Resolvidas": relatorioOcorrencias.filtrado.resolvidas,
        "Alta/Crítica pendentes": relatorioOcorrencias.filtrado.altaCriticaPendentes,
      },
      colunas: colunasRelatorioOcorrencias,
      dados: montarDadosRelatorioOcorrencias(),
    });
  };

  const abrirRelatorioImpressaoOcorrencias = async () => {
    const logoRelatorioDataUrl = await obterLogoRelatorioDataUrl(identidadeRelatorio);

    imprimirRelatorio({
      titulo: "Relatório de Ocorrências",
      subtitulo: `Prioridade: ${filtroPrioridade} | Status: ${filtroStatus} | Total filtrado: ${relatorioOcorrencias.filtrado.total} | Pendentes: ${relatorioOcorrencias.filtrado.pendentes}`,
      colunas: colunasRelatorioOcorrencias,
      dados: montarDadosRelatorioOcorrencias(),
      identidade: {
        ...identidadeRelatorio,
        logo_src: obterLogoRelatorioSrc(logoRelatorioDataUrl),
      },
    });
  };

  const toggleSelecao = (id) => {
    setSelecionados(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBaixaEmLote = async () => {
    const confirmacao = window.confirm(
      `ATENÇÃO: Você selecionou ${selecionados.length} ocorrência(s).\n\nConfirma a baixa (marcar como resolvido) sem a leitura detalhada dos chamados selecionados?`
    );

    if (!confirmacao) return;

    setBaixandoLote(true);
    try {
      const payloadPadrao = {
        mensagem: "Baixa em lote realizada pela Central de Ocorrências (Ciência do relato registrada).",
        tipo_interacao: "Parecer Técnico"
      };

      await Promise.all(
        selecionados.map(id => 
          axios.post(`${API_ROOT}/ocorrencias/${id}/interacoes`, payloadPadrao, {
            headers: criarHeadersAutenticados(token)
          })
        )
      );

      await carregarOcorrencias(paginaAtual);
      setErro('');
      setSucesso("Baixa em lote concluída com sucesso!");
    } catch {
      setSucesso('');
      setErro("Ocorreu um erro ao tentar dar baixa em alguns chamados. A tela será recarregada.");
      carregarOcorrencias(paginaAtual);
    } finally {
      setBaixandoLote(false);
    }
  };

  const abrirChamado = (chamado) => {
    setChamadoSelecionado(chamado);
    setNovaMensagem('');
    setEncerrarChamado(false);
  };

  const fecharChamado = () => {
    setChamadoSelecionado(null);
    setNovaMensagem('');
    setEncerrarChamado(false);
    carregarOcorrencias(paginaAtual);
  };

  const abrirFormularioNovo = () => {
    setFormNovo(estadoNovoChamado);
    setBuscaPaciente('');
    setMostrarDropdownPaciente(false);
    setErroNovoChamado('');
    setModalNovoAberto(true);
  };

  const escaparHtml = (valor) => String(valor ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const gerarTermoReclamacaoHtml = ({
    ocorrenciaId = '',
    dadosOcorrencia = formNovo,
    logoRelatorioDataUrl = '',
  } = {}) => {
    const convivente = listaConviventes.find(c => c.id === dadosOcorrencia.convivente_id);
    const funcionario = listaFuncionarios.find(u => u.id === dadosOcorrencia.funcionario_envolvido_id);
    const dataAtual = new Date().toLocaleString('pt-BR');
    const logoSrc = obterLogoRelatorioSrc(logoRelatorioDataUrl);
    const nomeExibicao = identidadeRelatorio?.relatorio_nome_exibicao || 'CARECORE+';
    const rodapeItens = [
      identidadeRelatorio?.relatorio_rodape_linha1,
      identidadeRelatorio?.relatorio_rodape_linha2,
      identidadeRelatorio?.relatorio_telefone ? `Telefone: ${identidadeRelatorio.relatorio_telefone}` : '',
      identidadeRelatorio?.relatorio_email ? `E-mail: ${identidadeRelatorio.relatorio_email}` : '',
      identidadeRelatorio?.relatorio_site ? `Site: ${identidadeRelatorio.relatorio_site}` : '',
    ].filter(Boolean);
    const direitosUrl = obterUrlDireitosReservados();

    return `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Termo de reclamação do convivente</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111827; margin: 0; padding: 32px; line-height: 1.5; }
            header { display: flex; align-items: center; justify-content: space-between; gap: 24px; border-bottom: 2px solid #e5e7eb; padding-bottom: 16px; margin-bottom: 24px; }
            .logo { width: 180px; max-height: 68px; object-fit: contain; }
            .identidade-nome { margin-top: 6px; color: #374151; font-size: 11px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
            h1 { margin: 0; font-size: 22px; }
            .titulo { text-align: right; }
            .muted { color: #64748b; font-size: 12px; }
            .box { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin: 14px 0; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
            .label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; }
            .value { font-size: 14px; font-weight: 700; margin-top: 2px; }
            .relato { white-space: pre-wrap; font-size: 14px; }
            .assinaturas { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 64px; }
            .linha { border-top: 1px solid #111827; padding-top: 8px; text-align: center; font-size: 12px; }
            .rodape-relatorio { margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 8px; color: #6b7280; font-size: 10px; line-height: 1.4; text-align: center; }
            .direitos-reservados { margin-top: 5px; font-size: 9px; font-weight: 700; }
            .direitos-reservados a { color: #4f46e5; text-decoration: none; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          <header>
            <div>
              <img class="logo" src="${logoSrc}" alt="${escaparHtml(nomeExibicao)}" />
              <div class="identidade-nome">${escaparHtml(nomeExibicao)}</div>
            </div>
            <div class="titulo">
              <h1>Termo de Reclamação / Manifestação do Convivente</h1>
              <p class="muted">Documento gerado para assinatura física e posterior anexação ao prontuário.</p>
            </div>
          </header>

          <div class="box grid">
            <div>
              <div class="label">Ocorrência</div>
              <div class="value">${escaparHtml(ocorrenciaId || 'Gerada no sistema')}</div>
            </div>
            <div>
              <div class="label">Data de emissão</div>
              <div class="value">${escaparHtml(dataAtual)}</div>
            </div>
            <div>
              <div class="label">Convivente autor/reclamante</div>
              <div class="value">${escaparHtml(convivente?.nome_social || convivente?.nome_completo || '-')}</div>
            </div>
            <div>
              <div class="label">Prontuário / CPF</div>
              <div class="value">#${escaparHtml(convivente?.numero_institucional || 'S/N')} · ${escaparHtml(convivente?.cpf || 'Não informado')}</div>
            </div>
            <div>
              <div class="label">Funcionário citado</div>
              <div class="value">${escaparHtml(funcionario?.nome || '-')}</div>
            </div>
            <div>
              <div class="label">Validação digital</div>
              <div class="value">${escaparHtml(dadosOcorrencia.assinatura_convivente_metodo || 'Carteirinha')} registrada na abertura</div>
            </div>
          </div>

          <div class="box">
            <div class="label">Título / motivo</div>
            <div class="value">${escaparHtml(dadosOcorrencia.motivo || '-')}</div>
          </div>

          <div class="box">
            <div class="label">Relato do convivente</div>
            <p class="relato">${escaparHtml(dadosOcorrencia.descricao || '-')}</p>
          </div>

          <p class="muted">
            Declaro que o relato acima foi registrado conforme manifestação apresentada, ficando ciente de que este documento será anexado ao prontuário institucional após assinatura física.
          </p>

          <div class="assinaturas">
            <div class="linha">Assinatura do convivente autor/reclamante</div>
            <div class="linha">Assinatura do técnico/funcionário que registrou</div>
          </div>

          <footer class="rodape-relatorio">
            ${
              rodapeItens.length
                ? rodapeItens.map(item => `<div>${escaparHtml(item)}</div>`).join('')
                : '<div>Relatório gerado pelo CareCore+</div>'
            }
            <div class="direitos-reservados">
              <a href="${escaparHtml(direitosUrl)}" target="_blank" rel="noopener noreferrer">
                ${escaparHtml(DIREITOS_RESERVADOS_TITULO)}
              </a>
            </div>
          </footer>
        </body>
      </html>
    `;
  };

  const imprimirTermoReclamacao = async (ocorrencia = null) => {
    const dadosOcorrencia = ocorrencia || formNovo;
    const logoRelatorioDataUrl = await obterLogoRelatorioDataUrl(identidadeRelatorio);

    abrirPreviewHtml({
      titulo: 'Termo de reclamação do convivente',
      html: gerarTermoReclamacaoHtml({
        ocorrenciaId: ocorrencia?.id || '',
        dadosOcorrencia,
        logoRelatorioDataUrl,
      }),
    });
  };

  const handleToggleObservador = (id) => {
    setFormNovo(prev => {
      const jaMarcado = prev.observadores_ids.includes(id);
      if (jaMarcado) {
        return { ...prev, observadores_ids: prev.observadores_ids.filter(x => x !== id) };
      } else {
        return { ...prev, observadores_ids: [...prev.observadores_ids, id] };
      }
    });
  };

  const handleSelecionarTodos = () => {
    if (formNovo.observadores_ids.length === listaEquipe.length) {
      setFormNovo({ ...formNovo, observadores_ids: [] }); 
    } else {
      setFormNovo({ ...formNovo, observadores_ids: listaEquipe.map(u => u.id) }); 
    }
  };

  const handleSalvarNovoChamado = async (e) => {
    e.preventDefault();
    setErroNovoChamado('');
    if (!formNovo.convivente_id || !formNovo.motivo.trim() || !formNovo.descricao.trim()) {
      setErroNovoChamado("Preencha o acolhido, o título e a descrição da ocorrência.");
      return;
    }
    if (formNovo.convivente_autor_ocorrencia) {
      if (!formNovo.funcionario_envolvido_id) {
        setErroNovoChamado("Selecione o funcionário citado na reclamação do convivente.");
        return;
      }
      if (!formNovo.assinatura_convivente_codigo.trim()) {
        setErroNovoChamado("Faça a leitura da carteirinha ou informe o código do prontuário para validar a assinatura digital.");
        return;
      }
    }

    setEnviandoNovo(true);
    try {
      const paciente = listaConviventes.find(c => c.id === formNovo.convivente_id);
      const payload = {
        ...formNovo,
        tipo_ocorrencia: formNovo.convivente_autor_ocorrencia ? 'Reclamação do convivente' : formNovo.tipo_ocorrencia,
        funcionario_envolvido_id: formNovo.convivente_autor_ocorrencia ? formNovo.funcionario_envolvido_id : null,
        assinatura_convivente_metodo: formNovo.convivente_autor_ocorrencia ? formNovo.assinatura_convivente_metodo : null,
        assinatura_convivente_codigo: formNovo.convivente_autor_ocorrencia ? formNovo.assinatura_convivente_codigo : null,
        tecnico_responsavel_id: paciente?.tecnico_id || null
      };

      const resposta = await axios.post(`${API_ROOT}/ocorrencias`, payload, {
        headers: criarHeadersAutenticados(token)
      });

      setModalNovoAberto(false);
      setErro('');
      setSucesso('Chamado criado com sucesso.');
      if (formNovo.convivente_autor_ocorrencia) {
        imprimirTermoReclamacao({
          ...payload,
          id: resposta.data?.id,
        });
      }
      carregarOcorrencias(1);
    } catch (error) {
      setSucesso('');
      setErroNovoChamado(error.response?.data?.detail || 'Erro ao criar o chamado. Verifique a conexão com o servidor.');
    } finally {
      setEnviandoNovo(false);
    }
  };

  const handleEnviarInteracao = async (e) => {
    e.preventDefault();
    if (!novaMensagem.trim()) return;

    setEnviando(true);
    try {
      const payload = {
        mensagem: novaMensagem,
        tipo_interacao: encerrarChamado ? "Parecer Técnico" : "Comentário"
      };

      await axios.post(`${API_ROOT}/ocorrencias/${chamadoSelecionado.id}/interacoes`, payload, {
        headers: criarHeadersAutenticados(token)
      });

      await carregarOcorrencias(paginaAtual);
      
      if (encerrarChamado) {
        fecharChamado();
      } else {
        setNovaMensagem('');
        const response = await axios.get(`${API_ROOT}/ocorrencias`, {
          headers: criarHeadersAutenticados(token),
          params: {
            limit: TAMANHO_PAGINA_OCORRENCIAS,
            offset: (paginaAtual - 1) * TAMANHO_PAGINA_OCORRENCIAS,
            prioridade: filtroPrioridade,
            status: filtroStatus,
          },
        });
        const itens = Array.isArray(response.data) ? response.data : (response.data.items || []);
        setOcorrencias(itens);
        setChamadoSelecionado(itens.find(o => o.id === chamadoSelecionado.id) || null);
      }
    } catch {
      setErro('Erro ao enviar a mensagem.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <AppShell>
      <Sidebar />

      <MainShell>
        <PageHeader
          eyebrow="Comunicação técnica"
          title={perfilUsuario === 'Orientador' ? 'Minhas Ocorrências' : 'Central de Ocorrências'}
          subtitle="Gestão de chamados, prioridades e andamento de casos."
          icon="!"
          actions={(
            <PremiumButton
              type="button"
              variant="brand"
            onClick={abrirFormularioNovo}
          >
            + Novo Chamado
            </PremiumButton>
          )}
        />

        <ScrollArea className="pb-24">
          <div className="w-full max-w-7xl mx-auto">
          {erro && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm mb-6 font-semibold border border-red-100">{erro}</div>}
          {sucesso && <div className="bg-green-50 text-green-700 p-4 rounded-xl text-sm mb-6 font-semibold border border-green-100">{sucesso}</div>}


          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
            {["Crítica", "Alta", "Média", "Baixa"].map((prioridade) => (
              <button
                key={prioridade}
                type="button"
                onClick={() => setFiltroPrioridade(filtroPrioridade === prioridade ? 'Todas' : prioridade)}
                className={`text-left rounded-2xl border p-4 transition-all ${
                  filtroPrioridade === prioridade ? classesPrioridade(prioridade) : 'bg-white border-gray-100 hover:border-brand'
                }`}
              >
                <p className="text-[11px] font-black uppercase tracking-wide">{prioridade}</p>
                <p className="mt-1 text-2xl font-black">{resumoPrioridades[prioridade]?.pendentes || 0}</p>
                <p className="text-[11px] font-semibold opacity-70">pendente(s) de {resumoPrioridades[prioridade]?.total || 0}</p>
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div>
              <h2 className="font-black text-gray-800 text-sm">Filtros de ocorrências</h2>
              <p className="text-xs text-gray-500">Filtre por prioridade real e situação do chamado.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={filtroPrioridade}
                onChange={(e) => setFiltroPrioridade(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold bg-white"
              >
                {PRIORIDADES_OCORRENCIA.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold bg-white"
              >
                <option value="Todos">Todos os status</option>
                <option value="Pendente">Pendentes</option>
                <option value="Resolvido">Resolvidos</option>
              </select>
              <button
                type="button"
                onClick={() => { setFiltroPrioridade('Todas'); setFiltroStatus('Todos'); }}
                className="px-3 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-bold hover:bg-gray-200"
              >
                Limpar filtros
              </button>
            </div>
          </div>


          <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="font-black text-gray-800 text-base">Relatório de ocorrências</h2>
                <p className="text-xs text-gray-500">
                  Os números abaixo respeitam os filtros selecionados na tela.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <ReportActionButton action="export" onClick={exportarRelatorioOcorrenciasXLSX}>
                  Exportar
                </ReportActionButton>

                <ReportActionButton action="print" onClick={abrirRelatorioImpressaoOcorrencias}>
                  Imprimir
                </ReportActionButton>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-[10px] font-black uppercase text-gray-400">Total filtrado</p>
                <p className="text-2xl font-black text-gray-900">{relatorioOcorrencias.filtrado.total}</p>
              </div>
              <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                <p className="text-[10px] font-black uppercase text-red-500">Pendentes</p>
                <p className="text-2xl font-black text-red-700">{relatorioOcorrencias.filtrado.pendentes}</p>
              </div>
              <div className="rounded-2xl border border-green-100 bg-green-50 p-4">
                <p className="text-[10px] font-black uppercase text-green-600">Resolvidas</p>
                <p className="text-2xl font-black text-green-700">{relatorioOcorrencias.filtrado.resolvidas}</p>
              </div>
              <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
                <p className="text-[10px] font-black uppercase text-orange-600">Alta/Crítica</p>
                <p className="text-2xl font-black text-orange-700">{relatorioOcorrencias.filtrado.altaCriticaPendentes}</p>
              </div>
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-[10px] font-black uppercase text-blue-600">Base geral</p>
                <p className="text-2xl font-black text-blue-700">{relatorioOcorrencias.geral.total}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-4">
              <div className="rounded-2xl border border-gray-100 p-4">
                <p className="text-[11px] font-black uppercase text-gray-500 mb-3">Por prioridade</p>
                {["Crítica", "Alta", "Média", "Baixa"].map((prioridade) => (
                  <div key={prioridade} className="flex items-center justify-between py-1 text-sm">
                    <span className="font-bold text-gray-600">{prioridade}</span>
                    <span className="font-black text-gray-900">{relatorioOcorrencias.filtrado.porPrioridade[prioridade] || 0}</span>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-gray-100 p-4">
                <p className="text-[11px] font-black uppercase text-gray-500 mb-3">Por tipo</p>
                {Object.entries(relatorioOcorrencias.filtrado.porTipo).length === 0 ? (
                  <p className="text-sm font-semibold text-gray-400">Sem dados.</p>
                ) : (
                  Object.entries(relatorioOcorrencias.filtrado.porTipo).slice(0, 6).map(([nome, total]) => (
                    <div key={nome} className="flex items-center justify-between py-1 text-sm">
                      <span className="font-bold text-gray-600 truncate pr-3">{nome}</span>
                      <span className="font-black text-gray-900">{total}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="rounded-2xl border border-gray-100 p-4">
                <p className="text-[11px] font-black uppercase text-gray-500 mb-3">Por responsável</p>
                {Object.entries(relatorioOcorrencias.filtrado.porTecnico).length === 0 ? (
                  <p className="text-sm font-semibold text-gray-400">Sem dados.</p>
                ) : (
                  Object.entries(relatorioOcorrencias.filtrado.porTecnico).slice(0, 6).map(([nome, total]) => (
                    <div key={nome} className="flex items-center justify-between py-1 text-sm">
                      <span className="font-bold text-gray-600 truncate pr-3">{nome}</span>
                      <span className="font-black text-gray-900">{total}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 min-h-[60vh]">
            
            {loading ? (
              <div className="flex justify-center p-12"><p className="text-brand font-medium animate-pulse text-lg">Carregando fila de chamados...</p></div>
            ) : ocorrenciasOrdenadas.length === 0 ? (
              <div className="text-center py-16 bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl">
                <p className="text-gray-500 text-lg font-medium">Nenhuma ocorrência encontrada para o seu perfil.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-xs font-bold text-gray-600 md:flex-row md:items-center md:justify-between">
                  <span>
                    Exibindo {((paginaAtual - 1) * TAMANHO_PAGINA_OCORRENCIAS) + 1}
                    {' '}a {Math.min(paginaAtual * TAMANHO_PAGINA_OCORRENCIAS, totalOcorrencias)}
                    {' '}de {totalOcorrencias} ocorrência(s)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={paginaAtual <= 1 || loading}
                      onClick={() => carregarOcorrencias(paginaAtual - 1)}
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Anterior
                    </button>
                    <span className="px-2 text-[11px] font-black text-gray-500">
                      Página {paginaAtual} de {totalPaginas}
                    </span>
                    <button
                      type="button"
                      disabled={paginaAtual >= totalPaginas || loading}
                      onClick={() => carregarOcorrencias(paginaAtual + 1)}
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Próxima
                    </button>
                  </div>
                </div>

                {ocorrenciasOrdenadas.map(oc => {
                  const isResolvido = oc.status_resolucao === 'Resolvido';
                  const isMeuCaso = oc.tecnico_responsavel_id === idUsuarioLogado;
                  
                  const temPermissaoBaixa = !isResolvido && (isGestor || (perfilUsuario === 'Técnico' && isMeuCaso));

                  const paciente = listaConviventes.find(c => c.id === oc.convivente_id);
                  const nomePaciente = oc.convivente_nome || (paciente ? (paciente.nome_social || paciente.nome_completo) : 'Acolhido não encontrado');
                  const funcionarioCitado = listaFuncionarios.find(u => u.id === oc.funcionario_envolvido_id);
                  
                  // Dados de identificação exibidos na listagem principal.
                  const prontuarioInfo = oc.convivente_numero_institucional
                    ? `#${oc.convivente_numero_institucional}`
                    : (paciente?.numero_institucional ? `#${paciente.numero_institucional}` : 'S/N');
                  const cpfInfo = oc.convivente_cpf || paciente?.cpf || 'Não informado';

                  return (
                    <div 
                      key={oc.id} 
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition-all shadow-sm gap-4 ${
                        isResolvido ? 'bg-gray-50 border-gray-200' : 'bg-white border-blue-100 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        
                        <div className="flex-shrink-0 w-6 flex justify-center">
                          {temPermissaoBaixa ? (
                            <input 
                              type="checkbox"
                              checked={selecionados.includes(oc.id)}
                              onChange={() => toggleSelecao(oc.id)}
                              className="w-5 h-5 text-brand rounded focus:ring-brand cursor-pointer"
                              title="Selecionar para Baixa em Lote"
                            />
                          ) : (
                            <span className="w-5 h-5 inline-block"></span>
                          )}
                        </div>

                        <div className="w-28 flex-shrink-0 cursor-pointer space-y-1" onClick={() => abrirChamado(oc)}>
                          <BadgePrioridadeOcorrencia prioridade={oc.prioridade} />
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider block text-center ${
                            isResolvido ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700 animate-pulse'
                          }`}>
                            {oc.status_resolucao}
                          </span>
                        </div>
                        
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => abrirChamado(oc)}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-brand flex items-center gap-1 uppercase tracking-wide truncate">
                              {nomePaciente} 
                              <span className="text-[10px] text-gray-400 font-medium normal-case tracking-normal ml-1 hidden md:inline">
                                | Prontuário: {prontuarioInfo} | CPF: {cpfInfo}
                              </span>
                            </span>
                            {isMeuCaso && !isResolvido && (
                              <span className="text-[9px] bg-brand text-white px-2 py-0.5 rounded-full uppercase font-bold shadow-sm flex-shrink-0">
                                Sua Ação
                              </span>
                            )}
                            {oc.convivente_autor_ocorrencia && (
                              <span className="text-[9px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase font-bold shadow-sm flex-shrink-0">
                                Reclamação do convivente
                              </span>
                            )}
                          </div>
                          
                          <h3 className="font-bold text-gray-800 text-sm truncate mb-0.5">{oc.motivo}</h3>
                          <p className="text-xs text-gray-500 truncate">
                            {oc.convivente_autor_ocorrencia && funcionarioCitado
                              ? `Funcionário citado: ${funcionarioCitado.nome} · `
                              : ''}
                            {oc.descricao}
                          </p>
                        </div>
                      </div>

                      <div 
                        className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-32 flex-shrink-0 gap-1 border-t sm:border-t-0 pt-3 sm:pt-0 border-gray-100 mt-2 sm:mt-0 cursor-pointer"
                        onClick={() => abrirChamado(oc)}
                      >
                        <span className="text-[10px] font-bold text-gray-400">
                          {new Date(oc.data_ocorrencia).toLocaleDateString('pt-BR')}
                        </span>
                        <div className="flex gap-3 text-[11px] text-gray-400 font-bold">
                          {oc.observadores?.length > 0 && <span title="Pessoas copiadas">Copiados: {oc.observadores.length}</span>}
                          <span title="Comentários/Interações">Interações: {oc.interacoes?.length || 0}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {totalPaginas > 1 && (
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      disabled={paginaAtual <= 1 || loading}
                      onClick={() => carregarOcorrencias(paginaAtual - 1)}
                      className="rounded-xl bg-gray-100 px-4 py-2 text-xs font-black text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      disabled={paginaAtual >= totalPaginas || loading}
                      onClick={() => carregarOcorrencias(paginaAtual + 1)}
                      className="rounded-xl bg-brand px-4 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Próxima página
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          </div>
        </ScrollArea>

      {/* Barra flutuante de baixa em lote */}
      {selecionados.length > 0 && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-6 z-40 animate-fadeIn">
          <span className="text-sm font-bold bg-gray-800 px-3 py-1 rounded-full text-brand">
            {selecionados.length} selecionado(s)
          </span>
          
          <button 
            onClick={handleBaixaEmLote}
            disabled={baixandoLote}
            className="bg-green-500 hover:bg-green-400 text-white px-5 py-2 rounded-full font-bold text-sm shadow-lg transition-colors disabled:opacity-50"
          >
            {baixandoLote ? 'Processando...' : 'Encerrar chamados'}
          </button>
          
          <button 
            onClick={() => setSelecionados([])} 
            className="text-gray-400 hover:text-white font-bold p-1"
            title="Cancelar seleção"
          >
            ✕
          </button>
        </div>
      )}

      {/* --- MODAL DA THREAD (CHAT DO CHAMADO) --- */}
      {chamadoSelecionado && (
        <div className="carecore-modal-overlay fixed inset-0 bg-gray-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="carecore-modal-panel bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            
            <div className="bg-gray-800 p-5 flex justify-between items-start text-white">
              <div>
                <div className="flex flex-wrap gap-2">
                  <BadgePrioridadeOcorrencia prioridade={chamadoSelecionado.prioridade} />
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${
                  chamadoSelecionado.status_resolucao === 'Resolvido' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                }`}>
                    Status: {chamadoSelecionado.status_resolucao}
                  </span>
                </div>
                <h2 className="text-lg font-bold mt-2 leading-tight">{chamadoSelecionado.motivo}</h2>
                
                {(() => {
                  const pModal = listaConviventes.find(c => c.id === chamadoSelecionado.convivente_id);
                  if (!pModal) return <p className="text-sm text-red-400 font-semibold mt-2">Acolhido não encontrado</p>;

                  // Dados de identificação exibidos no cabeçalho do modal.
                  const pProntuario = pModal.numero_institucional ? `#${pModal.numero_institucional}` : 'S/N';
                  const pCpf = pModal.cpf || 'Não informado';

                  return (
                    <div className="mt-3">
                      <span className="text-sm text-brand font-semibold bg-white/10 px-3 py-1.5 rounded-lg inline-block">
                        {pModal.nome_social || pModal.nome_completo}
                      </span>
                      <p className="text-[11px] text-gray-400 mt-2 font-mono">
                        Prontuário: {pProntuario} &bull; CPF: {pCpf}
                      </p>
                    </div>
                  );
                })()}

                <p className="text-[10px] text-gray-500 mt-3 font-medium uppercase">
                  Aberto em: {new Date(chamadoSelecionado.data_ocorrencia).toLocaleString('pt-BR')}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {chamadoSelecionado.convivente_autor_ocorrencia && (
                  <ReportActionButton action="print" onClick={() => imprimirTermoReclamacao(chamadoSelecionado)}>
                    Imprimir
                  </ReportActionButton>
                )}
                <button onClick={fecharChamado} className="text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-lg p-2 transition-colors">
                  ✕ Fechar
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50">
              {chamadoSelecionado.convivente_autor_ocorrencia && (() => {
                const funcionario = listaFuncionarios.find(u => u.id === chamadoSelecionado.funcionario_envolvido_id);

                return (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-[10px] font-black uppercase text-amber-700">Reclamação formal do convivente</p>
                    <p className="mt-1 text-sm font-bold text-amber-950">
                      Funcionário citado: {funcionario?.nome || 'Não identificado'}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-amber-800">
                      Assinatura digital: {chamadoSelecionado.assinatura_convivente_validada_em
                        ? `validada em ${new Date(chamadoSelecionado.assinatura_convivente_validada_em).toLocaleString('pt-BR')}`
                        : 'pendente'}
                    </p>
                    <p className="mt-2 text-xs text-amber-700">
                      Imprima o termo para assinatura física e anexe o documento escaneado ao prontuário do convivente.
                    </p>
                  </div>
                );
              })()}
              
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-gray-400 ml-4 mb-1">RELATO INICIAL (ABERTURA)</span>
                <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-gray-200 shadow-sm self-start max-w-[85%]">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{chamadoSelecionado.descricao}</p>
                </div>
              </div>

              {chamadoSelecionado.interacoes?.map((int) => {
                const souEu = int.usuario_id === idUsuarioLogado;
                const isParecer = int.tipo_interacao === 'Parecer Técnico';

                return (
                  <div key={int.id} className={`flex flex-col ${souEu ? 'items-end' : 'items-start'}`}>
                    <span className={`text-[10px] font-bold text-gray-400 mb-1 ${souEu ? 'mr-4' : 'ml-4'}`}>
                      {new Date(int.data_interacao).toLocaleString('pt-BR')} {isParecer && ' • PARECER TÉCNICO'}
                    </span>
                    <div className={`p-4 rounded-2xl max-w-[85%] shadow-sm ${
                      isParecer ? 'bg-green-50 border border-green-200 text-green-900 w-full' : 
                      souEu ? 'bg-brand text-white rounded-tr-none' : 'bg-white border border-gray-200 text-gray-700 rounded-tl-none'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{int.mensagem}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-5 border-t border-gray-200 bg-white">
              {chamadoSelecionado.status_resolucao === 'Resolvido' ? (
                <div className="text-center p-3 bg-gray-50 rounded-xl border border-gray-200 text-gray-500 text-sm font-semibold">
                  Este chamado já recebeu o parecer técnico e foi encerrado.
                </div>
              ) : (
                <form onSubmit={handleEnviarInteracao} className="space-y-3">
                  <textarea 
                    value={novaMensagem}
                    onChange={(e) => setNovaMensagem(e.target.value)}
                    placeholder="Escreva sua interação ou relato adicional aqui..."
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand outline-none text-sm resize-none"
                    rows="3"
                    required
                  ></textarea>

                  <div className="flex justify-between items-center">
                    {(isGestor || (perfilUsuario === 'Técnico' && chamadoSelecionado.tecnico_responsavel_id === idUsuarioLogado)) ? (
                      <label className="flex items-center gap-2 cursor-pointer bg-red-50 px-3 py-2 rounded-lg border border-red-100 hover:bg-red-100 transition-colors">
                        <input 
                          type="checkbox" 
                          checked={encerrarChamado} 
                          onChange={(e) => setEncerrarChamado(e.target.checked)}
                          className="w-4 h-4 text-red-600 focus:ring-red-500 rounded"
                        />
                        <span className="text-xs font-bold text-red-700">Encerrar Chamado (Dar Parecer Técnico)</span>
                      </label>
                    ) : (
                      <span className="text-xs text-gray-400 font-medium italic">Enviando como observação/acompanhamento</span>
                    )}

                    <button 
                      type="submit" 
                      disabled={enviando || !novaMensagem.trim()}
                      className="px-6 py-2.5 bg-brand text-white font-bold text-sm rounded-xl hover:bg-brandDark disabled:opacity-50 transition-all shadow-md"
                    >
                      {enviando ? 'Enviando...' : 'Enviar Mensagem'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL DE CRIAÇÃO DE NOVO CHAMADO --- */}
      {modalNovoAberto && (
        <div className="carecore-modal-overlay fixed inset-0 bg-gray-900/60 z-50 flex items-start justify-center p-4 sm:p-8 backdrop-blur-sm overflow-y-auto">
          <div className="carecore-modal-panel bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col my-auto relative">
            
            <div className="bg-brand p-5 flex justify-between items-center text-white rounded-t-2xl">
              <h2 className="text-lg font-bold">Abrir Novo Chamado de Ocorrência</h2>
              <button type="button" onClick={() => setModalNovoAberto(false)} className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg p-2 transition-colors">
                ✕ Cancelar
              </button>
            </div>

            <div className="p-6 bg-gray-50">
              <form id="formNovoChamado" onSubmit={handleSalvarNovoChamado} className="space-y-6">
                {erroNovoChamado && (
                  <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    {erroNovoChamado}
                  </div>
                )}
                
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-2">1. Selecione o Acolhido *</label>
                  
                  <div className="relative">
                    <input
                      type="text"
                      required={!formNovo.convivente_id}
                      value={buscaPaciente}
                      onChange={(e) => {
                        setBuscaPaciente(e.target.value);
                        setMostrarDropdownPaciente(true);
                        setFormNovo({...formNovo, convivente_id: ''}); 
                      }}
                      onFocus={() => setMostrarDropdownPaciente(true)}
                      placeholder="Digite nome, prontuário ou CPF para buscar..."
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none bg-white text-sm font-medium"
                    />
                    
                    {mostrarDropdownPaciente && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {conviventesPacienteFiltrados.map(c => (
                            <div
                              key={c.id}
                              onClick={() => {
                                setFormNovo({...formNovo, convivente_id: c.id});
                                setBuscaPaciente(c.nome_social || c.nome_completo);
                                setMostrarDropdownPaciente(false);
                              }}
                              className="p-3 hover:bg-brand/10 cursor-pointer border-b border-gray-50 text-sm text-gray-700"
                            >
                              <span className="font-bold">{c.nome_social || c.nome_completo}</span>
                              <span className="text-[10px] text-gray-500 block mt-0.5">CPF: {c.cpf || 'Não informado'}</span>
                            </div>
                        ))}
                        {conviventesPacienteFiltrados.length === 0 && (
                          <div className="p-3 text-sm text-gray-500 text-center">Nenhum acolhido encontrado.</div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {formNovo.convivente_id && (
                    <p className="text-[10px] text-green-600 font-bold mt-2">✓ Paciente selecionado com sucesso.</p>
                  )}
                </div>

                <div className="bg-white p-5 rounded-xl border border-amber-200 shadow-sm space-y-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formNovo.convivente_autor_ocorrencia}
                      onChange={(e) => setFormNovo({
                        ...formNovo,
                        convivente_autor_ocorrencia: e.target.checked,
                        requer_acao_tecnica: e.target.checked ? true : formNovo.requer_acao_tecnica,
                        tipo_ocorrencia: e.target.checked ? 'Reclamação do convivente' : 'Comportamental',
                        funcionario_envolvido_id: e.target.checked ? formNovo.funcionario_envolvido_id : '',
                        assinatura_convivente_codigo: e.target.checked ? formNovo.assinatura_convivente_codigo : '',
                      })}
                      className="mt-1 w-4 h-4 text-amber-600 focus:ring-amber-500 rounded"
                    />
                    <div>
                      <span className="block text-sm font-black text-amber-900">
                        Este convivente é o autor/reclamante da ocorrência
                      </span>
                      <span className="block text-[11px] font-semibold text-amber-700 mt-1">
                        Use quando o convivente registrar uma reclamação formal contra funcionário ou equipe.
                      </span>
                    </div>
                  </label>

                  {formNovo.convivente_autor_ocorrencia && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-amber-100 pt-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Funcionário citado *</label>
                        <select
                          value={formNovo.funcionario_envolvido_id}
                          onChange={(e) => setFormNovo({ ...formNovo, funcionario_envolvido_id: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none bg-white text-sm"
                          required={formNovo.convivente_autor_ocorrencia}
                        >
                          <option value="">Selecione o funcionário</option>
                          {listaFuncionarios.map((usuario) => (
                            <option key={usuario.id} value={usuario.id}>
                              {usuario.nome} ({usuario.perfil_acesso || 'Equipe'})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Assinatura digital do convivente *</label>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <input
                            type="text"
                            value={formNovo.assinatura_convivente_codigo}
                            onChange={(e) => {
                              setFormNovo({ ...formNovo, assinatura_convivente_codigo: e.target.value });
                              setErroNovoChamado('');
                            }}
                            placeholder="Leia o QR Code ou digite o código do prontuário"
                            className={`min-h-10 flex-1 px-3 py-2 border rounded-lg focus:ring-2 outline-none text-sm ${
                              erroNovoChamado && formNovo.convivente_autor_ocorrencia
                                ? 'border-red-300 focus:ring-red-200'
                                : 'border-gray-300 focus:ring-brand'
                            }`}
                            required={formNovo.convivente_autor_ocorrencia}
                          />
                          <button
                            type="button"
                            onClick={() => setScannerAssinaturaAberto(true)}
                            className="min-h-10 rounded-lg bg-gray-900 px-3 py-2 text-xs font-black text-white hover:bg-black"
                          >
                            Abrir câmera
                          </button>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-1">
                          O sistema valida contra o QR Code, código do prontuário ou CPF.
                        </p>
                        {erroNovoChamado && formNovo.convivente_autor_ocorrencia && (
                          <p className="mt-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700">
                            {erroNovoChamado}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Método de validação</label>
                        <select
                          value={formNovo.assinatura_convivente_metodo}
                          onChange={(e) => setFormNovo({ ...formNovo, assinatura_convivente_metodo: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none bg-white text-sm"
                        >
                          <option value="QR Code da carteirinha">QR Code da carteirinha</option>
                          <option value="Código de barras da carteirinha">Código de barras da carteirinha</option>
                          <option value="Código digitado manualmente">Código digitado manualmente</option>
                        </select>
                      </div>

                      <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-[11px] font-semibold text-amber-800">
                        Após salvar, será gerado um termo para impressão e assinatura física. Depois o técnico pode escanear e anexar aos documentos do convivente.
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                  <h3 className="text-xs font-bold text-gray-700 uppercase">2. Detalhes da Situação</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo de Evento</label>
                      <select 
                        value={formNovo.tipo_ocorrencia}
                        onChange={(e) => setFormNovo({...formNovo, tipo_ocorrencia: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none bg-white text-sm"
                      >
                        {formNovo.convivente_autor_ocorrencia && (
                          <option value="Reclamação do convivente">Reclamação do convivente</option>
                        )}
                        <option value="Comportamental">Comportamental / Convivência</option>
                        <option value="Saúde">Saúde / Crise Médica</option>
                        <option value="Administrativo">Administrativo / Regras</option>
                        <option value="Outros">Outros</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Título Resumido *</label>
                      <input 
                        type="text" required
                        value={formNovo.motivo}
                        onChange={(e) => setFormNovo({...formNovo, motivo: e.target.value})}
                        placeholder="Ex: Discussão no refeitório"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Relato Completo *</label>
                    <textarea 
                      required rows="4"
                      value={formNovo.descricao}
                      onChange={(e) => setFormNovo({...formNovo, descricao: e.target.value})}
                      placeholder="Descreva exatamente o que aconteceu com datas e horas..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none text-sm resize-none"
                    ></textarea>
                  </div>



                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Prioridade *</label>
                    <select
                      value={formNovo.prioridade}
                      onChange={(e) => {
                        const novaPrioridade = e.target.value;
                        setFormNovo({
                          ...formNovo,
                          prioridade: novaPrioridade,
                          requer_acao_tecnica: novaPrioridade === 'Alta' || novaPrioridade === 'Crítica' ? true : formNovo.requer_acao_tecnica
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none bg-white text-sm font-bold"
                    >
                      <option value="Baixa">Baixa</option>
                      <option value="Média">Média</option>
                      <option value="Alta">Alta</option>
                      <option value="Crítica">Crítica</option>
                    </select>
                    <p className="text-[11px] text-gray-500 mt-1">Ocorrências Alta ou Crítica entram automaticamente nas pendências e alertas.</p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer bg-blue-50 p-3 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors w-fit">
                    <input 
                      type="checkbox" 
                      checked={formNovo.requer_acao_tecnica}
                      onChange={(e) => setFormNovo({...formNovo, requer_acao_tecnica: e.target.checked})}
                      className="w-4 h-4 text-brand focus:ring-brand rounded"
                    />
                    <div>
                      <span className="block text-sm font-bold text-blue-900">Requer Atenção do Técnico?</span>
                    </div>
                  </label>
                </div>

                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xs font-bold text-gray-700 uppercase">3. Copiar Equipe (@Menções)</h3>
                    <button 
                      type="button" 
                      onClick={handleSelecionarTodos}
                      className="text-[10px] font-bold text-brand hover:underline bg-blue-50 px-2 py-1 rounded"
                    >
                      {formNovo.observadores_ids.length === listaEquipe.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                    </button>
                  </div>
                  
                  <p className="text-[11px] text-gray-500 mb-4">Selecione colegas que precisam ficar cientes deste relato na tela de ocorrências deles:</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-3 border border-gray-100 rounded-lg bg-gray-50">
                    {listaEquipe.map(usuario => (
                      <label key={usuario.id} className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded border border-gray-200 hover:border-brand transition-colors">
                        <input 
                          type="checkbox" 
                          checked={formNovo.observadores_ids.includes(usuario.id)}
                          onChange={() => handleToggleObservador(usuario.id)}
                          className="text-brand focus:ring-brand rounded"
                        />
                        <span className="text-xs font-semibold text-gray-700 truncate" title={usuario.nome}>{usuario.nome}</span>
                      </label>
                    ))}
                    {listaEquipe.length === 0 && <span className="text-xs text-gray-400 italic p-2">Nenhuma equipe disponível para cópia.</span>}
                  </div>
                </div>

              </form>
            </div>

            <div className="p-5 border-t border-gray-200 bg-white flex justify-end gap-3 rounded-b-2xl">
              <button 
                type="button" 
                onClick={() => setModalNovoAberto(false)}
                className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold text-sm rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit" form="formNovoChamado"
                disabled={enviandoNovo}
                className="px-6 py-2.5 bg-brand text-white font-bold text-sm rounded-xl hover:bg-brandDark disabled:opacity-50 transition-all shadow-md flex items-center gap-2"
              >
                {enviandoNovo ? 'Criando ticket...' : 'Abrir chamado'}
              </button>
            </div>

          </div>
        </div>
      )}

      {scannerAssinaturaAberto && (
        <div className="carecore-modal-overlay fixed inset-0 bg-gray-900/70 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="carecore-modal-panel bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-gray-900 p-5 flex justify-between items-center text-white">
              <div>
                <h2 className="text-lg font-bold">Ler carteirinha</h2>
                <p className="text-xs text-gray-300 mt-1">Aponte a câmera para o QR Code ou digite o código do prontuário.</p>
              </div>
              <button
                type="button"
                onClick={() => setScannerAssinaturaAberto(false)}
                className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg p-2 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div
                id="leitor-camera-assinatura-ocorrencia"
                className="min-h-[280px] overflow-hidden rounded-2xl border border-gray-200 bg-gray-950"
              />

              {scannerAssinaturaErro && (
                <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">
                  {scannerAssinaturaErro}
                </div>
              )}

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setScannerAssinaturaAberto(false);
                }}
                className="space-y-2"
              >
                <label className="block text-xs font-bold uppercase tracking-wide text-gray-500">
                  Alternativa manual
                </label>
                <input
                  value={formNovo.assinatura_convivente_codigo}
                  onChange={(event) => setFormNovo({
                    ...formNovo,
                    assinatura_convivente_codigo: event.target.value,
                    assinatura_convivente_metodo: 'Código digitado manualmente',
                  })}
                  className="min-h-11 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                  placeholder="Digite o código do prontuário, CPF ou QR Code"
                />
                <button
                  type="submit"
                  className="min-h-11 w-full rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white"
                >
                  Usar este código
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      </MainShell>
    </AppShell>
  );
}

