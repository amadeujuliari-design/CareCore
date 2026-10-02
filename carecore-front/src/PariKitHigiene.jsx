import { useCallback, useEffect, useState } from 'react';

import Sidebar from './Sidebar';
import { AppShell, MainShell, PageHeader, PremiumButton } from './components/PremiumUI';
import api from './services/api';
import { useLeitorUsbGlobal } from './hooks/useLeitorUsbGlobal';
import { encontrarConviventePorCodigo } from './utils/conviventeIdentificacaoUtils';

function detalheErro(error, fallback) {
  const detalhe = error?.response?.data?.detail;
  return typeof detalhe === 'string' ? detalhe : fallback;
}

function PerfilCard({ perfil, itens, regras, onSalvarFaixa, onIncluir, onRemover }) {
  const [idadeMin, setIdadeMin] = useState(perfil.idade_min ?? 0);
  const [idadeMax, setIdadeMax] = useState(perfil.idade_max ?? '');
  const [sexo, setSexo] = useState(perfil.sexo || 'qualquer');
  const [itemId, setItemId] = useState('');
  const [quantidade, setQuantidade] = useState(1);
  const doPerfil = regras.filter((regra) => regra.tipo_id === perfil.id);

  useEffect(() => {
    setIdadeMin(perfil.idade_min ?? 0);
    setIdadeMax(perfil.idade_max ?? '');
    setSexo(perfil.sexo || 'qualquer');
  }, [perfil.id, perfil.idade_min, perfil.idade_max, perfil.sexo]);

  return (
    <article className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <h3 className="text-base font-black text-slate-900">{perfil.nome}</h3>
      <p className="mt-1 text-xs text-slate-500">{perfil.descricao}</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <label className="text-[11px] font-bold text-slate-600">
          De
          <input
            type="number"
            min="0"
            max="120"
            value={idadeMin}
            onChange={(event) => setIdadeMin(event.target.value)}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-2 py-2 text-sm"
          />
        </label>
        <label className="text-[11px] font-bold text-slate-600">
          Até
          <input
            type="number"
            min="0"
            max="120"
            value={idadeMax}
            placeholder="sem limite"
            onChange={(event) => setIdadeMax(event.target.value)}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-2 py-2 text-sm"
          />
        </label>
        <label className="text-[11px] font-bold text-slate-600">
          Sexo
          <select
            value={sexo}
            onChange={(event) => setSexo(event.target.value)}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-2 py-2 text-sm"
          >
            <option value="qualquer">Qualquer</option>
            <option value="masculino">Masculino</option>
            <option value="feminino">Feminino</option>
          </select>
        </label>
      </div>
      <PremiumButton
        type="button"
        variant="secondary"
        className="mt-3"
        onClick={() => onSalvarFaixa(perfil, idadeMin, idadeMax, sexo)}
      >
        Salvar faixa
      </PremiumButton>
      <ul className="mt-4 space-y-2 text-sm">
        {doPerfil.map((regra) => {
          const item = itens.find((atual) => atual.id === regra.item_id);
          return (
            <li key={regra.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
              <span>{regra.quantidade}× {item?.nome || 'Item'}</span>
              <button type="button" className="text-xs font-bold text-red-600" onClick={() => onRemover(regra.id)}>
                Remover
              </button>
            </li>
          );
        })}
        {doPerfil.length === 0 && <li className="text-slate-400">Nenhum item neste perfil.</li>}
      </ul>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!itemId) return;
          onIncluir(perfil.id, itemId, Number(quantidade) || 1);
          setItemId('');
          setQuantidade(1);
        }}
      >
        <select value={itemId} onChange={(event) => setItemId(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-2 text-sm">
          <option value="">Item</option>
          {itens.filter((item) => item.ativo !== false).map((item) => (
            <option key={item.id} value={item.id}>{item.nome}</option>
          ))}
        </select>
        <input
          type="number"
          min="1"
          max="99"
          value={quantidade}
          onChange={(event) => setQuantidade(event.target.value)}
          className="min-h-11 w-16 rounded-xl border border-slate-200 px-2 text-sm"
        />
        <PremiumButton type="submit">Incluir</PremiumButton>
      </form>
    </article>
  );
}

