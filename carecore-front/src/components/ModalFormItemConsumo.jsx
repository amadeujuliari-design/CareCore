import { useEffect, useRef, useState } from 'react';

import { CampoSelect, CampoTexto } from './UsuariosCampos';
import { PremiumButton } from './PremiumUI';
import { useFecharSoNoBackdrop } from '../hooks/useFecharSoNoBackdrop';
import { comprasSalvarItemConsumo } from '../services/comprasService';
import { digitarQuantidadeEmbalagem, sanitizarUnidadeMedida, UNIDADES_MEDIDA_ITEM } from '../utils/comprasItensConsumoUtils';
import { rotuloCategoria } from '../utils/comprasCategoriaUtils';
import {
  COMPETENCIA_SEDE,
  COMPETENCIAS_ORCAMENTO,
  ROTULO_COMPETENCIA_ORCAMENTO,
  competenciaPadraoDoSegmento,
  rotuloSegmentoCatalogo,
} from '../utils/comprasPedidoTipos';
import { obterMensagemErro } from '../utils/usuariosUtils';

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

function formDeItem(item, descricaoInicial, competenciaInicial) {
  if (!item) {
    return {
      ...ITEM_VAZIO,
      descricao: descricaoInicial || '',
      competencia_orcamento: competenciaInicial || COMPETENCIA_SEDE,
    };
  }
  return {
    id: item.id || '',
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
  };
}

export default function ModalFormItemConsumo({
  aberto = false,
  item = null,
  descricaoInicial = '',
  competenciaInicial = '',
  categorias = [],
  itens = [],
  onFechar,
  onSalvo,
  onMensagem,
}) {
  const [form, setForm] = useState(ITEM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const estavaAberto = useRef(false);
  const { onMouseDownBackdrop, onClickBackdrop } = useFecharSoNoBackdrop(() => onFechar?.());

  useEffect(() => {
    if (aberto && !estavaAberto.current) {
      setErro('');
      setForm(formDeItem(item, descricaoInicial, competenciaInicial));
    }
    estavaAberto.current = aberto;
  }, [aberto, item, descricaoInicial, competenciaInicial]);

  useEffect(() => {
    if (!aberto) return undefined;
    const aoTeclar = (evento) => {
      if (evento.key === 'Escape') onFechar?.();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  const salvar = async (evento) => {
    evento.preventDefault();
    evento.stopPropagation();
    if (!form.descricao.trim()) return;
    setSalvando(true);
    setErro('');
    try {
      const criado = await comprasSalvarItemConsumo({
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
      localStorage.setItem('compras-catalogo-atualizado', String(Date.now()));
      onMensagem?.({ ok: form.id ? 'Item atualizado.' : 'Item cadastrado.' });
      await onSalvo?.(criado);
    } catch (err) {
      setErro(obterMensagemErro(err, 'Não foi possível salvar o item.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="form-item-consumo-titulo"
      onMouseDown={onMouseDownBackdrop}
      onClick={onClickBackdrop}
    >
      <form
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(evento) => evento.stopPropagation()}
        onSubmit={salvar}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h2 id="form-item-consumo-titulo" className="text-lg font-bold text-slate-900">
            {form.id ? 'Editar item' : 'Novo item'}
          </h2>
          <button
            type="button"
            onClick={() => onFechar?.()}
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
          >
            Fechar
          </button>
        </div>
        <div className="space-y-3 overflow-y-auto px-5 py-4">
          {erro ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{erro}</p>
          ) : null}
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
              .filter((linha) => linha.id !== form.id)
              .map((linha) => ({ value: linha.id, label: linha.descricao }))}
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
          <PremiumButton type="button" variant="secondary" onClick={() => onFechar?.()}>
            Cancelar
          </PremiumButton>
          <PremiumButton type="submit" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </PremiumButton>
        </div>
      </form>
    </div>
  );
}
