// =====================================================================
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import Sidebar from './Sidebar';
import { exportarRelatorioXlsx } from './utils/exportarRelatorioXlsx';
import { imprimirRelatorio } from './utils/imprimirRelatorio';
import { API_ROOT } from './config/apiBase';
import { BadgePrioridadeOcorrencia } from './components/OcorrenciasUI';
import {
  PRIORIDADES_OCORRENCIA,
  classesPrioridade,
  filtrarOcorrencias,
  montarRelatorioOcorrencias,
  normalizarPrioridade,
  ordenarOcorrencias,
  resumirPrioridadesOcorrencias,
} from './utils/ocorrenciasUtils';


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
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  
  const [chamadoSelecionado, setChamadoSelecionado] = useState(null);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [encerrarChamado, setEncerrarChamado] = useState(false);

  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [listaConviventes, setListaConviventes] = useState([]);
  const [listaEquipe, setListaEquipe] = useState([]);
  const [enviandoNovo, setEnviandoNovo] = useState(false);

  const [buscaPaciente, setBuscaPaciente] = useState('');
  const [mostrarDropdownPaciente, setMostrarDropdownPaciente] = useState(false);

  const [filtroPrioridade, setFiltroPrioridade] = useState(searchParams.get('prioridade') || 'Todas');
  const [filtroStatus, setFiltroStatus] = useState(searchParams.get('status') || 'Todos');

  const [selecionados, setSelecionados] = useState([]);
  const [baixandoLote, setBaixandoLote] = useState(false);

  const estadoNovoChamado = {
    convivente_id: '',
    tipo_ocorrencia: 'Comportamental',
    motivo: '',
    descricao: '',
    requer_acao_tecnica: false,
    prioridade: 'Média',
    observadores_ids: []
  };
  const [formNovo, setFormNovo] = useState(estadoNovoChamado);

  useEffect(() => {
    if (!token) { navigate('/'); return; }
    carregarOcorrencias();
    carregarDadosFormularioNovo();
  }, [token]);

  const carregarOcorrencias = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_ROOT}/ocorrencias`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOcorrencias(response.data);
      setSelecionados([]);
    } catch {
      setErro('Erro ao carregar a fila de ocorrências.');
    } finally {
      setLoading(false);
    }
  };

  const carregarDadosFormularioNovo = async () => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const [resConv, resEquipe] = await Promise.all([
        axios.get(`${API_ROOT}/conviventes`, config),
        axios.get(`${API_ROOT}/tecnicos`, config) 
      ]);
      setListaConviventes(resConv.data);
      setListaEquipe(resEquipe.data.filter(u => u.id !== idUsuarioLogado)); 
    } catch (error) {
      console.error("Erro ao carregar dados complementares", error);
    }
  };

  const ocorrenciasFiltradas = filtrarOcorrencias(ocorrencias, filtroPrioridade, filtroStatus);
  const ocorrenciasOrdenadas = ordenarOcorrencias(ocorrenciasFiltradas, idUsuarioLogado);
  const resumoPrioridades = resumirPrioridadesOcorrencias(ocorrencias);
  const relatorioOcorrencias = montarRelatorioOcorrencias(ocorrencias, ocorrenciasFiltradas);

  const montarDadosRelatorioOcorrencias = () => {
    return (Array.isArray(ocorrenciasFiltradas) ? ocorrenciasFiltradas : []).map((oc) => {
      const paciente = listaConviventes.find((c) => c.id === oc.convivente_id);
      const nomePaciente = paciente ? (paciente.nome_social || paciente.nome_completo) : "-";

      return {
        Data: oc.data_ocorrencia ? new Date(oc.data_ocorrencia).toLocaleString("pt-BR") : "-",
        Convivente: nomePaciente,
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

  const abrirRelatorioImpressaoOcorrencias = () => {
    imprimirRelatorio({
      titulo: "Relatório de Ocorrências",
      subtitulo: `Prioridade: ${filtroPrioridade} | Status: ${filtroStatus} | Total filtrado: ${relatorioOcorrencias.filtrado.total} | Pendentes: ${relatorioOcorrencias.filtrado.pendentes}`,
      colunas: colunasRelatorioOcorrencias,
      dados: montarDadosRelatorioOcorrencias(),
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
            headers: { Authorization: `Bearer ${token}` }
          })
        )
      );

      await carregarOcorrencias();
      alert("✅ Baixa em lote concluída com sucesso!");
    } catch {
      alert("Ocorreu um erro ao tentar dar baixa em alguns chamados. A tela será recarregada.");
      carregarOcorrencias();
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
    carregarOcorrencias();
  };

  const abrirFormularioNovo = () => {
    setFormNovo(estadoNovoChamado);
    setBuscaPaciente('');
    setMostrarDropdownPaciente(false);
    setModalNovoAberto(true);
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
    if (!formNovo.convivente_id || !formNovo.motivo.trim() || !formNovo.descricao.trim()) {
      alert("Preencha o acolhido, o título e a descrição da ocorrência.");
      return;
    }

    setEnviandoNovo(true);
    try {
      const paciente = listaConviventes.find(c => c.id === formNovo.convivente_id);
      const payload = {
        ...formNovo,
        tecnico_responsavel_id: paciente?.tecnico_id || null
      };

      await axios.post(`${API_ROOT}/ocorrencias`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setModalNovoAberto(false);
      carregarOcorrencias();
    } catch {
      alert('Erro ao criar o chamado. Verifique a conexão com o servidor.');
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
        headers: { Authorization: `Bearer ${token}` }
      });

      await carregarOcorrencias();
      
      if (encerrarChamado) {
        fecharChamado();
      } else {
        setNovaMensagem('');
        const response = await axios.get(`${API_ROOT}/ocorrencias`, { headers: { Authorization: `Bearer ${token}` } });
        setOcorrencias(response.data);
        setChamadoSelecionado(response.data.find(o => o.id === chamadoSelecionado.id));
      }
    } catch {
      alert('Erro ao enviar a mensagem.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex relative">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto pb-24">
        <header className="bg-white shadow-sm border-b px-8 py-5 flex justify-between items-center sticky top-0 z-10">
          <div>
            <h1 className="text-xl font-bold text-gray-800">
              {perfilUsuario === 'Orientador' ? 'Minhas Ocorrências' : 'Central de Ocorrências'}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">Gestão de chamados e andamento de casos</p>
          </div>
          
          <button 
            onClick={abrirFormularioNovo}
            className="bg-brand text-white px-5 py-2.5 rounded-xl hover:bg-brandDark font-bold transition-all shadow-md transform hover:-translate-y-0.5"
          >
            + Novo Chamado
          </button>
        </header>

        <main className="flex-1 p-8 w-full max-w-7xl mx-auto">
          {erro && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm mb-6 font-semibold border border-red-100">{erro}</div>}


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
                <button
                  type="button"
                  onClick={exportarRelatorioOcorrenciasXLSX}
                  className="px-4 py-2 rounded-xl bg-brand text-white text-xs font-black hover:bg-brandDark"
                >
                  Exportar XLSX
                </button>

                <button
                  type="button"
                  onClick={abrirRelatorioImpressaoOcorrencias}
                  className="px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-black hover:bg-black"
                >
                  Relatório para impressão
                </button>
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
                {ocorrenciasOrdenadas.map(oc => {
                  const isResolvido = oc.status_resolucao === 'Resolvido';
                  const isMeuCaso = oc.tecnico_responsavel_id === idUsuarioLogado;
                  
                  const temPermissaoBaixa = !isResolvido && (isGestor || (perfilUsuario === 'Técnico' && isMeuCaso));

                  const paciente = listaConviventes.find(c => c.id === oc.convivente_id);
                  const nomePaciente = paciente ? (paciente.nome_social || paciente.nome_completo) : 'Acolhido não encontrado';
                  
                  // 🎯 Adicionando Prontuário e CPF na listagem principal
                  const prontuarioInfo = paciente?.numero_institucional ? `#${paciente.numero_institucional}` : 'S/N';
                  const cpfInfo = paciente?.cpf || 'Não informado';

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
                              👤 {nomePaciente} 
                              <span className="text-[10px] text-gray-400 font-medium normal-case tracking-normal ml-1 hidden md:inline">
                                | Prontuário: {prontuarioInfo} | CPF: {cpfInfo}
                              </span>
                            </span>
                            {isMeuCaso && !isResolvido && (
                              <span className="text-[9px] bg-brand text-white px-2 py-0.5 rounded-full uppercase font-bold shadow-sm flex-shrink-0">
                                Sua Ação
                              </span>
                            )}
                          </div>
                          
                          <h3 className="font-bold text-gray-800 text-sm truncate mb-0.5">{oc.motivo}</h3>
                          <p className="text-xs text-gray-500 truncate">{oc.descricao}</p>
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
                          {oc.observadores?.length > 0 && <span title="Pessoas copiadas">👥 {oc.observadores.length}</span>}
                          <span title="Comentários/Interações">💬 {oc.interacoes?.length || 0}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* 🚀 BARRA FLUTUANTE DE BAIXA EM LOTE */}
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
            {baixandoLote ? 'Processando...' : '✅ Encerrar Chamados'}
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
        <div className="fixed inset-0 bg-gray-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            
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

                  // 🎯 Adicionando Prontuário e CPF dentro do cabeçalho do Modal
                  const pProntuario = pModal.numero_institucional ? `#${pModal.numero_institucional}` : 'S/N';
                  const pCpf = pModal.cpf || 'Não informado';

                  return (
                    <div className="mt-3">
                      <span className="text-sm text-brand font-semibold bg-white/10 px-3 py-1.5 rounded-lg inline-block">
                        👤 {pModal.nome_social || pModal.nome_completo}
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
              <button onClick={fecharChamado} className="text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-lg p-2 transition-colors">
                ✕ Fechar
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50">
              
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
                  🔒 Este chamado já recebeu o parecer técnico e foi encerrado.
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
        <div className="fixed inset-0 bg-gray-900/60 z-50 flex items-start justify-center p-4 sm:p-8 backdrop-blur-sm animate-fadeIn overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col my-auto relative">
            
            <div className="bg-brand p-5 flex justify-between items-center text-white rounded-t-2xl">
              <h2 className="text-lg font-bold">Abrir Novo Chamado de Ocorrência</h2>
              <button type="button" onClick={() => setModalNovoAberto(false)} className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg p-2 transition-colors">
                ✕ Cancelar
              </button>
            </div>

            <div className="p-6 bg-gray-50">
              <form id="formNovoChamado" onSubmit={handleSalvarNovoChamado} className="space-y-6">
                
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
                      placeholder="Digite o nome ou CPF para buscar..."
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none bg-white text-sm font-medium"
                    />
                    
                    {mostrarDropdownPaciente && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {listaConviventes
                          .filter(c => (c.nome_completo || '').toLowerCase().includes(buscaPaciente.toLowerCase()) || (c.nome_social || '').toLowerCase().includes(buscaPaciente.toLowerCase()) || (c.cpf || '').includes(buscaPaciente))
                          .map(c => (
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
                        {listaConviventes.filter(c => (c.nome_completo || '').toLowerCase().includes(buscaPaciente.toLowerCase()) || (c.cpf || '').includes(buscaPaciente)).length === 0 && (
                          <div className="p-3 text-sm text-gray-500 text-center">Nenhum acolhido encontrado.</div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {formNovo.convivente_id && (
                    <p className="text-[10px] text-green-600 font-bold mt-2">✓ Paciente selecionado com sucesso.</p>
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
                {enviandoNovo ? 'Criando Ticket...' : '🚀 Abrir Chamado'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

