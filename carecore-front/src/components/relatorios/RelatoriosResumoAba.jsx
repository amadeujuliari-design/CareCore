import { CardMetrica, RelatorioCard } from '../RelatoriosUI';

export function RelatoriosMetricasTopo({ aba, cardsTopoVisiveis }) {
  if (['carteirinhas', 'personalizacao'].includes(aba)) return null;

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      {cardsTopoVisiveis.map((card) => (
        <CardMetrica
          key={card.label}
          label={card.label}
          valor={card.valor}
          detalhe={card.detalhe}
        />
      ))}
    </section>
  );
}

export function RelatoriosCardsAba({ relatoriosAtuaisVisiveis }) {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {relatoriosAtuaisVisiveis.map((item) => (
        <RelatorioCard key={item.titulo} item={item} />
      ))}
    </section>
  );
}
