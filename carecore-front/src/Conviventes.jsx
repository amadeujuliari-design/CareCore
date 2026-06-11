// === INÍCIO DA SEÇÃO 1: IMPORTAÇÕES E ESTADOS INICIAIS ===
import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import ConviventesLista from './components/conviventes/ConviventesLista';
import ModalCamera from './components/conviventes/ModalCamera';
import ModalCarteirinha from './components/conviventes/ModalCarteirinha';
import ModalFichaSensivel from './components/conviventes/ModalFichaSensivel';
import ProntuarioCabecalho from './components/conviventes/ProntuarioCabecalho';
import ProntuarioDocumentos from './components/conviventes/ProntuarioDocumentos';
import ProntuarioFluxo from './components/conviventes/ProntuarioFluxo';
import ProntuarioHistorico from './components/conviventes/ProntuarioHistorico';
import ProntuarioPia from './components/conviventes/ProntuarioPia';
import ProntuarioPessoais from './components/conviventes/ProntuarioPessoais';
import ProntuarioSaude from './components/conviventes/ProntuarioSaude';
import ProntuarioSensiveis from './components/conviventes/ProntuarioSensiveis';
import ProntuarioSocial from './components/conviventes/ProntuarioSocial';
import { AppShell, MainShell, PageHeader, ScrollArea } from './components/PremiumUI';
import {
  criarEstadoInicialConvivente,
  formatarDadosConviventeParaTela,
  formatarNumeroNIS,
  montarPayloadProntuario,
  statusConviventeClasse,
  validarCampoProntuario,
  validarProntuarioAntesSalvar,
} from './utils/conviventesProntuarioUtils';
import {
  useDeviceInfo,
} from './hooks/useDeviceInfo';
import { useConviventesLista } from './hooks/useConviventesLista';
import { usePermissoesProntuario } from './hooks/usePermissoesProntuario';
import { useProntuarioDocumentos } from './hooks/useProntuarioDocumentos';
import { useProntuarioHistorico } from './hooks/useProntuarioHistorico';
import { useProntuarioImpressao } from './hooks/useProntuarioImpressao';
import { useProntuarioPia } from './hooks/useProntuarioPia';
import { useTokenIdentity } from './hooks/useTokenIdentity';
import {
  formatarCEP,
  formatarCPF,
  formatarTelefone,
} from './utils/conviventesUtils';
import {
  atualizarConviventeProntuario,
  carregarDadosIniciaisProntuario,
  criarConviventeProntuario,
  obterConviventeProntuario,
} from './services/conviventesProntuarioService';
import { consultarCep } from './services/cepService';

const BNMP_PORTAL_URL = 'https://portalbnmp.cnj.jus.br/#/captcha/';
const TIPO_DOC_CONSULTA_BNMP = 'Consulta BNMP';

