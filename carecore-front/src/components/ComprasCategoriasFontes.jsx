import { useMemo, useState } from 'react';

import { CampoSelect, CampoTexto } from './UsuariosCampos';
import { EmptyState, PremiumBadge, PremiumButton, SectionCard } from './PremiumUI';
import { comprasSalvarCategoria, comprasSalvarFonte } from '../services/comprasService';
import { conflitosNomeCadastro } from '../utils/comprasCategoriaUtils';
import {
  ROTULO_SEGMENTO_CATALOGO,
  SEGMENTO_CONSUMO,
  SEGMENTOS_CATALOGO,
  rotuloSegmentoCatalogo,
} from '../utils/comprasPedidoTipos';

const FONTES_TIPO_OPCOES = [
  { value: 'convenio', label: 'Convênio' },
  { value: 'emenda', label: 'Emenda parlamentar' },
  { value: 'custo_indireto', label: 'Custo indireto' },
  { value: 'proprio', label: 'Recurso próprio' },
  { value: 'doacao', label: 'Doação' },
  { value: 'outros', label: 'Outros' },
];

const SEGMENTO_OPCOES = SEGMENTOS_CATALOGO.map((value) => ({
  value,
  label: ROTULO_SEGMENTO_CATALOGO[value],
}));

function rotuloTipoFonte(tipo) {
  return FONTES_TIPO_OPCOES.find((item) => item.value === tipo)?.label || tipo || '—';
}

