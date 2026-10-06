const MARCADORES_MODELO_PARI = [
  'reencontro pari',
  'reencontro anhangabau',
  'reencontro cruzeiro do sul',
  'reencontro jabaquara',
];

export function projetoEhReencontroPari(nome) {
  const texto = String(nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return MARCADORES_MODELO_PARI.some((marcador) => texto.includes(marcador));
}
