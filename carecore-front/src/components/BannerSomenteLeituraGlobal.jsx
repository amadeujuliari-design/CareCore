export default function BannerSomenteLeituraGlobal({ modulo = 'este módulo' }) {
  return (
    <div className="mb-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950">
      <p className="font-bold">Visualização apenas — usuário Global</p>
      <p className="mt-1">
        Usuários Globais apenas consultam e imprimem relatórios gerenciais.
        Você pode visualizar {modulo}, mas não editar dados nem realizar ações operacionais.
      </p>
    </div>
  );
}
