import { baixarArquivoAutenticado } from '../../utils/arquivosApi';

export default function ProntuarioSensiveis({
  editandoId,
  formData,
  documentoConsultaBnmp,
  usuarioPodeEnviarDocumentosRestritos,
  usuarioPodeGerenciarDocumentosRestritos,
  salvandoConsultaBnmp,
  handleChange,
  abrirConsultaBnmp,
  enviarPdfConsultaBnmp,
  handleExcluirDocumento,
}) {
  return (
    <div className="space-y-5">
      <div className="bg-red-50 p-4 rounded-xl border border-red-200">
        <h3 className="text-sm font-bold text-red-800 mb-4">Acesso restrito</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-3 bg-white p-3 rounded-lg shadow-sm border border-red-100">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" name="egresso_prisional" checked={formData.egresso_prisional} onChange={handleChange} className="w-5 h-5 text-red-600 rounded focus:ring-red-500" />
              <span className="text-sm font-semibold text-gray-800">É Egresso Prisional?</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" name="usa_tornozeleira" checked={formData.usa_tornozeleira} onChange={handleChange} className="w-5 h-5 text-red-600 rounded focus:ring-red-500" />
              <span className="text-sm font-semibold text-gray-800">Usa Tornozeleira Eletrônica?</span>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="tem_mandado_prisao" checked={formData.tem_mandado_prisao} onChange={handleChange} className="w-5 h-5 text-red-600 rounded focus:ring-red-500" />
                <span className="text-sm font-semibold text-gray-800">Tem mandado de prisão?</span>
              </label>
              <button
                type="button"
                onClick={abrirConsultaBnmp}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100"
              >
                Consultar BNMP
              </button>
            </div>
          </div>
          <div className="space-y-3"><div><label className="block text-xs font-semibold text-red-900 mb-1">Acompanhamento CAPS</label><input type="text" name="acompanhamento_caps" value={formData.acompanhamento_caps} onChange={handleChange} className="w-full px-3 py-1.5 border border-red-200 rounded-lg outline-none bg-white text-sm" /></div><div><label className="block text-xs font-semibold text-red-900 mb-1">Medidas Protetivas</label><input type="text" name="medidas_protetivas" value={formData.medidas_protetivas} onChange={handleChange} className="w-full px-3 py-1.5 border border-red-200 rounded-lg outline-none bg-white text-sm" /></div></div>
          <div className="md:col-span-2"><label className="block text-xs font-semibold text-red-900 mb-1">Uso de Substâncias Psicoativas</label><textarea name="uso_substancias" value={formData.uso_substancias} onChange={handleChange} rows="2" className="w-full px-3 py-1.5 border border-red-200 rounded-lg outline-none bg-white text-sm"></textarea></div>
          <div className="md:col-span-2"><label className="block text-xs font-semibold text-red-900 mb-1">Transtornos Mentais</label><textarea name="transtorno_mental" value={formData.transtorno_mental} onChange={handleChange} rows="2" className="w-full px-3 py-1.5 border border-red-200 rounded-lg outline-none bg-white text-sm"></textarea></div>
          <div className="md:col-span-2 rounded-xl border border-red-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h4 className="text-sm font-bold text-red-900">Comprovante da consulta BNMP</h4>
                <p className="text-[11px] text-red-700/80 mt-1">
                  No portal BNMP, use <strong>Imprimir</strong> e <strong>Salvar em PDF</strong> para enviar o arquivo aqui.
                </p>
              </div>
              {documentoConsultaBnmp && (
                <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-1 rounded-full">
                  Salvo em {new Date(documentoConsultaBnmp.data_upload).toLocaleString('pt-BR')}
                </span>
              )}
            </div>

            {!editandoId ? (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                Salve o prontuário antes de anexar o PDF da consulta.
              </p>
            ) : (
              <div className="space-y-3">
                {documentoConsultaBnmp ? (
                  <div className="rounded-xl border border-red-100 bg-red-50/40 p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl" aria-hidden="true">▤</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-800 truncate">
                          {documentoConsultaBnmp.nome_arquivo}
                        </p>
                        <p className="text-[11px] font-semibold text-red-600">
                          Consulta BNMP · Restrito
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {usuarioPodeGerenciarDocumentosRestritos && (
                        <>
                          <button
                            type="button"
                            onClick={() => baixarArquivoAutenticado(documentoConsultaBnmp.caminho_arquivo, documentoConsultaBnmp.nome_arquivo)}
                            className="text-[11px] font-bold bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100"
                          >
                            Baixar PDF
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExcluirDocumento(documentoConsultaBnmp.id)}
                            className="text-[11px] font-bold bg-red-50 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-100"
                          >
                            Remover PDF
                          </button>
                        </>
                      )}
                      {!usuarioPodeGerenciarDocumentosRestritos && (
                        <span className="rounded bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-600">
                          Sem visualização para seu perfil
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-red-800/80 rounded-lg border border-dashed border-red-200 bg-red-50/40 px-3 py-4 text-center">
                    Nenhum PDF anexado ainda.
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    disabled={!usuarioPodeEnviarDocumentosRestritos || salvandoConsultaBnmp}
                    onChange={(event) => {
                      const arquivo = event.target.files?.[0];
                      if (arquivo) enviarPdfConsultaBnmp(arquivo);
                      event.target.value = '';
                    }}
                    className="text-xs text-gray-600"
                  />
                  {!usuarioPodeEnviarDocumentosRestritos && (
                    <span className="text-[10px] font-semibold text-gray-500">
                      Apenas Gestores/Gerentes/Master e Técnicos podem salvar o comprovante restrito.
                    </span>
                  )}
                  {salvandoConsultaBnmp && (
                    <span className="text-[10px] font-bold text-red-700">Enviando PDF...</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
