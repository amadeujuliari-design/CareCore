import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

import Sidebar from './Sidebar';
import { AppShell, MainShell, PageHeader, PremiumButton, ReportActionButton } from './components/PremiumUI';
import api from './services/api';
import { useLeitorUsbGlobal } from './hooks/useLeitorUsbGlobal';
import { encontrarConviventePorCodigo } from './utils/conviventeIdentificacaoUtils';
import { filtrarOrdenarConviventesPorBusca } from './utils/conviventeBuscaUtils';
import { exportarRelatorioXlsx } from './utils/exportarRelatorioXlsx';
import { imprimirRelatorio } from './utils/imprimirRelatorio';
import { buscarIdentidadeRelatorios, obterLogoRelatorioDataUrl } from './utils/relatorioIdentidadePrint';

const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

function detalheErro(error, fallback) {
  const detalhe = error?.response?.data?.detail;
  return typeof detalhe === 'string' ? detalhe : fallback;
}

function hojeISO() {
  const data = new Date();
  const pad = (numero) => String(numero).padStart(2, '0');
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`;
}

function somarDias(iso, quantidade) {
  const [ano, mes, dia] = iso.split('-').map(Number);
  const data = new Date(ano, mes - 1, dia);
  data.setDate(data.getDate() + quantidade);
  const pad = (numero) => String(numero).padStart(2, '0');
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`;
}

function partesIso(iso) {
  const [data, hora = ''] = String(iso || '').split('T');
  return { data, hora: hora.slice(0, 5) };
}

function rotuloDia(iso) {
  const [ano, mes, dia] = iso.split('-').map(Number);
  const data = new Date(ano, mes - 1, dia);
  const semana = DIAS_SEMANA[data.getDay()];
  return `${semana.slice(0, 3)} ${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`;
}

function rotuloQuando(iso) {
  const { data, hora } = partesIso(iso);
  return `${rotuloDia(data)} às ${hora}`;
}

function nomePessoa(convivente) {
  return convivente?.nome_social || convivente?.nome_completo || 'Acolhido';
}

