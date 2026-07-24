import { useEffect, useState } from 'react';

import { STATUS_EVOLUCAO_POT } from '../../config/acompanhamentosConfig';
import { PremiumButton } from '../PremiumUI';
import {
  criarEvolucaoPot,
  obterPot,
} from '../../services/acompanhamentosService';

function formatarData(valor) {
  if (!valor) return '-';
  const partes = String(valor).slice(0, 10).split('-');
  if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
  return String(valor);
}

function dataHojeISO() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
}

export default function PotEvolucoesModal({
  registro,
  somenteLeitura,
  onFechar,
  onAtualizado,
}) {
  const [detalhe, setDetalhe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [form, setForm] = useState({
    status_evolucao: 'Em participação',
    data_evolucao: dataHojeISO(),
    observacoes: '',
  });

  const encerrado = detalhe?.situacao_atual === 'Encerrado';

  const carregar = async () => {
    try {
      setLoading(true);
      setErro('');
      const dados = await obterPot(registro.id);
      setDetalhe(dados);
    } catch (error) {
      setErro(error?.response?.data?.detail || 'Não foi possível carregar as evoluções.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, [registro.id]);

  const salvarEvolucao = async () => {
    if (!form.status_evolucao || !form.data_evolucao) {
      setErro('Informe status e data da evolução.');
      return;
    }

    try {
      setSalvando(true);
      setErro('');
      await criarEvolucaoPot(registro.id, {
        status_evolucao: form.status_evolucao,
        data_evolucao: form.data_evolucao,
        observacoes: form.observacoes || null,
      });
      setForm({
        status_evolucao: 'Em participação',
        data_evolucao: dataHojeISO(),
        observacoes: '',
      });
      await carregar();
      onAtualizado?.();
    } catch (error) {
      setErro(error?.response?.data?.detail || 'Não foi possível salvar a evolução.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/45 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Evoluções do POT</h2>
            <p className="mt-1 text-sm text-slate-500">
              {registro.convivente_nome} · Programa Operação Trabalho
            </p>
            {detalhe?.situacao_atual && (
              <p className="mt-2 text-xs font-bold text-emerald-700">
                Situação atual: {detalhe.situacao_atual}
              </p>
            )}
          </div>
          <button type="button" onClick={onFechar} className="text-sm text-slate-500 hover:text-slate-700">
            Fechar
          </button>
        </div>

        {erro && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {erro}
          </div>
        )}

        {loading ? (
          <p className="mt-6 text-sm text-slate-500">Carregando...</p>
        ) : (
          <>
            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm">
              <p className="font-semibold text-slate-800">Registro inicial</p>
              <p className="mt-1 text-slate-600">
                Inserção: {formatarData(detalhe?.data_insercao)}
                {detalhe?.data_desligamento ? ` · Desligamento: ${formatarData(detalhe.data_desligamento)}` : ''}
                {detalhe?.congelamento_ativo ? ' · Congelamento ativo' : ''}
              </p>
              <p className="mt-1 text-slate-600">
                {detalhe?.local ? `Local: ${detalhe.local}` : null}
                {detalhe?.atividade ? `${detalhe?.local ? ' · ' : ''}Atividade: ${detalhe.atividade}` : null}
                {!detalhe?.local && !detalhe?.atividade ? 'Local e atividade ainda não informados.' : null}
              </p>
              <p className="mt-1 text-slate-600">
                Referência: {detalhe?.tecnico_referencia || 'não definido'}
                {detalhe?.indicacao ? ` · Indicação: ${detalhe.indicacao}` : ''}
              </p>
              {detalhe?.observacoes && (
                <p className="mt-2 whitespace-pre-wrap text-slate-600">{detalhe.observacoes}</p>
              )}
            </div>

            <div className="mt-4 space-y-2">
              <h3 className="text-sm font-bold text-slate-700">Linha do tempo</h3>
              {(detalhe?.evolucoes || []).length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma evolução registrada ainda.</p>
              ) : (
                <ul className="space-y-2">
                  {detalhe.evolucoes.map(evolucao => (
                    <li key={evolucao.id} className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-emerald-900">{evolucao.status_evolucao}</span>
                        <span className="text-xs text-slate-500">{formatarData(evolucao.data_evolucao)}</span>
                      </div>
                      {evolucao.observacoes && (
                        <p className="mt-2 whitespace-pre-wrap text-slate-700">{evolucao.observacoes}</p>
                      )}
                      <p className="mt-2 text-[10px] text-slate-500">
                        {evolucao.registrado_por_nome || 'Equipe'}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {!somenteLeitura && !encerrado && (
              <div className="mt-5 rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-bold text-slate-700">Nova evolução</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="text-sm">
                    <span className="mb-1 block font-medium text-slate-600">Status *</span>
                    <select
                      value={form.status_evolucao}
                      onChange={(event) => setForm(prev => ({ ...prev, status_evolucao: event.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    >
                      {STATUS_EVOLUCAO_POT.map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block font-medium text-slate-600">Data *</span>
                    <input
                      type="date"
                      value={form.data_evolucao}
                      onChange={(event) => setForm(prev => ({ ...prev, data_evolucao: event.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="md:col-span-2 text-sm">
                    <span className="mb-1 block font-medium text-slate-600">Observações</span>
                    <textarea
                      rows={3}
                      value={form.observacoes}
                      onChange={(event) => setForm(prev => ({ ...prev, observacoes: event.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Detalhes da evolução..."
                    />
                  </label>
                </div>
                <div className="mt-4 flex justify-end">
                  <PremiumButton onClick={salvarEvolucao} disabled={salvando}>
                    {salvando ? 'Salvando...' : 'Registrar evolução'}
                  </PremiumButton>
                </div>
              </div>
            )}

            {encerrado && (
              <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Este registro POT foi encerrado. Novas evoluções não podem ser registradas.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
