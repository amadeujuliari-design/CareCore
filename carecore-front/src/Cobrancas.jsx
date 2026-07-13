import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, CreditCard, RefreshCw } from 'lucide-react';

import Sidebar from './Sidebar';
import { AppShell, MainShell, PageHeader, ScrollArea } from './components/PremiumUI';
import api, { STORAGE_BLOQUEIO_LICENCA_KEY } from './services/api';
import { decodificarPayloadJwt } from './utils/jwtUtils';

function usuarioPodeAdministrarIntegracaoAsaas() {
  try {
    const usuarioRaw = localStorage.getItem('@CareCore:user') || localStorage.getItem('usuario');
    const usuario = usuarioRaw ? JSON.parse(usuarioRaw) : {};
    const token = localStorage.getItem('@CareCore:token') || localStorage.getItem('token');
    const payload = token ? decodificarPayloadJwt(token) || {} : {};
    const perfil = usuario?.perfil_acesso || payload?.perfil_acesso || '';

    return Boolean(
      usuario?.is_global === true ||
      payload?.is_global === true ||
      usuario?.is_manutencao === true ||
      payload?.is_manutencao === true ||
      perfil === 'Global' ||
      perfil === 'Manutenção'
    );
  } catch {
    return false;
  }
}

function obterBloqueioLicencaLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_BLOQUEIO_LICENCA_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function Cobrancas() {
  const [podeAdministrarAsaas] = useState(usuarioPodeAdministrarIntegracaoAsaas);
  const [resumoCobranca, setResumoCobranca] = useState(null);
  const [historicoCobrancas, setHistoricoCobrancas] = useState([]);
  const [statusAsaas, setStatusAsaas] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [testando, setTestando] = useState(false);
  const [criandoTeste, setCriandoTeste] = useState(false);
  const [fechandoCiclo, setFechandoCiclo] = useState(false);
  const [gerandoCobrancaCicloId, setGerandoCobrancaCicloId] = useState(null);
  const [simulandoStatusCicloId, setSimulandoStatusCicloId] = useState(null);
  const [alertaCobrancas, setAlertaCobrancas] = useState(null);
  const [bloqueioLicenca, setBloqueioLicenca] = useState(obterBloqueioLicencaLocal);
  const [moduloClienteVisivel, setModuloClienteVisivel] = useState(true);
  const [erro, setErro] = useState('');
  const [resultadoTeste, setResultadoTeste] = useState(null);
  const [cobrancaTeste, setCobrancaTeste] = useState(null);

  async function carregarStatus() {
    setErro('');
    setResultadoTeste(null);
    setCobrancaTeste(null);
    try {
      setCarregando(true);
      const moduloResponse = await api.get('/api/cobrancas/modulo/status');
      const clienteVisivel = moduloResponse.data?.cliente_visivel === true;
      setModuloClienteVisivel(clienteVisivel);
      if (!clienteVisivel && !podeAdministrarAsaas) {
        setResumoCobranca(null);
        setHistoricoCobrancas([]);
        setAlertaCobrancas(null);
        return;
      }

      const resumoResponse = await api.get('/api/cobrancas/organizacao/resumo');
      setResumoCobranca(resumoResponse.data);
      const historicoResponse = await api.get('/api/cobrancas/organizacao/historico');
      setHistoricoCobrancas(historicoResponse.data?.itens || []);
      const alerta = historicoResponse.data?.alerta || null;
      setAlertaCobrancas(alerta);
      if (!alerta?.possui_fatura_vencida) {
        localStorage.removeItem(STORAGE_BLOQUEIO_LICENCA_KEY);
        setBloqueioLicenca(null);
      }

      if (podeAdministrarAsaas) {
        try {
          const response = await api.get('/api/cobrancas/asaas/status');
          setStatusAsaas(response.data);
        } catch (error) {
          if (error?.response?.status !== 403) {
            throw error;
          }
          setStatusAsaas(null);
        }
      } else {
        setStatusAsaas(null);
      }
    } catch (error) {
      setErro(error?.response?.data?.detail || 'Não foi possível carregar a configuração de cobrança.');
    } finally {
      setCarregando(false);
    }
  }

  async function fecharCicloAtual() {
    if (!resumoCobranca?.data_fechamento) return;
    setErro('');
    try {
      setFechandoCiclo(true);
      await api.post('/api/cobrancas/organizacao/ciclos/fechar', null, {
        params: { data_fechamento: resumoCobranca.data_fechamento },
      });
      await carregarStatus();
    } catch (error) {
      setErro(error?.response?.data?.detail || 'Não foi possível fechar o ciclo de cobrança.');
    } finally {
      setFechandoCiclo(false);
    }
  }

  async function testarConexao() {
    setErro('');
    setResultadoTeste(null);
    try {
      setTestando(true);
      const response = await api.post('/api/cobrancas/asaas/testar-conexao');
      setResultadoTeste(response.data);
    } catch (error) {
      setErro(error?.response?.data?.detail || 'Não foi possível testar a conexão com o Asaas.');
    } finally {
      setTestando(false);
    }
  }

  async function criarCobrancaTeste() {
    setErro('');
    setCobrancaTeste(null);
    try {
      setCriandoTeste(true);
      const response = await api.post('/api/cobrancas/asaas/sandbox/cobranca-teste', {
        nome_cliente: 'Cliente Teste CareCore+',
        cpf_cnpj: '24971563792',
        valor: 5,
        billing_type: 'UNDEFINED',
      });
      setCobrancaTeste(response.data);
    } catch (error) {
      setErro(error?.response?.data?.detail || 'Não foi possível criar a cobrança teste no Sandbox.');
    } finally {
      setCriandoTeste(false);
    }
  }

  async function gerarCobrancaCiclo(cicloId) {
    if (!cicloId) return;
    setErro('');
    try {
      setGerandoCobrancaCicloId(cicloId);
      await api.post(`/api/cobrancas/organizacao/ciclos/${cicloId}/gerar-cobranca-asaas`);
      await carregarStatus();
    } catch (error) {
      setErro(error?.response?.data?.detail || 'Não foi possível gerar a cobrança Asaas do ciclo.');
    } finally {
      setGerandoCobrancaCicloId(null);
    }
  }

  async function simularStatusCiclo(cicloId, statusAsaasSimulado) {
    if (!cicloId) return;
    setErro('');
    try {
      setSimulandoStatusCicloId(cicloId);
      await api.post(`/api/cobrancas/organizacao/ciclos/${cicloId}/simular-status`, {
        status_asaas: statusAsaasSimulado,
      });
      await carregarStatus();
    } catch (error) {
      setErro(error?.response?.data?.detail || 'Não foi possível simular o status da fatura.');
    } finally {
      setSimulandoStatusCicloId(null);
    }
  }

  useEffect(() => {
    carregarStatus();
  }, []);

  const ambienteSandbox = statusAsaas?.ambiente === 'sandbox';
  const prontoParaTeste = statusAsaas?.configurado && statusAsaas?.valido;
  const simulacaoAtiva = Boolean(statusAsaas?.simulacao_ativa);
  const faturaCicloAtual = historicoCobrancas.find(
    (cobranca) => cobranca.data_fechamento === resumoCobranca?.data_fechamento
  );
  const linkPagamentoCicloAtual = faturaCicloAtual?.invoice_url || faturaCicloAtual?.bank_slip_url;

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          eyebrow="Financeiro"
          title="Módulo de Cobranças"
          subtitle="Acompanhe o fechamento, vencimento e pagamento do ciclo."
          icon={<CreditCard size={19} />}
        />
        <ScrollArea>
        <section className="mx-auto flex max-w-6xl flex-col gap-6">
          {erro ? (
            <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
              <AlertTriangle className="mt-0.5 shrink-0" size={18} />
              <span>{erro}</span>
            </div>
          ) : null}

          {!moduloClienteVisivel && !podeAdministrarAsaas ? (
            <section className="rounded-3xl border border-blue-100 bg-blue-50 p-6 shadow-sm">
              <div className="flex items-start gap-3 text-sm font-semibold text-blue-800">
                <AlertTriangle className="mt-0.5 shrink-0" size={18} />
                <div>
                  <h2 className="text-lg font-black text-blue-950">Módulo de cobranças em preparação</h2>
                  <p className="mt-2">
                    Esta área ficará disponível quando a cobrança automática for ativada pela manutenção.
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          {bloqueioLicenca ? (
            <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
              <AlertTriangle className="mt-0.5 shrink-0" size={18} />
              <span>
                {bloqueioLicenca.detail} {bloqueioLicenca.motivo ? `Motivo: ${bloqueioLicenca.motivo}` : ''}
              </span>
            </div>
          ) : null}

          {alertaCobrancas?.possui_fatura_vencida ? (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
              <AlertTriangle className="mt-0.5 shrink-0" size={18} />
              <span>
                Existe fatura vencida nesta organização. Vencimento mais antigo: {formatarData(alertaCobrancas.data_vencimento_mais_antiga)}.
              </span>
            </div>
          ) : null}

          {carregando && !resumoCobranca && (moduloClienteVisivel || podeAdministrarAsaas) ? (
            <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 text-sm font-black text-slate-500">
                <RefreshCw className="animate-spin" size={18} />
                Carregando resumo de cobranças...
              </div>
            </section>
          ) : null}

          {(!carregando || resumoCobranca) && (moduloClienteVisivel || podeAdministrarAsaas) ? (
          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">Cobrança do Ciclo</h2>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  {resumoCobranca?.organizacao_nome || 'Organização'}
                </p>
              </div>
              <button
                type="button"
                onClick={carregarStatus}
                disabled={carregando}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                <RefreshCw className={carregando ? 'animate-spin' : ''} size={16} />
                Atualizar
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <InfoCard titulo="Cadastros computados" valor={String(resumoCobranca?.total_cadastros_faturaveis ?? '-')} />
              <InfoCard titulo="Fechamento do ciclo" valor={formatarData(resumoCobranca?.data_fechamento)} />
              <InfoCard titulo="Corte para inativação" valor={formatarData(resumoCobranca?.data_corte_inativacao)} />
              <InfoCard titulo="Vencimento" valor={formatarData(resumoCobranca?.data_vencimento)} />
            </div>

            <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-semibold text-blue-800">
              Entram no ciclo os conviventes e usuários ativos do sistema. Cadastros inativados até a data de corte não entram no fechamento; inativações após essa data ainda compõem o ciclo.
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-100">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    <tr>
                      <th className="px-4 py-3 text-left">Projeto</th>
                      <th className="px-4 py-3 text-right">Conviventes</th>
                      <th className="px-4 py-3 text-right">Usuários</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-right">Mensalidade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {(resumoCobranca?.projetos || []).map((projeto) => (
                      <tr key={projeto.projeto_id}>
                        <td className="px-4 py-3 font-black text-slate-900">{projeto.projeto_nome}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-600">{projeto.conviventes_faturaveis ?? 0}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-600">{projeto.usuarios_faturaveis ?? 0}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-600">{projeto.cadastros_faturaveis}</td>
                        <td className="px-4 py-3 text-right font-black text-slate-900">{formatarMoeda(projeto.valor_mensalidade)}</td>
                      </tr>
                    ))}
                    {!resumoCobranca?.projetos?.length ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center font-semibold text-slate-500">
                          Nenhum projeto ativo encontrado para cobrança.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Mensalidade do ciclo</p>
                <p className="mt-1 text-2xl font-black text-slate-950">{formatarMoeda(resumoCobranca?.valor_total_mensalidade)}</p>
              </div>
              {linkPagamentoCicloAtual ? (
                <a
                  href={linkPagamentoCicloAtual}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl bg-cyan-600 px-5 py-3 text-center text-sm font-black text-white shadow-lg shadow-cyan-600/20 transition hover:bg-cyan-700"
                >
                  Gerar 2ª via / pagar
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className="rounded-2xl bg-slate-300 px-5 py-3 text-sm font-black text-white"
                  title="Será liberado quando a cobrança do ciclo estiver gerada."
                >
                  Gerar 2ª via / pagar
                </button>
              )}
            </div>
          </section>
          ) : null}

          {(!carregando || historicoCobrancas.length) && (moduloClienteVisivel || podeAdministrarAsaas) ? (
          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">Histórico de Faturas</h2>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Consulte os ciclos fechados, vencimentos e status de pagamento.
                </p>
              </div>
              {podeAdministrarAsaas ? (
                <button
                  type="button"
                  onClick={fecharCicloAtual}
                  disabled={fechandoCiclo || !resumoCobranca}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-950/15 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                >
                  <CreditCard size={17} />
                  {fechandoCiclo ? 'Fechando...' : 'Fechar ciclo atual'}
                </button>
              ) : null}
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-100">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    <tr>
                      <th className="px-4 py-3 text-left">Fechamento</th>
                      <th className="px-4 py-3 text-left">Vencimento</th>
                      <th className="px-4 py-3 text-right">Cadastros</th>
                      <th className="px-4 py-3 text-right">Valor</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {historicoCobrancas.map((cobranca) => {
                      const linkPagamento = cobranca.invoice_url || cobranca.bank_slip_url;
                      return (
                        <tr key={cobranca.id}>
                          <td className="px-4 py-3 font-bold text-slate-700">{formatarData(cobranca.data_fechamento)}</td>
                          <td className="px-4 py-3 font-bold text-slate-700">{formatarData(cobranca.data_vencimento)}</td>
                          <td className="px-4 py-3 text-right font-bold text-slate-600">{cobranca.total_cadastros_faturaveis}</td>
                          <td className="px-4 py-3 text-right font-black text-slate-900">{formatarMoeda(cobranca.valor_total_mensalidade)}</td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                              {cobranca.status_pagamento || 'Pendente'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {linkPagamento ? (
                              <a
                                href={linkPagamento}
                                target="_blank"
                                rel="noreferrer"
                                className="font-black text-cyan-700 hover:text-cyan-900"
                              >
                                Pagar
                              </a>
                            ) : podeAdministrarAsaas ? (
                              <button
                                type="button"
                                onClick={() => gerarCobrancaCiclo(cobranca.id)}
                                disabled={!prontoParaTeste || gerandoCobrancaCicloId === cobranca.id}
                                className="font-black text-cyan-700 transition hover:text-cyan-900 disabled:cursor-not-allowed disabled:text-slate-400"
                              >
                                {gerandoCobrancaCicloId === cobranca.id ? 'Gerando...' : 'Gerar cobrança'}
                              </button>
                            ) : (
                              <span className="font-bold text-slate-400">Aguardando boleto</span>
                            )}
                            {podeAdministrarAsaas && simulacaoAtiva ? (
                              <div className="mt-2 flex flex-wrap justify-end gap-2 text-xs">
                                <button
                                  type="button"
                                  onClick={() => simularStatusCiclo(cobranca.id, 'RECEIVED')}
                                  disabled={simulandoStatusCicloId === cobranca.id}
                                  className="font-black text-emerald-700 hover:text-emerald-900 disabled:text-slate-400"
                                >
                                  Pago
                                </button>
                                <button
                                  type="button"
                                  onClick={() => simularStatusCiclo(cobranca.id, 'OVERDUE')}
                                  disabled={simulandoStatusCicloId === cobranca.id}
                                  className="font-black text-amber-700 hover:text-amber-900 disabled:text-slate-400"
                                >
                                  Atraso
                                </button>
                                <button
                                  type="button"
                                  onClick={() => simularStatusCiclo(cobranca.id, 'PENDING')}
                                  disabled={simulandoStatusCicloId === cobranca.id}
                                  className="font-black text-slate-500 hover:text-slate-700 disabled:text-slate-400"
                                >
                                  Pendente
                                </button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                    {!historicoCobrancas.length ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center font-semibold text-slate-500">
                          Nenhuma fatura fechada ainda.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
          ) : null}

          {podeAdministrarAsaas ? (
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-black text-slate-900">Integração Asaas</h2>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    A chave nunca é exibida completa. Produção e Sandbox são validados separadamente.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={carregarStatus}
                  disabled={carregando}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  <RefreshCw className={carregando ? 'animate-spin' : ''} size={16} />
                  Atualizar
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <InfoCard titulo="Ambiente" valor={statusAsaas?.ambiente || '-'} destaque={ambienteSandbox ? 'Sandbox' : 'Produção'} />
                <InfoCard titulo="Status" valor={statusAsaas?.mensagem || '-'} destaque={statusAsaas?.valido ? 'Válido' : 'Pendente'} positivo={statusAsaas?.valido} />
                <InfoCard titulo="Base URL" valor={statusAsaas?.base_url || '-'} />
                <InfoCard titulo="Chave" valor={statusAsaas?.api_key_mascarada || 'Não configurada'} />
              </div>

              <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                Ambiente atual vem de <code>ASAAS_ENV</code>. Sandbox usa chave <code>$aact_hmlg_</code>;
                produção usa <code>$aact_prod_</code>. Gerar cobrança de ciclo emite boleto no Asaas
                do ambiente configurado (manual; automação continua desligada).
              </div>
            </section>

            <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-slate-900">Teste de Conexão</h2>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Faz uma chamada segura para listar uma pequena amostra de clientes no ambiente configurado.
              </p>

              <button
                type="button"
                onClick={testarConexao}
                disabled={!prontoParaTeste || testando}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-cyan-600/20 transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              >
                <RefreshCw className={testando ? 'animate-spin' : ''} size={17} />
                {testando ? 'Testando...' : 'Testar conexão Asaas'}
              </button>

              {!prontoParaTeste ? (
                <p className="mt-3 text-xs font-bold text-slate-500">
                  Configure `ASAAS_ENV` e a chave correspondente (`ASAAS_API_KEY_PRODUCTION` /
                  `ASAAS_API_KEY_SANDBOX` ou `ASAAS_API_KEY`).
                </p>
              ) : null}

              {resultadoTeste ? (
                <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
                  <div className="flex items-center gap-2 font-black">
                    <CheckCircle2 size={18} />
                    Conexão confirmada
                  </div>
                  <p className="mt-2">
                    Ambiente: {resultadoTeste.ambiente}. Clientes na amostra: {resultadoTeste.total_clientes_amostra}.
                  </p>
                </div>
              ) : null}
            </section>
          </div>
          ) : null}

          {podeAdministrarAsaas && simulacaoAtiva ? (
          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">Cobrança Teste no Sandbox</h2>
                <p className="mt-1 max-w-3xl text-sm font-medium text-slate-500">
                  Cria um cliente fictício e uma cobrança de R$ 5,00 no Asaas Sandbox. Esta ação é
                  bloqueada pelo backend quando o ambiente não for `sandbox`.
                </p>
              </div>
              <button
                type="button"
                onClick={criarCobrancaTeste}
                disabled={!prontoParaTeste || !ambienteSandbox || criandoTeste}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-950/15 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              >
                <CreditCard size={17} />
                {criandoTeste ? 'Criando...' : 'Criar cobrança teste'}
              </button>
            </div>

            {!ambienteSandbox ? (
              <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
                Ambiente atual não é Sandbox. A criação de cobrança teste está desativada.
              </p>
            ) : null}

            {cobrancaTeste ? (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <InfoCard titulo="Cliente Asaas" valor={cobrancaTeste.cliente?.id || '-'} />
                <InfoCard titulo="Cobrança Asaas" valor={cobrancaTeste.cobranca?.id || '-'} destaque={cobrancaTeste.cobranca?.status || 'Criada'} positivo />
                <InfoCard titulo="Valor" valor={`R$ ${Number(cobrancaTeste.cobranca?.valor || 0).toFixed(2).replace('.', ',')}`} />
                <InfoCard titulo="Vencimento" valor={cobrancaTeste.cobranca?.vencimento || '-'} />
                {cobrancaTeste.cobranca?.invoice_url ? (
                  <a
                    href={cobrancaTeste.cobranca.invoice_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4 text-sm font-black text-cyan-700 transition hover:bg-cyan-100"
                  >
                    Abrir fatura teste
                  </a>
                ) : null}
              </div>
            ) : null}
          </section>
          ) : null}
        </section>
        </ScrollArea>
      </MainShell>
    </AppShell>
  );
}

function formatarMoeda(valor) {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) {
    return '-';
  }
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(valor) {
  if (!valor) return '-';
  const [ano, mes, dia] = valor.split('-');
  if (!ano || !mes || !dia) return valor;
  return `${dia}/${mes}/${ano}`;
}

function InfoCard({ titulo, valor, destaque, positivo }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{titulo}</p>
      <p className="mt-2 break-words text-sm font-black text-slate-900">{valor}</p>
      {destaque ? (
        <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-black ${positivo ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
          {destaque}
        </span>
      ) : null}
    </div>
  );
}
