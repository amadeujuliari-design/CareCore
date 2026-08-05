import { useCallback, useEffect, useMemo, useState } from 'react';
import { Users } from 'lucide-react';

import Sidebar from './Sidebar';
import NfpEnderecoFields from './components/nfp/NfpEnderecoFields';
import { BadgeStatus, CampoSelect, CampoTexto } from './components/UsuariosCampos';
import { AppShell, MainShell, PageHeader, PremiumButton, ScrollArea } from './components/PremiumUI';
import {
  nfpAtualizarDoador,
  nfpCriarDoador,
  nfpListarAgentes,
  nfpListarDoadores,
  nfpObterDoador,
  nfpSincronizarDoadores,
} from './services/nfpService';
import {
  cepValido,
  cpfValido,
  dataParaInput,
  emailValido,
  formatarCPF,
  formatarTelefone,
  limparMascara,
  removerCamposVazios,
  telefoneValido,
} from './utils/usuariosUtils';
import {
  FORM_ENDERECO_VAZIO,
  enderecoDoRegistro,
  erroApiNfp,
  formatarNumeroCadastro,
  montarEnderecoPayload,
  opcoesAgentesCaptacao,
} from './utils/nfpCadastroUtils';

const FORM_INICIAL = {
  nome: '',
  cpf: '',
  email: '',
  telefone: '',
  data_nascimento: '',
  unidade_captador: '',
  ...FORM_ENDERECO_VAZIO,
  ativo: true,
  observacoes: '',
};

function montarFormDoador(registro = {}) {
  return {
    numero_cadastro: registro.numero_cadastro || null,
    nome: registro.nome || '',
    cpf: registro.cpf ? formatarCPF(registro.cpf) : '',
    email: registro.email || '',
    telefone: registro.telefone ? formatarTelefone(registro.telefone) : '',
    data_nascimento: dataParaInput(registro.data_nascimento),
    unidade_captador: registro.unidade_captador || '',
    ...enderecoDoRegistro(registro),
    ativo: registro.ativo !== false,
    observacoes: registro.observacoes || '',
  };
}

