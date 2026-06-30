import { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from './Sidebar';
import { AppShell, MainShell, PageHeader, PremiumButton, ScrollArea } from './components/PremiumUI';
import LeitorCarteirinhaModal from './components/LeitorCarteirinhaModal';
import { useAuth } from './context/AuthContext';
import {
  listarResgatesPontosAtividades,
  obterRankingPontosAtividades,
  registrarResgatePontosAtividades,
} from './services/atividadesService';
import { PONTOS_POR_PRESENCA_ATIVIDADE, usuarioSomenteLeituraAtividades } from './config/atividadesConfig';
import { encontrarConviventePorCodigo } from './utils/conviventeIdentificacaoUtils';

function formatarDataHora(valor) {
  if (!valor) return '-';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '-';
  return data.toLocaleString('pt-BR');
}

export default function AtividadesPontosBrindes() {
  const { usuario } = useAuth();
  const somenteLeitura = usuarioSomenteLeituraAtividades(usuario);

  const [ranking, setRanking] = useState([]);
  const [resgates, setResgates] = useState([]);
  const [busca, setBusca] = useState('');
  const [pontosResgate, setPontosResgate] = useState('10');
  const [descricaoBrinde, setDescricaoBrinde] = useState('');
  const [conviventeSelecionado, setConviventeSelecionado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [scannerAberto, setScannerAberto] = useState(false);

  const carregarDados = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const [rankingResp, resgatesResp] = await Promise.all([
        obterRankingPontosAtividades({ busca: busca.trim() || undefined }),
        listarResgatesPontosAtividades({ limit: 25 }),
      ]);
      setRanking(rankingResp.items || []);
      setResgates(resgatesResp.items || []);
    } catch (error) {
      setErro(error.response?.data?.detail || 'Não foi possível carregar o ranking de pontos.');
    } finally {
      setLoading(false);
    }
  }, [busca]);

  useEffect(() => {
    const timer = setTimeout(() => {
      carregarDados();
    }, busca ? 300 : 0);
    return () => clearTimeout(timer);
  }, [carregarDados, busca]);

  const conviventesParaBusca = useMemo(
    () => ranking.map((item) => ({
      id: item.convivente_id,
      nome: item.nome,
      nome_completo: item.nome,
      numero_institucional: item.numero_institucional,
      saldo_pontos: item.saldo_pontos,
    })),
    [ranking],
  );

  const abrirResgate = () => {
    if (somenteLeitura) return;
    const pontos = Number(pontosResgate);
    if (!Number.isFinite(pontos) || pontos <= 0) {
      setErro('Informe uma quantidade válida de pontos para o resgate.');
      return;
    }
    setErro('');
    setSucesso('');
    setScannerAberto(true);
  };

  const processarCodigoLido = async (codigo) => {
    const pontos = Number(pontosResgate);
    if (!Number.isFinite(pontos) || pontos <= 0) {
      setErro('Informe uma quantidade válida de pontos.');
      return 'erro_tratado';
    }

    const convivente = encontrarConviventePorCodigo(conviventesParaBusca, codigo);
    if (!convivente) {
      setErro('Carteirinha não reconhecida entre os conviventes elegíveis.');
      return 'erro_tratado';
    }

    if (conviventeSelecionado && conviventeSelecionado.convivente_id !== convivente.id) {
      setErro('A carteirinha lida não corresponde ao convivente selecionado no ranking.');
      return 'erro_tratado';
    }

    const itemRanking = ranking.find((item) => item.convivente_id === convivente.id);
    if (itemRanking && pontos > itemRanking.saldo_pontos) {
      setErro(`Saldo insuficiente. Disponível: ${itemRanking.saldo_pontos} pontos.`);
      return 'erro_tratado';
    }

    setSalvando(true);
    setErro('');
    try {
      const resultado = await registrarResgatePontosAtividades({
        convivente_id: convivente.id,
        pontos_utilizados: pontos,
        descricao_brinde: descricaoBrinde.trim() || null,
        metodo_leitura: 'QR Code',
        codigo_lido: codigo,
      });
      setSucesso(
        `Resgate confirmado para ${resultado.convivente_nome}: ${resultado.pontos_utilizados} pontos. `
        + `Saldo restante: ${resultado.saldo_restante}.`,
      );
      setDescricaoBrinde('');
      setConviventeSelecionado(null);
      await carregarDados();
      return true;
    } catch (error) {
      setErro(error.response?.data?.detail || 'Não foi possível registrar o resgate.');
      return 'erro_tratado';
    } finally {
      setSalvando(false);
    }
  };

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          titulo="Pontos e brindes"
          subtitulo={`Cada presença em atividade vale ${PONTOS_POR_PRESENCA_ATIVIDADE} pontos cumulativos para troca por brindes.`}
        />

        {erro && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {erro}
          </div>
        )}
        {sucesso && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {sucesso}
          </div>
        )}

        <div className="mb-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-brand/20 bg-white p-4 shadow-sm lg:col-span-1">
            <h2 className="text-sm font-bold text-brand mb-3">Resgate de brinde</h2>
            <p className="text-xs text-gray-600 mb-4">
              Defina os pontos e leia a carteirinha do convivente para confirmar a compra.
              {conviventeSelecionado && (
                <span className="mt-2 block font-semibold text-gray-800">
                  Selecionado: {conviventeSelecionado.nome} ({conviventeSelecionado.saldo_pontos} pts)
                </span>
              )}
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Pontos a utilizar</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={pontosResgate}
                  onChange={(e) => setPontosResgate(e.target.value)}
                  disabled={somenteLeitura || salvando}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Descrição do brinde (opcional)</label>
                <input
                  type="text"
                  value={descricaoBrinde}
                  onChange={(e) => setDescricaoBrinde(e.target.value)}
                  disabled={somenteLeitura || salvando}
                  placeholder="Ex.: Kit higiene, camiseta, lanche..."
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <PremiumButton
                type="button"
                onClick={abrirResgate}
                disabled={somenteLeitura || salvando}
                className="w-full"
              >
                Ler carteirinha e confirmar
              </PremiumButton>
              {conviventeSelecionado && (
                <button
                  type="button"
                  onClick={() => setConviventeSelecionado(null)}
                  className="w-full text-xs text-gray-500 hover:text-gray-700"
                >
                  Limpar convivente selecionado
                </button>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm lg:col-span-2">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-bold text-brand">Ranking de participação</h2>
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar convivente..."
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm sm:max-w-xs"
              />
            </div>

            <ScrollArea className="max-h-[420px]">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-2">#</th>
                    <th className="py-2 pr-2">Convivente</th>
                    <th className="py-2 pr-2 text-center">Presenças</th>
                    <th className="py-2 pr-2 text-center">Ganhos</th>
                    <th className="py-2 pr-2 text-center">Usados</th>
                    <th className="py-2 text-center">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-gray-500">Carregando...</td>
                    </tr>
                  ) : ranking.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-gray-500">Nenhum convivente encontrado.</td>
                    </tr>
                  ) : (
                    ranking.map((item) => {
                      const selecionado = conviventeSelecionado?.convivente_id === item.convivente_id;
                      return (
                        <tr
                          key={item.convivente_id}
                          onClick={() => !somenteLeitura && setConviventeSelecionado(item)}
                          className={`border-b border-gray-100 cursor-pointer hover:bg-brand/5 ${
                            selecionado ? 'bg-brand/10' : ''
                          }`}
                        >
                          <td className="py-2 pr-2 font-semibold text-brand">{item.posicao}</td>
                          <td className="py-2 pr-2">
                            <div className="font-medium text-gray-800">{item.nome}</div>
                            {item.numero_institucional && (
                              <div className="text-[11px] text-gray-500">Pront. {item.numero_institucional}</div>
                            )}
                          </td>
                          <td className="py-2 pr-2 text-center">{item.total_presencas}</td>
                          <td className="py-2 pr-2 text-center">{item.pontos_ganhos}</td>
                          <td className="py-2 pr-2 text-center">{item.pontos_utilizados}</td>
                          <td className="py-2 text-center font-bold text-emerald-700">{item.saldo_pontos}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-brand mb-3">Últimos resgates</h2>
          <ScrollArea className="max-h-72">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-2">Data</th>
                  <th className="py-2 pr-2">Convivente</th>
                  <th className="py-2 pr-2">Brinde</th>
                  <th className="py-2 pr-2 text-center">Pontos</th>
                  <th className="py-2">Operador</th>
                </tr>
              </thead>
              <tbody>
                {resgates.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-gray-500">Nenhum resgate registrado ainda.</td>
                  </tr>
                ) : (
                  resgates.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100">
                      <td className="py-2 pr-2 whitespace-nowrap">{formatarDataHora(item.registrado_em)}</td>
                      <td className="py-2 pr-2">{item.convivente_nome}</td>
                      <td className="py-2 pr-2">{item.descricao_brinde || '—'}</td>
                      <td className="py-2 pr-2 text-center font-semibold text-amber-700">-{item.pontos_utilizados}</td>
                      <td className="py-2">{item.usuario_nome || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ScrollArea>
        </div>

        <LeitorCarteirinhaModal
          aberto={scannerAberto}
          onClose={() => setScannerAberto(false)}
          onCodigoLido={processarCodigoLido}
          titulo="Confirmar resgate com carteirinha"
          subtitulo="O convivente deve apresentar a carteirinha para debitar os pontos do saldo."
          placeholder="Código da carteirinha"
          erroExterno={erro}
        />
      </MainShell>
    </AppShell>
  );
}
