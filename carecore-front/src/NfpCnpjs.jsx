import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2 } from 'lucide-react';

import Sidebar from './Sidebar';
import NfpEnderecoFields from './components/nfp/NfpEnderecoFields';
import { BadgeStatus, CampoSelect, CampoTexto } from './components/UsuariosCampos';
import { AppShell, MainShell, PageHeader, PremiumButton, ScrollArea } from './components/PremiumUI';
import {
  nfpAtualizarCnpj,
  nfpCriarCnpj,
  nfpListarAgentes,
  nfpListarCnpjs,
  nfpObterCnpj,
} from './services/nfpService';
import {
  cepValido,
  emailValido,
  formatarTelefone,
  limparMascara,
  removerCamposVazios,
  telefoneValido,
} from './utils/usuariosUtils';
import {
  FORM_ENDERECO_VAZIO,
  cnpjValido,
  enderecoDoRegistro,
  erroApiNfp,
  formatarCNPJ,
  formatarNumeroCadastro,
  montarEnderecoPayload,
  opcoesAgentesCaptacao,
} from './utils/nfpCadastroUtils';

const NOMES_GENERICOS = ['loja', 'estabelecimento', 'sem nome', 'nao informado', 'não informado'];

const FORM_INICIAL = {
  cnpj: '',
  loja: '',
  razao_social: '',
  captador: '',
  inscricao_estadual: '',
  email: '',
  telefone: '',
  ...FORM_ENDERECO_VAZIO,
  cnpj_conferir: false,
  ativo: true,
  observacoes: '',
};

function nomeGenerico(loja = '') {
  const texto = String(loja || '').trim().toLowerCase();
  if (!texto) return true;
  return NOMES_GENERICOS.some((termo) => texto.includes(termo));
}

function montarFormCnpj(registro = {}) {
  return {
    numero_cadastro: registro.numero_cadastro || null,
    cnpj: registro.cnpj ? formatarCNPJ(registro.cnpj) : '',
    loja: registro.loja || '',
    razao_social: registro.razao_social || '',
    captador: registro.captador || '',
    inscricao_estadual: registro.inscricao_estadual || '',
    email: registro.email || '',
    telefone: registro.telefone ? formatarTelefone(registro.telefone) : '',
    ...enderecoDoRegistro(registro),
    cnpj_conferir: Boolean(registro.cnpj_conferir) || nomeGenerico(registro.loja),
    ativo: registro.ativo !== false,
    observacoes: registro.observacoes || '',
  };
}

