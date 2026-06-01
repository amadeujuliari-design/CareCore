/** URLs e contatos públicos do site institucional (sem segredos). */
export const SITE = {
  name: 'CareCore+',
  title: 'CareCore+ — Gestão para ONGs e casas de acolhida',
  domain: 'carecoreplus.com.br',
  /** App operacional (login) — subdomínio separado por segurança. */
  appUrl: 'https://app.carecoreplus.com.br',
  /** Guia completo do sistema (material de apresentação em PDF/tela). */
  guiaUrl: '/guia/guia-carecore.html',
  whatsappNumber: '5511970729208',
  whatsappDisplay: '(11) 97072-9208',
};

export function whatsappLink(message = 'Olá! Gostaria de saber mais sobre o CareCore+.') {
  return `https://wa.me/${SITE.whatsappNumber}?text=${encodeURIComponent(message)}`;
}
