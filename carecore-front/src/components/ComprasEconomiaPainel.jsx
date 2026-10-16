import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { CampoSelect, CampoTexto } from './UsuariosCampos';
import {
  EmptyState,
  FilterPanel,
  ReportActionButton,
  SectionCard,
} from './PremiumUI';
import { comprasEconomia, moneyCentavos } from '../services/comprasService';
import { formatarDataBr } from '../utils/dataBrasilUtils';
import {
  exportarEconomia,
  imprimirEconomia,
} from '../utils/comprasEconomiaExportPrint';

function mensagemErro(err) {
  const detalhe = err?.response?.data?.detail;
  if (typeof detalhe === 'string' && detalhe.trim()) return detalhe;
  return 'Não foi possível carregar a economia.';
}

function rotuloPeriodo(inicio, fim) {
  if (!inicio && !fim) return 'Todo o período';
  if (inicio && fim) return `${formatarDataBr(inicio)} a ${formatarDataBr(fim)}`;
  if (inicio) return `A partir de ${formatarDataBr(inicio)}`;
  return `Até ${formatarDataBr(fim)}`;
}

function Cartao({ rotulo, valor }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{rotulo}</p>
      <p className="mt-1 text-sm font-bold text-slate-900">{valor}</p>
    </div>
  );
}

