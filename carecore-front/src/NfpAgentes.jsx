import { useCallback, useEffect, useMemo, useState } from 'react';
import { UserRoundCog } from 'lucide-react';

import Sidebar from './Sidebar';
import BannerSomenteLeituraGlobal from './components/BannerSomenteLeituraGlobal';
import NfpEnderecoFields from './components/nfp/NfpEnderecoFields';
import { BadgeStatus, CampoSelect, CampoTexto } from './components/UsuariosCampos';
import { AppShell, MainShell, PageHeader, PremiumButton, ReportActionButton, ScrollArea } from './components/PremiumUI';
import {
  nfpAtualizarAgente,
  nfpCriarAgente,
  nfpGarantirAgentesPadrao,
  nfpListarAgentes,
  nfpObterAgente,
} from './services/nfpService';
import {
  exportarCadastroNfpAgentes,
  imprimirCadastroNfpAgentes,
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
  formatarPercentual,
  montarEnderecoPayload,
  parsePercentual,
  percentualValido,
} from './utils/nfpCadastroUtils';
import { decodificarPayloadJwt } from './utils/jwtUtils';
import { usuarioSomenteLeituraNfp } from './utils/rbacUtils';

const FORM_INICIAL = {
  codigo: '',
  tipo: 'PJ',
  nome: '',
  nome_fantasia: '',
  cpf: '',
  cnpj: '',
  email: '',
  telefone: '',
  ...FORM_ENDERECO_VAZIO,
  percentual_agente: '0',
  ativo: true,
  observacoes: '',
};

function montarFormAgente(registro = {}) {
  return {
    numero_cadastro: registro.numero_cadastro || null,
    codigo: registro.codigo || '',
    tipo: registro.tipo || 'PJ',
    nome: registro.nome || '',
    nome_fantasia: registro.nome_fantasia || '',
    cpf: registro.cpf ? formatarCPF(registro.cpf) : '',
    cnpj: registro.cnpj ? formatarCNPJ(registro.cnpj) : '',
    email: registro.email || '',
    telefone: registro.telefone ? formatarTelefone(registro.telefone) : '',
    ...enderecoDoRegistro(registro),
    percentual_agente: registro.percentual_agente != null
      ? formatarPercentual(registro.percentual_agente)
      : '0',
    ativo: registro.ativo !== false,
    observacoes: registro.observacoes || '',
  };
}

