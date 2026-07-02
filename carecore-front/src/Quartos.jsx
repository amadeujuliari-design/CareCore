// =====================================================================
// ARQUIVO: src/Quartos.jsx (COMPLETO)
// =====================================================================
import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Sidebar from './Sidebar';
import { AppShell, MainShell, PageHeader, ScrollArea } from './components/PremiumUI';
import { API_ROOT } from './config/apiBase';
import { filtrarOrdenarConviventesPorBusca } from './utils/conviventeBuscaUtils';
import { ordenarPorTextoNatural } from './utils/ordenacaoNatural';
import { listarQuartosOrdenados } from './services/quartosService';
import { usuarioPodeEditarAcomodacao } from './hooks/usePermissoesProntuario';
import { decodificarPayloadJwt } from './utils/jwtUtils';
import { criarHeadersAutenticados } from './utils/requestIdUtils';
import {
  classesLeitoReservadoTb,
  classesQuartoPorModalidade,
  rotuloModalidadeQuarto,
  rotuloReservaTb,
} from './utils/quartosModalidadeUtils';

export default function Quartos() {
  const navigate = useNavigate();
  const token = localStorage.getItem('@CareCore:token');
  const [quartos, setQuartos] = useState([]);
  const [conviventes, setConviventes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [carregandoConviventes, setCarregandoConviventes] = useState(false);
  const conviventesCarregadosRef = useRef(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [modalLeito, setModalLeito] = useState(null);
  const [tooltipLeito, setTooltipLeito] = useState(null);
  const [conviventeSelecionadoId, setConviventeSelecionadoId] = useState('');
  const [buscaConvivente, setBuscaConvivente] = useState('');
  const [mostrarDropdownConvivente, setMostrarDropdownConvivente] = useState(false);
  const [salvandoAlocacao, setSalvandoAlocacao] = useState(false);

  let perfilUsuario = '';
  let usuarioToken = null;

  try {
    if (token) {
      const payload = decodificarPayloadJwt(token) || {};
      perfilUsuario = payload.perfil_acesso || '';
      usuarioToken = payload;
    }
  } catch (error) {
    console.error('Erro ao ler token no módulo de quartos', error);
  }

  const podeGerenciarQuartos = usuarioPodeEditarAcomodacao(perfilUsuario, false, usuarioToken);
  const podeAlocarLeitos = podeGerenciarQuartos;
  // Formulário de Quarto
  const [nome, setNome] = useState('');
  const [tipoPublico, setTipoPublico] = useState('Masculino');
  const [modalidade, setModalidade] = useState('Fixo');
  const [rotativo, setRotativo] = useState(false);

  // Controle de Tela
  const [telaAtual, setTelaAtual] = useState('lista'); // 'lista' ou 'form'
  const [editandoId, setEditandoId] = useState(null);

  // Controle de Camas (Leitos) Dinâmicos no Formulário
  const [leitosForm, setLeitosForm] = useState([{ id_temporario: 1, identificacao: 'Cama 1', status: 'Livre' }]);
useEffect(() => {
    if (!token) {
      navigate('/');
      return;
    }
    carregarQuartos();
  }, [token]);

  const carregarQuartos = async () => {
    try {
      setLoading(true);
      const lista = await listarQuartosOrdenados();
      setQuartos(lista);
    } catch {
      setErro('Erro ao carregar lista de quartos.');
    } finally {
      setLoading(false);
    }
  };

  const carregarConviventesParaAlocacao = async (forcar = false) => {
    if (!podeAlocarLeitos) return;
    if (!forcar && conviventesCarregadosRef.current) return;

    try {
      setCarregandoConviventes(true);
      const resConviventes = await axios.get(`${API_ROOT}/conviventes/resumo`, {
        headers: criarHeadersAutenticados(token),
        params: { status: 'Ativo' },
      });
      setConviventes(resConviventes.data || []);
      conviventesCarregadosRef.current = true;
    } catch {
      setErro('Erro ao carregar conviventes para alocação.');
    } finally {
      setCarregandoConviventes(false);
    }
  };

  const abrirFormNovoQuarto = () => {
    if (!podeGerenciarQuartos) {
      setErro('Apenas Gestor ou Técnico podem criar quartos e leitos.');
      return;
    }

    setNome('');
    setTipoPublico('Masculino');
    setModalidade('Fixo');
    setRotativo(false);
    setLeitosForm([{ id_temporario: 1, identificacao: 'Cama 1', status: 'Livre' }]);
    setEditandoId(null);
    setTelaAtual('form');
    setErro('');
  };

  const adicionarCamaNoForm = () => {
    const proximoNumero = leitosForm.length + 1;
    setLeitosForm([...leitosForm, { id_temporario: Date.now(), identificacao: `Cama ${proximoNumero}`, status: 'Livre' }]);
  };

  const removerCamaNoForm = (indexParaRemover) => {
    if (leitosForm.length === 1) return; // Obriga a ter pelo menos 1 cama
    const novaLista = leitosForm.filter((_, idx) => idx !== indexParaRemover);
    // Renomeia em ordem sequencial para ficar organizado
    const listaAjustada = novaLista.map((cama, idx) => ({
      ...cama,
      identificacao: `Cama ${idx + 1}`
    }));
    setLeitosForm(listaAjustada);
  };

  const abrirParaEdicao = (quarto) => {
    if (!podeGerenciarQuartos) {
      setErro('Apenas Gestor ou Técnico podem editar quartos e leitos.');
      return;
    }

    setEditandoId(quarto.id);
    setNome(quarto.nome);
    setTipoPublico(quarto.tipo_publico);
    setModalidade(quarto.modalidade);
    setRotativo(Boolean(quarto.rotativo));
    
    // Mapeia os leitos do banco para o formato do formulário
    if (quarto.leitos && quarto.leitos.length > 0) {
      const leitosOrdenados = ordenarPorTextoNatural(quarto.leitos, (leito) => leito.identificacao);
      setLeitosForm(leitosOrdenados.map(l => ({ id: l.id, identificacao: l.identificacao, status: l.status })));
    } else {
      setLeitosForm([{ id_temporario: 1, identificacao: 'Cama 1', status: 'Livre' }]);
    }
    setTelaAtual('form');
    setErro('');
  };

  const handleSalvarQuarto = async (e) => {
    e.preventDefault();
    setErro(''); setSucesso('');

    if (!nome.trim()) {
      setErro('Por favor, informe o nome ou número de identificação do Quarto.');
      return;
    }

    const payload = {
      nome: nome.trim(),
      tipo_publico: tipoPublico,
      modalidade: modalidade,
      rotativo,
      leitos: leitosForm.map(l => ({ id: l.id || null, identificacao: l.identificacao, status: l.status }))
    };

    try {
      if (editandoId) {
        await axios.put(`${API_ROOT}/quartos/${editandoId}`, payload, {
          headers: criarHeadersAutenticados(token)
        });
        setSucesso('Quarto e leitos atualizados com sucesso!');
      } else {
        await axios.post(`${API_ROOT}/quartos`, payload, {
          headers: criarHeadersAutenticados(token)
        });
        setSucesso('Quarto criado com sucesso!');
      }

      setTelaAtual('lista');
      carregarQuartos();
      setTimeout(() => setSucesso(''), 3000);
    } catch (error) {
      setErro(error.response?.data?.detail || 'Erro ao salvar quarto. Verifique as regras do banco.');
    }
  };

  const handleExcluirQuarto = async (quartoId) => {
    if (!podeGerenciarQuartos) {
      setErro('Apenas Gestor ou Técnico podem excluir quartos.');
      return;
    }

    if (!window.confirm("Atenção: Ao excluir este quarto, todos os seus leitos associados serão removidos. Deseja continuar?")) return;
    try {
      await axios.delete(`${API_ROOT}/quartos/${quartoId}`, {
        headers: criarHeadersAutenticados(token)
      });
      setSucesso('Quarto removido com sucesso.');
      carregarQuartos();
      setTimeout(() => setSucesso(''), 3000);
    } catch (error) {
      setErro(error.response?.data?.detail || 'Erro ao excluir quarto.');
    }
  };

  const conviventesElegiveis = useMemo(() => (
    filtrarOrdenarConviventesPorBusca(
      conviventes.filter(c => c.status === 'Ativo'),
      buscaConvivente,
    )
  ), [buscaConvivente, conviventes]);

  const quartosOrdenados = quartos;

  const abrirModalLeito = (quarto, leito) => {
    if (!podeAlocarLeitos) return;

    const reservaTb = leito.tipo_reserva === 'tb_fixo' || leito.status === 'Reservado';
    setModalLeito({ quarto, leito });
    if (reservaTb && leito.convivente_id) {
      setConviventeSelecionadoId(leito.convivente_id);
      setBuscaConvivente(
        `#${leito.numero_institucional || 'S/N'} - ${leito.convivente_nome_completo || leito.convivente_nome || 'Convivente'}`
      );
    } else {
      setConviventeSelecionadoId('');
      setBuscaConvivente('');
    }
    setMostrarDropdownConvivente(false);
    setErro('');
    void carregarConviventesParaAlocacao();
  };

  const handleCliqueLeito = (quarto, leito) => {
    if (!podeAlocarLeitos) return;
    abrirModalLeito(quarto, leito);
  };

  const selecionarConviventeParaLeito = (convivente) => {
    setConviventeSelecionadoId(convivente.id);
    setBuscaConvivente(
      `#${convivente.numero_institucional || 'S/N'} - ${convivente.nome_social || convivente.nome_completo}`
    );
    setMostrarDropdownConvivente(false);
  };

  const alocarConviventeNoLeito = async () => {
    if (!modalLeito || !conviventeSelecionadoId) {
      setErro('Selecione um convivente para alocar neste leito.');
      return;
    }

    try {
      setSalvandoAlocacao(true);
      await axios.patch(
        `${API_ROOT}/quartos/leitos/${modalLeito.leito.id}/alocar`,
        { convivente_id: conviventeSelecionadoId },
        { headers: criarHeadersAutenticados(token) }
      );
      setModalLeito(null);
      conviventesCarregadosRef.current = false;
      setSucesso(
        modalLeito.leito.tipo_reserva === 'tb_fixo' || modalLeito.leito.status === 'Reservado'
          ? 'Convivente retornou ao leito fixo com sucesso.'
          : 'Convivente alocado com sucesso.'
      );
      await carregarQuartos();
      setTimeout(() => setSucesso(''), 3000);
    } catch (error) {
      setErro(error.response?.data?.detail || 'Erro ao alocar convivente.');
    } finally {
      setSalvandoAlocacao(false);
    }
  };

  const liberarLeito = async () => {
    if (!modalLeito) return;

    try {
      setSalvandoAlocacao(true);
      await axios.patch(
        `${API_ROOT}/quartos/leitos/${modalLeito.leito.id}/liberar`,
        {},
        { headers: criarHeadersAutenticados(token) }
      );
      setModalLeito(null);
      conviventesCarregadosRef.current = false;
      setSucesso('Leito liberado com sucesso.');
      await carregarQuartos();
      setTimeout(() => setSucesso(''), 3000);
    } catch (error) {
      setErro(error.response?.data?.detail || 'Erro ao liberar leito.');
    } finally {
      setSalvandoAlocacao(false);
    }
  };

  const atualizarTooltipLeito = (event, leito) => {
    const exibirTooltip = leito.status === 'Ocupado'
      || leito.status === 'Reservado'
      || leito.tipo_reserva === 'tb_fixo';
    if (!exibirTooltip) return;

    const larguraTooltip = 280;
    const alturaTooltip = leito.tipo_reserva === 'tb_fixo' ? 190 : 150;
    const margem = 16;

    const x = Math.min(
      Math.max(event.clientX + margem, margem),
      window.innerWidth - larguraTooltip - margem
    );
    const y = Math.min(
      Math.max(event.clientY + margem, margem),
      window.innerHeight - alturaTooltip - margem
    );

    setTooltipLeito({ leito, x, y });
  };

  return (
    <AppShell>
      <Sidebar />

      <MainShell>
        <PageHeader
          eyebrow="Operação"
          title="Módulo de Acomodações"
          subtitle="Configuração de quartos, leitos e mapa de ocupação da instituição."
          icon="▣"
        />

        <ScrollArea>
          <div className="w-full max-w-7xl mx-auto">
          {erro && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm mb-6 font-bold border border-red-100">! {erro}</div>}
          {sucesso && <div className="bg-green-50 text-green-700 p-4 rounded-xl text-sm mb-6 font-bold border border-green-100">{sucesso}</div>}

          {/* --- TELA DE LISTAGEM --- */}
          {telaAtual === 'lista' && (
            <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 h-full flex flex-col">
              <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-800 tracking-tight">Mapa de Quartos</h2>
                  <p className="text-xs text-gray-400 font-medium mt-0.5">Visualize a ocupação das camas fisicamente no abrigo</p>
                </div>
                {podeGerenciarQuartos && (
                  <button onClick={abrirFormNovoQuarto} className="bg-brand text-white px-6 py-2.5 rounded-xl hover:bg-brandDark font-bold transition-all shadow-md">
                    + Novo Quarto
                  </button>
                )}
              </div>

              {loading ? (
                <div className="flex justify-center p-12"><p className="text-brand font-bold animate-pulse text-lg">Carregando acomodações...</p></div>
              ) : quartosOrdenados.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl">
                  <p className="text-gray-500 text-lg font-medium">Nenhum quarto cadastrado até o momento.</p>
                </div>
              ) : (
                // MAPA VISUAL EM GRID DOS QUARTOS
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 items-start">
                  {quartosOrdenados.map(q => (
                    <div key={q.id} className={`rounded-3xl border shadow-sm flex flex-col hover:shadow-md transition-all duration-200 min-h-[300px] ${classesQuartoPorModalidade(q.modalidade)}`} >
                      
                      {/* Topo do Quarto */}
                      <div className={`px-3 py-2.5 text-white flex justify-between items-start ${
                        q.modalidade === 'TB_Suspeita'
                          ? 'bg-amber-700'
                          : q.modalidade === 'TB_Confirmado'
                            ? 'bg-rose-800'
                            : 'bg-slate-800'
                      }`}>
                        <div>
                          <h3 className="font-semibold text-[15px] tracking-tight">{q.nome}</h3>
                          <p className="text-[9px] text-slate-100 font-medium uppercase tracking-wide mt-0.5">
                            {q.tipo_publico} • {rotuloModalidadeQuarto(q.modalidade)}
                            {q.rotativo ? ' • Rotativo' : ''}
                          </p>
                        </div>
                        {podeGerenciarQuartos && (
                          <div className="flex gap-2">
                            <button onClick={() => abrirParaEdicao(q)} className="text-[11px] bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded-xl font-medium transition-colors">Editar</button>
                            <button onClick={() => handleExcluirQuarto(q.id)} className="text-[11px] bg-red-900/60 hover:bg-red-700 px-2 py-1 rounded-xl font-medium transition-colors">Excluir</button>
                          </div>
                        )}
                      </div>

                      {/* Camas Internas do Quarto */}
                      <div className="p-3 bg-slate-50/60 flex-1">
                        <h4 className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Disposição das Camas ({q.leitos?.length || 0})</h4>
                        
                        <div className="grid grid-cols-2 2xl:grid-cols-3 gap-2.5">
                          {q.leitos?.map(l => {
                            const ausenciaJustificada = l.convivente_status === 'Ausência justificada';
                            const reservaTb = l.tipo_reserva === 'tb_fixo' || l.convivente_status === 'Reservado TB';
                            const ocupado = l.status === 'Ocupado';

                            return (
                              <button
                                type="button"
                                key={l.id}
                                onClick={() => handleCliqueLeito(q, l)}
                                onMouseEnter={(event) => atualizarTooltipLeito(event, l)}
                                onMouseMove={(event) => atualizarTooltipLeito(event, l)}
                                onMouseLeave={() => setTooltipLeito(null)}
                                className={`group relative rounded-2xl border px-2.5 py-2 text-center transition-all min-h-[104px] ${podeAlocarLeitos ? 'cursor-pointer' : 'cursor-default'} ${
                                  reservaTb
                                    ? classesLeitoReservadoTb()
                                    : ausenciaJustificada
                                    ? 'bg-blue-50/90 border-blue-300 hover:bg-blue-100/90'
                                    : ocupado
                                    ? 'bg-amber-50/80 border-amber-200 hover:bg-amber-100/80'
                                    : 'bg-white border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                <div className="text-base mb-1">▣</div>

                                <div className={`text-[12px] font-semibold leading-tight ${
                                  reservaTb
                                    ? 'text-fuchsia-900'
                                    : ausenciaJustificada
                                    ? 'text-blue-800'
                                    : ocupado
                                    ? 'text-amber-800'
                                    : 'text-emerald-700'
                                }`}>
                                  {l.identificacao}
                                </div>

                                {reservaTb ? (
                                  <div className="mt-1.5 border-t border-fuchsia-200 pt-1.5 space-y-1">
                                    <div className="text-[10px] font-semibold text-fuchsia-950 truncate leading-tight">
                                      {l.convivente_nome || 'Convivente'}
                                    </div>
                                    <div className="text-[9px] font-medium text-fuchsia-800 truncate leading-tight">
                                      Pront. {l.numero_institucional ?? '--'}
                                    </div>
                                    <span className="block rounded-md bg-fuchsia-600/15 px-1 py-0.5 text-[8px] font-bold leading-tight text-fuchsia-800 whitespace-normal">
                                      {rotuloReservaTb(l.tb_remanejamento_situacao)}
                                    </span>
                                  </div>
                                ) : ocupado ? (
                                  <div className={`mt-1.5 border-t pt-1.5 ${
                                    ausenciaJustificada ? 'border-blue-200' : 'border-amber-200'
                                  }`}>
                                    <div className="text-[11px] font-semibold text-slate-800 truncate leading-tight">
                                      {l.convivente_nome || 'Ocupado'}
                                    </div>

                                    <div className="text-[10px] font-semibold text-slate-500 truncate leading-tight">
                                      Pront. {l.numero_institucional ?? '--'}
                                    </div>

                                    {ausenciaJustificada && (
                                      <div className="text-[9px] font-bold uppercase tracking-wide text-blue-700 mt-1">
                                        Ausência justificada
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-[10px] uppercase tracking-wide mt-1 text-emerald-500 font-semibold">
                                    Livre
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* --- TELA DE FORMULÁRIO DE QUARTO --- */}
          {telaAtual === 'form' && (
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-2xl mx-auto">
              <h2 className="text-xl font-black text-gray-800 border-b pb-3 mb-6">
                {editandoId ? 'Editar estrutura de quarto' : 'Cadastrar novo quarto'}
              </h2>

              <form onSubmit={handleSalvarQuarto} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Nome ou Número de Identificação *</label>
                    <input 
                      type="text" 
                      value={nome} 
                      onChange={(e) => setNome(e.target.value)} 
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none"
                      placeholder="Ex: Quarto 10, Ala Masculina A, Triagem"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Público Alvo</label>
                    <select value={tipoPublico} onChange={(e) => setTipoPublico(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none bg-white">
                      <option value="Masculino">Masculino</option>
                      <option value="Feminino">Feminino</option>
                      <option value="Misto">Misto / Famílias</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Modalidade de Vaga</label>
                    <select value={modalidade} onChange={(e) => setModalidade(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none bg-white">
                      <option value="Fixo">Fixo (Pernoite Regular)</option>
                      <option value="Transitorio">Transitório (Passagem de Curto Prazo)</option>
                      <option value="TB_Suspeita">TB Suspeita</option>
                      <option value="TB_Confirmado">TB Confirmado</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="flex items-center gap-2 text-sm font-semibold text-orange-800">
                      <input
                        type="checkbox"
                        checked={rotativo}
                        onChange={(e) => setRotativo(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      />
                      Quarto rotativo (carteirinha provisória por 7 dias ao alocar leito)
                    </label>
                  </div>
                </div>

                {/* ABA DE ENGENHARIA DE CAMAS */}
                <div className="pt-6 border-t border-gray-200">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wider">Camas deste Quarto</h3>
                    <button 
                      type="button" 
                      onClick={adicionarCamaNoForm}
                      className="text-xs bg-brand text-white px-3 py-1.5 rounded-lg font-bold hover:bg-brandDark transition-colors"
                    >
                      + Adicionar Cama
                    </button>
                  </div>

                  <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                    {leitosForm.map((cama, index) => (
                      <div key={cama.id || cama.id_temporario} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">▣</span>
                          <span className="font-bold text-gray-700 text-sm">{cama.identificacao}</span>
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${cama.status === 'Ocupado' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                            {cama.status === 'Ocupado' ? 'Ocupada (Acolhido Deitado)' : 'Livre'}
                          </span>
                        </div>
                        
                        <button 
                          type="button"
                          onClick={() => removerCamaNoForm(index)}
                          disabled={cama.status === 'Ocupado'} // Bloqueia remoção se a cama tiver alguém deitado
                          className="text-xs font-bold text-red-600 hover:text-red-800 disabled:opacity-30 uppercase tracking-wider"
                          title={cama.status === 'Ocupado' ? "Não é possível remover uma cama ocupada por um acolhido" : "Remover cama"}
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Botoes Form */}
                <div className="pt-6 border-t flex justify-end gap-4">
                  <button type="button" onClick={() => setTelaAtual('lista')} className="px-5 py-2.5 bg-white border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 font-bold text-sm shadow-sm">
                    Cancelar
                  </button>
                  <button type="submit" className="px-6 py-2.5 bg-brand text-white rounded-xl hover:bg-brandDark font-bold text-sm shadow-md">
                    Salvar estrutura
                  </button>
                </div>
              </form>
            </div>
          )}

          {modalLeito && (() => {
            const leitoReservaTb = modalLeito.leito.tipo_reserva === 'tb_fixo'
              || modalLeito.leito.status === 'Reservado';
            const leitoOcupado = modalLeito.leito.status === 'Ocupado'
              || (modalLeito.leito.convivente_id && !leitoReservaTb);

            return (
            <div className="carecore-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
              <div className="carecore-modal-panel w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-brand">
                      {modalLeito.quarto.nome}
                    </p>
                    <h2 className="mt-1 text-xl font-black text-slate-900">
                      {modalLeito.leito.identificacao}
                    </h2>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {leitoReservaTb
                        ? `Reservado para ${modalLeito.leito.convivente_nome_completo || modalLeito.leito.convivente_nome || 'convivente'}`
                        : leitoOcupado
                        ? `Ocupado por ${modalLeito.leito.convivente_nome_completo || modalLeito.leito.convivente_nome}`
                        : 'Leito livre para alocação'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setModalLeito(null)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-500 hover:bg-slate-50"
                  >
                    Fechar
                  </button>
                </div>

                {leitoReservaTb ? (
                  <div className="mt-5 space-y-4">
                    <div className="rounded-2xl border border-fuchsia-100 bg-fuchsia-50 p-4 text-sm text-fuchsia-900">
                      <p className="font-bold">
                        {rotuloReservaTb(modalLeito.leito.tb_remanejamento_situacao)}
                      </p>
                      <p className="mt-2">
                        Confirme para realocar{' '}
                        <strong>{modalLeito.leito.convivente_nome_completo || modalLeito.leito.convivente_nome}</strong>
                        {' '}neste leito fixo e encerrar o remanejamento TB.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={alocarConviventeNoLeito}
                      disabled={salvandoAlocacao || !conviventeSelecionadoId}
                      className="w-full rounded-2xl bg-fuchsia-700 px-4 py-3 text-sm font-black text-white hover:bg-fuchsia-800 disabled:opacity-50"
                    >
                      {salvandoAlocacao ? 'Retornando...' : 'Retornar ao leito fixo'}
                    </button>
                  </div>
                ) : leitoOcupado ? (
                  <div className="mt-5 space-y-4">
                    <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
                      Liberar este leito remove apenas o vínculo de acomodação. O convivente permanece ativo no sistema.
                    </div>

                    <button
                      type="button"
                      onClick={liberarLeito}
                      disabled={salvandoAlocacao}
                      className="w-full rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {salvandoAlocacao ? 'Liberando...' : 'Liberar leito'}
                    </button>
                  </div>
                ) : (
                  <div className="mt-5 space-y-4">
                    <div className="relative">
                      <input
                        type="text"
                        value={buscaConvivente}
                        onChange={(e) => {
                          setBuscaConvivente(e.target.value);
                          setConviventeSelecionadoId('');
                          setMostrarDropdownConvivente(true);
                        }}
                        onFocus={() => setMostrarDropdownConvivente(true)}
                        placeholder="Digite nome, prontuário ou CPF para buscar..."
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand"
                      />

                      {mostrarDropdownConvivente && (
                        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                          {carregandoConviventes ? (
                            <div className="p-4 text-center text-sm font-semibold text-slate-500">
                              Carregando conviventes ativos...
                            </div>
                          ) : conviventesElegiveis.map(c => (
                            <button
                              type="button"
                              key={c.id}
                              onMouseDown={(event) => {
                                event.preventDefault();
                                selecionarConviventeParaLeito(c);
                              }}
                              className="w-full border-b border-slate-50 px-4 py-3 text-left text-sm hover:bg-brand/10"
                            >
                              <span className="block font-black text-slate-800">
                                {c.nome_social || c.nome_completo}
                              </span>
                              <span className="mt-0.5 block text-xs font-semibold text-slate-500">
                                Pront. #{c.numero_institucional || 'S/N'} · CPF {c.cpf || 'Não informado'}
                                {c.leito_id ? ' · atualmente em outro leito' : ''}
                              </span>
                            </button>
                          ))}

                          {!carregandoConviventes && conviventesElegiveis.length === 0 && (
                            <div className="p-4 text-center text-sm font-semibold text-slate-500">
                              Nenhum convivente ativo encontrado.
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {conviventeSelecionadoId && (
                      <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
                        Convivente selecionado para alocação.
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={alocarConviventeNoLeito}
                      disabled={salvandoAlocacao || !conviventeSelecionadoId}
                      className="w-full rounded-2xl bg-brand px-4 py-3 text-sm font-black text-white hover:bg-brandDark disabled:opacity-50"
                    >
                      {salvandoAlocacao ? 'Alocando...' : 'Alocar neste leito'}
                    </button>
                  </div>
                )}
              </div>
            </div>
            );
          })()}

          {tooltipLeito && (
            <div
              className="pointer-events-none fixed z-[10000] w-72 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-2xl"
              style={{ left: tooltipLeito.x, top: tooltipLeito.y }}
            >
              <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
                {tooltipLeito.leito.tipo_reserva === 'tb_fixo'
                  ? 'Leito reservado — remanejamento TB'
                  : 'Convivente alocado'}
              </div>

              <div className="mt-1 text-sm font-semibold text-slate-900">
                {tooltipLeito.leito.convivente_nome_completo || tooltipLeito.leito.convivente_nome || 'Não informado'}
              </div>

              <div className="mt-2 grid gap-1 text-xs text-slate-600">
                <div>
                  <span className="font-semibold text-slate-800">Leito:</span>{' '}
                  {tooltipLeito.leito.identificacao || '--'}
                </div>

                <div>
                  <span className="font-semibold text-slate-800">Prontuário:</span>{' '}
                  {tooltipLeito.leito.numero_institucional ?? '--'}
                </div>

                <div>
                  <span className="font-semibold text-slate-800">CPF:</span>{' '}
                  {tooltipLeito.leito.cpf || '--'}
                </div>

                {tooltipLeito.leito.convivente_status === 'Ausência justificada' && (
                  <div className="mt-1 rounded-lg bg-blue-50 px-2 py-1 font-semibold text-blue-700">
                    Ausência justificada — leito reservado
                  </div>
                )}
                {tooltipLeito.leito.tipo_reserva === 'tb_fixo' && (
                  <div className="mt-1 rounded-lg bg-fuchsia-50 px-2 py-1 font-semibold text-fuchsia-800">
                    {rotuloReservaTb(tooltipLeito.leito.tb_remanejamento_situacao)}
                  </div>
                )}
              </div>
            </div>
          )}

          </div>
        </ScrollArea>
      </MainShell>
    </AppShell>
  );
}