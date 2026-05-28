// === INÍCIO DA SEÇÃO 1: IMPORTAÇÕES E ESTADOS INICIAIS ===
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Sidebar from './Sidebar';
import AuthenticatedImage from './components/AuthenticatedImage';
import { AppShell, MainShell, PageHeader, ScrollArea } from './components/PremiumUI';
import { API_ROOT } from './config/apiBase';
import {
  getCameraUnavailableMessage,
  getPreferredCameraConstraints,
  useDeviceInfo,
} from './hooks/useDeviceInfo';
import { baixarArquivoAutenticado } from './utils/arquivosApi';
import {
  calcularIdade,
  formatarCEP,
  formatarCPF,
  formatarTelefone,
  validarCEP,
  validarCPF,
  validarEmail,
  validarTelefone,
} from './utils/conviventesUtils';

// Bibliotecas brutas
import QRCodeLib from 'react-qr-code';
import BarcodeLib from 'react-barcode';

// Blindagem atualizada: aceita funções e objetos React (como forwardRef do QRCode)
const getValidComponent = (Lib) => {
  if (!Lib) return () => <div className="text-red-500 text-xs">Erro</div>;
  if (typeof Lib === 'function') return Lib;
  if (typeof Lib === 'object' && Lib.$$typeof) return Lib; 
  if (Lib.default) return getValidComponent(Lib.default);
  return () => <div className="text-red-500 text-xs">Erro</div>;
};

// Aplica a blindagem
const QRCode = getValidComponent(QRCodeLib);
const Barcode = getValidComponent(BarcodeLib);

export default function Conviventes() {
  const navigate = useNavigate();
  const token = localStorage.getItem('@CareCore:token');
  const deviceInfo = useDeviceInfo();

  // 🧠 LÓGICA DE PERFIS (RBAC) E IDENTIDADE
  let perfilUsuario = '';
  let idUsuarioLogado = '';
  try {
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]));
      perfilUsuario = payload.perfil_acesso || ''; 
      idUsuarioLogado = payload.sub || '';
    }
  } catch (e) { 
    console.error('Erro ao ler perfil do token', e);
  }

  // Dados Principais
  const [conviventes, setConviventes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [quartos, setQuartos] = useState([]);

  // Dados do Cérebro de Ocorrências e Histórico
  const [listaTecnicos, setListaTecnicos] = useState([]);
  const [historicoMotivos, setHistoricoMotivos] = useState([]);
  const [ocorrencias, setOcorrencias] = useState([]); 
  const [loadingOcorrencias, setLoadingOcorrencias] = useState(false);
  const [historicoFluxo, setHistoricoFluxo] = useState([]);
  const [loadingHistoricoFluxo, setLoadingHistoricoFluxo] = useState(false);

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
  const [filtroStatus, setFiltroStatus] = useState('Todos'); 
  const [filtroLeito, setFiltroLeito] = useState('Todos');

  // Controles de Documentos e Câmera
  const [documentos, setDocumentos] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [arquivoSelecionado, setArquivoSelecionado] = useState(null);
  const [tipoDocumentoSelecionado, setTipoDocumentoSelecionado] = useState('Foto de Perfil');
  const [cameraAberta, setCameraAberta] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Estados da carteirinha
  const [carteirinhaAberta, setCarteirinhaAberta] = useState(null);
  const [fotoCarteirinha, setFotoCarteirinha] = useState(null);
  
  const estadoInicial = {
    status: 'Ativo', data_entrada: new Date().toISOString().split('T')[0],
    leito_id: '', tecnico_id: '', foto_url: '', 
    nome_completo: '', nome_social: '', cpf: '', rg: '', data_nascimento: '',
    identidade_genero: '', orientacao_sexual: '', naturalidade: '', estado_civil: '',
    escolaridade: '', telefone_celular: '', nome_mae: '', nome_pai: '',
    cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '',
    numero_sisa: '', numero_nis: '', status_cadunico: '', programas_beneficios: '',
    possui_renda: false, renda_mensal: '',
    contato_emergencia_nome: '', contato_emergencia_telefone: '', observacoes_saude: '',
    email_pessoal: '', senha_email: '', senha_govbr: '',
    egresso_prisional: false, usa_tornozeleira: false, medidas_protetivas: '',
    acompanhamento_caps: '', uso_substancias: '', transtorno_mental: '',
    observacao_status: '', 
    motivo_status: '', 
    relato_status: ''  
  };
  const [formData, setFormData] = useState(estadoInicial);
  const [mostrarSenhaEmail, setMostrarSenhaEmail] = useState(false);
  const [mostrarSenhaGovbr, setMostrarSenhaGovbr] = useState(false);

  const fotoPerfilData = documentos
    .filter(doc => doc.tipo_documento === 'Foto de Perfil')
    .sort((a, b) => new Date(b.data_upload) - new Date(a.data_upload))[0];
  const fotoPerfilUrl = fotoPerfilData?.caminho_arquivo || null;

  const podeMudarStatus = !editandoId || perfilUsuario === 'Gestor' || perfilUsuario === 'Gerente' || (perfilUsuario === 'Técnico' && formData.tecnico_id === idUsuarioLogado);
// === FIM DA SEÇÃO 1 ===





// === INÍCIO DA SEÇÃO 2: CARREGAMENTO DA API E CONTROLE DE TELAS ===
  useEffect(() => {
    if (!token) { navigate('/'); return; }
    carregarDadosIniciais();
  }, [token]);

  const carregarDadosIniciais = async () => {
    setLoading(true);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const [resConv, resQuartos, resTecnicos, resMotivos] = await Promise.all([
        axios.get(`${API_ROOT}/conviventes`, config),
        axios.get(`${API_ROOT}/quartos`, config),
        axios.get(`${API_ROOT}/tecnicos`, config),
        axios.get(`${API_ROOT}/motivos-inteligentes`, config)
      ]);

      setConviventes(resConv.data);
      setQuartos(resQuartos.data);
      setListaTecnicos(resTecnicos.data);
      setHistoricoMotivos(resMotivos.data);
    } catch { 
      setErro('Erro ao sincronizar dados com o servidor.'); 
    } finally { 
      setLoading(false); 
    }
  };

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
    setDocumentos([]); 
    setOcorrencias([]);
    setArquivoSelecionado(null);
    fecharCamera();
  };

  const abrirParaEdicao = (convivente) => {
    const dadosEditados = {};
    Object.keys(estadoInicial).forEach(key => {
      dadosEditados[key] = convivente[key] !== null && convivente[key] !== undefined ? convivente[key] : '';
    });
    setFormData(dadosEditados);
    setMostrarSenhaEmail(false);
    setMostrarSenhaGovbr(false);
    setStatusOriginal(convivente.status || 'Ativo'); // <-- NOVO: Salva na memória o status que veio do banco
    setEditandoId(convivente.id); 
    setAbaAtual('pessoais');
    setTelaAtual('form');
    setErro('');
    setErrosValidacao({ email_pessoal: '', cpf: '', cep: '', telefone_celular: '', contato_emergencia_telefone: '' });
    carregarDocumentos(convivente.id); 
    carregarOcorrencias(convivente.id);
    carregarHistoricoFluxo(convivente.id); 
  };
// === FIM DA SEÇÃO 2 ===





