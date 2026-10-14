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

export function projetoEhSedeAeb(nome) {
  const texto = textoProjeto(nome);
  return texto === 'sede' || texto === 'sede aeb' || texto.startsWith('sede ');
}

/** Casas que já têm rotina, atividades e convênio próprios. */
export function projetoTemCustomizacaoOperacional(nome) {
  const texto = textoProjeto(nome);
  if (projetoEhReencontroPari(nome)) return true;
  if (texto.includes('casa porto')) return true;
  return texto.includes('siat') || texto.includes('armenia');
}

const MENUS_SEM_CUSTOMIZACAO = ['/rotina', '/atividades', '/convenio-sisa'];
const MENUS_SO_SEDE = ['/conviventes', '/quartos'];

function caminhoDoMenu(pathname) {
  return String(pathname || '').split('?')[0];
}

function caminhoCoberto(pathname, prefixos) {
  const path = caminhoDoMenu(pathname);
  return prefixos.some((prefixo) => path === prefixo || path.startsWith(`${prefixo}/`));
}

/** Rotina, Atividades e Convênio ficam só nas casas já customizadas. Na Sede, também saem Conviventes e Acomodações. */
export function menuOcultoNoProjeto(pathname, nomeProjeto) {
  if (!String(nomeProjeto || '').trim()) return false;
  if (!projetoTemCustomizacaoOperacional(nomeProjeto) && caminhoCoberto(pathname, MENUS_SEM_CUSTOMIZACAO)) {
    return true;
  }
  return projetoEhSedeAeb(nomeProjeto) && caminhoCoberto(pathname, MENUS_SO_SEDE);
}
