/** Dados normalizados da carteirinha — compartilhado entre preview e impressão. */
import { avaliarCarteirinhaConvivente } from './carteirinhaValidadeUtils.js';

export function resolverDadosCarteirinha(convivente, quartos = [], tecnicos = [], fotoCaminho = null) {
  if (!convivente) return null;

  let nomeAcomodacao = 'Sem Cama (Centro Dia)';
  let tipoAcomodacao = '-';

  if (convivente.leito_id) {
    for (const q of quartos) {
      const leito = q.leitos?.find((l) => l.id === convivente.leito_id);
      if (leito) {
        nomeAcomodacao = `${q.nome} - ${leito.identificacao}`;
        tipoAcomodacao = q.modalidade === 'Transitorio' ? 'Transitório' : 'Fixo';
        break;
      }
    }
  }

  const carteirinhaStatus = avaliarCarteirinhaConvivente(convivente, quartos);

  const codigoBarrasValor = convivente.numero_institucional
    ? String(convivente.numero_institucional)
    : convivente.cpf
      ? convivente.cpf.replace(/\D/g, '')
      : String(convivente.id || '').substring(0, 8);

  const dataEntradaFormatada = convivente.data_entrada
    ? new Date(convivente.data_entrada).toLocaleDateString('pt-BR')
    : 'Não informada';

  const tecnicoResponsavel = tecnicos.find((tec) => tec.id === convivente.tecnico_id);

  return {
    nome: convivente.nome_social || convivente.nome_completo || '-',
    prontuario: convivente.numero_institucional || 'S/N',
    sisa: convivente.numero_sisa || 'S/N',
    cpf: convivente.cpf || 'Não inf.',
    entrada: dataEntradaFormatada,
    tecnico: tecnicoResponsavel?.nome || 'Não vinculado',
    nomeAcomodacao,
    tipoAcomodacao,
    acomodacaoTransitoria: tipoAcomodacao === 'Transitório',
    codigoBarrasValor,
    qrValue: String(convivente.id || ''),
    foto: fotoCaminho ?? convivente.foto_url ?? null,
    provisoria: carteirinhaStatus.provisoria,
    preferencial: carteirinhaStatus.preferencial,
    rotuloProvisoria: carteirinhaStatus.provisoria ? 'PROVISÓRIA' : null,
    rotuloPreferencial: carteirinhaStatus.preferencial ? 'PREFERENCIAL' : null,
  };
}