// === INÍCIO DA SEÇÃO 3: WEBCAM, GED E SALVAMENTO DE FORMULÁRIO ===
  const carregarOcorrencias = async (conviventeId) => {
    setLoadingOcorrencias(true);
    try {
      const response = await axios.get(`${API_ROOT}/conviventes/${conviventeId}/ocorrencias`, { headers: { Authorization: `Bearer ${token}` } });
      setOcorrencias(response.data);
    } catch (error) { console.error("Erro ao carregar histórico", error); } finally { setLoadingOcorrencias(false); }
  };
  const carregarHistoricoFluxo = async (conviventeId) => {

  try {

    setLoadingHistoricoFluxo(true);

    const token = localStorage.getItem('@CareCore:token');

    const response = await axios.get(
      `${API_ROOT}/rotina/historico?convivente_id=${conviventeId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    setHistoricoFluxo(response.data);

  } catch (error) {

    console.error(
      'Erro ao carregar histórico de fluxo:',
      error
    );

  } finally {

    setLoadingHistoricoFluxo(false);

  }
};

  const abrirCamera = async () => {
    setCameraAberta(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErro('Seu navegador não permite captura direta pela câmera. Use o botão de arquivo/câmera do celular.');
        setCameraAberta(false);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia(
        getPreferredCameraConstraints(deviceInfo)
      );

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        await videoRef.current.play();
      }
    } catch {
      setErro(getCameraUnavailableMessage(deviceInfo, 'a câmera'));
      setCameraAberta(false);
    }
  };

  const fecharCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    setCameraAberta(false);
  };

  const capturarFoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        const file = new File([blob], `foto_perfil_${editandoId || 'novo'}.png`, { type: "image/png" });
        setArquivoSelecionado(file);
        setTipoDocumentoSelecionado("Foto de Perfil");
        setSucesso('Foto capturada. Clique em "Fazer upload" para confirmar.');
        fecharCamera();
        setTimeout(() => setSucesso(''), 4000);
      }, 'image/png');
    }
  };

  const carregarDocumentos = async (conviventeId) => {
    setLoadingDocs(true);
    try {
      const response = await axios.get(`${API_ROOT}/conviventes/${conviventeId}/documentos`, { headers: { Authorization: `Bearer ${token}` } });
      setDocumentos(response.data);
    } catch (error) { console.error("Erro ao carregar documentos", error); } finally { setLoadingDocs(false); }
  };

  // Função para abrir o RG e buscar a foto atualizada
  const abrirCarteirinha = async (convivente) => {
    setCarteirinhaAberta(convivente);
    setFotoCarteirinha(null);
    try {
      const response = await axios.get(`${API_ROOT}/conviventes/${convivente.id}/documentos`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      const fotoData = response.data.filter(doc => doc.tipo_documento === 'Foto de Perfil')
        .sort((a, b) => new Date(b.data_upload) - new Date(a.data_upload))[0];
      
      if (fotoData) {
        setFotoCarteirinha(fotoData.caminho_arquivo);
      }
    } catch (error) {
      console.error("Erro ao buscar foto para a carteirinha", error);
    }
  };

  const handleUploadDocumento = async (e) => {
    e.preventDefault();
    if (!editandoId) { setErro('Atenção: Salve o prontuário primeiro.'); return; }
    if (!arquivoSelecionado) { setErro('Selecione um arquivo antes de enviar.'); return; }

    setLoadingDocs(true);
    const formUpload = new FormData();
    formUpload.append('file', arquivoSelecionado);
    formUpload.append('tipo_documento', tipoDocumentoSelecionado);
    try {
      await axios.post(`${API_ROOT}/conviventes/${editandoId}/documentos`, formUpload, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } });
      setSucesso('Arquivo anexado com sucesso!');
      setArquivoSelecionado(null);
      carregarDocumentos(editandoId);
      setTimeout(() => setSucesso(''), 3000);
    } catch { setErro('Erro ao realizar upload do arquivo.'); } finally { setLoadingDocs(false); }
  };

  const handleExcluirDocumento = async (documentoId) => {
    if (!window.confirm("Deseja realmente excluir este arquivo?")) return;
    try {
      await axios.delete(`${API_ROOT}/documentos/${documentoId}`, { headers: { Authorization: `Bearer ${token}` } });
      setSucesso('Arquivo excluído com sucesso.');
      carregarDocumentos(editandoId);
      setTimeout(() => setSucesso(''), 3000);
    } catch { setErro('Erro ao excluir o documento.'); }
  };

  const buscarCep = async (cepBuscado) => {
    const cepLimpo = cepBuscado.replace(/\D/g, '');
    if (cepLimpo.length === 8) {
      try {
        const response = await axios.get(`https://viacep.com.br/ws/${cepLimpo}/json/`);
        if (!response.data.erro) {
          setFormData(prev => ({ ...prev, logradouro: response.data.logradouro || '', bairro: response.data.bairro || '', cidade: response.data.localidade || '', uf: response.data.uf || '' }));
        }
      } catch (err) { console.error("Erro na busca de CEP", err); }
    }
  };

  const handleChange = (e) => {
    const { name, type, checked } = e.target;
    let value = e.target.value;
    
    if (name === 'cpf') value = formatarCPF(value);
    if (name === 'telefone_celular' || name === 'contato_emergencia_telefone') value = formatarTelefone(value);
    if (name === 'cep') { 
      value = formatarCEP(value);
      if (value.length === 9) buscarCep(value);
    }
    
    if (errosValidacao[name]) setErrosValidacao(prev => ({ ...prev, [name]: '' }));
    setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    let msgErro = '';
    if (!value || value.trim() === '') {
      setErrosValidacao(prev => ({ ...prev, [name]: '' }));
      return;
    }

    if (name === 'email_pessoal' && !validarEmail(value)) msgErro = 'DIGITE UM E-MAIL VÁLIDO';
    if (name === 'cpf' && !validarCPF(value)) msgErro = 'CPF INVÁLIDO';
    if (name === 'cep' && !validarCEP(value)) msgErro = 'CEP INCOMPLETO';
    if ((name === 'telefone_celular' || name === 'contato_emergencia_telefone') && !validarTelefone(value)) msgErro = 'TELEFONE INVÁLIDO';
    setErrosValidacao(prev => ({ ...prev, [name]: msgErro }));
  };

  const handleSalvar = async (e) => {
    e.preventDefault();
    setErro('');
    setSucesso('');

    let temErro = false;
    let novosErros = { ...errosValidacao };
    let abaComErro = null;

    if (formData.status !== statusOriginal) {
      if (!formData.motivo_status || formData.motivo_status.trim() === '') {
        setErro('Salvamento bloqueado: Escolha o Motivo Principal da alteração (Ex: Evasão).');
        setAbaAtual('pessoais'); return; 
      }
      if (!formData.relato_status || formData.relato_status.trim() === '') {
        setErro('Salvamento bloqueado: Preencha o Relato Detalhado descrevendo o que houve.');
        setAbaAtual('pessoais'); return; 
      }
    }

    if (formData.cpf && !validarCPF(formData.cpf)) { novosErros.cpf = 'CPF INVÁLIDO'; temErro = true; abaComErro = 'pessoais'; }
    if (formData.cep && !validarCEP(formData.cep)) { novosErros.cep = 'CEP INCOMPLETO'; temErro = true; abaComErro = abaComErro || 'pessoais'; }
    if (formData.telefone_celular && !validarTelefone(formData.telefone_celular)) { novosErros.telefone_celular = 'TELEFONE INVÁLIDO'; temErro = true; abaComErro = abaComErro || 'pessoais'; }
    if (formData.contato_emergencia_telefone && !validarTelefone(formData.contato_emergencia_telefone)) { novosErros.contato_emergencia_telefone = 'TELEFONE INVÁLIDO'; temErro = true; abaComErro = abaComErro || 'saude'; }
    if (formData.email_pessoal && !validarEmail(formData.email_pessoal)) { novosErros.email_pessoal = 'DIGITE UM E-MAIL VÁLIDO'; temErro = true; abaComErro = abaComErro || 'saude'; }

    if (temErro) {
      setErrosValidacao(novosErros);
      setErro('Salvamento bloqueado: Existem campos incorretos na ficha.');
      if (abaComErro) setAbaAtual(abaComErro);
      return;
    }

    try {
      const payload = { ...formData };
      if (payload.status !== statusOriginal) {
        payload.observacao_status = `[${payload.motivo_status.toUpperCase()}] - ${payload.relato_status}`;
      }
      
      delete payload.motivo_status;
      delete payload.relato_status;

      Object.keys(payload).forEach(key => { if (payload[key] === '') payload[key] = null; });
      if (editandoId) {
        await axios.put(`${API_ROOT}/conviventes/${editandoId}`, payload, { headers: { Authorization: `Bearer ${token}` } });
        setSucesso('Prontuário atualizado com sucesso!');
      } else {
        await axios.post(`${API_ROOT}/conviventes`, payload, { headers: { Authorization: `Bearer ${token}` } });
        setSucesso('Prontuário salvo com sucesso!');
      }
      setTelaAtual('lista');
      carregarDadosIniciais();
      setTimeout(() => setSucesso(''), 3000);
    } catch (error) { setErro(error.response?.data?.detail || 'Erro ao salvar dados no servidor.'); }
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
  const conviventesFiltrados = conviventes.filter(c => {
    const termo = termoPesquisa.toLowerCase();
    const matchPesquisa = 
      (c.nome_completo || '').toLowerCase().includes(termo) ||
      (c.nome_social || '').toLowerCase().includes(termo) ||
      (c.cpf || '').includes(termo);

    const matchStatus = filtroStatus === 'Todos' || c.status === filtroStatus;

    let matchLeito = true;
    if (filtroLeito === 'Com Cama') matchLeito = c.leito_id !== null;
    if (filtroLeito === 'Sem Cama') matchLeito = c.leito_id === null;

    return matchPesquisa && matchStatus && matchLeito;
  }).sort((a, b) => {
    const isMeuCasoA = a.tecnico_id === idUsuarioLogado;
    const isMeuCasoB = b.tecnico_id === idUsuarioLogado;

    if (isMeuCasoA && !isMeuCasoB) return -1;
    if (!isMeuCasoA && isMeuCasoB) return 1;

    const termo = termoPesquisa.toLowerCase().trim();
    const nomeA = (a.nome_social || a.nome_completo || '').toLowerCase();
    const nomeB = (b.nome_social || b.nome_completo || '').toLowerCase();

    if (termo) {
      const aComeca = nomeA.startsWith(termo);
      const bComeca = nomeB.startsWith(termo);
      
      if (aComeca && !bComeca) return -1;
      if (!aComeca && bComeca) return 1;
    }

    return nomeA.localeCompare(nomeB);
  });

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

        <ScrollArea>
          <div className="w-full max-w-7xl mx-auto">
          {erro && telaAtual === 'lista' && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm mb-6 font-semibold border border-red-100 flex items-center gap-2">! {erro}</div>}
          {sucesso && <div className="bg-green-50 text-green-700 p-4 rounded-xl text-sm mb-6 font-semibold border border-green-100 flex items-center gap-2">{sucesso}</div>}

          {/* TELA DE LISTAGEM */}
          {telaAtual === 'lista' && (
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-8 border-b pb-4">
                <h2 className="text-2xl font-bold text-gray-800">População Acolhida</h2>
                <button onClick={abrirFormulario} className="bg-brand text-white px-6 py-2.5 rounded-xl hover:bg-brandDark font-semibold transition-all shadow-md transform hover:-translate-y-0.5">
                  + Novo Acolhimento
                </button>
              </div>

              <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 p-5 bg-gray-50/50 rounded-xl border border-gray-200 shadow-inner">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1.5">🔍 Pesquisar Acolhido</label>
                  <input type="text" value={termoPesquisa} onChange={(e) => setTermoPesquisa(e.target.value)} placeholder="Pesquise por Nome ou CPF..." className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand text-sm bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1.5">Status</label>
                  <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none bg-white focus:ring-2 focus:ring-brand text-sm">
                    <option value="Todos">Todos</option><option value="Ativo">Apenas Ativos</option><option value="Inativado">Apenas Inativos</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1.5">Acomodação</label>
                  <select value={filtroLeito} onChange={(e) => setFiltroLeito(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none bg-white focus:ring-2 focus:ring-brand text-sm">
                    <option value="Todos">Todos</option><option value="Com Cama">Com Cama (Fixo/Trans.)</option><option value="Sem Cama">Sem Cama (Centro Dia)</option>
                  </select>
                </div>
              </div>

              {loading ? (
                <div className="flex justify-center p-12"><p className="text-brand font-medium animate-pulse text-lg">Carregando acolhimentos...</p></div>
              ) : conviventesFiltrados.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl"><p className="text-gray-600 text-lg font-medium">Nenhum registro encontrado com estes filtros.</p></div>
              ) : (
                <>
                <div className="space-y-3 md:hidden">
                  {conviventesFiltrados.map((c) => {
                    const isMeuCaso = c.tecnico_id === idUsuarioLogado;
                    return (
                      <article
                        key={c.id}
                        className={`rounded-3xl border p-4 shadow-sm ${isMeuCaso ? 'border-blue-100 bg-blue-50/70' : 'border-slate-100 bg-slate-50'}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-black uppercase tracking-wide text-brand">
                              #{c.numero_institucional || 'Novo'}
                              {isMeuCaso && <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-[9px] text-white">Meu caso</span>}
                            </p>
                            <h3 className="mt-1 truncate text-base font-bold text-slate-900">
                              {c.nome_social || c.nome_completo}
                            </h3>
                            {c.nome_social && (
                              <p className="truncate text-xs text-slate-500">
                                Civil: {c.nome_completo}
                              </p>
                            )}
                          </div>

                          <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase ${c.status === 'Ativo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {c.status}
                          </span>
                        </div>

                        <div className="mt-3 grid gap-2 rounded-2xl bg-white px-3 py-2 text-xs text-slate-600">
                          <p><strong>CPF:</strong> {c.cpf || '-'}</p>
                          <p><strong>Acomodação:</strong> {obterLocalizacaoLeito(c.leito_id)}</p>
                        </div>

                        <button
                          onClick={() => abrirParaEdicao(c)}
                          className="mt-4 min-h-11 w-full rounded-2xl bg-brand px-4 py-2 text-sm font-bold text-white shadow-sm"
                        >
                          Abrir ficha
                        </button>
                      </article>
                    );
                  })}
                </div>

                <div className="hidden overflow-x-auto rounded-xl border border-gray-200 md:block">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-gray-800 text-sm border-b border-gray-200">
                        <th className="p-4 font-medium">Prontuário</th>
                        <th className="p-4 font-medium">Nome Completo / Social</th>
                        <th className="p-4 font-medium">CPF</th>
                        <th className="p-4 font-medium">Acomodação</th>
                        <th className="p-4 font-medium">Status</th>
                        <th className="p-4 font-medium text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {conviventesFiltrados.map((c) => {
                        const isMeuCaso = c.tecnico_id === idUsuarioLogado;
                        return (
                          <tr key={c.id} className={`transition-colors group border-b border-gray-100 last:border-0 ${isMeuCaso ? 'bg-blue-50/30 hover:bg-blue-50/70' : 'hover:bg-gray-50'}`}>
                            {/* COLUNAS QUE EU TINHA APAGADO ACIDENTALMENTE: */}
                            <td className="p-4 text-brand font-bold text-sm">
                              #{c.numero_institucional || 'Novo'}
                              {isMeuCaso && <span className="ml-2 text-[9px] bg-brand text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider" title="Este acolhido está sob a sua responsabilidade">Meu Caso</span>}
                            </td>
                            <td className="p-4">
                              <p className="text-gray-900 font-medium">{c.nome_social || c.nome_completo}</p>
                              {c.nome_social && <p className="text-xs text-gray-500 mt-0.5">Civil: {c.nome_completo}</p>}
                            </td>
                            <td className="p-4 text-gray-600 font-mono text-sm">{c.cpf || '-'}</td>
                            <td className="p-4">{obterLocalizacaoLeito(c.leito_id)}</td>
                            <td className="p-4">
                              <span className={`px-3 py-1.5 rounded-lg text-xs font-medium uppercase tracking-wider ${c.status === 'Ativo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {c.status}
                              </span>
                            </td>
                            {/* FIM DAS COLUNAS RESTAURADAS */}
                            <td className="p-4 text-right flex justify-end gap-2">
                              <button onClick={() => abrirParaEdicao(c)} className="text-brand hover:text-white font-semibold bg-brand/10 hover:bg-brand px-4 py-2 rounded-lg transition-all">
                                Abrir Ficha
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                </>
              )}
            </div>
          )}
{/* === FIM DA SEÇÃO 4 === */}





{/* === INÍCIO DA SEÇÃO 5: CABEÇALHO DO FORMULÁRIO E ABA 1 (PESSOAIS E STATUS) === */}
          {telaAtual === 'form' && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden mb-8">
              
              <div className="bg-gradient-to-r from-slate-950 via-blue-950 to-violet-950 p-5 text-white flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-200">
                    Prontuário institucional
                  </p>
                  <h2 className="mt-1 text-xl font-black tracking-tight">Ficha de admissão institucional</h2>
                  <p className="text-slate-300 text-xs mt-1">Dados assistenciais restritos à instituição e protegidos por perfil de acesso.</p>
                </div>
                
                <div className="flex items-center gap-3">
                  {editandoId && (
                    <button 
                      type="button" 
                      onClick={() => abrirCarteirinha(conviventes.find(c => c.id === editandoId))} 
                      className="bg-white/10 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-white/15 transition-colors flex items-center gap-2 border border-white/15"
                    >
                      Imprimir ID
                    </button>
                  )}
                  <button type="button" onClick={() => setTelaAtual('lista')} className="text-slate-200 hover:text-white text-sm font-bold bg-white/10 px-4 py-2 rounded-xl border border-white/10">Fechar</button>
                </div>
              </div>

              <div className="flex border-b bg-slate-50 overflow-x-auto px-2">
                <button type="button" onClick={() => setAbaAtual('pessoais')} className={`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${abaAtual === 'pessoais' ? 'border-brand text-brand bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/70'}`}>Pessoais e status</button>
                <button type="button" onClick={() => setAbaAtual('social')} className={`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${abaAtual === 'social' ? 'border-brand text-brand bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/70'}`}>Assistência social</button>
                <button type="button" onClick={() => setAbaAtual('historico')} className={`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${abaAtual === 'historico' ? 'border-brand text-brand bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/70'}`}>Histórico</button>
                <button
  type="button"
  onClick={() => setAbaAtual('fluxo')}
  className={`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${
    abaAtual === 'fluxo'
      ? 'border-emerald-500 text-emerald-600 bg-white'
      : 'border-transparent text-slate-500 hover:text-slate-700'
  }`}
>
  Fluxo Diário
</button>
                
                {perfilUsuario !== 'Orientador' && (
                  <>
                    <button type="button" onClick={() => setAbaAtual('saude')} className={`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${abaAtual === 'saude' ? 'border-brand text-brand bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/70'}`}>Saúde e cofre</button>
                    <button type="button" onClick={() => setAbaAtual('sensiveis')} className={`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${abaAtual === 'sensiveis' ? 'border-red-500 text-red-600 bg-red-50/50' : 'border-transparent text-slate-500 hover:text-red-500 hover:bg-red-50/30'}`}>Dados sensíveis</button>
                  </>
                )}

                <button type="button" onClick={() => setAbaAtual('documentos')} className={`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${abaAtual === 'documentos' ? 'border-blue-500 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-blue-600 hover:bg-blue-50/30'}`}>Anexos e GED</button>
              </div>

              <form onSubmit={handleSalvar}>
                <div className="p-5 min-h-[300px]">
                  
                  {abaAtual === 'pessoais' && (
                    <div className="space-y-5 animate-fadeIn">
                      
                      <div className="flex flex-col md:flex-row items-start gap-5 p-4 bg-gray-50 rounded-xl border border-gray-100 shadow-inner">
                        <div className="relative flex-shrink-0 group">
                          <div className="w-24 aspect-[3/4] bg-white border-2 border-gray-300 rounded-md shadow-sm flex items-center justify-center overflow-hidden ring-2 ring-white">
                            {fotoPerfilUrl ? (
                              <AuthenticatedImage caminhoOuUrl={fotoPerfilUrl} alt="Foto Oficial" className="w-full h-full object-cover" />
                            ) : (
                              <div className="flex flex-col items-center justify-center text-gray-300"><span className="text-4xl">○</span><span className="text-[9px] uppercase font-bold mt-1">Sem Foto</span></div>
                            )}
                          </div>
                          {editandoId && (
                            <button type="button" onClick={() => setAbaAtual('documentos')} className="absolute -bottom-2 -right-2 bg-brand text-white rounded-full p-1.5 text-xs hover:bg-brandDark shadow transition-transform hover:scale-110" title="Alterar fotografia">+</button>
                          )}
                        </div>

                        <div className="flex-1 w-full space-y-3">
                          <div><label className="block text-xs font-semibold text-gray-700 mb-1">Nome Civil Completo *</label><input type="text" required name="nome_completo" value={formData.nome_completo} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none text-sm font-medium" /></div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="block text-xs font-semibold text-gray-700 mb-1">Nome Social</label><input type="text" name="nome_social" value={formData.nome_social} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none text-sm" /></div>
                            <div><label className="block text-xs font-bold text-brand mb-1">Técnico de Referência</label><select name="tecnico_id" value={formData.tecnico_id} onChange={handleChange} className="w-full px-3 py-1.5 border border-brand/40 rounded-lg focus:ring-2 focus:ring-brand outline-none bg-white text-sm font-medium text-gray-700"><option value="">Não Definido (Atendimento Geral)</option>{listaTecnicos.map(tec => <option key={tec.id} value={tec.id}>{tec.nome} ({tec.perfil_acesso})</option>)}</select></div>
                          </div>
                        </div>
                      </div>

                      <div className={`p-4 rounded-xl border shadow-sm transition-colors duration-500 ${formData.status === 'Ativo' ? 'bg-blue-50/50 border-blue-100' : 'bg-red-50/50 border-red-200'}`}>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="md:col-span-1">
                            <label className={`block text-xs font-bold mb-1 ${formData.status === 'Ativo' ? 'text-blue-900' : 'text-red-900'}`}>Situação no Abrigo *</label>
                            <select 
                              name="status" 
                              value={formData.status} 
                              onChange={handleChange} 
                              disabled={!podeMudarStatus}
                              className={`w-full px-3 py-1.5 border border-gray-300 rounded-lg outline-none text-sm font-semibold text-gray-800 ${!podeMudarStatus ? 'bg-gray-100 cursor-not-allowed opacity-70' : 'bg-white focus:ring-2 focus:ring-brand'}`}
                            >
                              <option value="Ativo">🟢 Ativo (Presente)</option><option value="Inativado">🔴 Inativado (Evadiu/Alta)</option><option value="Bloqueado">🚫 Bloqueado (Suspensão)</option>
                            </select>
                            {!podeMudarStatus && <p className="text-[9px] text-red-500 font-bold mt-1">Apenas o Gerente ou Técnico Responsável podem alterar.</p>}
                          </div>
                          
                          <div className="md:col-span-1">
                            <label className={`block text-xs font-semibold mb-1 ${formData.status === 'Ativo' ? 'text-blue-900' : 'text-red-900'}`}>Data do Status *</label>
                            <input type="date" name="data_entrada" required value={formData.data_entrada ? formData.data_entrada.split('T')[0] : ''} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none bg-white text-sm" />
                          </div>
                          
                          {/* 🎯 OS DOIS CAMPOS RETORNARAM! Lado a lado e perfeitamente mapeados */}
                          {formData.status !== statusOriginal && (
                            <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-red-200 animate-fadeIn">
                              <div className="md:col-span-1">
                                <label className="block text-xs font-bold text-red-800 mb-1">Motivo Principal *</label>
                                <input type="text" name="motivo_status" list="historico-motivos" value={formData.motivo_status} onChange={handleChange} placeholder="Ex: Evasão, Alta..." className="w-full px-3 py-1.5 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none bg-white text-sm font-medium" />
                                <datalist id="historico-motivos">{historicoMotivos.map((motivo, idx) => <option key={idx} value={motivo} />)}</datalist>
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-red-800 mb-1">Relato Detalhado *</label>
                                <textarea name="relato_status" value={formData.relato_status} onChange={handleChange} rows="2" placeholder="Descreva os detalhes da alteração de status..." className="w-full px-3 py-1.5 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none bg-white text-sm font-medium"></textarea>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div><label className="block text-xs font-semibold text-gray-700 mb-1">CPF</label><input type="text" name="cpf" value={formData.cpf} onChange={handleChange} onBlur={handleBlur} className={`w-full px-3 py-1.5 border rounded-lg outline-none text-sm ${errosValidacao.cpf ? 'border-red-500 focus:ring-red-500 bg-red-50' : 'border-gray-300 focus:ring-brand'}`} placeholder="000.000.000-00" />{errosValidacao.cpf && <p className="text-red-500 text-[10px] mt-0.5 font-bold">{errosValidacao.cpf}</p>}</div>
                        <div><label className="block text-xs font-semibold text-gray-700 mb-1">RG</label><input type="text" name="rg" value={formData.rg} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none text-sm" /></div>
                        <div><label className="block text-xs font-semibold text-gray-700 mb-1">Nascimento {formData.data_nascimento && <span className="ml-1 text-brand font-bold bg-blue-50 px-1.5 py-0.5 rounded-md text-[10px]">{calcularIdade(formData.data_nascimento)} anos</span>}</label><input type="date" name="data_nascimento" value={formData.data_nascimento} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none text-sm" /></div>
                        <div><label className="block text-xs font-semibold text-gray-700 mb-1">Identidade de Gênero</label><select name="identidade_genero" value={formData.identidade_genero} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none bg-white text-sm"><option value="">Selecione...</option><option value="Homem Cisgênero">Homem Cisgênero</option><option value="Mulher Cisgênero">Mulher Cisgênero</option><option value="Homem Transgênero">Homem Transgênero</option><option value="Mulher Transgênero">Mulher Transgênero</option><option value="Não-Binário">Não-Binário</option><option value="Outro">Outro</option></select></div>
                        <div><label className="block text-xs font-semibold text-gray-700 mb-1">Estado Civil</label><select name="estado_civil" value={formData.estado_civil} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none bg-white text-sm"><option value="">Selecione...</option><option value="Solteiro(a)">Solteiro(a)</option><option value="Casado(a)">Casado(a)</option><option value="Divorciado(a)">Divorciado(a)</option><option value="Viúvo(a)">Viúvo(a)</option><option value="União Estável">União Estável</option></select></div>
                        <div><label className="block text-xs font-semibold text-gray-700 mb-1">Telefone / Celular</label><input type="text" name="telefone_celular" value={formData.telefone_celular} onChange={handleChange} onBlur={handleBlur} className={`w-full px-3 py-1.5 border rounded-lg outline-none text-sm ${errosValidacao.telefone_celular ? 'border-red-500 focus:ring-red-500 bg-red-50' : 'border-gray-300 focus:ring-brand'}`} placeholder="(00) 00000-0000" />{errosValidacao.telefone_celular && <p className="text-red-500 text-[10px] mt-0.5 font-bold">{errosValidacao.telefone_celular}</p>}</div>
                        <div className="lg:col-span-3"><label className="block text-xs font-bold text-brand mb-1">Alocação de Quarto / Cama</label><select name="leito_id" value={formData.leito_id} onChange={handleChange} className="w-full px-3 py-1.5 border border-brand/50 rounded-lg outline-none bg-white focus:ring-2 focus:ring-brand text-sm"><option value="">Apenas Convivência Diurna (Sem Pernoite)</option>{quartos.map(q => <optgroup key={q.id} label={`${q.nome} - [${q.tipo_publico} / ${q.modalidade === 'Transitorio' ? 'Transitório' : 'Fixo'}]`}>{q.leitos?.map(l => {if (l.status === 'Livre' || l.id === formData.leito_id) {return <option key={l.id} value={l.id}>{l.identificacao} {l.id === formData.leito_id ? ' (Cama Atual)' : ' (Livre)'}</option>;}return null;})}</optgroup>)}</select></div>
                      </div>

                      <div className="pt-4 border-t border-gray-200">
                        <h3 className="text-sm font-bold text-brand mb-3">Endereço</h3>
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                          <div className="md:col-span-2"><label className="block text-xs font-semibold text-gray-700 mb-1">CEP</label><input type="text" name="cep" value={formData.cep} onChange={handleChange} onBlur={handleBlur} className={`w-full px-3 py-1.5 border rounded-lg outline-none text-sm ${errosValidacao.cep ? 'border-red-500 focus:ring-red-500 bg-red-50' : 'border-gray-300 focus:ring-brand'}`} placeholder="00000-000" /></div>
                          <div className="md:col-span-3"><label className="block text-xs font-semibold text-gray-700 mb-1">Rua / Logradouro</label><input type="text" name="logradouro" value={formData.logradouro} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none text-sm" /></div>
                          <div className="md:col-span-1"><label className="block text-xs font-semibold text-gray-700 mb-1">Número</label><input type="text" name="numero" value={formData.numero} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none text-sm" /></div>
                          <div className="md:col-span-2"><label className="block text-xs font-semibold text-gray-700 mb-1">Complemento</label><input type="text" name="complemento" value={formData.complemento} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none text-sm" /></div>
                          <div className="md:col-span-2"><label className="block text-xs font-semibold text-gray-700 mb-1">Bairro</label><input type="text" name="bairro" value={formData.bairro} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none text-sm" /></div>
                          <div className="md:col-span-1"><label className="block text-xs font-semibold text-gray-700 mb-1">Cidade</label><input type="text" name="cidade" value={formData.cidade} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none text-sm" /></div>
                          <div className="md:col-span-1"><label className="block text-xs font-semibold text-gray-700 mb-1">UF</label><select name="uf" value={formData.uf} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none bg-white text-sm"><option value="">--</option><option value="AC">AC</option><option value="AL">AL</option><option value="AP">AP</option><option value="AM">AM</option><option value="BA">BA</option><option value="CE">CE</option><option value="DF">DF</option><option value="ES">ES</option><option value="GO">GO</option><option value="MA">MA</option><option value="MT">MT</option><option value="MS">MS</option><option value="MG">MG</option><option value="PA">PA</option><option value="PB">PB</option><option value="PR">PR</option><option value="PE">PE</option><option value="PI">PI</option><option value="RJ">RJ</option><option value="RN">RN</option><option value="RS">RS</option><option value="RO">RO</option><option value="RR">RR</option><option value="SC">SC</option><option value="SP">SP</option><option value="SE">SE</option><option value="TO">TO</option></select></div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <div><label className="block text-xs font-semibold text-gray-700 mb-1">Nome da Mãe</label><input type="text" name="nome_mae" value={formData.nome_mae} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none text-sm" /></div>
                        <div><label className="block text-xs font-semibold text-gray-700 mb-1">Nome do Pai</label><input type="text" name="nome_pai" value={formData.nome_pai} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none text-sm" /></div>
                      </div>
                    </div>
                  )}
{/* === FIM DA SEÇÃO 5 === */}





{/* === INÍCIO DA SEÇÃO 6: DEMAIS ABAS, MODAL E FUNÇÕES AUXILIARES === */}
                  {abaAtual === 'historico' && (
                    <div className="space-y-5 animate-fadeIn">
                      {!editandoId ? (
                        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 text-center">
                          <h3 className="text-sm font-bold text-yellow-800">Ação Necessária</h3>
                          <p className="text-xs text-yellow-700 mt-1">Salve os dados do acolhido para habilitar a Linha do Tempo e o Histórico de Ocorrências.</p>
                        </div>
                      ) : loadingOcorrencias ? (
                        <div className="flex justify-center p-8"><p className="text-brand font-bold animate-pulse text-sm">Carregando linha do tempo...</p></div>
                      ) : ocorrencias.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl">
                          <p className="text-gray-500 text-sm font-medium">Nenhuma ocorrência registrada no prontuário até o momento.</p>
                        </div>
                      ) : (
                        <div className="relative border-l-2 border-gray-200 ml-3 md:ml-6 space-y-6">
                          {ocorrencias.map((ocorrencia, idx) => (
                            <div key={ocorrencia.id || idx} className="relative pl-6">
                              <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-brand border-4 border-white shadow"></div>
                              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2 gap-2">
                                  <span className="text-[10px] font-bold bg-blue-50 text-brand px-2 py-1 rounded-md uppercase tracking-wider">{ocorrencia.tipo_ocorrencia}</span>
                                  <span className="text-[11px] font-semibold text-gray-500">
                                    {new Date(ocorrencia.data_ocorrencia).toLocaleString('pt-BR')}
                                  </span>
                                </div>
                                <h4 className="text-sm font-bold text-gray-800 mb-1">{ocorrencia.motivo}</h4>
                                <p className="text-xs text-gray-600 mb-3 bg-gray-50 p-3 rounded-lg border border-gray-100">{ocorrencia.descricao}</p>
                                {ocorrencia.requer_acao_tecnica && (
                                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase ${ocorrencia.status_resolucao === 'Pendente' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                      Técnico: {ocorrencia.status_resolucao}
                                    </span>
                                    {ocorrencia.parecer_tecnico && (
                                      <p className="text-[11px] text-gray-500 flex-1 ml-3 truncate">Parecer: {ocorrencia.parecer_tecnico}</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {abaAtual === 'fluxo' && (
  <div className="space-y-5 animate-fadeIn">

    {!editandoId ? (

      <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 text-center">
        <h3 className="text-sm font-bold text-yellow-800">
          Ação Necessária
        </h3>

        <p className="text-xs text-yellow-700 mt-1">
          Salve os dados do acolhido para habilitar o histórico de fluxo.
        </p>
      </div>

    ) : loadingHistoricoFluxo ? (

      <div className="flex justify-center p-8">
        <p className="text-emerald-600 font-bold animate-pulse text-sm">
          Carregando histórico de fluxo...
        </p>
      </div>

    ) : historicoFluxo.length === 0 ? (

      <div className="text-center py-12 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl">
        <p className="text-gray-500 text-sm font-medium">
          Nenhum registro de fluxo encontrado.
        </p>
      </div>

    ) : (

      <div className="space-y-4">

        {historicoFluxo.map((registro, idx) => (

          <div
            key={registro.id || idx}
            className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
          >

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">

              <div>

                <div className="flex items-center gap-2 flex-wrap">

                  <span
                    className={`
                      px-3 py-1 rounded-full text-xs font-black border
                      ${
                        registro.tipo_registro === 'Entrada'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : registro.tipo_registro === 'Saída'
                            ? 'bg-orange-50 text-orange-700 border-orange-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                      }
                    `}
                  >
                    {registro.tipo_registro}
                  </span>

                  {registro.foi_editado && (
                    <span className="px-2 py-1 rounded-full text-[10px] font-black bg-yellow-100 text-yellow-800 border border-yellow-300">
                      EDITADO
                    </span>
                  )}

                  {registro.cancelado && (
                    <span className="px-2 py-1 rounded-full text-[10px] font-black bg-red-100 text-red-700 border border-red-300">
                      CANCELADO
                    </span>
                  )}

                </div>

                <p className="text-sm text-gray-700 mt-3">
                  Registrado por:
                  <span className="font-bold ml-1">
                    {registro.usuario_nome}
                  </span>
                </p>

                <p className="text-xs text-gray-500 mt-1">
                  Perfil: {registro.usuario_perfil}
                </p>

              </div>

              <div className="text-right">

                <p className="text-sm font-bold text-gray-800">
                  {new Date(registro.data_registro).toLocaleString('pt-BR')}
                </p>

              </div>

            </div>

          </div>

        ))}

      </div>

    )}

  </div>
)}

                  {abaAtual === 'social' && (
                    <div className="space-y-5 animate-fadeIn">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label className="block text-xs font-semibold text-gray-700 mb-1">Número NIS</label><input type="text" name="numero_nis" value={formData.numero_nis} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg outline-none text-sm" /></div>
                        <div><label className="block text-xs font-semibold text-gray-700 mb-1">Número SISA</label><input type="text" name="numero_sisa" value={formData.numero_sisa} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg outline-none text-sm" /></div>
                        <div><label className="block text-xs font-semibold text-gray-700 mb-1">Status CadÚnico</label><select name="status_cadunico" value={formData.status_cadunico} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg outline-none bg-white text-sm"><option value="">Selecione...</option><option value="Atualizado">Atualizado</option><option value="Desatualizado">Desatualizado</option><option value="Não Possui">Não Possui</option></select></div>
                        <div className="md:col-span-3"><label className="block text-xs font-semibold text-gray-700 mb-1">Programas / Benefícios Ativos</label><textarea name="programas_beneficios" value={formData.programas_beneficios} onChange={handleChange} rows="2" className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none text-sm" placeholder="Ex: Bolsa Família, BPC..."></textarea></div>
                        <div className="md:col-span-3 p-3 bg-green-50 rounded-lg border border-green-100 flex flex-col md:flex-row items-center gap-4"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" name="possui_renda" checked={formData.possui_renda} onChange={handleChange} className="w-4 h-4 text-brand rounded focus:ring-brand" /><span className="text-sm font-semibold text-green-900">Possui Renda Fixa/Mensal?</span></label>{formData.possui_renda && (<div className="flex-1 w-full"><label className="block text-[10px] font-bold text-green-800 uppercase mb-1">Valor da Renda (R$)</label><input type="number" name="renda_mensal" value={formData.renda_mensal} onChange={handleChange} className="w-full md:w-1/3 px-3 py-1.5 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm" placeholder="0.00" /></div>)}</div>
                      </div>
                    </div>
                  )}

                  {abaAtual === 'saude' && (
                    <div className="space-y-6 animate-fadeIn">
                      <div>
                        <h3 className="text-sm font-bold text-brand border-b pb-2 mb-3">Saúde & Emergência</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div><label className="block text-xs font-semibold text-gray-700 mb-1">Contato de Emergência (Nome)</label><input type="text" name="contato_emergencia_nome" value={formData.contato_emergencia_nome} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg outline-none text-sm" /></div>
                          <div><label className="block text-xs font-semibold text-gray-700 mb-1">Telefone de Emergência</label><input type="text" name="contato_emergencia_telefone" value={formData.contato_emergencia_telefone} onChange={handleChange} onBlur={handleBlur} className={`w-full px-3 py-1.5 border rounded-lg outline-none text-sm ${errosValidacao.contato_emergencia_telefone ? 'border-red-500 focus:ring-red-500 bg-red-50' : 'border-gray-300 focus:ring-brand'}`} placeholder="(00) 0000-0000" />{errosValidacao.contato_emergencia_telefone && <p className="text-red-500 text-[10px] mt-0.5 font-bold">{errosValidacao.contato_emergencia_telefone}</p>}</div>
                          <div className="md:col-span-2"><label className="block text-xs font-semibold text-gray-700 mb-1">Observações Médicas</label><textarea name="observacoes_saude" value={formData.observacoes_saude} onChange={handleChange} rows="2" className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none text-sm"></textarea></div>
                        </div>
                      </div>
                      <div className="bg-gray-800 p-4 rounded-xl text-white shadow-inner">
                        <h3 className="text-sm font-bold mb-3">🔐 Cofre de Senhas</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div><label className="block text-xs text-gray-300 mb-1">E-mail Pessoal</label><input type="email" name="email_pessoal" value={formData.email_pessoal} onChange={handleChange} onBlur={handleBlur} className={`w-full px-3 py-1.5 bg-gray-700 border rounded-lg text-white text-sm outline-none ${errosValidacao.email_pessoal ? 'border-red-500 focus:ring-red-500' : 'border-gray-600 focus:ring-brand'}`} placeholder="usuario@email.com" />{errosValidacao.email_pessoal && <p className="text-red-400 text-[10px] mt-0.5 font-bold">{errosValidacao.email_pessoal}</p>}</div>
                          <div>
                            <label className="block text-xs text-gray-300 mb-1">Senha E-mail</label>
                            <div className="flex gap-2">
                              <input type={mostrarSenhaEmail ? 'text' : 'password'} autoComplete="new-password" name="senha_email" value={formData.senha_email} onChange={handleChange} className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm" />
                              <button type="button" onClick={() => setMostrarSenhaEmail(v => !v)} className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-xs font-bold text-gray-200 hover:bg-gray-600" title={mostrarSenhaEmail ? 'Ocultar senha' : 'Mostrar senha'}>{mostrarSenhaEmail ? 'Ocultar' : 'Mostrar'}</button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs text-blue-300 font-bold mb-1">Senha GOV.BR</label>
                            <div className="flex gap-2">
                              <input type={mostrarSenhaGovbr ? 'text' : 'password'} autoComplete="new-password" name="senha_govbr" value={formData.senha_govbr} onChange={handleChange} className="w-full px-3 py-1.5 bg-gray-700 border border-blue-500/50 rounded-lg text-white text-sm" />
                              <button type="button" onClick={() => setMostrarSenhaGovbr(v => !v)} className="px-3 py-1.5 bg-gray-700 border border-blue-500/50 rounded-lg text-xs font-bold text-blue-100 hover:bg-gray-600" title={mostrarSenhaGovbr ? 'Ocultar senha' : 'Mostrar senha'}>{mostrarSenhaGovbr ? 'Ocultar' : 'Mostrar'}</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {abaAtual === 'sensiveis' && (
                    <div className="space-y-5 animate-fadeIn">
                      <div className="bg-red-50 p-4 rounded-xl border border-red-200">
                        <h3 className="text-sm font-bold text-red-800 mb-4">Acesso restrito</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div className="space-y-3 bg-white p-3 rounded-lg shadow-sm border border-red-100"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" name="egresso_prisional" checked={formData.egresso_prisional} onChange={handleChange} className="w-5 h-5 text-red-600 rounded focus:ring-red-500" /><span className="text-sm font-semibold text-gray-800">É Egresso Prisional?</span></label><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" name="usa_tornozeleira" checked={formData.usa_tornozeleira} onChange={handleChange} className="w-5 h-5 text-red-600 rounded focus:ring-red-500" /><span className="text-sm font-semibold text-gray-800">Usa Tornozeleira Eletrônica?</span></label></div>
                          <div className="space-y-3"><div><label className="block text-xs font-semibold text-red-900 mb-1">Acompanhamento CAPS</label><input type="text" name="acompanhamento_caps" value={formData.acompanhamento_caps} onChange={handleChange} className="w-full px-3 py-1.5 border border-red-200 rounded-lg outline-none bg-white text-sm" /></div><div><label className="block text-xs font-semibold text-red-900 mb-1">Medidas Protetivas</label><input type="text" name="medidas_protetivas" value={formData.medidas_protetivas} onChange={handleChange} className="w-full px-3 py-1.5 border border-red-200 rounded-lg outline-none bg-white text-sm" /></div></div>
                          <div className="md:col-span-2"><label className="block text-xs font-semibold text-red-900 mb-1">Uso de Substâncias Psicoativas</label><textarea name="uso_substancias" value={formData.uso_substancias} onChange={handleChange} rows="2" className="w-full px-3 py-1.5 border border-red-200 rounded-lg outline-none bg-white text-sm"></textarea></div>
                          <div className="md:col-span-2"><label className="block text-xs font-semibold text-red-900 mb-1">Transtornos Mentais</label><textarea name="transtorno_mental" value={formData.transtorno_mental} onChange={handleChange} rows="2" className="w-full px-3 py-1.5 border border-red-200 rounded-lg outline-none bg-white text-sm"></textarea></div>
                        </div>
                      </div>
                    </div>
                  )}

                  {abaAtual === 'documentos' && (
                    <div className="space-y-5 animate-fadeIn">
                      {!editandoId ? (
                        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 text-center"><h3 className="text-sm font-bold text-yellow-800">Ação Necessária</h3><p className="text-xs text-yellow-700 mt-1">Salve os dados do acolhido para liberar o envio de documentos.</p></div>
                      ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                          <div className="lg:col-span-1 bg-gray-50 p-4 rounded-xl border border-gray-200 h-fit">
                            <h3 className="text-xs font-semibold text-gray-700 uppercase mb-3">Novo Documento ou Foto</h3>
                            <div className="space-y-3">
                              <select value={tipoDocumentoSelecionado} onChange={(e) => setTipoDocumentoSelecionado(e.target.value)} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg outline-none bg-white text-sm"><option value="Foto de Perfil">Foto de Perfil</option><option value="RG / CPF">RG / CPF</option><option value="CadÚnico">CadÚnico</option><option value="Outros">Outros</option></select>
                              <div className="pt-2 border-t border-gray-200">
                                {!deviceInfo.isSecureCameraContext && (
                                  <p className="mb-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                                    No celular, a captura direta pode ser bloqueada em endereço local. Use a câmera/galeria abaixo.
                                  </p>
                                )}
                                <button type="button" onClick={abrirCamera} className="w-full mb-2 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold">
                                  {deviceInfo.isTouchDevice ? 'Abrir câmera' : 'Tirar foto (webcam)'}
                                </button>
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture={deviceInfo.isTouchDevice ? 'environment' : undefined}
                                  onChange={(e) => setArquivoSelecionado(e.target.files[0])}
                                  className="w-full text-xs text-gray-500"
                                />
                              </div>
                              <button type="button" onClick={handleUploadDocumento} disabled={loadingDocs || !arquivoSelecionado} className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">{loadingDocs ? 'Enviando...' : 'Fazer upload'}</button>
                            </div>
                          </div>
                          <div className="lg:col-span-2">
                            <h3 className="text-xs font-semibold text-gray-700 uppercase mb-3">Arquivos do Acolhido ({documentos.length})</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {documentos.map(doc => (
                                <div key={doc.id} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                                  <div className="flex items-start gap-2 w-full"><span className="text-2xl flex-shrink-0">{doc.tipo_documento === 'Foto de Perfil' ? '○' : '▤'}</span><div className="flex-1 min-w-0"><h4 className="text-xs font-bold text-gray-800 truncate block w-full">{doc.nome_arquivo}</h4><p className="text-[10px] text-brand font-semibold truncate">{doc.tipo_documento}</p></div></div>
                                  <div className="mt-3 pt-2 border-t border-gray-100 flex gap-2 justify-end"><button type="button" onClick={() => baixarArquivoAutenticado(doc.caminho_arquivo, doc.nome_arquivo)} className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100">Baixar</button><button type="button" onClick={() => handleExcluirDocumento(doc.id)} className="text-[10px] font-bold bg-red-50 text-red-600 px-2 py-1 rounded hover:bg-red-100">Excluir</button></div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="bg-gray-100 p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4 rounded-b-xl">
                  <div className="flex-1 w-full text-left">{erro && telaAtual === 'form' && (<span className="text-red-600 font-bold text-xs bg-red-100 px-3 py-1.5 rounded flex items-center w-fit animate-pulse shadow-sm">! {erro}</span>)}</div>
                  <div className="flex gap-3 w-full sm:w-auto"><button type="button" onClick={() => setTelaAtual('lista')} className="px-5 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors">Cancelar</button><button type="submit" className="px-6 py-2 bg-brand text-white rounded-lg text-sm font-bold hover:bg-brandDark shadow transition-all">{editandoId ? 'Atualizar prontuário' : 'Salvar prontuário'}</button></div>
                </div>
              </form>
            </div>
          )}
          </div>
        </ScrollArea>

      {/* --- MODAL DA CARTEIRINHA DE IDENTIFICAÇÃO (TAMANHO RG MILIMÉTRICO) --- */}
{carteirinhaAberta && (() => {
  let nomeAcomodacao = 'Sem Cama (Centro Dia)';
  let tipoAcomodacao = '-';

  if (carteirinhaAberta.leito_id) {
    for (let q of quartos) {
      const leito = q.leitos?.find(l => l.id === carteirinhaAberta.leito_id);

      if (leito) {
        nomeAcomodacao = `${q.nome} - ${leito.identificacao}`;
        tipoAcomodacao = q.modalidade === 'Transitorio' ? 'Transitório' : 'Fixo';
        break;
      }
    }
  }

  const codigoBarrasValor = carteirinhaAberta.numero_institucional
    ? String(carteirinhaAberta.numero_institucional)
    : (
        carteirinhaAberta.cpf
          ? carteirinhaAberta.cpf.replace(/\D/g, '')
          : carteirinhaAberta.id.substring(0, 8)
      );

  const dataEntradaFormatada = carteirinhaAberta.data_entrada
    ? new Date(carteirinhaAberta.data_entrada).toLocaleDateString('pt-BR')
    : 'Não informada';

  const acomodacaoEhTransitoria = tipoAcomodacao === 'Transitório';

  const tecnicoResponsavel = listaTecnicos.find(
    tec => tec.id === carteirinhaAberta.tecnico_id
  );

  return (
    <div className="fixed inset-0 bg-gray-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm print:bg-white print:p-0">
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col max-w-sm w-full overflow-hidden print:shadow-none print:max-w-none">

        <div
          id="area-cracha"
          className="bg-white relative overflow-hidden print:border-none border-2 border-gray-200 mx-auto"
          style={{ width: '70mm', height: '100mm' }}
        >

          <div className="bg-brand text-white text-center py-1.5">
            <h2 className="font-black text-[15px] uppercase tracking-widest leading-none">
              CARECORE+
            </h2>
            <p className="text-[6px] font-medium uppercase tracking-widest opacity-80 mt-0.5">
              Identidade Institucional
            </p>
          </div>

          <div className="p-2.5 flex flex-col h-[calc(100mm-32px)]">

            <div className="flex justify-between items-start gap-2 mb-1.5">
              <div className="w-[22mm] h-[28mm] bg-gray-100 border border-gray-300 rounded overflow-hidden flex items-center justify-center flex-shrink-0">
                {fotoCarteirinha ? (
                  <AuthenticatedImage
                    caminhoOuUrl={fotoCarteirinha}
                    alt="Foto"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-2xl opacity-20">○</span>
                )}
              </div>

              <div className="flex-1 flex flex-col items-center justify-center bg-white border border-gray-200 rounded p-1">
                <QRCode
                  value={carteirinhaAberta.id}
                  size={64}
                  level="M"
                />
                <span className="text-[6px] text-gray-400 font-mono mt-1">
                  Escanear ID
                </span>
              </div>
            </div>

            <div className="space-y-1 mb-1.5">
              <h3 className="font-black text-[11.5px] text-gray-900 uppercase leading-tight line-clamp-2">
                {carteirinhaAberta.nome_social || carteirinhaAberta.nome_completo}
              </h3>

              <div className="grid grid-cols-2 gap-1 text-[8px] text-gray-700 font-mono bg-gray-50 p-1.5 rounded border border-gray-100">
                <p>
                  <span className="font-bold text-gray-500">PRONT:</span>{' '}
                  #{carteirinhaAberta.numero_institucional || 'S/N'}
                </p>

                <p>
                  <span className="font-bold text-gray-500">SISA:</span>{' '}
                  {carteirinhaAberta.numero_sisa || 'S/N'}
                </p>

                <p className="col-span-2">
                  <span className="font-bold text-gray-500">CPF:</span>{' '}
                  {carteirinhaAberta.cpf || 'Não inf.'}
                </p>

                <p className="col-span-2">
                  <span className="font-bold text-gray-500">ENTRADA:</span>{' '}
                  {dataEntradaFormatada}
                </p>

                <p className="col-span-2 truncate">
                  <span className="font-bold text-gray-500">TÉCNICO:</span>{' '}
                  {tecnicoResponsavel?.nome || 'Não vinculado'}
                </p>
              </div>
            </div>

            <div
              className={`
                p-1.5 rounded text-[7.5px] mb-2 border
                ${
                  acomodacaoEhTransitoria
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-blue-50/50 border-blue-100'
                }
              `}
            >
              <p
                className={`
                  font-bold uppercase mb-0.5
                  ${
                    acomodacaoEhTransitoria
                      ? 'text-amber-700'
                      : 'text-brand'
                  }
                `}
              >
                Acomodação Atual
              </p>

              <p className="text-gray-800 font-semibold truncate text-[8.5px]">
                {nomeAcomodacao}
              </p>

              <p
                className={`
                  font-bold uppercase mt-0.5
                  ${
                    acomodacaoEhTransitoria
                      ? 'text-amber-700'
                      : 'text-blue-600'
                  }
                `}
              >
                Tipo: {tipoAcomodacao}
              </p>
            </div>

            <div className="mt-auto w-full bg-white pt-1">
              <div className="text-center mb-1">
                <p className="text-[6px] uppercase tracking-widest text-gray-400 font-bold">
                  Identificação de Acesso
                </p>
              </div>

              <div
                className="flex justify-center overflow-visible"
                style={{ lineHeight: 0 }}
              >
                <Barcode
                  value={codigoBarrasValor}
                  width={1.2}
                  height={18}
                  margin={0}
                  displayValue={false}
                  background="transparent"
                />
              </div>

              <div className="text-center mt-0.5">
                <p className="text-[7px] tracking-[2px] font-mono text-gray-700 leading-none">
                  {codigoBarrasValor}
                </p>
              </div>
            </div>

          </div>
        </div>

        <div className="p-4 bg-gray-100 flex justify-between gap-3 print:hidden border-t">
          <button
            onClick={() => setCarteirinhaAberta(null)}
            className="px-4 py-2 bg-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-400 transition-colors w-full text-sm"
          >
            Cancelar
          </button>

          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-brand text-white font-bold rounded-lg hover:bg-brandDark transition-colors w-full flex justify-center items-center gap-2 shadow-md text-sm"
          >
            Imprimir RG
          </button>
        </div>

      </div>
    </div>
  );
})()}

      {/* --- MODAL DA WEBCAM --- */}
      {cameraAberta && (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl max-w-2xl w-full flex flex-col items-center">
            <h3 className="text-xl font-semibold mb-2">Capturar foto de perfil</h3>
            <div className="w-full bg-black rounded-lg overflow-hidden flex justify-center mb-6 relative"><video ref={videoRef} autoPlay playsInline className="w-full max-h-[60vh] object-cover"></video><canvas ref={canvasRef} className="hidden"></canvas></div>
            <div className="flex gap-4 w-full"><button type="button" onClick={fecharCamera} className="flex-1 py-3 bg-gray-200 font-semibold rounded-xl hover:bg-gray-300 transition-colors">Cancelar</button><button type="button" onClick={capturarFoto} className="flex-1 py-3 bg-brand text-white font-semibold rounded-xl hover:bg-brandDark transition-colors shadow-lg">Capturar e salvar</button></div>
          </div>
        </div>
      )}
      </MainShell>
    </AppShell>
  );
}
// === FIM DO ARQUIVO ===