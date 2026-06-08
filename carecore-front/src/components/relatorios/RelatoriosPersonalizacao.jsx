import AuthenticatedImage from '../AuthenticatedImage';
import { PremiumButton } from '../PremiumUI';

export function RelatoriosPersonalizacao({
  atualizarCampoIdentidade,
  enviarLogoRelatorio,
  errosIdentidade,
  formIdentidade,
  identidadeRelatorio,
  imprimirModeloIdentidadeRelatorio,
  mensagemIdentidade,
  removerLogoRelatorio,
  salvarIdentidadeRelatorio,
  salvandoIdentidade,
  validarCampoIdentidade,
}) {
  return (
    <section className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_1fr]">
      <article className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="text-base font-black text-gray-900">Logotipo do relatório</h2>
        <p className="mt-1 text-xs font-semibold text-gray-500">
          Use preferencialmente PNG com fundo transparente ou uma imagem horizontal em boa resolução.
        </p>

        <div className="mt-5 flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4">
          {identidadeRelatorio?.relatorio_logo_url ? (
            <AuthenticatedImage
              caminhoOuUrl={identidadeRelatorio.relatorio_logo_url}
              alt="Logotipo dos relatórios"
              className="max-h-32 max-w-full object-contain"
            />
          ) : (
            <span className="text-center text-sm font-bold text-gray-400">
              Nenhum logotipo personalizado enviado.
            </span>
          )}
        </div>

        <div className="mt-4 grid gap-2">
          <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-brand px-4 py-3 text-xs font-black text-white hover:bg-brand-dark">
            Enviar logotipo
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={enviarLogoRelatorio}
              className="hidden"
              disabled={salvandoIdentidade}
            />
          </label>

          {identidadeRelatorio?.relatorio_logo_url && (
            <button
              type="button"
              onClick={removerLogoRelatorio}
              disabled={salvandoIdentidade}
              className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-black text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              Remover logotipo
            </button>
          )}
        </div>
      </article>

      <form onSubmit={salvarIdentidadeRelatorio} className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-5">
          <h2 className="text-base font-black text-gray-900">Dados exibidos nos relatórios</h2>
          <p className="mt-1 text-xs font-semibold text-gray-500">
            Esses dados aparecem no cabeçalho e rodapé dos relatórios impressos ou salvos em PDF.
          </p>
        </div>

        {mensagemIdentidade && (
          <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50 p-3 text-sm font-bold text-blue-700">
            {mensagemIdentidade}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="mb-1 block text-[10px] font-black uppercase text-gray-400">Nome exibido</span>
            <input
              type="text"
              value={formIdentidade.relatorio_nome_exibicao}
              onChange={(event) => atualizarCampoIdentidade('relatorio_nome_exibicao', event.target.value)}
              placeholder="Ex: CARE CORE Abrigo"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
            />
          </label>

          <label className="md:col-span-2">
            <span className="mb-1 block text-[10px] font-black uppercase text-gray-400">Rodapé linha 1</span>
            <input
              type="text"
              value={formIdentidade.relatorio_rodape_linha1}
              onChange={(event) => atualizarCampoIdentidade('relatorio_rodape_linha1', event.target.value)}
              placeholder="Ex: Rua Exemplo, 123 - Centro - São Paulo/SP"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
            />
          </label>

          <label className="md:col-span-2">
            <span className="mb-1 block text-[10px] font-black uppercase text-gray-400">Rodapé linha 2</span>
            <input
              type="text"
              value={formIdentidade.relatorio_rodape_linha2}
              onChange={(event) => atualizarCampoIdentidade('relatorio_rodape_linha2', event.target.value)}
              placeholder="Ex: CNPJ 00.000.000/0001-00"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
            />
          </label>

          <label>
            <span className="mb-1 block text-[10px] font-black uppercase text-gray-400">Telefone</span>
            <input
              type="text"
              value={formIdentidade.relatorio_telefone}
              onChange={(event) => atualizarCampoIdentidade('relatorio_telefone', event.target.value)}
              onBlur={() => validarCampoIdentidade('relatorio_telefone', formIdentidade.relatorio_telefone)}
              className={`w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 ${
                errosIdentidade.relatorio_telefone
                  ? 'border-red-400 bg-red-50 focus:ring-red-100'
                  : 'border-gray-200 focus:ring-brand'
              }`}
            />
            {errosIdentidade.relatorio_telefone ? (
              <span className="mt-1 block text-xs font-bold text-red-600">{errosIdentidade.relatorio_telefone}</span>
            ) : null}
          </label>

          <label>
            <span className="mb-1 block text-[10px] font-black uppercase text-gray-400">E-mail</span>
            <input
              type="email"
              value={formIdentidade.relatorio_email}
              onChange={(event) => atualizarCampoIdentidade('relatorio_email', event.target.value)}
              onBlur={() => validarCampoIdentidade('relatorio_email', formIdentidade.relatorio_email)}
              className={`w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 ${
                errosIdentidade.relatorio_email
                  ? 'border-red-400 bg-red-50 focus:ring-red-100'
                  : 'border-gray-200 focus:ring-brand'
              }`}
            />
            {errosIdentidade.relatorio_email ? (
              <span className="mt-1 block text-xs font-bold text-red-600">{errosIdentidade.relatorio_email}</span>
            ) : null}
          </label>

          <label className="md:col-span-2">
            <span className="mb-1 block text-[10px] font-black uppercase text-gray-400">Site</span>
            <input
              type="text"
              value={formIdentidade.relatorio_site}
              onChange={(event) => atualizarCampoIdentidade('relatorio_site', event.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <PremiumButton type="submit" variant="brand" disabled={salvandoIdentidade}>
            {salvandoIdentidade ? 'Salvando...' : 'Salvar identidade'}
          </PremiumButton>
          <PremiumButton
            type="button"
            variant="secondary"
            onClick={imprimirModeloIdentidadeRelatorio}
            disabled={salvandoIdentidade}
          >
            Pré-visualizar em relatório
          </PremiumButton>
        </div>
      </form>
    </section>
  );
}
