// =====================================================================
// ARQUIVO: src/Dashboard.jsx
// Dashboard Premium CARECORE+ v2 — visual leve, gráfico único e avisos
// =====================================================================
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Sidebar from "./Sidebar";
import UserAvatar from "./components/UserAvatar";
import ProjetoAtualBadge from "./components/ProjetoAtualBadge";
import { listarMeusAvisos, obterResumoAvisos, marcarAvisoComoLido } from "./services/avisosService";
import { API_ROOT } from "./config/apiBase";
import { criarHeadersAutenticados } from "./utils/requestIdUtils";

function dataLocalISO(data = new Date()) {
  const pad = (numero) => String(numero).padStart(2, "0");
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`;
}

function diasAtrasISO(dias) {
  const data = new Date();
  data.setDate(data.getDate() - dias);
  return dataLocalISO(data);
}

function hojeISO() {
  return dataLocalISO();
}

function formatarData(data) {
  if (!data) return "-";
  try {
    return new Date(data).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "-";
  }
}

function prioridadeOcorrencia(ocorrencia) {
  if (ocorrencia?.prioridade) {
    const valor = String(ocorrencia.prioridade).trim().toLowerCase();
    if (["critica", "crítica", "critico", "crítico"].includes(valor)) return "Crítica";
    if (["alta", "alto"].includes(valor)) return "Alta";
    if (["media", "média", "medio", "médio"].includes(valor)) return "Média";
    if (["baixa", "baixo"].includes(valor)) return "Baixa";
  }

  if (ocorrencia?.requer_acao_tecnica) return "Média";
  return "Baixa";
}

function pesoPrioridade(prioridade) {
  return { "Baixa": 1, "Média": 2, "Alta": 3, "Crítica": 4 }[prioridadeOcorrencia({ prioridade })] || 2;
}

function BadgePrioridade({ prioridade }) {
  const classes = {
    Crítica: "bg-red-50 text-red-700 border-red-200",
    Alta: "bg-orange-50 text-orange-700 border-orange-200",
    Média: "bg-amber-50 text-amber-700 border-amber-200",
    Baixa: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Crítico: "bg-red-50 text-red-600 border-red-100",
    Médio: "bg-amber-50 text-amber-600 border-amber-100",
    Normal: "bg-emerald-50 text-emerald-600 border-emerald-100",
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-bold ${classes[prioridade] || classes.Normal}`}>
      {prioridade}
    </span>
  );
}

function gerarSeriePorRange(series, inicioISO, fimISO) {
  if (!series) return [];

  const inicio = new Date(`${inicioISO}T00:00:00`);
  const fim = new Date(`${fimISO}T00:00:00`);
  const diffDias = Math.max(1, Math.round((fim - inicio) / (1000 * 60 * 60 * 24)) + 1);

  if (diffDias <= 31) {
    return (series.diario_7_dias || []).filter((item) => item.chave >= inicioISO && item.chave <= fimISO);
  }

  if (diffDias <= 120) {
    return series.semanal_6_semanas || [];
  }

  return series.mensal_6_meses || [];
}

function LineChartRange({ dados = [] }) {
  const largura = 620;
  const altura = 166;
  const paddingX = 24;
  const paddingY = 22;

  const maxAtendimentos = Math.max(1, ...dados.map((item) => item.atendimentos || 0));
  const maxNovos = Math.max(1, ...dados.map((item) => item.novos_conviventes || 0));

  function pontos(campo, maximo) {
    if (!dados.length) return "";
    return dados.map((item, index) => {
      const x = paddingX + (index * (largura - paddingX * 2)) / Math.max(1, dados.length - 1);
      const valor = item[campo] || 0;
      const y = altura - paddingY - (valor * (altura - paddingY * 2)) / maximo;
      return `${x},${y}`;
    }).join(" ");
  }

  return (
    <div className="carecore-dashboard-chart-wrap">
      <svg viewBox={`0 0 ${largura} ${altura}`} className="h-[172px] w-full">
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1={paddingX}
            x2={largura - paddingX}
            y1={paddingY + ratio * (altura - paddingY * 2)}
            y2={paddingY + ratio * (altura - paddingY * 2)}
            stroke="#e9eef7"
            strokeWidth="1"
          />
        ))}

        <polyline fill="none" stroke="#2563eb" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" points={pontos("atendimentos", maxAtendimentos)} />
        <polyline fill="none" stroke="#22c55e" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" points={pontos("novos_conviventes", maxNovos)} />

        {dados.map((item, index) => {
          const x = paddingX + (index * (largura - paddingX * 2)) / Math.max(1, dados.length - 1);
          return (
            <text key={item.chave || index} x={x} y={altura - 2} textAnchor="middle" className="fill-slate-500 text-[10px] font-semibold">
              {item.rotulo || item.chave}
            </text>
          );
        })}
      </svg>

      <div className="mt-1 flex items-center gap-5 text-xs font-semibold text-slate-500">
        <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-blue-600" />Atendimentos</span>
        <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Novos conviventes</span>
      </div>
    </div>
  );
}

