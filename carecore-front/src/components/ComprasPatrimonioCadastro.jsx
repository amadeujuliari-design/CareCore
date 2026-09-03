import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Pencil, Plus, Search } from 'lucide-react';

import ModalFichaPatrimonio from './ModalFichaPatrimonio';
import ModalFormPatrimonio from './ModalFormPatrimonio';
import { EmptyState, PremiumBadge, PremiumButton, SectionCard } from './PremiumUI';
import { comprasSalvarPatrimonio, moneyCentavos } from '../services/comprasService';
import {
  PATRIMONIO_PROPRIEDADE,
  PATRIMONIO_SITUACAO,
  centavosParaInput,
  reaisParaCentavos,
  rotuloOpcao,
} from '../utils/comprasPatrimonioUtils';
import { SEGMENTO_IMOBILIZADO, normalizarSegmentoCatalogo } from '../utils/comprasPedidoTipos';

const ITENS_POR_PAGINA = 40;

const ITEM_VAZIO = {
  id: '',
  descricao: '',
  escopo_unidade: 'sede',
  instituicao_id: '',
  numero_etiqueta: '',
  localizacao: '',
  departamento: '',
  propriedade: 'aeb',
  origem: 'inventario',
  forma_aquisicao: '',
  documento_nf: '',
  data_aquisicao: '',
  valor_reais: '',
  situacao: 'bom',
  motivo_baixa: '',
  data_baixa: '',
  observacao: '',
  categoria_id: '',
};

