import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Sidebar from './Sidebar';
import {
  AppShell,
  MainShell,
  PageHeader,
  PremiumButton,
  ScrollArea,
  SectionCard,
} from './components/PremiumUI';
import { useAuth } from './context/AuthContext';
import {
  comprasCategorias,
  comprasCriarPedido,
  comprasFontes,
  comprasItensConsumo,
  comprasUnidades,
} from './services/comprasService';
import ComprasItemTypeahead from './components/ComprasItemTypeahead';
import ModalFormItemConsumo from './components/ModalFormItemConsumo';
import {
  BOTOES_NOVO_PEDIDO,
  SEGMENTO_SERVICO,
  TIPO_CONSUMO,
  TIPO_HORTIFRUTI,
  TIPO_IMOBILIZADO,
  TIPO_MANUTENCAO,
  TIPO_SERVICO,
  competenciaPadraoDoSegmento,
  itensConsumoDoSegmentoPedido,
  rotuloTipoPedido,
  segmentoDoTipoPedido,
  tipoEhCotacaoProjeto,
} from './utils/comprasPedidoTipos';
import { unidadeParaPedido } from './utils/comprasItensConsumoUtils';

const inputClass = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm';

function hojeIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function linhaItemVazia() {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    descricao: '',
    quantidade: '1',
    unidade_medida: 'un',
    catalogo_item_id: '',
    embalagem: '',
    marca_preferencial: '',
    categoria_id: '',
  };
}