function formatarDataHora(data) {
  if (!data) return "Agora";
  try {
    return new Date(data).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Agora";
  }
}

function normalizarPrioridadeAviso(prioridade) {
  const valor = String(prioridade || "normal").toLowerCase();

  if (["critico", "crítico", "alta", "urgente"].includes(valor)) return "Alta";
  if (["medio", "médio", "media", "média", "atencao", "atenção"].includes(valor)) return "Média";
  return "Baixa";
}

function formatarSubtituloAlertas({ alertasComunicacao = 0, ocorrenciasPendentes = 0, resumoPrioridades = {} }) {
  const partes = [];
  if (alertasComunicacao > 0) {
    partes.push(`${alertasComunicacao} aviso${alertasComunicacao === 1 ? "" : "s"}`);
  }
  if (ocorrenciasPendentes > 0) {
    partes.push(`${ocorrenciasPendentes} ocorrência${ocorrenciasPendentes === 1 ? "" : "s"} em aberto`);
  }
  if (!partes.length) return "Nenhum alerta no momento";

  const criticas = resumoPrioridades?.Crítica?.pendentes || 0;
  const altas = resumoPrioridades?.Alta?.pendentes || 0;
  const medias = resumoPrioridades?.Média?.pendentes || 0;
  const baixas = resumoPrioridades?.Baixa?.pendentes || 0;
  const detalhePrioridades = [
    criticas ? `${criticas} crítica${criticas === 1 ? "" : "s"}` : "",
    altas ? `${altas} alta${altas === 1 ? "" : "s"}` : "",
    medias ? `${medias} média${medias === 1 ? "" : "s"}` : "",
    baixas ? `${baixas} baixa${baixas === 1 ? "" : "s"}` : "",
  ].filter(Boolean).join(" · ");

  return detalhePrioridades ? `${partes.join(" + ")} (${detalhePrioridades})` : partes.join(" + ");
}

function ResumoPrioridadesPendentes({ resumoPrioridades = {} }) {
  const itens = [
    { chave: "Crítica", rotulo: "Crítica", classes: "border-red-100 bg-red-50 text-red-700" },
    { chave: "Alta", rotulo: "Alta", classes: "border-orange-100 bg-orange-50 text-orange-700" },
    { chave: "Média", rotulo: "Média", classes: "border-amber-100 bg-amber-50 text-amber-700" },
    { chave: "Baixa", rotulo: "Baixa", classes: "border-emerald-100 bg-emerald-50 text-emerald-700" },
  ];

  return (
    <div className="carecore-dashboard-priority-strip">
      {itens.map((item) => {
        const pendentes = resumoPrioridades?.[item.chave]?.pendentes || 0;
        return (
          <div key={item.chave} className={`carecore-dashboard-priority-chip ${item.classes}`}>
            <span className="carecore-dashboard-priority-chip-label">{item.rotulo}</span>
            <strong className="carecore-dashboard-priority-chip-value">{pendentes}</strong>
            <span className="carecore-dashboard-priority-chip-hint">em aberto</span>
          </div>
        );
      })}
    </div>
  );
}