function unidadeEhSede(unidade) {
  const nome = (unidade?.nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  return nome === 'SEDE' || nome === 'SEDE AEB' || nome.startsWith('SEDE ');
}

function badgeSituacao(situacao) {
  if (situacao === 'baixado') return <PremiumBadge variant="danger">Baixado</PremiumBadge>;
  if (situacao === 'ruim' || situacao === 'manutencao') {
    return <PremiumBadge variant="warning">{rotuloOpcao(PATRIMONIO_SITUACAO, situacao)}</PremiumBadge>;
  }
  if (situacao === 'regular') return <PremiumBadge variant="info">Regular</PremiumBadge>;
  return <PremiumBadge variant="success">Bom</PremiumBadge>;
}

export default function ComprasPatrimonioCadastro({
  itens = [],
  unidades = [],
  categorias = [],
  sede = false,
  onRecarregar,
  onMensagem,
}) {
  const [form, setForm] = useState({ ...ITEM_VAZIO, escopo_unidade: sede ? 'sede' : 'projeto' });
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [ficha, setFicha] = useState(null);
  const [formAberto, setFormAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroUnidade, setFiltroUnidade] = useState('todos');
  const [filtroSituacao, setFiltroSituacao] = useState('ativos');
  const [filtroPropriedade, setFiltroPropriedade] = useState('todas');
  const [pagina, setPagina] = useState(1);

  const unidadesProjeto = useMemo(
    () => unidades.filter((unidade) => !unidadeEhSede(unidade)),
    [unidades],
  );

  const categoriasPatrimonio = useMemo(
    () => categorias.filter(
      (cat) => normalizarSegmentoCatalogo(cat.segmento) === SEGMENTO_IMOBILIZADO,
    ),
    [categorias],
  );

  const listaFiltrada = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return itens.filter((item) => {
      if (filtroUnidade === 'sede' && item.escopo_unidade !== 'sede') return false;
      if (filtroUnidade !== 'todos' && filtroUnidade !== 'sede' && item.instituicao_id !== filtroUnidade) return false;
      if (filtroSituacao === 'ativos' && item.situacao === 'baixado') return false;
      if (filtroSituacao !== 'ativos' && filtroSituacao !== 'todas' && item.situacao !== filtroSituacao) return false;
      if (filtroPropriedade !== 'todas' && item.propriedade !== filtroPropriedade) return false;
      if (termo) {
        const blob = [
          item.descricao,
          item.numero_etiqueta,
          item.localizacao,
          item.departamento,
          item.instituicao_nome,
          item.documento_nf,
        ].join(' ').toLowerCase();
        if (!blob.includes(termo)) return false;
      }
      return true;
    });
  }, [busca, filtroPropriedade, filtroSituacao, filtroUnidade, itens]);

  const totalPaginas = Math.max(1, Math.ceil(listaFiltrada.length / ITENS_POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const inicio = (paginaSegura - 1) * ITENS_POR_PAGINA;
  const paginaItens = listaFiltrada.slice(inicio, inicio + ITENS_POR_PAGINA);

  useEffect(() => {
    setPagina(1);
  }, [busca, filtroPropriedade, filtroSituacao, filtroUnidade]);

  const atualizar = useCallback((campo, valor) => {
    setForm((atual) => ({ ...atual, [campo]: valor }));
    setErros((atual) => ({ ...atual, [campo]: '' }));
  }, []);

  const abrirNovo = useCallback(() => {
    setFicha(null);
    setForm({ ...ITEM_VAZIO, escopo_unidade: sede ? 'sede' : 'projeto' });
    setErros({});
    setFormAberto(true);
  }, [sede]);

  const editar = useCallback((item) => {
    setFicha(null);
    setForm({
      ...ITEM_VAZIO,
      ...item,
      escopo_unidade: item.escopo_unidade || (item.instituicao_id ? 'projeto' : 'sede'),
      instituicao_id: item.instituicao_id || '',
      numero_etiqueta: item.numero_etiqueta || '',
      localizacao: item.localizacao || '',
      departamento: item.departamento || '',
      propriedade: item.propriedade || 'aeb',
      origem: item.origem || 'inventario',
      forma_aquisicao: item.forma_aquisicao || '',
      documento_nf: item.documento_nf || '',
      data_aquisicao: item.data_aquisicao || '',
      valor_reais: centavosParaInput(item.valor_centavos),
      situacao: item.situacao || 'bom',
      motivo_baixa: item.motivo_baixa || '',
      data_baixa: item.data_baixa || '',
      observacao: item.observacao || '',
      categoria_id: item.categoria_id || '',
    });
    setErros({});
    setFormAberto(true);
  }, []);

  const fecharForm = useCallback(() => {
    setFormAberto(false);
    setErros({});
  }, []);

  const salvar = useCallback(async (event) => {
    event.preventDefault();
    const novos = {};
    if (!form.descricao.trim()) novos.descricao = 'Informe a descrição do bem.';
    if (sede && form.escopo_unidade === 'projeto' && !form.instituicao_id) {
      novos.instituicao_id = 'Selecione o projeto.';
    }
    const centavos = form.valor_reais ? reaisParaCentavos(form.valor_reais) : null;
    if (form.valor_reais && centavos == null) novos.valor_reais = 'Valor inválido.';
    setErros(novos);
    if (Object.keys(novos).length) return;

    setSalvando(true);
    try {
      await comprasSalvarPatrimonio({
        descricao: form.descricao.trim(),
        escopo_unidade: form.escopo_unidade,
        instituicao_id: form.escopo_unidade === 'sede' ? null : (form.instituicao_id || null),
        numero_etiqueta: form.numero_etiqueta.trim() || null,
        localizacao: form.localizacao.trim() || null,
        departamento: form.departamento.trim() || null,
        propriedade: form.propriedade,
        origem: form.origem,
        forma_aquisicao: form.forma_aquisicao.trim() || null,
        documento_nf: form.documento_nf.trim() || null,
        data_aquisicao: form.data_aquisicao || null,
        valor_centavos: centavos,
        situacao: form.situacao,
        motivo_baixa: form.motivo_baixa.trim() || null,
        data_baixa: form.data_baixa || null,
        observacao: form.observacao.trim() || null,
        categoria_id: form.categoria_id || null,
      }, form.id || undefined);
      onMensagem?.({ ok: form.id ? 'Bem atualizado.' : 'Bem incluído.' });
      fecharForm();
      await onRecarregar?.();
    } catch (error) {
      onMensagem?.({
        erro: error.response?.data?.detail || 'Não foi possível salvar o bem.',
      });
    } finally {
      setSalvando(false);
    }
  }, [fecharForm, form, onMensagem, onRecarregar, sede]);

  useEffect(() => {
    if (!ficha && !formAberto) return undefined;
    const aoTeclar = (event) => {
      if (event.key !== 'Escape') return;
      if (formAberto) fecharForm();
      else setFicha(null);
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [fecharForm, ficha, formAberto]);

  return (
    <>
      <SectionCard
        title="Patrimônio"
        subtitle={`${listaFiltrada.length} de ${itens.length} bens`}
        actions={(
          <PremiumButton type="button" onClick={abrirNovo}>
            <span className="inline-flex items-center gap-1.5">
              <Plus size={16} />
              Novo bem
            </span>
          </PremiumButton>
        )}
      >
        <div className="px-5 py-4">
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Busca</span>
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Descrição, etiqueta, local ou unidade"
                  className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-400"
                />
              </div>
            </div>
            {sede && (
              <label>
                <span className="mb-1 block text-xs font-semibold text-slate-600">Unidade</span>
                <select
                  value={filtroUnidade}
                  onChange={(e) => setFiltroUnidade(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                >
                  <option value="todos">Todas as unidades</option>
                  <option value="sede">Sede</option>
                  {unidadesProjeto.map((u) => (
                    <option key={u.id} value={u.id}>{u.nome}</option>
                  ))}
                </select>
              </label>
            )}
            <label>
              <span className="mb-1 block text-xs font-semibold text-slate-600">Situação</span>
              <select
                value={filtroSituacao}
                onChange={(e) => setFiltroSituacao(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              >
                <option value="ativos">Ativos</option>
                <option value="todas">Todas as situações</option>
                {PATRIMONIO_SITUACAO.map((op) => (
                  <option key={op.value} value={op.value}>{op.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-semibold text-slate-600">Propriedade</span>
              <select
                value={filtroPropriedade}
                onChange={(e) => setFiltroPropriedade(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              >
                <option value="todas">AEB e público</option>
                {PATRIMONIO_PROPRIEDADE.map((op) => (
                  <option key={op.value} value={op.value}>{op.label}</option>
                ))}
              </select>
            </label>
          </div>

          {itens.length === 0 ? (
            <EmptyState
              title="Nenhum bem cadastrado"
              subtitle="Use Novo bem ou importe o inventário da planilha AEB."
            />
          ) : listaFiltrada.length === 0 ? (
            <EmptyState title="Nenhum resultado" subtitle="Ajuste a busca ou os filtros." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-2">Bem</th>
                    <th className="px-2 py-2">Unidade</th>
                    <th className="px-2 py-2">Local</th>
                    <th className="px-2 py-2">Valor</th>
                    <th className="px-2 py-2">Situação</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {paginaItens.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                      <td className="px-2 py-2.5 align-top">
                        <button type="button" className="text-left" onClick={() => setFicha(item)}>
                          <strong className="text-slate-900 hover:text-violet-700">{item.descricao}</strong>
                          <p className="text-xs text-slate-500">
                            {item.numero_etiqueta ? `Etiqueta ${item.numero_etiqueta}` : 'Sem etiqueta'}
                            {item.propriedade === 'publico' ? ' · Público' : ''}
                          </p>
                        </button>
                      </td>
                      <td className="px-2 py-2.5 align-top text-slate-600">{item.instituicao_nome || '—'}</td>
                      <td className="max-w-[160px] px-2 py-2.5 align-top text-slate-600">
                        <span className="line-clamp-2">{item.localizacao || '—'}</span>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 align-top text-slate-600">
                        {item.valor_centavos != null ? moneyCentavos(item.valor_centavos) : '—'}
                      </td>
                      <td className="px-2 py-2.5 align-top">{badgeSituacao(item.situacao)}</td>
                      <td className="px-2 py-2.5 align-top">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            title="Ver ficha"
                            aria-label={`Ver ficha de ${item.descricao}`}
                            onClick={() => setFicha(item)}
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            type="button"
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            title="Editar"
                            aria-label={`Editar ${item.descricao}`}
                            onClick={() => editar(item)}
                          >
                            <Pencil size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {listaFiltrada.length > 0 && (
            <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-semibold text-slate-500">
                Exibindo {inicio + 1} a {Math.min(inicio + ITENS_POR_PAGINA, listaFiltrada.length)} de {listaFiltrada.length} bem{listaFiltrada.length === 1 ? '' : 's'}.
              </p>
              <div className="flex items-center justify-between gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={() => setPagina(paginaSegura - 1)}
                  disabled={paginaSegura <= 1}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Anterior
                </button>
                <span className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700">
                  Página {paginaSegura} de {totalPaginas}
                </span>
                <button
                  type="button"
                  onClick={() => setPagina(paginaSegura + 1)}
                  disabled={paginaSegura >= totalPaginas}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      <ModalFichaPatrimonio item={ficha} onFechar={() => setFicha(null)} onEditar={editar} />

      {formAberto && (
        <ModalFormPatrimonio
          form={form}
          erros={erros}
          salvando={salvando}
          sede={sede}
          unidades={unidadesProjeto}
          categorias={categoriasPatrimonio}
          onAtualizar={atualizar}
          onSalvar={salvar}
          onCancelar={fecharForm}
        />
      )}
    </>
  );
}
