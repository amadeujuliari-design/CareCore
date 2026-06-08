export default function ModalCamera({
  cameraAberta,
  videoRef,
  canvasRef,
  fecharCamera,
  capturarFoto,
}) {
  if (!cameraAberta) return null;

  return (
    <div className="carecore-modal-overlay fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4">
      <div className="carecore-modal-panel bg-white p-6 rounded-2xl max-w-2xl w-full flex flex-col items-center">
        <h3 className="text-xl font-semibold mb-2">Capturar foto de perfil</h3>
        <div className="w-full bg-black rounded-lg overflow-hidden flex justify-center mb-6 relative"><video ref={videoRef} autoPlay playsInline className="w-full max-h-[60vh] object-cover"></video><canvas ref={canvasRef} className="hidden"></canvas></div>
        <div className="flex gap-4 w-full"><button type="button" onClick={fecharCamera} className="flex-1 py-3 bg-gray-200 font-semibold rounded-xl hover:bg-gray-300 transition-colors">Cancelar</button><button type="button" onClick={capturarFoto} className="flex-1 py-3 bg-brand text-white font-semibold rounded-xl hover:bg-brandDark transition-colors shadow-lg">Capturar e salvar</button></div>
      </div>
    </div>
  );
}
