import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Pencil, Plus, Search } from 'lucide-react';

import ModalFichaFornecedor from './ModalFichaFornecedor';
import ModalFormFornecedor from './ModalFormFornecedor';
import { EmptyState, PremiumBadge, PremiumButton, SectionCard } from './PremiumUI';
import { comprasSalvarFornecedor, comprasUnidades } from '../services/comprasService';
import { rotuloProjetosFornecedor } from '../utils/comprasFornecedorUtils';
import {
  formatarTelefoneCompras,
  normalizarTelefoneComprasParaSalvar,
  telefoneComprasValido,
} from '../utils/comprasTelefoneUtils';
import { cnpjValido, formatarCNPJ } from '../utils/nfpCadastroUtils';
import { emailValido, formatarCEP, limparMascara } from '../utils/usuariosUtils';

const FORNECEDOR_VAZIO = {
  id: '',
  nome: '',
  cnpj: '',
  categoria_id: '',
  segmento: '',
  contato: '',
  telefone: '',
  email: '',
  email_empresa: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: 'SP',
  atende_geral: true,
  projeto_ids: [],
  observacao: '',
  ativo: true,
  bloqueado: false,
};

function statusFornecedor(fornecedor) {
  if (fornecedor.bloqueado) return <PremiumBadge variant="danger">Bloqueado</PremiumBadge>;
  if (fornecedor.ativo) return <PremiumBadge variant="success">Ativo</PremiumBadge>;
  return <PremiumBadge variant="warning">Inativo</PremiumBadge>;
}

function textoBusca(fornecedor) {
  return [
    fornecedor.nome,
    fornecedor.cnpj,
    fornecedor.segmento,
    fornecedor.contato,
    fornecedor.telefone,
    fornecedor.email,
    fornecedor.email_empresa,
    rotuloProjetosFornecedor(fornecedor),
  ].join(' ').toLowerCase();
}