function AvisosImportantes({ avisos, carregando, onAbrirAviso, onGerenciar }) {
  return (
    <article className="carecore-dashboard-card carecore-panel-scroll">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="carecore-dashboard-card-title">Avisos Importantes</h2>
          <p className="carecore-dashboard-card-subtitle">Comunicação interna visível conforme o usuário logado.</p>
        </div>
        <span className="rounded-2xl bg-purple-50 px-3 py-2 text-xs font-bold text-purple-700">
          {avisos.length} ativo{avisos.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="carecore-dashboard-panel-scroll-comfort carecore-avisos-scroll space-y-2 pr-1">
        {carregando ? (
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-8 text-center text-sm font-semibold text-slate-400">
            Carregando avisos...
          </div>
        ) : avisos.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-8 text-center">
            <p className="text-sm font-semibold text-slate-500">Nenhum aviso importante no momento.</p>
            <p className="mt-1 text-xs text-slate-400">Quando houver mensagens internas para você, elas aparecerão aqui.</p>
          </div>
        ) : (
          avisos.map((aviso) => {
            const prioridade = normalizarPrioridadeAviso(aviso.prioridade);
            const avisoPrivado = aviso.destino_tipo === "usuarios" && !aviso.pode_exibir_titulo;

            return (
              <button
                type="button"
                key={aviso.id}
                onClick={() => onAbrirAviso(aviso)}
                className={`w-full rounded-2xl border px-3 py-3 text-left transition hover:bg-slate-50 ${
                  aviso.lido ? "border-slate-100 bg-white" : "border-purple-100 bg-purple-50/40"
                }`}
                title="Clique para ler a mensagem completa"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <UserAvatar
                      nome={aviso.remetente_nome || "Sistema"}
                      avatarUrl={aviso.remetente_avatar_url}
                      size="sm"
                    />

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {avisoPrivado ? `${aviso.remetente_nome || "Usuário"} enviou uma mensagem` : aviso.titulo}
                      </p>
                      <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                        Remetente: {aviso.remetente_nome || "Sistema"}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {!aviso.lido && <span className="h-2.5 w-2.5 rounded-full bg-purple-600" />}
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-500 border border-slate-100">
                      {aviso.classificacao || prioridade}
                    </span>
                  </div>
                </div>

                <p className="mt-2 text-xs leading-relaxed text-slate-500 line-clamp-2">
                  {avisoPrivado ? "Você tem uma mensagem interna direcionada a você." : aviso.mensagem_resumo}
                </p>

                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold text-slate-400">{formatarDataHora(aviso.criado_em)}</p>
                  <BadgePrioridade prioridade={prioridade} />
                </div>
              </button>
            );
          })
        )}
      </div>

      <button type="button" className="carecore-soft-button mt-3 w-full" onClick={onGerenciar}>
        Gerenciar avisos →
      </button>
    </article>
  );
}


