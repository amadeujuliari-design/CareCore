import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight, Trash2, Truck } from 'lucide-react';

import { CampoTexto } from './UsuariosCampos';
import { EmptyState, PremiumBadge, PremiumButton, SectionCard } from './PremiumUI';
import {
  DIAS_SEMANA,
  MESES_PT,
  SEMANAS_JANELA,
  competenciaDeIso,
  detectarSemanaUtil,
  formatarDataBr,
  formatarFaixa,
  montarDiasCalendario,
  periodoSemanaUtilMes,
  recadoJanela,
  rotuloSemanaJanela,
  rotuloStatusJanela,
  ultimoDiaCompetencia,
  validarPeriodoJanela,
} from '../utils/comprasJanelaUtils';
import { comprasSugestaoJanela } from '../services/comprasService';

function badgeStatus(status) {
  if (status === 'aberta') return <PremiumBadge variant="success">Aberta agora</PremiumBadge>;
  if (status === 'futura') return <PremiumBadge variant="info">Ainda vai abrir</PremiumBadge>;
  if (status === 'encerrada') return <PremiumBadge variant="warning">Encerrada</PremiumBadge>;
  return <PremiumBadge variant="default">Não publicada</PremiumBadge>;
}

function classeDia(celula) {
  if (celula.vazio) return 'border-transparent bg-transparent';
  if (celula.liberado && celula.ehHoje) {
    return 'border-emerald-600 bg-emerald-600 text-white shadow-sm';
  }
  if (celula.liberado && celula.clicavel) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-400 hover:bg-emerald-100';
  }
  if (celula.liberado && celula.passado) {
    return 'border-slate-200 bg-slate-100 text-slate-400';
  }
  if (celula.ehHoje) {
    return 'border-violet-300 bg-white text-slate-700 ring-2 ring-violet-200';
  }
  return 'border-slate-100 bg-white text-slate-400';
}

