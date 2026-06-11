// =====================================================================
// ARQUIVO: src/Avisos.jsx
// Comunicação Interna / Avisos Importantes CARECORE+
// Página corrigida para usar o mesmo layout fixo do Dashboard
// =====================================================================
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import { AppShell, MainShell, PageHeader, PremiumButton, ReportActionButton, ScrollArea } from "./components/PremiumUI";
import { exportarRelatorioXlsx } from "./utils/exportarRelatorioXlsx";
import { imprimirRelatorio } from "./utils/imprimirRelatorio";
import {
  buscarIdentidadeRelatorios,
  obterLogoRelatorioDataUrl,
  obterLogoRelatorioSrc,
} from "./utils/relatorioIdentidadePrint";
import {
  criarAviso,
  listarMeusAvisos,
  listarHistoricoAvisos,
  obterResumoAvisos,
  marcarAvisoComoLido,
  cancelarAviso,
} from "./services/avisosService";
import { API_ROOT } from "./config/apiBase";
import { decodificarPayloadJwt } from "./utils/jwtUtils";
import { criarHeadersAutenticados } from "./utils/requestIdUtils";

const CLASSIFICACOES = ["Informativo", "Atenção", "Urgente", "Comunicado", "Rotina", "Gestão"];

const PRIORIDADES = [
  { value: "normal", label: "Normal" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
  { value: "critica", label: "Crítica" },
];

function lerUsuarioLogado() {
  const token = localStorage.getItem("@CareCore:token");

  try {
    if (!token) {
      return {
        token: null,
        id: "",
        nome: "Usuário",
        perfil: "Perfil",
        isMaster: false,
      };
    }

    const payload = decodificarPayloadJwt(token) || {};

    return {
      token,
      id: payload.sub || payload.id || payload.usuario_id || "",
      nome: payload.nome || payload.email || "Usuário",
      perfil: payload.perfil_acesso || payload.perfil || "Perfil",
      isMaster: Boolean(payload.is_master),
    };
  } catch {
    return {
      token,
      id: "",
      nome: "Usuário",
      perfil: "Perfil",
      isMaster: false,
    };
  }
}

function formatarDataHora(valor) {
  if (!valor) return "-";

  try {
    return new Date(valor).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

function normalizarPrioridade(prioridade) {
  const valor = String(prioridade || "normal").toLowerCase();

  if (["critica", "crítica", "critico", "crítico"].includes(valor)) return "Crítica";
  if (valor === "alta") return "Alta";
  if (["media", "média", "medio", "médio"].includes(valor)) return "Média";

  return "Normal";
}

function Badge({ children, tipo = "normal" }) {
  const classes = {
    normal: "border-emerald-100 bg-emerald-50 text-emerald-700",
    media: "border-amber-100 bg-amber-50 text-amber-700",
    alta: "border-orange-100 bg-orange-50 text-orange-700",
    critica: "border-red-100 bg-red-50 text-red-700",
    info: "border-blue-100 bg-blue-50 text-blue-700",
    roxo: "border-purple-100 bg-purple-50 text-purple-700",
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black ${classes[tipo] || classes.normal}`}>
      {children}
    </span>
  );
}

function prioridadeParaTipo(prioridade) {
  const valor = normalizarPrioridade(prioridade);

  if (valor === "Crítica") return "critica";
  if (valor === "Alta") return "alta";
  if (valor === "Média") return "media";

  return "normal";
}

function dataValidadeParaFimDoDia(data) {
  const valor = String(data || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return null;
  }

  return `${valor}T23:59:59`;
}

const estadoInicialFormulario = {
  titulo: "",
  mensagem: "",
  classificacao: "Informativo",
  prioridade: "normal",
  destino_tipo: "todos",
  destinatarios_ids: [],
  valido_ate: "",
};

const filtrosHistoricoInicial = {
  status_filtro: "baixados",
  busca: "",
  classificacao: "Historico Orgsystem",
  data_inicio: "",
  data_fim: "",
};

const AVISOS_HISTORICO_POR_PAGINA = 10;


function ModalAvisoCompleto({ aviso, onFechar, onMarcarLido }) {
  if (!aviso) return null;

  const prioridadeLabel = normalizarPrioridade(aviso.prioridade);
  const tipo = prioridadeParaTipo(aviso.prioridade);
  const titulo = aviso.pode_exibir_titulo === false ? "Mensagem interna direcionada" : aviso.titulo || "Aviso";
  const mensagem = aviso.mensagem || aviso.mensagem_resumo || "Sem conteúdo informado.";

  return (
    <div className="carecore-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-sm sm:p-4">
      <div className="carecore-modal-panel flex max-h-[calc(100vh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-2xl sm:max-h-[calc(100vh-2rem)]">
        <div className="shrink-0 border-b border-slate-100 bg-gradient-to-r from-purple-50 to-white p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge tipo="info">{aviso.classificacao || "Informativo"}</Badge>
                <Badge tipo={tipo}>{prioridadeLabel}</Badge>
                <Badge tipo={aviso.destino_tipo === "todos" ? "normal" : "media"}>
                  {aviso.destino_tipo === "todos" ? "Todos" : "Direcionado"}
                </Badge>
                {!aviso.lido && <Badge tipo="critica">Não lido</Badge>}
              </div>

              <h3 className="text-xl font-black leading-tight text-slate-950">{titulo}</h3>
              <p className="mt-2 text-sm font-semibold text-slate-500">
                Remetente: {aviso.remetente_nome || aviso.remetente_id || "Usuário"} • {formatarDataHora(aviso.criado_em)}
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

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{mensagem}</p>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-slate-100 bg-slate-50 p-4 sm:flex-row sm:justify-end">
          {!aviso.lido && (
            <button
              type="button"
              onClick={() => onMarcarLido(aviso.id)}
              className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700 hover:bg-emerald-100"
            >
              Marcar como lido
            </button>
          )}
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


export default function Avisos() {
  const navigate = useNavigate();
  const usuario = useMemo(() => lerUsuarioLogado(), []);

  const [formulario, setFormulario] = useState(estadoInicialFormulario);
  const [avisos, setAvisos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [buscaUsuario, setBuscaUsuario] = useState("");
  const [resumo, setResumo] = useState({
    total_visiveis: 0,
    total_nao_lidos: 0,
    total_alertas_ativos: 0,
  });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [avisoAberto, setAvisoAberto] = useState(null);
  const [historicoAvisos, setHistoricoAvisos] = useState([]);
  const [totalHistoricoAvisos, setTotalHistoricoAvisos] = useState(0);
  const [paginaHistorico, setPaginaHistorico] = useState(1);
  const [filtrosHistorico, setFiltrosHistorico] = useState(filtrosHistoricoInicial);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [identidadeRelatorio, setIdentidadeRelatorio] = useState(null);

  async function carregarUsuariosDestinatarios() {
    if (!usuario.token) return [];

    const resposta = await fetch(`${API_ROOT}/avisos/usuarios`, {
      headers: criarHeadersAutenticados(usuario.token),
    });

    if (!resposta.ok) {
      let detalhe = "Não foi possível carregar os usuários destinatários.";

      try {
        const erroApi = await resposta.json();
        detalhe = erroApi?.detail || detalhe;
      } catch {
        // mantém a mensagem padrão
      }

      throw new Error(detalhe);
    }

    const dados = await resposta.json();
    return Array.isArray(dados) ? dados : [];
  }

  async function carregarAvisos() {
    if (!usuario.token) {
      setErro("Sessão expirada. Faça login novamente.");
      setCarregando(false);
      return;
    }

    try {
      setCarregando(true);
      setErro("");

      const [lista, dadosResumo, listaUsuarios] = await Promise.all([
        listarMeusAvisos(usuario.token, { limite: 50 }),
        obterResumoAvisos(usuario.token),
        carregarUsuariosDestinatarios(),
      ]);

      setAvisos(Array.isArray(lista) ? lista : []);
      setUsuarios(Array.isArray(listaUsuarios) ? listaUsuarios : []);
      setResumo(dadosResumo || {
        total_visiveis: 0,
        total_nao_lidos: 0,
        total_alertas_ativos: 0,
      });
    } catch (error) {
      console.error("Erro ao carregar avisos", error);
      setErro(error?.response?.data?.detail || "Não foi possível carregar os avisos.");
    } finally {
      setCarregando(false);
    }
  }

  async function carregarHistoricoAvisos(filtros = filtrosHistorico, pagina = paginaHistorico) {
    if (!usuario.token) return;

    try {
      setCarregandoHistorico(true);
      setErro("");

      const paginaSegura = Math.max(1, Number(pagina || 1));
      const resultado = await listarHistoricoAvisos(usuario.token, {
        ...filtros,
        limite: AVISOS_HISTORICO_POR_PAGINA,
        offset: (paginaSegura - 1) * AVISOS_HISTORICO_POR_PAGINA,
      });

      setHistoricoAvisos(Array.isArray(resultado.items) ? resultado.items : []);
      setTotalHistoricoAvisos(Number(resultado.total || 0));
      setPaginaHistorico(paginaSegura);
    } catch (error) {
      console.error("Erro ao carregar histórico de avisos", error);
      setErro(error?.response?.data?.detail || "Não foi possível carregar o histórico de avisos.");
    } finally {
      setCarregandoHistorico(false);
    }
  }

  useEffect(() => {
    carregarAvisos();
    carregarHistoricoAvisos(filtrosHistoricoInicial);
    buscarIdentidadeRelatorios().then(setIdentidadeRelatorio);
  }, []);

  function atualizarCampo(campo, valor) {
    setFormulario((atual) => ({
      ...atual,
      [campo]: valor,
    }));
  }

  function alternarDestinatario(usuarioId) {
    setFormulario((atual) => {
      const selecionados = Array.isArray(atual.destinatarios_ids) ? atual.destinatarios_ids : [];
      const jaSelecionado = selecionados.includes(usuarioId);

      return {
        ...atual,
        destinatarios_ids: jaSelecionado
          ? selecionados.filter((id) => id !== usuarioId)
          : [...selecionados, usuarioId],
      };
    });
  }

  function montarDestinatarios() {
    if (formulario.destino_tipo === "todos") return [];

    return Array.isArray(formulario.destinatarios_ids)
      ? formulario.destinatarios_ids.filter(Boolean)
      : [];
  }

  const usuariosFiltrados = usuarios.filter((item) => {
    const busca = buscaUsuario.trim().toLowerCase();

    if (!busca) return true;

    return (
      String(item.nome || "").toLowerCase().includes(busca) ||
      String(item.email || "").toLowerCase().includes(busca) ||
      String(item.perfil_acesso || "").toLowerCase().includes(busca)
    );
  });

  async function handleSubmit(event) {
    event.preventDefault();

    setErro("");
    setSucesso("");

    if (!formulario.titulo.trim()) {
      setErro("Informe o título do aviso.");
      return;
    }

    if (!formulario.mensagem.trim()) {
      setErro("Informe a mensagem do aviso.");
      return;
    }

    const destinatarios = montarDestinatarios();

    if (formulario.destino_tipo === "usuarios" && destinatarios.length === 0) {
      setErro("Selecione ao menos um usuário destinatário.")
      return;
    }

    const payload = {
      titulo: formulario.titulo.trim(),
      mensagem: formulario.mensagem.trim(),
      classificacao: formulario.classificacao,
      prioridade: formulario.prioridade,
      destino_tipo: formulario.destino_tipo,
      destinatarios_ids: destinatarios,
      valido_ate: dataValidadeParaFimDoDia(formulario.valido_ate),
    };

    try {
      setSalvando(true);
      await criarAviso(usuario.token, payload);

      setFormulario(estadoInicialFormulario);
      setSucesso("Aviso enviado com sucesso.");
      await carregarAvisos();
    } catch (error) {
      console.error("Erro ao criar aviso", error);
      setErro(error?.response?.data?.detail || "Não foi possível enviar o aviso.");
    } finally {
      setSalvando(false);
    }
  }

  async function handleMarcarLido(avisoId) {
    try {
      setErro("");
      setSucesso("");
      await marcarAvisoComoLido(usuario.token, avisoId);
      await carregarAvisos();
    } catch (error) {
      console.error("Erro ao marcar aviso como lido", error);
      setErro(error?.response?.data?.detail || "Não foi possível marcar o aviso como lido.");
    }
  }

  async function handleAbrirAviso(aviso) {
    if (!aviso) return;
    setAvisoAberto(aviso);

    if (!aviso.lido) {
      try {
        await marcarAvisoComoLido(usuario.token, aviso.id);
        setAvisos((lista) => lista.map((item) => (item.id === aviso.id ? { ...item, lido: true } : item)));
        setAvisoAberto({ ...aviso, lido: true });
        setResumo((atual) => ({
          ...atual,
          total_nao_lidos: Math.max(0, Number(atual?.total_nao_lidos || 0) - 1),
          total_alertas_ativos: Math.max(0, Number(atual?.total_alertas_ativos || 0) - 1),
        }));
      } catch (error) {
        console.error("Erro ao marcar aviso como lido ao abrir", error);
      }
    }
  }

  async function handleCancelar(avisoId) {
    const confirmar = window.confirm("Deseja cancelar este aviso? Ele deixará de aparecer para os usuários.");
    if (!confirmar) return;

    try {
      setErro("");
      setSucesso("");
      await cancelarAviso(usuario.token, avisoId);
      setSucesso("Aviso cancelado com sucesso.");
      await carregarAvisos();
    } catch (error) {
      console.error("Erro ao cancelar aviso", error);
      setErro(error?.response?.data?.detail || "Não foi possível cancelar o aviso.");
    }
  }


  const relatorioAvisos = useMemo(() => {
    const base = Array.isArray(avisos) ? avisos : [];

    const total = base.length;
    const naoLidos = base.filter((item) => !item.lido).length;
    const lidos = total - naoLidos;
    const paraTodos = base.filter((item) => item.destino_tipo === "todos").length;
    const direcionados = base.filter((item) => item.destino_tipo !== "todos").length;

    const porClassificacao = {};
    const porPrioridade = {};

    base.forEach((item) => {
      const classificacao = item.classificacao || "Informativo";
      const prioridade = normalizarPrioridade(item.prioridade);

      porClassificacao[classificacao] = (porClassificacao[classificacao] || 0) + 1;
      porPrioridade[prioridade] = (porPrioridade[prioridade] || 0) + 1;
    });

    return {
      total,
      lidos,
      naoLidos,
      paraTodos,
      direcionados,
      porClassificacao,
      porPrioridade,
    };
  }, [avisos]);

  function montarDadosRelatorioAvisos() {
    return (Array.isArray(avisos) ? avisos : []).map((item) => ({
      Data: formatarDataHora(item.criado_em),
      Título: item.titulo || "Aviso",
      Classificação: item.classificacao || "-",
      Prioridade: normalizarPrioridade(item.prioridade),
      Destino: item.destino_tipo === "todos" ? "Todos" : "Direcionado",
      Status: item.lido ? "Lido" : "Não lido",
      Remetente: item.remetente_nome || item.remetente_id || "-",
      "Válido até": formatarDataHora(item.valido_ate),
      Mensagem: item.mensagem || item.mensagem_resumo || "-",
    }));
  }

  function exportarRelatorioAvisosXLSX() {
    const colunas = [
      "Data",
      "Título",
      "Classificação",
      "Prioridade",
      "Destino",
      "Status",
      "Remetente",
      "Válido até",
      "Mensagem",
    ];

    exportarRelatorioXlsx({
      nomeArquivo: `relatorio-avisos-${new Date().toISOString().slice(0, 10)}`,
      titulo: "Relatório de Comunicação Interna",
      filtros: {
        "Total de avisos": relatorioAvisos.total,
        "Não lidos": relatorioAvisos.naoLidos,
        "Lidos": relatorioAvisos.lidos,
        "Para todos": relatorioAvisos.paraTodos,
        "Direcionados": relatorioAvisos.direcionados,
      },
      colunas,
      dados: montarDadosRelatorioAvisos(),
    });
  }

  async function abrirRelatorioImpressaoAvisos() {
    const logoRelatorioDataUrl = await obterLogoRelatorioDataUrl(identidadeRelatorio);

    imprimirRelatorio({
      titulo: "Relatório de Comunicação Interna",
      subtitulo: `Total: ${relatorioAvisos.total} | Não lidos: ${relatorioAvisos.naoLidos} | Para todos: ${relatorioAvisos.paraTodos} | Direcionados: ${relatorioAvisos.direcionados}`,
      colunas: [
        "Data",
        "Título",
        "Classificação",
        "Prioridade",
        "Destino",
        "Status",
        "Remetente",
        "Mensagem",
      ],
      dados: montarDadosRelatorioAvisos(),
      identidade: {
        ...identidadeRelatorio,
        logo_src: obterLogoRelatorioSrc(logoRelatorioDataUrl),
      },
    });
  }

  function atualizarFiltroHistorico(campo, valor) {
    setFiltrosHistorico((atual) => ({
      ...atual,
      [campo]: valor,
    }));
  }

  function aplicarFiltrosHistorico(event) {
    event?.preventDefault();
    carregarHistoricoAvisos(filtrosHistorico, 1);
  }

  function limparFiltrosHistorico() {
    setFiltrosHistorico(filtrosHistoricoInicial);
    carregarHistoricoAvisos(filtrosHistoricoInicial, 1);
  }

  const totalPaginasHistorico = Math.max(
    1,
    Math.ceil(totalHistoricoAvisos / AVISOS_HISTORICO_POR_PAGINA)
  );

  const paginaHistoricoSegura = Math.min(paginaHistorico, totalPaginasHistorico);
  const indiceInicialHistorico = totalHistoricoAvisos === 0
    ? 0
    : (paginaHistoricoSegura - 1) * AVISOS_HISTORICO_POR_PAGINA + 1;
  const indiceFinalHistorico = Math.min(
    paginaHistoricoSegura * AVISOS_HISTORICO_POR_PAGINA,
    totalHistoricoAvisos
  );
  const primeiraPaginaHistoricoVisivel = Math.max(1, paginaHistoricoSegura - 2);
  const ultimaPaginaHistoricoVisivel = Math.min(
    totalPaginasHistorico,
    primeiraPaginaHistoricoVisivel + 4
  );
  const paginasHistoricoVisiveis = Array.from(
    { length: ultimaPaginaHistoricoVisivel - primeiraPaginaHistoricoVisivel + 1 },
    (_, index) => primeiraPaginaHistoricoVisivel + index
  );

  function irParaPaginaHistorico(novaPagina) {
    const pagina = Math.min(Math.max(novaPagina, 1), totalPaginasHistorico);
    carregarHistoricoAvisos(filtrosHistorico, pagina);
  }

  function statusAvisoHistorico(aviso) {
    if (aviso.ativo === false || aviso.cancelado_em) return "Baixado/Cancelado";
    if (aviso.valido_ate && new Date(aviso.valido_ate) < new Date()) return "Expirado";
    return "Ativo";
  }

  function montarDadosHistoricoAvisos() {
    return (Array.isArray(historicoAvisos) ? historicoAvisos : []).map((item) => ({
      Data: formatarDataHora(item.criado_em),
      Título: item.titulo || "Aviso",
      Classificação: item.classificacao || "-",
      Prioridade: normalizarPrioridade(item.prioridade),
      Status: statusAvisoHistorico(item),
      "Baixado em": formatarDataHora(item.cancelado_em),
      Mensagem: item.mensagem || "-",
    }));
  }

  async function imprimirHistoricoAvisos() {
    const logoRelatorioDataUrl = await obterLogoRelatorioDataUrl(identidadeRelatorio);

    imprimirRelatorio({
      titulo: "Histórico de Avisos Baixados",
      subtitulo: `Página ${paginaHistoricoSegura} de ${totalPaginasHistorico} | Total filtrado: ${totalHistoricoAvisos} | Status: ${filtrosHistorico.status_filtro} | Classificação: ${filtrosHistorico.classificacao || "Todas"}`,
      colunas: [
        "Data",
        "Título",
        "Classificação",
        "Prioridade",
        "Status",
        "Baixado em",
        "Mensagem",
      ],
      dados: montarDadosHistoricoAvisos(),
      identidade: {
        ...identidadeRelatorio,
        logo_src: obterLogoRelatorioSrc(logoRelatorioDataUrl),
      },
    });
  }

  return (
    <AppShell>
      <Sidebar />

      <ModalAvisoCompleto
        aviso={avisoAberto}
        onFechar={() => setAvisoAberto(null)}
        onMarcarLido={handleMarcarLido}
      />

      <MainShell>
        <PageHeader
          eyebrow="Equipe"
          title="Comunicação Interna"
          subtitle="Envie avisos, mensagens direcionadas e comunicados para a equipe."
          icon="◌"
          actions={(
            <>
              <PremiumButton
                type="button"
                variant="secondary"
                onClick={() => navigate("/dashboard")}
              >
                Dashboard
              </PremiumButton>

              <div className="rounded-2xl border border-purple-100 bg-purple-50 px-4 py-3 text-sm font-bold text-purple-700">
                {resumo.total_alertas_ativos || 0} ativos
              </div>
            </>
          )}
        />

        <ScrollArea>
          <section className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.25fr]">
            <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5">
                <h2 className="text-xl font-black text-slate-900">Novo aviso</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Mensagens para todos aparecem com título. Mensagens direcionadas aparecem somente para os destinatários.
                </p>
              </div>

              {erro && (
                <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                  {erro}
                </div>
              )}

              {sucesso && (
                <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                  {sucesso}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">Título</label>
                  <input
                    value={formulario.titulo}
                    onChange={(event) => atualizarCampo("titulo", event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-purple-300"
                    placeholder="Ex.: Reunião de alinhamento"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">Mensagem</label>
                  <textarea
                    value={formulario.mensagem}
                    onChange={(event) => atualizarCampo("mensagem", event.target.value)}
                    rows={5}
                    className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-purple-300"
                    placeholder="Digite a comunicação interna..."
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">Classificação</label>
                    <select
                      value={formulario.classificacao}
                      onChange={(event) => atualizarCampo("classificacao", event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-purple-300"
                    >
                      {CLASSIFICACOES.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">Prioridade</label>
                    <select
                      value={formulario.prioridade}
                      onChange={(event) => atualizarCampo("prioridade", event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-purple-300"
                    >
                      {PRIORIDADES.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">Destino</label>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => atualizarCampo("destino_tipo", "todos")}
                      className={`rounded-2xl border px-4 py-3 text-sm font-black ${
                        formulario.destino_tipo === "todos"
                          ? "border-purple-200 bg-purple-50 text-purple-700"
                          : "border-slate-200 bg-white text-slate-500"
                      }`}
                    >
                      Enviar para todos
                    </button>

                    <button
                      type="button"
                      onClick={() => atualizarCampo("destino_tipo", "usuarios")}
                      className={`rounded-2xl border px-4 py-3 text-sm font-black ${
                        formulario.destino_tipo === "usuarios"
                          ? "border-purple-200 bg-purple-50 text-purple-700"
                          : "border-slate-200 bg-white text-slate-500"
                      }`}
                    >
                      Usuários específicos
                    </button>
                  </div>
                </div>

                {formulario.destino_tipo === "usuarios" && (
                  <div>
                    <div className="mb-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <label className="block text-xs font-black uppercase tracking-wide text-slate-500">
                        Destinatários
                      </label>
                      <span className="text-xs font-bold text-purple-600">
                        {(formulario.destinatarios_ids || []).length} selecionado(s)
                      </span>
                    </div>

                    <input
                      value={buscaUsuario}
                      onChange={(event) => setBuscaUsuario(event.target.value)}
                      className="mb-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-purple-300"
                      placeholder="Buscar por nome, e-mail ou perfil..."
                    />

                    <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
                      {usuariosFiltrados.length === 0 ? (
                        <div className="rounded-2xl bg-white px-4 py-6 text-center text-sm font-bold text-slate-400">
                          Nenhum usuário encontrado.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {usuariosFiltrados.map((item) => {
                            const selecionado = (formulario.destinatarios_ids || []).includes(item.id);

                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => alternarDestinatario(item.id)}
                                className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                                  selecionado
                                    ? "border-purple-200 bg-purple-50"
                                    : "border-slate-100 bg-white hover:bg-slate-50"
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="truncate text-sm font-black text-slate-800">
                                      {item.nome || "Usuário sem nome"}
                                    </p>
                                    {item.sou_eu && (
                                      <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-black uppercase text-blue-600">
                                        Você
                                      </span>
                                    )}
                                  </div>
                                  <p className="truncate text-xs font-semibold text-slate-400">
                                    {item.email || "Sem e-mail"} · {item.perfil_acesso || "Perfil não informado"}
                                  </p>
                                </div>

                                <span
                                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-black ${
                                    selecionado
                                      ? "border-purple-500 bg-purple-600 text-white"
                                      : "border-slate-200 bg-white text-slate-300"
                                  }`}
                                >
                                  {selecionado ? "✓" : "+"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <p className="mt-2 text-xs text-slate-400">
                      A mensagem direcionada aparecerá somente para os usuários selecionados.
                    </p>
                  </div>
                )}
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">Válido até</label>
                  <input
                    type="date"
                    value={formulario.valido_ate}
                    onChange={(event) => atualizarCampo("valido_ate", event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-purple-300"
                  />
                  <p className="mt-2 text-xs font-semibold text-slate-400">
                    O aviso permanece ativo até 23:59 do dia escolhido.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={salvando}
                  className="w-full rounded-2xl bg-purple-600 px-5 py-4 text-sm font-black text-white shadow-sm hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {salvando ? "Enviando..." : "Enviar aviso"}
                </button>
              </div>
            </form>

            <div className="space-y-4">
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-xl font-black text-slate-900">Relatório de avisos</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Resumo dos avisos visíveis conforme seu perfil e permissões.
                    </p>
                  </div>

                  <ReportActionButton action="export" onClick={exportarRelatorioAvisosXLSX}>
                    Exportar
                  </ReportActionButton>

                  <ReportActionButton action="print" onClick={abrirRelatorioImpressaoAvisos}>
                    Imprimir
                  </ReportActionButton>
                </div>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-[11px] font-black uppercase text-slate-400">Total</p>
                    <p className="mt-1 text-2xl font-black text-slate-900">{relatorioAvisos.total}</p>
                  </div>
                  <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                    <p className="text-[11px] font-black uppercase text-amber-600">Não lidos</p>
                    <p className="mt-1 text-2xl font-black text-amber-700">{relatorioAvisos.naoLidos}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                    <p className="text-[11px] font-black uppercase text-emerald-600">Lidos</p>
                    <p className="mt-1 text-2xl font-black text-emerald-700">{relatorioAvisos.lidos}</p>
                  </div>
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                    <p className="text-[11px] font-black uppercase text-blue-600">Todos</p>
                    <p className="mt-1 text-2xl font-black text-blue-700">{relatorioAvisos.paraTodos}</p>
                  </div>
                  <div className="rounded-2xl border border-purple-100 bg-purple-50 p-4">
                    <p className="text-[11px] font-black uppercase text-purple-600">Direcionados</p>
                    <p className="mt-1 text-2xl font-black text-purple-700">{relatorioAvisos.direcionados}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-100 bg-white p-4">
                    <p className="mb-3 text-xs font-black uppercase text-slate-500">Por classificação</p>
                    <div className="space-y-2">
                      {Object.entries(relatorioAvisos.porClassificacao).length === 0 ? (
                        <p className="text-sm font-semibold text-slate-400">Sem dados.</p>
                      ) : (
                        Object.entries(relatorioAvisos.porClassificacao).map(([nome, total]) => (
                          <div key={nome} className="flex items-center justify-between text-sm">
                            <span className="font-bold text-slate-600">{nome}</span>
                            <span className="font-black text-slate-900">{total}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-white p-4">
                    <p className="mb-3 text-xs font-black uppercase text-slate-500">Por prioridade</p>
                    <div className="space-y-2">
                      {["Normal", "Média", "Alta", "Crítica"].map((prioridade) => (
                        <div key={prioridade} className="flex items-center justify-between text-sm">
                          <span className="font-bold text-slate-600">{prioridade}</span>
                          <span className="font-black text-slate-900">{relatorioAvisos.porPrioridade[prioridade] || 0}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-900">Avisos visíveis para você</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Esta lista usa a mesma fonte de dados do dashboard e do sininho.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge tipo="roxo">{resumo.total_visiveis || 0} visíveis</Badge>
                  <Badge tipo="media">{resumo.total_nao_lidos || 0} não lidos</Badge>
                </div>
              </div>

              {carregando ? (
                <div className="rounded-3xl border border-slate-100 bg-slate-50 p-10 text-center text-sm font-bold text-slate-400">
                  Carregando avisos...
                </div>
              ) : avisos.length === 0 ? (
                <div className="rounded-3xl border border-slate-100 bg-slate-50 p-10 text-center">
                  <p className="text-base font-black text-slate-500">Nenhum aviso encontrado.</p>
                  <p className="mt-2 text-sm text-slate-400">
                    Envie o primeiro aviso pelo formulário ao lado.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {avisos.map((aviso) => {
                    const prioridadeLabel = normalizarPrioridade(aviso.prioridade);
                    const tipo = prioridadeParaTipo(aviso.prioridade);

                    return (
                      <article
                        key={aviso.id}
                        onClick={() => handleAbrirAviso(aviso)}
                        className={`cursor-pointer rounded-3xl border p-4 transition hover:bg-slate-50 ${
                          aviso.lido ? "border-slate-100 bg-white" : "border-purple-100 bg-purple-50/40"
                        }`}
                        title="Clique para ler a mensagem completa"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <Badge tipo="info">{aviso.classificacao || "Informativo"}</Badge>
                              <Badge tipo={tipo}>{prioridadeLabel}</Badge>
                              <Badge tipo={aviso.destino_tipo === "todos" ? "normal" : "media"}>
                                {aviso.destino_tipo === "todos" ? "Todos" : "Direcionado"}
                              </Badge>
                              {!aviso.lido && <Badge tipo="critica">Não lido</Badge>}
                            </div>

                            <h3 className="truncate text-lg font-black text-slate-900">
                              {aviso.pode_exibir_titulo === false ? "Você tem uma mensagem" : aviso.titulo}
                            </h3>

                            <p className="mt-2 text-sm leading-6 text-slate-600">
                              {aviso.mensagem_resumo || aviso.mensagem || "Sem conteúdo."}
                            </p>

                            <p className="mt-2 text-xs font-black text-purple-600">Clique para ler a mensagem completa</p>

                            <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-slate-400">
                              <span>Remetente: {aviso.remetente_nome || aviso.remetente_id || "Usuário"}</span>
                              <span>Criado em: {formatarDataHora(aviso.criado_em)}</span>
                              {aviso.valido_ate && <span>Válido até: {formatarDataHora(aviso.valido_ate)}</span>}
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-wrap gap-2">
                            {!aviso.lido && (
                              <button
                                type="button"
                                onClick={(event) => { event.stopPropagation(); handleMarcarLido(aviso.id); }}
                                className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100"
                              >
                                Marcar lido
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={(event) => { event.stopPropagation(); handleCancelar(aviso.id); }}
                              className="rounded-2xl border border-red-100 bg-red-50 px-4 py-2 text-xs font-black text-red-700 hover:bg-red-100"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-xl font-black text-slate-900">Histórico de avisos baixados</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Consulte avisos cancelados, expirados ou importados como histórico. Esta lista não alimenta o dashboard.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge tipo="info">{totalHistoricoAvisos} filtrado(s)</Badge>
                    <Badge tipo="roxo">10 por página</Badge>
                    <ReportActionButton action="print" onClick={imprimirHistoricoAvisos}>
                      Imprimir
                    </ReportActionButton>
                  </div>
                </div>

                <form onSubmit={aplicarFiltrosHistorico} className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-6">
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">Status</label>
                    <select
                      value={filtrosHistorico.status_filtro}
                      onChange={(event) => atualizarFiltroHistorico("status_filtro", event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold outline-none focus:border-purple-300"
                    >
                      <option value="baixados">Baixados</option>
                      <option value="ativos">Ativos</option>
                      <option value="todos">Todos</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">Classificação</label>
                    <input
                      value={filtrosHistorico.classificacao}
                      onChange={(event) => atualizarFiltroHistorico("classificacao", event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm font-semibold outline-none focus:border-purple-300"
                      placeholder="Ex.: Historico Orgsystem"
                    />
                  </div>

                  <div className="lg:col-span-2">
                    <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">Buscar</label>
                    <input
                      value={filtrosHistorico.busca}
                      onChange={(event) => atualizarFiltroHistorico("busca", event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm font-semibold outline-none focus:border-purple-300"
                      placeholder="Título ou texto do aviso..."
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">Início</label>
                    <input
                      type="date"
                      value={filtrosHistorico.data_inicio}
                      onChange={(event) => atualizarFiltroHistorico("data_inicio", event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm font-semibold outline-none focus:border-purple-300"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">Fim</label>
                    <input
                      type="date"
                      value={filtrosHistorico.data_fim}
                      onChange={(event) => atualizarFiltroHistorico("data_fim", event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm font-semibold outline-none focus:border-purple-300"
                    />
                  </div>

                  <div className="flex gap-2 lg:col-span-6">
                    <button
                      type="submit"
                      className="rounded-2xl bg-purple-600 px-4 py-3 text-xs font-black text-white hover:bg-purple-700"
                    >
                      Aplicar filtros
                    </button>
                    <button
                      type="button"
                      onClick={limparFiltrosHistorico}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-600 hover:bg-slate-50"
                    >
                      Limpar
                    </button>
                  </div>
                </form>

                {carregandoHistorico ? (
                  <div className="rounded-3xl border border-slate-100 bg-slate-50 p-10 text-center text-sm font-bold text-slate-400">
                    Carregando histórico...
                  </div>
                ) : historicoAvisos.length === 0 ? (
                  <div className="rounded-3xl border border-slate-100 bg-slate-50 p-10 text-center text-sm font-bold text-slate-400">
                    Nenhum aviso encontrado para os filtros atuais.
                  </div>
                ) : (
                  <>
                    <div className="max-h-[32rem] space-y-3 overflow-y-auto pr-1">
                      {historicoAvisos.map((aviso) => (
                        <article key={aviso.id} className="rounded-3xl border border-slate-100 bg-slate-50/60 p-4">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <Badge tipo="info">{aviso.classificacao || "Informativo"}</Badge>
                            <Badge tipo={prioridadeParaTipo(aviso.prioridade)}>{normalizarPrioridade(aviso.prioridade)}</Badge>
                            <Badge tipo={aviso.ativo === false ? "media" : "normal"}>{statusAvisoHistorico(aviso)}</Badge>
                          </div>
                          <h3 className="text-base font-black text-slate-900">{aviso.titulo || "Aviso"}</h3>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{aviso.mensagem || "Sem conteúdo."}</p>
                          <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-slate-400">
                            <span>Criado em: {formatarDataHora(aviso.criado_em)}</span>
                            {aviso.cancelado_em && <span>Baixado em: {formatarDataHora(aviso.cancelado_em)}</span>}
                            {aviso.valido_ate && <span>Válido até: {formatarDataHora(aviso.valido_ate)}</span>}
                          </div>
                        </article>
                      ))}
                    </div>

                    <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
                      <span className="font-semibold">
                        Exibindo {indiceInicialHistorico} a {indiceFinalHistorico} de {totalHistoricoAvisos} avisos
                      </span>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => irParaPaginaHistorico(paginaHistoricoSegura - 1)}
                          disabled={paginaHistoricoSegura === 1 || carregandoHistorico}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Anterior
                        </button>

                        {paginasHistoricoVisiveis.map((pagina) => (
                          <button
                            key={pagina}
                            type="button"
                            onClick={() => irParaPaginaHistorico(pagina)}
                            disabled={carregandoHistorico}
                            className={`h-8 min-w-8 rounded-xl border px-2 text-xs font-bold ${
                              pagina === paginaHistoricoSegura
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            {pagina}
                          </button>
                        ))}

                        <button
                          type="button"
                          onClick={() => irParaPaginaHistorico(paginaHistoricoSegura + 1)}
                          disabled={paginaHistoricoSegura === totalPaginasHistorico || carregandoHistorico}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Próxima
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </section>
            </div>
          </section>
        </ScrollArea>
      </MainShell>
    </AppShell>
  );
}
