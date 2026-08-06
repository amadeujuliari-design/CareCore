import { Link } from 'react-router-dom';
import { FileBarChart } from 'lucide-react';

import Sidebar from './Sidebar';
import { AppShell, MainShell, PageHeader, ScrollArea } from './components/PremiumUI';
import DireitosReservadosAviso from './components/DireitosReservadosAviso';
import { NFP_RELATORIOS_CATALOGO } from './utils/relatorioNfpUtils';

export default function NfpRelatorios() {
  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          eyebrow="NFP – Créditos"
          title="Central de relatórios"
          subtitle="Consolidados e analíticos do módulo NFP, com identidade visual CareCore+ e exportação XLSX."
          icon={<FileBarChart className="h-5 w-5" />}
          backTo="/nfp"
          backLabel="Voltar ao dashboard"
        />
        <ScrollArea>
          <DireitosReservadosAviso className="mb-4" />
          <div className="grid gap-4 md:grid-cols-2">
            {NFP_RELATORIOS_CATALOGO.map((item) => (
              <Link
                key={item.id}
                to={item.path}
                className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition hover:border-slate-300"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {item.tipo}
                </p>
                <h3 className="mt-2 text-lg font-bold text-slate-900">{item.titulo}</h3>
                <p className="mt-2 text-sm text-slate-600">{item.descricao}</p>
              </Link>
            ))}
          </div>
          <p className="mt-6 text-xs text-slate-500">
            Próximos relatórios (doadores diretos, doações, cadastros e exceções) entram nesta central no mesmo padrão.
          </p>
        </ScrollArea>
      </MainShell>
    </AppShell>
  );
}
