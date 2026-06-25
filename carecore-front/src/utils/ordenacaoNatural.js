function chaveOrdenacaoNatural(valor) {
  const texto = String(valor ?? '').trim().toLocaleLowerCase('pt-BR');
  if (!texto) return [[1, '']];

  const partes = texto.split(/(\d+)/).filter(Boolean);
  return partes.map((parte) => (
    /^\d+$/.test(parte) ? [0, Number(parte)] : [1, parte]
  ));
}

function compararOrdenacaoNatural(a, b) {
  const chaveA = chaveOrdenacaoNatural(a);
  const chaveB = chaveOrdenacaoNatural(b);
  const tamanho = Math.max(chaveA.length, chaveB.length);

  for (let indice = 0; indice < tamanho; indice += 1) {
    const parteA = chaveA[indice] || [1, ''];
    const parteB = chaveB[indice] || [1, ''];

    if (parteA[0] !== parteB[0]) {
      return parteA[0] - parteB[0];
    }

    if (parteA[1] < parteB[1]) return -1;
    if (parteA[1] > parteB[1]) return 1;
  }

  return 0;
}

export function ordenarPorTextoNatural(itens, obterTexto) {
  return [...itens].sort((itemA, itemB) => (
    compararOrdenacaoNatural(obterTexto(itemA), obterTexto(itemB))
  ));
}

export function ordenarQuartosComLeitos(quartos = []) {
  return ordenarPorTextoNatural(quartos, (quarto) => quarto?.nome).map((quarto) => ({
    ...quarto,
    leitos: ordenarPorTextoNatural(quarto?.leitos || [], (leito) => leito?.identificacao),
  }));
}