function escaparHtml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Evita que o CSS da 1ª carteirinha do lote sobrescreva cores das demais. */
export function prefixarEstiloCarteirinha(css, escopoClasse) {
  if (!css || !escopoClasse) return css;

  const prefix = `.${escopoClasse}`;

  return css.replace(/(^|})\s*([^@{}][^{]*)\{/g, (match, fechamento, seletores) => {
    const lista = seletores
      .split(',')
      .map((sel) => {
        const limpo = sel.trim();
        if (!limpo) return limpo;
        return `${prefix} ${limpo}`;
      })
      .join(', ');
    return `${fechamento} ${lista} {`;
  });
}

/**
 * HTML autocontido 70×100 mm — não depende de Tailwind nem do layout da app.
 */
export function gerarHtmlCarteirinhaUnitaria(
  dados,
  {
    fotoDataUrl = '',
    qrSvgHtml = '',
    barcodeSvgHtml = '',
    logoProjetoDataUrl = '',
    logoCarecoreDataUrl = '',
    nomeProjeto = 'Projeto',
  } = {},
) {
  const d = dados;
  const cabecalhoCor = d.provisoria ? '#ea580c' : (d.preferencial ? '#d97706' : '#0ea5e9');
  const boxAcom = d.provisoria
    ? 'background:#fff7ed;border:1px solid #fdba74;'
    : (d.preferencial
      ? 'background:#fffbeb;border:1px solid #fcd34d;'
      : (d.acomodacaoTransitoria
        ? 'background:#fffbeb;border:1px solid #fde68a;'
        : 'background:#eff6ff;border:1px solid #dbeafe;'));
  const tituloAcom = d.provisoria ? 'color:#c2410c;' : (d.preferencial ? 'color:#b45309;' : (d.acomodacaoTransitoria ? 'color:#b45309;' : 'color:#0ea5e9;'));
  const tipoAcom = d.provisoria ? 'color:#c2410c;' : (d.preferencial ? 'color:#b45309;' : (d.acomodacaoTransitoria ? 'color:#b45309;' : 'color:#2563eb;'));
  const seloHtml = [
    d.rotuloProvisoria ? `<div style="margin-top:4px;font-size:8px;font-weight:900;letter-spacing:0.12em;color:#c2410c;">${escaparHtml(d.rotuloProvisoria)}</div>` : '',
    d.rotuloPreferencial ? `<div style="margin-top:2px;font-size:8px;font-weight:900;letter-spacing:0.12em;color:#b45309;">${escaparHtml(d.rotuloPreferencial)}</div>` : '',
  ].filter(Boolean).join('');

  const fotoBloco = fotoDataUrl
    ? `<img src="${fotoDataUrl}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" />`
    : '<span style="font-size:22px;opacity:0.25;">○</span>';

  const qrBloco = qrSvgHtml
    || `<img src="https://api.qrserver.com/v1/create-qr-code/?size=64x64&data=${encodeURIComponent(d.qrValue)}" width="64" height="64" alt="QR" />`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Carteirinha CareCore+</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 70mm;
      height: 100mm;
      overflow: hidden;
      background: #fff;
      font-family: Arial, Helvetica, sans-serif;
    }
    @page { size: 70mm 100mm; margin: 0; }
    .card {
      width: 70mm;
      height: 100mm;
      border: 1px solid #000;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .head {
      background: ${cabecalhoCor};
      color: #fff;
      text-align: center;
      padding: 4px 6px 3px;
    }
    .logos {
      display: flex;
      gap: 6px;
      align-items: center;
      justify-content: space-between;
    }
    .logo-box {
      height: 10.5mm;
      flex: 1;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.95);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2px 4px;
      overflow: hidden;
    }
    .logo-box img {
      max-width: 100%;
      max-height: 9mm;
      object-fit: contain;
      display: block;
    }
    .logo-text {
      color: #0ea5e9;
      font-size: 8px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .head p {
      font-size: 5px;
      opacity: 0.85;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      margin-top: 2px;
    }
    .body {
      flex: 1;
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
    }
    .top {
      display: flex;
      gap: 8px;
      margin-bottom: 6px;
    }
    .foto {
      width: 22mm;
      height: 28mm;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f3f4f6;
      flex-shrink: 0;
    }
    .qr {
      flex: 1;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4px;
    }
    .qr span {
      font-size: 6px;
      color: #9ca3af;
      font-family: monospace;
      margin-top: 2px;
    }
    .nome {
      font-size: 11.5px;
      font-weight: 900;
      text-transform: uppercase;
      line-height: 1.15;
      margin-bottom: 4px;
      color: #111827;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3px;
      font-size: 8px;
      font-family: monospace;
      color: #374151;
      background: #f9fafb;
      border: 1px solid #f3f4f6;
      border-radius: 4px;
      padding: 5px 6px;
      margin-bottom: 6px;
    }
    .grid .full { grid-column: 1 / -1; }
    .grid b { color: #6b7280; font-weight: 700; }
    .acom {
      padding: 5px 6px;
      border-radius: 4px;
      font-size: 7.5px;
      margin-bottom: 6px;
      ${boxAcom}
    }
    .acom .t1 {
      font-weight: 800;
      text-transform: uppercase;
      margin-bottom: 2px;
      ${tituloAcom}
    }
    .acom .t2 {
      font-size: 8.5px;
      font-weight: 600;
      color: #1f2937;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .acom .t3 {
      font-weight: 800;
      text-transform: uppercase;
      margin-top: 2px;
      ${tipoAcom}
    }
    .bar {
      margin-top: auto;
      text-align: center;
    }
    .bar .lbl {
      font-size: 6px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #9ca3af;
      font-weight: 700;
      margin-bottom: 3px;
    }
    .bar svg { display: block; margin: 0 auto; }
    .bar .num {
      font-size: 7px;
      letter-spacing: 2px;
      font-family: monospace;
      color: #374151;
      margin-top: 2px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="head">
      <div class="logos">
        <div class="logo-box">
          ${
            logoProjetoDataUrl
              ? `<img src="${logoProjetoDataUrl}" alt="${escaparHtml(nomeProjeto)}" />`
              : `<span class="logo-text">${escaparHtml(nomeProjeto)}</span>`
          }
        </div>
        <div class="logo-box">
          ${
            logoCarecoreDataUrl
              ? `<img src="${logoCarecoreDataUrl}" alt="CareCore+" />`
              : '<span class="logo-text">CareCore+</span>'
          }
        </div>
      </div>
      <p>Identidade Institucional</p>
    </div>
    <div class="body">
      <div class="top">
        <div class="foto">${fotoBloco}</div>
        <div class="qr">${qrBloco}<span>Escanear ID</span></div>
      </div>
      <div class="nome">${escaparHtml(d.nome)}</div>
      ${seloHtml}
      <div class="grid">
        <div><b>PRONT:</b> #${escaparHtml(d.prontuario)}</div>
        <div><b>SISA:</b> ${escaparHtml(d.sisa)}</div>
        <div class="full"><b>CPF:</b> ${escaparHtml(d.cpf)}</div>
        <div class="full"><b>ENTRADA:</b> ${escaparHtml(d.entrada)}</div>
        <div class="full"><b>TÉCNICO:</b> ${escaparHtml(d.tecnico)}</div>
      </div>
      <div class="acom">
        <div class="t1">Acomodação Atual</div>
        <div class="t2">${escaparHtml(d.nomeAcomodacao)}</div>
        <div class="t3">Tipo: ${escaparHtml(d.tipoAcomodacao)}</div>
      </div>
      <div class="bar">
        <div class="lbl">Identificação de Acesso</div>
        ${barcodeSvgHtml ? `<div style="display:flex;justify-content:center;line-height:0;">${barcodeSvgHtml}</div>` : ''}
        <div class="num">${escaparHtml(d.codigoBarrasValor)}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