export default function ComprasFornecedoresCadastro({
  fornecedores = [],
  categorias = [],
  onRecarregar,
  onMensagem,
}) {
  const [form, setForm] = useState(FORNECEDOR_VAZIO);
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [ficha, setFicha] = useState(null);
  const [formAberto, setFormAberto] = useState(false);
  const [unidades, setUnidades] = useState([]);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('ativo');

  useEffect(() => {
    let ativo = true;
    comprasUnidades()
      .then((itens) => {
        if (ativo && Array.isArray(itens)) setUnidades(itens);
      })
      .catch(() => {});
    return () => { ativo = false; };
  }, []);

  const mapaCategorias = useMemo(
    () => Object.fromEntries(categorias.map((c) => [c.id, c.nome])),
    [categorias],
  );

  const listaFiltrada = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return fornecedores.filter((fornecedor) => {
      if (filtroStatus === 'ativo' && (fornecedor.bloqueado || !fornecedor.ativo)) return false;
      if (filtroStatus === 'inativo' && (fornecedor.bloqueado || fornecedor.ativo !== false)) return false;
      if (filtroStatus === 'bloqueado' && !fornecedor.bloqueado) return false;
      if (termo && !textoBusca(fornecedor).includes(termo)) return false;
      return true;
    });
  }, [busca, filtroStatus, fornecedores]);

  const atualizar = useCallback((campo, valor) => {
    setForm((atual) => ({ ...atual, [campo]: valor }));
    setErros((atual) => ({ ...atual, [campo]: '' }));
  }, []);

  const abrirNovo = useCallback(() => {
    setFicha(null);
    setForm(FORNECEDOR_VAZIO);
    setErros({});
    setFormAberto(true);
  }, []);

  const editar = useCallback((fornecedor) => {
    setFicha(null);
    setForm({
      ...FORNECEDOR_VAZIO,
      ...fornecedor,
      categoria_id: fornecedor.categoria_id || '',
      cnpj: fornecedor.cnpj ? formatarCNPJ(fornecedor.cnpj) : '',
      cep: fornecedor.cep ? formatarCEP(fornecedor.cep) : '',
      uf: fornecedor.uf || 'SP',
      telefone: fornecedor.telefone ? formatarTelefoneCompras(fornecedor.telefone) : '',
      ativo: fornecedor.ativo !== false,
      bloqueado: Boolean(fornecedor.bloqueado),
      atende_geral: fornecedor.atende_geral !== false,
      projeto_ids: Array.isArray(fornecedor.projeto_ids) ? [...fornecedor.projeto_ids] : [],
    });
    setErros({});
    setFormAberto(true);
  }, []);

  const fecharForm = useCallback(() => {
    setFormAberto(false);
    setForm(FORNECEDOR_VAZIO);
    setErros({});
  }, []);

  const validar = useCallback(() => {
    const novos = {};
    if (!form.nome.trim()) novos.nome = 'Informe o nome do fornecedor.';
    if (form.cnpj && !cnpjValido(form.cnpj)) novos.cnpj = 'CNPJ inválido.';
    if (form.email && !emailValido(form.email)) novos.email = 'E-mail inválido.';
    if (form.email_empresa && !emailValido(form.email_empresa)) novos.email_empresa = 'E-mail da empresa inválido.';
    if (form.telefone && !telefoneComprasValido(form.telefone)) novos.telefone = 'Telefone inválido.';
    if (!form.atende_geral && form.projeto_ids.length === 0) {
      novos.projeto_ids = 'Selecione ao menos um projeto ou marque GERAL.';
    }
    setErros(novos);
    return Object.keys(novos).length === 0;
  }, [form]);

  const montarPayload = useCallback(() => ({
    nome: form.nome.trim(),
    categoria_id: form.categoria_id || null,
    cnpj: form.cnpj ? limparMascara(form.cnpj) : null,
    segmento: form.segmento.trim() || null,
    contato: form.contato.trim() || null,
    telefone: form.telefone ? normalizarTelefoneComprasParaSalvar(form.telefone) : null,
    email: form.email.trim() || null,
    email_empresa: form.email_empresa.trim() || null,
    cep: form.cep ? limparMascara(form.cep) : null,
    logradouro: form.logradouro.trim() || null,
    numero: form.numero.trim() || null,
    complemento: form.complemento.trim() || null,
    bairro: form.bairro.trim() || null,
    cidade: form.cidade.trim() || null,
    uf: form.uf.trim().toUpperCase() || null,
    atende_geral: Boolean(form.atende_geral),
    projeto_ids: form.atende_geral ? [] : [...form.projeto_ids],
    observacao: form.observacao.trim() || null,
    ativo: Boolean(form.ativo),
    bloqueado: Boolean(form.bloqueado),
  }), [form]);

  const salvar = useCallback(async (event) => {
    event.preventDefault();
    if (!validar()) return;
    setSalvando(true);
    try {
      await comprasSalvarFornecedor(montarPayload(), form.id || undefined);
      onMensagem?.({ ok: form.id ? 'Fornecedor atualizado.' : 'Fornecedor incluído.' });
      fecharForm();
      await onRecarregar?.();
    } catch (error) {
      onMensagem?.({
        erro: error.response?.data?.detail || 'Não foi possível salvar o fornecedor.',
      });
    } finally {
      setSalvando(false);
    }
  }, [fecharForm, form.id, montarPayload, onMensagem, onRecarregar, validar]);

  const alternarProjeto = useCallback((instituicaoId) => {
    setForm((atual) => {
      const ids = new Set(atual.projeto_ids);
      if (ids.has(instituicaoId)) ids.delete(instituicaoId);
      else ids.add(instituicaoId);
      return {
        ...atual,
        atende_geral: false,
        projeto_ids: [...ids],
      };
    });
    setErros((atual) => ({ ...atual, projeto_ids: '' }));
  }, []);

  const alternarGeral = useCallback((marcado) => {
    setForm((atual) => ({
      ...atual,
      atende_geral: marcado,
      projeto_ids: marcado ? [] : atual.projeto_ids,
    }));
    setErros((atual) => ({ ...atual, projeto_ids: '' }));
  }, []);

  useEffect(() => {
    if (!ficha && !formAberto) return undefined;
    const aoTeclar = (event) => {
      if (event.key !== 'Escape') return;
      if (formAberto) {
        fecharForm();
        return;
      }
      setFicha(null);
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [fecharForm, ficha, formAberto]);

  return (
    <>
      <SectionCard
        title="Fornecedores"
        subtitle={`${listaFiltrada.length} de ${fornecedores.length} cadastros`}
        actions={(
          <PremiumButton type="button" onClick={abrirNovo}>
            <span className="inline-flex items-center gap-1.5">
              <Plus size={16} />
              Novo fornecedor
            </span>
          </PremiumButton>
        )}
      >
        <div className="px-5 py-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="relative min-w-0 flex-1">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, CNPJ, segmento, contato ou projeto"
                className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-400"
              />
            </div>
            <label className="sm:w-44">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Status</span>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              >
                <option value="ativo">Ativos</option>
                <option value="inativo">Inativos</option>
                <option value="bloqueado">Bloqueados</option>
                <option value="todos">Todos</option>
              </select>
            </label>
          </div>

          {fornecedores.length === 0 ? (
            <EmptyState
              title="Nenhum fornecedor cadastrado"
              subtitle="Use o botão Novo fornecedor para incluir o primeiro cadastro."
            />
          ) : listaFiltrada.length === 0 ? (
            <EmptyState
              title="Nenhum resultado"
              subtitle="Ajuste a busca ou o filtro de status."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-2">Fornecedor</th>
                    <th className="px-2 py-2">Segmento</th>
                    <th className="px-2 py-2">Representante</th>
                    <th className="px-2 py-2">Telefone</th>
                    <th className="px-2 py-2">Projetos</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {listaFiltrada.map((fornecedor) => (
                    <tr key={fornecedor.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                      <td className="px-2 py-2.5 align-top">
                        <button type="button" className="text-left" onClick={() => setFicha(fornecedor)}>
                          <strong className="text-slate-900 hover:text-violet-700">{fornecedor.nome}</strong>
                          {fornecedor.cnpj && (
                            <p className="text-xs text-slate-500">{formatarCNPJ(fornecedor.cnpj)}</p>
                          )}
                        </button>
                      </td>
                      <td className="px-2 py-2.5 align-top text-slate-600">{fornecedor.segmento || '—'}</td>
                      <td className="px-2 py-2.5 align-top text-slate-600">{fornecedor.contato || '—'}</td>
                      <td className="px-2 py-2.5 align-top text-slate-600">
                        {fornecedor.telefone ? formatarTelefoneCompras(fornecedor.telefone) : '—'}
                      </td>
                      <td className="max-w-[180px] px-2 py-2.5 align-top text-slate-600">
                        <span className="line-clamp-2">{rotuloProjetosFornecedor(fornecedor) || '—'}</span>
                      </td>
                      <td className="px-2 py-2.5 align-top">{statusFornecedor(fornecedor)}</td>
                      <td className="px-2 py-2.5 align-top">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            aria-label={`Ver ficha de ${fornecedor.nome}`}
                            title="Ver ficha"
                            onClick={() => setFicha(fornecedor)}
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            type="button"
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            aria-label={`Editar ${fornecedor.nome}`}
                            title="Editar"
                            onClick={() => editar(fornecedor)}
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
        </div>
      </SectionCard>

      <ModalFichaFornecedor
        fornecedor={ficha}
        categoriaNome={ficha?.categoria_id ? (mapaCategorias[ficha.categoria_id] || '—') : ''}
        onFechar={() => setFicha(null)}
        onEditar={editar}
      />

      {formAberto && (
        <ModalFormFornecedor
          form={form}
          erros={erros}
          salvando={salvando}
          categorias={categorias}
          unidades={unidades}
          onAtualizar={atualizar}
          onErroChange={(campo, mensagem) => setErros((atual) => ({ ...atual, [campo]: mensagem }))}
          onAlternarGeral={alternarGeral}
          onAlternarProjeto={alternarProjeto}
          onSalvar={salvar}
          onCancelar={fecharForm}
        />
      )}
    </>
  );
}