export default function NfpCnpjs() {
  const [cnpjs, setCnpjs] = useState([]);
  const [agentes, setAgentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [tela, setTela] = useState('lista');
  const [editandoId, setEditandoId] = useState(null);
  const [busca, setBusca] = useState('');
  const [filtroCaptador, setFiltroCaptador] = useState('');
  const [somenteConferir, setSomenteConferir] = useState(false);
  const [form, setForm] = useState(FORM_INICIAL);
  const [errosCampo, setErrosCampo] = useState({});

  const opcoesCaptador = useMemo(
    () => opcoesAgentesCaptacao(agentes),
    [agentes],
  );

  const limparAlertas = () => {
    setErro('');
    setSucesso('');
  };

  const carregarAgentes = useCallback(async () => {
    try {
      const lista = await nfpListarAgentes({ ativo: true, limite: 200 });
      setAgentes(Array.isArray(lista) ? lista : []);
    } catch {
      setAgentes([]);
    }
  }, []);

  const carregarCnpjs = useCallback(async () => {
    setLoading(true);
    limparAlertas();

    try {
      const params = { limite: 500 };
      if (busca.trim()) params.busca = busca.trim();
      if (filtroCaptador) params.captador = filtroCaptador;
      if (somenteConferir) params.somente_conferir = true;

      setCnpjs(await nfpListarCnpjs(params));
    } catch (error) {
      setErro(erroApiNfp(error, 'Não foi possível carregar os CNPJs.'));
    } finally {
      setLoading(false);
    }
  }, [busca, filtroCaptador, somenteConferir]);

  useEffect(() => {
    carregarAgentes();
  }, [carregarAgentes]);

  useEffect(() => {
    carregarCnpjs();
  }, [carregarCnpjs]);

  const atualizarEndereco = (campo, valor) => {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  };

  const atualizarErroEndereco = (campo, mensagem) => {
    setErrosCampo((atual) => ({ ...atual, [campo]: mensagem }));
  };

  const atualizarCampo = (campo, valor) => {
    let valorFinal = valor;
    if (campo === 'cnpj') valorFinal = formatarCNPJ(valor);
    if (campo === 'telefone') valorFinal = formatarTelefone(valor);

    if (errosCampo[campo]) {
      setErrosCampo((atual) => ({ ...atual, [campo]: '' }));
    }

    setForm((atual) => {
      const proximo = { ...atual, [campo]: valorFinal };
      if (campo === 'loja' && !editandoId) {
        proximo.cnpj_conferir = nomeGenerico(valorFinal);
      }
      return proximo;
    });
  };

  const validarForm = () => {
    const erros = {};

    if (!form.cnpj.trim()) erros.cnpj = 'Informe o CNPJ.';
    else if (!cnpjValido(form.cnpj)) erros.cnpj = 'CNPJ inválido.';
    if (form.email && !emailValido(form.email)) erros.email = 'E-mail inválido.';
    if (form.telefone && !telefoneValido(form.telefone)) erros.telefone = 'Telefone inválido.';
    if (form.cep && !cepValido(form.cep)) erros.cep = 'CEP inválido.';

    setErrosCampo(erros);
    return Object.keys(erros).length === 0;
  };

  const montarPayload = () => removerCamposVazios({
    cnpj: limparMascara(form.cnpj),
    loja: form.loja.trim(),
    razao_social: form.razao_social.trim(),
    captador: form.captador || undefined,
    inscricao_estadual: form.inscricao_estadual.trim(),
    email: form.email.trim(),
    telefone: form.telefone ? limparMascara(form.telefone) : '',
    cnpj_conferir: form.cnpj_conferir,
    ativo: form.ativo,
    observacoes: form.observacoes.trim(),
    ...montarEnderecoPayload(form),
  });

  const abrirNovo = () => {
    limparAlertas();
    setEditandoId(null);
    setForm({
      ...FORM_INICIAL,
      captador: opcoesCaptador[0]?.value || '',
    });
    setErrosCampo({});
    setTela('form');
  };

  const abrirEdicao = async (cnpjItem) => {
    limparAlertas();
    setEditandoId(cnpjItem.id);
    setForm(montarFormCnpj(cnpjItem));
    setErrosCampo({});
    setTela('form');

    try {
      const detalhe = await nfpObterCnpj(cnpjItem.id);
      setForm(montarFormCnpj(detalhe));
    } catch {
      // Mantém dados da lista.
    }
  };

  const voltarLista = () => {
    setTela('lista');
    setEditandoId(null);
    setForm(FORM_INICIAL);
    setErrosCampo({});
  };

  const salvar = async () => {
    if (!validarForm()) {
      setErro('Corrija os campos destacados antes de salvar.');
      return;
    }

    setSalvando(true);
    limparAlertas();

    try {
      const payload = montarPayload();

      if (editandoId) {
        await nfpAtualizarCnpj(editandoId, payload);
        setSucesso('CNPJ atualizado com sucesso.');
      } else {
        await nfpCriarCnpj(payload);
        setSucesso('CNPJ cadastrado com sucesso.');
      }

      await carregarCnpjs();
      voltarLista();
    } catch (error) {
      setErro(erroApiNfp(error, 'Não foi possível salvar o CNPJ.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          eyebrow="NFP – Créditos"
          title="CNPJs / Lojas"
          subtitle="Cadastro de estabelecimentos, captador e conferência de nomes genéricos."
          icon={<Building2 className="h-5 w-5" />}
          actions={(
            tela === 'lista' ? (
              <PremiumButton type="button" onClick={abrirNovo}>
                Novo CNPJ
              </PremiumButton>
            ) : (
              <PremiumButton type="button" variant="secondary" onClick={voltarLista}>
                Voltar
              </PremiumButton>
            )
          )}
        />

        <ScrollArea>
          {erro && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {erro}
            </div>
          )}
          {sucesso && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {sucesso}
            </div>
          )}

          {tela === 'lista' && (
            <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por nº, CNPJ ou loja"
                  className="min-w-[240px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
                <select
                  value={filtroCaptador}
                  onChange={(e) => setFiltroCaptador(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">Todos os captadores</option>
                  {opcoesCaptador.map((opcao) => (
                    <option key={opcao.value} value={opcao.value}>{opcao.label}</option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={somenteConferir}
                    onChange={(e) => setSomenteConferir(e.target.checked)}
                  />
                  Somente conferir
                </label>
                <PremiumButton type="button" variant="secondary" onClick={carregarCnpjs}>
                  Atualizar
                </PremiumButton>
              </div>

              {loading ? (
                <div className="py-8 text-center text-sm text-slate-500">Carregando...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="px-2 py-2">Nº</th>
                        <th className="px-2 py-2">CNPJ</th>
                        <th className="px-2 py-2">Loja</th>
                        <th className="px-2 py-2">Captador</th>
                        <th className="px-2 py-2">Contato</th>
                        <th className="px-2 py-2">Conferir</th>
                        <th className="px-2 py-2">Status</th>
                        <th className="px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {cnpjs.map((item) => (
                        <tr key={item.id} className="border-t border-slate-100">
                          <td className="px-2 py-2 font-mono text-slate-600">
                            {formatarNumeroCadastro(item.numero_cadastro)}
                          </td>
                          <td className="px-2 py-2">{formatarCNPJ(item.cnpj)}</td>
                          <td className="px-2 py-2 font-medium text-slate-800">{item.loja || '—'}</td>
                          <td className="px-2 py-2">{item.captador || '—'}</td>
                          <td className="px-2 py-2">{item.email || item.telefone || '—'}</td>
                          <td className="px-2 py-2">
                            {item.cnpj_conferir ? (
                              <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                                Conferir
                              </span>
                            ) : 'OK'}
                          </td>
                          <td className="px-2 py-2"><BadgeStatus ativo={item.ativo !== false} /></td>
                          <td className="px-2 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => abrirEdicao(item)}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Editar
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!cnpjs.length && (
                        <tr>
                          <td colSpan={8} className="px-2 py-8 text-center text-slate-500">
                            Nenhum CNPJ encontrado.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {tela === 'form' && (
            <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-bold text-slate-800">
                {editandoId ? 'Editar CNPJ / loja' : 'Novo CNPJ / loja'}
              </h3>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Nº cadastro
                  </label>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {editandoId
                      ? formatarNumeroCadastro(form.numero_cadastro)
                      : 'Gerado automaticamente ao salvar'}
                  </div>
                </div>
                <CampoTexto
                  label="CNPJ"
                  value={form.cnpj}
                  onChange={(valor) => atualizarCampo('cnpj', valor)}
                  onBlur={() => {
                    if (form.cnpj && !cnpjValido(form.cnpj)) {
                      setErrosCampo((atual) => ({ ...atual, cnpj: 'CNPJ inválido.' }));
                    }
                  }}
                  erro={errosCampo.cnpj}
                  required
                />
                <CampoTexto
                  label="Loja / nome fantasia"
                  value={form.loja}
                  onChange={(valor) => atualizarCampo('loja', valor)}
                  className="md:col-span-2"
                />
                <CampoTexto
                  label="Razão social"
                  value={form.razao_social}
                  onChange={(valor) => atualizarCampo('razao_social', valor)}
                  className="md:col-span-2"
                />
                <CampoSelect
                  label="Captador"
                  value={form.captador}
                  onChange={(valor) => atualizarCampo('captador', valor)}
                  options={opcoesCaptador}
                  placeholder="Selecione o agente"
                />
                <CampoTexto
                  label="Inscrição estadual"
                  value={form.inscricao_estadual}
                  onChange={(valor) => atualizarCampo('inscricao_estadual', valor)}
                />
                <CampoTexto
                  label="E-mail"
                  value={form.email}
                  onChange={(valor) => atualizarCampo('email', valor)}
                  erro={errosCampo.email}
                  type="email"
                />
                <CampoTexto
                  label="Telefone"
                  value={form.telefone}
                  onChange={(valor) => atualizarCampo('telefone', valor)}
                  erro={errosCampo.telefone}
                />
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Conferir CNPJ</label>
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.cnpj_conferir}
                      readOnly={nomeGenerico(form.loja)}
                      disabled={nomeGenerico(form.loja)}
                      onChange={(e) => atualizarCampo('cnpj_conferir', e.target.checked)}
                    />
                    {nomeGenerico(form.loja)
                      ? 'Marcado automaticamente (nome genérico)'
                      : 'Marcar para conferência manual'}
                  </label>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Ativo</label>
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.ativo}
                      onChange={(e) => atualizarCampo('ativo', e.target.checked)}
                    />
                    CNPJ ativo
                  </label>
                </div>
              </div>

              <div className="mt-4">
                <NfpEnderecoFields
                  form={form}
                  erros={errosCampo}
                  onChange={atualizarEndereco}
                  onErroChange={atualizarErroEndereco}
                />
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-xs font-semibold text-slate-600">Observações</label>
                <textarea
                  value={form.observacoes}
                  onChange={(e) => atualizarCampo('observacoes', e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <PremiumButton type="button" disabled={salvando} onClick={salvar}>
                  {salvando ? 'Salvando...' : 'Salvar CNPJ'}
                </PremiumButton>
                <PremiumButton type="button" variant="secondary" onClick={voltarLista}>
                  Cancelar
                </PremiumButton>
              </div>
            </section>
          )}
        </ScrollArea>
      </MainShell>
    </AppShell>
  );
}