export default function Conviventes() {
  const navigate = useNavigate();
  const token = localStorage.getItem('@CareCore:token');
  const deviceInfo = useDeviceInfo();
  const { perfilUsuario, idUsuarioLogado } = useTokenIdentity(token);

  // Dados Principais
  const [conviventes, setConviventes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [quartos, setQuartos] = useState([]);

  // Dados do Cérebro de Ocorrências e Histórico
  const [listaTecnicos, setListaTecnicos] = useState([]);
  const [historicoMotivos, setHistoricoMotivos] = useState([]);
  const [origensEncaminhamento, setOrigensEncaminhamento] = useState([]);

  // Validações
  const [errosValidacao, setErrosValidacao] = useState({
    email_pessoal: '', cpf: '', cep: '', telefone_celular: '', contato_emergencia_telefone: ''
  });

  // Controles de Tela
  const [telaAtual, setTelaAtual] = useState('lista'); 
  const [abaAtual, setAbaAtual] = useState('pessoais'); 
  const [editandoId, setEditandoId] = useState(null);
  const [statusOriginal, setStatusOriginal] = useState('Ativo');
  
  const [termoPesquisa, setTermoPesquisa] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('Ativo'); 
  const [filtroLeito, setFiltroLeito] = useState('Todos');
  const [paginaConviventes, setPaginaConviventes] = useState(1);

  const scrollAreaRef = useRef(null);
  const snapshotSalvoRef = useRef(null);

  const estadoInicial = useMemo(() => criarEstadoInicialConvivente(), []);
  const [formData, setFormData] = useState(estadoInicial);
  const [mostrarSenhaEmail, setMostrarSenhaEmail] = useState(false);
  const [mostrarSenhaGovbr, setMostrarSenhaGovbr] = useState(false);
  const [salvandoProntuario, setSalvandoProntuario] = useState(false);
  const {
    evolucoesPorRegistroPia,
    formPia,
    formularioPiaEvolucao,
    loadingPia,
    piaCarregadoPara,
    prepararEvolucaoPia,
    prepararNovoPiaPrincipal,
    registroPiaMaisRecente,
    registrosPia,
    registrosPiaPrincipais,
    salvandoPia,
    setFormPia,
    temasEvolucaoPia,
    carregarRegistrosPia,
    handleSalvarRegistroPia,
    resetarPia,
  } = useProntuarioPia({ editandoId, setErro, setSucesso });

  const {
    usuarioPodeGerenciarDocumentosRestritos,
    usuarioPodeEnviarDocumentosRestritos,
    podeMudarStatus,
    podeCriarHistoricoConvivente,
    podeEditarHistoricoConvivente,
    usuarioPodeImprimirSensiveisConvivente,
  } = usePermissoesProntuario({
    perfilUsuario,
    idUsuarioLogado,
    editandoId,
    tecnicoId: formData.tecnico_id,
  });
  const {
    abrirCamera,
    abrirConsultaBnmp,
    arquivoSelecionado,
    cameraAberta,
    canvasRef,
    capturarFoto,
    carregarDocumentos,
    documentoConsultaBnmp,
    documentoSensivelSelecionado,
    documentos,
    enviarPdfConsultaBnmp,
    fecharCamera,
    fotoPerfilData,
    handleExcluirDocumento,
    handleRemoverFotoPerfil,
    handleUploadDocumento,
    loadingDocs,
    resetarDocumentosProntuario,
    salvandoConsultaBnmp,
    setArquivoSelecionado,
    setDocumentoSensivelSelecionado,
    setTipoDocumentoSelecionado,
    tipoDocumentoSelecionado,
    videoRef,
  } = useProntuarioDocumentos({
    bnmpPortalUrl: BNMP_PORTAL_URL,
    editandoId,
    deviceInfo,
    tipoDocConsultaBnmp: TIPO_DOC_CONSULTA_BNMP,
    usuarioPodeEnviarDocumentosRestritos,
    usuarioPodeGerenciarDocumentosRestritos,
    setErro,
    setSucesso,
    setFormData,
    carregarDadosIniciais,
  });
  const fotoPerfilUrl = fotoPerfilData?.caminho_arquivo || formData.foto_url || null;
  const {
    abrirCarteirinha,
    abrirFichaCompleta,
    carteirinhaAberta,
    fichaSensivelPendente,
    fotoCarteirinha,
    identidadeRelatorio,
    setCarteirinhaAberta,
    setFichaSensivelPendente,
    setIdentidadeRelatorio,
    solicitarImpressaoFichaCompleta,
  } = useProntuarioImpressao({
    documentos,
    editandoId,
    listaTecnicos,
    quartos,
    usuarioPodeImprimirSensiveisConvivente,
  });
  const {
    cancelarEdicaoHistoricoConvivente,
    carregarHistoricoFluxo,
    carregarHistoricosConvivente,
    carregarOcorrencias,
    excluirHistoricoConvivente,
    fluxoCarregadoPara,
    formHistoricoConvivente,
    handleSalvarHistoricoConvivente,
    historicoEditando,
    historicoFluxo,
    historicosCarregadosPara,
    historicosConvivente,
    iniciarEdicaoHistoricoConvivente,
    loadingHistoricoFluxo,
    loadingHistoricosConvivente,
    loadingOcorrencias,
    ocorrencias,
    ocorrenciasCarregadasPara,
    resetarHistoricoProntuario,
    salvandoHistoricoConvivente,
    setFormHistoricoConvivente,
  } = useProntuarioHistorico({
    editandoId,
    podeCriarHistoricoConvivente,
    setErro,
    setSucesso,
  });
// === FIM DA SEÇÃO 1 ===





// === INÍCIO DA SEÇÃO 2: CARREGAMENTO DA API E CONTROLE DE TELAS ===
  useEffect(() => {
    if (!token) { navigate('/'); return; }
    carregarDadosIniciais();
  }, [token]);

  useEffect(() => {
    setPaginaConviventes(1);
  }, [termoPesquisa, filtroStatus, filtroLeito]);

  async function carregarDadosIniciais() {
    setLoading(true);
    try {
      const dados = await carregarDadosIniciaisProntuario();

      setConviventes(dados.conviventes.map(formatarDadosConviventeParaTela));
      setQuartos(dados.quartos);
      setListaTecnicos(dados.tecnicos);
      setHistoricoMotivos(dados.motivos);
      setOrigensEncaminhamento(dados.origens || []);
      if (dados.identidade) setIdentidadeRelatorio(dados.identidade);
    } catch { 
      setErro('Erro ao sincronizar dados com o servidor.'); 
    } finally { 
      setLoading(false); 
    }
  }

  const abrirFormulario = () => {
    setFormData(estadoInicial);
    setMostrarSenhaEmail(false);
    setMostrarSenhaGovbr(false);
    setStatusOriginal('Ativo'); // <-- NOVO: Define a memória inicial como Ativo
    setAbaAtual('pessoais');
    setTelaAtual('form');
    setErro('');
    setErrosValidacao({ email_pessoal: '', cpf: '', cep: '', telefone_celular: '', contato_emergencia_telefone: '' });
    setEditandoId(null);
    snapshotSalvoRef.current = null;
    resetarDocumentosProntuario();
    resetarPia();
    resetarHistoricoProntuario();
  };

  const abrirParaEdicao = async (convivente) => {
    let prontuario;
    try {
      setErro('');
      prontuario = await obterConviventeProntuario(convivente.id);
    } catch (error) {
      console.error('Erro ao abrir prontuário', error);
      setErro('Não foi possível carregar o prontuário completo.');
      return;
    }

    const conviventeFormatado = formatarDadosConviventeParaTela(prontuario);
    const dadosEditados = {};
    Object.keys(estadoInicial).forEach(key => {
      dadosEditados[key] = conviventeFormatado[key] !== null && conviventeFormatado[key] !== undefined ? conviventeFormatado[key] : '';
    });
    setFormData(dadosEditados);
    snapshotSalvoRef.current = JSON.stringify(
      montarPayloadProntuario(dadosEditados, prontuario.status || 'Ativo'),
    );
    setMostrarSenhaEmail(false);
    setMostrarSenhaGovbr(false);
    setStatusOriginal(prontuario.status || 'Ativo'); // <-- NOVO: Salva na memória o status que veio do banco
    setEditandoId(prontuario.id);
    setAbaAtual('pessoais');
    setTelaAtual('form');
    setErro('');
    setErrosValidacao({ email_pessoal: '', cpf: '', cep: '', telefone_celular: '', contato_emergencia_telefone: '' });
    resetarPia();
    resetarHistoricoProntuario();
    carregarDocumentos(prontuario.id);
  };
// === FIM DA SEÇÃO 2 ===





// === INÍCIO DA SEÇÃO 3: WEBCAM, GED E SALVAMENTO DE FORMULÁRIO ===
  useEffect(() => {
    if (!editandoId || telaAtual !== 'form') return;

    if (abaAtual === 'historico' && ocorrenciasCarregadasPara !== editandoId) {
      carregarOcorrencias(editandoId);
    }

    if (abaAtual === 'historico' && historicosCarregadosPara !== editandoId) {
      carregarHistoricosConvivente(editandoId);
    }

    if ((abaAtual === 'historico' || abaAtual === 'fluxo') && fluxoCarregadoPara !== editandoId) {
      carregarHistoricoFluxo(editandoId);
    }

    if (abaAtual === 'pia' && piaCarregadoPara !== editandoId) {
      carregarRegistrosPia(editandoId);
    }
  }, [abaAtual, editandoId, telaAtual, ocorrenciasCarregadasPara, historicosCarregadosPara, fluxoCarregadoPara, piaCarregadoPara]);

  useEffect(() => {
    if (telaAtual !== 'form') return;
    scrollAreaRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [abaAtual, telaAtual, editandoId]);

  const buscarCep = async (cepBuscado) => {
    const cepLimpo = cepBuscado.replace(/\D/g, '');
    if (cepLimpo.length === 8) {
      try {
        const endereco = await consultarCep(cepLimpo);
        if (endereco) {
          setFormData(prev => ({
            ...prev,
            logradouro: endereco.logradouro,
            bairro: endereco.bairro,
            cidade: endereco.cidade,
            uf: endereco.uf,
          }));
          setErrosValidacao(prev => ({ ...prev, cep: '' }));
        } else {
          setErrosValidacao(prev => ({ ...prev, cep: 'CEP NÃO ENCONTRADO' }));
        }
      } catch (err) {
        console.error("Erro na busca de CEP", err);
        setErrosValidacao(prev => ({ ...prev, cep: 'NÃO FOI POSSÍVEL CONSULTAR O CEP' }));
      }
    }
  };

  const handleChange = (e) => {
    const { name, type, checked } = e.target;
    let value = e.target.value;
    
    if (name === 'cpf') value = formatarCPF(value);
    if (name === 'telefone_celular' || name === 'contato_emergencia_telefone') value = formatarTelefone(value);
    if (name === 'numero_nis') value = formatarNumeroNIS(value);
    if (name === 'cep') { 
      value = formatarCEP(value);
      if (value.length === 9) buscarCep(value);
    }
    
    if (errosValidacao[name]) setErrosValidacao(prev => ({ ...prev, [name]: '' }));

    if (name === 'status') {
      setFormData(prev => ({
        ...prev,
        status: value,
        motivo_status: ['Saída qualificada', 'Ausência justificada'].includes(value) ? value : prev.motivo_status,
      }));
      return;
    }

    setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setErrosValidacao(prev => ({ ...prev, [name]: validarCampoProntuario(name, value) }));
  };

  const salvarProntuario = async ({ permanecerNaFicha = false, abaDestino = null, silencioso = false } = {}) => {
    setErro('');
    if (!silencioso) setSucesso('');

    const validacao = validarProntuarioAntesSalvar(formData, statusOriginal, errosValidacao);
    if (!validacao.valido) {
      setErrosValidacao(validacao.erros);
      setErro(validacao.mensagem);
      if (validacao.abaComErro) setAbaAtual(validacao.abaComErro);
      return null;
    }

    try {
      setSalvandoProntuario(true);
      const payload = montarPayloadProntuario(formData, statusOriginal);
      let conviventeSalvo = null;
      if (editandoId) {
        conviventeSalvo = await atualizarConviventeProntuario(editandoId, payload);
        if (!silencioso) setSucesso('Prontuário atualizado com sucesso!');
      } else {
        conviventeSalvo = await criarConviventeProntuario(payload);
        setEditandoId(conviventeSalvo.id);
        setStatusOriginal(conviventeSalvo.status || payload.status || 'Ativo');
        if (!silencioso) setSucesso('Prontuário salvo com sucesso!');
      }

      snapshotSalvoRef.current = JSON.stringify(payload);

      if (conviventeSalvo?.status) {
        setStatusOriginal(conviventeSalvo.status);
      }

      if (silencioso) {
        if (conviventeSalvo) {
          const conviventeFormatado = formatarDadosConviventeParaTela(conviventeSalvo);
          setConviventes((prev) => {
            const existe = prev.some((item) => item.id === conviventeFormatado.id);
            if (existe) {
              return prev.map((item) => (item.id === conviventeFormatado.id ? conviventeFormatado : item));
            }
            return [conviventeFormatado, ...prev];
          });
        }
      } else {
        await carregarDadosIniciais();
      }

      if (permanecerNaFicha) {
        if (abaDestino) setAbaAtual(abaDestino);
      } else {
        setTelaAtual('lista');
      }

      if (!silencioso) {
        setTimeout(() => setSucesso(''), 3000);
      }
      return conviventeSalvo;
    } catch (error) {
      setErro(error.response?.data?.detail || 'Erro ao salvar dados no servidor.');
      return null;
    } finally {
      setSalvandoProntuario(false);
    }
  };

  const handleSalvar = async (e) => {
    e.preventDefault();
    await salvarProntuario();
  };

  const trocarAbaComSalvamento = async (novaAba) => {
    if (novaAba === abaAtual || salvandoProntuario) return;

    const payloadAtual = JSON.stringify(montarPayloadProntuario(formData, statusOriginal));
    if (editandoId && snapshotSalvoRef.current === payloadAtual) {
      setAbaAtual(novaAba);
      return;
    }

    await salvarProntuario({
      permanecerNaFicha: true,
      abaDestino: novaAba,
      silencioso: true,
    });
  };

  const obterLocalizacaoLeito = (leitoId) => {
    if (!leitoId) return <span className="text-gray-400 text-xs">Apenas Atendimento Diurno</span>;
    for (let q of quartos) {
      const leitoEncontrado = q.leitos?.find(l => l.id === leitoId);
      if (leitoEncontrado) return <span className="text-xs bg-blue-50 text-brand font-semibold px-2 py-1 rounded border border-blue-100">{q.nome} - {leitoEncontrado.identificacao}</span>;
    }
    return <span className="text-gray-400 text-xs">Carregando leito...</span>;
  };

// === FIM DA SEÇÃO 3 ===





{/* === INÍCIO DA SEÇÃO 4: ESTRUTURA VISUAL PRINCIPAL E TELA DE LISTAGEM === */}
  const {
    conviventesFiltrados,
    conviventesVisiveis,
    exibindoApenasAtivos,
    indiceInicialConviventes,
    indiceFinalConviventes,
    paginaConviventesSegura,
    totalPaginasConviventes,
    irParaPaginaConviventes,
  } = useConviventesLista({
    conviventes,
    termoPesquisa,
    filtroStatus,
    filtroLeito,
    paginaConviventes,
    setPaginaConviventes,
    idUsuarioLogado,
  });
  const conviventeAtual = editandoId ? conviventes.find(c => c.id === editandoId) : null;

  return (
    <AppShell>
      <Sidebar />

      <MainShell>
        <PageHeader
          eyebrow="Assistência"
          title="Módulo de Prontuários"
          subtitle="Cadastro, acompanhamento técnico, documentos e histórico da população acolhida."
          icon="◇"
        />

        <ScrollArea ref={scrollAreaRef}>
          <div className="w-full max-w-7xl mx-auto">
          {erro && telaAtual === 'lista' && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm mb-6 font-semibold border border-red-100 flex items-center gap-2">! {erro}</div>}
          {sucesso && telaAtual === 'lista' && <div className="bg-green-50 text-green-700 p-4 rounded-xl text-sm mb-6 font-semibold border border-green-100 flex items-center gap-2">{sucesso}</div>}

          {/* TELA DE LISTAGEM */}
          {telaAtual === 'lista' && (
            <ConviventesLista
              loading={loading}
              conviventesFiltrados={conviventesFiltrados}
              conviventesVisiveis={conviventesVisiveis}
              exibindoApenasAtivos={exibindoApenasAtivos}
              termoPesquisa={termoPesquisa}
              setTermoPesquisa={setTermoPesquisa}
              filtroStatus={filtroStatus}
              setFiltroStatus={setFiltroStatus}
              filtroLeito={filtroLeito}
              setFiltroLeito={setFiltroLeito}
              indiceInicialConviventes={indiceInicialConviventes}
              indiceFinalConviventes={indiceFinalConviventes}
              paginaConviventesSegura={paginaConviventesSegura}
              totalPaginasConviventes={totalPaginasConviventes}
              irParaPaginaConviventes={irParaPaginaConviventes}
              idUsuarioLogado={idUsuarioLogado}
              abrirFormulario={abrirFormulario}
              abrirParaEdicao={abrirParaEdicao}
              obterLocalizacaoLeito={obterLocalizacaoLeito}
              statusConviventeClasse={statusConviventeClasse}
            />
          )}
{/* === FIM DA SEÇÃO 4 === */}





{/* === INÍCIO DA SEÇÃO 5: CABEÇALHO DO FORMULÁRIO E ABA 1 (PESSOAIS E STATUS) === */}
          {telaAtual === 'form' && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden mb-8">
              
              <ProntuarioCabecalho
                abaAtual={abaAtual}
                editandoId={editandoId}
                formData={formData}
                perfilUsuario={perfilUsuario}
                salvandoProntuario={salvandoProntuario}
                conviventeAtual={conviventeAtual}
                abrirCarteirinha={abrirCarteirinha}
                solicitarImpressaoFichaCompleta={solicitarImpressaoFichaCompleta}
                setTelaAtual={setTelaAtual}
                trocarAbaComSalvamento={trocarAbaComSalvamento}
              />

              <form onSubmit={handleSalvar}>
                <div className="p-5 min-h-[300px]">
                  
                  {abaAtual === 'pessoais' && (
                    <ProntuarioPessoais
                      editandoId={editandoId}
                      formData={formData}
                      fotoPerfilUrl={fotoPerfilUrl}
                      listaTecnicos={listaTecnicos}
                      origensEncaminhamento={origensEncaminhamento}
                      historicoMotivos={historicoMotivos}
                      statusOriginal={statusOriginal}
                      podeMudarStatus={podeMudarStatus}
                      errosValidacao={errosValidacao}
                      quartos={quartos}
                      handleChange={handleChange}
                      handleBlur={handleBlur}
                      handleRemoverFotoPerfil={handleRemoverFotoPerfil}
                      trocarAbaComSalvamento={trocarAbaComSalvamento}
                    />
                  )}
{/* === FIM DA SEÇÃO 5 === */}





{/* === INÍCIO DA SEÇÃO 6: DEMAIS ABAS, MODAL E FUNÇÕES AUXILIARES === */}
                  {abaAtual === 'historico' && (
                    <ProntuarioHistorico
                      editandoId={editandoId}
                      formHistoricoConvivente={formHistoricoConvivente}
                      setFormHistoricoConvivente={setFormHistoricoConvivente}
                      historicoEditando={historicoEditando}
                      salvandoHistoricoConvivente={salvandoHistoricoConvivente}
                      podeCriarHistoricoConvivente={podeCriarHistoricoConvivente}
                      podeEditarHistoricoConvivente={podeEditarHistoricoConvivente}
                      loadingHistoricosConvivente={loadingHistoricosConvivente}
                      historicosConvivente={historicosConvivente}
                      loadingHistoricoFluxo={loadingHistoricoFluxo}
                      historicoFluxo={historicoFluxo}
                      loadingOcorrencias={loadingOcorrencias}
                      ocorrencias={ocorrencias}
                      carregarHistoricosConvivente={carregarHistoricosConvivente}
                      carregarHistoricoFluxo={carregarHistoricoFluxo}
                      cancelarEdicaoHistoricoConvivente={cancelarEdicaoHistoricoConvivente}
                      handleSalvarHistoricoConvivente={handleSalvarHistoricoConvivente}
                      iniciarEdicaoHistoricoConvivente={iniciarEdicaoHistoricoConvivente}
                      excluirHistoricoConvivente={excluirHistoricoConvivente}
                    />
                  )}

                  {abaAtual === 'fluxo' && (
                    <ProntuarioFluxo
                      editandoId={editandoId}
                      loadingHistoricoFluxo={loadingHistoricoFluxo}
                      historicoFluxo={historicoFluxo}
                    />
                  )}

                  {abaAtual === 'pia' && (
                    <ProntuarioPia
                      editandoId={editandoId}
                      formPia={formPia}
                      setFormPia={setFormPia}
                      formularioPiaEvolucao={formularioPiaEvolucao}
                      registroPiaMaisRecente={registroPiaMaisRecente}
                      registrosPia={registrosPia}
                      registrosPiaPrincipais={registrosPiaPrincipais}
                      evolucoesPorRegistroPia={evolucoesPorRegistroPia}
                      loadingPia={loadingPia}
                      salvandoPia={salvandoPia}
                      temasEvolucaoPia={temasEvolucaoPia}
                      prepararEvolucaoPia={prepararEvolucaoPia}
                      prepararNovoPiaPrincipal={prepararNovoPiaPrincipal}
                      handleSalvarRegistroPia={handleSalvarRegistroPia}
                      carregarRegistrosPia={carregarRegistrosPia}
                    />
                  )}

                  {abaAtual === 'social' && (
                    <ProntuarioSocial formData={formData} handleChange={handleChange} />
                  )}

                  {abaAtual === 'saude' && (
                    <ProntuarioSaude
                      formData={formData}
                      errosValidacao={errosValidacao}
                      mostrarSenhaEmail={mostrarSenhaEmail}
                      mostrarSenhaGovbr={mostrarSenhaGovbr}
                      setMostrarSenhaEmail={setMostrarSenhaEmail}
                      setMostrarSenhaGovbr={setMostrarSenhaGovbr}
                      handleChange={handleChange}
                      handleBlur={handleBlur}
                    />
                  )}

                  {abaAtual === 'sensiveis' && (
                    <ProntuarioSensiveis
                      editandoId={editandoId}
                      formData={formData}
                      documentoConsultaBnmp={documentoConsultaBnmp}
                      usuarioPodeEnviarDocumentosRestritos={usuarioPodeEnviarDocumentosRestritos}
                      usuarioPodeGerenciarDocumentosRestritos={usuarioPodeGerenciarDocumentosRestritos}
                      salvandoConsultaBnmp={salvandoConsultaBnmp}
                      handleChange={handleChange}
                      abrirConsultaBnmp={abrirConsultaBnmp}
                      enviarPdfConsultaBnmp={enviarPdfConsultaBnmp}
                      handleExcluirDocumento={handleExcluirDocumento}
                    />
                  )}

                  {abaAtual === 'documentos' && (
                    <ProntuarioDocumentos
                      editandoId={editandoId}
                      documentos={documentos}
                      loadingDocs={loadingDocs}
                      arquivoSelecionado={arquivoSelecionado}
                      tipoDocumentoSelecionado={tipoDocumentoSelecionado}
                      setTipoDocumentoSelecionado={setTipoDocumentoSelecionado}
                      documentoSensivelSelecionado={documentoSensivelSelecionado}
                      setDocumentoSensivelSelecionado={setDocumentoSensivelSelecionado}
                      usuarioPodeEnviarDocumentosRestritos={usuarioPodeEnviarDocumentosRestritos}
                      usuarioPodeGerenciarDocumentosRestritos={usuarioPodeGerenciarDocumentosRestritos}
                      deviceInfo={deviceInfo}
                      abrirCamera={abrirCamera}
                      setArquivoSelecionado={setArquivoSelecionado}
                      handleUploadDocumento={handleUploadDocumento}
                      handleExcluirDocumento={handleExcluirDocumento}
                    />
                  )}
                </div>

                <div className="bg-gray-100 p-4 border-t flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 rounded-b-xl">
                  <div className="flex-1 w-full text-left">{erro && telaAtual === 'form' && (<span className="text-red-600 font-bold text-xs bg-red-100 px-3 py-1.5 rounded flex items-center w-fit animate-pulse shadow-sm">! {erro}</span>)}</div>
                  <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:gap-3"><button type="button" onClick={() => setTelaAtual('lista')} className="px-5 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors">Cancelar</button><button type="submit" disabled={salvandoProntuario} className="px-6 py-2 bg-brand text-white rounded-lg text-sm font-bold hover:bg-brandDark shadow transition-all disabled:opacity-60">{salvandoProntuario ? 'Salvando...' : (editandoId ? 'Atualizar prontuário' : 'Salvar prontuário')}</button></div>
                </div>
              </form>
            </div>
          )}
          </div>
        </ScrollArea>

      <ModalFichaSensivel
        fichaSensivelPendente={fichaSensivelPendente}
        setFichaSensivelPendente={setFichaSensivelPendente}
        abrirFichaCompleta={abrirFichaCompleta}
      />

      <ModalCarteirinha
        carteirinhaAberta={carteirinhaAberta}
        setCarteirinhaAberta={setCarteirinhaAberta}
        quartos={quartos}
        listaTecnicos={listaTecnicos}
        fotoCarteirinha={fotoCarteirinha}
        identidadeRelatorio={identidadeRelatorio}
      />

      <ModalCamera
        cameraAberta={cameraAberta}
        videoRef={videoRef}
        canvasRef={canvasRef}
        fecharCamera={fecharCamera}
        capturarFoto={capturarFoto}
      />

      {sucesso && telaAtual === 'form' && (
        <div className="pointer-events-none fixed bottom-6 right-6 z-40 max-w-sm rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700 shadow-lg">
          {sucesso}
        </div>
      )}
      </MainShell>
    </AppShell>
  );
}
// === FIM DO ARQUIVO ===