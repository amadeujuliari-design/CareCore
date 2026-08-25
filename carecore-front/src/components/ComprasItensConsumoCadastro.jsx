import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, Pencil, Plus, RefreshCw, Search, X } from 'lucide-react';

import ModalFichaItemConsumo from './ModalFichaItemConsumo';
import { CampoSelect, CampoTexto } from './UsuariosCampos';
import { EmptyState, PremiumBadge, PremiumButton, ReportActionButton, SectionCard } from './PremiumUI';
import { comprasSalvarItemConsumo } from '../services/comprasService';
import {
  exportarItensConsumo,
  imprimirItensConsumo,
} from '../utils/comprasItensConsumoExportPrint';
import { filtrarItensConsumo, digitarQuantidadeEmbalagem, sanitizarUnidadeMedida, UNIDADES_MEDIDA_ITEM } from '../utils/comprasItensConsumoUtils';
import { rotuloCategoria } from '../utils/comprasCategoriaUtils';
import {
  COMPETENCIA_SEDE,
  COMPETENCIAS_ORCAMENTO,
  ROTULO_COMPETENCIA_ORCAMENTO,
  ROTULO_SEGMENTO_CATALOGO,
  SEGMENTOS_CATALOGO,
  competenciaPadraoDoSegmento,
  rotuloCompetenciaOrcamento,
  rotuloSegmentoCatalogo,
} from '../utils/comprasPedidoTipos';

/** Página menor para caber melhor na tela e permitir navegar listas médias. */
const ITENS_POR_PAGINA = 25;

const ITEM_VAZIO = {
  id: '',
  descricao: '',
  categoria_id: '',
  competencia_orcamento: COMPETENCIA_SEDE,
  unidade_medida: '',
  embalagem: '',
  marca_preferencial: '',
  observacao: '',
  sinonimos: '',
  fator_embalagem: '',
  perecivel: false,
  equivalente_item_id: '',
  ativo: true,
};