export default function NfpDoadores() {
  const [doadores, setDoadores] = useState([]);
  const [agentes, setAgentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [tela, setTela] = useState('lista');
  const [editandoId, setEditandoId] = useState(null);
  const [busca, setBusca] = useState('');
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

  const carregarDoadores = useCallback(async () => {
    setLoading(true);
    limparAlertas();

    try {
      const params = { limite: 500 };
      if (busca.trim()) params.busca = busca.trim();
      setDoadores(await nfpListarDoadores(params));
    } catch (error) {
      setErro(erroApiNfp(error, 'Não foi possível carregar os doadores.'));
    } finally {
      setLoading(false);
    }
  }, [busca]);

  useEffect(() => {
    carregarAgentes();
  }, [carregarAgentes]);

  useEffect(() => {
    carregarDoadores();
  }, [carregarDoadores]);

  const atualizarEndereco = (campo, valor) => {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  };

  const atualizarErroEndereco = (campo, mensagem) => {
    setErrosCampo((atual) => ({ ...atual, [campo]: mensagem }));
  };

  const atualizarCampo = (campo, valor) => {
    let valorFinal = valor;
    if (campo === 'cpf') valorFinal = formatarCPF(valor);
    if (campo === 'telefone') valorFinal = formatarTelefone(valor);

    if (errosCampo[campo]) {
      setErrosCampo((atual) => ({ ...atual, [campo]: '' }));
    }

    setForm((atual) => ({ ...atual, [campo]: valorFinal }));
  };

  const validarForm = () => {
    const erros = {};

    if (!form.nome.trim()) erros.nome = 'Informe o nome.';
    if (!form.cpf.trim()) erros.cpf = 'Informe o CPF.';
    else if (!cpfValido(form.cpf)) erros.cpf = 'CPF inválido.';
    if (form.email && !emailValido(form.email)) erros.email = 'E-mail inválido.';
    if (form.telefone && !telefoneValido(form.telefone)) erros.telefone = 'Telefone inválido.';
    if (form.cep && !cepValido(form.cep)) erros.cep = 'CEP inválido.';

    setErrosCampo(erros);
    return Object.keys(erros).length === 0;
  };

  const montarPayload = () => removerCamposVazios({
    nome: form.nome.trim(),
    cpf: limparMascara(form.cpf),
    email: form.email.trim(),
    telefone: form.telefone ? limparMascara(form.telefone) : '',
    data_nascimento: form.data_nascimento || undefined,
    unidade_captador: form.unidade_captador || undefined,
    ativo: form.ativo,
    observacoes: form.observacoes.trim(),
    ...montarEnderecoPayload(form),
  });

  const abrirNovo = () => {
    limparAlertas();
    setEditandoId(null);
    setForm({
      ...FORM_INICIAL,
      unidade_captador: opcoesCaptador[0]?.value || '',
    });
    setErrosCampo({});
    setTela('form');
  };

  const abrirEdicao = async (doador) => {
    limparAlertas();
    setEditandoId(doador.id);
    setForm(montarFormDoador(doador));
    setErrosCampo({});
    setTela('form');

    try {
      const detalhe = await nfpObterDoador(doador.id);
      setForm(montarFormDoador(detalhe));
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
        await nfpAtualizarDoador(editandoId, payload);
        setSucesso('Doador atualizado com sucesso.');
      } else {
        await nfpCriarDoador(payload);
        setSucesso('Doador cadastrado com sucesso.');
      }

      await carregarDoadores();
      voltarLista();
    } catch (error) {
      setErro(erroApiNfp(error, 'Não foi possível salvar o doador.'));
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
          title="Doadores"
          subtitle="Doadores diretos AEB (doação automática): sincronizados das planilhas e editáveis aqui."
          icon={<Users className="h-5 w-5" />}
          actions={(
            tela === 'lista' ? (
              <div className="flex flex-wrap gap-2">
                <PremiumButton
                  type="button"
                  variant="secondary"
                  disabled={salvando}
                  onClick={async () => {
                    setSalvando(true);
                    limparAlertas();
                    try {
                      const sync = await nfpSincronizarDoadores();
                      setSucesso(
                        `Sincronização: ${sync.criados || 0} novos, ${sync.ja_existiam || 0} já cadastrados (total ${sync.total_cadastro || 0}).`,
                      );
                      await carregarDoadores();
                    } catch (error) {
                      setErro(erroApiNfp(error, 'Falha ao sincronizar doadores.'));
                    } finally {
                      setSalvando(false);
                    }
                  }}
                >
                  Sincronizar das doações
                </PremiumButton>
                <PremiumButton type="button" onClick={abrirNovo}>
                  Novo doador
                </PremiumButton>
              </div>
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
              <div className="mb-4 flex flex-wrap gap-3">
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por nº, nome ou CPF"
                  className="min-w-[240px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
                <PremiumButton type="button" variant="secondary" onClick={carregarDoadores}>
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
                        <th className="px-2 py-2">Nome</th>
                        <th className="px-2 py-2">CPF</th>
                        <th className="px-2 py-2">Unidade</th>
                        <th className="px-2 py-2">Origem</th>
                        <th className="px-2 py-2">Contato</th>
                        <th className="px-2 py-2">Status</th>
                        <th className="px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {doadores.map((doador) => (
                        <tr key={doador.id} className="border-t border-slate-100">
                          <td className="px-2 py-2 font-mono text-slate-600">
                            {formatarNumeroCadastro(doador.numero_cadastro)}
                          </td>
                          <td className="px-2 py-2 font-medium text-slate-800">{doador.nome}</td>
                          <td className="px-2 py-2">{formatarCPF(doador.cpf)}</td>
                          <td className="px-2 py-2">{doador.unidade_captador || '—'}</td>
                          <td className="px-2 py-2 text-xs text-slate-600">
                            {doador.origem_cadastro === 'DOACAO_AUTOMATICA'
                              ? 'Doação automática'
                              : doador.origem_cadastro === 'PLANILHA'
                                ? 'Planilha'
                                : doador.origem_cadastro === 'MANUAL'
                                  ? 'Manual'
                                  : (doador.origem_cadastro || '—')}
                          </td>
                          <td className="px-2 py-2">{doador.email || doador.telefone || '—'}</td>
                          <td className="px-2 py-2"><BadgeStatus ativo={doador.ativo !== false} /></td>
                          <td className="px-2 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => abrirEdicao(doador)}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Editar
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!doadores.length && (
                        <tr>
                          <td colSpan={8} className="px-2 py-8 text-center text-slate-500">
                            Nenhum doador encontrado.
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
                {editandoId ? 'Editar doador' : 'Novo doador'}
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
                  label="Nome"
                  value={form.nome}
                  onChange={(valor) => atualizarCampo('nome', valor)}
                  erro={errosCampo.nome}
                  required
                  className="md:col-span-2"
                />
                <CampoTexto
                  label="CPF"
                  value={form.cpf}
                  onChange={(valor) => atualizarCampo('cpf', valor)}
                  onBlur={() => {
                    if (form.cpf && !cpfValido(form.cpf)) {
                      setErrosCampo((atual) => ({ ...atual, cpf: 'CPF inválido.' }));
                    }
                  }}
                  erro={errosCampo.cpf}
                  required
                />
                <CampoTexto
                  label="Data de nascimento"
                  type="date"
                  value={form.data_nascimento}
                  onChange={(valor) => atualizarCampo('data_nascimento', valor)}
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
                <CampoSelect
                  label="Unidade captador"
                  value={form.unidade_captador}
                  onChange={(valor) => atualizarCampo('unidade_captador', valor)}
                  options={opcoesCaptador}
                  placeholder="Selecione o agente"
                />
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Ativo</label>
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.ativo}
                      onChange={(e) => atualizarCampo('ativo', e.target.checked)}
                    />
                    Doador ativo
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
                  {salvando ? 'Salvando...' : 'Salvar doador'}
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
