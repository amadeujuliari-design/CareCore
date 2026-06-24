import { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from './Sidebar';
import { AppShell, MainShell, PageHeader, PremiumButton, ReportActionButton, ScrollArea } from './components/PremiumUI';
import api from './services/api';
import { listarAtividades, obterRelatorioAtividades } from './services/atividadesService';
import { mesReferenciaAtual } from './config/atividadesConfig';
import { exportarRelatorioAtividadesXlsx, montarDadosExportacaoRelatorioAtividades } from './utils/exportarAtividadesXlsx';
import { imprimirRelatorio } from './utils/imprimirRelatorio';
import {
  buscarIdentidadeRelatorios,
  obterLogoRelatorioDataUrl,
} from './utils/relatorioIdentidadePrint';

function dataLocalISO(data) {
  const pad = (numero) => String(numero).padStart(2, '0');
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`;
}

function periodoPadraoRelatorio() {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  return { dataInicio: dataLocalISO(inicio), dataFim: dataLocalISO(hoje) };
}

function formatarData(valor) {
  if (!valor) return '-';
  return new Date(`${valor}T12:00:00`).toLocaleDateString('pt-BR');
}

const AGRUPAMENTOS = [
  { valor: 'detalhado', rotulo: 'Detalhado (cada presença)' },
  { valor: 'por_atividade', rotulo: 'Por atividade' },
  { valor: 'por_convivente', rotulo: 'Por convivente' },
];

export default function AtividadesRelatorios() {
  const periodoInicial = useMemo(() => periodoPadraoRelatorio(), []);
  const [atividades, setAtividades] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [filtros, setFiltros] = useState({
    dataInicio: periodoInicial.dataInicio,
    dataFim: periodoInicial.dataFim,
    atividadeId: '',
    responsavelUsuarioId: '',
    conviventeId: '',
    agrupamento: 'detalhado',
  });
  const [relatorio, setRelatorio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [carregandoRelatorio, setCarregandoRelatorio] = useState(false);
  const [erro, setErro] = useState('');
  const [identidadeRelatorio, setIdentidadeRelatorio] = useState(null);

  const carregarBase = useCallback(async () => {
    setLoading(true);
    try {
      const [listaAtividades, usuariosResp] = await Promise.all([
        listarAtividades(false),
        api.get('/api/usuarios', { params: { limite: 300, offset: 0 } }),
      ]);
      setAtividades(listaAtividades.items || []);
      setUsuarios(usuariosResp.data?.items || usuariosResp.data || []);
    } catch (error) {
      setErro(error.response?.data?.detail || 'Não foi possível carregar os filtros.');
    } finally {
      setLoading(false);
    }
  }, []);

  const carregarRelatorio = useCallback(async () => {
    setCarregandoRelatorio(true);
    setErro('');
    try {
      const dados = await obterRelatorioAtividades({
        data_inicio: filtros.dataInicio || undefined,
        data_fim: filtros.dataFim || undefined,
        atividade_id: filtros.atividadeId || undefined,
        responsavel_usuario_id: filtros.responsavelUsuarioId || undefined,
        convivente_id: filtros.conviventeId || undefined,
        agrupamento: filtros.agrupamento,
      });
      setRelatorio(dados);
    } catch (error) {
      setErro(error.response?.data?.detail || 'Não foi possível gerar o relatório.');
      setRelatorio(null);
    } finally {
      setCarregandoRelatorio(false);
    }
  }, [filtros]);

  useEffect(() => {
    carregarBase();
    buscarIdentidadeRelatorios().then(setIdentidadeRelatorio);
  }, [carregarBase]);

  useEffect(() => {
    if (!loading) carregarRelatorio();
  }, [loading, carregarRelatorio]);

  const aplicarMesAtual = () => {
    const mes = mesReferenciaAtual();
    const [ano, mesNum] = mes.split('-').map(Number);
    const ultimoDia = new Date(ano, mesNum, 0).getDate();
    setFiltros((atual) => ({
      ...atual,
      dataInicio: `${mes}-01`,
      dataFim: `${mes}-${String(ultimoDia).padStart(2, '0')}`,
    }));
  };

  const colunasTabela = useMemo(() => {
    if (filtros.agrupamento === 'por_atividade') {
      return ['Atividade', 'Responsável', 'Sessões', 'Presenças', 'Conviventes'];
    }
    if (filtros.agrupamento === 'por_convivente') {
      return ['Convivente', 'Prontuário', 'Presenças', 'Atividades'];
    }
    return ['Data', 'Atividade', 'Convivente', 'Prontuário', 'Método', 'Registrado por'];
  }, [filtros.agrupamento]);

  const rotuloAgrupamento = AGRUPAMENTOS.find((item) => item.valor === filtros.agrupamento)?.rotulo || filtros.agrupamento;

  const imprimirRelatorioAtividades = async () => {
    if (!relatorio?.linhas?.length) return;

    const logoRelatorioDataUrl = await obterLogoRelatorioDataUrl(identidadeRelatorio);
    const { colunas, dados } = montarDadosExportacaoRelatorioAtividades(relatorio, filtros.agrupamento);
    const atividadeNome = filtros.atividadeId
      ? atividades.find((item) => item.id === filtros.atividadeId)?.nome
      : null;
    const responsavelNome = filtros.responsavelUsuarioId
      ? usuarios.find((item) => item.id === filtros.responsavelUsuarioId)?.nome
      : null;

    const filtrosTexto = [
      `Período: ${formatarData(filtros.dataInicio)} a ${formatarData(filtros.dataFim)}`,
      `Agrupamento: ${rotuloAgrupamento}`,
      atividadeNome ? `Atividade: ${atividadeNome}` : null,
      responsavelNome ? `Responsável: ${responsavelNome}` : null,
    ].filter(Boolean).join(' · ');

    imprimirRelatorio({
      titulo: 'Relatório de Atividades',
      subtitulo: filtrosTexto,
      metricas: [
        { label: 'Presenças', valor: relatorio.resumo?.total_presencas ?? 0 },
        { label: 'Conviventes', valor: relatorio.resumo?.total_conviventes ?? 0 },
        { label: 'Atividades', valor: relatorio.resumo?.total_atividades ?? 0 },
        { label: 'Sessões', valor: relatorio.resumo?.total_sessoes ?? 0 },
      ],
      colunas,
      dados,
      identidade: {
        ...(identidadeRelatorio || {}),
        logo_src: logoRelatorioDataUrl || undefined,
      },
      orientacao: colunas.length > 5 ? 'landscape' : 'portrait',
    });
  };

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          titulo="Relatórios de atividades"
          subtitulo="Filtre por período, atividade, responsável ou convivente. Padrão: mês atual."
          actions={(
            <>
              <ReportActionButton
                action="export"
                onClick={() => relatorio && exportarRelatorioAtividadesXlsx(relatorio, filtros.agrupamento)}
                disabled={!relatorio?.linhas?.length}
              >
                Exportar XLSX
              </ReportActionButton>
              <ReportActionButton
                action="print"
                onClick={imprimirRelatorioAtividades}
                disabled={!relatorio?.linhas?.length}
              >
                Imprimir
              </ReportActionButton>
            </>
          )}
        />

        <div className="mb-4 grid gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:grid-cols-3">
          <label className="text-sm font-semibold text-gray-600">
            Início
            <input type="date" value={filtros.dataInicio} onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
          </label>
          <label className="text-sm font-semibold text-gray-600">
            Fim
            <input type="date" value={filtros.dataFim} onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
          </label>
          <label className="text-sm font-semibold text-gray-600">
            Agrupamento
            <select value={filtros.agrupamento} onChange={(e) => setFiltros({ ...filtros, agrupamento: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
              {AGRUPAMENTOS.map((item) => <option key={item.valor} value={item.valor}>{item.rotulo}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-gray-600">
            Atividade
            <select value={filtros.atividadeId} onChange={(e) => setFiltros({ ...filtros, atividadeId: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
              <option value="">Todas</option>
              {atividades.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-gray-600">
            Responsável
            <select value={filtros.responsavelUsuarioId} onChange={(e) => setFiltros({ ...filtros, responsavelUsuarioId: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
              <option value="">Todos</option>
              {usuarios.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <PremiumButton type="button" variant="secondary" onClick={aplicarMesAtual}>Mês atual</PremiumButton>
            <PremiumButton type="button" onClick={carregarRelatorio} disabled={carregandoRelatorio}>
              {carregandoRelatorio ? 'Gerando...' : 'Atualizar'}
            </PremiumButton>
          </div>
        </div>

        {erro && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{erro}</div>
        )}

        {relatorio && (
          <div className="mb-4 grid gap-3 md:grid-cols-4">
            {[
              ['Presenças', relatorio.resumo?.total_presencas],
              ['Conviventes', relatorio.resumo?.total_conviventes],
              ['Atividades', relatorio.resumo?.total_atividades],
              ['Sessões', relatorio.resumo?.total_sessoes],
            ].map(([rotulo, valor]) => (
              <div key={rotulo} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{rotulo}</p>
                <p className="mt-2 text-2xl font-black text-gray-900">{valor ?? 0}</p>
              </div>
            ))}
          </div>
        )}

        <ScrollArea className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          {loading || carregandoRelatorio ? (
            <p className="p-6 text-sm text-gray-500">Carregando relatório...</p>
          ) : !relatorio?.linhas?.length ? (
            <p className="p-6 text-sm text-gray-500">Nenhuma presença encontrada para os filtros selecionados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                  <tr>
                    {colunasTabela.map((coluna) => <th key={coluna} className="px-4 py-3">{coluna}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {relatorio.linhas.map((linha) => (
                    <tr key={linha.chave} className="border-t border-gray-100">
                      {filtros.agrupamento === 'por_atividade' && (
                        <>
                          <td className="px-4 py-3 font-semibold">{linha.atividade_nome}</td>
                          <td className="px-4 py-3">{linha.responsavel_nome || '-'}</td>
                          <td className="px-4 py-3">{linha.total_sessoes ?? 0}</td>
                          <td className="px-4 py-3">{linha.total_presencas ?? 0}</td>
                          <td className="px-4 py-3">{linha.total_conviventes ?? 0}</td>
                        </>
                      )}
                      {filtros.agrupamento === 'por_convivente' && (
                        <>
                          <td className="px-4 py-3 font-semibold">{linha.convivente_nome}</td>
                          <td className="px-4 py-3">{linha.prontuario || '-'}</td>
                          <td className="px-4 py-3">{linha.total_presencas ?? 0}</td>
                          <td className="px-4 py-3">{linha.total_atividades ?? 0}</td>
                        </>
                      )}
                      {filtros.agrupamento === 'detalhado' && (
                        <>
                          <td className="px-4 py-3">{formatarData(linha.data_sessao)}</td>
                          <td className="px-4 py-3">{linha.atividade_nome}</td>
                          <td className="px-4 py-3">{linha.convivente_nome}</td>
                          <td className="px-4 py-3">{linha.prontuario || '-'}</td>
                          <td className="px-4 py-3">{linha.metodo_leitura}</td>
                          <td className="px-4 py-3">{linha.registrado_por_nome || '-'}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ScrollArea>
      </MainShell>
    </AppShell>
  );
}
