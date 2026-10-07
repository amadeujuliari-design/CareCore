const MARCADORES_MODELO_PARI = [
  'reencontro pari',
  'reencontro anhangabau',
  'reencontro cruzeiro do sul',
  'reencontro jabaquara',
];

function textoProjeto(nome) {
  return String(nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function projetoEhReencontroPari(nome) {
  const texto = textoProjeto(nome);
  return MARCADORES_MODELO_PARI.some((marcador) => texto.includes(marcador));
}

export function projetoEhJabaquara(nome) {
  return textoProjeto(nome).includes('reencontro jabaquara');
}

/** Pari, Anhangabaú e Cruzeiro não bipam entrada e saída. O Jabaquara bipa. */
export function projetoSemFluxoPortaria(nome) {
  return projetoEhReencontroPari(nome) && !projetoEhJabaquara(nome);
}
