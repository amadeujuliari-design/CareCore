import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  FolderOpen,
  Loader2,
  MonitorPlay,
  Plus,
  Square,
  Trash2,
  XCircle,
} from 'lucide-react';

import FinanceProShell from './FinanceProShell';
import api from '../services/api';
import {
  PageHeader,
  PremiumButton,
  PremiumCard,
} from '../components/PremiumUI';

const inputClassName =
  'min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand';

function Campo({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black uppercase tracking-wide text-gray-600">
        {label}
      </span>
      {children}
    </label>
  );
}

const PASTA_DESTINO_PADRAO =
  'C:\\Users\\AClaudio\\OneDrive - Associação Evangélica Beneficente\\Documentos\\1- NFS\\Confirmacao de NFs Emitidas em 2026';

const STATUS_LABEL = {
  idle: 'Aguardando',
  preparando: 'Preparando',
  aguardando_login: 'Aguardando login',
  executando: 'Executando',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
  erro: 'Erro',
};

const MESES = [
  { valor: 1, rotulo: 'Janeiro' },
  { valor: 2, rotulo: 'Fevereiro' },
  { valor: 3, rotulo: 'Março' },
  { valor: 4, rotulo: 'Abril' },
  { valor: 5, rotulo: 'Maio' },
  { valor: 6, rotulo: 'Junho' },
  { valor: 7, rotulo: 'Julho' },
  { valor: 8, rotulo: 'Agosto' },
  { valor: 9, rotulo: 'Setembro' },
  { valor: 10, rotulo: 'Outubro' },
  { valor: 11, rotulo: 'Novembro' },
  { valor: 12, rotulo: 'Dezembro' },
];