export default function ComprasEconomiaPainel({
  visaoOrganizacao = false,
  unidades = [],
  nomeProjeto = '',
}) {
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [unidade, setUnidade] = useState('');
  const [economia, setEconomia] = useState(null);
  const [abertos, setAbertos] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [exportando, setExportando] = useState(false);

  const periodoInvalido = Boolean(dataInicio && dataFim && dataInicio > dataFim);

  const opcoesUnidade = useMemo(() => ([
    { value: 'sede', label: 'Sede' },
    ...(unidades || []).map((item) => ({
      value: item.id,
      label: item.nome || 'Projeto',
    })),
  ]), [unidades]);

  const nomeUnidadeFiltro = useMemo(() => {
    if (!visaoOrganizacao) return nomeProjeto || 'Este projeto';
    if (!unidade) return 'Todos os projetos e a Sede';
    if (unidade === 'sede') return 'Sede';
    return opcoesUnidade.find((item) => item.value === unidade)?.label || 'Projeto';
  }, [nomeProjeto, opcoesUnidade, unidade, visaoOrganizacao]);

  useEffect(() => {
    if (periodoInvalido) {
      setErro('A data inicial não pode ser depois da data final.');
      setCarregando(false);
      return undefined;
    }
    let cancelado = false;
    setCarregando(true);
    setErro('');
    const params = {
      data_inicio: dataInicio || undefined,
      data_fim: dataFim || undefined,
    };
    if (visaoOrganizacao && unidade === 'sede') params.escopo = 'sede';
    else if (visaoOrganizacao && unidade) params.instituicao_id = unidade;
    (async () => {
      try {
        const pacote = await comprasEconomia(params);
        if (!cancelado) setEconomia(pacote);
      } catch (err) {
        if (!cancelado) {
          setEconomia(null);
          setErro(mensagemErro(err));
        }
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => { cancelado = true; };
  }, [dataFim, dataInicio, periodoInvalido, unidade, visaoOrganizacao]);

  const projetos = economia?.projetos || [];
  const temPedidos = (economia?.pedidos || 0) > 0;
  const filtrosRelatorio = {
    Período: rotuloPeriodo(dataInicio, dataFim),
    Projeto: nomeUnidadeFiltro,
  };

  const alternar = (chave) => {
    setAbertos((atual) => ({ ...atual, [chave]: !atual[chave] }));
  };

  const exportar = async () => {
    setExportando(true);
    try {
      await exportarEconomia({ projetos, filtros: filtrosRelatorio, resumo: economia });
    } finally {
      setExportando(false);
    }
  };

  const imprimir = async () => {
    setExportando(true);
    try {
      await imprimirEconomia({
        projetos,
        filtros: filtrosRelatorio,
        resumo: economia,
        sede: visaoOrganizacao,
      });
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="space-y-4">
      <FilterPanel
        title="Filtros"
        subtitle="O período usa o dia em que o pedido foi aprovado. Valor cheio é a cotação mais alta."
      >
        <div className="grid gap-3 md:grid-cols-3">
          <CampoTexto
            label="De"
            type="date"
            value={dataInicio}
            max={dataFim || undefined}
            onChange={setDataInicio}
          />
          <CampoTexto
            label="Até"
            type="date"
            value={dataFim}
            min={dataInicio || undefined}
            onChange={setDataFim}
          />
          {visaoOrganizacao ? (
            <CampoSelect
              label="Projeto"
              value={unidade}
              onChange={setUnidade}
              placeholder="Todos os projetos e a Sede"
              options={opcoesUnidade}
            />
          ) : (
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-600">Projeto</p>
              <p className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800">
                {nomeProjeto || 'Este projeto'}
              </p>
            </div>
          )}
        </div>
      </FilterPanel>

      <SectionCard
        title="Economia das cotações"
        subtitle={visaoOrganizacao
          ? 'Totais do período e, em cada projeto, o detalhe dos pedidos.'
          : 'Economia deste projeto no período selecionado.'}
        actions={(
          <>
            <ReportActionButton
              action="export"
              disabled={!temPedidos || carregando || exportando || periodoInvalido}
              onClick={exportar}
            >
              Exportar XLSX
            </ReportActionButton>
            <ReportActionButton
              disabled={!temPedidos || carregando || exportando || periodoInvalido}
              onClick={imprimir}
            >
              Imprimir
            </ReportActionButton>
          </>
        )}
      >
        <div className="space-y-4 p-5">
          {erro && (
            <p className="text-sm font-semibold text-red-600">{erro}</p>
          )}
          {carregando && !economia && (
            <p className="text-sm text-slate-500">Carregando economia…</p>
          )}
          {economia && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Cartao rotulo="Pedidos" valor={economia.pedidos} />
              <Cartao rotulo="Valor cheio" valor={moneyCentavos(economia.total_cheio_centavos)} />
              <Cartao rotulo="Valor escolhida" valor={moneyCentavos(economia.total_escolhida_centavos)} />
              <Cartao rotulo="Economia vs maior" valor={moneyCentavos(economia.economia_vs_maior_centavos)} />
              <Cartao rotulo="Economia vs média" valor={moneyCentavos(economia.economia_vs_media_centavos)} />
            </div>
          )}
          {!carregando && economia && !temPedidos && (
            <EmptyState
              title="Nenhum pedido aprovado neste filtro"
              subtitle="Ajuste o período ou o projeto. Entram pedidos aprovados, enviados ou recebidos."
            />
          )}
          {temPedidos && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-500">
                    <th className="py-2 pr-3">Projeto</th>
                    <th className="py-2 pr-3 text-right">Pedidos</th>
                    <th className="py-2 pr-3 text-right">Valor cheio</th>
                    <th className="py-2 pr-3 text-right">Escolhida</th>
                    <th className="py-2 pr-3 text-right">vs maior</th>
                    <th className="py-2 text-right">vs média</th>
                  </tr>
                </thead>
                <tbody>
                  {projetos.map((projeto) => {
                    const aberto = Boolean(abertos[projeto.chave]);
                    return (
                      <Fragment key={projeto.chave}>
                        <tr className="border-t border-slate-100">
                          <td className="py-2 pr-3">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 font-semibold text-slate-900"
                              aria-expanded={aberto}
                              onClick={() => alternar(projeto.chave)}
                            >
                              {aberto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              {projeto.nome}
                            </button>
                          </td>
                          <td className="py-2 pr-3 text-right">{projeto.pedidos}</td>
                          <td className="py-2 pr-3 text-right">{moneyCentavos(projeto.total_cheio_centavos)}</td>
                          <td className="py-2 pr-3 text-right">{moneyCentavos(projeto.total_escolhida_centavos)}</td>
                          <td className="py-2 pr-3 text-right">{moneyCentavos(projeto.economia_vs_maior_centavos)}</td>
                          <td className="py-2 text-right">{moneyCentavos(projeto.economia_vs_media_centavos)}</td>
                        </tr>
                        {aberto && (projeto.linhas || []).map((linha) => (
                          <tr key={linha.pedido_id} className="border-t border-slate-50 bg-slate-50/70">
                            <td className="py-2 pr-3 pl-7" colSpan={6}>
                              <p className="font-semibold text-slate-800">
                                {linha.titulo}
                                <span className="ml-2 font-medium text-slate-500">
                                  {linha.tipo_rotulo || linha.tipo}
                                  {linha.competencia ? ` · ${linha.competencia}` : ''}
                                  {linha.data_referencia ? ` · ${formatarDataBr(linha.data_referencia)}` : ''}
                                </span>
                              </p>
                              <p className="mt-1 text-xs text-slate-600">
                                Cheio {moneyCentavos(linha.valor_cheio_centavos)}
                                {' · '}
                                Escolhida {moneyCentavos(linha.valor_escolhida_centavos)}
                                {' · '}
                                vs maior {moneyCentavos(linha.economia_vs_maior_centavos)}
                                {' · '}
                                vs média {moneyCentavos(linha.economia_vs_media_centavos)}
                              </p>
                              {Array.isArray(linha.cotacoes) && linha.cotacoes.length > 0 && (
                                <ul className="mt-1 text-xs text-slate-500">
                                  {linha.cotacoes.map((cotacao, indice) => (
                                    <li key={`${linha.pedido_id}-${indice}`}>
                                      {cotacao.fornecedor_nome || 'Fornecedor'}
                                      {' · '}
                                      {moneyCentavos(cotacao.valor_centavos)}
                                      {cotacao.escolhida ? ' · escolhida' : ''}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
