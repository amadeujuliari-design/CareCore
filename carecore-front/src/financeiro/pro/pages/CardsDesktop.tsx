import { CreditCard } from 'lucide-react';
import { CardImport } from '../components/CardImport';

export function CardsDesktop() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* Cabeçalho */}
      <div className="flex items-center gap-4 mb-8 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
         <div className="p-3 bg-slate-900 rounded-2xl text-white shadow-lg shadow-slate-900/20">
            <CreditCard size={28} />
         </div>
         <div>
            <h2 className="text-2xl font-bold text-slate-800">Gestão de Cartões</h2>
            <p className="text-slate-500">Importe sua fatura CSV e classifique seus gastos</p>
         </div>
      </div>

      {/* Importador Original (Tabela) */}
      <CardImport />
      
    </div>
  );
}