function dataHoraBr(iso) {
  if (!iso) return '';
  const { data, hora } = partesIso(iso);
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano} ${hora}`;
}

const COLUNAS_LISTA = [
  { id: 'convivente_nome', rotulo: 'Convivente' },
  { id: 'familia_codigo', rotulo: 'Família' },
  { id: 'prontuario', rotulo: 'Prontuário' },
  { id: 'inicio', rotulo: 'Início' },
  { id: 'fim', rotulo: 'Fim' },
  { id: 'liberado_em', rotulo: 'Liberado em' },
];
const ROTULOS_LISTA = COLUNAS_LISTA.map((coluna) => coluna.rotulo);
const LIMITES_LISTA = [10, 20, 50];

function periodoMesAtual() {
  const hoje = hojeISO();
  const [ano, mes] = hoje.split('-').map(Number);
  const ultimo = new Date(ano, mes, 0).getDate();
  const pad = (numero) => String(numero).padStart(2, '0');
  return { inicio: `${ano}-${pad(mes)}-01`, fim: `${ano}-${pad(mes)}-${pad(ultimo)}` };
}

function dataBr(iso) {
  if (!iso) return '';
  const [ano, mes, dia] = String(iso).slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

function dentroDoPeriodo(item, inicio, fim) {
  const dia = String(item?.inicio || '').slice(0, 10);
  if (!dia) return false;
  if (inicio && dia < inicio) return false;
  if (fim && dia > fim) return false;
  return true;
}

function compararLista(a, b, coluna, direcao) {
  const va = a?.[coluna];
  const vb = b?.[coluna];
  const vazioA = va == null || va === '';
  const vazioB = vb == null || vb === '';
  if (vazioA && vazioB) return 0;
  if (vazioA) return 1;
  if (vazioB) return -1;
  const cmp = coluna === 'prontuario'
    ? Number(va) - Number(vb)
    : String(va).localeCompare(String(vb), 'pt-BR', { numeric: true, sensitivity: 'base' });
  return direcao === 'desc' ? -cmp : cmp;
}

function linhasRelatorio(lista, separado) {
  return (lista || []).map((item) => ({
    ...(separado ? { Máquina: item.maquina_rotulo || '' } : {}),
    Convivente: item.convivente_nome || '',
    Família: item.familia_codigo || '',
    Prontuário: item.prontuario ?? '',
    Início: dataHoraBr(item.inicio),
    Fim: dataHoraBr(item.fim),
    'Liberado em': dataHoraBr(item.liberado_em),
  }));
}

function GradeOmo({
  titulo,
  duracao,
  slots,
  salvando,
  sobreLivre,
  setSobreLivre,
  pedirAgendamento,
  pedirCancelamento,
  pedirMudanca,
  setErro,
  travada,
}) {
  const dias = useMemo(() => {
    const lista = [];
    slots.forEach((slot) => {
      const { data } = partesIso(slot.inicio);
      if (data && !lista.includes(data)) lista.push(data);
    });
    return lista;
  }, [slots]);
  const horarios = useMemo(() => {
    const lista = [];
    slots.forEach((slot) => {
      const { data, hora } = partesIso(slot.inicio);
      if (data === dias[0] && hora && !lista.includes(hora)) lista.push(hora);
    });
    return lista;
  }, [slots, dias]);
  const porChave = useMemo(() => {
    const mapa = {};
    slots.forEach((slot) => {
      mapa[slot.inicio] = slot;
    });
    return mapa;
  }, [slots]);

  return (
    <div className="mb-4 overflow-x-auto rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
      {titulo && <h2 className="mb-2 text-sm font-black text-slate-800">{titulo}</h2>}
      <table className="min-w-[760px] w-full border-separate border-spacing-1 text-left">
        <thead>
          <tr>
            <th className="px-2 py-2 text-xs font-bold text-slate-500">{duracao}</th>
            {dias.map((dia) => (
              <th key={dia} className="px-2 py-2 text-xs font-black capitalize text-slate-700">{rotuloDia(dia)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {horarios.map((hora) => (
            <tr key={hora}>
              <td className="whitespace-nowrap px-2 py-1 text-xs font-bold text-slate-600">{hora}</td>
              {dias.map((dia) => {
                const slot = porChave[`${dia}T${hora}`];
                const livre = !slot || slot.status === 'livre';
                const emUso = slot?.status === 'em_uso';
                const agendado = slot?.status === 'agendado';
                const marca = `${slot?.maquina || ''}|${slot?.inicio || ''}`;
                const emCima = sobreLivre === marca;
                const classe = livre
                  ? `bg-emerald-50 text-emerald-900 border-emerald-200 ${travada ? '' : 'hover:bg-emerald-100'} ${emCima ? 'ring-2 ring-emerald-500' : ''}`
                  : emUso
                    ? 'bg-blue-50 text-blue-900 border-blue-200'
                    : 'bg-amber-50 text-amber-950 border-amber-200 cursor-grab';
                const texto = livre
                  ? 'Livre'
                  : `${slot.familia_codigo ? `${slot.familia_codigo} · ` : ''}${slot.convivente_nome}`;
                return (
                  <td key={`${dia}-${hora}`} className="p-0">
                    <div
                      draggable={agendado && !travada}
                      onDragStart={(event) => {
                        if (!agendado || travada) return;
                        event.dataTransfer.setData('text/plain', JSON.stringify({
                          convivente_id: slot.convivente_id,
                          convivente_nome: slot.convivente_nome,
                          inicio: slot.inicio,
                        }));
                        event.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(event) => {
                        if (travada || !livre) return;
                        event.preventDefault();
                            setSobreLivre(marca);
                      }}
                          onDragLeave={() => setSobreLivre((atual) => (atual === marca ? '' : atual))}
                      onDrop={(event) => {
                        event.preventDefault();
                        setSobreLivre('');
                        if (travada || !livre) return;
                        try {
                          const origem = JSON.parse(event.dataTransfer.getData('text/plain') || '{}');
                          pedirMudanca(origem, slot.inicio);
                        } catch {
                          setErro('Não foi possível ler o horário arrastado.');
                        }
                      }}
                      onClick={() => {
                        if (travada) {
                          if (livre) setErro('A secagem entra sozinha no primeiro horário livre depois da lavagem.');
                          return;
                        }
                        if (livre && !salvando) pedirAgendamento(slot);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && livre && !salvando && !travada) pedirAgendamento(slot);
                      }}
                      role="button"
                      tabIndex={emUso ? -1 : 0}
                      className={`min-h-14 w-full rounded-lg border px-2 py-1 text-left text-[11px] font-semibold leading-snug ${emUso || travada ? 'cursor-default' : 'cursor-pointer'} ${classe}`}
                      title={travada ? 'A secagem acompanha a lavagem' : livre ? `Marcar ${hora}` : agendado ? 'Arraste para mudar ou cancele se a pessoa desistiu' : texto}
                    >
                      <span className="block">{emUso ? `Em uso · ${texto}` : texto}</span>
                      {agendado && (
                        <button
                          type="button"
                          disabled={salvando}
                          onClick={(event) => {
                            event.stopPropagation();
                            pedirCancelamento(slot);
                          }}
                          className="mt-1 text-[11px] font-black text-red-700 underline"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListaAgendamentos({
  titulo,
  vazio,
  lista,
  ordemInicial,
  dataInicio,
  dataFim,
  limite,
  onExportar,
  onImprimir,
  onCancelar,
  mostrarMaquina,
}) {
  const colunas = mostrarMaquina
    ? [{ id: 'maquina_rotulo', rotulo: 'Máquina' }, ...COLUNAS_LISTA]
    : COLUNAS_LISTA;
  const [ordem, setOrdem] = useState(ordemInicial);
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    setPagina(1);
  }, [dataInicio, dataFim, limite, lista]);

  const ordenada = useMemo(() => {
    const filtrada = (lista || []).filter((item) => dentroDoPeriodo(item, dataInicio, dataFim));
    return [...filtrada].sort((a, b) => compararLista(a, b, ordem.coluna, ordem.direcao));
  }, [dataFim, dataInicio, lista, ordem]);

  const totalPaginas = Math.max(1, Math.ceil(ordenada.length / limite));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const indiceInicial = (paginaSegura - 1) * limite;
  const paginaAtual = ordenada.slice(indiceInicial, indiceInicial + limite);

  const alternarOrdenacao = (coluna) => {
    setOrdem((atual) => (
      atual.coluna === coluna
        ? { coluna, direcao: atual.direcao === 'asc' ? 'desc' : 'asc' }
        : { coluna, direcao: 'asc' }
    ));
    setPagina(1);
  };

  return (
    <section className="mt-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-black text-slate-900">{titulo}</h2>
        <div className="flex gap-2">
          <ReportActionButton action="export" onClick={() => onExportar(ordenada)} disabled={!ordenada.length}>Exportar</ReportActionButton>
          <ReportActionButton action="print" onClick={() => onImprimir(ordenada)} disabled={!ordenada.length}>Imprimir</ReportActionButton>
        </div>
      </div>
      {!ordenada.length && <p className="text-sm text-slate-500">{lista.length ? 'Nenhum registro neste período.' : vazio}</p>}
      {!!ordenada.length && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-bold uppercase text-slate-500">
                  {colunas.map((coluna) => {
                    const ativo = ordem.coluna === coluna.id;
                    return (
                      <th key={coluna.id} className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => alternarOrdenacao(coluna.id)}
                          className={`inline-flex items-center gap-1 font-bold uppercase tracking-wide ${ativo ? 'text-slate-800' : 'text-slate-500'}`}
                          title={`Ordenar por ${coluna.rotulo}`}
                        >
                          {coluna.rotulo}
                          {ativo ? (
                            ordem.direcao === 'asc'
                              ? <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                              : <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5 text-slate-300" aria-hidden />
                          )}
                        </button>
                      </th>
                    );
                  })}
                  {onCancelar && <th className="px-2 py-2">Ação</th>}
                </tr>
              </thead>
              <tbody>
                {paginaAtual.map((item) => (
                  <tr key={item.id} className="border-b border-slate-50">
                    {mostrarMaquina && <td className="px-2 py-2">{item.maquina_rotulo || '—'}</td>}
                    <td className="px-2 py-2 font-semibold text-slate-800">{item.convivente_nome}</td>
                    <td className="px-2 py-2">{item.familia_codigo || '—'}</td>
                    <td className="px-2 py-2">{item.prontuario ?? '—'}</td>
                    <td className="px-2 py-2">{dataHoraBr(item.inicio)}</td>
                    <td className="px-2 py-2">{dataHoraBr(item.fim)}</td>
                    <td className="px-2 py-2">{dataHoraBr(item.liberado_em) || '—'}</td>
                    {onCancelar && (
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => onCancelar(item)}
                          className="text-xs font-bold text-red-700"
                        >
                          Cancelar
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-semibold text-slate-500">
              Exibindo {indiceInicial + 1} a {Math.min(indiceInicial + limite, ordenada.length)} de {ordenada.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPagina(paginaSegura - 1)}
                disabled={paginaSegura <= 1}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700">
                Página {paginaSegura} de {totalPaginas}
              </span>
              <button
                type="button"
                onClick={() => setPagina(paginaSegura + 1)}
                disabled={paginaSegura >= totalPaginas}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export default function PariLavanderia() {
  const [inicioFaixa, setInicioFaixa] = useState(hojeISO);
  const [agenda, setAgenda] = useState([]);
  const [modelo, setModelo] = useState('conjunto');
  const [confirmados, setConfirmados] = useState([]);
  const [realizados, setRealizados] = useState([]);
  const [identidadeRelatorio, setIdentidadeRelatorio] = useState(null);
  const [conviventes, setConviventes] = useState([]);
  const [busca, setBusca] = useState('');
  const [escolhido, setEscolhido] = useState(null);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [confirmacao, setConfirmacao] = useState(null);
  const [sobreLivre, setSobreLivre] = useState('');
  const periodoInicial = useMemo(() => periodoMesAtual(), []);
  const [periodoInicio, setPeriodoInicio] = useState(periodoInicial.inicio);
  const [periodoFim, setPeriodoFim] = useState(periodoInicial.fim);
  const [limiteLista, setLimiteLista] = useState(20);
  const [verConfirmados, setVerConfirmados] = useState(true);
  const [verRealizados, setVerRealizados] = useState(true);

  const carregar = useCallback(async (data) => {
    const [lista, registros, resumo] = await Promise.all([
      api.get('/api/pari/lavanderia', { params: { data, dias: 7 } }),
      api.get('/api/pari/lavanderia/registros'),
      api.get('/api/conviventes/resumo', { params: { status: 'Ativo' } }),
    ]);
    setAgenda(lista.data?.agenda || []);
    setModelo(lista.data?.modelo || 'conjunto');
    setConfirmados(registros.data?.confirmados || []);
    setRealizados(registros.data?.realizados || []);
    setConviventes(resumo.data || []);
  }, []);

  useEffect(() => {
    carregar(inicioFaixa).catch((error) => setErro(detalheErro(error, 'Não foi possível carregar a agenda.')));
  }, [carregar, inicioFaixa]);

  useEffect(() => {
    buscarIdentidadeRelatorios().then(setIdentidadeRelatorio);
  }, []);

  const sugeridos = useMemo(
    () => filtrarOrdenarConviventesPorBusca(conviventes, busca).slice(0, 6),
    [conviventes, busca],
  );

  const daMaquina = agenda;

  const dias = useMemo(() => {
    const lista = [];
    daMaquina.forEach((slot) => {
      const { data } = partesIso(slot.inicio);
      if (data && !lista.includes(data)) lista.push(data);
    });
    return lista;
  }, [daMaquina]);

  const separado = modelo === 'separado';

  const reservar = useCallback(async (convivente, inicio) => {
    setSalvando(true);
    setErro('');
    try {
      const resposta = await api.post('/api/pari/lavanderia/leitura', {
        convivente_id: convivente.id,
        maquina: 'conjunto',
        inicio: inicio || null,
      });
      setMensagem(`${nomePessoa(convivente)}: ${resposta.data.mensagem}`);
      setEscolhido(null);
      setConfirmacao(null);
      await carregar(inicioFaixa);
    } catch (error) {
      setMensagem('');
      setErro(detalheErro(error, 'Não foi possível marcar o horário.'));
    } finally {
      setSalvando(false);
    }
  }, [carregar, inicioFaixa]);

  const pedirAgendamento = useCallback((slot) => {
    if (!escolhido) {
      setErro('Escolha a pessoa antes de marcar o horário.');
      return;
    }
    const jaTem = daMaquina.find((item) => item.convivente_id === escolhido.id && item.status === 'agendado');
    if (jaTem) {
      setErro('Esta pessoa já tem horário. Arraste o nome até outro horário livre ou cancele o agendamento.');
      return;
    }
    setErro('');
    setConfirmacao({
      tipo: 'agendar',
      convivente: escolhido,
      inicio: slot.inicio,
      titulo: 'Confirmar agendamento',
      mensagem: modelo === 'separado'
        ? `Marcar a lavagem de ${nomePessoa(escolhido)} em ${rotuloQuando(slot.inicio)}? A secagem entra no primeiro horário livre depois dessa lavagem.`
        : `Marcar ${nomePessoa(escolhido)} em ${rotuloQuando(slot.inicio)}?`,
    });
  }, [daMaquina, escolhido, modelo]);

  const cancelar = useCallback(async (agendaId) => {
    setSalvando(true);
    setErro('');
    try {
      const resposta = await api.delete(`/api/pari/lavanderia/${agendaId}`);
      setMensagem(resposta.data?.mensagem || 'Horário cancelado. A vaga voltou a ficar livre.');
      setConfirmacao(null);
      await carregar(inicioFaixa);
    } catch (error) {
      setMensagem('');
      setErro(detalheErro(error, 'Não foi possível cancelar o horário.'));
    } finally {
      setSalvando(false);
    }
  }, [carregar, inicioFaixa]);

  const pedirCancelamento = useCallback((slot) => {
    if (!slot?.id) return;
    setErro('');
    setConfirmacao({
      tipo: 'cancelar',
      id: slot.id,
      titulo: 'Cancelar agendamento',
      mensagem: modelo === 'separado'
        ? `Cancelar ${slot.convivente_nome} em ${rotuloQuando(slot.inicio)}? A lavagem e a secagem desse par voltam a ficar livres.`
        : `Cancelar ${slot.convivente_nome} em ${rotuloQuando(slot.inicio)}? O horário volta a ficar livre.`,
    });
  }, [modelo]);

  const pedirMudanca = useCallback((origem, destinoInicio) => {
    if (!origem?.convivente_id || !destinoInicio || origem.inicio === destinoInicio) return;
    setErro('');
    setConfirmacao({
      tipo: 'mudar',
      convivente: { id: origem.convivente_id, nome_completo: origem.convivente_nome },
      inicio: destinoInicio,
      titulo: 'Mudar horário',
      mensagem: modelo === 'separado'
        ? `Mudar a lavagem de ${origem.convivente_nome} de ${rotuloQuando(origem.inicio)} para ${rotuloQuando(destinoInicio)}? A secagem é recalculada.`
        : `Deseja mesmo mudar ${origem.convivente_nome} de ${rotuloQuando(origem.inicio)} para ${rotuloQuando(destinoInicio)}?`,
    });
  }, [modelo]);

  const lerCodigo = useCallback((lido) => {
    const convivente = encontrarConviventePorCodigo(conviventes, lido);
    if (!convivente) {
      setErro('Carteirinha não encontrada entre os acolhidos ativos.');
      return;
    }
    setBusca('');
    setErro('');
    setEscolhido(convivente);
    setMensagem(`${nomePessoa(convivente)} selecionada. Clique num horário livre e confirme com OK.`);
  }, [conviventes]);

  useLeitorUsbGlobal({ ativo: true, onCodigoLido: lerCodigo });

  const exportarLista = (titulo, lista, arquivo) => {
    exportarRelatorioXlsx({
      nomeArquivo: arquivo,
      titulo,
      filtros: {
        De: dataBr(periodoInicio) || '—',
        Até: dataBr(periodoFim) || '—',
        Total: lista.length,
      },
      colunas: separado ? ['Máquina', ...ROTULOS_LISTA] : ROTULOS_LISTA,
      dados: linhasRelatorio(lista, separado),
    });
  };

  const imprimirLista = async (titulo, lista) => {
    const logoRelatorioDataUrl = await obterLogoRelatorioDataUrl(identidadeRelatorio);
    imprimirRelatorio({
      titulo,
      subtitulo: `Período: ${dataBr(periodoInicio) || '—'} a ${dataBr(periodoFim) || '—'} · ${lista.length} registro(s)`,
      colunas: separado ? ['Máquina', ...ROTULOS_LISTA] : ROTULOS_LISTA,
      dados: linhasRelatorio(lista, separado),
      identidade: {
        ...(identidadeRelatorio || {}),
        logo_src: logoRelatorioDataUrl,
      },
    });
  };

  const fimFaixa = dias.at(-1) || somarDias(inicioFaixa, 6);
  const hoje = hojeISO();

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          eyebrow="Rotina Diária"
          title="Lavanderia OMO"
          subtitle={separado
            ? 'Lavagem e secagem são grades de 45 minutos, das 7h às 12h e das 14h às 18h. Clique na lavagem; a secagem entra no primeiro horário livre depois. Cancelar um dos dois cancela o par.'
            : 'Cada horário de 1h30 vale para lavar e secar juntas. Verde está livre, âmbar está ocupado. Cancele o agendamento se a pessoa desistir: a vaga volta a ficar livre.'}
          icon="L"
        />

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <PremiumButton type="button" variant="secondary" disabled={inicioFaixa <= hoje} onClick={() => setInicioFaixa(somarDias(inicioFaixa, -7))}>
            Semana anterior
          </PremiumButton>
          <span className="px-2 text-sm font-bold text-slate-700">
            {rotuloDia(inicioFaixa)} a {rotuloDia(fimFaixa)}
          </span>
          <PremiumButton type="button" variant="secondary" onClick={() => setInicioFaixa(somarDias(inicioFaixa, 7))}>
            Próxima semana
          </PremiumButton>
        </div>

        <div className="mb-4 max-w-xl">
          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Busque a pessoa ou leia o QR Code"
            className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
          />
          {busca.trim() && (
            <div className="mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white">
              {sugeridos.map((pessoa) => (
                <button
                  key={pessoa.id}
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                  onClick={() => {
                    setEscolhido(pessoa);
                    setBusca('');
                    setErro('');
                  }}
                >
                  {nomePessoa(pessoa)}
                  {pessoa.familia_codigo ? ` · ${pessoa.familia_codigo}` : ''}
                </button>
              ))}
              {!sugeridos.length && <p className="px-3 py-2 text-sm text-slate-500">Nenhuma pessoa ativa com esse nome.</p>}
            </div>
          )}
          {escolhido && (
            <p className="mt-2 text-sm font-semibold text-slate-700">
              {nomePessoa(escolhido)} selecionada. Clique num horário verde e confirme com OK.
            </p>
          )}
        </div>

        {mensagem && <p className="mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{mensagem}</p>}
        {erro && <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{erro}</p>}

        {separado ? (
          <>
            <GradeOmo
              titulo="Lavagem"
              duracao="45 min"
              slots={agenda.filter((slot) => slot.maquina === 'lavar')}
              salvando={salvando}
              sobreLivre={sobreLivre}
              setSobreLivre={setSobreLivre}
              pedirAgendamento={pedirAgendamento}
              pedirCancelamento={pedirCancelamento}
              pedirMudanca={pedirMudanca}
              setErro={setErro}
            />
            <GradeOmo
              titulo="Secagem"
              duracao="45 min"
              slots={agenda.filter((slot) => slot.maquina === 'secar')}
              salvando={salvando}
              sobreLivre={sobreLivre}
              setSobreLivre={setSobreLivre}
              pedirAgendamento={pedirAgendamento}
              pedirCancelamento={pedirCancelamento}
              pedirMudanca={pedirMudanca}
              setErro={setErro}
              travada
            />
          </>
        ) : (
          <GradeOmo
            duracao="1h30"
            slots={agenda}
            salvando={salvando}
            sobreLivre={sobreLivre}
            setSobreLivre={setSobreLivre}
            pedirAgendamento={pedirAgendamento}
            pedirCancelamento={pedirCancelamento}
            pedirMudanca={pedirMudanca}
            setErro={setErro}
          />
        )}
        <section className="mt-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-bold text-slate-600">
              De
              <input
                type="date"
                value={periodoInicio}
                onChange={(event) => setPeriodoInicio(event.target.value)}
                className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800"
              />
            </label>
            <label className="text-xs font-bold text-slate-600">
              Até
              <input
                type="date"
                value={periodoFim}
                onChange={(event) => setPeriodoFim(event.target.value)}
                className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800"
              />
            </label>
            <label className="text-xs font-bold text-slate-600">
              Por página
              <select
                value={limiteLista}
                onChange={(event) => setLimiteLista(Number(event.target.value))}
                className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800"
              >
                {LIMITES_LISTA.map((limite) => (
                  <option key={limite} value={limite}>{limite}</option>
                ))}
              </select>
            </label>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                aria-pressed={verConfirmados}
                onClick={() => setVerConfirmados((atual) => !atual)}
                className={`rounded-xl border px-3 py-2 text-xs font-bold ${verConfirmados ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-500'}`}
              >
                Confirmados
              </button>
              <button
                type="button"
                aria-pressed={verRealizados}
                onClick={() => setVerRealizados((atual) => !atual)}
                className={`rounded-xl border px-3 py-2 text-xs font-bold ${verRealizados ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-500'}`}
              >
                Realizados
              </button>
            </div>
          </div>
          {!verConfirmados && !verRealizados && (
            <p className="mt-3 text-sm text-slate-500">As duas listas estão ocultas. Ative Confirmados ou Realizados para vê-las.</p>
          )}
        </section>
        {verConfirmados && (
          <ListaAgendamentos
            titulo="Agendamentos confirmados"
            vazio="Nenhum horário confirmado."
            lista={confirmados}
            ordemInicial={{ coluna: 'inicio', direcao: 'asc' }}
            dataInicio={periodoInicio}
            dataFim={periodoFim}
            limite={limiteLista}
            onExportar={(lista) => exportarLista('Agendamentos confirmados — Lavanderia OMO', lista, `lavanderia-confirmados-${hojeISO()}`)}
            onImprimir={(lista) => imprimirLista('Agendamentos confirmados — Lavanderia OMO', lista)}
            onCancelar={pedirCancelamento}
            mostrarMaquina={separado}
          />
        )}
        {verRealizados && (
          <ListaAgendamentos
            titulo="Agendamentos realizados"
            vazio="Nenhum uso realizado."
            lista={realizados}
            ordemInicial={{ coluna: 'liberado_em', direcao: 'desc' }}
            dataInicio={periodoInicio}
            dataFim={periodoFim}
            limite={limiteLista}
            onExportar={(lista) => exportarLista('Agendamentos realizados — Lavanderia OMO', lista, `lavanderia-realizados-${hojeISO()}`)}
            onImprimir={(lista) => imprimirLista('Agendamentos realizados — Lavanderia OMO', lista)}
            mostrarMaquina={separado}
          />
        )}
        {confirmacao && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
              <h3 className="text-lg font-bold text-slate-900">{confirmacao.titulo}</h3>
              <p className="mt-2 text-sm text-slate-700">{confirmacao.mensagem}</p>
              <div className="mt-5 flex justify-end gap-2">
                <PremiumButton type="button" variant="secondary" disabled={salvando} onClick={() => setConfirmacao(null)}>
                  Voltar
                </PremiumButton>
                <PremiumButton
                  type="button"
                  disabled={salvando}
                  onClick={() => {
                    if (confirmacao.tipo === 'cancelar') cancelar(confirmacao.id);
                    else reservar(confirmacao.convivente, confirmacao.inicio);
                  }}
                >
                  {confirmacao.tipo === 'cancelar' ? 'Liberar horário' : 'OK'}
                </PremiumButton>
              </div>
            </div>
          </div>
        )}
      </MainShell>
    </AppShell>
  );
}
