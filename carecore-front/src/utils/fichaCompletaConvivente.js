import {
  calcularIdade,
  formatarCEP,
  formatarCPF,
  formatarTelefone,
} from './conviventesUtils';
import {
  DIREITOS_RESERVADOS_TITULO,
  obterUrlDireitosReservados,
} from './direitosReservados';
import { obterLogoRelatorioSrc } from './relatorioIdentidadePrint';

function escaparHtml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function obterLocalizacaoLeitoTexto(leitoId, quartos = []) {
  if (!leitoId) return 'Apenas atendimento diurno / sem leito';

  for (const quarto of quartos) {
    const leitoEncontrado = quarto.leitos?.find(leito => leito.id === leitoId);
    if (leitoEncontrado) return `${quarto.nome} - ${leitoEncontrado.identificacao}`;
  }

  return 'Leito não localizado';
}

export function montarHtmlFichaCompletaConvivente({
  convivente,
  documentosFicha = [],
  listaTecnicos = [],
  quartos = [],
  incluirDadosSensiveis = false,
  identidadeRelatorio = null,
  logoRelatorioDataUrl = '',
}) {
  const tecnico = listaTecnicos.find(tec => tec.id === convivente.tecnico_id);
  const logoSrc = obterLogoRelatorioSrc(logoRelatorioDataUrl);
  const nomeExibicao = identidadeRelatorio?.relatorio_nome_exibicao || 'CARECORE+';
  const rodapeItens = [
    identidadeRelatorio?.relatorio_rodape_linha1,
    identidadeRelatorio?.relatorio_rodape_linha2,
    identidadeRelatorio?.relatorio_telefone ? `Telefone: ${identidadeRelatorio.relatorio_telefone}` : '',
    identidadeRelatorio?.relatorio_email ? `E-mail: ${identidadeRelatorio.relatorio_email}` : '',
    identidadeRelatorio?.relatorio_site ? `Site: ${identidadeRelatorio.relatorio_site}` : '',
  ].filter(Boolean);
  const direitosUrl = obterUrlDireitosReservados();
  const linha = (rotulo, valor) => `
    <tr>
      <th>${escaparHtml(rotulo)}</th>
      <td>${escaparHtml(valor || '-')}</td>
    </tr>
  `;
  const secao = (titulo, linhas) => `
    <section>
      <h2>${escaparHtml(titulo)}</h2>
      <table>${linhas}</table>
    </section>
  `;

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Ficha completa - ${escaparHtml(convivente.nome_social || convivente.nome_completo || 'Convivente')}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111827; padding: 28px; }
          header { display: flex; align-items: center; justify-content: space-between; gap: 24px; border-bottom: 2px solid #e5e7eb; margin-bottom: 20px; padding-bottom: 16px; }
          .logo { width: 190px; max-height: 72px; object-fit: contain; }
          .titulo { text-align: right; }
          h1 { margin: 0; font-size: 24px; }
          h2 { margin: 22px 0 8px; font-size: 15px; text-transform: uppercase; letter-spacing: .04em; color: #0f766e; }
          p { margin: 4px 0; color: #4b5563; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
          th, td { border: 1px solid #e5e7eb; padding: 7px 9px; font-size: 12px; vertical-align: top; text-align: left; }
          th { width: 28%; background: #f9fafb; color: #374151; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          .assinatura { margin-top: 42px; display: flex; justify-content: flex-end; }
          .linha { width: 280px; border-top: 1px solid #111827; text-align: center; padding-top: 8px; font-size: 11px; }
          .identidade-nome { margin-top: 6px; color: #374151; font-size: 11px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
          .rodape-relatorio { margin-top: 28px; border-top: 1px solid #e5e7eb; padding-top: 8px; color: #6b7280; font-size: 10px; line-height: 1.4; text-align: center; }
          .direitos-reservados { margin-top: 5px; font-size: 9px; font-weight: 700; }
          .direitos-reservados a { color: #4f46e5; text-decoration: none; }
          button { margin-bottom: 16px; padding: 8px 14px; border-radius: 8px; border: 1px solid #d1d5db; background: white; cursor: pointer; }
          @media print { body { padding: 8px; } button { display: none; } .grid { grid-template-columns: 1fr 1fr; } }
        </style>
      </head>
      <body>
        <button onclick="window.print()">Imprimir</button>
        <header>
          <div>
            <img class="logo" src="${logoSrc}" alt="${escaparHtml(nomeExibicao)}" />
            <div class="identidade-nome">${escaparHtml(nomeExibicao)}</div>
          </div>
          <div class="titulo">
            <h1>Ficha completa do convivente</h1>
            <p>Gerada em ${escaparHtml(new Date().toLocaleString('pt-BR'))}</p>
            <p><strong>${escaparHtml(convivente.nome_social || convivente.nome_completo || '-')}</strong> · Prontuário #${escaparHtml(convivente.numero_institucional || 'S/N')}</p>
          </div>
        </header>

        <div class="grid">
          ${secao('Identificação', [
            linha('Nome civil', convivente.nome_completo),
            linha('Nome social', convivente.nome_social),
            linha('CPF', convivente.cpf ? formatarCPF(convivente.cpf) : '-'),
            linha('RG', convivente.rg),
            linha('Nascimento', convivente.data_nascimento ? `${new Date(convivente.data_nascimento).toLocaleDateString('pt-BR')} (${calcularIdade(convivente.data_nascimento)} anos)` : '-'),
            linha('Identidade de gênero', convivente.identidade_genero),
            linha('Orientação sexual', convivente.orientacao_sexual),
            linha('Naturalidade', convivente.naturalidade),
          ].join(''))}

          ${secao('Situação institucional', [
            linha('Status', convivente.status),
            linha('Entrada', convivente.data_entrada ? new Date(convivente.data_entrada).toLocaleDateString('pt-BR') : '-'),
            linha('Acomodação', obterLocalizacaoLeitoTexto(convivente.leito_id, quartos)),
            linha('Técnico de referência', tecnico?.nome || 'Não definido'),
            linha('Número SISA', convivente.numero_sisa),
            linha('Número NIS', convivente.numero_nis),
            linha('CadÚnico', convivente.status_cadunico),
          ].join(''))}
        </div>

        <div class="grid">
          ${secao('Contato e endereço', [
            linha('Telefone', convivente.telefone_celular ? formatarTelefone(convivente.telefone_celular) : '-'),
            linha('Contato emergência', convivente.contato_emergencia_nome),
            linha('Telefone emergência', convivente.contato_emergencia_telefone ? formatarTelefone(convivente.contato_emergencia_telefone) : '-'),
            linha('Endereço', [convivente.logradouro, convivente.numero, convivente.complemento].filter(Boolean).join(', ')),
            linha('Bairro/Cidade', [convivente.bairro, convivente.cidade, convivente.uf].filter(Boolean).join(' - ')),
            linha('CEP', convivente.cep ? formatarCEP(convivente.cep) : '-'),
          ].join(''))}

          ${secao('Família e benefícios', [
            linha('Nome da mãe', convivente.nome_mae),
            linha('Nome do pai', convivente.nome_pai),
            linha('Estado civil', convivente.estado_civil),
            linha('Escolaridade', convivente.escolaridade),
            linha('Programas/benefícios', convivente.programas_beneficios),
            linha('Possui renda', convivente.possui_renda ? 'Sim' : 'Não'),
            linha('Renda mensal', convivente.renda_mensal ? `R$ ${Number(convivente.renda_mensal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'),
          ].join(''))}
        </div>

        ${secao('Saúde e acompanhamento', [
          linha('Observações de saúde', convivente.observacoes_saude),
          linha('Acompanhamento CAPS', convivente.acompanhamento_caps),
          linha('Uso de substâncias', convivente.uso_substancias),
          linha('Transtorno mental', convivente.transtorno_mental),
          linha('Medidas protetivas', convivente.medidas_protetivas),
        ].join(''))}

        ${incluirDadosSensiveis ? secao('Dados sensíveis / cofre', [
          linha('Egresso prisional', convivente.egresso_prisional ? 'Sim' : 'Não'),
          linha('Usa tornozeleira', convivente.usa_tornozeleira ? 'Sim' : 'Não'),
          linha('Tem mandado de prisão', convivente.tem_mandado_prisao ? 'Sim' : 'Não'),
          linha('E-mail pessoal', convivente.email_pessoal),
          linha('Senha e-mail', convivente.senha_email ? 'Registrada no cofre' : '-'),
          linha('Senha Gov.br', convivente.senha_govbr ? 'Registrada no cofre' : '-'),
        ].join('')) : ''}

        ${secao('Documentos anexados', documentosFicha.length
          ? documentosFicha.map(doc => linha(doc.tipo_documento, `${doc.nome_arquivo} · ${new Date(doc.data_upload).toLocaleDateString('pt-BR')}`)).join('')
          : linha('Arquivos', 'Nenhum documento anexado')
        )}

        <div class="assinatura">
          <div class="linha">Responsável pela conferência</div>
        </div>

        <footer class="rodape-relatorio">
          ${
            rodapeItens.length
              ? rodapeItens.map(item => `<div>${escaparHtml(item)}</div>`).join('')
              : '<div>Relatório gerado pelo CareCore+</div>'
          }
          <div class="direitos-reservados">
            <a href="${escaparHtml(direitosUrl)}" target="_blank" rel="noopener noreferrer">
              ${escaparHtml(DIREITOS_RESERVADOS_TITULO)}
            </a>
          </div>
        </footer>
      </body>
    </html>
  `;
}
