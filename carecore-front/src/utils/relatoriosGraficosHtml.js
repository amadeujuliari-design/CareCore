function gerarGraficoRelatorioHtml({ titulo, subtitulo, dados: dadosGrafico = [], series = [] }) {
  const largura = 760;
  const altura = 260;
  const paddingX = 42;
  const paddingY = 30;
  const valores = dadosGrafico.flatMap((item) => series.map((serie) => Number(item[serie.chave] || 0)));
  const maiorValor = Math.max(1, ...valores);
  const pontos = (serie) => {
    if (!dadosGrafico.length) return '';

    return dadosGrafico.map((item, index) => {
      const x = paddingX + (index * (largura - paddingX * 2)) / Math.max(1, dadosGrafico.length - 1);
      const valor = Number(item[serie.chave] || 0);
      const y = altura - paddingY - (valor * (altura - paddingY * 2)) / maiorValor;
      return `${x},${y}`;
    }).join(' ');
  };
  const linhasGrade = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const y = paddingY + ratio * (altura - paddingY * 2);
    return `<line x1="${paddingX}" x2="${largura - paddingX}" y1="${y}" y2="${y}" stroke="#e5e7eb" stroke-width="1" />`;
  }).join('');
  const polylines = series.map((serie) => (
    `<polyline fill="none" stroke="${serie.cor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${pontos(serie)}" />`
  )).join('');
  const rotulos = dadosGrafico.map((item, index) => {
    const mostrarRotulo = dadosGrafico.length <= 12 || index % Math.ceil(dadosGrafico.length / 8) === 0 || index === dadosGrafico.length - 1;
    if (!mostrarRotulo) return '';

    const x = paddingX + (index * (largura - paddingX * 2)) / Math.max(1, dadosGrafico.length - 1);
    return `<text x="${x}" y="${altura - 7}" text-anchor="middle" fill="#64748b" font-size="10" font-weight="600">${item.rotulo}</text>`;
  }).join('');
  const legenda = series.map((serie) => (
    `<span><i style="display:inline-block;width:10px;height:10px;border-radius:999px;background:${serie.cor};margin-right:6px;"></i>${serie.label}</span>`
  )).join('');

  return `
      <section style="border:1px solid #e5e7eb;border-radius:16px;padding:16px;margin-bottom:18px;break-inside:avoid;">
        <h2 style="font-size:16px;margin:0 0 4px;color:#111827;">${titulo}</h2>
        ${subtitulo ? `<p style="font-size:12px;color:#6b7280;margin:0 0 12px;">${subtitulo}</p>` : ''}
        ${dadosGrafico.length === 0 ? (
    '<div style="padding:24px;text-align:center;color:#6b7280;border:1px dashed #d1d5db;border-radius:12px;">Sem dados suficientes para desenhar evolução neste recorte.</div>'
  ) : (
    `<svg viewBox="0 0 ${largura} ${altura}" style="width:100%;height:260px;">${linhasGrade}${polylines}${rotulos}</svg>`
  )}
        <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:12px;font-weight:700;color:#64748b;margin-top:8px;">${legenda}</div>
      </section>
    `;
}

export function gerarGraficosEvolucaoHtml({
  dadosEvolucao,
  dadosPendenciasTecnicasEvolucao,
  tecnicoPendenciasSelecionadoNome,
}) {
  return [
    gerarGraficoRelatorioHtml({
      titulo: 'Evolução de atendimentos',
      subtitulo: 'Subidas e quedas dos registros de rotina ao longo dos dias.',
      dados: dadosEvolucao.serie,
      series: [{ chave: 'atendimentos', label: 'Atendimentos', cor: '#2563eb' }],
    }),
    gerarGraficoRelatorioHtml({
      titulo: 'Entradas, saídas e almoços',
      subtitulo: 'Comparativo diário entre os principais tipos de lançamento.',
      dados: dadosEvolucao.serie,
      series: [
        { chave: 'entradas', label: 'Entradas', cor: '#10b981' },
        { chave: 'saidas', label: 'Saídas', cor: '#f97316' },
        { chave: 'almocos', label: 'Almoços', cor: '#6366f1' },
      ],
    }),
    gerarGraficoRelatorioHtml({
      titulo: 'Ocorrências abertas e resolvidas',
      subtitulo: 'Acompanhamento da demanda técnica ao longo do período.',
      dados: dadosEvolucao.serie,
      series: [
        { chave: 'ocorrencias', label: 'Abertas', cor: '#ef4444' },
        { chave: 'resolvidas', label: 'Resolvidas', cor: '#22c55e' },
      ],
    }),
    gerarGraficoRelatorioHtml({
      titulo: 'Evolução das pendências técnicas',
      subtitulo: `Pendências abertas, resolvidas e saldo acumulado no recorte para ${tecnicoPendenciasSelecionadoNome}.`,
      dados: dadosPendenciasTecnicasEvolucao,
      series: [
        { chave: 'pendenciasAbertas', label: 'Abertas', cor: '#f97316' },
        { chave: 'pendenciasResolvidas', label: 'Resolvidas', cor: '#22c55e' },
        { chave: 'saldoPendencias', label: 'Saldo pendente', cor: '#7c3aed' },
      ],
    }),
    gerarGraficoRelatorioHtml({
      titulo: 'Novos acolhimentos',
      subtitulo: 'Evolução de entradas cadastrais no recorte selecionado.',
      dados: dadosEvolucao.serie,
      series: [{ chave: 'novos', label: 'Novos', cor: '#8b5cf6' }],
    }),
  ].join('');
}