export default function ComprasJanelaCalendario({
  janelas = [],
  hoje,
  pedidos = [],
  unidades = [],
  sede = false,
  salvando = false,
  onSalvarJanela,
  onPublicarAno,
  onLiberarUnidade,
  onExcluirJanela,
  onCriarRascunho,
  onAbrirPedido,
}) {
  const hojePartes = useMemo(() => {
    const [ano, mes] = String(hoje || '').split('-').map(Number);
    const agora = new Date();
    return {
      ano: ano || agora.getFullYear(),
      mes: mes || (agora.getMonth() + 1),
    };
  }, [hoje]);

  const [visao, setVisao] = useState(hojePartes);
  const [form, setForm] = useState({
    data_inicio: '',
    data_fim: '',
  });
  const [semanaEscolhida, setSemanaEscolhida] = useState(2);
  const [periodoPersonalizado, setPeriodoPersonalizado] = useState(false);
  const [erroForm, setErroForm] = useState('');
  const [liberacao, setLiberacao] = useState({ instituicao_id: '', motivo: '' });

  const competencia = `${visao.ano}-${String(visao.mes).padStart(2, '0')}`;
  const janelaMes = janelas.find((item) => item.competencia === competencia);
  const janelasAno = janelas.filter((item) => item.competencia?.startsWith(`${visao.ano}-`));

  useEffect(() => {
    const inicio = janelaMes?.data_inicio || '';
    const fim = janelaMes?.data_fim || '';
    setForm({ data_inicio: inicio, data_fim: fim });
    setErroForm('');
    if (inicio && fim) {
      const detectada = detectarSemanaUtil(competencia, inicio, fim);
      if (detectada) {
        setSemanaEscolhida(detectada);
        setPeriodoPersonalizado(false);
      } else {
        setPeriodoPersonalizado(true);
      }
    } else {
      setSemanaEscolhida(2);
      setPeriodoPersonalizado(false);
      try {
        const sugestao = periodoSemanaUtilMes(visao.ano, visao.mes, 2);
        setForm(sugestao);
      } catch {
        setForm({ data_inicio: '', data_fim: '' });
      }
    }
  }, [competencia, janelaMes?.id, janelaMes?.data_inicio, janelaMes?.data_fim, visao.ano, visao.mes]);

  const previewSemana = useMemo(() => {
    try {
      return periodoSemanaUtilMes(visao.ano, visao.mes, semanaEscolhida);
    } catch {
      return null;
    }
  }, [semanaEscolhida, visao.ano, visao.mes]);

  const celulas = useMemo(
    () => montarDiasCalendario(visao.ano, visao.mes, {
      hoje,
      diasLiberados: janelaMes?.dias_liberados || [],
    }),
    [hoje, janelaMes, visao.ano, visao.mes],
  );

  const rascunhosPorDia = useMemo(() => {
    const mapa = {};
    pedidos.forEach((pedido) => {
      if (pedido.tipo !== 'consumo' || !pedido.data_envio_prevista) return;
      const chave = String(pedido.data_envio_prevista).slice(0, 10);
      if (!mapa[chave]) mapa[chave] = [];
      mapa[chave].push(pedido);
    });
    return mapa;
  }, [pedidos]);

  const mudarMes = (delta) => {
    setVisao((atual) => {
      const data = new Date(atual.ano, atual.mes - 1 + delta, 1);
      return { ano: data.getFullYear(), mes: data.getMonth() + 1 };
    });
  };

  const clicarDia = async (celula) => {
    if (celula.vazio) return;
    const existentes = rascunhosPorDia[celula.iso] || [];
    const rascunho = existentes.find((item) => item.status === 'rascunho');
    if (rascunho) {
      onAbrirPedido?.(rascunho.id);
      return;
    }
    if (existentes[0]) {
      onAbrirPedido?.(existentes[0].id);
      return;
    }
    if (!celula.clicavel) return;
    await onCriarRascunho?.({
      data_envio_prevista: celula.iso,
      competencia: competenciaDeIso(celula.iso),
    });
  };

  return (
    <div className="space-y-4">
      <SectionCard
        title="Calendário de compras"
        subtitle={recadoJanela({ hoje, janela: janelaMes })}
        actions={badgeStatus(janelaMes?.status)}
      >
        <div className="px-5 pb-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => mudarMes(-1)}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
              aria-label="Mês anterior"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Competência</p>
              <h3 className="text-lg font-bold text-slate-900">
                {MESES_PT[visao.mes - 1]} {visao.ano}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => mudarMes(1)}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
              aria-label="Próximo mês"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="mb-3 flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-md bg-emerald-500" /> Liberado para envio
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-md bg-slate-200" /> Bloqueado
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-md ring-2 ring-violet-300" /> Hoje
            </span>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
            {DIAS_SEMANA.map((dia) => (
              <div key={dia} className="py-1">{dia}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {celulas.map((celula) => {
              const rascunhos = celula.iso ? (rascunhosPorDia[celula.iso] || []) : [];
              return (
                <button
                  key={celula.key}
                  type="button"
                  disabled={celula.vazio || (!celula.clicavel && !rascunhos.length)}
                  onClick={() => clicarDia(celula)}
                  className={`relative min-h-[3.25rem] rounded-xl border px-1 py-1.5 text-sm font-semibold transition ${classeDia(celula)} ${
                    celula.vazio ? 'cursor-default' : ''
                  }`}
                  title={
                    celula.clicavel
                      ? `Preparar rascunho para ${formatarDataBr(celula.iso)}`
                      : (celula.liberado ? 'Este dia já passou' : 'Dia bloqueado para envio')
                  }
                >
                  {celula.vazio ? '' : celula.dia}
                  {rascunhos.length > 0 && (
                    <span className={`absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${
                      celula.liberado && celula.ehHoje ? 'bg-white' : 'bg-violet-500'
                    }`} />
                  )}
                </button>
              );
            })}
          </div>

          {janelaMes && (
            <p className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900">
              Dias liberados: <strong>{formatarFaixa(janelaMes.data_inicio, janelaMes.data_fim)}</strong>
              {janelaMes.liberado_projeto ? ' · seu projeto tem liberação extra da Sede.' : ''}
            </p>
          )}
          {!janelaMes && (
            <div className="mt-4">
              <EmptyState
                title="Janela ainda não publicada"
                subtitle={sede
                  ? 'Informe o início e o fim abaixo, ou publique o calendário do ano.'
                  : 'Quando a Sede publicar a janela, os dias liberados aparecem em verde.'}
              />
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title={`Período de compras ${visao.ano}`}
        subtitle={sede
          ? 'Clique no mês para ver o calendário e, abaixo, editar ou apagar a janela.'
          : 'Visão do ano: um recado claro por mês.'}
      >
        <div className="space-y-2 px-5 pb-5">
          {Array.from({ length: 12 }, (_, index) => {
            const mes = index + 1;
            const comp = `${visao.ano}-${String(mes).padStart(2, '0')}`;
            const item = janelasAno.find((janela) => janela.competencia === comp);
            const ativo = mes === visao.mes;
            return (
              <button
                key={comp}
                type="button"
                onClick={() => setVisao({ ano: visao.ano, mes })}
                className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition ${
                  ativo ? 'border-slate-800 bg-slate-900 text-white' : 'border-slate-100 bg-white hover:bg-slate-50'
                }`}
              >
                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${
                  ativo ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'
                }`}
                >
                  {String(mes).padStart(2, '0')}
                </span>
                <span className="min-w-[7.5rem] font-semibold">{MESES_PT[index]}</span>
                <span className={`flex-1 text-sm ${ativo ? 'text-slate-200' : 'text-slate-600'}`}>
                  {item ? formatarFaixa(item.data_inicio, item.data_fim) : 'Sem janela publicada'}
                </span>
                {!ativo && badgeStatus(item?.status)}
                {ativo && (
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                    {rotuloStatusJanela(item?.status)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </SectionCard>

      {sede && (
        <SectionCard
          title={janelaMes ? `Editar janela · ${MESES_PT[visao.mes - 1]} ${visao.ano}` : `Publicar janela · ${MESES_PT[visao.mes - 1]} ${visao.ano}`}
          subtitle="Escolha a semana do mês (só dias úteis) ou personalize as datas. O fim não pode ser anterior ao início."
        >
          <div className="space-y-4 px-5 pt-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <label>
                <span className="mb-1 block text-xs font-semibold text-slate-600">Semana do mês (padrão)</span>
                <select
                  value={semanaEscolhida}
                  onChange={(event) => {
                    const valor = Number(event.target.value);
                    setSemanaEscolhida(valor);
                    setPeriodoPersonalizado(false);
                  }}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                >
                  {SEMANAS_JANELA.map((item) => (
                    <option key={item.valor} value={item.valor}>
                      {item.rotulo} — {item.faixa}, dias úteis
                    </option>
                  ))}
                </select>
              </label>
              <PremiumButton
                type="button"
                variant="secondary"
                disabled={salvando || !previewSemana}
                onClick={() => {
                  if (!previewSemana) return;
                  setForm(previewSemana);
                  setPeriodoPersonalizado(false);
                  setErroForm(validarPeriodoJanela(previewSemana.data_inicio, previewSemana.data_fim, competencia));
                }}
              >
                Usar esta semana no mês
              </PremiumButton>
            </div>
            {previewSemana && (
              <p className="text-sm text-slate-600">
                Prévia da {rotuloSemanaJanela(semanaEscolhida)}:{' '}
                <span className="font-semibold text-slate-800">
                  {formatarFaixa(previewSemana.data_inicio, previewSemana.data_fim)}
                </span>
              </p>
            )}
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-slate-300"
                checked={periodoPersonalizado}
                onChange={(event) => setPeriodoPersonalizado(event.target.checked)}
              />
              <span>
                Período personalizado
                {!periodoPersonalizado && form.data_inicio && form.data_fim && !detectarSemanaUtil(competencia, form.data_inicio, form.data_fim) && (
                  <span className="mt-0.5 block text-xs text-amber-700">
                    As datas abaixo foram ajustadas manualmente — você pode editar e salvar.
                  </span>
                )}
              </span>
            </label>
          </div>
          <form
            className="grid gap-3 px-5 pb-4 md:grid-cols-3"
            onSubmit={async (event) => {
              event.preventDefault();
              const mensagem = validarPeriodoJanela(form.data_inicio, form.data_fim, competencia);
              if (mensagem) {
                setErroForm(mensagem);
                return;
              }
              setErroForm('');
              await onSalvarJanela?.({
                competencia,
                data_inicio: form.data_inicio,
                data_fim: form.data_fim,
              });
            }}
          >
            <CampoTexto
              label="Início"
              type="date"
              value={form.data_inicio}
              min={`${competencia}-01`}
              max={form.data_fim || ultimoDiaCompetencia(competencia)}
              onChange={(valor) => {
                setForm((atual) => ({ ...atual, data_inicio: valor }));
                setPeriodoPersonalizado(true);
                setErroForm(validarPeriodoJanela(valor, form.data_fim, competencia));
              }}
              required
            />
            <CampoTexto
              label="Fim"
              type="date"
              value={form.data_fim}
              min={form.data_inicio || `${competencia}-01`}
              max={ultimoDiaCompetencia(competencia)}
              onChange={(valor) => {
                setForm((atual) => ({ ...atual, data_fim: valor }));
                setPeriodoPersonalizado(true);
                setErroForm(validarPeriodoJanela(form.data_inicio, valor, competencia));
              }}
              required
            />
            <div className="flex items-end gap-2">
              <PremiumButton type="submit" disabled={salvando || Boolean(validarPeriodoJanela(form.data_inicio, form.data_fim, competencia))} className="flex-1">
                {janelaMes ? 'Salvar alteração' : 'Publicar janela'}
              </PremiumButton>
            </div>
          </form>
          {erroForm && (
            <p className="px-5 pb-3 text-xs font-semibold text-red-600">{erroForm}</p>
          )}
          <div className="flex flex-wrap gap-2 px-5 pb-5">
            <PremiumButton
              type="button"
              variant="secondary"
              disabled={salvando}
              onClick={async () => {
                const sugestao = await comprasSugestaoJanela(competencia);
                setForm({
                  data_inicio: sugestao.data_inicio,
                  data_fim: sugestao.data_fim,
                });
                setPeriodoPersonalizado(true);
                setErroForm('');
              }}
            >
              Preencher cartaz AEB 2026
            </PremiumButton>
            <PremiumButton
              type="button"
              variant="secondary"
              disabled={salvando}
              onClick={() => onPublicarAno?.(visao.ano, semanaEscolhida)}
            >
              <span className="inline-flex items-center gap-1.5">
                <CalendarRange size={16} />
                Publicar {rotuloSemanaJanela(semanaEscolhida).split(' (')[0] || 'semana'} · meses faltantes de {visao.ano}
              </span>
            </PremiumButton>
            {janelaMes && (
              <PremiumButton
                type="button"
                variant="danger"
                disabled={salvando}
                onClick={async () => {
                  const ok = window.confirm(
                    `Apagar a janela de ${MESES_PT[visao.mes - 1]} ${visao.ano}? Os projetos deixam de ver esses dias como liberados.`,
                  );
                  if (!ok) return;
                  await onExcluirJanela?.(janelaMes.id);
                }}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Trash2 size={16} />
                  Apagar esta janela
                </span>
              </PremiumButton>
            )}
          </div>

          {janelaMes && (
            <form
              className="grid gap-3 border-t border-slate-100 px-5 py-4 md:grid-cols-3"
              onSubmit={async (event) => {
                event.preventDefault();
                await onLiberarUnidade?.(janelaMes.id, liberacao);
                setLiberacao({ instituicao_id: '', motivo: '' });
              }}
            >
              <div className="md:col-span-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Exceção</p>
                <p className="mt-1 text-sm text-slate-600">
                  Reabre um projeto fora da janela, com motivo para auditoria.
                </p>
              </div>
              <label>
                <span className="mb-1 block text-xs font-semibold text-slate-600">Projeto</span>
                <select
                  value={liberacao.instituicao_id}
                  onChange={(e) => setLiberacao((atual) => ({ ...atual, instituicao_id: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                  required
                >
                  <option value="">Selecione…</option>
                  {unidades.map((unidade) => (
                    <option key={unidade.id} value={unidade.id}>{unidade.nome}</option>
                  ))}
                </select>
              </label>
              <CampoTexto
                label="Motivo"
                value={liberacao.motivo}
                onChange={(valor) => setLiberacao((atual) => ({ ...atual, motivo: valor }))}
              />
              <div className="flex items-end">
                <PremiumButton type="submit" variant="secondary" className="w-full">
                  <span className="inline-flex items-center gap-1.5">
                    <Truck size={16} />
                    Liberar fora da janela
                  </span>
                </PremiumButton>
              </div>
            </form>
          )}
        </SectionCard>
      )}
    </div>
  );
}
