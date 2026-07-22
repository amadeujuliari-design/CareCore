import { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from './Sidebar';
import { AppShell, MainShell, PageHeader, PremiumButton, ScrollArea } from './components/PremiumUI';
import { useAuth } from './context/AuthContext';
import api from './services/api';
import {
  atualizarAtividade,
  criarAtividade,
  excluirAtividade,
  gerarOcorrenciasAtividade,
  listarAtividades,
  obterCatalogoSisaAtividades,
} from './services/atividadesService';
import SeletorCatalogoSisa from './components/atividades/SeletorCatalogoSisa';
import SeletorHorarioSisa from './components/atividades/SeletorHorarioSisa';
import CalendarioDatasEspecificas from './components/atividades/CalendarioDatasEspecificas';
import { formatarDataBr, dataIsoNoIntervalo, compararDatasIso } from './utils/dataBrasilUtils';
import {
  CATEGORIAS_ATIVIDADE,
  DIAS_SEMANA_ATIVIDADE,
  TIPOS_FREQUENCIA_ATIVIDADE,
  criarFormAtividadeInicial,
  mesReferenciaAtual,
  mesclarCatalogoSisaComPadrao,
  catalogoSisaPadraoFrontend,
  rotuloCategoriaAtividade,
  rotuloFrequenciaAtividade,
  usuarioSomenteLeituraAtividades,
} from './config/atividadesConfig';

function montarPayload(form) {
  const datas = (form.configuracao_agenda.datas_especificas || [])
    .map((item) => String(item).trim().slice(0, 10))
    .filter(Boolean);

  return {
    nome: form.nome.trim(),
    categoria: form.categoria,
    responsavel_usuario_id: form.responsavel_usuario_id || null,
    tipo_frequencia: form.tipo_frequencia,
    configuracao_agenda: {
      dias_semana: form.configuracao_agenda.dias_semana || [],
      datas_especificas: datas,
      somente_dias_uteis: Boolean(form.configuracao_agenda.somente_dias_uteis),
      max_sessoes_mes: Number(form.configuracao_agenda.max_sessoes_mes) || null,
    },
    vigencia_inicio: form.vigencia_inicio || null,
    vigencia_fim: form.vigencia_fim || null,
    sisa_descricao_atividade: form.sisa_descricao_atividade || null,
    sisa_descricao_tema: form.sisa_descricao_tema || null,
    sisa_horario_padrao: form.sisa_horario_padrao || null,
    ativo: Boolean(form.ativo),
    contabiliza_pontos: form.contabiliza_pontos !== false,
  };
}

function formDeAtividade(item) {
  const base = criarFormAtividadeInicial();
  if (!item) return base;
  return {
    nome: item.nome || '',
    categoria: item.categoria || 'oficina',
    responsavel_usuario_id: item.responsavel_usuario_id || '',
    tipo_frequencia: item.tipo_frequencia || 'semanal',
    configuracao_agenda: {
      dias_semana: item.configuracao_agenda?.dias_semana || [],
      datas_especificas: item.configuracao_agenda?.datas_especificas || [],
      somente_dias_uteis: Boolean(item.configuracao_agenda?.somente_dias_uteis),
      max_sessoes_mes: item.configuracao_agenda?.max_sessoes_mes ?? 21,
    },
    vigencia_inicio: item.vigencia_inicio || '',
    vigencia_fim: item.vigencia_fim || '',
    sisa_descricao_atividade: item.sisa_descricao_atividade || '',
    sisa_descricao_tema: item.sisa_descricao_tema || '',
    sisa_horario_padrao: item.sisa_horario_padrao || '',
    ativo: item.ativo !== false,
    contabiliza_pontos: item.contabiliza_pontos !== false,
  };
}

export default function AtividadesCadastro() {
  const { usuario } = useAuth();
  const somenteLeitura = usuarioSomenteLeituraAtividades(usuario);
  const [atividades, setAtividades] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(criarFormAtividadeInicial());
  const [mesGeracao, setMesGeracao] = useState(mesReferenciaAtual());
  const [gerandoId, setGerandoId] = useState(null);
  const [excluindoId, setExcluindoId] = useState(null);
  const [catalogoSisa, setCatalogoSisa] = useState(catalogoSisaPadraoFrontend());

  const carregarCatalogoSisa = useCallback(async () => {
    try {
      const catalogo = await obterCatalogoSisaAtividades();
      setCatalogoSisa(mesclarCatalogoSisaComPadrao(catalogo));
    } catch {
      setCatalogoSisa(catalogoSisaPadraoFrontend());
    }
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const [lista, usuariosResp] = await Promise.all([
        listarAtividades(false),
        api.get('/api/usuarios', { params: { limite: 200, offset: 0 } }),
      ]);
      setAtividades(lista.items || []);
      setUsuarios(usuariosResp.data?.items || usuariosResp.data || []);
      await carregarCatalogoSisa();
    } catch (error) {
      setErro(error.response?.data?.detail || 'Não foi possível carregar as atividades.');
    } finally {
      setLoading(false);
    }
  }, [carregarCatalogoSisa]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    setForm((atual) => {
      const filtradas = (atual.configuracao_agenda.datas_especificas || [])
        .filter((data) => dataIsoNoIntervalo(data, atual.vigencia_inicio, atual.vigencia_fim));
      if (filtradas.length === (atual.configuracao_agenda.datas_especificas || []).length) {
        return atual;
      }
      return {
        ...atual,
        configuracao_agenda: {
          ...atual.configuracao_agenda,
          datas_especificas: filtradas.sort(compararDatasIso),
        },
      };
    });
  }, [form.vigencia_inicio, form.vigencia_fim]);

  const atualizarDatasEspecificas = (datas) => {
    setForm((atual) => ({
      ...atual,
      configuracao_agenda: {
        ...atual.configuracao_agenda,
        datas_especificas: datas,
      },
    }));
  };

  const abrirNova = () => {
    setEditandoId(null);
    setForm(criarFormAtividadeInicial());
    carregarCatalogoSisa();
    setModalAberto(true);
  };

  const abrirEdicao = (item) => {
    setEditandoId(item.id);
    setForm(formDeAtividade(item));
    carregarCatalogoSisa();
    setModalAberto(true);
  };

  const alternarDiaSemana = (valor) => {
    setForm((atual) => {
      const dias = new Set(atual.configuracao_agenda.dias_semana || []);
      if (dias.has(valor)) dias.delete(valor);
      else dias.add(valor);
      return {
        ...atual,
        configuracao_agenda: {
          ...atual.configuracao_agenda,
          dias_semana: Array.from(dias).sort((a, b) => a - b),
        },
      };
    });
  };

  const salvar = async (event) => {
    event.preventDefault();
    if (somenteLeitura) return;
    setSalvando(true);
    setErro('');
    setSucesso('');
    try {
      const payload = montarPayload(form);
      if (editandoId) {
        await atualizarAtividade(editandoId, payload);
        setSucesso('Atividade atualizada com sucesso.');
      } else {
        await criarAtividade(payload);
        setSucesso('Atividade criada com sucesso.');
      }
      setModalAberto(false);
      await carregar();
    } catch (error) {
      setErro(error.response?.data?.detail || 'Não foi possível salvar a atividade.');
    } finally {
      setSalvando(false);
    }
  };

  const gerarOcorrencias = async (atividadeId) => {
    if (somenteLeitura) return;
    setGerandoId(atividadeId);
    setErro('');
    setSucesso('');
    try {
      const resultado = await gerarOcorrenciasAtividade(atividadeId, mesGeracao);
      setSucesso(`Sessões do mês ${mesGeracao}: ${resultado.total} ocorrência(s) disponíveis.`);
    } catch (error) {
      setErro(error.response?.data?.detail || 'Não foi possível gerar as sessões do mês.');
    } finally {
      setGerandoId(null);
    }
  };

  const excluir = async (item) => {
    if (somenteLeitura) return;
    const confirmado = window.confirm(
      `Excluir a atividade "${item.nome}"?\n\n`
      + 'Se já houver presença registrada, ela será apenas inativada e sumirá das opções de escolha. '
      + 'Sem presença, a exclusão é definitiva.',
    );
    if (!confirmado) return;

    setExcluindoId(item.id);
    setErro('');
    setSucesso('');
    try {
      const resultado = await excluirAtividade(item.id);
      setSucesso(resultado?.mensagem || 'Atividade removida das opções de escolha.');
      if (editandoId === item.id) {
        setModalAberto(false);
        setEditandoId(null);
      }
      await carregar();
    } catch (error) {
      setErro(error.response?.data?.detail || 'Não foi possível excluir a atividade.');
    } finally {
      setExcluindoId(null);
    }
  };

  const exigeDiasSemana = ['semanal', 'bisemanal'].includes(form.tipo_frequencia);
  const exigeDatasMes = form.tipo_frequencia === 'dias_mes';

  const atividadesOrdenadas = useMemo(
    () => [...atividades].sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR')),
    [atividades],
  );

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          titulo="Atividades do projeto"
          subtitulo="Cadastre oficinas, reuniões e encontros com agenda flexível para chamada de presença."
        />

        <div className="mb-4 flex flex-wrap items-center gap-3">
          {!somenteLeitura && (
            <PremiumButton type="button" onClick={abrirNova}>
              Nova atividade
            </PremiumButton>
          )}
          <label className="text-sm font-semibold text-gray-600">
            Mês para gerar sessões
            <input
              type="month"
              value={mesGeracao}
              onChange={(event) => setMesGeracao(event.target.value)}
              className="ml-2 rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
        </div>

        {erro && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {erro}
          </div>
        )}
        {sucesso && (
          <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {sucesso}
          </div>
        )}

        <ScrollArea className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          {loading ? (
            <p className="p-6 text-sm text-gray-500">Carregando atividades...</p>
          ) : atividadesOrdenadas.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">Nenhuma atividade cadastrada neste projeto.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {atividadesOrdenadas.map((item) => (
                <div key={item.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-base font-bold text-gray-900">{item.nome}</p>
                    <p className="mt-1 text-sm text-gray-600">
                      {rotuloCategoriaAtividade(item.categoria)} · {rotuloFrequenciaAtividade(item.tipo_frequencia)}
                      {item.responsavel_nome ? ` · ${item.responsavel_nome}` : ''}
                    </p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      {item.ativo ? 'Ativa' : 'Inativa'}
                    </p>
                  </div>
                  {!somenteLeitura && (
                    <div className="flex flex-wrap gap-2">
                      <PremiumButton type="button" variant="secondary" onClick={() => abrirEdicao(item)}>
                        Editar
                      </PremiumButton>
                      <PremiumButton
                        type="button"
                        onClick={() => gerarOcorrencias(item.id)}
                        disabled={gerandoId === item.id || excluindoId === item.id}
                      >
                        {gerandoId === item.id ? 'Gerando...' : 'Gerar sessões do mês'}
                      </PremiumButton>
                      <PremiumButton
                        type="button"
                        variant="secondary"
                        onClick={() => excluir(item)}
                        disabled={excluindoId === item.id || gerandoId === item.id}
                      >
                        {excluindoId === item.id ? 'Excluindo...' : 'Excluir'}
                      </PremiumButton>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {modalAberto && (
          <div className="carecore-modal-overlay fixed inset-0 z-[70] flex items-center justify-center bg-gray-900/70 p-4 backdrop-blur-sm">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
              <h2 className="text-xl font-bold text-gray-900">
                {editandoId ? 'Editar atividade' : 'Nova atividade'}
              </h2>
              <form onSubmit={salvar} className="mt-4 space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Nome</label>
                  <input
                    value={form.nome}
                    onChange={(event) => setForm({ ...form, nome: event.target.value })}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    required
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Máx. sessões/mês</label>
                    <input
                      type="number"
                      min="1"
                      value={form.configuracao_agenda.max_sessoes_mes ?? ''}
                      onChange={(event) => setForm({
                        ...form,
                        configuracao_agenda: {
                          ...form.configuracao_agenda,
                          max_sessoes_mes: event.target.value,
                        },
                      })}
                      className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Vigência início</label>
                    <input
                      type="date"
                      value={form.vigencia_inicio || ''}
                      onChange={(event) => setForm({ ...form, vigencia_inicio: event.target.value })}
                      className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    />
                    {form.vigencia_inicio && (
                      <p className="mt-1 text-xs text-gray-500">{formatarDataBr(form.vigencia_inicio)}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Vigência fim</label>
                    <input
                      type="date"
                      value={form.vigencia_fim || ''}
                      onChange={(event) => setForm({ ...form, vigencia_fim: event.target.value })}
                      className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    />
                    {form.vigencia_fim && (
                      <p className="mt-1 text-xs text-gray-500">{formatarDataBr(form.vigencia_fim)}</p>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Categoria</label>
                    <select
                      value={form.categoria}
                      onChange={(event) => setForm({ ...form, categoria: event.target.value })}
                      className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    >
                      {CATEGORIAS_ATIVIDADE.map((item) => (
                        <option key={item.valor} value={item.valor}>{item.rotulo}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Frequência</label>
                    <select
                      value={form.tipo_frequencia}
                      onChange={(event) => setForm({ ...form, tipo_frequencia: event.target.value })}
                      className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    >
                      {TIPOS_FREQUENCIA_ATIVIDADE.map((item) => (
                        <option key={item.valor} value={item.valor}>{item.rotulo}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Responsável</label>
                  <select
                    value={form.responsavel_usuario_id}
                    onChange={(event) => setForm({ ...form, responsavel_usuario_id: event.target.value })}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  >
                    <option value="">Sem responsável definido</option>
                    {usuarios.map((usuario) => (
                      <option key={usuario.id} value={usuario.id}>{usuario.nome}</option>
                    ))}
                  </select>
                </div>
                {form.tipo_frequencia === 'diaria' && (
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <input
                      type="checkbox"
                      checked={Boolean(form.configuracao_agenda.somente_dias_uteis)}
                      onChange={(event) => setForm({
                        ...form,
                        configuracao_agenda: {
                          ...form.configuracao_agenda,
                          somente_dias_uteis: event.target.checked,
                        },
                      })}
                    />
                    Somente dias úteis (segunda a sexta)
                  </label>
                )}
                {exigeDiasSemana && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Dias da semana</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {DIAS_SEMANA_ATIVIDADE.map((dia) => {
                        const ativo = (form.configuracao_agenda.dias_semana || []).includes(dia.valor);
                        return (
                          <button
                            key={dia.valor}
                            type="button"
                            onClick={() => alternarDiaSemana(dia.valor)}
                            className={`rounded-xl px-3 py-2 text-sm font-bold ${ativo ? 'bg-brand text-white' : 'bg-gray-100 text-gray-700'}`}
                          >
                            {dia.rotulo}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {exigeDatasMes && (
                  <CalendarioDatasEspecificas
                    datasSelecionadas={form.configuracao_agenda.datas_especificas || []}
                    onChange={atualizarDatasEspecificas}
                    dataInicio={form.vigencia_inicio}
                    dataFim={form.vigencia_fim}
                    disabled={somenteLeitura}
                  />
                )}
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
                  <p className="mb-3 text-sm font-bold text-indigo-900">Vínculo SISA (conferência)</p>
                  <div className="grid gap-4 md:grid-cols-3">
                    <SeletorCatalogoSisa
                      rotulo="Descrição atividade SISA"
                      tipo="descricao_atividade"
                      valor={form.sisa_descricao_atividade}
                      onChange={(valor) => setForm({ ...form, sisa_descricao_atividade: valor })}
                      opcoes={catalogoSisa.descricao_atividade || []}
                      disabled={somenteLeitura}
                      onCatalogoAtualizado={(catalogo) => setCatalogoSisa(mesclarCatalogoSisaComPadrao(catalogo))}
                    />
                    <SeletorCatalogoSisa
                      rotulo="Descrição do tema SISA"
                      tipo="descricao_tema"
                      valor={form.sisa_descricao_tema}
                      onChange={(valor) => setForm({ ...form, sisa_descricao_tema: valor })}
                      opcoes={catalogoSisa.descricao_tema || []}
                      disabled={somenteLeitura}
                      onCatalogoAtualizado={(catalogo) => setCatalogoSisa(mesclarCatalogoSisaComPadrao(catalogo))}
                    />
                    <SeletorHorarioSisa
                      valor={form.sisa_horario_padrao}
                      onChange={(valor) => setForm({ ...form, sisa_horario_padrao: valor })}
                      disabled={somenteLeitura}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={Boolean(form.ativo)}
                    onChange={(event) => setForm({ ...form, ativo: event.target.checked })}
                    disabled={somenteLeitura}
                  />
                  Atividade ativa
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.contabiliza_pontos !== false}
                    onChange={(event) => setForm({ ...form, contabiliza_pontos: event.target.checked })}
                    disabled={somenteLeitura}
                  />
                  Esta atividade pontua para brindes
                </label>
                <p className="text-xs text-gray-500 -mt-2">
                  Desmarcar afeta apenas presenças futuras; pontos já creditados permanecem.
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <PremiumButton type="button" variant="secondary" onClick={() => setModalAberto(false)}>
                    Cancelar
                  </PremiumButton>
                  <PremiumButton type="submit" disabled={salvando}>
                    {salvando ? 'Salvando...' : 'Salvar'}
                  </PremiumButton>
                </div>
              </form>
            </div>
          </div>
        )}
      </MainShell>
    </AppShell>
  );
}
