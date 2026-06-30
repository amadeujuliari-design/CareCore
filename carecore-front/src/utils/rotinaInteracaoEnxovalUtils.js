const TIPO_BAGAGEIRO = 'Movimentação de Bagageiro';

function ehEntrega(tipoRegistro) {
  return [
    'Entrega de Cobertor',
    'Entrega de Toalha',
  ].includes(tipoRegistro);
}

function ehRetirada(tipoRegistro) {
  return [
    'Retirada de Cobertor',
    'Retirada de Toalha',
  ].includes(tipoRegistro);
}

export function obterApresentacaoInteracaoEnxoval({
  tipoRegistro,
  grupo,
  observacaoBagageiro = '',
}) {
  const nomeConvivente = 'Convivente';

  if (grupo === 'Cobertor' || ehRetirada(tipoRegistro) || ehEntrega(tipoRegistro)) {
    if (tipoRegistro === 'Retirada de Cobertor') {
      return {
        tituloModal: 'Cobertor — retirada',
        destaque: `${nomeConvivente} RETIRANDO cobertor`,
        instrucao: 'Aguardando OK para confirmar a retirada.',
        headerClass: 'bg-orange-600',
        boxClass: 'bg-orange-50 border-orange-200 text-orange-950',
        isEntrega: false,
      };
    }
    if (tipoRegistro === 'Entrega de Cobertor') {
      return {
        tituloModal: 'Cobertor — entrega',
        destaque: `${nomeConvivente} ENTREGANDO cobertor`,
        instrucao: 'Aguardando OK para confirmar a entrega.',
        headerClass: 'bg-emerald-600',
        boxClass: 'bg-emerald-50 border-emerald-200 text-emerald-950',
        isEntrega: true,
      };
    }
  }

  if (grupo === 'Toalha') {
    if (tipoRegistro === 'Retirada de Toalha') {
      return {
        tituloModal: 'Toalha — retirada',
        destaque: `${nomeConvivente} RETIRANDO toalha`,
        instrucao: 'Aguardando OK para confirmar a retirada.',
        headerClass: 'bg-orange-600',
        boxClass: 'bg-orange-50 border-orange-200 text-orange-950',
        isEntrega: false,
      };
    }
    if (tipoRegistro === 'Entrega de Toalha') {
      return {
        tituloModal: 'Toalha — entrega',
        destaque: `${nomeConvivente} ENTREGANDO toalha`,
        instrucao: 'Aguardando OK para confirmar a entrega.',
        headerClass: 'bg-emerald-600',
        boxClass: 'bg-emerald-50 border-emerald-200 text-emerald-950',
        isEntrega: true,
      };
    }
  }

  if (grupo === 'Bagageiro' || tipoRegistro === TIPO_BAGAGEIRO) {
    const mov = String(observacaoBagageiro || '').trim().toLowerCase();
    if (mov === 'saída' || mov === 'saida') {
      return {
        tituloModal: 'Bagageiro — retirada',
        destaque: `${nomeConvivente} RETIRANDO bagagem`,
        instrucao: 'Aguardando OK para confirmar a retirada da bagagem.',
        headerClass: 'bg-orange-600',
        boxClass: 'bg-orange-50 border-orange-200 text-orange-950',
        isEntrega: false,
      };
    }
    return {
      tituloModal: 'Bagageiro — guarda',
      destaque: `${nomeConvivente} GUARDANDO bagagem`,
      instrucao: 'Aguardando OK para confirmar a guarda da bagagem.',
      headerClass: 'bg-emerald-600',
      boxClass: 'bg-emerald-50 border-emerald-200 text-emerald-950',
      isEntrega: true,
    };
  }

  return null;
}

export function montarDestaqueInteracaoEnxoval(convivente, apresentacao) {
  if (!apresentacao) return null;
  const nome = convivente?.nome_social || convivente?.nome_completo || 'Convivente';
  return apresentacao.destaque.replace('Convivente', nome.toUpperCase());
}
