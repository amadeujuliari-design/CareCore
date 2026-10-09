import { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from './Sidebar';
import {
  AppShell,
  MainShell,
  PageHeader,
  ScrollArea,
} from './components/PremiumUI';
import api from './services/api';

function competenciaAtual() {
  const hoje = new Date();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  return `${hoje.getFullYear()}-${mes}`;
}

function mensagemApi(erro) {
  const detalhe = erro?.response?.data?.detail;
  if (typeof detalhe === 'string' && detalhe.trim()) return detalhe;
  return 'Não foi possível carregar a avaliação deste mês.';
}

export default function RelatorioAvaliacaoMensal() {
  const [competencia, setCompetencia] = useState(competenciaAtual);
  const [relatorio, setRelatorio] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [aberta, setAberta] = useState(null);
  const [linkCopiado, setLinkCopiado] = useState(false);
  const linkPublico = useMemo(() => `${window.location.origin}/avaliacao`, []);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const resposta = await api.get('/api/avaliacao-mensal/relatorio', {
        params: { competencia },
      });
      setRelatorio(resposta.data);
      setAberta(null);
    } catch (falha) {
      setRelatorio(null);
      setErro(mensagemApi(falha));
    } finally {
      setCarregando(false);
    }
  }, [competencia]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(linkPublico);
      setLinkCopiado(true);
    } catch {
      setLinkCopiado(false);
    }
  }

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          eyebrow="Relatórios"
          title="Avaliação mensal"
          subtitle="Uma resposta por morador em cada mês"
        />
        <ScrollArea>
          <div className="mx-auto max-w-5xl space-y-5 p-5">
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-end sm:justify-between">
              <label className="text-sm font-semibold text-slate-700">
                Mês
                <input
                  type="month"
                  value={competencia}
                  onChange={(evento) => setCompetencia(evento.target.value)}
                  className="mt-1 block h-11 rounded-xl border border-slate-200 px-3 text-base"
                />
              </label>
              <div className="text-sm text-slate-600">
                <p className="font-semibold text-slate-800">Link para o morador</p>
                <p className="break-all">{linkPublico}</p>
                <button
                  type="button"
                  onClick={copiarLink}
                  className="mt-2 h-10 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white"
                >
                  {linkCopiado ? 'Link copiado' : 'Copiar link'}
                </button>
              </div>
            </div>

            {erro ? (
              <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{erro}</p>
            ) : null}

            {carregando ? <p className="text-sm text-slate-500">Carregando respostas...</p> : null}

            {relatorio && !carregando ? (
              <>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    {relatorio.projeto}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {relatorio.total} {relatorio.total === 1 ? 'resposta' : 'respostas'} em {relatorio.rotulo_competencia}
                  </p>
                </div>

                <div className="grid gap-3">
                  {relatorio.perguntas.map((pergunta, ordem) => (
                    <article key={pergunta.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <h2 className="text-sm font-bold text-slate-900">
                        {ordem + 1}. {pergunta.texto}
                      </h2>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {pergunta.opcoes.map((opcao) => (
                          <p key={opcao.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                            <span>{opcao.rotulo}</span>
                            <span className="font-bold text-slate-900">{opcao.total}</span>
                          </p>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>

                <section className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h2 className="text-lg font-bold text-slate-900">Quem respondeu</h2>
                  {relatorio.pessoas.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">Nenhuma resposta neste mês.</p>
                  ) : (
                    <ul className="mt-3 divide-y divide-slate-100">
                      {relatorio.pessoas.map((pessoa) => {
                        const chave = `${pessoa.numero_prontuario}-${pessoa.respondido_em}`;
                        const abertaEsta = aberta === chave;
                        return (
                          <li key={chave} className="py-3">
                            <button
                              type="button"
                              onClick={() => setAberta(abertaEsta ? null : chave)}
                              className="flex w-full items-center justify-between gap-3 text-left"
                            >
                              <span>
                                <span className="block font-semibold text-slate-900">
                                  {pessoa.numero_prontuario} · {pessoa.nome}
                                </span>
                                <span className="text-sm text-slate-500">{pessoa.respondido_em}</span>
                              </span>
                              <span className="text-sm font-semibold text-teal-800">
                                {abertaEsta ? 'Fechar' : 'Ver'}
                              </span>
                            </button>
                            {abertaEsta ? (
                              <div className="mt-3 space-y-2 text-sm text-slate-700">
                                {pessoa.respostas.map((item) => (
                                  <p key={item.pergunta}>
                                    <span className="font-semibold">{item.pergunta}</span>
                                    {' '}
                                    {item.resposta}
                                  </p>
                                ))}
                                {pessoa.sugestoes ? (
                                  <p className="rounded-xl bg-slate-50 p-3">
                                    <span className="font-semibold">Sugestões e elogios: </span>
                                    {pessoa.sugestoes}
                                  </p>
                                ) : null}
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              </>
            ) : null}
          </div>
        </ScrollArea>
      </MainShell>
    </AppShell>
  );
}