function ListaNomes({
  titulo,
  ajuda,
  itens,
  colunaUso,
  campoNovo,
  tipo,
  podeEditar,
  onSalvar,
  onAtualizarSegmento,
}) {
  const [nome, setNome] = useState('');
  const [segmento, setSegmento] = useState(SEGMENTO_CONSUMO);
  const [tipoFonte, setTipoFonte] = useState('outros');
  const [vigenciaInicio, setVigenciaInicio] = useState('');
  const [vigenciaFim, setVigenciaFim] = useState('');
  const [salvando, setSalvando] = useState(false);
  const semelhantes = useMemo(
    () => conflitosNomeCadastro(nome, itens.map((item) => item.nome)),
    [nome, itens],
  );

  const enviar = async (evento) => {
    evento.preventDefault();
    const valor = nome.trim();
    if (!valor || semelhantes.length) return;
    setSalvando(true);
    try {
      if (tipo === 'fonte') {
        await onSalvar({
          nome: valor,
          tipo: tipoFonte,
          vigencia_inicio: vigenciaInicio || null,
          vigencia_fim: vigenciaFim || null,
        });
      } else if (tipo === 'categoria') {
        await onSalvar({ nome: valor, segmento });
      } else {
        await onSalvar(valor);
      }
      setNome('');
      setSegmento(SEGMENTO_CONSUMO);
      setTipoFonte('outros');
      setVigenciaInicio('');
      setVigenciaFim('');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <SectionCard title={titulo}>
      <div className="px-5 py-4">
        <p className="mb-4 text-sm text-slate-600">{ajuda}</p>
        {podeEditar ? (
          <form className="mb-4 space-y-2" onSubmit={enviar}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <CampoTexto
                  label={campoNovo}
                  value={nome}
                  onChange={setNome}
                  placeholder="Digite para ver se já existe"
                />
              </div>
              {tipo === 'categoria' ? (
                <div className="sm:w-56">
                  <CampoSelect
                    label="Uso no pedido"
                    value={segmento}
                    onChange={setSegmento}
                    options={SEGMENTO_OPCOES}
                  />
                </div>
              ) : null}
              {tipo === 'fonte' ? (
                <div className="sm:w-56">
                  <CampoSelect
                    label="Tipo"
                    value={tipoFonte}
                    onChange={setTipoFonte}
                    options={FONTES_TIPO_OPCOES}
                  />
                </div>
              ) : null}
              <PremiumButton type="submit" disabled={salvando || !nome.trim() || semelhantes.length > 0}>
                Cadastrar
              </PremiumButton>
            </div>
            {tipo === 'fonte' ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <CampoTexto
                  label="Vigência inicial (opcional)"
                  type="date"
                  value={vigenciaInicio}
                  onChange={setVigenciaInicio}
                />
                <CampoTexto
                  label="Vigência final (opcional)"
                  type="date"
                  value={vigenciaFim}
                  onChange={setVigenciaFim}
                />
              </div>
            ) : null}
            {semelhantes.length > 0 ? (
              <p className="text-sm text-amber-800">
                Já existe {tipo} semelhante: {semelhantes.map((item) => `"${item}"`).join(', ')}.
                Use a existente para não duplicar.
              </p>
            ) : null}
          </form>
        ) : null}

        {itens.length === 0 ? (
          <EmptyState title={`Nenhuma ${tipo}`} subtitle="Cadastre a primeira." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2">Nome</th>
                  {tipo === 'categoria' ? <th className="px-2 py-2">Uso no pedido</th> : null}
                  {tipo === 'fonte' ? <th className="px-2 py-2">Tipo</th> : null}
                  {tipo === 'fonte' ? <th className="px-2 py-2">Vigência</th> : null}
                  <th className="px-2 py-2">{colunaUso}</th>
                  <th className="px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-2 py-2.5 font-medium text-slate-900">{item.nome}</td>
                    {tipo === 'categoria' ? (
                      <td className="px-2 py-2.5">
                        {podeEditar && onAtualizarSegmento ? (
                          <select
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm"
                            value={item.segmento || SEGMENTO_CONSUMO}
                            onChange={(e) => onAtualizarSegmento(item, e.target.value)}
                          >
                            {SEGMENTO_OPCOES.map((op) => (
                              <option key={op.value} value={op.value}>{op.label}</option>
                            ))}
                          </select>
                        ) : (
                          rotuloSegmentoCatalogo(item.segmento)
                        )}
                      </td>
                    ) : null}
                    {tipo === 'fonte' ? (
                      <td className="px-2 py-2.5">{rotuloTipoFonte(item.tipo)}</td>
                    ) : null}
                    {tipo === 'fonte' ? (
                      <td className="px-2 py-2.5">
                        {[item.vigencia_inicio, item.vigencia_fim].filter(Boolean).join(' a ') || '—'}
                      </td>
                    ) : null}
                    <td className="px-2 py-2.5">{Number(item.qtd_uso) || 0}</td>
                    <td className="px-2 py-2.5">
                      {item.ativo === false
                        ? <PremiumBadge variant="warning">Inativo</PremiumBadge>
                        : Number(item.qtd_uso) > 0
                          ? <PremiumBadge variant="success">Em uso</PremiumBadge>
                          : <PremiumBadge>Sem uso</PremiumBadge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

export default function ComprasCategoriasFontes({
  categorias = [],
  fontes = [],
  podeEditar = false,
  mostrarFontes = true,
  onRecarregar,
  onMensagem,
}) {
  const categoriasLista = useMemo(
    () => categorias.map((item) => ({ ...item, qtd_uso: item.qtd_itens })),
    [categorias],
  );
  const fontesLista = useMemo(
    () => fontes.map((item) => ({ ...item, qtd_uso: item.qtd_pedidos })),
    [fontes],
  );

  const salvarCategoria = async (payload) => {
    try {
      const corpo = typeof payload === 'string' ? { nome: payload } : payload;
      await comprasSalvarCategoria(corpo);
      onMensagem?.({ ok: 'Categoria cadastrada.' });
      await onRecarregar?.();
    } catch (err) {
      onMensagem?.({ erro: err.response?.data?.detail || 'Não foi possível cadastrar a categoria.' });
    }
  };

  const atualizarSegmento = async (item, segmento) => {
    try {
      await comprasSalvarCategoria({ nome: item.nome, segmento, ativo: item.ativo !== false }, item.id);
      onMensagem?.({ ok: `Categoria «${item.nome}» → ${rotuloSegmentoCatalogo(segmento)}.` });
      await onRecarregar?.();
    } catch (err) {
      onMensagem?.({ erro: err.response?.data?.detail || 'Não foi possível atualizar o uso da categoria.' });
    }
  };

  const salvarFonte = async (payload) => {
    try {
      const corpo = typeof payload === 'string' ? { nome: payload } : payload;
      await comprasSalvarFonte(corpo);
      onMensagem?.({ ok: 'Fonte cadastrada.' });
      await onRecarregar?.();
    } catch (err) {
      onMensagem?.({ erro: err.response?.data?.detail || 'Não foi possível cadastrar a fonte.' });
    }
  };

  return (
    <div className="space-y-4">
      <ListaNomes
        titulo="Categorias do catálogo"
        ajuda="Cada categoria tem um uso no pedido: Consumo (janela), Manutenção, Bem/imobilizado ou Serviço. No pedido, a busca só mostra itens do mesmo uso. Carne e Peixe devem ser categorias próprias (uso Consumo) para a janela separar certo."
        itens={categoriasLista}
        colunaUso="Itens"
        campoNovo="Nova categoria"
        tipo="categoria"
        podeEditar={podeEditar}
        onSalvar={salvarCategoria}
        onAtualizarSegmento={atualizarSegmento}
      />
      {mostrarFontes ? (
        <ListaNomes
          titulo="Fontes de recurso"
          ajuda="Fonte é a origem do dinheiro do pedido (convênio, emenda, recurso próprio). Não vem da planilha de itens."
          itens={fontesLista}
          colunaUso="Pedidos"
          campoNovo="Nova fonte"
          tipo="fonte"
          podeEditar={podeEditar}
          onSalvar={salvarFonte}
        />
      ) : null}
    </div>
  );
}
