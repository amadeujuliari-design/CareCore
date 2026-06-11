import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  CheckCircle2,
  FileBarChart,
  LayoutDashboard,
  Network,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import Sidebar from './Sidebar';
import { AppShell, MainShell, PageHeader, ScrollArea } from './components/PremiumUI';
import api from './services/api';
import { useAuth } from './context/AuthContext';

const secoes = [
  { id: 'visao', label: 'Visão Geral', icon: LayoutDashboard },
  { id: 'comparativos', label: 'Comparativos', icon: BarChart3 },
  { id: 'saude', label: 'Saúde Operacional', icon: CheckCircle2 },
  { id: 'relatorios', label: 'Relatórios Consolidados', icon: FileBarChart },
  { id: 'projetos', label: 'Projetos', icon: Network },
];

function numero(valor) {
  return Number(valor || 0).toLocaleString('pt-BR');
}

function percentual(valor) {
  return `${Number(valor || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

function dataLocalISO(data = new Date()) {
  const pad = (numero) => String(numero).padStart(2, '0');
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`;
}

function hojeISO() {
  return dataLocalISO();
}

function inicioAnoISO() {
  return `${new Date().getFullYear()}-01-01`;
}

function descreverPeriodo(dataInicio, dataFim) {
  if (dataInicio && dataFim) return `${dataInicio.split('-').reverse().join('/')} até ${dataFim.split('-').reverse().join('/')}`;
  if (dataInicio) return `A partir de ${dataInicio.split('-').reverse().join('/')}`;
  if (dataFim) return `Até ${dataFim.split('-').reverse().join('/')}`;
  return 'Todo o histórico';
}

function classificarSaude(projeto) {
  if (projeto.bloqueado) {
    return { label: 'Bloqueado', tone: 'rose', score: 25 };
  }

  const ocupacao = Number(projeto.ocupacao_percentual || 0);
  const pendentes = Number(projeto.ocorrencias_pendentes || 0);
  const altaCritica = Number(projeto.ocorrencias_alta_critica || 0);
  const divergencias = Number(projeto.sisa_divergencias_pendentes || 0);

  let score = 100;
  if (ocupacao >= 95) score -= 18;
  if (ocupacao < 40) score -= 8;
  score -= Math.min(28, altaCritica * 5);
  score -= Math.min(22, pendentes * 1.2);
  score -= Math.min(18, divergencias * 2);

  if (score < 45) return { label: 'Crítico', tone: 'rose', score: Math.max(0, Math.round(score)) };
  if (score < 70) return { label: 'Atenção', tone: 'amber', score: Math.round(score) };
  return { label: 'Estável', tone: 'emerald', score: Math.round(score) };
}

function ToneBadge({ tone = 'slate', children }) {
  const classes = {
    slate: 'bg-slate-50 text-slate-700 border-slate-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    violet: 'bg-violet-50 text-violet-700 border-violet-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
  };

  return (
    <span className={`inline-flex max-w-full items-center whitespace-normal break-words rounded-full border px-2.5 py-1 text-center text-xs font-semibold ${classes[tone] || classes.slate}`}>
      {children}
    </span>
  );
}

function MetricCard({ title, value, helper, tone = 'blue' }) {
  return (
    <article className="min-w-0 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="mt-3 flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between">
        <strong className="min-w-0 break-words text-3xl font-bold tracking-tight text-slate-900">{value}</strong>
        {helper ? <ToneBadge tone={tone}>{helper}</ToneBadge> : null}
      </div>
    </article>
  );
}

function Barra({ label, value, tone = 'blue' }) {
  const cores = {
    blue: 'bg-blue-500',
    violet: 'bg-violet-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
  };

  return (
    <div>
      <div className="mb-1 flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <span className="min-w-0 break-words">{label}</span>
        <span className="shrink-0">{percentual(value)}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${cores[tone] || cores.blue}`} style={{ width: `${Math.min(100, Number(value || 0))}%` }} />
      </div>
    </div>
  );
}

function BarraQuantidade({ label, value, maxValue, tone = 'emerald', helper }) {
  const cores = {
    blue: 'bg-blue-500',
    violet: 'bg-violet-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
  };
  const largura = maxValue > 0 ? Math.max(4, (Number(value || 0) / maxValue) * 100) : 0;

  return (
    <div>
      <div className="mb-1 flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <span className="min-w-0 break-words">{label}</span>
        <span className="shrink-0 break-words sm:text-right">{numero(value)}{helper ? ` · ${helper}` : ''}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${cores[tone] || cores.emerald}`} style={{ width: `${largura}%` }} />
      </div>
    </div>
  );
}

