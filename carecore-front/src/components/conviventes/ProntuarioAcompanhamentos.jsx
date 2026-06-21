import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  listarAcompanhamentosPorConvivente,
} from '../../services/acompanhamentosService';
import { REGISTROS_POR_PAGINA_ACOMPANHAMENTO_PRONTUARIO } from '../../utils/prontuarioHistoricoFluxoUtils';

function formatarData(valor) {
  if (!valor) return '-';
  const partes = String(valor).slice(0, 10).split('-');
  if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
  return String(valor);
}

function formatarMes(valor) {
  if (!valor) return '-';
  const [ano, mes] = String(valor).split('-');
  if (ano && mes) return `${mes}/${ano}`;
  return String(valor);
}

const ESTADO_SECAO_VAZIO = {
  items: [],
  total: 0,
  offset: 0,
  limit: REGISTROS_POR_PAGINA_ACOMPANHAMENTO_PRONTUARIO,
  has_more: false,
};

const CONFIG_SECOES = [
  {
    chave: 'transferencias',
    titulo: 'Transferências e saídas',
    vazio: 'Sem transferências registradas.',
    renderItem: (registro) => (
      <>
        <p className="font-bold text-slate-800">{registro.destino_exibicao || registro.destino}</p>
        <p className="mt-1 text-slate-600">
          Transferência: {formatarData(registro.data_transferencia)}
          {registro.data_discussao ? ` · Discussão: ${formatarData(registro.data_discussao)}` : ''}
        </p>
        {registro.observacoes && <p className="mt-2 whitespace-pre-wrap">{registro.observacoes}</p>}
        <p className="mt-2 text-[10px] text-slate-500">
          {formatarData(registro.criado_em?.slice?.(0, 10) || registro.criado_em)} · {registro.registrado_por_nome || 'Equipe'}
        </p>
      </>
    ),
  },
  {
    chave: 'discussoes_hospitalares',
    titulo: 'Discussões hospitalares',
    vazio: 'Sem discussões hospitalares.',
    renderItem: (registro) => (
      <>
        <p className="font-bold text-slate-800">
          {registro.hospital_exibicao || registro.nome_hospital}
          {registro.situacao_atual ? ` · ${registro.situacao_atual}` : ''}
        </p>
        <p className="mt-1 text-slate-600">
          Discussão: {formatarData(registro.data_discussao)}
          {registro.data_prevista_entrada ? ` · Previsão: ${formatarData(registro.data_prevista_entrada)}` : ''}
        </p>
        {registro.observacoes && <p className="mt-2 whitespace-pre-wrap">{registro.observacoes}</p>}
        {(registro.evolucoes || []).length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-slate-200 pt-2">
            {registro.evolucoes.map(evolucao => (
              <li key={evolucao.id} className="text-[11px] text-slate-600">
                <span className="font-bold text-violet-800">{evolucao.status_evolucao}</span>
                {' · '}
                {formatarData(evolucao.data_evolucao)}
                {evolucao.observacoes ? ` — ${evolucao.observacoes}` : ''}
              </li>
            ))}
          </ul>
        )}
      </>
    ),
  },
  {
    chave: 'tuberculose',
    titulo: 'Tuberculose (TB)',
    vazio: 'Sem registros de TB.',
    renderItem: (registro) => (
      <>
        <p className="font-bold text-slate-800">{registro.situacao || 'Situação não informada'}</p>
        <p className="mt-1 text-slate-600">
          Início: {formatarData(registro.data_inicio)}
          {registro.data_fim ? ` · Fim: ${formatarData(registro.data_fim)}` : ''}
        </p>
        {registro.observacoes && <p className="mt-2 whitespace-pre-wrap">{registro.observacoes}</p>}
      </>
    ),
  },
  {
    chave: 'pot',
    titulo: 'POT',
    vazio: 'Sem registros de POT.',
    renderItem: (registro) => (
      <>
        <p className="font-bold text-slate-800">
          Inserção: {formatarData(registro.data_insercao)}
          {registro.congelamento_ativo ? ' · Congelamento ativo' : ''}
        </p>
        {registro.observacoes && <p className="mt-2 whitespace-pre-wrap">{registro.observacoes}</p>}
      </>
    ),
  },
  {
    chave: 'suspensoes_provisorias',
    titulo: 'Suspensão provisória',
    vazio: 'Sem suspensões registradas.',
    renderItem: (registro) => (
      <>
        <p className="font-bold text-slate-800">
          {registro.status_aplicado || 'Bloqueado'} · Ref. {formatarMes(registro.mes_referencia)}
        </p>
        <p className="mt-1 text-slate-600">Registro: {formatarData(registro.data_registro)}</p>
        {registro.motivo && <p className="mt-2 whitespace-pre-wrap">{registro.motivo}</p>}
      </>
    ),
  },
];

