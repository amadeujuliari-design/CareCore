import { useMemo, useState } from 'react';

import { CampoSelect, CampoTexto } from './UsuariosCampos';
import { EmptyState, PremiumBadge, PremiumButton, SectionCard } from './PremiumUI';
import { comprasSalvarCategoria, comprasSalvarFonte } from '../services/comprasService';
import { conflitosNomeCadastro } from '../utils/comprasCategoriaUtils';

const FONTES_TIPO_OPCOES = [
  { value: 'convenio', label: 'Convênio' },
  { value: 'emenda', label: 'Emenda parlamentar' },
  { value: 'custo_indireto', label: 'Custo indireto' },
  { value: 'proprio', label: 'Recurso próprio' },
  { value: 'doacao', label: 'Doação' },
  { value: 'outros', label: 'Outros' },
];

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
}) {
  const [nome, setNome] = useState('');
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
      await onSalvar(
        tipo === 'fonte'
          ? { nome: valor, tipo: tipoFonte, vigencia_inicio: vigenciaInicio || null, vigencia_fim: vigenciaFim || null }
          : valor,
      );
      setNome('');
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

  const salvarCategoria = async (nome) => {
    try {
      await comprasSalvarCategoria({ nome });
      onMensagem?.({ ok: 'Categoria cadastrada.' });
      await onRecarregar?.();
    } catch (err) {
      onMensagem?.({ erro: err.response?.data?.detail || 'Não foi possível cadastrar a categoria.' });
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
        titulo="Categorias dos itens"
        ajuda="A lista abaixo é a mesma usada nos itens de consumo. Antes de criar outra, confira se o produto já se encaixa em uma existente — nomes parecidos (Higiene / Higiene e limpeza) geram filtro duplicado."
        itens={categoriasLista}
        colunaUso="Itens"
        campoNovo="Nova categoria"
        tipo="categoria"
        podeEditar={podeEditar}
        onSalvar={salvarCategoria}
      />
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
    </div>
  );
}
