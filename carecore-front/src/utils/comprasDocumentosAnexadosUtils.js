/** Lista unificada de NF, boleto, comprovante e arquivo relacionado do pedido. */

const CLASSE_ROTULO = {
  nota_fiscal: 'Nota fiscal',
  boleto: 'Boleto',
  comprovante: 'Comprovante',
  relacionado: 'Arquivo relacionado',
};

const ORDEM_CLASSE = {
  nota_fiscal: 0,
  boleto: 1,
  comprovante: 2,
  relacionado: 3,
};

function parcelaDe(valor) {
  const n = Number(valor || 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function rotuloClasseDocumentoAnexado(classe) {
  return CLASSE_ROTULO[classe] || 'Arquivo';
}

export function documentosAnexadosDoPedido(pedido) {
  const anexos = pedido?.anexos || [];
  const notas = pedido?.notas_fiscais || [];
  const idsUsados = new Set();
  const itens = [];

  notas.forEach((nf) => {
    const anexo = nf.anexo_id ? anexos.find((a) => a.id === nf.anexo_id) : null;
    if (nf.anexo_id) idsUsados.add(nf.anexo_id);
    const boleto = nf.tipo_nf === 'boleto';
    itens.push({
      key: `nf-${nf.id}`,
      classe: boleto ? 'boleto' : 'nota_fiscal',
      parcela: parcelaDe(nf.parcela_numero || anexo?.parcela_numero),
      tipoNf: nf.tipo_nf || null,
      numero: nf.numero || '',
      valor_centavos: boleto ? null : nf.valor_centavos,
      nomeArquivo: anexo?.nome_arquivo
        || (nf.origem_dados === 'xml' ? 'Arquivo XML' : 'Arquivo anexado'),
      xml: !boleto && nf.origem_dados === 'xml',
      anexo,
      anexoId: nf.anexo_id || anexo?.id || null,
      notaId: nf.id,
      exclusao: 'nota',
    });
  });

  anexos.forEach((anexo) => {
    if (idsUsados.has(anexo.id)) return;
    const classe = anexo.classe_documento;
    if (!['boleto', 'comprovante', 'relacionado'].includes(classe)) return;
    itens.push({
      key: `anexo-${anexo.id}`,
      classe,
      parcela: parcelaDe(anexo.parcela_numero),
      tipoNf: null,
      numero: '',
      valor_centavos: null,
      nomeArquivo: anexo.nome_arquivo || 'Arquivo',
      xml: false,
      anexo,
      anexoId: anexo.id,
      notaId: null,
      exclusao: 'anexo',
    });
  });

  itens.sort((a, b) => {
    const pa = a.parcela > 0 ? a.parcela : Number.MAX_SAFE_INTEGER;
    const pb = b.parcela > 0 ? b.parcela : Number.MAX_SAFE_INTEGER;
    if (pa !== pb) return pa - pb;
    return (ORDEM_CLASSE[a.classe] ?? 9) - (ORDEM_CLASSE[b.classe] ?? 9);
  });
  return itens;
}

export function agruparDocumentosAnexadosPedido(pedido) {
  const itens = documentosAnexadosDoPedido(pedido);
  if (!itens.length) return [];
  const qtd = Number(pedido?.pagamento_qtd_parcelas || 0);
  if (qtd <= 1) {
    return [{ chave: 'todos', titulo: null, itens }];
  }
  const por = new Map();
  itens.forEach((item) => {
    const n = item.parcela > 0 ? item.parcela : 0;
    if (!por.has(n)) por.set(n, []);
    por.get(n).push(item);
  });
  const grupos = [...por.keys()]
    .filter((n) => n > 0)
    .sort((a, b) => a - b)
    .map((n) => ({ chave: `parcela-${n}`, titulo: `Parcela ${n}`, itens: por.get(n) }));
  if (por.get(0)?.length) {
    grupos.push({ chave: 'processo', titulo: 'Arquivos do processo', itens: por.get(0) });
  }
  return grupos;
}