export default function ComprasPedidoNovo() {
  const { tipo: tipoParam } = useParams();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const sede = Boolean(usuario?.is_manutencao)
    || ['ADM Compras', 'ADM Global', 'Global'].includes(usuario?.perfil_acesso);

  const tipo = String(tipoParam || '').toLowerCase();
  const meta = BOTOES_NOVO_PEDIDO.find((b) => b.tipo === tipo);
  const cotacaoProjeto = tipoEhCotacaoProjeto(tipo);

  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [fontes, setFontes] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [itensConsumo, setItensConsumo] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [modalItem, setModalItem] = useState(null);

  const [form, setForm] = useState({
    destino: 'projeto',
    instituicao_id: '',
    titulo: '',
    justificativa: '',
    urgencia: 'normal',
    data_desejada: hojeIso(),
    local_texto: '',
    fonte_recurso_id: '',
    valor_estimado_reais: '',
    defeito: '',
    tipo_manutencao: 'corretiva',
    escopo_servico: '',
    observacao: '',
  });
  const [linhas, setLinhas] = useState(() => [linhaItemVazia()]);

  useEffect(() => {
    if (!meta) return undefined;
    let alive = true;
    (async () => {
      try {
        const [f, u, cats] = await Promise.all([
          comprasFontes(),
          sede ? comprasUnidades() : Promise.resolve([]),
          comprasCategorias(),
        ]);
        if (!alive) return;
        setFontes(Array.isArray(f) ? f : (f?.itens || []));
        setUnidades(Array.isArray(u) ? u : (u?.itens || []));
        setCategorias(Array.isArray(cats) ? cats : []);
        if (tipo === TIPO_CONSUMO || tipo === TIPO_HORTIFRUTI || tipo === TIPO_MANUTENCAO || tipo === TIPO_IMOBILIZADO || tipo === TIPO_SERVICO) {
          const itens = await comprasItensConsumo();
          if (alive) setItensConsumo(Array.isArray(itens) ? itens : (itens?.itens || []));
        }
      } catch (e) {
        if (alive) setErro(e?.response?.data?.detail || 'Não foi possível carregar o formulário.');
      }
    })();
    return () => { alive = false; };
  }, [meta, sede, tipo]);

  useEffect(() => {
    const aoAtualizarCatalogo = async (evento) => {
      if (evento.key !== 'compras-catalogo-atualizado') return;
      if (![TIPO_CONSUMO, TIPO_HORTIFRUTI, TIPO_MANUTENCAO, TIPO_IMOBILIZADO, TIPO_SERVICO].includes(tipo)) return;
      try {
        const itens = await comprasItensConsumo();
        setItensConsumo(Array.isArray(itens) ? itens : (itens?.itens || []));
      } catch {
        /* o pedido aberto permanece; a busca atualiza na próxima abertura */
      }
    };
    window.addEventListener('storage', aoAtualizarCatalogo);
    return () => window.removeEventListener('storage', aoAtualizarCatalogo);
  }, [tipo]);

  if (!meta) {
    return (
      <AppShell>
        <Sidebar />
        <MainShell>
          <PageHeader title="Tipo inválido" />
          <p className="p-4 text-sm text-slate-600">
            Escolha um tipo em{' '}
            <Link className="font-semibold text-brand underline" to="/compras">Pedidos</Link>.
          </p>
        </MainShell>
      </AppShell>
    );
  }

  const atualizar = (campo, valor) => setForm((a) => ({ ...a, [campo]: valor }));

  const atualizarLinha = (key, patch) => {
    setLinhas((lista) => lista.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const adicionarLinha = () => setLinhas((lista) => [...lista, linhaItemVazia()]);

  const removerLinha = (key) => {
    setLinhas((lista) => (lista.length <= 1 ? lista : lista.filter((l) => l.key !== key)));
  };

  const criar = async (event) => {
    event.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      const itens = linhas
        .filter((l) => (l.descricao || '').trim())
        .map((l) => ({
          descricao: l.descricao.trim(),
          quantidade: Number(String(l.quantidade).replace(',', '.')) || 1,
          unidade_medida: l.unidade_medida || 'un',
          catalogo_item_id: l.catalogo_item_id || undefined,
          embalagem: l.embalagem || undefined,
          marca_preferencial: l.marca_preferencial || undefined,
          categoria_id: l.categoria_id || undefined,
        }));

      if (itens.some((l) => !l.catalogo_item_id)) {
        setErro('Só entram itens que já estão no catálogo. Cadastre o que falta e escolha-o na lista.');
        setSalvando(false);
        return;
      }

      if (!form.fonte_recurso_id) {
        setErro('Selecione a fonte da verba (Convênio ou Custo indireto).');
        setSalvando(false);
        return;
      }

      if (tipo === TIPO_CONSUMO && !itens.length) {
        setErro('Inclua ao menos um item do catálogo.');
        setSalvando(false);
        return;
      }

      const payload = {
        tipo,
        observacao: form.observacao.trim() || undefined,
        fonte_recurso_id: form.fonte_recurso_id || undefined,
        itens,
      };

      if (sede) {
        payload.escopo_unidade = form.destino === 'sede' ? 'sede' : 'projeto';
        if (form.destino === 'projeto') {
          if (!form.instituicao_id) {
            setErro('Selecione a unidade.');
            setSalvando(false);
            return;
          }
          payload.instituicao_id = form.instituicao_id;
        }
      }

      if (cotacaoProjeto) {
        payload.titulo = form.titulo.trim();
        payload.justificativa = form.justificativa.trim();
        payload.urgencia = form.urgencia;
        payload.data_desejada = form.data_desejada;
        payload.local_texto = form.local_texto.trim() || undefined;
        if (form.valor_estimado_reais !== '') {
          payload.valor_estimado_reais = Number(String(form.valor_estimado_reais).replace(',', '.'));
        }
        if (tipo === TIPO_MANUTENCAO) {
          payload.defeito = form.defeito.trim();
          payload.tipo_manutencao = form.tipo_manutencao;
        }
        if (tipo === TIPO_SERVICO) {
          payload.escopo_servico = form.escopo_servico.trim();
        }
      }

      const criado = await comprasCriarPedido(payload);
      const id = criado?.id || criado?.pedido?.id;
      if (!id) throw new Error('Resposta sem id do pedido.');
      navigate(`/compras/pedidos/${id}`);
    } catch (e) {
      setErro(e?.response?.data?.detail || e.message || 'Não foi possível criar o pedido.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          title={`Novo pedido — ${rotuloTipoPedido(tipo)}`}
          subtitle={meta.descricao}
          actions={(
            <Link to="/compras" className="text-sm font-semibold text-slate-600 underline">
              Voltar à lista
            </Link>
          )}
        />
        <ScrollArea>
          <form onSubmit={criar} className="mx-auto max-w-3xl space-y-4 p-4 pb-16">
            {erro ? (
              <div className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{erro}</div>
            ) : null}

            <SectionCard title="Fonte da verba">
              <label>
                <span className="mb-1 block text-xs font-semibold text-slate-600">Convênio ou custo indireto *</span>
                <select
                  className={inputClass}
                  value={form.fonte_recurso_id}
                  onChange={(e) => atualizar('fonte_recurso_id', e.target.value)}
                  required
                >
                  <option value="">Selecione…</option>
                  {fontes.map((f) => (
                    <option key={f.id} value={f.id}>{f.nome}</option>
                  ))}
                </select>
              </label>
            </SectionCard>

            {sede ? (
              <SectionCard title="Unidade">
                <div className="grid gap-3 md:grid-cols-2">
                  <label>
                    <span className="mb-1 block text-xs font-semibold text-slate-600">Destino</span>
                    <select
                      className={inputClass}
                      value={form.destino}
                      onChange={(e) => atualizar('destino', e.target.value)}
                    >
                      <option value="projeto">Unidade / projeto</option>
                      <option value="sede">Sede (matriz)</option>
                    </select>
                  </label>
                  {form.destino === 'projeto' ? (
                    <label>
                      <span className="mb-1 block text-xs font-semibold text-slate-600">Unidade *</span>
                      <select
                        className={inputClass}
                        value={form.instituicao_id}
                        onChange={(e) => atualizar('instituicao_id', e.target.value)}
                        required
                      >
                        <option value="">Selecione…</option>
                        {unidades.map((u) => (
                          <option key={u.id} value={u.id}>{u.nome || u.nome_fantasia}</option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </div>
              </SectionCard>
            ) : null}

            {cotacaoProjeto ? (
              <SectionCard title="Cabeçalho">
                <div className="space-y-3">
                  <label>
                    <span className="mb-1 block text-xs font-semibold text-slate-600">Título / objeto *</span>
                    <input
                      className={inputClass}
                      value={form.titulo}
                      onChange={(e) => atualizar('titulo', e.target.value)}
                      required
                      placeholder="Ex.: Troca de compressor da geladeira"
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs font-semibold text-slate-600">Justificativa *</span>
                    <textarea
                      className={inputClass}
                      rows={3}
                      value={form.justificativa}
                      onChange={(e) => atualizar('justificativa', e.target.value)}
                      required
                      placeholder="Por que esta compra/serviço é necessária"
                    />
                  </label>
                  <div className="grid gap-3 md:grid-cols-3">
                    <label>
                      <span className="mb-1 block text-xs font-semibold text-slate-600">Urgência</span>
                      <select
                        className={inputClass}
                        value={form.urgencia}
                        onChange={(e) => atualizar('urgencia', e.target.value)}
                      >
                        <option value="normal">Normal</option>
                        <option value="urgente">Urgente</option>
                      </select>
                    </label>
                    <label>
                      <span className="mb-1 block text-xs font-semibold text-slate-600">Data desejada *</span>
                      <input
                        type="date"
                        className={inputClass}
                        value={form.data_desejada}
                        onChange={(e) => atualizar('data_desejada', e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      <span className="mb-1 block text-xs font-semibold text-slate-600">Valor estimado (R$)</span>
                      <input
                        className={inputClass}
                        value={form.valor_estimado_reais}
                        onChange={(e) => atualizar('valor_estimado_reais', e.target.value)}
                        placeholder="Opcional"
                        inputMode="decimal"
                      />
                    </label>
                  </div>
                  <label>
                    <span className="mb-1 block text-xs font-semibold text-slate-600">Local (se diferente do projeto)</span>
                    <input
                      className={inputClass}
                      value={form.local_texto}
                      onChange={(e) => atualizar('local_texto', e.target.value)}
                      placeholder="Endereço ou local de execução"
                    />
                  </label>
                </div>
              </SectionCard>
            ) : null}

            {tipo === TIPO_MANUTENCAO ? (
              <SectionCard title="Itens de manutenção">
                <div className="space-y-3">
                  <label>
                    <span className="mb-1 block text-xs font-semibold text-slate-600">Tipo</span>
                    <select
                      className={inputClass}
                      value={form.tipo_manutencao}
                      onChange={(e) => atualizar('tipo_manutencao', e.target.value)}
                    >
                      <option value="corretiva">Corretiva</option>
                      <option value="preventiva">Preventiva</option>
                    </select>
                  </label>
                  <label>
                    <span className="mb-1 block text-xs font-semibold text-slate-600">Defeito / sintoma *</span>
                    <textarea
                      className={inputClass}
                      rows={3}
                      value={form.defeito}
                      onChange={(e) => atualizar('defeito', e.target.value)}
                      required
                      placeholder="O que está acontecendo com o equipamento"
                    />
                  </label>
                </div>
              </SectionCard>
            ) : null}

            {tipo === TIPO_SERVICO ? (
              <SectionCard title="Escopo do serviço">
                <label>
                  <span className="mb-1 block text-xs font-semibold text-slate-600">Descrição do escopo *</span>
                  <textarea
                    className={inputClass}
                    rows={4}
                    value={form.escopo_servico}
                    onChange={(e) => atualizar('escopo_servico', e.target.value)}
                    required
                    placeholder="O que o prestador deve entregar"
                  />
                </label>
              </SectionCard>
            ) : null}

            <SectionCard
              title="Observação do pedido"
              subtitle="Opcional. Em consumo, o texto segue para todos os pedidos quando a Sede divide por categoria."
            >
              <label>
                <span className="mb-1 block text-xs font-semibold text-slate-600">Observação</span>
                <textarea
                  className={inputClass}
                  rows={3}
                  value={form.observacao}
                  onChange={(e) => atualizar('observacao', e.target.value)}
                  placeholder="Ex.: entregar pela manhã; preferência de marca; restrição de fornecedor…"
                />
              </label>
            </SectionCard>

            <SectionCard title={tipo === TIPO_SERVICO ? 'Itens (opcional agora)' : 'Itens'}>
              <div className="space-y-3">
                {linhas.map((linha, idx) => (
                  <div
                    key={linha.key}
                    className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 md:grid-cols-12"
                  >
                    <div className="md:col-span-6">
                        <span className="mb-1 block text-xs font-semibold text-slate-600">
                          Item {idx + 1}
                        </span>
                        <ComprasItemTypeahead
                          className="w-full"
                          itens={
                            tipo === TIPO_SERVICO
                              ? itensConsumo.filter((item) => (item.segmento || '') === 'servico')
                              : itensConsumoDoSegmentoPedido(itensConsumo, tipo)
                          }
                          value={linha.descricao}
                          placeholder={
                            tipo === TIPO_CONSUMO
                              ? 'Digite o item de consumo'
                              : tipo === TIPO_MANUTENCAO
                                ? 'Buscar peça/material de manutenção'
                                : tipo === TIPO_SERVICO
                                  ? 'Buscar serviço no catálogo'
                                  : tipo === TIPO_HORTIFRUTI
                                    ? 'Buscar item de hortifruti'
                                    : 'Buscar bem no catálogo'
                          }
                          onChange={(valor) => atualizarLinha(linha.key, {
                            descricao: valor,
                            catalogo_item_id: '',
                          })}
                          onCadastrar={(texto) => setModalItem({ linhaKey: linha.key, descricao: texto })}
                          onEscolher={(item) => atualizarLinha(linha.key, item ? {
                            catalogo_item_id: item.id,
                            descricao: item.descricao,
                            unidade_medida: unidadeParaPedido(item),
                            embalagem: item.embalagem || '',
                            marca_preferencial: item.marca_preferencial || '',
                            categoria_id: item.categoria_id || '',
                          } : { catalogo_item_id: '' })}
                        />
                      </div>
                    <label className="md:col-span-2">
                      <span className="mb-1 block text-xs font-semibold text-slate-600">Qtd</span>
                      <input
                        className={inputClass}
                        value={linha.quantidade}
                        onChange={(e) => atualizarLinha(linha.key, { quantidade: e.target.value })}
                      />
                    </label>
                    <label className="md:col-span-2">
                      <span className="mb-1 block text-xs font-semibold text-slate-600">Unidade</span>
                      <input
                        className={inputClass}
                        value={linha.unidade_medida}
                        onChange={(e) => atualizarLinha(linha.key, { unidade_medida: e.target.value })}
                      />
                    </label>
                    <div className="flex items-end md:col-span-2">
                      {linhas.length > 1 ? (
                        <PremiumButton
                          type="button"
                          variant="secondary"
                          className="w-full"
                          onClick={() => removerLinha(linha.key)}
                        >
                          Remover
                        </PremiumButton>
                      ) : (
                        <span className="pb-2 text-xs text-slate-400">Linha 1</span>
                      )}
                    </div>
                  </div>
                ))}
                <PremiumButton type="button" variant="secondary" onClick={adicionarLinha}>
                  Adicionar item
                </PremiumButton>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {cotacaoProjeto
                  ? 'Inclua os itens necessários e depois, na ficha, peça orçamento, anexe PDFs e envie à Sede.'
                  : 'Inclua todos os itens da janela e então crie o rascunho. Ainda dá para ajustar na ficha depois.'}
              </p>
            </SectionCard>

            <div className="flex flex-wrap gap-2">
              <PremiumButton type="submit" disabled={salvando}>
                {salvando ? 'Criando…' : 'Criar rascunho'}
              </PremiumButton>
              <Link
                to="/compras"
                className="inline-flex min-h-11 items-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700"
              >
                Cancelar
              </Link>
            </div>
          </form>
        </ScrollArea>
      </MainShell>
      <ModalFormItemConsumo
        aberto={Boolean(modalItem)}
        descricaoInicial={modalItem?.descricao || ''}
        competenciaInicial={competenciaPadraoDoSegmento(
          tipo === TIPO_SERVICO ? SEGMENTO_SERVICO : segmentoDoTipoPedido(tipo),
        )}
        categorias={categorias}
        itens={itensConsumo}
        onFechar={() => setModalItem(null)}
        onMensagem={({ erro: msgErro }) => { if (msgErro) setErro(msgErro); }}
        onSalvo={async (criado) => {
          const lista = await comprasItensConsumo();
          setItensConsumo(Array.isArray(lista) ? lista : []);
          if (modalItem?.linhaKey && criado?.id) {
            atualizarLinha(modalItem.linhaKey, {
              catalogo_item_id: criado.id,
              descricao: criado.descricao || modalItem.descricao,
              unidade_medida: unidadeParaPedido(criado),
              embalagem: criado.embalagem || '',
              marca_preferencial: criado.marca_preferencial || '',
              categoria_id: criado.categoria_id || '',
            });
          }
          setModalItem(null);
          setErro('');
        }}
      />
    </AppShell>
  );
}
