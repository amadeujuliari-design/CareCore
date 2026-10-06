function normalizarNomeCaptador(valor) {
  return String(valor || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ');
}

/** Captador da leitura quando o login já está num projeto. Vazio = usar a Sede. */
export function captadorInicialDoProjeto(opcoes, projetoNome) {
  const alvo = normalizarNomeCaptador(projetoNome);
  if (!alvo || alvo === 'SEDE' || alvo === 'SEDE AEB' || alvo.startsWith('SEDE ')) {
    return '';
  }
  const lista = Array.isArray(opcoes) ? opcoes : [];
  const exato = lista.find((opcao) => normalizarNomeCaptador(opcao?.value) === alvo);
  if (exato?.value) return exato.value;
  const noRotulo = lista.find((opcao) => {
    const rotulo = normalizarNomeCaptador(opcao?.label);
    return rotulo.endsWith(` ${alvo}`) || rotulo.endsWith(`- ${alvo}`);
  });
  return noRotulo?.value || '';
}
