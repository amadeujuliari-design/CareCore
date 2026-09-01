import { useState, useMemo, useEffect } from 'react';
import { 
  PlusCircle, List, Search, Trash2, CheckCircle, Circle, 
  ChevronLeft, ChevronRight, Calendar, ArrowUp, ArrowDown, ArrowUpDown, 
  CheckSquare, Square, CreditCard, MessageCircle 
} from 'lucide-react';
import { ManualEntry } from '../components/ManualEntry'; 
import { useFinanceStore } from '../store/useFinanceStore';
import { formatCurrency, formatDateBR } from '../utils/formatters';
import type { Transaction } from '../types';

export function PayablesDesktop() {
  const { transactions, removeTransaction, updateTransaction, fetchTransactions } = useFinanceStore();
  const [activeTab, setActiveTab] = useState<'list' | 'manual'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'open' | 'paid'>('all');
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [sortConfig, setSortConfig] = useState<{ key: keyof Transaction; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'asc' });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const changeMonth = (delta: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setCurrentDate(newDate);
  };

  const currentMonthName = currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
  const targetMonth = currentDate.getMonth();
  const targetYear = currentDate.getFullYear();
  
  // Chave do ciclo ATUAL (para Cartão de Crédito - paga no próprio mês ou próximo dependendo da regra, aqui mantido igual)
  const currentCycleKey = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;

  // Chave do ciclo ANTERIOR (Para WhatsApp: Ciclo de Janeiro paga em Fevereiro)
  const prevDate = new Date(targetYear, targetMonth - 1, 1);
  const previousCycleKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const filteredTransactions = useMemo(() => {
    const normalTransactions: Transaction[] = [];
    const cardTransactions: Transaction[] = [];
    const whatsappTransactions: Transaction[] = [];

    // 1. Separação inicial
    transactions.forEach(t => {
        const origin = (t.origin_file || '').toLowerCase();
        
        if (origin === 'whatsapp_import') {
            whatsappTransactions.push(t);
            return;
        }

        const categoryUpper = (t.category || '').toUpperCase();
        const descUpper = (t.description || '').toUpperCase();
        
        const isBankFile = origin.endsWith('.ofx') || (origin.endsWith('.csv') && !origin.includes('card') && !origin.includes('invoice'));
        const isInvoicePayment = categoryUpper.includes('PAGAMENTO DE FATURA') || descUpper.includes('FATURA DE CARTÃO');

        if (isBankFile && !isInvoicePayment) return;

        const cat = (t.category || '').toLowerCase();
        const desc = (t.description || '').toLowerCase();
        const search = searchTerm.toLowerCase();
        if (searchTerm && !desc.includes(search) && !cat.includes(search)) return;

        if (t.invoice_month) {
            cardTransactions.push(t);
        } else {
            normalTransactions.push(t);
        }
    });

    // 2. Transações Normais
    const visibleNormalTransactions = normalTransactions.filter(t => {
        const tDate = new Date(t.date + 'T12:00:00');
        return tDate.getMonth() === targetMonth && tDate.getFullYear() === targetYear;
    });

    // 3. Fatura Cartão
    const invoiceGroups: Record<string, { amount: number, is_paid: boolean, count: number }> = {};
    cardTransactions.forEach(t => {
        if (!t.invoice_month) return;
        if (t.category === 'Pagamento de Fatura' || t.description.toUpperCase().includes('PAGAMENTO DE FATURA')) return;

        if (t.invoice_month === currentCycleKey) {
             const key = t.invoice_month;
             if (!invoiceGroups[key]) invoiceGroups[key] = { amount: 0, is_paid: true, count: 0 };
             invoiceGroups[key].amount += t.amount;
             if (!t.is_paid) invoiceGroups[key].is_paid = false;
             invoiceGroups[key].count++;
        }
    });

    const invoiceRows: Transaction[] = Object.entries(invoiceGroups)
        .filter(([_, data]) => !data.is_paid) 
        .map(([monthKey, data]) => ({
            id: `invoice-${monthKey}`,
            description: `Fatura Cartão (${data.count} itens)`,
            amount: data.amount,
            type: 'expense',
            date: `${monthKey}-10`, 
            category: 'Cartão de Crédito',
            is_paid: false,
            user_id: 'system',
            origin_file: 'VIRTUAL_INVOICE',
            invoice_month: monthKey,
            account_id: ''
        }));

    // 4. WhatsApp
    const whatsappRows: Transaction[] = [];

    // --- LÓGICA 1: ACUMULADO ABERTO (Mês Vigente/Passado) ---
    // (Lógica original INTACTA - pega saldo não projetado)
    const waOpenLegacy = whatsappTransactions.filter(t => !t.is_projected && !t.is_paid);
    const today = new Date();
    // Mostra apenas se estivermos visualizando o mês atual (ou passado se ficou pendência)
    const isCurrentView = targetMonth === today.getMonth() && targetYear === today.getFullYear();

    if (waOpenLegacy.length > 0 && isCurrentView) {
        let leoSum = 0;
        let claudioSum = 0;
        waOpenLegacy.forEach(t => {
             const resp = (t.responsible || '').toUpperCase();
             const cat = (t.category || '').toUpperCase();
             let isLeo = false, isClaudio = false;
             if (resp.includes('LEO') || resp.includes('LÉO')) isLeo = true;
             else if (resp.includes('CLAUDIO') || resp.includes('CLÁUDIO')) isClaudio = true;
             else {
                 if (cat.includes('LEO') || cat.includes('LÉO')) isLeo = true;
                 else if (cat.includes('CLAUDIO') || cat.includes('CLÁUDIO')) isClaudio = true;
             }
             if (isLeo) leoSum += t.amount;
             else if (isClaudio) claudioSum += t.amount;
        });
        const net = leoSum - claudioSum;
        if (Math.abs(net) > 0.01) {
             whatsappRows.push({
                 id: `whatsapp-accumulated-open`,
                 description: `Fechamento WhatsApp (Acumulado)`,
                 amount: Math.abs(net),
                 type: net > 0 ? 'income' : 'expense',
                 date: `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-05`,
                 category: 'Acerto Mensal',
                 is_paid: false,
                 user_id: 'system',
                 origin_file: 'VIRTUAL_INVOICE',
                 account_id: ''
             });
        }
    }

    // --- LÓGICA 2: PROJEÇÃO FUTURA (Mês Seguinte em diante) ---
    // (NOVA Lógica: Busca o ciclo do mês ANTERIOR para exibir no mês ATUAL da tela)
    // Ex: Se a tela é Fev (2026-02), busca parcelas do ciclo Jan (2026-01)
    
    // Só exibe projeção se NÃO for o mês atual (para não duplicar com o acumulado)
    if (!isCurrentView) {
        const waProjected = whatsappTransactions.filter(t => 
            t.is_projected && 
            !t.is_paid && 
            t.whatsapp_cycle_key === previousCycleKey // <--- Aqui está o segredo: Pega ciclo anterior
        );

        if (waProjected.length > 0) {
            let leoProj = 0;
            let claudioProj = 0;
            waProjected.forEach(t => {
                const resp = (t.responsible || '').toUpperCase();
                const cat = (t.category || '').toUpperCase();
                let isLeo = false, isClaudio = false;
                if (resp.includes('LEO') || resp.includes('LÉO')) isLeo = true;
                else if (resp.includes('CLAUDIO') || resp.includes('CLÁUDIO')) isClaudio = true;
                else {
                    if (cat.includes('LEO') || cat.includes('LÉO')) isLeo = true;
                    else if (cat.includes('CLAUDIO') || cat.includes('CLÁUDIO')) isClaudio = true;
                }
                if (isLeo) leoProj += t.amount;
                else if (isClaudio) claudioProj += t.amount;
            });

            const netProj = leoProj - claudioProj;
            
            if (Math.abs(netProj) > 0.01) {
                whatsappRows.push({
                    id: `whatsapp-projected-${previousCycleKey}`,
                    description: `Projeção WhatsApp (Ciclo ${previousCycleKey})`, // Mostra qual ciclo é
                    amount: Math.abs(netProj),
                    type: netProj > 0 ? 'income' : 'expense',
                    // Data de vencimento no dia 05 do mês que estamos OLHANDO (não do ciclo)
                    date: `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-05`,
                    category: 'Acerto Mensal (Futuro)',
                    is_paid: false,
                    user_id: 'system',
                    origin_file: 'VIRTUAL_INVOICE',
                    account_id: ''
                });
            }
        }
    }

    let finalTab = [...visibleNormalTransactions, ...invoiceRows, ...whatsappRows];
    
    if (filterType !== 'all') {
        finalTab = finalTab.filter(t => filterType === 'open' ? !t.is_paid : t.is_paid);
    }

    if (sortConfig.key) {
      finalTab.sort((a, b) => {
         // @ts-ignore
         const valA = a[sortConfig.key];
         // @ts-ignore
         const valB = b[sortConfig.key];
         if (typeof valA === 'string' && typeof valB === 'string') return sortConfig.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
         if (typeof valA === 'number' && typeof valB === 'number') return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
         return 0;
      });
    }
    return finalTab;
  }, [transactions, targetMonth, targetYear, searchTerm, filterType, sortConfig, currentCycleKey, previousCycleKey]);

  // UI Code starts here (Mantido igual)
  const stats = useMemo(() => {
      const total = filteredTransactions.reduce((acc, t) => t.type === 'expense' ? acc - t.amount : acc + t.amount, 0);
      const income = filteredTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
      const expense = filteredTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
      return { total, income, expense };
  }, [filteredTransactions]);

  const handleSort = (key: keyof Transaction) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ column }: { column: keyof Transaction }) => {
    if (sortConfig.key !== column) return <ArrowUpDown size={14} className="ml-1 text-slate-300 inline" />;
    return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="ml-1 text-blue-600 inline" /> : <ArrowDown size={14} className="ml-1 text-blue-600 inline" />;
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredTransactions.length && filteredTransactions.length > 0) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredTransactions.map(t => t.id)));
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Excluir ${selectedIds.size} itens?`)) return;
    const realIds = Array.from(selectedIds).filter(id => !id.startsWith('invoice-') && !id.startsWith('whatsapp-'));
    if (realIds.length < selectedIds.size) alert("Atenção: Itens virtuais não podem ser excluídos por aqui.");
    const promises = realIds.map(id => removeTransaction(id));
    await Promise.all(promises);
    setSelectedIds(new Set());
    await fetchTransactions();
  };

  const toggleStatus = async (t: Transaction) => {
      if (t.origin_file === 'VIRTUAL_INVOICE') {
          alert("Para dar baixa neste item, use o botão 'Fechar Ciclo' na tela do WhatsApp.");
          return;
      }
      await updateTransaction({ ...t, is_paid: !t.is_paid });
  };

  return (
    <div className="max-w-6xl mx-auto pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><List className="text-blue-600" /> Contas a Pagar / Receber</h2>
          <p className="text-slate-500">Controle seus compromissos futuros</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg">
           <button onClick={() => setActiveTab('list')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'list' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Lista</button>
           <button onClick={() => setActiveTab('manual')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'manual' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}><PlusCircle size={16}/> Novo Lançamento</button>
        </div>
      </div>

      {activeTab === 'manual' ? (
          <ManualEntry onSave={() => { setActiveTab('list'); fetchTransactions(); }} />
      ) : (
          <>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                <div className="flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-lg">
                    <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-slate-200 rounded-full text-slate-500"><ChevronLeft size={20}/></button>
                    <div className="flex items-center gap-2 min-w-[160px] justify-center font-bold text-slate-700 capitalize"><Calendar size={18} className="text-blue-500"/> {currentMonthName}</div>
                    <button onClick={() => changeMonth(1)} className="p-1 hover:bg-slate-200 rounded-full text-slate-500"><ChevronRight size={20}/></button>
                </div>
                
                <div className="flex gap-6 text-sm">
                    <div className="text-center"><p className="text-slate-400 font-medium text-xs uppercase">Receitas</p><p className="text-emerald-600 font-bold text-lg">{formatCurrency(stats.income)}</p></div>
                    <div className="w-px bg-slate-100 h-10"></div>
                    <div className="text-center"><p className="text-slate-400 font-medium text-xs uppercase">Despesas</p><p className="text-red-500 font-bold text-lg">{formatCurrency(Math.abs(stats.expense))}</p></div>
                    <div className="w-px bg-slate-100 h-10"></div>
                    <div className="text-center"><p className="text-slate-400 font-medium text-xs uppercase">Balanço</p><p className={`font-bold text-lg ${stats.total >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatCurrency(stats.total)}</p></div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6">
                <div className="relative w-full md:w-96"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input className="w-full pl-10 pr-4 py-2 bg-slate-50 rounded-lg outline-none text-sm focus:ring-2 focus:ring-blue-100 transition-all" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={() => setFilterType('all')} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold border ${filterType === 'all' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>TODOS</button>
                    <button onClick={() => setFilterType('open')} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold border ${filterType === 'open' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>ABERTO</button>
                    <button onClick={() => setFilterType('paid')} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold border ${filterType === 'paid' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>PAGO</button>
                </div>
            </div>

            {selectedIds.size > 0 && (
                <div className="bg-blue-50 p-2 rounded-lg flex items-center gap-4 animate-in fade-in slide-in-from-top-2 border border-blue-100 mb-4">
                    <span className="text-sm font-bold text-blue-700 ml-2">{selectedIds.size} selecionados</span>
                    <div className="h-4 w-px bg-blue-200"></div>
                    <button onClick={handleBulkDelete} className="text-red-600 hover:text-red-800 text-sm font-bold flex items-center gap-1"><Trash2 size={16}/> Excluir</button>
                </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-medium select-none border-b border-slate-200">
                            <tr>
                                <th className="p-4 w-10"><button onClick={handleSelectAll} className="text-slate-400 hover:text-blue-600">{selectedIds.size > 0 && selectedIds.size === filteredTransactions.length ? <CheckSquare size={20} className="text-blue-600"/> : <Square size={20}/>}</button></th>
                                <th className="p-4 cursor-pointer hover:text-blue-600" onClick={() => handleSort('date')}>Vencimento <SortIcon column="date"/></th>
                                <th className="p-4 cursor-pointer hover:text-blue-600" onClick={() => handleSort('description')}>Descrição <SortIcon column="description"/></th>
                                <th className="p-4 text-right cursor-pointer hover:text-blue-600" onClick={() => handleSort('amount')}>Valor <SortIcon column="amount"/></th>
                                <th className="p-4 text-center w-24">Status</th>
                                <th className="p-4 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredTransactions.length === 0 ? (
                                <tr><td colSpan={6} className="p-12 text-center text-slate-400">Nenhum lançamento encontrado.</td></tr>
                            ) : (
                                filteredTransactions.map(t => (
                                    <tr key={t.id} className={`group transition-colors ${selectedIds.has(t.id) ? 'bg-blue-50/50' : 'hover:bg-slate-50'} ${t.origin_file === 'VIRTUAL_INVOICE' ? 'bg-blue-50/30' : ''}`}>
                                        <td className="p-4">{t.origin_file !== 'VIRTUAL_INVOICE' && (<button onClick={() => toggleSelect(t.id)} className="text-slate-300 hover:text-blue-600">{selectedIds.has(t.id) ? <CheckSquare size={20} className="text-blue-600"/> : <Square size={20}/>}</button>)}</td>
                                        <td className="p-4 font-mono text-slate-600">{formatDateBR(t.date)}</td>
                                        <td className="p-4">
                                            <p className={`font-bold ${t.origin_file === 'VIRTUAL_INVOICE' ? 'text-blue-700' : 'text-slate-700'}`}>
                                                {t.description.includes('WhatsApp') ? <MessageCircle size={14} className="inline mr-2 -mt-0.5"/> : null}
                                                {t.description.includes('Fatura Cartão') ? <CreditCard size={14} className="inline mr-2 -mt-0.5"/> : null}
                                                {t.description}
                                            </p>
                                            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded mt-1 inline-block">{t.category}</span>
                                        </td>
                                        <td className={`p-4 text-right font-bold font-mono ${t.type === 'income' ? 'text-emerald-600' : 'text-red-500'}`}>{t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}</td>
                                        <td className="p-4 text-center">
                                            <button onClick={() => toggleStatus(t)}>
                                                {t.is_paid 
                                                    ? <CheckCircle size={20} className="text-emerald-500 mx-auto hover:scale-110 transition-transform"/> 
                                                    : <Circle size={20} className="text-slate-300 mx-auto hover:text-emerald-500 transition-colors"/>
                                                }
                                            </button>
                                        </td>
                                        <td className="p-4 text-right">{t.origin_file !== 'VIRTUAL_INVOICE' && (<button onClick={() => removeTransaction(t.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-600 transition-all"><Trash2 size={18}/></button>)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
          </>
      )}
    </div>
  );
}