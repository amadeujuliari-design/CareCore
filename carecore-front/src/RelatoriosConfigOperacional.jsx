import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import Sidebar from './Sidebar';
import { AppShell, MainShell, PageHeader, PremiumButton, ScrollArea } from './components/PremiumUI';
import { montarConfigOperacionalPadrao } from './config/configOperacionalDefaults';
import { useConfigOperacional } from './hooks/useConfigOperacional';
import { salvarConfigOperacional } from './services/configOperacionalService';
import { decodificarPayloadJwt } from './utils/jwtUtils';
import { normalizarPerfilRbac, usuarioPodeSalvarConfigOperacionalProjeto } from './utils/rbacUtils';

const ABAS = [
  { id: 'refeicoes', label: 'Refeições' },
  { id: 'portaria', label: 'Portaria e Rotina' },
  { id: 'modulos', label: 'Módulos' },
  { id: 'documentos', label: 'Documentos' },
];

const GRUPOS_INTERACAO = [
  { id: 'simples', label: 'Registro simples' },
  { id: 'par', label: 'Retirada / entrega' },
  { id: 'par_bagageiro', label: 'Bagageiro (entrada/saída)' },
  { id: 'observacao', label: 'Com observação obrigatória' },
];

const ROTULOS_MODULOS = {
  tb: 'TB (indicador legado)',
  sisa: 'Convênio / SISA',
  pot: 'Programa Operação Trabalho (POT)',
  discussoes_hospitalares: 'Discussões hospitalares',
  suspensoes: 'Suspensões provisórias',
  transferencias: 'Encaminhamentos e transferências',
  tuberculose: 'Acompanhamento tuberculose',
  historico_legado: 'Histórico legado',
};

const inputClassName =
  'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand';

function Toggle({ checked, onChange, disabled = false, label, description }) {
  return (
    <label
      className={`flex items-start justify-between gap-4 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 ${
        disabled ? 'opacity-60' : 'cursor-pointer'
      }`}
    >
      <span>
        <span className="block text-sm font-black text-gray-900">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs font-semibold text-gray-500">{description}</span>
        ) : null}
      </span>
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        className="mt-1 h-5 w-5 rounded border-gray-300 text-brand focus:ring-brand"
      />
    </label>
  );
}

function clonarConfig(config) {
  return JSON.parse(JSON.stringify(config));
}

function gerarIdRefeicao() {
  return `refeicao_${Date.now().toString(36)}`;
}

function gerarIdInteracao() {
  return `interacao_${Date.now().toString(36)}`;
}

function sugerirTiposPar(nome) {
  const base = (nome || 'Item').trim() || 'Item';
  return {
    tipo_retirada: `Retirada de ${base}`,
    tipo_entrega: `Entrega de ${base}`,
  };
}

