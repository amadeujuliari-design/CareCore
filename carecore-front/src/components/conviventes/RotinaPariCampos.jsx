import {
  DIAS_TRABALHO,
  ESCALAS_TRABALHO,
  ETAPAS_ESCOLARES,
  TURNOS_ESCOLARES,
  diasDaEscala,
  escalaDosDias,
  listaDias,
} from '../../utils/rotinaPariCampos';

const campoClasse = 'w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none text-sm bg-white';

export default function RotinaPariCampos({ formData, setFormData }) {
  const diasMarcados = new Set(listaDias(formData.dias_trabalho));

  function atualizar(parcial) {
    setFormData((prev) => ({ ...prev, ...parcial }));
  }

  function escolherEscala(escala) {
    const dias = diasDaEscala(escala);
    const parcial = { escala_trabalho: escala };
    if (dias !== undefined) parcial.dias_trabalho = dias.join(',');
    atualizar(parcial);
  }

  function alternarDia(codigo) {
    const atuais = listaDias(formData.dias_trabalho);
    const proximos = atuais.includes(codigo)
      ? atuais.filter((dia) => dia !== codigo)
      : [...atuais, codigo];
    atualizar({
      dias_trabalho: proximos.join(','),
      escala_trabalho: escalaDosDias(proximos, formData.escala_trabalho || ''),
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div>
        <label className="block text-xs font-bold text-slate-800 mb-1">Trabalho / ocupação</label>
        <input
          type="text"
          name="ocupacao_trabalho"
          value={formData.ocupacao_trabalho || ''}
          onChange={(event) => atualizar({ ocupacao_trabalho: event.target.value })}
          placeholder="Ex.: servente de pedreiro"
          className={campoClasse}
        />
        <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Escala</label>
            <select
              name="escala_trabalho"
              value={formData.escala_trabalho || ''}
              onChange={(event) => escolherEscala(event.target.value)}
              className={campoClasse}
            >
              {ESCALAS_TRABALHO.map(([codigo, rotulo]) => (
                <option key={codigo || 'vazio'} value={codigo}>{rotulo}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Início da jornada</label>
            <input
              type="time"
              name="trabalho_inicio"
              value={formData.trabalho_inicio || ''}
              onChange={(event) => atualizar({ trabalho_inicio: event.target.value })}
              className={campoClasse}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Fim da jornada</label>
            <input
              type="time"
              name="trabalho_fim"
              value={formData.trabalho_fim || ''}
              onChange={(event) => atualizar({ trabalho_fim: event.target.value })}
              className={campoClasse}
            />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {DIAS_TRABALHO.map(([codigo, rotulo]) => {
            const marcado = diasMarcados.has(codigo);
            return (
              <button
                key={codigo}
                type="button"
                onClick={() => alternarDia(codigo)}
                className={`rounded-full px-3 py-1 text-xs font-bold ${marcado ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}
              >
                {rotulo}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-800 mb-1">Parcerias</label>
        <textarea
          name="parcerias"
          value={formData.parcerias || ''}
          onChange={(event) => atualizar({ parcerias: event.target.value })}
          rows={2}
          placeholder="Ex.: Cozinha escola; Educação financeira"
          className={`${campoClasse} resize-y min-h-[2.75rem]`}
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-800 mb-1">Informações escolares</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Etapa</label>
            <select
              name="etapa_escolar"
              value={formData.etapa_escolar || ''}
              onChange={(event) => atualizar({
                etapa_escolar: event.target.value,
                curso_escolar: event.target.value === 'curso' ? (formData.curso_escolar || '') : '',
              })}
              className={campoClasse}
            >
              {ETAPAS_ESCOLARES.map(([codigo, rotulo]) => (
                <option key={codigo || 'vazio'} value={codigo}>{rotulo}</option>
              ))}
            </select>
          </div>
          {formData.etapa_escolar === 'curso' && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Qual curso</label>
              <input
                type="text"
                name="curso_escolar"
                value={formData.curso_escolar || ''}
                onChange={(event) => atualizar({ curso_escolar: event.target.value })}
                className={campoClasse}
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Turno</label>
            <select
              name="turno_escolar"
              value={formData.turno_escolar || ''}
              onChange={(event) => atualizar({ turno_escolar: event.target.value })}
              className={campoClasse}
            >
              {TURNOS_ESCOLARES.map(([codigo, rotulo]) => (
                <option key={codigo || 'vazio'} value={codigo}>{rotulo}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Início</label>
              <input
                type="time"
                name="escolar_inicio"
                value={formData.escolar_inicio || ''}
                onChange={(event) => atualizar({ escolar_inicio: event.target.value })}
                className={campoClasse}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Fim</label>
              <input
                type="time"
                name="escolar_fim"
                value={formData.escolar_fim || ''}
                onChange={(event) => atualizar({ escolar_fim: event.target.value })}
                className={campoClasse}
              />
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-amber-900 mb-1">Avisos/Alertas</label>
        <textarea
          name="observacao_operacional"
          value={formData.observacao_operacional || ''}
          onChange={(event) => atualizar({ observacao_operacional: event.target.value })}
          rows={2}
          placeholder="Ex.: não está na lista de refeição, advertência, SISA. Aparece na lista ao parar o mouse. Apague e salve para remover."
          className="w-full px-3 py-1.5 border border-amber-200 rounded-lg bg-white focus:ring-2 focus:ring-amber-400 outline-none text-sm text-slate-800 resize-y min-h-[2.75rem]"
        />
      </div>
    </div>
  );
}
