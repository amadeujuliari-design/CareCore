import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2 } from 'lucide-react';

import Sidebar from './Sidebar';
import BannerSomenteLeituraGlobal from './components/BannerSomenteLeituraGlobal';
import NfpEnderecoFields from './components/nfp/NfpEnderecoFields';
import { BadgeStatus, CampoSelect, CampoTexto } from './components/UsuariosCampos';
import { AppShell, MainShell, PageHeader, PremiumButton, ReportActionButton, ScrollArea } from './components/PremiumUI';
import {
  nfpAtualizarCnpj,
  nfpAtualizarCpfCaptado,
  nfpCriarCnpj,
  nfpCriarCpfCaptado,
  nfpListarAgentes,
  nfpListarCnpjs,
  nfpListarCpfsCaptados,
  nfpObterCnpj,
  nfpObterCpfCaptado,
} from './services/nfpService';
import {
  exportarCadastroNfpCnpjs,
  imprimirCadastroNfpCnpjs,
} from './utils/nfpCadastroExportPrint';
import {
  cepValido,
  cpfValido,
  emailValido,
  formatarCPF,
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
import { decodificarPayloadJwt } from './utils/jwtUtils';
import { usuarioSomenteLeituraNfp } from './utils/rbacUtils';

const NOMES_GENERICOS = ['loja', 'estabelecimento', 'sem nome', 'nao informado', 'não informado'];

const FORM_CNPJ_INICIAL = {
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

const FORM_CPF_INICIAL = {
  cpf: '',
  nome: '',
  captador: '',
  email: '',
  telefone: '',
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

function montarFormCpf(registro = {}) {
  return {
    numero_cadastro: registro.numero_cadastro || null,
    cpf: registro.cpf ? formatarCPF(registro.cpf) : '',
    nome: registro.nome || '',
    captador: registro.captador || '',
    email: registro.email || '',
    telefone: registro.telefone ? formatarTelefone(registro.telefone) : '',
    ativo: registro.ativo !== false,
    observacoes: registro.observacoes || '',
  };
}

export default function NfpCnpjs() {
  const somenteLeitura = useMemo(() => {
    try {
      const token = localStorage.getItem('@CareCore:token');
      return usuarioSomenteLeituraNfp(token ? decodificarPayloadJwt(token) : null);
    } catch {
      return false;
    }
  }, []);
  const [aba, setAba] = useState('cnpjs');
  const [cnpjs, setCnpjs] = useState([]);
  const [cpfs, setCpfs] = useState([]);
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
  const [formCnpj, setFormCnpj] = useState(FORM_CNPJ_INICIAL);
  const [formCpf, setFormCpf] = useState(FORM_CPF_INICIAL);
  const [errosCampo, setErrosCampo] = useState({});

  const opcoesCaptador = useMemo(
    () => opcoesAgentesCaptacao(agentes).filter((op) => op.value && op.value !== 'AEB'),
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

  const carregarCpfs = useCallback(async () => {
    setLoading(true);
    limparAlertas();
    try {
      const params = { limite: 500 };
      if (busca.trim()) params.busca = busca.trim();
      if (filtroCaptador) params.captador = filtroCaptador;
      setCpfs(await nfpListarCpfsCaptados(params));
    } catch (error) {
      setErro(erroApiNfp(error, 'Não foi possível carregar os CPFs captados.'));
    } finally {
      setLoading(false);
    }
  }, [busca, filtroCaptador]);

  useEffect(() => {
    carregarAgentes();
  }, [carregarAgentes]);

  useEffect(() => {
    if (aba === 'cnpjs') carregarCnpjs();
    else carregarCpfs();
  }, [aba, carregarCnpjs, carregarCpfs]);

  const filtrosExportacao = useMemo(() => ({
    Busca: busca.trim() || '—',
    Captador: filtroCaptador || 'Todos',
    Conferir: somenteConferir ? 'Somente conferir' : 'Todos',
    Registros: String(cnpjs.length),
  }), [busca, filtroCaptador, somenteConferir, cnpjs.length]);

  const exportarLista = async () => {
    if (aba !== 'cnpjs') return;
    limparAlertas();
    try {
      const ok = await exportarCadastroNfpCnpjs({ cnpjs, filtros: filtrosExportacao });
      if (!ok) setErro('Não há CNPJs para exportar com os filtros atuais.');
    } catch (error) {
      setErro(erroApiNfp(error, 'Falha ao exportar CNPJs.'));
    }
  };

  const imprimirLista = async () => {
    if (aba !== 'cnpjs') return;
    limparAlertas();
    try {
      const ok = await imprimirCadastroNfpCnpjs({ cnpjs, filtros: filtrosExportacao });
      if (!ok) setErro('Não há CNPJs para imprimir com os filtros atuais.');
    } catch (error) {
      setErro(erroApiNfp(error, 'Falha ao imprimir CNPJs.'));
    }
  };

  const atualizarEndereco = (campo, valor) => {
    setFormCnpj((atual) => ({ ...atual, [campo]: valor }));
  };

  const atualizarErroEndereco = (campo, mensagem) => {
    setErrosCampo((atual) => ({ ...atual, [campo]: mensagem }));
  };

  const atualizarCampoCnpj = (campo, valor) => {
    let valorFinal = valor;
    if (campo === 'cnpj') valorFinal = formatarCNPJ(valor);
    if (campo === 'telefone') valorFinal = formatarTelefone(valor);
    if (errosCampo[campo]) setErrosCampo((atual) => ({ ...atual, [campo]: '' }));
    setFormCnpj((atual) => {
      const proximo = { ...atual, [campo]: valorFinal };
      if (campo === 'loja' && !editandoId) proximo.cnpj_conferir = nomeGenerico(valorFinal);
      return proximo;
    });
  };

  const atualizarCampoCpf = (campo, valor) => {
    let valorFinal = valor;
    if (campo === 'cpf') valorFinal = formatarCPF(valor);
    if (campo === 'telefone') valorFinal = formatarTelefone(valor);
    if (errosCampo[campo]) setErrosCampo((atual) => ({ ...atual, [campo]: '' }));
    setFormCpf((atual) => ({ ...atual, [campo]: valorFinal }));
  };

  const validarFormCnpj = () => {
    const erros = {};
    if (!formCnpj.cnpj.trim()) erros.cnpj = 'Informe o CNPJ.';
    else if (!cnpjValido(formCnpj.cnpj)) erros.cnpj = 'CNPJ inválido.';
    if (!formCnpj.captador) erros.captador = 'Selecione o captador.';
    if (formCnpj.email && !emailValido(formCnpj.email)) erros.email = 'E-mail inválido.';
    if (formCnpj.telefone && !telefoneValido(formCnpj.telefone)) erros.telefone = 'Telefone inválido.';
    if (formCnpj.cep && !cepValido(formCnpj.cep)) erros.cep = 'CEP inválido.';
    setErrosCampo(erros);
    return Object.keys(erros).length === 0;
  };

  const validarFormCpf = () => {
    const erros = {};
    if (!formCpf.cpf.trim()) erros.cpf = 'Informe o CPF.';
    else if (!cpfValido(formCpf.cpf)) erros.cpf = 'CPF inválido.';
    if (!formCpf.captador) erros.captador = 'Selecione o agente captador.';
    if (formCpf.email && !emailValido(formCpf.email)) erros.email = 'E-mail inválido.';
    if (formCpf.telefone && !telefoneValido(formCpf.telefone)) erros.telefone = 'Telefone inválido.';
    setErrosCampo(erros);
    return Object.keys(erros).length === 0;
  };

  const montarPayloadCnpj = () => removerCamposVazios({
    cnpj: limparMascara(formCnpj.cnpj),
    loja: formCnpj.loja.trim(),
    razao_social: formCnpj.razao_social.trim(),
    captador: formCnpj.captador || undefined,
    inscricao_estadual: formCnpj.inscricao_estadual.trim(),
    email: formCnpj.email.trim(),
    telefone: formCnpj.telefone ? limparMascara(formCnpj.telefone) : '',
    cnpj_conferir: formCnpj.cnpj_conferir,
    ativo: formCnpj.ativo,
    observacoes: formCnpj.observacoes.trim(),
    ...montarEnderecoPayload(formCnpj),
  });

  const montarPayloadCpf = () => removerCamposVazios({
    cpf: limparMascara(formCpf.cpf),
    nome: formCpf.nome.trim(),
    captador: formCpf.captador || undefined,
    email: formCpf.email.trim(),
    telefone: formCpf.telefone ? limparMascara(formCpf.telefone) : '',
    ativo: formCpf.ativo,
    observacoes: formCpf.observacoes.trim(),
  });

  const abrirNovo = () => {
    if (somenteLeitura) return;
    limparAlertas();
    setEditandoId(null);
    setErrosCampo({});
    if (aba === 'cpfs') {
      setFormCpf({ ...FORM_CPF_INICIAL, captador: opcoesCaptador[0]?.value || '' });
    } else {
      setFormCnpj({ ...FORM_CNPJ_INICIAL, captador: opcoesCaptador[0]?.value || '' });
    }
    setTela('form');
  };

  const abrirEdicaoCnpj = async (item) => {
    limparAlertas();
    setEditandoId(item.id);
    setFormCnpj(montarFormCnpj(item));
    setErrosCampo({});
    setTela('form');
    try {
      setFormCnpj(montarFormCnpj(await nfpObterCnpj(item.id)));
    } catch {
      // Mantém dados da lista.
    }
  };

  const abrirEdicaoCpf = async (item) => {
    limparAlertas();
    setEditandoId(item.id);
    setFormCpf(montarFormCpf(item));
    setErrosCampo({});
    setTela('form');
    try {
      setFormCpf(montarFormCpf(await nfpObterCpfCaptado(item.id)));
    } catch {
      // Mantém dados da lista.
    }
  };

  const voltarLista = () => {
    setTela('lista');
    setEditandoId(null);
    setFormCnpj(FORM_CNPJ_INICIAL);
    setFormCpf(FORM_CPF_INICIAL);
    setErrosCampo({});
  };

  const trocarAba = (novaAba) => {
    setAba(novaAba);
    setTela('lista');
    setEditandoId(null);
    setBusca('');
    setSomenteConferir(false);
    setErrosCampo({});
    limparAlertas();
  };

  const salvar = async () => {
    if (somenteLeitura) return;
    const ehCpf = aba === 'cpfs';
    if (ehCpf ? !validarFormCpf() : !validarFormCnpj()) {
      setErro('Corrija os campos destacados antes de salvar.');
      return;
    }

    setSalvando(true);
    limparAlertas();
    try {
      if (ehCpf) {
        const payload = montarPayloadCpf();
        if (editandoId) {
          await nfpAtualizarCpfCaptado(editandoId, payload);
          setSucesso('CPF captado atualizado com sucesso.');
        } else {
          await nfpCriarCpfCaptado(payload);
          setSucesso('CPF captado cadastrado com sucesso.');
        }
        await carregarCpfs();
      } else {
        const payload = montarPayloadCnpj();
        if (editandoId) {
          await nfpAtualizarCnpj(editandoId, payload);
          setSucesso('CNPJ atualizado com sucesso.');
        } else {
          await nfpCriarCnpj(payload);
          setSucesso('CNPJ cadastrado com sucesso.');
        }
        await carregarCnpjs();
      }
      voltarLista();
    } catch (error) {
      setErro(erroApiNfp(error, ehCpf ? 'Não foi possível salvar o CPF.' : 'Não foi possível salvar o CNPJ.'));
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
          title="CNPJs / CPFs Captados por Agentes"
          subtitle="Cadastro de estabelecimentos (CNPJ) e pessoas físicas (CPF) vinculadas a agentes captadores."
          icon={<Building2 className="h-5 w-5" />}
          backTo="/nfp"
          backLabel="Voltar ao dashboard"
          actions={(
            tela === 'lista' ? (
              <div className="flex flex-wrap gap-2">
                {aba === 'cnpjs' && (
                  <>
                    <ReportActionButton
                      type="button"
                      action="export"
                      disabled={loading || !cnpjs.length}
                      onClick={exportarLista}
                    >
                      Exportar XLSX
                    </ReportActionButton>
                    <ReportActionButton
                      type="button"
                      disabled={loading || !cnpjs.length}
                      onClick={imprimirLista}
                    >
                      Imprimir
                    </ReportActionButton>
                  </>
                )}
                {!somenteLeitura && (
                  <PremiumButton type="button" onClick={abrirNovo}>
                    {aba === 'cpfs' ? '+ Novo CPF' : '+ Novo CNPJ'}
                  </PremiumButton>
                )}
              </div>
            ) : (
              <PremiumButton type="button" variant="secondary" onClick={voltarLista}>
                Voltar
              </PremiumButton>
            )
          )}
        />

        {somenteLeitura && (
          <BannerSomenteLeituraGlobal modulo="o cadastro de CNPJs/CPFs NFP" />
        )}

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
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => trocarAba('cnpjs')}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                    aba === 'cnpjs'
                      ? 'border-slate-800 bg-slate-800 text-white'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  CNPJs / Lojas
                </button>
                <button
                  type="button"
                  onClick={() => trocarAba('cpfs')}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                    aba === 'cpfs'
                      ? 'border-slate-800 bg-slate-800 text-white'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  CPFs captados
                </button>
              </div>

              {aba === 'cpfs' && (
                <p className="mb-4 rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-teal-800">
                  CPF vinculado a um agente entra no rateio pelo percentual do agente (não é tratado como doador direto AEB).
                </p>
              )}

              <div className="mb-4 flex flex-wrap items-center gap-3">
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder={aba === 'cpfs' ? 'Buscar por nº, CPF ou nome' : 'Buscar por nº, CNPJ ou loja'}
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
                {aba === 'cnpjs' && (
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={somenteConferir}
                      onChange={(e) => setSomenteConferir(e.target.checked)}
                    />
                    Somente conferir
                  </label>
                )}
                <PremiumButton
                  type="button"
                  variant="secondary"
                  onClick={aba === 'cpfs' ? carregarCpfs : carregarCnpjs}
                >
                  Atualizar
                </PremiumButton>
              </div>

              {loading ? (
                <div className="py-8 text-center text-sm text-slate-500">Carregando...</div>
              ) : aba === 'cpfs' ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="px-2 py-2">Nº</th>
                        <th className="px-2 py-2">CPF</th>
                        <th className="px-2 py-2">Nome</th>
                        <th className="px-2 py-2">Captador</th>
                        <th className="px-2 py-2">Contato</th>
                        <th className="px-2 py-2">Status</th>
                        <th className="px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {cpfs.map((item) => (
                        <tr key={item.id} className="border-t border-slate-100">
                          <td className="px-2 py-2 font-mono text-slate-600">
                            {formatarNumeroCadastro(item.numero_cadastro)}
                          </td>
                          <td className="px-2 py-2">{formatarCPF(item.cpf)}</td>
                          <td className="px-2 py-2 font-medium text-slate-800">{item.nome || '—'}</td>
                          <td className="px-2 py-2">{item.captador || '—'}</td>
                          <td className="px-2 py-2">{item.email || item.telefone || '—'}</td>
                          <td className="px-2 py-2"><BadgeStatus ativo={item.ativo !== false} /></td>
                          <td className="px-2 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => abrirEdicaoCpf(item)}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              {somenteLeitura ? 'Consultar' : 'Editar'}
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!cpfs.length && (
                        <tr>
                          <td colSpan={7} className="px-2 py-8 text-center text-slate-500">
                            Nenhum CPF captado encontrado.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
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
                              onClick={() => abrirEdicaoCnpj(item)}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              {somenteLeitura ? 'Consultar' : 'Editar'}
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

          {tela === 'form' && aba === 'cpfs' && (
            <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-bold text-slate-800">
                {somenteLeitura
                  ? 'Consultar CPF captado'
                  : (editandoId ? 'Editar CPF captado' : 'Novo CPF captado')}
              </h3>
              <fieldset disabled={somenteLeitura} className="min-w-0 border-0 p-0">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Nº cadastro</label>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      {editandoId
                        ? formatarNumeroCadastro(formCpf.numero_cadastro)
                        : 'Gerado automaticamente ao salvar'}
                    </div>
                  </div>
                  <CampoTexto
                    label="CPF"
                    value={formCpf.cpf}
                    onChange={(valor) => atualizarCampoCpf('cpf', valor)}
                    erro={errosCampo.cpf}
                    required
                  />
                  <CampoTexto
                    label="Nome"
                    value={formCpf.nome}
                    onChange={(valor) => atualizarCampoCpf('nome', valor)}
                    className="md:col-span-2"
                  />
                  <CampoSelect
                    label="Agente captador"
                    value={formCpf.captador}
                    onChange={(valor) => atualizarCampoCpf('captador', valor)}
                    options={opcoesCaptador}
                    placeholder="Selecione o agente"
                    required
                  />
                  {errosCampo.captador && (
                    <p className="md:col-span-4 text-xs text-red-600">{errosCampo.captador}</p>
                  )}
                  <CampoTexto
                    label="E-mail"
                    value={formCpf.email}
                    onChange={(valor) => atualizarCampoCpf('email', valor)}
                    erro={errosCampo.email}
                    type="email"
                  />
                  <CampoTexto
                    label="Telefone"
                    value={formCpf.telefone}
                    onChange={(valor) => atualizarCampoCpf('telefone', valor)}
                    erro={errosCampo.telefone}
                  />
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Ativo</label>
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={formCpf.ativo}
                        onChange={(e) => atualizarCampoCpf('ativo', e.target.checked)}
                      />
                      CPF ativo
                    </label>
                  </div>
                </div>
                <div className="mt-4">
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Observações</label>
                  <textarea
                    value={formCpf.observacoes}
                    onChange={(e) => atualizarCampoCpf('observacoes', e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                  />
                </div>
              </fieldset>
              <div className="mt-5 flex flex-wrap gap-2">
                {!somenteLeitura && (
                  <PremiumButton type="button" disabled={salvando} onClick={salvar}>
                    {salvando ? 'Salvando...' : 'Salvar CPF'}
                  </PremiumButton>
                )}
                <PremiumButton type="button" variant="secondary" onClick={voltarLista}>
                  {somenteLeitura ? 'Voltar' : 'Cancelar'}
                </PremiumButton>
              </div>
            </section>
          )}

          {tela === 'form' && aba === 'cnpjs' && (
            <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-bold text-slate-800">
                {somenteLeitura
                  ? 'Consultar CNPJ / loja'
                  : (editandoId ? 'Editar CNPJ / loja' : 'Novo CNPJ / loja')}
              </h3>
              <fieldset disabled={somenteLeitura} className="min-w-0 border-0 p-0">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Nº cadastro</label>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      {editandoId
                        ? formatarNumeroCadastro(formCnpj.numero_cadastro)
                        : 'Gerado automaticamente ao salvar'}
                    </div>
                  </div>
                  <CampoTexto
                    label="CNPJ"
                    value={formCnpj.cnpj}
                    onChange={(valor) => atualizarCampoCnpj('cnpj', valor)}
                    erro={errosCampo.cnpj}
                    required
                  />
                  <CampoTexto
                    label="Loja / nome fantasia"
                    value={formCnpj.loja}
                    onChange={(valor) => atualizarCampoCnpj('loja', valor)}
                    className="md:col-span-2"
                  />
                  <CampoTexto
                    label="Razão social"
                    value={formCnpj.razao_social}
                    onChange={(valor) => atualizarCampoCnpj('razao_social', valor)}
                    className="md:col-span-2"
                  />
                  <CampoSelect
                    label="Captador"
                    value={formCnpj.captador}
                    onChange={(valor) => atualizarCampoCnpj('captador', valor)}
                    options={opcoesCaptador}
                    placeholder="Selecione o agente"
                  />
                  {errosCampo.captador && (
                    <p className="md:col-span-4 text-xs text-red-600">{errosCampo.captador}</p>
                  )}
                  <CampoTexto
                    label="Inscrição estadual"
                    value={formCnpj.inscricao_estadual}
                    onChange={(valor) => atualizarCampoCnpj('inscricao_estadual', valor)}
                  />
                  <CampoTexto
                    label="E-mail"
                    value={formCnpj.email}
                    onChange={(valor) => atualizarCampoCnpj('email', valor)}
                    erro={errosCampo.email}
                    type="email"
                  />
                  <CampoTexto
                    label="Telefone"
                    value={formCnpj.telefone}
                    onChange={(valor) => atualizarCampoCnpj('telefone', valor)}
                    erro={errosCampo.telefone}
                  />
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Conferir CNPJ</label>
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={formCnpj.cnpj_conferir}
                        readOnly={nomeGenerico(formCnpj.loja)}
                        disabled={nomeGenerico(formCnpj.loja)}
                        onChange={(e) => atualizarCampoCnpj('cnpj_conferir', e.target.checked)}
                      />
                      {nomeGenerico(formCnpj.loja)
                        ? 'Marcado automaticamente (nome genérico)'
                        : 'Marcar para conferência manual'}
                    </label>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Ativo</label>
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={formCnpj.ativo}
                        onChange={(e) => atualizarCampoCnpj('ativo', e.target.checked)}
                      />
                      CNPJ ativo
                    </label>
                  </div>
                </div>
                <div className="mt-4">
                  <NfpEnderecoFields
                    form={formCnpj}
                    erros={errosCampo}
                    onChange={atualizarEndereco}
                    onErroChange={atualizarErroEndereco}
                  />
                </div>
                <div className="mt-4">
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Observações</label>
                  <textarea
                    value={formCnpj.observacoes}
                    onChange={(e) => atualizarCampoCnpj('observacoes', e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                  />
                </div>
              </fieldset>
              <div className="mt-5 flex flex-wrap gap-2">
                {!somenteLeitura && (
                  <PremiumButton type="button" disabled={salvando} onClick={salvar}>
                    {salvando ? 'Salvando...' : 'Salvar CNPJ'}
                  </PremiumButton>
                )}
                <PremiumButton type="button" variant="secondary" onClick={voltarLista}>
                  {somenteLeitura ? 'Voltar' : 'Cancelar'}
                </PremiumButton>
              </div>
            </section>
          )}
        </ScrollArea>
      </MainShell>
    </AppShell>
  );
}
