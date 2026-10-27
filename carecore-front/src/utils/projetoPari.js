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

export function projetoEhCaeICentro(nome) {
  return textoProjeto(nome).includes('cae i centro');
}

/** CTA 18 – CANINDÉ / Projeto Canindé: Atividades e lavanderia de peças, sem secagem. */
export function projetoEhCtaCaninde(nome) {
  const texto = textoProjeto(nome);
  return texto.includes('caninde');
}

export function projetoLavanderiaSemSecagem(nome) {
  return projetoEhCtaCaninde(nome);
}

export function projetoUsaAgendaLavanderia(nome) {
  return projetoEhReencontroPari(nome) || projetoEhCtaCaninde(nome);
}

/** Pari, Anhangabaú, Cruzeiro e CAE I Centro não bipam entrada e saída. O Jabaquara bipa. */
export function projetoSemFluxoPortaria(nome) {
  if (projetoEhCaeICentro(nome)) return true;
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
const ROTINA_VISIVEL_CAE_I_CENTRO = new Set(['/rotina', '/rotina/historico']);
const ROTINA_VISIVEL_CTA_CANINDE = new Set(['/rotina', '/rotina/lavanderia']);

function caminhoDoMenu(pathname) {
  return String(pathname || '').split('?')[0];
}

function caminhoCoberto(pathname, prefixos) {
  const path = caminhoDoMenu(pathname);
  return prefixos.some((prefixo) => path === prefixo || path.startsWith(`${prefixo}/`));
}

/** Rotina, Atividades e Convênio ficam só nas casas já customizadas. Na Sede, também saem Conviventes e Acomodações. O CAE I Centro vê só a rotina diária e o histórico. O CTA Canindé vê Atividades e Lavanderia (sem secagem). */
export function menuOcultoNoProjeto(pathname, nomeProjeto) {
  if (!String(nomeProjeto || '').trim()) return false;
  if (projetoEhCaeICentro(nomeProjeto)) {
    const path = caminhoDoMenu(pathname);
    if (caminhoCoberto(path, ['/atividades', '/convenio-sisa'])) return true;
    if (path === '/rotina' || path.startsWith('/rotina/')) {
      return !ROTINA_VISIVEL_CAE_I_CENTRO.has(path);
    }
    return false;
  }
  if (projetoEhCtaCaninde(nomeProjeto)) {
    const path = caminhoDoMenu(pathname);
    if (caminhoCoberto(path, ['/atividades'])) return false;
    if (caminhoCoberto(path, ['/convenio-sisa'])) return true;
    if (path === '/rotina' || path.startsWith('/rotina/')) {
      return !ROTINA_VISIVEL_CTA_CANINDE.has(path);
    }
    return false;
  }
  if (!projetoTemCustomizacaoOperacional(nomeProjeto) && caminhoCoberto(pathname, MENUS_SEM_CUSTOMIZACAO)) {
    return true;
  }
  return projetoEhSedeAeb(nomeProjeto) && caminhoCoberto(pathname, MENUS_SO_SEDE);
}