export default function NfpAgentes() {
  const somenteLeitura = useMemo(() => {
    try {
      const token = localStorage.getItem('@CareCore:token');
      return usuarioSomenteLeituraNfp(token ? decodificarPayloadJwt(token) : null);
    } catch {
      return false;
    }
  }, []);
  const [agentes, setAgentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [tela, setTela] = useState('lista');
  const [editandoId, setEditandoId] = useState(null);
  const [busca, setBusca] = useState('');
  const [filtroAtivo, setFiltroAtivo] = useState('');
  const [form, setForm] = useState(FORM_INICIAL);
  const [errosCampo, setErrosCampo] = useState({});

  const limparAlertas = () => {
    setErro('');
    setSucesso('');
  };

  const carregarAgentes = useCallback(async () => {
    setLoading(true);
    limparAlertas();

    try {
      const params = { limite: 300 };
      if (busca.trim()) params.busca = busca.trim();
      if (filtroAtivo !== '') params.ativo = filtroAtivo === 'true';

      setAgentes(await nfpListarAgentes(params));
    } catch (error) {
      setErro(erroApiNfp(error, 'Não foi possível carregar os agentes.'));
    } finally {
      setLoading(false);
    }
  }, [busca, filtroAtivo]);

  useEffect(() => {
    carregarAgentes();
  }, [carregarAgentes]);

  const filtrosExportacao = useMemo(() => ({
    Busca: busca.trim() || '—',
    Status: filtroAtivo === 'true' ? 'Ativos' : filtroAtivo === 'false' ? 'Inativos' : 'Todos',
    Registros: String(agentes.length),
  }), [busca, filtroAtivo, agentes.length]);

  const exportarLista = async () => {
    limparAlertas();
    try {
      const ok = await exportarCadastroNfpAgentes({ agentes, filtros: filtrosExportacao });
      if (!ok) setErro('Não há agentes para exportar com os filtros atuais.');
    } catch (error) {
      setErro(erroApiNfp(error, 'Falha ao exportar agentes.'));
    }
  };

  const imprimirLista = async () => {
    limparAlertas();
    try {
      const ok = await imprimirCadastroNfpAgentes({ agentes, filtros: filtrosExportacao });
      if (!ok) setErro('Não há agentes para imprimir com os filtros atuais.');
    } catch (error) {
      setErro(erroApiNfp(error, 'Falha ao imprimir agentes.'));
    }
  };

  const atualizarEndereco = (campo, valor) => {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  };

  const atualizarErroEndereco = (campo, mensagem) => {
    setErrosCampo((atual) => ({ ...atual, [campo]: mensagem }));
  };

  const atualizarCampo = (campo, valor) => {
    let valorFinal = valor;

    if (campo === 'codigo') valorFinal = valor.toUpperCase().replace(/\s+/g, ' ').trim();
    if (campo === 'cpf') valorFinal = formatarCPF(valor);
    if (campo === 'cnpj') valorFinal = formatarCNPJ(valor);
    if (campo === 'telefone') valorFinal = formatarTelefone(valor);
    if (campo === 'percentual_agente') valorFinal = formatarPercentual(valor);

    if (errosCampo[campo]) {
      setErrosCampo((atual) => ({ ...atual, [campo]: '' }));
    }

    setForm((atual) => ({ ...atual, [campo]: valorFinal }));
  };

  const validarForm = () => {
    const erros = {};

    if (!form.codigo.trim()) erros.codigo = 'Informe o código.';
    if (!form.nome.trim()) erros.nome = 'Informe o nome.';
    if (form.tipo === 'PF' && form.cpf && !cpfValido(form.cpf)) erros.cpf = 'CPF inválido.';
    if (form.tipo === 'PJ' && form.cnpj && !cnpjValido(form.cnpj)) erros.cnpj = 'CNPJ inválido.';
    if (form.email && !emailValido(form.email)) erros.email = 'E-mail inválido.';
    if (form.telefone && !telefoneValido(form.telefone)) erros.telefone = 'Telefone inválido.';
    if (form.cep && !cepValido(form.cep)) erros.cep = 'CEP inválido.';
    if (!percentualValido(form.percentual_agente, { obrigatorio: true })) {
      erros.percentual_agente = 'Percentual entre 0 e 100.';
    }

    setErrosCampo(erros);
    return Object.keys(erros).length === 0;
  };

  const montarPayload = () => {
    const payload = removerCamposVazios({
      codigo: form.codigo.trim().toUpperCase(),
      tipo: form.tipo,
      nome: form.nome.trim(),
      nome_fantasia: form.nome_fantasia.trim(),
      email: form.email.trim(),
      telefone: form.telefone ? limparMascara(form.telefone) : '',
      percentual_agente: parsePercentual(form.percentual_agente),
      ativo: form.ativo,
      observacoes: form.observacoes.trim(),
      ...montarEnderecoPayload(form),
    });

    if (form.tipo === 'PF' && form.cpf) payload.cpf = limparMascara(form.cpf);
    if (form.tipo === 'PJ' && form.cnpj) payload.cnpj = limparMascara(form.cnpj);

    return payload;
  };

  const abrirNovo = () => {
    if (somenteLeitura) return;
    limparAlertas();
    setEditandoId(null);
    setForm(FORM_INICIAL);
    setErrosCampo({});
    setTela('form');
  };

  const abrirEdicao = async (agente) => {
    limparAlertas();
    setEditandoId(agente.id);
    setForm(montarFormAgente(agente));
    setErrosCampo({});
    setTela('form');

    try {
      const detalhe = await nfpObterAgente(agente.id);
      setForm(montarFormAgente(detalhe));
    } catch {
      // Mantém dados da lista se detalhe ainda não existir na API.
    }
  };

  const voltarLista = () => {
    setTela('lista');
    setEditandoId(null);
    setForm(FORM_INICIAL);
    setErrosCampo({});
  };

  const salvar = async () => {
    if (somenteLeitura) return;
    if (!validarForm()) {
      setErro('Corrija os campos destacados antes de salvar.');
      return;
    }

    setSalvando(true);
    limparAlertas();

    try {
      const payload = montarPayload();

      if (editandoId) {
        await nfpAtualizarAgente(editandoId, payload);
        setSucesso('Agente atualizado com sucesso.');
      } else {
        await nfpCriarAgente(payload);
        setSucesso('Agente cadastrado com sucesso.');
      }

      await carregarAgentes();
      voltarLista();
    } catch (error) {
      setErro(erroApiNfp(error, 'Não foi possível salvar o agente.'));
    } finally {
      setSalvando(false);
    }
  };

  const carregarPadrao = async () => {
    if (somenteLeitura) return;
    const confirmar = window.confirm('Carregar agentes padrão do sistema?');
    if (!confirmar) return;

    setSalvando(true);
    limparAlertas();

    try {
      await nfpGarantirAgentesPadrao();
      setSucesso('Agentes padrão garantidos.');
      await carregarAgentes();
    } catch (error) {
      setErro(erroApiNfp(error, 'Não foi possível carregar os agentes padrão.'));
    } finally {
      setSalvando(false);
    }
  };

  const tituloForm = somenteLeitura
    ? 'Consultar agente'
    : (editandoId ? 'Editar agente' : 'Novo agente');

  const agentesFiltrados = useMemo(() => agentes, [agentes]);

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          eyebrow="NFP – Créditos"
          title="Agentes captadores"
          subtitle="Cadastro de agentes de captação, percentual de rateio e endereço."
          icon={<UserRoundCog className="h-5 w-5" />}
          backTo="/nfp"
          backLabel="Voltar ao dashboard"
          actions={(
            <div className="flex flex-wrap gap-2">
              {tela === 'lista' ? (
                <>
                  <ReportActionButton
                    type="button"
                    action="export"
                    disabled={loading || !agentes.length}
                    onClick={exportarLista}
                  >
                    Exportar XLSX
                  </ReportActionButton>
                  <ReportActionButton
                    type="button"
                    disabled={loading || !agentes.length}
                    onClick={imprimirLista}
                  >
                    Imprimir
                  </ReportActionButton>
                  {!somenteLeitura && (
                    <>
                      <PremiumButton type="button" variant="secondary" disabled={salvando} onClick={carregarPadrao}>
                        Carregar agentes padrão
                      </PremiumButton>
                      <PremiumButton type="button" onClick={abrirNovo}>
                        Novo agente
                      </PremiumButton>
                    </>
                  )}
                </>
              ) : (
                <PremiumButton type="button" variant="secondary" onClick={voltarLista}>
                  Voltar
                </PremiumButton>
              )}
            </div>
          )}
        />

        {somenteLeitura && (
          <BannerSomenteLeituraGlobal modulo="o cadastro de agentes NFP" />
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
            <section className="space-y-4">
              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <div className="mb-4 flex flex-wrap gap-3">
                  <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar por código, nome ou documento"
                    className="min-w-[240px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                  <select
                    value={filtroAtivo}
                    onChange={(e) => setFiltroAtivo(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">Todos</option>
                    <option value="true">Ativos</option>
                    <option value="false">Inativos</option>
                  </select>
                  <PremiumButton type="button" variant="secondary" onClick={carregarAgentes}>
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
                          <th className="px-2 py-2">Código</th>
                          <th className="px-2 py-2">Nome</th>
                          <th className="px-2 py-2">Tipo</th>
                          <th className="px-2 py-2">Percentual</th>
                          <th className="px-2 py-2">Contato</th>
                          <th className="px-2 py-2">Status</th>
                          <th className="px-2 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {agentesFiltrados.map((agente) => (
                          <tr key={agente.id} className="border-t border-slate-100">
                            <td className="px-2 py-2 font-mono text-slate-600">
                              {formatarNumeroCadastro(agente.numero_cadastro)}
                            </td>
                            <td className="px-2 py-2 font-semibold text-slate-800">{agente.codigo}</td>
                            <td className="px-2 py-2">{agente.nome}</td>
                            <td className="px-2 py-2">{agente.tipo || '—'}</td>
                            <td className="px-2 py-2">
                              {agente.percentual_agente != null ? `${agente.percentual_agente}%` : '—'}
                            </td>
                            <td className="px-2 py-2">{agente.email || agente.telefone || '—'}</td>
                            <td className="px-2 py-2"><BadgeStatus ativo={agente.ativo !== false} /></td>
                            <td className="px-2 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => abrirEdicao(agente)}
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                {somenteLeitura ? 'Consultar' : 'Editar'}
                              </button>
                            </td>
                          </tr>
                        ))}
                        {!agentesFiltrados.length && (
                          <tr>
                            <td colSpan={8} className="px-2 py-8 text-center text-slate-500">
                              Nenhum agente encontrado.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          {tela === 'form' && (
            <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-bold text-slate-800">{tituloForm}</h3>

              <fieldset disabled={somenteLeitura} className="min-w-0 border-0 p-0">
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
                  label="Código"
                  value={form.codigo}
                  onChange={(valor) => atualizarCampo('codigo', valor)}
                  erro={errosCampo.codigo}
                  required
                  placeholder="Ex.: SEDE AEB"
                />
                <CampoSelect
                  label="Tipo"
                  value={form.tipo}
                  onChange={(valor) => atualizarCampo('tipo', valor)}
                  options={['PF', 'PJ']}
                  required
                />
                <CampoTexto
                  label="Nome"
                  value={form.nome}
                  onChange={(valor) => atualizarCampo('nome', valor)}
                  erro={errosCampo.nome}
                  required
                  className="md:col-span-2"
                  placeholder="Nome completo ou razão social"
                />
                <CampoTexto
                  label="Nome fantasia"
                  value={form.nome_fantasia}
                  onChange={(valor) => atualizarCampo('nome_fantasia', valor)}
                  className="md:col-span-2"
                />
                {form.tipo === 'PF' ? (
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
                  />
                ) : (
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
                  />
                )}
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
                <CampoTexto
                  label="Percentual do agente (%)"
                  value={form.percentual_agente}
                  onChange={(valor) => atualizarCampo('percentual_agente', valor)}
                  erro={errosCampo.percentual_agente}
                  required
                  placeholder="0"
                />
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Ativo</label>
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.ativo}
                      onChange={(e) => atualizarCampo('ativo', e.target.checked)}
                    />
                    Agente ativo
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
              </fieldset>

              <div className="mt-5 flex flex-wrap gap-2">
                {!somenteLeitura && (
                  <PremiumButton type="button" disabled={salvando} onClick={salvar}>
                    {salvando ? 'Salvando...' : 'Salvar agente'}
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