function FinanceNotasConferenciaConteudo() {
  const [pastasOrigem, setPastasOrigem] = useState(['']);
  const [pastaDestino, setPastaDestino] = useState(PASTA_DESTINO_PADRAO);
  const [ano, setAno] = useState(2026);
  const [mesInicio, setMesInicio] = useState(1);
  const [mesFim, setMesFim] = useState(12);
  const [ritmo, setRitmo] = useState('lento');
  const [status, setStatus] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [escolhendoPasta, setEscolhendoPasta] = useState(false);

  const exibirSucesso = (mensagem) => {
    setSucesso(mensagem);
    window.setTimeout(() => setSucesso(''), 5000);
  };

  const escolherPastaExplorer = async (titulo, aoSelecionar) => {
    setEscolhendoPasta(true);
    setErro('');
    try {
      const { data } = await api.post('/api/financeiro/nfse-conferencia/pastas/escolher', {
        titulo,
      });
      if (!data.cancelado && data.caminho) {
        aoSelecionar(data.caminho);
      }
    } catch (e) {
      setErro(
        e?.response?.data?.detail
          || 'Não foi possível abrir o Explorer. Use o ambiente local no Windows.',
      );
    } finally {
      setEscolhendoPasta(false);
    }
  };

  const escolherPastaOrigem = (idx) => {
    escolherPastaExplorer('Pasta com PDFs das NFS-e', (caminho) => {
      alterarPasta(idx, caminho);
    });
  };

  const adicionarPastaViaExplorer = () => {
    escolherPastaExplorer('Pasta com PDFs das NFS-e', (caminho) => {
      setPastasOrigem((prev) => {
        const existentes = prev.filter((p) => p.trim());
        if (existentes.includes(caminho)) {
          return prev;
        }
        if (prev.length === 1 && !prev[0].trim()) {
          return [caminho];
        }
        return [...existentes, caminho];
      });
    });
  };

  const escolherPastaDestino = () => {
    escolherPastaExplorer(
      'Pasta para salvar confirmações e prints',
      (caminho) => setPastaDestino(caminho),
    );
  };

  const carregarConfig = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const { data } = await api.get('/api/financeiro/nfse-conferencia/config');
      setPastasOrigem(
        data.pastas_origem?.length ? data.pastas_origem : [''],
      );
      setPastaDestino(data.pasta_destino || PASTA_DESTINO_PADRAO);
      setAno(data.ano || 2026);
      setMesInicio(data.mes_inicio || 1);
      setMesFim(data.mes_fim || 12);
      setRitmo(data.ritmo || 'lento');
    } catch (e) {
      setErro(e?.response?.data?.detail || 'Não foi possível carregar a configuração.');
    } finally {
      setCarregando(false);
    }
  }, []);

  const pollStatus = useCallback(async () => {
    try {
      const { data } = await api.get('/api/financeiro/nfse-conferencia/status');
      setStatus(data);
    } catch {
      /* mantém último status */
    }
  }, []);

  useEffect(() => {
    carregarConfig();
  }, [carregarConfig]);

  useEffect(() => {
    pollStatus();
    const id = window.setInterval(pollStatus, 2000);
    return () => window.clearInterval(id);
  }, [pollStatus]);

  const statusAtual = status?.status || 'idle';
  const roboRodando = ['preparando', 'executando'].includes(statusAtual);
  const aguardandoLogin = statusAtual === 'aguardando_login';
  const podeIniciarConferencia =
    aguardandoLogin || (status?.browser_aberto && !roboRodando);
  const bloquearPastas = escolhendoPasta || roboRodando;

  const salvarConfig = async () => {
    setSalvando(true);
    setErro('');
    setSucesso('');
    try {
      const { data } = await api.put('/api/financeiro/nfse-conferencia/config', {
        pastas_origem: pastasOrigem.filter((p) => p.trim()),
        pasta_destino: pastaDestino.trim(),
        ano: Number(ano),
        mes_inicio: Number(mesInicio),
        mes_fim: Number(mesFim),
        ritmo,
      });
      if (data.pastas_origem?.length) {
        setPastasOrigem(data.pastas_origem);
      }
      if (data.pasta_destino) {
        setPastaDestino(data.pasta_destino);
      }
      exibirSucesso('Configuração salva com sucesso.');
      return true;
    } catch (e) {
      setErro(e?.response?.data?.detail || 'Erro ao salvar configuração.');
      return false;
    } finally {
      setSalvando(false);
    }
  };

  const abrirNavegador = async () => {
    setErro('');
    setSucesso('');
    const salvou = await salvarConfig();
    if (!salvou) {
      return;
    }
    try {
      await api.post('/api/financeiro/nfse-conferencia/navegador/abrir');
      await pollStatus();
      exibirSucesso('Navegador aberto — faça login no portal NFS-e.');
    } catch (e) {
      setErro(e?.response?.data?.detail || 'Erro ao abrir navegador.');
      await pollStatus();
    }
  };

  const iniciar = async () => {
    setErro('');
    try {
      await salvarConfig();
      await api.post('/api/financeiro/nfse-conferencia/iniciar');
      await pollStatus();
    } catch (e) {
      setErro(e?.response?.data?.detail || 'Erro ao iniciar conferência.');
    }
  };

  const parar = async () => {
    try {
      await api.post('/api/financeiro/nfse-conferencia/parar');
      await pollStatus();
    } catch (e) {
      setErro(e?.response?.data?.detail || 'Erro ao parar.');
    }
  };

  const resumo = status?.resumo || {};
  const logs = useMemo(() => [...(status?.log || [])].reverse(), [status?.log]);

  const adicionarPasta = () => setPastasOrigem((prev) => [...prev, '']);
  const removerPasta = (idx) => {
    setPastasOrigem((prev) => prev.filter((_, i) => i !== idx));
  };
  const alterarPasta = (idx, valor) => {
    setPastasOrigem((prev) => prev.map((p, i) => (i === idx ? valor : p)));
  };

  if (carregando) {
    return (
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
        <Loader2 className="animate-spin" size={18} />
        Carregando…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Conferência NFS-e emitidas"
        eyebrow="Notas Fiscais"
        subtitle="Compare as NFS-e do portal nacional com PDFs locais. Faça login manualmente — sem certificado digital."
      />

      <PremiumCard className="space-y-4">
        <p className="text-sm text-slate-600">
          1) Configure as pastas → 2) Abra o navegador e faça login no{' '}
          <strong>nfse.gov.br</strong> → 3) Clique em <strong>Iniciar conferência</strong>.
          O robô percorre o período escolhido (mês a mês no portal), lê a{' '}
          <strong>chave de acesso</strong> de cada nota e confere nos PDFs locais.
        </p>

        {!status?.playwright_instalado && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Playwright não detectado no backend. Rode:
            <code className="ml-1 rounded bg-white px-1">pip install playwright pypdf</code> e{' '}
            <code className="rounded bg-white px-1">playwright install chromium</code>
          </div>
        )}

        {erro && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {erro}
          </div>
        )}

        {sucesso && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
            {sucesso}
          </div>
        )}

        {aguardandoLogin && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            Login detectado no portal? Clique em <strong>Iniciar conferência</strong> para o
            robô começar a checar as notas.
          </div>
        )}

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-sm font-bold text-slate-800">Pastas de origem (PDFs)</label>
            <div className="flex flex-wrap gap-2">
              <PremiumButton
                type="button"
                variant="secondary"
                onClick={adicionarPastaViaExplorer}
                disabled={bloquearPastas}
              >
                {escolhendoPasta ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <FolderOpen size={16} />
                )}
                Escolher no Explorer
              </PremiumButton>
              <PremiumButton type="button" variant="secondary" onClick={adicionarPasta}>
                <Plus size={16} />
                Linha manual
              </PremiumButton>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Use <strong>Escolher no Explorer</strong> para abrir a janela de pastas do Windows.
            Também pode digitar o caminho manualmente.
          </p>

          {pastasOrigem.map((pasta, idx) => (
            <div key={`pasta-${idx}`} className="flex gap-2">
              <input
                type="text"
                value={pasta}
                onChange={(e) => alterarPasta(idx, e.target.value)}
                placeholder="C:\...\pasta com PDFs das NFs"
                className={inputClassName}
              />
              <PremiumButton
                type="button"
                variant="secondary"
                onClick={() => escolherPastaOrigem(idx)}
                disabled={bloquearPastas}
                title="Escolher pasta no Explorer"
              >
                <FolderOpen size={16} />
              </PremiumButton>
              {pastasOrigem.length > 1 && (
                <PremiumButton
                  type="button"
                  variant="ghost"
                  onClick={() => removerPasta(idx)}
                  title="Remover pasta"
                >
                  <Trash2 size={16} />
                </PremiumButton>
              )}
            </div>
          ))}
        </div>

        <Campo label="Pasta de destino (confirmações e prints)">
          <div className="flex gap-2">
            <input
              type="text"
              value={pastaDestino}
              onChange={(e) => setPastaDestino(e.target.value)}
              placeholder={PASTA_DESTINO_PADRAO}
              className={inputClassName}
            />
            <PremiumButton
              type="button"
              variant="secondary"
              onClick={escolherPastaDestino}
              disabled={bloquearPastas}
              title="Escolher pasta no Explorer"
            >
              <FolderOpen size={16} />
            </PremiumButton>
          </div>
        </Campo>

        <Campo label="Ano de conferência">
          <select
            value={String(ano)}
            onChange={(e) => setAno(Number(e.target.value))}
            className={inputClassName}
            disabled={roboRodando}
          >
            <option value="2025">2025</option>
            <option value="2026">2026</option>
          </select>
        </Campo>

        <div className="grid gap-3 md:grid-cols-2">
          <Campo label="Mês inicial">
            <select
              value={String(mesInicio)}
              onChange={(e) => setMesInicio(Number(e.target.value))}
              className={inputClassName}
              disabled={roboRodando}
            >
              {MESES.map((m) => (
                <option key={`mi-${m.valor}`} value={String(m.valor)}>
                  {m.rotulo}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Mês final">
            <select
              value={String(mesFim)}
              onChange={(e) => setMesFim(Number(e.target.value))}
              className={inputClassName}
              disabled={roboRodando}
            >
              {MESES.map((m) => (
                <option key={`mf-${m.valor}`} value={String(m.valor)}>
                  {m.rotulo}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        <p className="text-xs text-slate-500">
          Período: <strong>{MESES.find((m) => m.valor === mesInicio)?.rotulo}</strong>
          {' a '}
          <strong>{MESES.find((m) => m.valor === mesFim)?.rotulo}</strong>
          {' de '}
          <strong>{ano}</strong>
          {mesInicio === 1 && mesFim === 12 ? ' (ano inteiro)' : ''}
          {mesInicio === mesFim ? ' (um mês)' : ''}
          . Para testar cancelada: use <strong>Março/2026</strong> (mês inicial e final = Março).
        </p>

        <Campo label="Ritmo de navegação (anti-bloqueio)">
          <select
            value={ritmo}
            onChange={(e) => setRitmo(e.target.value)}
            className={inputClassName}
            disabled={roboRodando}
          >
            <option value="normal">Normal — 3–6 s entre notas</option>
            <option value="lento">Lento (recomendado) — 6–12 s entre notas</option>
            <option value="muito_lento">Muito lento — 12–20 s entre notas</option>
          </select>
          <p className="mt-1 text-xs text-slate-500">
            O robô faz pausas aleatórias e pausas longas a cada lote de notas para imitar uso
            humano. Se o portal exibir «muitas requisições», ele aguarda e tenta de novo.
            Após bloqueio, prefira <strong>Muito lento</strong>.
          </p>
        </Campo>

        <div className="flex flex-wrap gap-2">
          <PremiumButton type="button" onClick={salvarConfig} disabled={salvando}>
            {salvando ? <Loader2 className="animate-spin" size={16} /> : <FolderOpen size={16} />}
            Salvar configuração
          </PremiumButton>
          <PremiumButton
            type="button"
            variant="secondary"
            onClick={abrirNavegador}
            disabled={roboRodando || aguardandoLogin}
          >
            <MonitorPlay size={16} />
            Abrir navegador NFS-e
          </PremiumButton>
          <PremiumButton type="button" onClick={iniciar} disabled={!podeIniciarConferencia || roboRodando}>
            Iniciar conferência
          </PremiumButton>
          <PremiumButton type="button" variant="danger" onClick={parar} disabled={!roboRodando}>
            <Square size={16} />
            Parar
          </PremiumButton>
        </div>
      </PremiumCard>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <PremiumCard className="text-center">
          <p className="text-xs font-bold uppercase text-slate-500">Status</p>
          <p className="mt-1 text-lg font-black text-emerald-800">
            {STATUS_LABEL[statusAtual] || statusAtual || '—'}
          </p>
        </PremiumCard>
        <PremiumCard className="text-center">
          <p className="text-xs font-bold uppercase text-slate-500">Site (lidas)</p>
          <p className="mt-1 text-2xl font-black text-slate-800">{resumo.registros_site || 0}</p>
        </PremiumCard>
        <PremiumCard className="text-center">
          <p className="text-xs font-bold uppercase text-slate-500">OK</p>
          <p className="mt-1 flex items-center justify-center gap-1 text-2xl font-black text-emerald-700">
            <CheckCircle2 size={22} />
            {resumo.ok || 0}
          </p>
        </PremiumCard>
        <PremiumCard className="text-center">
          <p className="text-xs font-bold uppercase text-slate-500">Canceladas</p>
          <p className="mt-1 flex items-center justify-center gap-1 text-2xl font-black text-red-700">
            <XCircle size={22} />
            {(resumo.cancelada || 0) + (resumo.cancelada_sem_pdf || 0)}
          </p>
          <p className="mt-1 text-[10px] font-semibold text-slate-500">
            c/ PDF: {resumo.cancelada || 0} · s/ PDF: {resumo.cancelada_sem_pdf || 0}
          </p>
        </PremiumCard>
        <PremiumCard className="text-center">
          <p className="text-xs font-bold uppercase text-slate-500">Sem PDF</p>
          <p className="mt-1 text-2xl font-black text-amber-700">{resumo.nao_encontrada || 0}</p>
          <p className="mt-1 text-[10px] font-semibold text-slate-500">autorizadas no portal</p>
        </PremiumCard>
        <PremiumCard className="text-center">
          <p className="text-xs font-bold uppercase text-slate-500">PDF s/ portal</p>
          <p className="mt-1 text-2xl font-black text-orange-700">{resumo.pdf_sem_portal || 0}</p>
        </PremiumCard>
      </div>

      {(status?.relatorio?.relatorio_xlsx || status?.relatorio?.relatorio_csv) && (
        <PremiumCard className="text-sm text-slate-700">
          <p className="font-bold text-slate-800">Relatório Excel</p>
          <p className="mt-1 break-all font-mono text-xs">
            {status.relatorio.relatorio_xlsx || status.relatorio.relatorio_csv}
          </p>
          {status.relatorio.pdfs_sem_portal?.length > 0 && (
            <div className="mt-3">
              <p className="font-semibold">PDFs nas pastas não vistos no site:</p>
              <ul className="mt-1 list-inside list-disc text-xs">
                {status.relatorio.pdfs_sem_portal.map((item) => (
                  <li key={item.chave}>{item.arquivo}</li>
                ))}
              </ul>
            </div>
          )}
        </PremiumCard>
      )}

      <PremiumCard>
        <p className="mb-2 text-sm font-bold text-slate-800">Log</p>
        <p className="mb-3 text-sm text-slate-600">{status?.mensagem}</p>
        <div className="max-h-72 overflow-y-auto rounded-xl bg-slate-950 p-3 font-mono text-xs text-emerald-200">
          {logs.length === 0 ? (
            <p className="text-slate-500">Nenhuma mensagem ainda.</p>
          ) : (
            logs.map((linha, idx) => (
              <p key={`log-${idx}`} className="border-b border-slate-800 py-1 last:border-0">
                {linha}
              </p>
            ))
          )}
        </div>
      </PremiumCard>
    </div>
  );
}

export default function FinanceNotasConferencia() {
  return (
    <FinanceProShell>
      <FinanceNotasConferenciaConteudo />
    </FinanceProShell>
  );
}