function ListaRegistros({
  titulo,
  secao,
  renderItem,
  vazio,
  onCarregarMais,
  carregandoMais,
}) {
  const registros = secao?.items || [];
  const total = secao?.total || 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-black uppercase tracking-wide text-slate-700">{titulo}</h4>
        {total > 0 && (
          <span className="text-[10px] font-semibold text-slate-500">
            {registros.length} de {total}
          </span>
        )}
      </div>
      {registros.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">{vazio}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {registros.map(registro => (
            <li key={registro.id} className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 text-xs text-slate-700">
              {renderItem(registro)}
            </li>
          ))}
        </ul>
      )}
      {secao?.has_more && (
        <button
          type="button"
          onClick={onCarregarMais}
          disabled={carregandoMais}
          className="mt-3 w-full rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 disabled:opacity-60"
        >
          {carregandoMais ? 'Carregando...' : 'Carregar mais nesta seção'}
        </button>
      )}
    </div>
  );
}

export default function ProntuarioAcompanhamentos({ conviventeId }) {
  const [secoes, setSecoes] = useState({});
  const [loading, setLoading] = useState(false);
  const [carregandoSecao, setCarregandoSecao] = useState('');
  const [erro, setErro] = useState('');

  const totalGeral = useMemo(
    () => CONFIG_SECOES.reduce((acc, config) => acc + (secoes[config.chave]?.total || 0), 0),
    [secoes],
  );

  const carregar = useCallback(async () => {
    if (!conviventeId) return;

    try {
      setLoading(true);
      setErro('');
      const response = await listarAcompanhamentosPorConvivente(conviventeId, {
        limite: REGISTROS_POR_PAGINA_ACOMPANHAMENTO_PRONTUARIO,
      });
      setSecoes(response || {});
    } catch (error) {
      setErro(error?.response?.data?.detail || 'Não foi possível carregar os acompanhamentos técnicos.');
      setSecoes({});
    } finally {
      setLoading(false);
    }
  }, [conviventeId]);

  const carregarMaisSecao = useCallback(async (chaveSecao) => {
    if (!conviventeId) return;

    const secaoAtual = secoes[chaveSecao] || ESTADO_SECAO_VAZIO;
    if (!secaoAtual.has_more) return;

    try {
      setCarregandoSecao(chaveSecao);
      setErro('');
      const response = await listarAcompanhamentosPorConvivente(conviventeId, {
        secao: chaveSecao,
        offset: secaoAtual.items.length,
        limite: secaoAtual.limit || REGISTROS_POR_PAGINA_ACOMPANHAMENTO_PRONTUARIO,
      });

      setSecoes(prev => ({
        ...prev,
        [chaveSecao]: {
          ...response,
          items: [...(prev[chaveSecao]?.items || []), ...(response.items || [])],
        },
      }));
    } catch (error) {
      setErro(error?.response?.data?.detail || 'Não foi possível carregar mais registros.');
    } finally {
      setCarregandoSecao('');
    }
  }, [conviventeId, secoes]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (!conviventeId) return null;

  return (
    <section className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-sm font-black text-indigo-950">Acompanhamentos técnicos</h3>
          <p className="mt-1 text-xs font-semibold text-indigo-700">
            Transferências, discussões hospitalares, TB, POT e suspensões. Exibimos {REGISTROS_POR_PAGINA_ACOMPANHAMENTO_PRONTUARIO} registros por seção; use &quot;Carregar mais&quot; quando houver histórico longo.
          </p>
        </div>
        <button
          type="button"
          onClick={carregar}
          className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-black text-indigo-700"
        >
          Atualizar
        </button>
      </div>

      {erro && (
        <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{erro}</p>
      )}

      {loading && Object.keys(secoes).length === 0 && (
        <p className="mt-4 text-xs font-semibold text-indigo-700 animate-pulse">Carregando acompanhamentos...</p>
      )}

      {!loading && totalGeral === 0 && Object.keys(secoes).length > 0 && (
        <p className="mt-4 rounded-lg border border-dashed border-indigo-200 bg-white px-3 py-4 text-center text-xs text-slate-500">
          Nenhum registro de acompanhamento técnico para este convivente.
        </p>
      )}

      {Object.keys(secoes).length > 0 && totalGeral > 0 && (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {CONFIG_SECOES.map(config => (
            <ListaRegistros
              key={config.chave}
              titulo={config.titulo}
              secao={secoes[config.chave] || ESTADO_SECAO_VAZIO}
              renderItem={config.renderItem}
              vazio={config.vazio}
              onCarregarMais={() => carregarMaisSecao(config.chave)}
              carregandoMais={carregandoSecao === config.chave}
            />
          ))}
        </div>
      )}
    </section>
  );
}