export default function RelatoriosConfigOperacional() {
  const { config: configRemota, carregando, erro: erroCarregamento, setConfig: setConfigGlobal } =
    useConfigOperacional();
  const token = localStorage.getItem('@CareCore:token') || localStorage.getItem('token');
  const tokenPayload = token ? decodificarPayloadJwt(token) : null;
  const perfil = tokenPayload
    ? normalizarPerfilRbac(tokenPayload.perfil_acesso)
    : '';
  const podeSalvar = usuarioPodeSalvarConfigOperacionalProjeto(perfil, tokenPayload);

  const [aba, setAba] = useState('refeicoes');
  const [form, setForm] = useState(() => montarConfigOperacionalPadrao());
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (configRemota) {
      setForm(clonarConfig(configRemota));
    }
  }, [configRemota]);

  const interacoesNaoRefeicao = useMemo(
    () => (form.interacoes_rotina || []).filter((item) => item.grupo !== 'refeicao'),
    [form.interacoes_rotina],
  );

  const atualizarForm = (atualizador) => {
    setForm((prev) => {
      const proximo = typeof atualizador === 'function' ? atualizador(prev) : atualizador;
      return clonarConfig(proximo);
    });
    setMensagem('');
    setErro('');
  };

  const atualizarRefeicao = (indice, campo, valor) => {
    atualizarForm((prev) => {
      const itens = [...(prev.refeicoes?.itens || [])];
      itens[indice] = { ...itens[indice], [campo]: valor };
      return {
        ...prev,
        refeicoes: { ...prev.refeicoes, itens },
      };
    });
  };

  const adicionarRefeicao = () => {
    atualizarForm((prev) => ({
      ...prev,
      refeicoes: {
        ...prev.refeicoes,
        itens: [
          ...(prev.refeicoes?.itens || []),
          {
            id: gerarIdRefeicao(),
            nome: 'Nova refeição',
            inicio: '12:00',
            fim: '13:00',
            ativo: true,
          },
        ],
      },
    }));
  };

  const removerRefeicao = (indice) => {
    atualizarForm((prev) => ({
      ...prev,
      refeicoes: {
        ...prev.refeicoes,
        itens: (prev.refeicoes?.itens || []).filter((_, idx) => idx !== indice),
      },
    }));
  };

  const atualizarInteracao = (indice, campo, valor) => {
    atualizarForm((prev) => {
      const itens = [...(prev.interacoes_rotina || [])];
      const atual = { ...itens[indice], [campo]: valor };

      if (campo === 'grupo' && valor === 'par' && !atual.tipo_retirada && !atual.tipo_entrega) {
        const sugestao = sugerirTiposPar(atual.valor || atual.label);
        atual.tipo_retirada = sugestao.tipo_retirada;
        atual.tipo_entrega = sugestao.tipo_entrega;
      }

      if (campo === 'grupo' && valor === 'par_bagageiro') {
        atual.valor = 'Bagageiro';
        atual.label = atual.label || 'Bagageiro (entrada/saída)';
      }

      itens[indice] = atual;
      return { ...prev, interacoes_rotina: itens };
    });
  };

  const adicionarInteracao = () => {
    const id = gerarIdInteracao();
    atualizarForm((prev) => ({
      ...prev,
      interacoes_rotina: [
        ...(prev.interacoes_rotina || []),
        {
          valor: id,
          label: 'Nova interação',
          grupo: 'simples',
          ativo: true,
        },
      ],
    }));
  };

  const removerInteracao = (indice) => {
    atualizarForm((prev) => ({
      ...prev,
      interacoes_rotina: (prev.interacoes_rotina || []).filter((_, idx) => idx !== indice),
    }));
  };

  const atualizarPortaria = (campo, valor) => {
    atualizarForm((prev) => ({
      ...prev,
      portaria: { ...prev.portaria, [campo]: valor },
    }));
  };

  const atualizarModulo = (chave, ativo) => {
    atualizarForm((prev) => ({
      ...prev,
      modulos: { ...prev.modulos, [chave]: ativo },
    }));
  };

  const atualizarDocumento = (chave, campo, valor) => {
    atualizarForm((prev) => ({
      ...prev,
      documentos: {
        ...prev.documentos,
        [chave]: {
          ...prev.documentos?.[chave],
          [campo]: valor,
        },
      },
    }));
  };

  const atualizarItemBagageiro = (indice, valor) => {
    atualizarForm((prev) => {
      const itens = [...(prev.documentos?.termo_bagageiro?.itens || [])];
      itens[indice] = valor;
      return {
        ...prev,
        documentos: {
          ...prev.documentos,
          termo_bagageiro: {
            ...prev.documentos?.termo_bagageiro,
            itens,
          },
        },
      };
    });
  };

  const adicionarItemBagageiro = () => {
    atualizarForm((prev) => ({
      ...prev,
      documentos: {
        ...prev.documentos,
        termo_bagageiro: {
          ...prev.documentos?.termo_bagageiro,
          itens: [...(prev.documentos?.termo_bagageiro?.itens || []), ''],
        },
      },
    }));
  };

  const removerItemBagageiro = (indice) => {
    atualizarForm((prev) => ({
      ...prev,
      documentos: {
        ...prev.documentos,
        termo_bagageiro: {
          ...prev.documentos?.termo_bagageiro,
          itens: (prev.documentos?.termo_bagageiro?.itens || []).filter((_, idx) => idx !== indice),
        },
      },
    }));
  };

  const restaurarPadrao = () => {
    if (!window.confirm('Restaurar todos os campos para os valores padrão do projeto?')) return;
    const perfil = configRemota?.perfil_defaults || form.perfil_defaults || 'generico';
    atualizarForm(montarConfigOperacionalPadrao(perfil));
    setMensagem('Valores padrão carregados no formulário. Salve para aplicar no projeto.');
  };

  const salvar = async (event) => {
    event.preventDefault();
    if (!podeSalvar) return;

    setSalvando(true);
    setMensagem('');
    setErro('');

    try {
      const salvo = await salvarConfigOperacional(form);
      setForm(clonarConfig(salvo));
      setConfigGlobal(salvo);
      setMensagem('Configuração operacional salva com sucesso.');
    } catch (error) {
      const detalhe = error?.response?.data?.detail;
      setErro(
        typeof detalhe === 'string'
          ? detalhe
          : 'Não foi possível salvar a configuração operacional.',
      );
    } finally {
      setSalvando(false);
    }
  };

  const renderAbaRefeicoes = () => (
    <div className="grid gap-5">
      <article className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <Toggle
          label="Refeições na rotina diária"
          description="Quando desativado, refeições não aparecem como interações na rotina."
          checked={form.refeicoes?.habilitadas}
          onChange={(valor) => atualizarForm((prev) => ({
            ...prev,
            refeicoes: { ...prev.refeicoes, habilitadas: valor },
          }))}
          disabled={!podeSalvar}
        />
      </article>

      <article className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-black text-gray-900">Refeições configuradas</h2>
            <p className="mt-1 text-xs font-semibold text-gray-500">
              Nome, janela de horário e status de cada refeição operacional.
            </p>
          </div>
          {podeSalvar && (
            <PremiumButton type="button" variant="secondary" onClick={adicionarRefeicao}>
              Adicionar refeição
            </PremiumButton>
          )}
        </div>

        <div className="grid gap-3">
          {(form.refeicoes?.itens || []).map((item, indice) => (
            <div
              key={item.id || indice}
              className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4 md:grid-cols-[1fr_120px_120px_auto_auto]"
            >
              <label>
                <span className="mb-1 block text-[10px] font-black uppercase text-gray-400">Nome</span>
                <input
                  type="text"
                  value={item.nome}
                  onChange={(event) => atualizarRefeicao(indice, 'nome', event.target.value)}
                  disabled={!podeSalvar}
                  className={inputClassName}
                />
              </label>
              <label>
                <span className="mb-1 block text-[10px] font-black uppercase text-gray-400">Início</span>
                <input
                  type="time"
                  value={item.inicio}
                  onChange={(event) => atualizarRefeicao(indice, 'inicio', event.target.value)}
                  disabled={!podeSalvar}
                  className={inputClassName}
                />
              </label>
              <label>
                <span className="mb-1 block text-[10px] font-black uppercase text-gray-400">Fim</span>
                <input
                  type="time"
                  value={item.fim}
                  onChange={(event) => atualizarRefeicao(indice, 'fim', event.target.value)}
                  disabled={!podeSalvar}
                  className={inputClassName}
                />
              </label>
              <label className="flex items-end gap-2 pb-2">
                <input
                  type="checkbox"
                  checked={Boolean(item.ativo)}
                  onChange={(event) => atualizarRefeicao(indice, 'ativo', event.target.checked)}
                  disabled={!podeSalvar}
                  className="h-4 w-4 rounded border-gray-300 text-brand"
                />
                <span className="text-xs font-bold text-gray-700">Ativo</span>
              </label>
              {podeSalvar && (
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => removerRefeicao(indice)}
                    className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100"
                  >
                    Remover
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </article>
    </div>
  );

  const renderAbaPortaria = () => (
    <div className="grid gap-5 lg:grid-cols-2">
      <article className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="text-base font-black text-gray-900">Horários de portaria</h2>
        <p className="mt-1 text-xs font-semibold text-gray-500">
          Limites padrão para entrada, saída e exceções de pernoite.
        </p>

        <div className="mt-4 grid gap-3">
          {[
            ['hora_saida_padrao', 'Saída padrão até'],
            ['hora_entrada_padrao', 'Entrada padrão até'],
            ['hora_entrada_apos_pernoite_fora', 'Entrada após pernoite fora'],
            ['hora_movimento_pernoite_dentro', 'Movimento após pernoite dentro'],
          ].map(([campo, rotulo]) => (
            <label key={campo}>
              <span className="mb-1 block text-[10px] font-black uppercase text-gray-400">{rotulo}</span>
              <input
                type="time"
                value={form.portaria?.[campo] || ''}
                onChange={(event) => atualizarPortaria(campo, event.target.value)}
                disabled={!podeSalvar}
                className={inputClassName}
              />
            </label>
          ))}
          <label>
            <span className="mb-1 block text-[10px] font-black uppercase text-gray-400">
              Mínimo de caracteres na justificativa
            </span>
            <input
              type="number"
              min={10}
              max={500}
              value={form.portaria?.min_caracteres_justificativa ?? 30}
              onChange={(event) => atualizarPortaria(
                'min_caracteres_justificativa',
                Number(event.target.value) || 30,
              )}
              disabled={!podeSalvar}
              className={inputClassName}
            />
          </label>
        </div>
      </article>

      <article className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-black text-gray-900">Interações da rotina</h2>
            <p className="mt-1 text-xs font-semibold text-gray-500">
              Adicione, edite ou remova interações disponíveis na rotina diária (exceto refeições).
            </p>
          </div>
          {podeSalvar && (
            <PremiumButton type="button" variant="secondary" onClick={adicionarInteracao}>
              Adicionar interação
            </PremiumButton>
          )}
        </div>

        <div className="grid gap-3">
          {interacoesNaoRefeicao.map((item, indice) => (
            <div
              key={`${item.valor}-${indice}`}
              className="grid gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4"
            >
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label>
                  <span className="mb-1 block text-[10px] font-black uppercase text-gray-400">
                    Nome exibido
                  </span>
                  <input
                    type="text"
                    value={item.label || ''}
                    onChange={(event) => atualizarInteracao(indice, 'label', event.target.value)}
                    disabled={!podeSalvar}
                    className={inputClassName}
                  />
                </label>
                <label>
                  <span className="mb-1 block text-[10px] font-black uppercase text-gray-400">
                    Identificador interno
                  </span>
                  <input
                    type="text"
                    value={item.valor || ''}
                    onChange={(event) => atualizarInteracao(indice, 'valor', event.target.value)}
                    disabled={!podeSalvar || item.grupo === 'par_bagageiro'}
                    className={inputClassName}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto]">
                <label>
                  <span className="mb-1 block text-[10px] font-black uppercase text-gray-400">
                    Comportamento
                  </span>
                  <select
                    value={item.grupo || 'simples'}
                    onChange={(event) => atualizarInteracao(indice, 'grupo', event.target.value)}
                    disabled={!podeSalvar}
                    className={inputClassName}
                  >
                    {GRUPOS_INTERACAO.map((grupo) => (
                      <option key={grupo.id} value={grupo.id}>{grupo.label}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-end gap-2 pb-2">
                  <input
                    type="checkbox"
                    checked={Boolean(item.ativo)}
                    onChange={(event) => atualizarInteracao(indice, 'ativo', event.target.checked)}
                    disabled={!podeSalvar}
                    className="h-4 w-4 rounded border-gray-300 text-brand"
                  />
                  <span className="text-xs font-bold text-gray-700">Ativo</span>
                </label>
                {podeSalvar && (
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => removerInteracao(indice)}
                      className="rounded-xl border border-red-200 px-3 py-2 text-xs font-black text-red-600 hover:bg-red-50"
                    >
                      Remover
                    </button>
                  </div>
                )}
              </div>

              {item.grupo === 'par' && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label>
                    <span className="mb-1 block text-[10px] font-black uppercase text-gray-400">
                      Registro de retirada
                    </span>
                    <input
                      type="text"
                      value={item.tipo_retirada || ''}
                      onChange={(event) => atualizarInteracao(indice, 'tipo_retirada', event.target.value)}
                      disabled={!podeSalvar}
                      className={inputClassName}
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-[10px] font-black uppercase text-gray-400">
                      Registro de entrega
                    </span>
                    <input
                      type="text"
                      value={item.tipo_entrega || ''}
                      onChange={(event) => atualizarInteracao(indice, 'tipo_entrega', event.target.value)}
                      disabled={!podeSalvar}
                      className={inputClassName}
                    />
                  </label>
                </div>
              )}

              {item.grupo === 'simples' && (
                <p className="text-[11px] font-semibold text-gray-500">
                  O identificador interno será gravado como tipo de registro na rotina.
                </p>
              )}

              {item.grupo === 'observacao' && (
                <p className="text-[11px] font-semibold text-gray-500">
                  O identificador interno será gravado como tipo de registro; a equipe informará observação ao registrar.
                </p>
              )}

              {item.grupo === 'par_bagageiro' && (
                <p className="text-[11px] font-semibold text-gray-500">
                  Alterna automaticamente entre entrada e saída de volume no bagageiro.
                </p>
              )}
            </div>
          ))}
        </div>
      </article>
    </div>
  );

  const renderAbaModulos = () => (
    <article className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="text-base font-black text-gray-900">Módulos do projeto</h2>
      <p className="mt-1 text-xs font-semibold text-gray-500">
        Controle a visibilidade de funcionalidades no menu e nos fluxos operacionais.
      </p>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {Object.entries(ROTULOS_MODULOS).map(([chave, rotulo]) => (
          <Toggle
            key={chave}
            label={rotulo}
            checked={form.modulos?.[chave] !== false}
            onChange={(valor) => atualizarModulo(chave, valor)}
            disabled={!podeSalvar}
          />
        ))}
      </div>
    </article>
  );

  const renderCamposDocumento = (chave, campos) => {
    const doc = form.documentos?.[chave] || {};
    const imprimir = doc.imprimir !== false;

    return (
      <article key={chave} className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <Toggle
          label={campos.tituloSecao}
          description={campos.descricao}
          checked={imprimir}
          onChange={(valor) => atualizarDocumento(chave, 'imprimir', valor)}
          disabled={!podeSalvar}
        />

        {imprimir && (
          <div className="mt-4 grid gap-3">
            {campos.inputs.map((input) => (
              <label key={input.campo}>
                <span className="mb-1 block text-[10px] font-black uppercase text-gray-400">
                  {input.rotulo}
                </span>
                {input.tipo === 'textarea' ? (
                  <textarea
                    rows={input.linhas || 6}
                    value={doc[input.campo] || ''}
                    onChange={(event) => atualizarDocumento(chave, input.campo, event.target.value)}
                    disabled={!podeSalvar}
                    className={`${inputClassName} min-h-28 resize-y`}
                  />
                ) : (
                  <input
                    type="text"
                    value={doc[input.campo] || ''}
                    onChange={(event) => atualizarDocumento(chave, input.campo, event.target.value)}
                    disabled={!podeSalvar}
                    className={inputClassName}
                  />
                )}
              </label>
            ))}
          </div>
        )}
      </article>
    );
  };

  const renderAbaDocumentos = () => {
    const bagageiro = form.documentos?.termo_bagageiro || {};
    const imprimirBagageiro = bagageiro.imprimir !== false;

    return (
      <div className="grid gap-5">
        {renderCamposDocumento('termo_compromisso', {
          tituloSecao: 'Termo de compromisso (PIA)',
          descricao: 'Inclui o termo nas impressões do formulário PIA.',
          inputs: [
            { campo: 'titulo', rotulo: 'Título' },
            { campo: 'texto', rotulo: 'Texto', tipo: 'textarea', linhas: 12 },
          ],
        })}

        {renderCamposDocumento('termo_lgpd', {
          tituloSecao: 'Termo LGPD (PIA)',
          descricao: 'Inclui o termo de consentimento LGPD no formulário PIA.',
          inputs: [
            { campo: 'titulo', rotulo: 'Título' },
            { campo: 'subtitulo', rotulo: 'Subtítulo' },
            { campo: 'texto', rotulo: 'Texto', tipo: 'textarea', linhas: 10 },
          ],
        })}

        <article className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
          <Toggle
            label="Termo do bagageiro"
            description="Textos usados na impressão do termo de guarda volumes."
            checked={imprimirBagageiro}
            onChange={(valor) => atualizarDocumento('termo_bagageiro', 'imprimir', valor)}
            disabled={!podeSalvar}
          />

          {imprimirBagageiro && (
            <div className="mt-4 grid gap-3">
              <label>
                <span className="mb-1 block text-[10px] font-black uppercase text-gray-400">Título</span>
                <input
                  type="text"
                  value={bagageiro.titulo || ''}
                  onChange={(event) => atualizarDocumento('termo_bagageiro', 'titulo', event.target.value)}
                  disabled={!podeSalvar}
                  className={inputClassName}
                />
              </label>

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase text-gray-400">Itens (numerados)</span>
                  {podeSalvar && (
                    <button
                      type="button"
                      onClick={adicionarItemBagageiro}
                      className="text-xs font-black text-brand hover:underline"
                    >
                      Adicionar item
                    </button>
                  )}
                </div>
                <div className="grid gap-2">
                  {(bagageiro.itens || []).map((item, indice) => (
                    <div key={indice} className="flex gap-2">
                      <textarea
                        rows={2}
                        value={item}
                        onChange={(event) => atualizarItemBagageiro(indice, event.target.value)}
                        disabled={!podeSalvar}
                        className={`${inputClassName} min-h-16 resize-y`}
                      />
                      {podeSalvar && (
                        <button
                          type="button"
                          onClick={() => removerItemBagageiro(indice)}
                          className="shrink-0 rounded-xl border border-red-100 bg-red-50 px-3 text-xs font-black text-red-700"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {[
                ['compromisso', 'Compromisso', 3],
                ['retirada_titulo', 'Retirada — título', 1],
                ['retirada_subtitulo', 'Retirada — subtítulo', 2],
                ['retirada_texto', 'Retirada — texto', 4],
                ['rotulo_assinatura_funcionario', 'Rótulo assinatura funcionário', 1],
              ].map(([campo, rotulo, linhas]) => (
                <label key={campo}>
                  <span className="mb-1 block text-[10px] font-black uppercase text-gray-400">{rotulo}</span>
                  <textarea
                    rows={linhas}
                    value={bagageiro[campo] || ''}
                    onChange={(event) => atualizarDocumento('termo_bagageiro', campo, event.target.value)}
                    disabled={!podeSalvar}
                    className={`${inputClassName} resize-y`}
                  />
                </label>
              ))}
            </div>
          )}
        </article>
      </div>
    );
  };

  return (
    <AppShell>
      <Sidebar />

      <MainShell>
        <PageHeader
          eyebrow="Relatórios"
          title="Configuração operacional"
          subtitle="Refeições, portaria, módulos e documentos do projeto."
          icon="⚙"
          actions={(
            <Link
              to="/relatorios"
              className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-black text-gray-700 hover:bg-gray-50"
            >
              ← Voltar aos relatórios
            </Link>
          )}
        />

        <ScrollArea>
          {(erroCarregamento || erro || mensagem) && (
            <div className="mb-4 grid gap-2">
              {erroCarregamento ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">
                  {erroCarregamento}
                </div>
              ) : null}
              {erro ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
                  {erro}
                </div>
              ) : null}
              {mensagem ? (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm font-bold text-blue-700">
                  {mensagem}
                </div>
              ) : null}
            </div>
          )}

          {!podeSalvar && (
            <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">
              Somente o perfil Gestor pode alterar e salvar esta configuração. Você pode visualizar os valores atuais.
            </div>
          )}

          <section className="mb-5 flex flex-wrap gap-2">
            {ABAS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setAba(item.id)}
                className={`min-w-fit rounded-xl border px-4 py-2 text-xs font-black transition-colors ${
                  aba === item.id
                    ? 'border-brand bg-brand text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </section>

          {carregando ? (
            <div className="rounded-3xl border border-gray-100 bg-white p-12 text-center font-black text-brand animate-pulse">
              Carregando configuração operacional...
            </div>
          ) : (
            <form onSubmit={salvar} className="grid gap-5">
              {aba === 'refeicoes' && renderAbaRefeicoes()}
              {aba === 'portaria' && renderAbaPortaria()}
              {aba === 'modulos' && renderAbaModulos()}
              {aba === 'documentos' && renderAbaDocumentos()}

              <div className="flex flex-wrap gap-2">
                {podeSalvar && (
                  <>
                    <PremiumButton type="submit" variant="brand" disabled={salvando}>
                      {salvando ? 'Salvando...' : 'Salvar configuração'}
                    </PremiumButton>
                    <PremiumButton type="button" variant="secondary" onClick={restaurarPadrao} disabled={salvando}>
                      Restaurar padrão
                    </PremiumButton>
                  </>
                )}
              </div>
            </form>
          )}
        </ScrollArea>
      </MainShell>
    </AppShell>
  );
}