function MenuGestaoGlobal({ secaoAtiva, onChange }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-3xl border border-slate-100 bg-white p-3 shadow-sm">
      <div className="mb-3 flex flex-col gap-1 px-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Navegação gerencial
        </p>
        <p className="text-xs text-slate-400">
          Use as abas para alternar os painéis da organização.
        </p>
      </div>

      <nav className="flex max-w-full gap-2 overflow-x-auto pb-1">
        {secoes.map(({ id, label, icon: Icon }) => {
          const ativo = secaoAtiva === id;

          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`flex min-w-max items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                ativo ? 'bg-violet-50 text-violet-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${ativo ? 'bg-white text-violet-700 shadow-sm' : 'bg-slate-50 text-slate-500'}`}>
                <Icon size={16} />
              </span>
              {label}
            </button>
          );
        })}
      </nav>
    </section>
  );
}

function FiltroPeriodo({ dataInicio, dataFim, onChangeInicio, onChangeFim, onLimpar }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">
            Período do indicador
          </p>
          <h2 className="mt-1 text-base font-bold text-slate-900">
            Saídas qualificadas: {descreverPeriodo(dataInicio, dataFim)}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Use este recorte para comparar projetos e acompanhar conclusões positivas do programa.
          </p>
        </div>

        <div className="grid min-w-0 gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Início</span>
            <input
              type="date"
              value={dataInicio}
              onChange={(event) => onChangeInicio(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Fim</span>
            <input
              type="date"
              value={dataFim}
              onChange={(event) => onChangeFim(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
            />
          </label>
          <button
            type="button"
            onClick={onLimpar}
            className="self-end rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-white"
          >
            Todo histórico
          </button>
        </div>
      </div>
    </section>
  );
}

function VisaoGeral({ resumo, projetosComSaude }) {
  const totais = resumo?.totais || {};
  const projetosCriticos = projetosComSaude.filter(({ saude }) => saude.tone === 'rose').length;

  return (
    <div className="grid min-w-0 gap-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Projetos da organização" value={numero(totais.projetos)} helper="ativos e vinculados" tone="violet" />
        <MetricCard title="Conviventes ativos" value={numero(totais.conviventes_ativos)} helper={`${numero(totais.conviventes_total)} no total`} />
        <MetricCard title="Ocupação consolidada" value={percentual(totais.ocupacao_percentual)} helper={`${numero(totais.leitos_ocupados)}/${numero(totais.leitos_total)} leitos`} tone="emerald" />
        <MetricCard title="Saídas qualificadas" value={numero(totais.saidas_qualificadas_periodo)} helper={`${percentual(totais.taxa_sucesso_periodo)} de sucesso`} tone="emerald" />
      </div>

      <section className="min-w-0 overflow-hidden rounded-3xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-600">Painel executivo</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Resumo consolidado da organização</h2>
            <p className="mt-1 text-sm text-slate-500">
              Dados reais agregados dos projetos vinculados à sua organização.
            </p>
          </div>
          <ToneBadge tone="violet">{resumo?.organizacao_nome || 'Organização'}</ToneBadge>
        </div>

        <div className="mt-5 grid min-w-0 gap-4 lg:grid-cols-3">
          {[
            ['Rotina registrada', numero(totais.rotina_registros), 'Registros válidos em todos os projetos'],
            ['Ocorrências pendentes', numero(totais.ocorrencias_pendentes), 'Chamados ainda não resolvidos'],
            ['SISA consolidado', numero(totais.sisa_lancamentos), `${numero(totais.sisa_divergencias_pendentes)} divergência(s) pendente(s)`],
            ['Pendências críticas', numero(totais.ocorrencias_alta_critica), `${projetosCriticos} projeto(s) crítico(s)`],
            ['Histórico qualificado', numero(totais.saidas_qualificadas), 'Total acumulado de saídas qualificadas'],
          ].map(([titulo, valor, texto]) => (
            <article key={titulo} className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
              <strong className="mt-2 block text-2xl font-bold text-slate-900">{valor}</strong>
              <p className="mt-1 text-sm text-slate-500">{texto}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function Comparativos({ projetosComSaude }) {
  const rankingSaidas = [...projetosComSaude].sort(
    (a, b) => (b.projeto.saidas_qualificadas_periodo || 0) - (a.projeto.saidas_qualificadas_periodo || 0),
  );
  const maxSaidas = Math.max(1, ...rankingSaidas.map(({ projeto }) => projeto.saidas_qualificadas_periodo || 0));

  return (
    <div className="grid min-w-0 gap-5">
      <section className="min-w-0 overflow-hidden rounded-3xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-5 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">Saídas qualificadas</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Ranking por projeto no período</h2>
            <p className="mt-1 text-sm text-slate-500">
              Compara conclusões positivas e taxa de sucesso sobre todas as inativações do período.
            </p>
          </div>
          <ToneBadge tone="emerald">Indicador gerencial</ToneBadge>
        </div>

        <div className="grid min-w-0 gap-4">
          {rankingSaidas.map(({ projeto }) => (
            <article key={projeto.id} className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <BarraQuantidade
                label={projeto.nome}
                value={projeto.saidas_qualificadas_periodo}
                maxValue={maxSaidas}
                helper={`${percentual(projeto.taxa_sucesso_periodo)} sucesso`}
              />
              <p className="mt-2 text-xs text-slate-500">
                {numero(projeto.inativacoes_periodo)} inativação(ões) no período · {numero(projeto.saidas_qualificadas)} saída(s) qualificada(s) no histórico.
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="min-w-0 overflow-hidden rounded-3xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-5 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">Comparativos</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Projetos lado a lado</h2>
            <p className="mt-1 text-sm text-slate-500">
              Compare ocupação, rotina, SISA e sucesso de saídas qualificadas.
            </p>
          </div>
          <BarChart3 className="text-blue-400" size={26} />
        </div>

        <div className="grid min-w-0 gap-4 xl:grid-cols-2">
          {projetosComSaude.map(({ projeto, saude }) => {
            const rotinaBase = Math.max(1, projeto.conviventes_ativos);
            const regularidade = Math.min(100, (projeto.rotina_registros / rotinaBase) * 4);
            const sisaBase = Math.max(1, projeto.conviventes_total);
            const coberturaSisa = Math.min(100, (projeto.sisa_lancamentos / sisaBase) * 100);

            return (
              <article key={projeto.id} className="min-w-0 rounded-3xl border border-slate-100 bg-slate-50/70 p-4 sm:p-5">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-slate-900">{projeto.nome}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {numero(projeto.conviventes_ativos)} conviventes ativos · {numero(projeto.saidas_qualificadas_periodo)} saída(s) qualificada(s) no período
                    </p>
                  </div>
                  <ToneBadge tone={saude.tone}>{saude.label}</ToneBadge>
                </div>

                <div className="mt-5 space-y-4">
                  <Barra label="Ocupação" value={projeto.ocupacao_percentual} tone="blue" />
                  <Barra label="Regularidade da rotina" value={regularidade} tone="violet" />
                  <Barra label="Cobertura SISA" value={coberturaSisa} tone="emerald" />
                  <Barra label="Taxa de sucesso qualificado" value={projeto.taxa_sucesso_periodo} tone="emerald" />
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function SaudeOperacional({ projetosComSaude }) {
  const alertas = projetosComSaude.flatMap(({ projeto, saude }) => {
    const itens = [];

    if (saude.tone === 'rose') itens.push([projeto.nome, 'Saúde operacional crítica. Priorizar revisão de pendências e ocupação.', 'Crítico']);
    if (projeto.ocorrencias_alta_critica > 0) itens.push([projeto.nome, `${numero(projeto.ocorrencias_alta_critica)} ocorrência(s) alta/crítica pendente(s).`, 'Atenção']);
    if (projeto.sisa_divergencias_pendentes > 0) itens.push([projeto.nome, `${numero(projeto.sisa_divergencias_pendentes)} divergência(s) SISA pendente(s).`, 'SISA']);
    if (projeto.ocupacao_percentual >= 95) itens.push([projeto.nome, 'Ocupação próxima do limite operacional.', 'Ocupação']);

    return itens;
  });

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[1fr_0.9fr]">
      <section className="min-w-0 overflow-hidden rounded-3xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">Saúde operacional</p>
        <h2 className="mt-1 text-xl font-bold text-slate-900">Índice por projeto</h2>

        <div className="mt-5 space-y-4">
          {projetosComSaude.map(({ projeto, saude }) => (
            <article key={projeto.id} className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <div className="mb-3 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900">{projeto.nome}</h3>
                  <p className="text-xs text-slate-500">
                    {numero(projeto.ocorrencias_pendentes)} ocorrência(s) pendente(s) · {numero(projeto.avisos_ativos)} aviso(s) ativo(s)
                  </p>
                </div>
                <ToneBadge tone={saude.tone}>{saude.label}</ToneBadge>
              </div>
              <Barra label="Índice operacional" value={saude.score} tone={saude.tone === 'rose' ? 'rose' : saude.tone === 'amber' ? 'amber' : 'emerald'} />
            </article>
          ))}
        </div>
      </section>

      <section className="min-w-0 overflow-hidden rounded-3xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-600">Alertas gerenciais</p>
        <h2 className="mt-1 text-xl font-bold text-slate-900">Pontos que exigem atenção</h2>

        <div className="mt-5 space-y-3">
          {alertas.length === 0 ? (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
              Nenhum alerta relevante encontrado nos projetos da organização.
            </div>
          ) : (
            alertas.map(([projeto, texto, nivel], index) => (
              <div key={`${projeto}-${index}`} className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-violet-400" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{projeto}</p>
                    <p className="mt-1 text-sm text-slate-600">{texto}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-400">{nivel}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function RelatoriosConsolidados({ resumo }) {
  const totais = resumo?.totais || {};

  return (
    <section className="min-w-0 overflow-hidden rounded-3xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-600">Relatórios consolidados</p>
      <h2 className="mt-1 text-xl font-bold text-slate-900">Base executiva da organização</h2>
      <p className="mt-1 text-sm text-slate-500">
        Esta seção organiza os números consolidados para acompanhamento gerencial. Exportações podem ser conectadas aqui depois.
      </p>

      <div className="mt-5 grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          ['Operação', `${numero(totais.conviventes_ativos)} conviventes ativos`, `${percentual(totais.ocupacao_percentual)} de ocupação consolidada`],
          ['Saídas qualificadas', `${numero(totais.saidas_qualificadas_periodo)} no período`, `${percentual(totais.taxa_sucesso_periodo)} de sucesso nas inativações`],
          ['Histórico qualificado', `${numero(totais.saidas_qualificadas)} acumulada(s)`, 'Acolhidos que concluíram o processo/programa com retorno social adequado'],
          ['Rotina', `${numero(totais.rotina_registros)} registros`, 'Registros válidos dos projetos da organização'],
          ['Comunicação', `${numero(totais.ocorrencias_total)} ocorrências`, `${numero(totais.ocorrencias_pendentes)} pendente(s)`],
          ['SISA', `${numero(totais.sisa_lancamentos)} lançamentos`, `${numero(totais.sisa_divergencias_pendentes)} divergência(s)`],
          ['Equipe', `${numero(totais.usuarios_ativos)} usuários ativos`, 'Somatório da equipe dos projetos'],
          ['Projetos', `${numero(totais.projetos)} projeto(s)`, 'Unidades vinculadas à organização'],
        ].map(([titulo, valor, detalhe]) => (
          <article key={titulo} className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
            <strong className="mt-2 block text-lg font-bold text-slate-900">{valor}</strong>
            <p className="mt-1 text-sm text-slate-500">{detalhe}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProjetosGestao({ projetosComSaude, projetoAtualId, selecionandoProjetoId, onSelecionarProjeto }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-3xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">Projetos</p>
      <h2 className="mt-1 text-xl font-bold text-slate-900">Projetos da organização</h2>
      <p className="mt-1 text-sm text-slate-500">
        Consulte indicadores e alterne o projeto operacional ativo quando precisar atuar em uma unidade.
      </p>

      <div className="mt-5 grid min-w-0 gap-3">
        {projetosComSaude.map(({ projeto, saude }) => (
          <article key={projeto.id} className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h3 className="min-w-0 break-words font-bold text-slate-900">{projeto.nome}</h3>
                  {projetoAtualId === projeto.id ? <ToneBadge tone="violet">Projeto ativo</ToneBadge> : null}
                  <ToneBadge tone={saude.tone}>{saude.label}</ToneBadge>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {numero(projeto.conviventes_ativos)} conviventes · {numero(projeto.saidas_qualificadas_periodo)} saída(s) qualificada(s) no período · {percentual(projeto.taxa_sucesso_periodo)} sucesso
                </p>
              </div>

              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <ToneBadge tone="blue">{percentual(projeto.ocupacao_percentual)} ocupação</ToneBadge>
                <button
                  type="button"
                  onClick={() => onSelecionarProjeto(projeto.id)}
                  disabled={projetoAtualId === projeto.id || selecionandoProjetoId === projeto.id}
                  className="w-full rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {projetoAtualId === projeto.id
                    ? 'Em operação'
                    : selecionandoProjetoId === projeto.id
                      ? 'Entrando...'
                      : 'Entrar no projeto'}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function GestaoGlobal() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [secaoAtiva, setSecaoAtiva] = useState('visao');
  const [dataInicio, setDataInicio] = useState(inicioAnoISO());
  const [dataFim, setDataFim] = useState(hojeISO());
  const [resumo, setResumo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [selecionandoProjetoId, setSelecionandoProjetoId] = useState('');

  const carregarResumo = async () => {
    setLoading(true);
    setErro('');

    try {
      const response = await api.get('/api/organizacao/gestao-global/resumo', {
        params: {
          data_inicio: dataInicio || undefined,
          data_fim: dataFim || undefined,
        },
      });
      setResumo(response.data);
    } catch (error) {
      setErro(error.response?.data?.detail || 'Não foi possível carregar a gestão global.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarResumo();
  }, [dataInicio, dataFim]);

  const limparPeriodo = () => {
    setDataInicio('');
    setDataFim('');
  };

  const projetosComSaude = useMemo(() => (
    (resumo?.projetos || []).map((projeto) => ({
      projeto,
      saude: classificarSaude(projeto),
    }))
  ), [resumo]);

  const selecionarProjeto = async (projetoId) => {
    setErro('');
    setSelecionandoProjetoId(projetoId);

    try {
      const response = await api.post(`/api/organizacao/projetos/${projetoId}/selecionar`);
      const token = response.data?.access_token;
      const usuario = response.data?.usuario;

      if (!token || !usuario) {
        throw new Error('Resposta inválida ao selecionar projeto.');
      }

      login({ token, usuario });
      navigate('/dashboard');
    } catch (error) {
      setErro(error.response?.data?.detail || 'Não foi possível entrar neste projeto.');
    } finally {
      setSelecionandoProjetoId('');
    }
  };

  const renderSecao = () => {
    if (loading) {
      return (
        <div className="rounded-3xl border border-slate-100 bg-white p-8 text-sm font-semibold text-slate-500 shadow-sm">
          Carregando gestão global...
        </div>
      );
    }

    if (erro) {
      return (
        <div className="rounded-3xl border border-rose-100 bg-rose-50 p-6 text-sm font-semibold text-rose-700">
          {erro}
        </div>
      );
    }

    if (!resumo) {
      return null;
    }

    if (secaoAtiva === 'comparativos') return <Comparativos projetosComSaude={projetosComSaude} />;
    if (secaoAtiva === 'saude') return <SaudeOperacional projetosComSaude={projetosComSaude} />;
    if (secaoAtiva === 'relatorios') return <RelatoriosConsolidados resumo={resumo} />;
    if (secaoAtiva === 'projetos') {
      return (
        <ProjetosGestao
          projetosComSaude={projetosComSaude}
          projetoAtualId={resumo.projeto_atual_id}
          selecionandoProjetoId={selecionandoProjetoId}
          onSelecionarProjeto={selecionarProjeto}
        />
      );
    }

    return <VisaoGeral resumo={resumo} projetosComSaude={projetosComSaude} />;
  };

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          eyebrow="Gestão Global"
          title="Painel Gerencial da Organização"
          subtitle="Acompanhe projetos, indicadores consolidados e pontos de atenção da organização."
          icon={<ShieldCheck size={19} />}
          actions={(
            <button
              type="button"
              onClick={carregarResumo}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <RefreshCw size={14} />
              Atualizar
            </button>
          )}
        />

        <ScrollArea className="pb-24">
          <div className="mx-auto grid w-full min-w-0 max-w-7xl gap-5 overflow-hidden">
            <MenuGestaoGlobal secaoAtiva={secaoAtiva} onChange={setSecaoAtiva} />

            <FiltroPeriodo
              dataInicio={dataInicio}
              dataFim={dataFim}
              onChangeInicio={setDataInicio}
              onChangeFim={setDataFim}
              onLimpar={limparPeriodo}
            />

            {renderSecao()}
          </div>
        </ScrollArea>
      </MainShell>
    </AppShell>
  );
}