function ModalAvisoDashboard({ aviso, onFechar, onGerenciar }) {
  if (!aviso) return null;

  const prioridade = normalizarPrioridadeAviso(aviso.prioridade);
  const avisoPrivado = aviso.destino_tipo === "usuarios" && !aviso.pode_exibir_titulo;
  const titulo = avisoPrivado ? "Mensagem interna direcionada" : aviso.titulo || "Aviso importante";
  const mensagem = aviso.mensagem || aviso.mensagem_resumo || "Sem conteúdo informado.";

  return (
    <div className="carecore-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="carecore-modal-panel w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-2xl">
        <div className="border-b border-slate-100 bg-gradient-to-r from-purple-50 to-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-purple-100 bg-purple-50 px-3 py-1 text-xs font-black text-purple-700">
                  {aviso.classificacao || "Informativo"}
                </span>
                <BadgePrioridade prioridade={prioridade} />
                {aviso.destino_tipo === "todos" ? (
                  <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                    Todos
                  </span>
                ) : (
                  <span className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
                    Direcionado
                  </span>
                )}
              </div>

              <h3 className="text-xl font-black leading-tight text-slate-950">{titulo}</h3>
              <p className="mt-2 text-sm font-semibold text-slate-500">
                Remetente: {aviso.remetente_nome || "Sistema"} • {formatarDataHora(aviso.criado_em)}
              </p>
            </div>

            <button
              type="button"
              onClick={onFechar}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-500 shadow-sm hover:bg-slate-50"
              aria-label="Fechar aviso"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-5">
          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{mensagem}</p>
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50 p-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onGerenciar}
            className="rounded-2xl border border-purple-100 bg-purple-50 px-4 py-3 text-sm font-black text-purple-700 hover:bg-purple-100"
          >
            Abrir Comunicação Interna
          </button>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 hover:bg-slate-50"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}


export default function Dashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("@CareCore:token");

  const [conviventes] = useState([]);
  const [quartos] = useState([]);
  const [ocorrencias] = useState([]);
  const [tecnicos] = useState([]);
  const [resumoDashboard, setResumoDashboard] = useState(null);
  const [series, setSeries] = useState(null);
  const [avisos, setAvisos] = useState([]);
  const [resumoAvisos, setResumoAvisos] = useState({ total_visiveis: 0, total_nao_lidos: 0, total_alertas_ativos: 0 });
  const [carregandoAvisos, setCarregandoAvisos] = useState(false);
  const [avisoAberto, setAvisoAberto] = useState(null);
  const [dataInicio, setDataInicio] = useState(diasAtrasISO(30));
  const [dataFim, setDataFim] = useState(hojeISO());
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!token) {
      navigate("/");
      return;
    }

    carregarDados();
  }, [token]);

  async function carregarDados() {
    try {
      setLoading(true);
      setErro("");
      const headers = criarHeadersAutenticados(token);

      setCarregandoAvisos(true);

      const [resDashboard, resAvisos, resResumoAvisos] = await Promise.all([
        axios.get(`${API_ROOT}/dashboard/resumo`, { headers }),
        listarMeusAvisos(token, { limite: 10 }).catch((error) => {
          console.warn("Avisos ainda não disponíveis no backend.", error);
          return { items: [], total: 0, has_more: false };
        }),
        obterResumoAvisos(token).catch((error) => {
          console.warn("Resumo de avisos ainda não disponível no backend.", error);
          return { total_visiveis: 0, total_nao_lidos: 0, total_alertas_ativos: 0 };
        }),
      ]);

      setResumoDashboard(resDashboard.data || null);
      setSeries(resDashboard.data?.series || null);
      setAvisos(Array.isArray(resAvisos?.items) ? resAvisos.items : (Array.isArray(resAvisos) ? resAvisos : []));
      setResumoAvisos(resResumoAvisos || { total_visiveis: 0, total_nao_lidos: 0, total_alertas_ativos: 0 });
    } catch (error) {
      console.error("Erro ao carregar dashboard", error);
      setErro("Não foi possível carregar os dados do dashboard.");
    } finally {
      setLoading(false);
      setCarregandoAvisos(false);
    }
  }

  const dados = useMemo(() => {
    if (resumoDashboard) {
      const alertasComunicacao = Number(
        resumoAvisos?.total_alertas_ativos ??
        resumoAvisos?.total_nao_lidos ??
        0
      );

      const ocorrenciasPendentes = Number(
        resumoDashboard.ocorrenciasPendentes ??
        resumoDashboard.alertasOcorrencias ??
        0
      );

      return {
        totalConviventes: resumoDashboard.totalConviventes || 0,
        ativos: resumoDashboard.ativos || 0,
        leitosOcupados: resumoDashboard.leitosOcupados || 0,
        totalLeitos: resumoDashboard.totalLeitos || 0,
        atendimentosMes: resumoDashboard.atendimentosMes || 0,
        atendimentosHoje: resumoDashboard.atendimentosHoje || 0,
        alertasComunicacao,
        ocorrenciasPendentes,
        alertasOcorrencias: ocorrenciasPendentes,
        alertasAtivos: alertasComunicacao + ocorrenciasPendentes,
        pendenciasTecnicas: resumoDashboard.pendenciasTecnicas || 0,
        ocorrenciasEmAlerta: resumoDashboard.ocorrenciasEmAlerta || [],
        pendenciasTecnicos: resumoDashboard.pendenciasTecnicos || [],
        resumoPrioridades: resumoDashboard.resumoPrioridades || {
          Baixa: { total: 0, pendentes: 0 },
          Média: { total: 0, pendentes: 0 },
          Alta: { total: 0, pendentes: 0 },
          Crítica: { total: 0, pendentes: 0 },
        },
      };
    }

    const ativos = conviventes.filter((c) => c.status === "Ativo");

    let totalLeitos = 0;
    let leitosOcupados = 0;

    quartos.forEach((quarto) => {
      const leitos = quarto.leitos || [];
      totalLeitos += leitos.length;
      leitosOcupados += leitos.filter((l) => l.status === "Ocupado").length;
    });

    const tecnicoPorId = {};
    tecnicos.forEach((t) => {
      tecnicoPorId[t.id] = t;
    });

    const pendentes = ocorrencias.filter((oc) => oc.status_resolucao !== "Resolvido");

    const ocorrenciasEmAlerta = pendentes
      .sort((a, b) => {
        const pesoA = pesoPrioridade(prioridadeOcorrencia(a));
        const pesoB = pesoPrioridade(prioridadeOcorrencia(b));
        if (pesoA !== pesoB) return pesoB - pesoA;
        return new Date(b.data_ocorrencia || 0) - new Date(a.data_ocorrencia || 0);
      })
      .slice(0, 10);

    const ocorrenciasPendentes = pendentes.length;

    const resumoPrioridades = {
      Baixa: { total: 0, pendentes: 0 },
      Média: { total: 0, pendentes: 0 },
      Alta: { total: 0, pendentes: 0 },
      Crítica: { total: 0, pendentes: 0 },
    };

    ocorrencias.forEach((oc) => {
      const prioridade = prioridadeOcorrencia(oc);
      if (!resumoPrioridades[prioridade]) resumoPrioridades[prioridade] = { total: 0, pendentes: 0 };
      resumoPrioridades[prioridade].total += 1;
      if (oc.status_resolucao !== "Resolvido") resumoPrioridades[prioridade].pendentes += 1;
    });

    const agrupado = {};

    pendentes
      .filter((oc) => oc.requer_acao_tecnica || oc.tecnico_responsavel_id || ["Alta", "Crítica"].includes(prioridadeOcorrencia(oc)))
      .forEach((oc) => {
        const tecnicoId = oc.tecnico_responsavel_id || "sem_tecnico";
        const tecnico = tecnicoPorId[tecnicoId];
        const prioridade = prioridadeOcorrencia(oc);

        if (!agrupado[tecnicoId]) {
          agrupado[tecnicoId] = {
            tecnico_id: tecnicoId,
            tecnico_nome: tecnico?.nome || "Sem técnico definido",
            tecnico_avatar_url: tecnico?.avatar_url || "",
            perfil: tecnico?.perfil_acesso || "Técnico",
            pendentes: 0,
            alta: 0,
            critica: 0,
            maiorPrioridade: "Baixa",
          };
        }

        agrupado[tecnicoId].pendentes += 1;
        if (prioridade === "Alta") agrupado[tecnicoId].alta += 1;
        if (prioridade === "Crítica") agrupado[tecnicoId].critica += 1;

        if (pesoPrioridade(prioridade) > pesoPrioridade(agrupado[tecnicoId].maiorPrioridade)) {
          agrupado[tecnicoId].maiorPrioridade = prioridade;
        }
      });

    const pendenciasTecnicos = Object.values(agrupado)
      .map((item) => ({
        ...item,
        prioridade: item.critica > 0 ? "Crítica" : item.alta > 0 ? "Alta" : item.pendentes >= 5 ? "Crítico" : item.pendentes >= 3 ? "Médio" : item.maiorPrioridade,
      }))
      .sort((a, b) => {
        const pesoA = pesoPrioridade(a.prioridade);
        const pesoB = pesoPrioridade(b.prioridade);
        if (pesoA !== pesoB) return pesoB - pesoA;
        return b.pendentes - a.pendentes;
      })
      .slice(0, 8);

    return {
      totalConviventes: conviventes.length,
      ativos: ativos.length,
      leitosOcupados,
      totalLeitos,
      atendimentosMes: series?.resumo?.atendimentos_mes ?? 0,
      atendimentosHoje: series?.resumo?.atendimentos_hoje ?? 0,
      alertasComunicacao: Number(resumoAvisos?.total_alertas_ativos ?? resumoAvisos?.total_nao_lidos ?? 0),
      ocorrenciasPendentes,
      alertasOcorrencias: ocorrenciasPendentes,
      alertasAtivos: Number(resumoAvisos?.total_alertas_ativos ?? resumoAvisos?.total_nao_lidos ?? 0) + ocorrenciasPendentes,
      pendenciasTecnicas: pendenciasTecnicos.reduce((soma, item) => soma + item.pendentes, 0),
      ocorrenciasEmAlerta,
      pendenciasTecnicos,
      resumoPrioridades,
    };
  }, [conviventes, quartos, ocorrencias, tecnicos, series, resumoAvisos, resumoDashboard]);

  const dadosGraficoRange = useMemo(() => gerarSeriePorRange(series, dataInicio, dataFim), [series, dataInicio, dataFim]);
  const totalRange = dadosGraficoRange.reduce((total, item) => total + (item.atendimentos || 0), 0);

  const cards = [
    { titulo: "Conviventes ativos", valor: dados.ativos, subtitulo: `${dados.totalConviventes} no cadastro total`, icone: "◇", cor: "text-slate-900" },
    { titulo: "Atendimentos (mês)", valor: dados.atendimentosMes, subtitulo: "Registros válidos no mês", icone: "▥", cor: "text-slate-900" },
    { titulo: "Atendimentos hoje", valor: dados.atendimentosHoje, subtitulo: `${dados.leitosOcupados} vagas ocupadas`, icone: "✓", cor: "text-slate-900" },
    {
      titulo: "Alertas ativos",
      valor: dados.alertasAtivos,
      subtitulo: formatarSubtituloAlertas(dados),
      icone: "!",
      cor: dados.alertasAtivos ? "text-red-600" : "text-slate-900",
    },
  ];

  function abrirPendenciasTecnico(item) {
    if (!item?.tecnico_id || item.tecnico_id === "sem_tecnico") {
      navigate("/ocorrencias");
      return;
    }

    navigate(`/ocorrencias?tecnico_id=${encodeURIComponent(item.tecnico_id)}&status=Pendente`);
  }

  async function handleMarcarAvisoComoLido(avisoId) {
    if (!avisoId) return;

    const avisoAtual = avisos.find((item) => item.id === avisoId);
    if (avisoAtual?.lido) return;

    setAvisos((lista) => lista.map((item) => (item.id === avisoId ? { ...item, lido: true } : item)));
    setResumoAvisos((resumo) => ({
      ...resumo,
      total_nao_lidos: Math.max(0, Number(resumo?.total_nao_lidos || 0) - 1),
      total_alertas_ativos: Math.max(0, Number(resumo?.total_alertas_ativos || 0) - 1),
    }));

    try {
      await marcarAvisoComoLido(token, avisoId);
    } catch (error) {
      console.error("Erro ao marcar aviso como lido", error);
      carregarDados();
    }
  }

  async function handleAbrirAviso(aviso) {
    if (!aviso) return;
    setAvisoAberto(aviso);
    await handleMarcarAvisoComoLido(aviso.id);
  }

  function handleAbrirComunicacaoInterna() {
    navigate("/avisos");
  }

  return (
    <div className="carecore-app-fixed">
      <Sidebar />

      <ModalAvisoDashboard
        aviso={avisoAberto}
        onFechar={() => setAvisoAberto(null)}
        onGerenciar={handleAbrirComunicacaoInterna}
      />

      <section className="carecore-main-fixed">
        <header className="carecore-page-header-fixed px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <h1 className="text-[23px] font-bold text-slate-900 leading-none">Dashboard</h1>
              <p className="text-sm text-slate-500 mt-1">Visão executiva da instituição, rotina e ocorrências.</p>
            </div>

            <div className="flex w-full items-center gap-2 overflow-x-auto pb-1 sm:w-auto sm:overflow-visible sm:pb-0">
              <ProjetoAtualBadge />
              <button
                type="button"
                onClick={() => {
                  const painelAvisos = document.querySelector(".carecore-avisos-scroll");
                  painelAvisos?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                className="relative shrink-0 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-lg font-semibold text-slate-700 shadow-sm"
                title={`${dados.alertasAtivos} alerta${dados.alertasAtivos === 1 ? "" : "s"} ativo${dados.alertasAtivos === 1 ? "" : "s"}`}
              >
                !
                {dados.alertasAtivos > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
                    {dados.alertasAtivos > 99 ? "99+" : dados.alertasAtivos}
                  </span>
                )}
              </button>
              <span className="shrink-0 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Hoje</span>
              <span className="shrink-0 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">Banco ativo</span>
            </div>
          </div>
        </header>

        <main className="carecore-scroll-area carecore-dashboard-scroll-area">
          {erro && <div className="mb-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{erro}</div>}

          {loading ? (
            <div className="flex min-h-[420px] items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
                <p className="font-semibold text-slate-500">Carregando dashboard...</p>
              </div>
            </div>
          ) : (
            <div className="carecore-dashboard-v2">
              <section className="carecore-dashboard-kpis">
                {cards.map((card) => (
                  <article key={card.titulo} className="carecore-kpi-soft">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="carecore-kpi-label">{card.titulo}</p>
                        <p className={`carecore-kpi-value ${card.cor}`}>{card.valor}</p>
                        <p className="carecore-kpi-subtitle line-clamp-2" title={card.subtitulo}>{card.subtitulo}</p>
                      </div>
                      <div className="carecore-kpi-icon">{card.icone}</div>
                    </div>
                  </article>
                ))}
              </section>

              <ResumoPrioridadesPendentes resumoPrioridades={dados.resumoPrioridades} />


              <section className="carecore-dashboard-main-grid">
                <article className="carecore-dashboard-card carecore-dashboard-chart-card">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="carecore-dashboard-card-title">Atendimentos por período</h2>
                      <p className="carecore-dashboard-card-subtitle">{totalRange} registros no intervalo selecionado.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="carecore-range-input" />
                      <span className="text-xs font-semibold text-slate-400">até</span>
                      <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="carecore-range-input" />
                    </div>
                  </div>

                  <LineChartRange dados={dadosGraficoRange} />
                </article>

                <AvisosImportantes avisos={avisos} carregando={carregandoAvisos} onAbrirAviso={handleAbrirAviso} onGerenciar={handleAbrirComunicacaoInterna} />

                <article className="carecore-dashboard-card carecore-panel-scroll">
                  <div className="mb-3 flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50 text-xl font-bold text-red-600">!</div>
                    <div>
                      <h2 className="carecore-dashboard-card-title">Ocorrências em aberto</h2>
                      <p className="carecore-dashboard-card-subtitle">
                        {dados.ocorrenciasPendentes || 0} pendente{(dados.ocorrenciasPendentes || 0) === 1 ? "" : "s"} no total, ordenadas por prioridade.
                      </p>
                    </div>
                  </div>

                  <div className="carecore-dashboard-panel-scroll-comfort carecore-avisos-scroll pr-1">
                    <div className="hidden md:block rounded-2xl border border-slate-100 overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
                          <tr>
                            <th className="px-3 py-3">Prioridade</th>
                            <th className="px-3 py-3">Ocorrência</th>
                            <th className="px-3 py-3">Data</th>
                            <th className="px-3 py-3">Resp.</th>
                            <th className="px-3 py-3 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {dados.ocorrenciasEmAlerta.length === 0 ? (
                            <tr><td colSpan="5" className="px-3 py-10 text-center text-sm text-slate-400">Nenhuma ocorrência em aberto no momento.</td></tr>
                          ) : (
                            dados.ocorrenciasEmAlerta.map((oc) => {
                              const prioridade = prioridadeOcorrencia(oc);
                              return (
                                <tr key={oc.id} className="hover:bg-slate-50">
                                  <td className="px-3 py-3"><BadgePrioridade prioridade={prioridade} /></td>
                                  <td className="px-3 py-3">
                                    <p className="font-semibold text-slate-900">{oc.motivo || oc.tipo_ocorrencia || "Ocorrência"}</p>
                                    <p className="text-xs text-slate-500 line-clamp-1">{oc.descricao || "Sem descrição"}</p>
                                  </td>
                                  <td className="px-3 py-3 text-xs font-semibold text-slate-500">{formatarData(oc.data_ocorrencia)}</td>
                                  <td className="px-3 py-3 text-xs font-semibold text-slate-600">Equipe</td>
                                  <td className="px-3 py-3 text-right">
                                    <button onClick={() => navigate("/ocorrencias")} className="rounded-xl border border-purple-100 bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-700">Ver</button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="carecore-dashboard-mobile-list md:hidden">
                      {dados.ocorrenciasEmAlerta.length === 0 ? (
                        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-400">
                          Nenhuma ocorrência em aberto no momento.
                        </div>
                      ) : (
                        dados.ocorrenciasEmAlerta.map((oc) => {
                          const prioridade = prioridadeOcorrencia(oc);
                          return (
                            <button
                              type="button"
                              key={oc.id}
                              onClick={() => navigate("/ocorrencias")}
                              className="w-full rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-left shadow-sm"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-slate-900">
                                    {oc.motivo || oc.tipo_ocorrencia || "Ocorrência"}
                                  </p>
                                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
                                    {oc.descricao || "Sem descrição"}
                                  </p>
                                </div>
                                <BadgePrioridade prioridade={prioridade} />
                              </div>

                              <div className="mt-3 flex items-center justify-between gap-3 text-xs font-semibold text-slate-500">
                                <span>{formatarData(oc.data_ocorrencia)}</span>
                                <span className="text-purple-700">Ver ocorrência</span>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <button onClick={() => navigate("/ocorrencias?status=Pendente")} className="carecore-soft-button mt-3 w-full">Ver todas as ocorrências em aberto →</button>
                </article>

                <article className="carecore-dashboard-card carecore-panel-scroll">
                  <div className="mb-3">
                    <h2 className="carecore-dashboard-card-title">Pendências por Técnico</h2>
                    <p className="carecore-dashboard-card-subtitle">Ocorrências aguardando encerramento técnico.</p>
                  </div>

                  <div className="carecore-dashboard-panel-scroll-comfort carecore-avisos-scroll pr-1">
                    <div className="hidden md:block rounded-2xl border border-slate-100 overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
                          <tr>
                            <th className="px-3 py-3">Técnico</th>
                            <th className="px-3 py-3 text-center">Pendentes</th>
                            <th className="px-3 py-3">Prioridade</th>
                            <th className="px-3 py-3"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {dados.pendenciasTecnicos.length === 0 ? (
                            <tr><td colSpan="4" className="px-3 py-10 text-center text-sm text-slate-400">Nenhuma pendência técnica encontrada.</td></tr>
                          ) : (
                            dados.pendenciasTecnicos.map((item) => (
                              <tr key={item.tecnico_id} className="hover:bg-slate-50">
                                <td className="px-3 py-3">
                                  <div className="flex items-center gap-3">
                                    <UserAvatar
                                      nome={item.tecnico_nome}
                                      avatarUrl={item.tecnico_avatar_url}
                                      size="sm"
                                    />
                                    <div className="min-w-0">
                                      <button type="button" onClick={() => abrirPendenciasTecnico(item)} className="carecore-technician-link truncate text-left">{item.tecnico_nome}</button>
                                      <p className="text-xs text-slate-500">{item.perfil}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-center text-xl font-bold text-slate-900">{item.pendentes}</td>
                                <td className="px-3 py-3"><BadgePrioridade prioridade={item.prioridade} /></td>
                                <td className="px-3 py-3 text-right text-slate-400">›</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="carecore-dashboard-mobile-list md:hidden">
                      {dados.pendenciasTecnicos.length === 0 ? (
                        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-400">
                          Nenhuma pendência técnica encontrada.
                        </div>
                      ) : (
                        dados.pendenciasTecnicos.map((item) => (
                          <button
                            type="button"
                            key={item.tecnico_id}
                            onClick={() => abrirPendenciasTecnico(item)}
                            className="w-full rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-left shadow-sm"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-3">
                                <UserAvatar
                                  nome={item.tecnico_nome}
                                  avatarUrl={item.tecnico_avatar_url}
                                  size="sm"
                                />
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-slate-900">{item.tecnico_nome}</p>
                                  <p className="text-xs text-slate-500">{item.perfil}</p>
                                </div>
                              </div>

                              <div className="text-right">
                                <p className="text-2xl font-bold leading-none text-slate-900">{item.pendentes}</p>
                                <p className="text-[10px] font-bold uppercase text-slate-400">pend.</p>
                              </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between gap-3">
                              <BadgePrioridade prioridade={item.prioridade} />
                              <span className="text-xs font-bold text-purple-700">Abrir fila</span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  <button onClick={() => navigate("/ocorrencias")} className="carecore-soft-button mt-3 w-full">Ver todas as pendências →</button>
                </article>
              </section>
            </div>
          )}
        </main>
      </section>
    </div>
  );
}