export function BadgeStatus({ ativo }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${
        ativo
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-red-200 bg-red-50 text-red-700'
      }`}
    >
      {ativo ? 'Ativo' : 'Inativo'}
    </span>
  );
}

export function BadgePerfil({ perfil }) {
  const mapa = {
    Gestor: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    Técnico: 'border-blue-200 bg-blue-50 text-blue-700',
    Orientador: 'border-amber-200 bg-amber-50 text-amber-700',
    Administrativo: 'border-slate-200 bg-slate-50 text-slate-700',
    Consulta: 'border-gray-200 bg-gray-50 text-gray-700',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${
        mapa[perfil] || mapa.Consulta
      }`}
    >
      {perfil || 'Consulta'}
    </span>
  );
}

export function CampoFotoUsuario({
  avatarUrl,
  cameraAtiva,
  processandoFoto,
  videoRef,
  canvasRef,
  fileInputRef,
  onAbrirCamera,
  onCapturarFoto,
  onPararCamera,
  onSelecionarArquivo,
  onUploadArquivo,
  onRemoverFoto,
  isTouchDevice = false,
  isSecureCameraContext = true,
}) {
  return (
    <div className="md:col-span-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Foto do usuário"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="text-center text-xs font-semibold text-slate-400">
              Sem foto
            </div>
          )}
        </div>

        <div className="flex-1">
          <label className="mb-1 block text-xs font-semibold text-slate-600">
            Foto do usuário
          </label>

          <p className="mb-3 text-xs text-slate-500">
            {isTouchDevice
              ? 'No celular, use a câmera nativa ou escolha uma imagem existente. A foto será cortada em formato quadrado.'
              : 'Capture pela webcam ou envie uma imagem existente. A foto será cortada em formato quadrado e padronizada automaticamente.'}
          </p>

          {!isSecureCameraContext && (
            <p className="mb-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
              Captura direta pode ser bloqueada no celular em endereço local. O botão de arquivo abre a câmera nativa do aparelho.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onAbrirCamera}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              {isTouchDevice ? 'Abrir câmera' : 'Abrir webcam'}
            </button>

            <button
              type="button"
              onClick={onSelecionarArquivo}
              disabled={processandoFoto}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              {processandoFoto ? 'Processando...' : isTouchDevice ? 'Câmera/galeria' : 'Enviar arquivo'}
            </button>

            {avatarUrl && (
              <button
                type="button"
                onClick={onRemoverFoto}
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
              >
                Remover foto
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture={isTouchDevice ? 'environment' : undefined}
            onChange={onUploadArquivo}
            className="hidden"
          />
        </div>
      </div>

      {cameraAtiva && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="mx-auto aspect-square max-h-[360px] w-full max-w-[360px] rounded-2xl bg-slate-900 object-cover"
          />

          <canvas ref={canvasRef} className="hidden" />

          <div className="mt-3 flex justify-center gap-2">
            <button
              type="button"
              onClick={onCapturarFoto}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800"
            >
              Capturar foto
            </button>

            <button
              type="button"
              onClick={onPararCamera}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar câmera
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CampoTexto({
  label,
  value,
  onChange,
  onBlur,
  type = 'text',
  required = false,
  className = '',
  maxLength,
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-semibold text-slate-600">
        {label}
        {required ? ' *' : ''}
      </label>

      <input
        type={type}
        value={value}
        required={required}
        maxLength={maxLength}
        onBlur={onBlur}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
      />
    </div>
  );
}

export function CampoSelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Selecione',
  required = false,
  className = '',
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-semibold text-slate-600">
        {label}
        {required ? ' *' : ''}
      </label>

      <select
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
      >
        <option value="">{placeholder}</option>

        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
