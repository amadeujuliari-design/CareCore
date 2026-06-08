function GraficoLinhaRelatorio({ titulo, subtitulo, dados = [], series = [], children = null }) {
  const largura = 760;
  const altura = 260;
  const paddingX = 42;
  const paddingY = 30;
  const valores = dados.flatMap((item) => series.map((serie) => Number(item[serie.chave] || 0)));
  const maiorValor = Math.max(1, ...valores);

  const pontos = (serie) => {
    if (!dados.length) return '';

    return dados.map((item, index) => {
      const x = paddingX + (index * (largura - paddingX * 2)) / Math.max(1, dados.length - 1);
      const valor = Number(item[serie.chave] || 0);
      const y = altura - paddingY - (valor * (altura - paddingY * 2)) / maiorValor;
      return `${x},${y}`;
    }).join(' ');
  };

  return (
    <article className="bg-white border border-gray-100 rounded-3xl shadow-sm p-5">
      <div className="mb-5">
        <h3 className="text-base font-black text-gray-900">{titulo}</h3>
        {subtitulo && <p className="mt-1 text-xs font-semibold text-gray-500">{subtitulo}</p>}
      </div>

      {children}

      <div className="overflow-x-auto">
        {dados.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm font-semibold text-gray-500">
            Sem dados suficientes para desenhar evolução neste recorte.
          </div>
        ) : (
          <svg viewBox={`0 0 ${largura} ${altura}`} className="min-w-[620px] w-full h-[260px]">
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = paddingY + ratio * (altura - paddingY * 2);
              return (
                <line
                  key={ratio}
                  x1={paddingX}
                  x2={largura - paddingX}
                  y1={y}
                  y2={y}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                />
              );
            })}

            {series.map((serie) => (
              <polyline
                key={serie.chave}
                fill="none"
                stroke={serie.cor}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={pontos(serie)}
              />
            ))}

            {dados.map((item, index) => {
              const mostrarRotulo = dados.length <= 12 || index % Math.ceil(dados.length / 8) === 0 || index === dados.length - 1;
              if (!mostrarRotulo) return null;
              const x = paddingX + (index * (largura - paddingX * 2)) / Math.max(1, dados.length - 1);

              return (
                <text key={item.chave} x={x} y={altura - 7} textAnchor="middle" className="fill-slate-500 text-[10px] font-semibold">
                  {item.rotulo}
                </text>
              );
            })}
          </svg>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500">
        {series.map((serie) => (
          <span key={serie.chave} className="inline-flex items-center gap-2">
            <i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: serie.cor }} />
            {serie.label}
          </span>
        ))}
      </div>
    </article>
  );
}

export function RelatoriosEvolucaoGraficos({
  dadosEvolucao,
  dadosPendenciasTecnicasEvolucao,
  filtros,
  setTecnicoPendenciasEvolucaoId,
  tecnicoPendenciasSelecionadoId,
  tecnicoPendenciasSelecionadoNome,
  tecnicosComPendenciasEvolucao,
}) {
  return (
    <section className="mt-6 grid grid-cols-1 gap-5">
      <GraficoLinhaRelatorio
        titulo="Evolução de atendimentos"
        subtitulo="Subidas e quedas dos registros de rotina ao longo dos dias."
        dados={dadosEvolucao.serie}
        series={[
          { chave: 'atendimentos', label: 'Atendimentos', cor: '#2563eb' },
        ]}
      />
      <GraficoLinhaRelatorio
        titulo="Entradas, saídas e almoços"
        subtitulo="Comparativo diário entre os principais tipos de lançamento."
        dados={dadosEvolucao.serie}
        series={[
          { chave: 'entradas', label: 'Entradas', cor: '#10b981' },
          { chave: 'saidas', label: 'Saídas', cor: '#f97316' },
          { chave: 'almocos', label: 'Almoços', cor: '#6366f1' },
        ]}
      />
      <GraficoLinhaRelatorio
        titulo="Ocorrências abertas e resolvidas"
        subtitulo="Acompanhamento da demanda técnica ao longo do período."
        dados={dadosEvolucao.serie}
        series={[
          { chave: 'ocorrencias', label: 'Abertas', cor: '#ef4444' },
          { chave: 'resolvidas', label: 'Resolvidas', cor: '#22c55e' },
        ]}
      />
      <GraficoLinhaRelatorio
        titulo="Evolução das pendências técnicas"
        subtitulo={`Pendências abertas, resolvidas e saldo acumulado no recorte para ${tecnicoPendenciasSelecionadoNome}.`}
        dados={dadosPendenciasTecnicasEvolucao}
        series={[
          { chave: 'pendenciasAbertas', label: 'Abertas', cor: '#f97316' },
          { chave: 'pendenciasResolvidas', label: 'Resolvidas', cor: '#22c55e' },
          { chave: 'saldoPendencias', label: 'Saldo pendente', cor: '#7c3aed' },
        ]}
      >
        <div className="mb-4 grid grid-cols-1 gap-2 sm:max-w-xs">
          <label className="block text-[10px] font-black uppercase text-gray-400">
            Ver pendências por técnico
          </label>
          <select
            value={tecnicoPendenciasSelecionadoId}
            onChange={(event) => setTecnicoPendenciasEvolucaoId(event.target.value)}
            disabled={Boolean(filtros.tecnicoId)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-brand disabled:bg-gray-50 disabled:text-gray-400"
          >
            <option value="">Todos os técnicos</option>
            {tecnicosComPendenciasEvolucao.map((tecnico) => (
              <option key={tecnico.id} value={tecnico.id}>
                {tecnico.nome}
              </option>
            ))}
          </select>
          {filtros.tecnicoId && (
            <p className="text-[11px] font-semibold text-gray-500">
              O filtro geral de técnico está aplicado, então este gráfico segue o mesmo profissional.
            </p>
          )}
        </div>
      </GraficoLinhaRelatorio>
      <GraficoLinhaRelatorio
        titulo="Novos acolhimentos"
        subtitulo="Evolução de entradas cadastrais no recorte selecionado."
        dados={dadosEvolucao.serie}
        series={[
          { chave: 'novos', label: 'Novos', cor: '#8b5cf6' },
        ]}
      />
    </section>
  );
}
