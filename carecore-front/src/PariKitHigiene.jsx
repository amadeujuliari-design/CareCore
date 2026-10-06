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
  const complemento = perfil.papel === 'complemento';
  const porFlag = complemento && perfil.gatilho === 'flag';
  const [idadeMin, setIdadeMin] = useState(perfil.idade_min ?? 0);
  const [idadeMax, setIdadeMax] = useState(perfil.idade_max ?? '');
  const [mesesMin, setMesesMin] = useState(perfil.idade_min_meses ?? 0);
  const [mesesMax, setMesesMax] = useState(perfil.idade_max_meses ?? '');
  const [sexo, setSexo] = useState(perfil.sexo || 'qualquer');
  const [itemId, setItemId] = useState('');
  const [quantidade, setQuantidade] = useState(1);
  const [aviso, setAviso] = useState('');
  const doPerfil = regras.filter((regra) => regra.tipo_id === perfil.id);

  useEffect(() => {
    setIdadeMin(perfil.idade_min ?? 0);
    setIdadeMax(perfil.idade_max ?? '');
    setMesesMin(perfil.idade_min_meses ?? 0);
    setMesesMax(perfil.idade_max_meses ?? '');
    setSexo(perfil.sexo || 'qualquer');
  }, [perfil.id, perfil.idade_min, perfil.idade_max, perfil.idade_min_meses, perfil.idade_max_meses, perfil.sexo]);

  return (
    <article className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <h3 className="text-base font-black text-slate-900">
        {perfil.nome}
        {complemento && <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800">Complemento</span>}
      </h3>
      <p className="mt-1 text-xs text-slate-500">{perfil.descricao}</p>
      {porFlag && <p className="mt-2 text-xs font-semibold text-slate-600">Entra quando a flag Já menstrua está ligada no acolhido.</p>}
      {!porFlag && (
      <div className="mt-3 grid grid-cols-3 gap-2">
        <label className="text-[11px] font-bold text-slate-600">
          {complemento ? 'De (meses)' : 'De'}
          <input
            type="number"
            min="0"
            max={complemento ? '1440' : '120'}
            value={complemento ? mesesMin : idadeMin}
            onChange={(event) => (complemento ? setMesesMin(event.target.value) : setIdadeMin(event.target.value))}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-2 py-2 text-sm"
          />
        </label>
        <label className="text-[11px] font-bold text-slate-600">
          {complemento ? 'Até (meses)' : 'Até'}
          <input
            type="number"
            min="0"
            max={complemento ? '1440' : '120'}
            value={complemento ? mesesMax : idadeMax}
            placeholder="sem limite"
            onChange={(event) => (complemento ? setMesesMax(event.target.value) : setIdadeMax(event.target.value))}
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
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <PremiumButton
          type="button"
          onClick={async () => {
            setAviso('');
            const resultado = await onSalvarFaixa(perfil, idadeMin, idadeMax, sexo, mesesMin, mesesMax);
            if (resultado) setAviso('Idade salva.');
          }}
        >
          Salvar idade
        </PremiumButton>
        {aviso && <span className="text-xs font-bold text-emerald-700">{aviso}</span>}
      </div>
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

function MembroIdade({ membro, onSalvar, cruzeiro }) {
  const [nascimento, setNascimento] = useState(membro.nascimento || '');
  const [sexo, setSexo] = useState(membro.sexo || '');
  const [menstrua, setMenstrua] = useState(Boolean(membro.menstrua));
  const [aviso, setAviso] = useState('');
  const [erroLocal, setErroLocal] = useState('');

  useEffect(() => {
    setNascimento(membro.nascimento || '');
    setSexo(membro.sexo || '');
    setMenstrua(Boolean(membro.menstrua));
  }, [membro.id, membro.nascimento, membro.sexo, membro.menstrua]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-sm font-bold text-slate-900">{membro.nome}</p>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="text-[11px] font-bold text-slate-600">
          Nascimento
          <input
            type="date"
            value={nascimento}
            onChange={(event) => setNascimento(event.target.value)}
            className="mt-1 block rounded-xl border border-slate-200 px-2 py-2 text-sm"
          />
        </label>
        <label className="text-[11px] font-bold text-slate-600">
          Sexo
          <select
            value={sexo}
            onChange={(event) => setSexo(event.target.value)}
            className="mt-1 block rounded-xl border border-slate-200 px-2 py-2 text-sm"
          >
            <option value="">Não informado</option>
            <option value="masculino">Masculino</option>
            <option value="feminino">Feminino</option>
          </select>
        </label>
        {cruzeiro && (
          <label className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-700">
            <input
              type="checkbox"
              checked={menstrua}
              onChange={(event) => setMenstrua(event.target.checked)}
            />
            Já menstrua
          </label>
        )}
        <PremiumButton
          type="button"
          onClick={async () => {
            setAviso('');
            setErroLocal('');
            try {
              await onSalvar(membro.id, nascimento || null, sexo, cruzeiro ? menstrua : null);
              setAviso('Idade salva.');
            } catch (error) {
              setErroLocal(detalheErro(error, 'Não foi possível salvar a idade.'));
            }
          }}
        >
          Salvar idade
        </PremiumButton>
        {aviso && <span className="text-xs font-bold text-emerald-700">{aviso}</span>}
      </div>
      {erroLocal && <p className="mt-2 text-xs font-semibold text-red-700">{erroLocal}</p>}
    </div>
  );
}

export default function PariKitHigiene() {
  const [catalogo, setCatalogo] = useState({ tipos: [], itens: [], regras: [], entregas: [], modelo: 'pari' });
  const [nomePerfil, setNomePerfil] = useState('');
  const [gatilhoPerfil, setGatilhoPerfil] = useState('idade');
  const [conviventes, setConviventes] = useState([]);
  const [codigo, setCodigo] = useState('');
  const [busca, setBusca] = useState('');
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

  const salvarFaixa = async (perfil, idadeMin, idadeMax, sexo, mesesMin, mesesMax) => {
    setErro('');
    try {
      const corpo = {
        idade_min: Number(idadeMin),
        idade_max: idadeMax === '' || idadeMax == null ? null : Number(idadeMax),
        sexo,
      };
      if (perfil.papel === 'complemento' && perfil.gatilho !== 'flag') {
        corpo.idade_min_meses = Number(mesesMin);
        corpo.idade_max_meses = mesesMax === '' || mesesMax == null ? null : Number(mesesMax);
      }
      await api.patch(`/api/pari/kit/tipos/${perfil.id}`, corpo);
      await carregar();
      return true;
    } catch (error) {
      setErro(detalheErro(error, 'Não foi possível salvar a idade.'));
      return false;
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

  const salvarMembro = async (conviventeId, nascimento, sexo, menstrua) => {
    const corpo = {
      data_nascimento: nascimento,
      sexo,
    };
    if (menstrua != null) corpo.menstrua = menstrua;
    const resposta = await api.patch(`/api/pari/kit/membros/${conviventeId}`, corpo);
    setPrevia(resposta.data);
    setMensagem('Idade salva. O kit da família foi recalculado.');
  };

  const sugeridos = conviventes
    .filter((pessoa) => {
      const termo = busca.trim().toLocaleLowerCase('pt-BR');
      if (!termo) return false;
      const nome = `${pessoa.nome_social || ''} ${pessoa.nome_completo || ''} ${pessoa.familia_codigo || ''}`.toLocaleLowerCase('pt-BR');
      return nome.includes(termo);
    })
    .slice(0, 8);

  const confirmar = async () => {
    if (!conviventePrevia) return;
    setConfirmando(true);
    setErro('');
    try {
      const resposta = await api.post('/api/pari/kit/entrega', { convivente_id: conviventePrevia.id });
      setPrevia({ ...resposta.data, ja_entregue: true, composicao_entregue: resposta.data.composicao });
      setMensagem(`Retirada de ${resposta.data.familia_codigo} registrada neste mês.`);
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
          subtitle="A retirada fica no topo: busque a família, salve a idade de quem estiver sem data e confirme o kit do mês. A configuração dos itens fica mais abaixo."
          icon="K"
        />
        {erro && <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{erro}</p>}

        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Retirada do kit</h2>
          <p className="mt-1 text-sm text-slate-500">Busque a família ou leia a carteirinha. Salve a idade de cada pessoa e confirme a retirada. A mesma família não retira de novo neste mês.</p>
          <div className="mt-4 max-w-xl">
            <input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Busque a família ou a pessoa"
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
                      setBusca('');
                      verKit(pessoa);
                    }}
                  >
                    {pessoa.nome_social || pessoa.nome_completo}
                    {pessoa.familia_codigo ? ` · ${pessoa.familia_codigo}` : ''}
                  </button>
                ))}
                {!sugeridos.length && <p className="px-3 py-2 text-sm text-slate-500">Nenhuma pessoa ativa com esse nome.</p>}
              </div>
            )}
          </div>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              lerCodigo(codigo);
            }}
          >
            <input
              value={codigo}
              onChange={(event) => setCodigo(event.target.value)}
              placeholder="Ou leia o QR Code / digite o prontuário"
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
              <div className="mt-3 space-y-2">
                {(previa.membros || []).map((membro) => (
                  <MembroIdade key={membro.id} membro={membro} onSalvar={salvarMembro} cruzeiro={catalogo.modelo === 'cruzeiro'} />
                ))}
              </div>
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
                  <p className="mt-2 text-xs">Salve a idade e o sexo acima. A retirada fica bloqueada até o kit fechar.</p>
                </div>
              )}
              <p className="mt-3 font-bold text-slate-900">{previa.ja_entregue ? 'Itens retirados' : 'Itens do mês'}</p>
              <ul className="mt-1 list-disc pl-5">
                {itensEntregues.map((item) => (
                  <li key={item.nome}>{item.quantidade}× {item.nome}</li>
                ))}
                {itensEntregues.length === 0 && <li className="list-none pl-0 text-slate-500">Nenhum item somado.</li>}
              </ul>
              {!previa.ja_entregue && (
                <PremiumButton type="button" className="mt-4" disabled={!previa.completo || confirmando} onClick={confirmar}>
                  Registrar retirada
                </PremiumButton>
              )}
            </div>
          )}
          {!!catalogo.entregas?.length && (
            <div className="mt-5">
              <h3 className="text-sm font-black text-slate-900">Retiradas deste projeto</h3>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {catalogo.entregas.slice(0, 8).map((entrega) => (
                  <li key={entrega.id}>
                    {entrega.familia_codigo || 'Família'} · {String(entrega.competencia || '').slice(5, 7)}/{String(entrega.competencia || '').slice(0, 4)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
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
          <p className="mt-1 text-sm text-slate-500">
            {catalogo.modelo === 'cruzeiro'
              ? 'O perfil de base continua um só por pessoa. Os complementos somam no kit e podem cruzar a mesma idade. A flag Já menstrua liga o complemento de menstruação.'
              : 'Ajuste a idade de cada tipo e clique em Salvar idade. Uma idade não pode caber em dois perfis.'}
          </p>
          {catalogo.modelo === 'cruzeiro' && (
            <form
              className="mt-4 flex flex-wrap gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (!nomePerfil.trim()) return;
                criar('/api/pari/kit/tipos', {
                  nome: nomePerfil.trim(),
                  papel: 'complemento',
                  gatilho: gatilhoPerfil,
                });
                setNomePerfil('');
              }}
            >
              <input
                value={nomePerfil}
                onChange={(event) => setNomePerfil(event.target.value)}
                placeholder="Novo complemento, por exemplo fralda noturna"
                className="min-h-11 min-w-[16rem] flex-1 rounded-xl border border-slate-200 px-3 text-sm"
              />
              <select
                value={gatilhoPerfil}
                onChange={(event) => setGatilhoPerfil(event.target.value)}
                className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm"
              >
                <option value="idade">Entra pela idade</option>
                <option value="flag">Entra pela flag Já menstrua</option>
              </select>
              <PremiumButton type="submit" variant="secondary">Incluir complemento</PremiumButton>
            </form>
          )}
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
      </MainShell>
    </AppShell>
  );
}