export default function PariKitHigiene() {
  const [catalogo, setCatalogo] = useState({ tipos: [], itens: [], regras: [], entregas: [] });
  const [conviventes, setConviventes] = useState([]);
  const [codigo, setCodigo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [previa, setPrevia] = useState(null);
  const [conviventePrevia, setConviventePrevia] = useState(null);
  const [nomeItem, setNomeItem] = useState('');
  const [confirmando, setConfirmando] = useState(false);

  const carregar = useCallback(async () => {
    const [kit, resumo] = await Promise.all([
      api.get('/api/pari/kit'),
      api.get('/api/conviventes/resumo', { params: { status: 'Ativo' } }),
    ]);
    setCatalogo(kit.data);
    setConviventes(resumo.data || []);
  }, []);

  useEffect(() => {
    carregar().catch((error) => setErro(detalheErro(error, 'Não foi possível carregar o kit.')));
  }, [carregar]);

  const criar = async (caminho, corpo) => {
    setErro('');
    try {
      await api.post(caminho, corpo);
      await carregar();
    } catch (error) {
      setErro(detalheErro(error, 'Não foi possível salvar.'));
    }
  };

  const salvarFaixa = async (perfil, idadeMin, idadeMax, sexo) => {
    setErro('');
    try {
      await api.patch(`/api/pari/kit/tipos/${perfil.id}`, {
        idade_min: Number(idadeMin),
        idade_max: idadeMax === '' || idadeMax == null ? null : Number(idadeMax),
        sexo,
      });
      await carregar();
    } catch (error) {
      setErro(detalheErro(error, 'Não foi possível salvar a faixa.'));
    }
  };

  const verKit = useCallback(async (convivente) => {
    setErro('');
    setMensagem('');
    setPrevia(null);
    setConviventePrevia(convivente);
    try {
      const resposta = await api.post('/api/pari/kit/previa', { convivente_id: convivente.id });
      setPrevia(resposta.data);
    } catch (error) {
      setErro(detalheErro(error, 'Não foi possível montar o kit.'));
    }
  }, []);

  const lerCodigo = useCallback(async (lido) => {
    const convivente = encontrarConviventePorCodigo(conviventes, lido);
    if (!convivente) {
      setErro('Carteirinha não encontrada entre os acolhidos ativos.');
      setPrevia(null);
      return;
    }
    setCodigo('');
    await verKit(convivente);
  }, [conviventes, verKit]);

  useLeitorUsbGlobal({ ativo: true, onCodigoLido: lerCodigo });

  const confirmar = async () => {
    if (!conviventePrevia) return;
    setConfirmando(true);
    setErro('');
    try {
      const resposta = await api.post('/api/pari/kit/entrega', { convivente_id: conviventePrevia.id });
      setPrevia({ ...resposta.data, ja_entregue: true, composicao_entregue: resposta.data.composicao });
      setMensagem(`Kit de ${resposta.data.familia_codigo} entregue neste mês.`);
      await carregar();
    } catch (error) {
      setErro(detalheErro(error, 'Não foi possível entregar o kit.'));
    } finally {
      setConfirmando(false);
    }
  };

  const competencia = previa?.competencia
    ? `${previa.competencia.slice(5, 7)}/${previa.competencia.slice(0, 4)}`
    : '';
  const itensEntregues = previa?.ja_entregue ? (previa.composicao_entregue || []) : (previa?.composicao || []);

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          eyebrow="Rotina Diária"
          title="Kit mensal de higiene"
          subtitle="Cadastre os itens e, em cada perfil, a idade, o sexo e a quantidade do mês. Na entrega, o sistema soma o kit de toda a família."
          icon="K"
        />
        {erro && <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{erro}</p>}

        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Itens</h2>
          <p className="mt-1 text-sm text-slate-500">O que pode entrar no kit. A quantidade fica em cada perfil.</p>
          <form
            className="mt-4 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!nomeItem.trim()) return;
              criar('/api/pari/kit/itens', { nome: nomeItem.trim() });
              setNomeItem('');
            }}
          >
            <input value={nomeItem} onChange={(event) => setNomeItem(event.target.value)} placeholder="Novo item, por exemplo sabonete" className="min-h-11 flex-1 rounded-xl border border-slate-200 px-3 text-sm" />
            <PremiumButton type="submit" variant="secondary">Incluir item</PremiumButton>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {catalogo.itens.filter((item) => item.ativo !== false).map((item) => (
              <span key={item.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{item.nome}</span>
            ))}
            {catalogo.itens.length === 0 && <span className="text-sm text-slate-400">Nenhum item cadastrado.</span>}
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-lg font-bold text-slate-900">Perfis</h2>
          <p className="mt-1 text-sm text-slate-500">Bebê e criança valem para os dois sexos. Adolescente e adulto separam masculino e feminino. Uma idade não pode caber em dois perfis.</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {catalogo.tipos.map((perfil) => (
              <PerfilCard
                key={perfil.id}
                perfil={perfil}
                itens={catalogo.itens}
                regras={catalogo.regras}
                onSalvarFaixa={salvarFaixa}
                onIncluir={(tipoId, itemId, quantidade) => criar('/api/pari/kit/regras', { tipo_id: tipoId, item_id: itemId, quantidade })}
                onRemover={(regraId) => api.delete(`/api/pari/kit/regras/${regraId}`).then(carregar).catch((error) => setErro(detalheErro(error, 'Não foi possível remover.')))}
              />
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Entregar kit</h2>
          <p className="mt-1 text-sm text-slate-500">Leia a carteirinha de qualquer pessoa da família. O kit aparece para conferência antes de confirmar. A segunda entrega no mesmo mês fica bloqueada.</p>
          <form
            className="mt-4 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              lerCodigo(codigo);
            }}
          >
            <input
              value={codigo}
              onChange={(event) => setCodigo(event.target.value)}
              placeholder="Leia o QR Code ou digite o prontuário"
              className="min-h-11 flex-1 rounded-xl border border-slate-200 px-3 text-sm"
            />
            <PremiumButton type="submit">Ver kit</PremiumButton>
          </form>
          {mensagem && <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{mensagem}</p>}
          {previa && (
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-bold text-slate-900">{previa.familia_codigo} · {competencia}</p>
              {previa.ja_entregue && (
                <p className="mt-2 font-semibold text-amber-800">Esta família já retirou o kit neste mês.</p>
              )}
              <ul className="mt-3 space-y-1">
                {(previa.grupos || []).map((grupo) => (
                  <li key={grupo.perfil}>
                    <span className="font-bold text-slate-900">{grupo.perfil}:</span> {grupo.pessoas.join(', ')}
                  </li>
                ))}
              </ul>
              {(previa.pendencias || []).length > 0 && (
                <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-amber-900">
                  <p className="font-bold">Fora do kit</p>
                  <ul className="mt-1 list-disc pl-5">
                    {previa.pendencias.map((item) => (
                      <li key={`${item.nome}-${item.motivo}`}>{item.nome} — {item.motivo}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs">A entrega fica bloqueada até completar a ficha. O kit não sai pela metade.</p>
                </div>
              )}
              <p className="mt-3 font-bold text-slate-900">{previa.ja_entregue ? 'Itens entregues' : 'Itens do mês'}</p>
              <ul className="mt-1 list-disc pl-5">
                {itensEntregues.map((item) => (
                  <li key={item.nome}>{item.quantidade}× {item.nome}</li>
                ))}
                {itensEntregues.length === 0 && <li className="list-none pl-0 text-slate-500">Nenhum item somado.</li>}
              </ul>
              {!previa.ja_entregue && (
                <PremiumButton type="button" className="mt-4" disabled={!previa.completo || confirmando} onClick={confirmar}>
                  Confirmar entrega
                </PremiumButton>
              )}
            </div>
          )}
        </section>
      </MainShell>
    </AppShell>
  );
}
