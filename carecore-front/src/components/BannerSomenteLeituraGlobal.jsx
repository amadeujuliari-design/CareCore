export default function BannerSomenteLeituraGlobal({ modulo = 'este módulo' }) {
  return (
    <div className="mb-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950">
      <p className="font-bold">Visualização apenas — usuário Global</p>
      <p className="mt-1">
        Você pode consultar {modulo}, mas não registrar nem alterar dados operacionais do projeto.
      </p>
    </div>
  );
}
