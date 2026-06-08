import { baixarArquivoAutenticado } from '../../utils/arquivosApi';

export default function ProntuarioDocumentos({
  editandoId,
  documentos,
  loadingDocs,
  arquivoSelecionado,
  tipoDocumentoSelecionado,
  setTipoDocumentoSelecionado,
  documentoSensivelSelecionado,
  setDocumentoSensivelSelecionado,
  usuarioPodeEnviarDocumentosRestritos,
  usuarioPodeGerenciarDocumentosRestritos,
  deviceInfo,
  abrirCamera,
  setArquivoSelecionado,
  handleUploadDocumento,
  handleExcluirDocumento,
}) {
  if (!editandoId) {
    return (
      <div className="space-y-5">
        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 text-center">
          <h3 className="text-sm font-bold text-yellow-800">Ação Necessária</h3>
          <p className="text-xs text-yellow-700 mt-1">Salve os dados do acolhido para liberar o envio de documentos.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1 bg-gray-50 p-4 rounded-xl border border-gray-200 h-fit">
          <h3 className="text-xs font-semibold text-gray-700 uppercase mb-3">Novo Documento ou Foto</h3>
          <p className="mb-3 text-[11px] font-semibold text-gray-500">
            Imagens são padronizadas automaticamente: foto de perfil 512x512 px; demais imagens até 2048 px. PDF e Office seguem sem alteração.
          </p>
          <div className="space-y-3">
            <select value={tipoDocumentoSelecionado} onChange={(e) => setTipoDocumentoSelecionado(e.target.value)} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg outline-none bg-white text-sm"><option value="">Selecione o tipo do documento</option><option value="Foto de Perfil">Foto de Perfil</option><option value="RG / CPF">RG / CPF</option><option value="CadÚnico">CadÚnico</option><option value="Consulta BNMP">Consulta BNMP</option><option value="Saúde sensível">Saúde sensível</option><option value="Jurídico / sigiloso">Jurídico / sigiloso</option><option value="Outros">Outros</option></select>
            <label className={`flex items-start gap-2 rounded-lg border p-3 text-xs font-semibold ${documentoSensivelSelecionado ? 'border-red-200 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-600'}`}>
              <input
                type="checkbox"
                checked={documentoSensivelSelecionado}
                onChange={(e) => setDocumentoSensivelSelecionado(e.target.checked)}
                disabled={!usuarioPodeEnviarDocumentosRestritos}
                className="mt-0.5 h-4 w-4 rounded text-red-600 focus:ring-red-500 disabled:opacity-40"
              />
              <span>
                Documento sensível/restrito
                <span className="mt-1 block text-[10px] font-medium opacity-80">
                  Técnicos podem enviar. Apenas Gestores/Gerentes/Master poderão visualizar, baixar ou excluir.
                </span>
                {!usuarioPodeEnviarDocumentosRestritos && (
                  <span className="mt-1 block text-[10px] text-gray-400">
                    Seu perfil não pode marcar uploads como restritos.
                  </span>
                )}
              </span>
            </label>
            <div className="pt-2 border-t border-gray-200">
              {!deviceInfo.isSecureCameraContext && (
                <p className="mb-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                  No celular, a captura direta pode ser bloqueada em endereço local. Use a câmera/galeria abaixo.
                </p>
              )}
              <button type="button" onClick={abrirCamera} className="w-full mb-2 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold">
                {deviceInfo.isTouchDevice ? 'Abrir câmera' : 'Tirar foto (webcam)'}
              </button>
              <input
                type="file"
                accept="image/*"
                capture={deviceInfo.isTouchDevice ? 'environment' : undefined}
                onChange={(e) => setArquivoSelecionado(e.target.files[0])}
                className="w-full text-xs text-gray-500"
              />
            </div>
            <button type="button" onClick={handleUploadDocumento} disabled={loadingDocs || !arquivoSelecionado} className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">{loadingDocs ? 'Enviando...' : 'Fazer upload'}</button>
          </div>
        </div>
        <div className="lg:col-span-2">
          <h3 className="text-xs font-semibold text-gray-700 uppercase mb-3">Arquivos do Acolhido ({documentos.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {documentos.map(doc => (
              <div key={doc.id} className={`bg-white p-3 rounded-xl border shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow ${doc.sensivel ? 'border-red-200 ring-1 ring-red-50' : 'border-gray-200'}`}>
                <div className="flex items-start gap-2 w-full"><span className="text-2xl flex-shrink-0">{doc.sensivel ? '▣' : doc.tipo_documento === 'Foto de Perfil' ? '○' : '▤'}</span><div className="flex-1 min-w-0"><h4 className="text-xs font-bold text-gray-800 truncate block w-full">{doc.nome_arquivo}</h4><p className={`text-[10px] font-semibold truncate ${doc.sensivel ? 'text-red-600' : 'text-brand'}`}>{doc.tipo_documento}{doc.sensivel ? ' · Restrito' : ''}</p></div></div>
                <div className="mt-3 pt-2 border-t border-gray-100 flex gap-2 justify-end">
                  {(!doc.sensivel || usuarioPodeGerenciarDocumentosRestritos) && (
                    <button type="button" onClick={() => baixarArquivoAutenticado(doc.caminho_arquivo, doc.nome_arquivo)} className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100">Baixar</button>
                  )}
                  {(!doc.sensivel || usuarioPodeGerenciarDocumentosRestritos) && (
                    <button type="button" onClick={() => handleExcluirDocumento(doc.id)} className="text-[10px] font-bold bg-red-50 text-red-600 px-2 py-1 rounded hover:bg-red-100">Excluir</button>
                  )}
                  {doc.sensivel && !usuarioPodeGerenciarDocumentosRestritos && (
                    <span className="rounded bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600">Sem visualização</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
