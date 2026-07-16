import { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from './Sidebar';
import { AppShell, MainShell, PageHeader, ReportActionButton, ScrollArea } from './components/PremiumUI';
import { useAuth } from './context/AuthContext';
import {
  cancelarPresencaAtividade,
  desfazerPresencaAtividade,
  listarAtividades,
  obterGradeAtividade,
  registrarPresencaAtividade,
} from './services/atividadesService';
import { mesReferenciaAtual, usuarioSomenteLeituraAtividades } from './config/atividadesConfig';
import { registroAindaPodeSerDesfeitoRotina } from './utils/rotinaDiariaUtils';
import { exportarGradeAtividadeXlsx } from './utils/exportarAtividadesXlsx';
import { formatarDataBr } from './utils/dataBrasilUtils';

function formatarDataCurta(valor) {
  if (!valor) return '-';
  const completo = formatarDataBr(valor);
  return completo ? completo.slice(0, 5) : '-';
}

function linhaTemPresenca(linha) {
  return Object.values(linha.presencas_por_ocorrencia || {}).some(Boolean);
}

export default function AtividadesGrade() {
  const { usuario } = useAuth();
  const somenteLeitura = usuarioSomenteLeituraAtividades(usuario);
  const [atividades, setAtividades] = useState([]);
  const [atividadeId, setAtividadeId] = useState('');
  const [mesReferencia, setMesReferencia] = useState(mesReferenciaAtual());
  const [grade, setGrade] = useState(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const carregarAtividades = useCallback(async () => {
    setLoading(true);
    try {
      const lista = await listarAtividades(true);
      setAtividades(lista.items || []);
    } catch (error) {
      setErro(error.response?.data?.detail || 'Não foi possível carregar as atividades.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarAtividades();
  }, [carregarAtividades]);

  const carregarGrade = useCallback(async () => {
    if (!atividadeId) {
      setGrade(null);
      return;
    }
    setErro('');
    try {
      const dados = await obterGradeAtividade(atividadeId, mesReferencia);
      setGrade(dados);
    } catch (error) {
      setErro(error.response?.data?.detail || 'Não foi possível carregar a grade mensal.');
    }
  }, [atividadeId, mesReferencia]);

  useEffect(() => {
    carregarGrade();
  }, [carregarGrade]);

  const linhasComPresenca = useMemo(
    () => (grade?.linhas || []).filter(linhaTemPresenca),
    [grade],
  );

  const alternarCelula = async (ocorrenciaId, linha) => {
    if (somenteLeitura) return;
    const presenca = linha.presencas_por_ocorrencia?.[ocorrenciaId];
    setSalvando(true);
    setErro('');
    try {
      if (!presenca) {
        await registrarPresencaAtividade(ocorrenciaId, {
          convivente_id: linha.convivente_id,
          metodo_leitura: 'Manual',
        });
      } else if (presenca.pode_desfazer || registroAindaPodeSerDesfeitoRotina(presenca.registrado_em)) {
        await desfazerPresencaAtividade(presenca.id);
      } else {
        const motivo = window.prompt('Informe o motivo para remover a presença manual:');
        if (!motivo?.trim()) return;
        await cancelarPresencaAtividade(presenca.id, motivo.trim());
      }
      await carregarGrade();
    } catch (error) {
      setErro(error.response?.data?.detail || 'Não foi possível atualizar a presença.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          titulo="Grade mensal"
          subtitulo="Exibe apenas conviventes com pelo menos uma presença no mês. Para registrar novas presenças, use Chamada de presença."
          actions={grade ? (
            <ReportActionButton type="button" onClick={() => exportarGradeAtividadeXlsx(grade, { somenteComPresenca: true })}>
              Exportar XLSX
            </ReportActionButton>
          ) : null}
        />

        <div className="mb-4 grid gap-3 md:grid-cols-2">
          <select
            value={atividadeId}
            onChange={(event) => setAtividadeId(event.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="">Selecione a atividade</option>
            {atividades.map((item) => (
              <option key={item.id} value={item.id}>{item.nome}</option>
            ))}
          </select>
          <input
            type="month"
            value={mesReferencia}
            onChange={(event) => setMesReferencia(event.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />
        </div>

        {erro && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {erro}
          </div>
        )}

        <ScrollArea className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          {loading ? (
            <p className="p-6 text-sm text-gray-500">Carregando...</p>
          ) : !grade ? (
            <p className="p-6 text-sm text-gray-500">Selecione uma atividade para visualizar a grade.</p>
          ) : grade.ocorrencias.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">Nenhuma sessão gerada para este mês. Gere as sessões no cadastro.</p>
          ) : linhasComPresenca.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">
              Nenhuma presença registrada nesta atividade para o mês selecionado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3">Convivente</th>
                    {grade.ocorrencias.map((ocorrencia) => (
                      <th key={ocorrencia.id} className="px-3 py-3 text-center whitespace-nowrap">
                        {formatarDataCurta(ocorrencia.data_sessao)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhasComPresenca.map((linha) => (
                    <tr key={linha.convivente_id} className="border-t border-gray-100">
                      <td className="sticky left-0 z-10 bg-white px-4 py-3 font-semibold text-gray-800">
                        <div>{linha.nome}</div>
                        <div className="text-xs text-gray-500">#{linha.prontuario || 'S/N'}</div>
                      </td>
                      {grade.ocorrencias.map((ocorrencia) => {
                        const presenca = linha.presencas_por_ocorrencia?.[ocorrencia.id];
                        const presente = Boolean(presenca);
                        return (
                          <td key={ocorrencia.id} className="px-3 py-3 text-center">
                            <button
                              type="button"
                              disabled={somenteLeitura || salvando}
                              onClick={() => alternarCelula(ocorrencia.id, linha)}
                              className={`min-h-10 min-w-10 rounded-xl border text-xs font-bold ${
                                presente
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : 'border-gray-200 bg-white text-gray-400 hover:bg-gray-50'
                              }`}
                              title={presente ? `Presente (${presenca.metodo_leitura})` : 'Marcar presente'}
                            >
                              {presente ? 'P' : '—'}
                            </button>
                          </td>
                        );
                      })}
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
