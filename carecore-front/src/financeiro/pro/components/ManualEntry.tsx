import { useState } from 'react';
import { useFinanceStore } from '../store/useFinanceStore';
import { useAuth } from '../contexts/AuthContext';
import { ArrowUpCircle, ArrowDownCircle, Save, X } from 'lucide-react';

interface ManualEntryProps {
  onSave: () => void;
}

export function ManualEntry({ onSave }: ManualEntryProps) {
  const { addTransaction, accounts } = useFinanceStore();
  const { user } = useAuth();
  
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('');
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !amount || !description) return;

    await addTransaction({
      user_id: user.id,
      // CORREÇÃO: Usar undefined ao invés de null para campos opcionais
      account_id: accountId || undefined, 
      description,
      amount: Number(amount),
      type,
      date,
      category: category || 'Outros',
      is_paid: false, 
      // CORREÇÃO: Usar undefined ao invés de null
      origin_file: undefined 
    });

    onSave();
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-4">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-slate-700">Novo Lançamento Manual</h3>
        <button onClick={onSave} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setType('income')}
            className={`p-3 rounded-lg border flex items-center justify-center gap-2 font-bold transition-all ${type === 'income' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
          >
            <ArrowUpCircle size={18} /> A Receber
          </button>
          <button
            type="button"
            onClick={() => setType('expense')}
            className={`p-3 rounded-lg border flex items-center justify-center gap-2 font-bold transition-all ${type === 'expense' ? 'bg-red-50 border-red-500 text-red-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
          >
            <ArrowDownCircle size={18} /> A Pagar
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Descrição</label>
            <input autoFocus required value={description} onChange={e => setDescription(e.target.value)} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: Aluguel" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Valor</label>
            <input type="number" required value={amount} onChange={e => setAmount(e.target.value)} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.00" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Vencimento</label>
            <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Categoria</label>
            <input value={category} onChange={e => setCategory(e.target.value)} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: Moradia" />
          </div>
        </div>

        <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Conta Vinculada (Opcional)</label>
            <select value={accountId} onChange={e => setAccountId(e.target.value)} className="w-full p-2 border rounded-lg outline-none bg-white">
                <option value="">Nenhuma (Dinheiro/Outro)</option>
                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
            </select>
        </div>

        <div className="pt-2">
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20">
                <Save size={18} /> Salvar Lançamento
            </button>
        </div>
      </form>
    </div>
  );
}