export default function ComprasItensConsumoCadastro({
  itens = [],
  categorias = [],
  podeEditar = false,
  sede = false,
  onRecarregar,
  onMensagem,
}) {
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroSegmento, setFiltroSegmento] = useState('');
  const [filtroCompetencia, setFiltroCompetencia] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('ativo');
  const [pagina, setPagina] = useState(1);
  const [form, setForm] = useState(ITEM_VAZIO);
  const [formAberto, setFormAberto] = useState(false);
  const [ficha, setFicha] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const tabelaTopoRef = useRef(null);

  const categoriasFiltradas = useMemo(() => {
    if (!filtroSegmento) return categorias;
    return categorias.filter((c) => (c.segmento || 'consumo') === filtroSegmento);
  }, [categorias, filtroSegmento]);

  const listaFiltrada = useMemo(
    () => filtrarItensConsumo(itens, {
      busca,
      categoriaId: filtroCategoria,
      segmento: filtroSegmento,
      competencia: filtroCompetencia,
      status: filtroStatus,
    }),
    [itens, busca, filtroCategoria, filtroSegmento, filtroCompetencia, filtroStatus],
  );

  const filtrosAtivos = Boolean(
    busca.trim()
    || filtroCategoria
    || filtroSegmento
    || filtroCompetencia
    || filtroStatus !== 'ativo',
  );

  const limparFiltros = () => {
    setBusca('');
    setFiltroCategoria('');
    setFiltroSegmento('');
    setFiltroCompetencia('');
    setFiltroStatus('ativo');
    setPagina(1);
  };

  const irParaPagina = (novaPagina) => {
    setPagina(novaPagina);
    tabelaTopoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    setPagina(1);
  }, [busca, filtroCategoria, filtroSegmento, filtroCompetencia, filtroStatus]);

  useEffect(() => {
    if (filtroCategoria && !categoriasFiltradas.some((c) => c.id === filtroCategoria)) {
      setFiltroCategoria('');
    }
  }, [categoriasFiltradas, filtroCategoria]);

  useEffect(() => {
    if (!ficha && !formAberto) return undefined;
    const aoTeclar = (evento) => {
      if (evento.key !== 'Escape') return;
      if (formAberto) setFormAberto(false);
      else setFicha(null);
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [ficha, formAberto]);

  const totalPaginas = Math.max(1, Math.ceil(listaFiltrada.length / ITENS_POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const inicio = (paginaSegura - 1) * ITENS_POR_PAGINA;
  const paginaItens = listaFiltrada.slice(inicio, inicio + ITENS_POR_PAGINA);

  const abrirNovo = () => {
    setForm(ITEM_VAZIO);
    setFormAberto(true);
  };

  const editar = (item) => {
    setForm({
      id: item.id,
      descricao: item.descricao || '',
      categoria_id: item.categoria_id || '',
      competencia_orcamento: item.competencia_orcamento || COMPETENCIA_SEDE,
      unidade_medida: sanitizarUnidadeMedida(item.unidade_medida),
      embalagem: item.embalagem || '',
      marca_preferencial: item.marca_preferencial || '',
      observacao: item.observacao || '',
      sinonimos: item.sinonimos || '',
      fator_embalagem: item.fator_embalagem != null ? String(item.fator_embalagem) : '',
      perecivel: Boolean(item.perecivel),
      equivalente_item_id: item.equivalente_item_id || '',
      ativo: item.ativo !== false,
    });
    setFormAberto(true);
  };

  const salvar = async (evento) => {
    evento.preventDefault();
    if (!form.descricao.trim()) return;
    setSalvando(true);
    try {
      await comprasSalvarItemConsumo({
        descricao: form.descricao.trim(),
        categoria_id: form.categoria_id || null,
        competencia_orcamento: form.competencia_orcamento || COMPETENCIA_SEDE,
        unidade_medida: sanitizarUnidadeMedida(form.unidade_medida) || null,
        embalagem: form.embalagem.trim() || null,
        marca_preferencial: form.marca_preferencial.trim() || null,
        observacao: form.observacao.trim() || null,
        sinonimos: form.sinonimos.trim() || null,
        fator_embalagem: form.fator_embalagem === '' ? null : Number(String(form.fator_embalagem).replace(',', '.')),
        perecivel: Boolean(form.perecivel),
        equivalente_item_id: form.equivalente_item_id || null,
        ativo: form.ativo,
      }, form.id || undefined);
      setFormAberto(false);
      onMensagem?.({ ok: form.id ? 'Item atualizado.' : 'Item cadastrado.' });
      await onRecarregar?.();
    } catch (err) {
      onMensagem?.({ erro: err.response?.data?.detail || 'Não foi possível salvar o item.' });
    } finally {
      setSalvando(false);
    }
  };

  const exportar = async () => {
    const ok = await exportarItensConsumo({
      itens: listaFiltrada,
      filtros: {
        Busca: busca,
        Uso: filtroSegmento ? rotuloSegmentoCatalogo(filtroSegmento) : '',
        Competência: filtroCompetencia ? rotuloCompetenciaOrcamento(filtroCompetencia) : '',
        Categoria: categorias.find((c) => c.id === filtroCategoria)?.nome,
        Status: filtroStatus,
      },
    });
    if (!ok) onMensagem?.({ erro: 'Não há itens para exportar com os filtros atuais.' });
  };

  const imprimir = async () => {
    const ok = await imprimirItensConsumo({
      itens: listaFiltrada,
      sede,
      filtros: {
        Busca: busca,
        Uso: filtroSegmento ? rotuloSegmentoCatalogo(filtroSegmento) : '',
        Competência: filtroCompetencia ? rotuloCompetenciaOrcamento(filtroCompetencia) : '',
        Categoria: categorias.find((c) => c.id === filtroCategoria)?.nome,
        Status: filtroStatus,
      },
    });
    if (!ok) onMensagem?.({ erro: 'Não há itens para imprimir com os filtros atuais.' });
  };

  return (
    <>
      <SectionCard
        title="Catálogo de itens"
        subtitle={
          filtrosAtivos
            ? `${listaFiltrada.length} filtrado(s) · ${itens.length} no catálogo`
            : `${itens.length} item${itens.length === 1 ? '' : 's'} no catálogo`
        }
        actions={(
          <div className="flex flex-wrap gap-2">
            {typeof onRecarregar === 'function' ? (
              <PremiumButton
                type="button"
                variant="secondary"
                onClick={() => onRecarregar()}
              >
                <span className="inline-flex items-center gap-1.5">
                  <RefreshCw size={16} />
                  Atualizar
                </span>
              </PremiumButton>
            ) : null}
            <ReportActionButton
              action="export"
              disabled={!listaFiltrada.length}
              onClick={exportar}
            >
              Exportar XLSX
            </ReportActionButton>
            <ReportActionButton
              disabled={!listaFiltrada.length}
              onClick={imprimir}
            >
              Imprimir
            </ReportActionButton>
            {podeEditar ? (
              <PremiumButton type="button" onClick={abrirNovo}>
                <span className="inline-flex items-center gap-1.5">
                  <Plus size={16} />
                  Novo item
                </span>
              </PremiumButton>
            ) : null}
          </div>
        )}
      >
        <div className="px-5 py-4" ref={tabelaTopoRef}>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div className="sm:col-span-2">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Busca</span>
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Comece a digitar a descrição, marca ou categoria"
                  className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-400"
                />
              </div>
            </div>
            <label>
              <span className="mb-1 block text-xs font-semibold text-slate-600">Uso no pedido</span>
              <select
                value={filtroSegmento}
                onChange={(e) => setFiltroSegmento(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              >
                <option value="">Todos</option>
                {SEGMENTOS_CATALOGO.map((seg) => (
                  <option key={seg} value={seg}>{ROTULO_SEGMENTO_CATALOGO[seg]}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-semibold text-slate-600">Competência</span>
              <select
                value={filtroCompetencia}
                onChange={(e) => setFiltroCompetencia(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              >
                <option value="">Todas</option>
                {COMPETENCIAS_ORCAMENTO.map((comp) => (
                  <option key={comp} value={comp}>{ROTULO_COMPETENCIA_ORCAMENTO[comp]}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-semibold text-slate-600">Categoria</span>
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              >
                <option value="">Todas</option>
                {categoriasFiltradas.map((cat) => (
                  <option key={cat.id} value={cat.id}>{rotuloCategoria(cat)}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-semibold text-slate-600">Status</span>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              >
                <option value="ativo">Ativos</option>
                <option value="inativo">Inativos</option>
                <option value="todos">Todos</option>
              </select>
            </label>
          </div>

          {filtrosAtivos ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
              <span>
                Filtros ativos: mostrando <strong>{listaFiltrada.length}</strong> de{' '}
                <strong>{itens.length}</strong> itens do catálogo.
                {listaFiltrada.length <= ITENS_POR_PAGINA && itens.length > ITENS_POR_PAGINA
                  ? ' Limpe a busca/filtros para paginar o catálogo completo.'
                  : null}
              </span>
              <button
                type="button"
                onClick={limparFiltros}
                className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 font-bold text-amber-900 hover:bg-amber-100"
              >
                <X size={14} />
                Limpar filtros
              </button>
            </div>
          ) : null}

          {itens.length === 0 ? (
            <EmptyState
              title="Nenhum item cadastrado"
              subtitle={podeEditar
                ? 'Cadastre o primeiro item do catálogo.'
                : 'Peça à Sede ou ao ADM Pedidos para cadastrar itens.'}
            />
          ) : listaFiltrada.length === 0 ? (
            <EmptyState title="Nenhum resultado" subtitle="Ajuste a busca ou os filtros." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-2">Item</th>
                    <th className="px-2 py-2">Uso</th>
                    <th className="px-2 py-2">Competência</th>
                    <th className="px-2 py-2">Categoria</th>
                    <th className="px-2 py-2">Unidade</th>
                    <th className="px-2 py-2">Embalagem</th>
                    <th className="px-2 py-2">Marca</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {paginaItens.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                      <td className="px-2 py-2.5">
                        <button type="button" className="text-left" onClick={() => setFicha(item)}>
                          <strong className="text-slate-900 hover:text-violet-700">{item.descricao}</strong>
                        </button>
                      </td>
                      <td className="px-2 py-2.5">{rotuloSegmentoCatalogo(item.segmento)}</td>
                      <td className="px-2 py-2.5">{rotuloCompetenciaOrcamento(item.competencia_orcamento)}</td>
                      <td className="px-2 py-2.5">{item.categoria_nome || '—'}</td>
                      <td className="px-2 py-2.5">{item.unidade_medida || '—'}</td>
                      <td className="px-2 py-2.5">{item.embalagem || '—'}</td>
                      <td className="px-2 py-2.5">{item.marca_preferencial || '—'}</td>
                      <td className="px-2 py-2.5">
                        {item.ativo
                          ? <PremiumBadge variant="success">Ativo</PremiumBadge>
                          : <PremiumBadge variant="warning">Inativo</PremiumBadge>}
                      </td>
                      <td className="px-2 py-2.5 text-right">
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
                          {podeEditar ? (
                            <button
                              type="button"
                              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                              title="Editar"
                              aria-label={`Editar ${item.descricao}`}
                              onClick={() => editar(item)}
                            >
                              <Pencil size={16} />
                            </button>
                          ) : null}
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
                Exibindo {inicio + 1} a {Math.min(inicio + ITENS_POR_PAGINA, listaFiltrada.length)} de {listaFiltrada.length} item{listaFiltrada.length === 1 ? '' : 's'}
                {filtrosAtivos ? ` (filtro · ${itens.length} no catálogo)` : ''}
                {' · '}
                {ITENS_POR_PAGINA} por página.
              </p>
              <div className="flex items-center justify-between gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={() => irParaPagina(paginaSegura - 1)}
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
                  onClick={() => irParaPagina(paginaSegura + 1)}
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

      {formAberto && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="form-item-consumo-titulo"
          onClick={() => setFormAberto(false)}
        >
          <form
            className="flex w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(evento) => evento.stopPropagation()}
            onSubmit={salvar}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <h2 id="form-item-consumo-titulo" className="text-lg font-bold text-slate-900">
                {form.id ? 'Editar item' : 'Novo item'}
              </h2>
              <button
                type="button"
                onClick={() => setFormAberto(false)}
                className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
              >
                Fechar
              </button>
            </div>
            <div className="space-y-3 px-5 py-4">
              <CampoTexto
                label="Descrição"
                value={form.descricao}
                onChange={(valor) => setForm((atual) => ({ ...atual, descricao: valor }))}
                required
              />
              <CampoSelect
                label="Categoria"
                value={form.categoria_id}
                onChange={(valor) => {
                  const cat = categorias.find((c) => c.id === valor);
                  setForm((atual) => ({
                    ...atual,
                    categoria_id: valor,
                    competencia_orcamento: competenciaPadraoDoSegmento(cat?.segmento),
                  }));
                }}
                options={categorias.map((cat) => ({
                  value: cat.id,
                  label: `${rotuloCategoria(cat)} · ${rotuloSegmentoCatalogo(cat.segmento)}`,
                }))}
                placeholder="Selecione"
              />
              <CampoSelect
                label="Competência de orçamento"
                value={form.competencia_orcamento || COMPETENCIA_SEDE}
                onChange={(valor) => setForm((atual) => ({ ...atual, competencia_orcamento: valor }))}
                options={COMPETENCIAS_ORCAMENTO.map((comp) => ({
                  value: comp,
                  label: ROTULO_COMPETENCIA_ORCAMENTO[comp],
                }))}
              />
              <div className="grid gap-3 md:grid-cols-2">
                <CampoSelect
                  label="Unidade de medida"
                  value={form.unidade_medida}
                  onChange={(valor) => setForm((atual) => ({ ...atual, unidade_medida: valor }))}
                  options={UNIDADES_MEDIDA_ITEM}
                  placeholder="Selecione"
                />
                <CampoTexto
                  label="Embalagem"
                  value={form.embalagem}
                  onChange={(valor) => setForm((atual) => ({ ...atual, embalagem: valor }))}
                  placeholder="Ex.: fardo com 12 · PCT 2 kg"
                />
                <CampoTexto
                  label="Marca preferencial"
                  value={form.marca_preferencial}
                  onChange={(valor) => setForm((atual) => ({ ...atual, marca_preferencial: valor }))}
                />
                <CampoTexto
                  label="Quantidade na embalagem"
                  value={form.fator_embalagem}
                  onChange={(valor) => setForm((atual) => ({
                    ...atual,
                    fator_embalagem: digitarQuantidadeEmbalagem(valor),
                  }))}
                  placeholder="Ex.: 12"
                  inputMode="decimal"
                />
              </div>
              <p className="-mt-1 text-xs text-slate-500">
                Quantidade na embalagem: quantas unidades vêm no pacote/fardo/caixa.
                Se for 1 (ou a granel), deixe 1 ou vazio.
              </p>
              <CampoTexto
                label="Sinônimos / nomes equivalentes"
                value={form.sinonimos}
                onChange={(valor) => setForm((atual) => ({ ...atual, sinonimos: valor }))}
                placeholder="Separe por vírgula. Ex.: papel toalha, toalha interfolha"
              />
              <CampoSelect
                label="Item equivalente (opcional)"
                value={form.equivalente_item_id}
                onChange={(valor) => setForm((atual) => ({ ...atual, equivalente_item_id: valor }))}
                options={itens
                  .filter((item) => item.id !== form.id)
                  .map((item) => ({ value: item.id, label: item.descricao }))}
                placeholder="Nenhum"
              />
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={Boolean(form.perecivel)}
                  onChange={(e) => setForm((atual) => ({ ...atual, perecivel: e.target.checked }))}
                />
                Perecível
              </label>
              <CampoTexto
                label="Observação"
                value={form.observacao}
                onChange={(valor) => setForm((atual) => ({ ...atual, observacao: valor }))}
              />
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(e) => setForm((atual) => ({ ...atual, ativo: e.target.checked }))}
                />
                Ativo
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <PremiumButton type="button" variant="secondary" onClick={() => setFormAberto(false)}>
                Cancelar
              </PremiumButton>
              <PremiumButton type="submit" disabled={salvando}>
                {salvando ? 'Salvando…' : 'Salvar'}
              </PremiumButton>
            </div>
          </form>
        </div>
      )}

      <ModalFichaItemConsumo
        item={ficha}
        onFechar={() => setFicha(null)}
        onEditar={podeEditar ? (item) => {
          setFicha(null);
          editar(item);
        } : undefined}
      />
    </>
  );
}
