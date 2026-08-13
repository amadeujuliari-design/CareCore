import { useRef } from 'react';

import { classeOrigemPia, rotuloOrigemPia } from '../../config/piaOrigemConfig';
import ModalAlertaOk from '../ModalAlertaOk';
import { piaPrincipalTemProjetoDeVida, rotulosDestinosPia } from '../../utils/conviventesProntuarioUtils';

function BadgeOrigemPia({ origemModulo }) {
  const rotulo = rotuloOrigemPia(origemModulo);
  if (!rotulo) return null;
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${classeOrigemPia(origemModulo)}`}>
      Espelhado de {rotulo}
    </span>
  );
}

function BlocoProjetoDeVidaPia({ registro, compacto = false }) {
  if (!piaPrincipalTemProjetoDeVida(registro)) return null;
  const destinos = rotulosDestinosPia(registro);
  const caixa = compacto
    ? 'rounded-lg border border-violet-100 bg-violet-50/70 p-2'
    : 'rounded-lg border border-violet-100 bg-violet-50 p-3';

  return (
    <div className={`${caixa} space-y-2 text-xs`}>
      <p className="font-black uppercase text-violet-800">Projeto de vida</p>
      {registro.expectativas_servico && (
        <div>
          <p className="font-bold text-violet-700">Expectativas em relação ao serviço</p>
          <p className="whitespace-pre-wrap text-violet-950">{registro.expectativas_servico}</p>
        </div>
      )}
      {registro.expectativas_vida_projetos && (
        <div>
          <p className="font-bold text-violet-700">Expectativas de vida / projetos</p>
          <p className="whitespace-pre-wrap text-violet-950">{registro.expectativas_vida_projetos}</p>
        </div>
      )}
      {destinos.length > 0 && (
        <div>
          <p className="font-bold text-violet-700">Destinos</p>
          <p className="text-violet-950">{destinos.join(' · ')}</p>
        </div>
      )}
      {registro.destino_explicacao && (
        <div>
          <p className="font-bold text-violet-700">Explicação dos destinos</p>
          <p className="whitespace-pre-wrap text-violet-950">{registro.destino_explicacao}</p>
        </div>
      )}
      {registro.dificuldades_planos && (
        <div>
          <p className="font-bold text-violet-700">Dificuldades para realizar planos</p>
          <p className="whitespace-pre-wrap text-violet-950">{registro.dificuldades_planos}</p>
        </div>
      )}
    </div>
  );
}

function textoOuNaoInformado(valor) {
  const texto = String(valor || '').trim();
  return texto || 'Não informado';
}

function ResumoPiaPrincipalFixo({ registro }) {
  if (!registro) return null;

  return (
    <div className="rounded-xl border border-violet-200 bg-white p-3 space-y-2">
      <p className="text-[10px] font-black uppercase text-violet-700">Em vigor no PIA principal</p>
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-2 text-xs">
        <p className="font-black uppercase text-blue-700 mb-1">Objetivos</p>
        <p className="whitespace-pre-wrap text-blue-900">{textoOuNaoInformado(registro.objetivos)}</p>
      </div>
      <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-2 text-xs">
        <p className="font-black uppercase text-emerald-700 mb-1">Encaminhamentos</p>
        <p className="whitespace-pre-wrap text-emerald-900">{textoOuNaoInformado(registro.encaminhamentos)}</p>
      </div>
      {piaPrincipalTemProjetoDeVida(registro) ? (
        <BlocoProjetoDeVidaPia registro={registro} compacto />
      ) : (
        <div className="rounded-lg border border-violet-100 bg-violet-50/70 p-2 text-xs">
          <p className="font-black uppercase text-violet-800 mb-1">Projeto de vida</p>
          <p className="text-violet-950">Não informado</p>
        </div>
      )}
    </div>
  );
}

function EvolucaoPiaCard({ evolucao, evolucoesPorRegistroPia, profundidade = 0, onEditar, onExcluir, podeExcluir, excluindoId }) {
  const filhas = evolucoesPorRegistroPia[evolucao.id] || [];

  return (
    <div className={profundidade > 0 ? 'ml-1' : ''}>
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-black uppercase text-indigo-500">Evolução</p>
              <BadgeOrigemPia origemModulo={evolucao.origem_modulo} />
            </div>
            <h5 className="text-sm font-black text-indigo-950">{evolucao.subtitulo || 'Sem subtítulo'}</h5>
            <span className="mt-2 inline-flex rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase text-gray-600 border border-indigo-100">
              {evolucao.status}
            </span>
          </div>
          <div className="text-xs text-indigo-700 md:text-right">
            <p>{new Date(evolucao.data_registro).toLocaleString('pt-BR')}</p>
            <p className="font-bold">{evolucao.usuario_nome || 'Usuário'}</p>
          </div>
        </div>

        <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{evolucao.descricao}</p>

        {(evolucao.objetivos || evolucao.encaminhamentos) && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {evolucao.objetivos && (
              <div className="rounded-lg border border-blue-100 bg-white p-3">
                <p className="font-black uppercase text-blue-700 mb-1">Objetivos</p>
                <p className="whitespace-pre-wrap text-blue-900">{evolucao.objetivos}</p>
              </div>
            )}
            {evolucao.encaminhamentos && (
              <div className="rounded-lg border border-emerald-100 bg-white p-3">
                <p className="font-black uppercase text-emerald-700 mb-1">Encaminhamentos</p>
                <p className="whitespace-pre-wrap text-emerald-900">{evolucao.encaminhamentos}</p>
              </div>
            )}
          </div>
        )}

        {onEditar || (podeExcluir && onExcluir) ? (
          <div className="mt-3 flex flex-wrap justify-end gap-3">
            {onEditar && (
              <button type="button" onClick={() => onEditar(evolucao)} className="text-[11px] font-black text-indigo-600 hover:underline">
                Editar
              </button>
            )}
            {podeExcluir && onExcluir && (
              <button
                type="button"
                onClick={() => onExcluir(evolucao)}
                disabled={excluindoId === evolucao.id}
                className="text-[11px] font-black text-red-700 hover:underline disabled:opacity-50"
              >
                {excluindoId === evolucao.id ? 'Excluindo...' : 'Excluir'}
              </button>
            )}
          </div>
        ) : null}
      </div>

      {filhas.length > 0 && (
        <div className="mt-3 border-l-2 border-violet-200 pl-3 space-y-3">
          {filhas.map((filha) => (
            <EvolucaoPiaCard
              key={filha.id}
              evolucao={filha}
              evolucoesPorRegistroPia={evolucoesPorRegistroPia}
              profundidade={profundidade + 1}
              onEditar={onEditar}
              onExcluir={onExcluir}
              podeExcluir={podeExcluir}
              excluindoId={excluindoId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function tituloFormularioPia({ formularioPiaEdicao, formularioPiaEvolucao }) {
  if (formularioPiaEdicao) {
    return formularioPiaEvolucao ? 'Editar evolução do PIA' : 'Editar PIA principal';
  }
  return formularioPiaEvolucao ? 'Evoluir PIA existente' : 'Novo PIA principal';
}

function rotuloBotaoSalvarPia({ formularioPiaEdicao, formularioPiaEvolucao, salvandoPia }) {
  if (salvandoPia) return 'Salvando...';
  if (formularioPiaEdicao) return 'Salvar alterações';
  return formularioPiaEvolucao ? 'Salvar evolução' : 'Criar PIA principal';
}

export default function ProntuarioPia({
  editandoId,
  formData,
  handleChange,
  formPia,
  setFormPia,
  formularioPiaEdicao,
  formularioPiaEvolucao,
  registroPiaMaisRecente,
  registrosPia,
  registrosPiaPrincipais,
  evolucoesPorRegistroPia,
  imprimirPiaEvolucao,
  imprimirFormularioPia,
  loadingPia,
  salvandoPia,
  temasEvolucaoPia,
  prepararEdicaoPia,
  cancelarEdicaoPia,
  prepararEvolucaoPia,
  prepararNovoPiaPrincipal,
  handleSalvarRegistroPia,
  handleExcluirEvolucaoPia,
  podeExcluirEvolucaoPia,
  alertaSubtituloPia,
  fecharAlertaSubtituloPia,
  excluindoPiaId,
  carregarRegistrosPia,
  carregarMaisRegistrosPia,
  piaTemMais,
  totalRegistrosPia,
}) {
  const subtituloRef = useRef(null);
  const registroPiaPrincipalFoco = formPia.registro_pai_id
    ? registrosPiaPrincipais.find((registro) => registro.id === formPia.registro_pai_id)
    : null;
  const mostrarResumoPrincipal = Boolean(formularioPiaEvolucao && registroPiaPrincipalFoco);

  const fecharAlertaEFocarSubtitulo = () => {
    fecharAlertaSubtituloPia?.();
    window.requestAnimationFrame(() => {
      subtituloRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      subtituloRef.current?.focus();
    });
  };

  if (!editandoId) {
    return (
      <div className="space-y-5">
        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 text-center">
          <h3 className="text-sm font-bold text-yellow-800">Ação Necessária</h3>
          <p className="text-xs text-yellow-700 mt-1">Salve os dados do acolhido para habilitar o PIA.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4 space-y-3">
        <h2 className="text-base font-black text-indigo-950">PIA - Plano Individual de Atendimento</h2>
        <p className="text-xs text-indigo-700">Datas do formulário oficial (salvas no prontuário) e registro narrativo do plano.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-indigo-900 mb-1">Data de início do PIA</label>
            <input type="date" name="data_inicio_pia" value={formData.data_inicio_pia || ''} onChange={handleChange} className="w-full px-3 py-2 border border-indigo-200 rounded-lg bg-white text-sm" />
            <p className="text-[10px] text-indigo-600 mt-1">Se vazio, na impressão usa a data de entrada no projeto.</p>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-indigo-900 mb-1">Está em São Paulo desde</label>
            <input type="date" name="em_sao_paulo_desde" value={formData.em_sao_paulo_desde || ''} onChange={handleChange} className="w-full px-3 py-2 border border-indigo-200 rounded-lg bg-white text-sm" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" onClick={() => imprimirFormularioPia('manual')} className="rounded-lg border border-indigo-300 bg-white px-3 py-2 text-[11px] font-black text-indigo-800 hover:bg-indigo-100">Imprimir formulário (manual)</button>
          <button type="button" onClick={() => imprimirFormularioPia('completo')} className="rounded-lg border border-indigo-300 bg-indigo-600 px-3 py-2 text-[11px] font-black text-white hover:bg-indigo-700">Imprimir formulário (completo)</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1 bg-indigo-50 p-4 rounded-xl border border-indigo-100 h-fit space-y-3">
          <div>
            <h3 className="text-sm font-black text-indigo-900">
              {tituloFormularioPia({ formularioPiaEdicao, formularioPiaEvolucao })}
            </h3>
            <p className="text-[11px] text-indigo-700 mt-1">
              {formularioPiaEdicao
                ? 'Altere o texto e salve para corrigir o registro já gravado.'
                : formularioPiaEvolucao
                  ? 'A evolução fica vinculada ao PIA selecionado, com data, hora e responsável.'
                  : 'Abra um registro principal para concentrar as evoluções futuras deste plano.'}
            </p>
          </div>

          {!formularioPiaEdicao && registroPiaMaisRecente && (
            <div className="grid grid-cols-1 gap-2">
              <button type="button" onClick={() => prepararEvolucaoPia(registroPiaMaisRecente)} className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-100">
                Evoluir PIA atual
              </button>
              <button type="button" onClick={prepararNovoPiaPrincipal} className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800 hover:bg-amber-100">
                Abrir novo PIA principal
              </button>
            </div>
          )}

          {!formularioPiaEdicao && formularioPiaEvolucao && registrosPiaPrincipais.length > 1 && (
            <select
              value={formPia.registro_pai_id}
              onChange={(e) => prepararEvolucaoPia(registrosPiaPrincipais.find(registro => registro.id === e.target.value))}
              className="w-full px-3 py-2 border border-indigo-200 rounded-lg outline-none bg-white text-sm"
            >
              {registrosPiaPrincipais.map((registro) => (
                <option key={registro.id} value={registro.id}>
                  {registro.titulo} - {new Date(registro.data_registro).toLocaleDateString('pt-BR')}
                </option>
              ))}
            </select>
          )}

          {!formularioPiaEvolucao ? (
            <input
              type="text"
              value={formPia.titulo}
              onChange={(e) => setFormPia(prev => ({ ...prev, titulo: e.target.value }))}
              placeholder="Título do PIA principal"
              className="w-full px-3 py-2 border border-indigo-200 rounded-lg outline-none bg-white text-sm"
            />
          ) : (
            <div className="rounded-lg border border-indigo-200 bg-white p-3">
              <p className="text-[10px] font-black uppercase text-indigo-500">Título do registro</p>
              <p className="text-sm font-black text-indigo-900">Evolução</p>
            </div>
          )}

          {formularioPiaEvolucao && (
            <>
              <input
                ref={subtituloRef}
                type="text"
                list="temas-evolucao-pia"
                value={formPia.subtitulo}
                onChange={(e) => setFormPia(prev => ({ ...prev, subtitulo: e.target.value }))}
                placeholder="Subtítulo/tema da evolução"
                className="w-full px-3 py-2 border border-indigo-200 rounded-lg outline-none bg-white text-sm"
              />
              <datalist id="temas-evolucao-pia">
                {temasEvolucaoPia.map((tema) => (
                  <option key={tema} value={tema} />
                ))}
              </datalist>
            </>
          )}

          <textarea
            value={formPia.descricao}
            onChange={(e) => setFormPia(prev => ({ ...prev, descricao: e.target.value }))}
            rows="4"
            placeholder={formularioPiaEvolucao ? 'Descrição da evolução do atendimento' : 'Descrição inicial do plano individual'}
            className="w-full px-3 py-2 border border-indigo-200 rounded-lg outline-none bg-white text-sm resize-y min-h-[6rem]"
          />

          <textarea
            value={formPia.objetivos}
            onChange={(e) => setFormPia(prev => ({ ...prev, objetivos: e.target.value }))}
            rows="2"
            placeholder="Objetivos/metas trabalhadas"
            className="w-full px-3 py-2 border border-indigo-200 rounded-lg outline-none bg-white text-sm resize-none"
          />

          <textarea
            value={formPia.encaminhamentos}
            onChange={(e) => setFormPia(prev => ({ ...prev, encaminhamentos: e.target.value }))}
            rows="2"
            placeholder="Encaminhamentos e próximos passos"
            className="w-full px-3 py-2 border border-indigo-200 rounded-lg outline-none bg-white text-sm resize-none"
          />

          {!formularioPiaEvolucao && (
            <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 space-y-2">
              <p className="text-[11px] font-black uppercase text-violet-800">Projeto de vida (formulário PIA — seção 8)</p>
              <textarea value={formPia.expectativas_servico || ''} onChange={(e) => setFormPia((p) => ({ ...p, expectativas_servico: e.target.value }))} rows="2" placeholder="Expectativas em relação ao serviço" className="w-full px-3 py-2 border border-violet-200 rounded-lg bg-white text-sm" />
              <textarea value={formPia.expectativas_vida_projetos || ''} onChange={(e) => setFormPia((p) => ({ ...p, expectativas_vida_projetos: e.target.value }))} rows="3" placeholder="Expectativas de vida / projetos" className="w-full px-3 py-2 border border-violet-200 rounded-lg bg-white text-sm" />
              <div className="space-y-1 text-xs">
                <label className="flex gap-2"><input type="checkbox" checked={formPia.destino_siat_iii} onChange={(e) => setFormPia((p) => ({ ...p, destino_siat_iii: e.target.checked }))} /> SIAT III / Hotel Social / República</label>
                <label className="flex gap-2"><input type="checkbox" checked={formPia.destino_moradia_autonoma} onChange={(e) => setFormPia((p) => ({ ...p, destino_moradia_autonoma: e.target.checked }))} /> Moradia Autônoma</label>
                <label className="flex gap-2"><input type="checkbox" checked={formPia.destino_retorno_familiar} onChange={(e) => setFormPia((p) => ({ ...p, destino_retorno_familiar: e.target.checked }))} /> Retorno Familiar</label>
              </div>
              <textarea value={formPia.destino_explicacao || ''} onChange={(e) => setFormPia((p) => ({ ...p, destino_explicacao: e.target.value }))} rows="2" placeholder="Explicação dos destinos" className="w-full px-3 py-2 border border-violet-200 rounded-lg bg-white text-sm" />
              <textarea value={formPia.dificuldades_planos || ''} onChange={(e) => setFormPia((p) => ({ ...p, dificuldades_planos: e.target.value }))} rows="2" placeholder="Maiores dificuldades para realizar planos/projetos" className="w-full px-3 py-2 border border-violet-200 rounded-lg bg-white text-sm" />
            </div>
          )}

          <div>
            <label className="mb-1 block text-[11px] font-bold text-indigo-900">Status do registro</label>
            <select
              value={formPia.status}
              onChange={(e) => setFormPia(prev => ({ ...prev, status: e.target.value }))}
              className="w-full px-3 py-2 border border-indigo-200 rounded-lg outline-none bg-white text-sm"
            >
              <option value="Em acompanhamento">Em acompanhamento</option>
              <option value="Pendente">Pendente</option>
              <option value="Concluído">Concluído</option>
              <option value="Revisar">Revisar</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleSalvarRegistroPia}
            disabled={salvandoPia}
            className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-black disabled:opacity-50"
          >
            {rotuloBotaoSalvarPia({ formularioPiaEdicao, formularioPiaEvolucao, salvandoPia })}
          </button>

          {formularioPiaEdicao && (
            <button
              type="button"
              onClick={cancelarEdicaoPia}
              disabled={salvandoPia}
              className="w-full py-2 rounded-lg border border-indigo-200 bg-white text-sm font-black text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
            >
              Cancelar edição
            </button>
          )}

          {mostrarResumoPrincipal && <ResumoPiaPrincipalFixo registro={registroPiaPrincipalFoco} />}
        </div>

        <div className="lg:col-span-2">
          <div className="flex flex-col gap-2 mb-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-xs font-semibold text-gray-700 uppercase">Histórico do PIA ({totalRegistrosPia || registrosPia.length})</h3>
            <div className="flex flex-wrap gap-2">
              {registrosPiaPrincipais.length > 0 && (
                <button
                  type="button"
                  onClick={imprimirPiaEvolucao}
                  className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-[11px] font-black text-indigo-700 hover:bg-indigo-100"
                >
                  Imprimir evolução do PIA
                </button>
              )}
              <button type="button" onClick={() => carregarRegistrosPia(editandoId)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[11px] font-bold text-indigo-600 hover:bg-gray-50">Atualizar</button>
            </div>
          </div>

          {loadingPia ? (
            <div className="flex justify-center p-8"><p className="text-indigo-600 font-bold animate-pulse text-sm">Carregando PIA...</p></div>
          ) : registrosPiaPrincipais.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl">
              <p className="text-gray-500 text-sm font-medium">Nenhum PIA principal registrado até o momento.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {registrosPiaPrincipais.map((registro) => {
                const evolucoes = evolucoesPorRegistroPia[registro.id] || [];
                const editandoEste = formularioPiaEdicao && formPia.id === registro.id;

                return (
                  <article
                    key={registro.id}
                    className={`bg-white border rounded-xl p-4 shadow-sm ${editandoEste ? 'border-amber-300 ring-2 ring-amber-100' : 'border-gray-200'}`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase text-indigo-700 border border-indigo-100">
                            PIA principal
                          </span>
                          <BadgeOrigemPia origemModulo={registro.origem_modulo} />
                        </div>
                        <h4 className="mt-2 text-sm font-black text-gray-900">{registro.titulo}</h4>
                        {registro.subtitulo && (
                          <p className="mt-1 text-xs font-semibold text-indigo-700">{registro.subtitulo}</p>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 md:text-right">
                        <p>{new Date(registro.data_registro).toLocaleString('pt-BR')}</p>
                        <p className="font-bold">{registro.usuario_nome || 'Usuário'}</p>
                      </div>
                    </div>

                    <p className="mt-3 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-700 border border-gray-100">{registro.descricao}</p>

                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-[10px] font-black uppercase text-gray-600 w-fit">{registro.status}</span>
                      <div className="flex flex-wrap gap-3">
                        <button type="button" onClick={() => prepararEdicaoPia(registro)} className="text-[11px] font-black text-amber-700 hover:underline">
                          Editar
                        </button>
                        <button type="button" onClick={() => prepararEvolucaoPia(registro)} className="text-[11px] font-black text-indigo-600 hover:underline">
                          Evoluir este PIA
                        </button>
                      </div>
                    </div>

                    {evolucoes.length > 0 && (
                      <div className="mt-4 border-l-2 border-indigo-100 pl-4 space-y-3">
                        {evolucoes.map((evolucao) => (
                          <EvolucaoPiaCard
                            key={evolucao.id}
                            evolucao={evolucao}
                            evolucoesPorRegistroPia={evolucoesPorRegistroPia}
                            onEditar={prepararEdicaoPia}
                            onExcluir={handleExcluirEvolucaoPia}
                            podeExcluir={podeExcluirEvolucaoPia}
                            excluindoId={excluindoPiaId}
                          />
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
              {piaTemMais && (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={() => carregarMaisRegistrosPia(editandoId)}
                    disabled={loadingPia}
                    className="rounded-lg border border-indigo-200 bg-white px-4 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                  >
                    {loadingPia ? 'Carregando...' : 'Carregar mais registros'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ModalAlertaOk
        aberto={Boolean(alertaSubtituloPia)}
        titulo="Subtítulo obrigatório"
        mensagem={alertaSubtituloPia}
        onFechar={fecharAlertaEFocarSubtitulo}
        rotuloBotao="OK, vou preencher"
      />
    </div>
  );
}
