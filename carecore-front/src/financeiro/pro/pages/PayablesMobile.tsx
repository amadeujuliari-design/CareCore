import { useState, useMemo, useEffect } from 'react';
import { 
  PlusCircle, List, Search, Trash2, CheckCircle, Circle, 
  ChevronLeft, ChevronRight, Calendar, ArrowUp, ArrowDown, 
  CreditCard, MessageCircle, Square, CheckSquare, X 
} from 'lucide-react';
import { ManualEntry } from '../components/ManualEntry'; 
import { useFinanceStore } from '../store/useFinanceStore';
import { formatCurrency, formatDateBR } from '../utils/formatters';
import type { Transaction } from '../types';

export function PayablesMobile() {
  const { transactions, removeTransaction, updateTransaction, fetchTransactions } = useFinanceStore();
  const [activeTab, setActiveTab] = useState<'list' | 'manual'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'open' | 'paid'>('all');
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const changeMonth = (delta: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setCurrentDate(newDate);
    setSelectedIds(new Set()); // Limpa seleção ao mudar mês
  };

  const currentMonthName = currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
  const targetMonth = currentDate.getMonth();
  const targetYear = currentDate.getFullYear();
  
  // Ciclo para Cartão (Mês da tela)
  const currentCycleKey = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;

  // Ciclo para WhatsApp (Mês ANTERIOR ao da tela)
  const prevDate = new Date(targetYear, targetMonth - 1, 1);
  const previousCycleKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const filteredTransactions = useMemo(() => {
    const normalTransactions: Transaction[] = [];
    const cardTransactions: Transaction[] = [];
    const whatsappTransactions: Transaction[] = [];

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

    const visibleNormalTransactions = normalTransactions.filter(t => {
        const tDate = new Date(t.date + 'T12:00:00');
        return tDate.getMonth() === targetMonth && tDate.getFullYear() === targetYear;
    });

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

    // 4. WhatsApp Logic
    const whatsappRows: Transaction[] = [];
    const today = new Date();
    const isCurrentView = targetMonth === today.getMonth() && targetYear === today.getFullYear();

    // LÓGICA 1: ACUMULADO ABERTO (Mês Atual - Itens Importados/Reais)
    const waOpenLegacy = whatsappTransactions.filter(t => !t.is_projected && !t.is_paid);
    
    if (waOpenLegacy.length > 0 && isCurrentView) {
        let leoSum = 0; let claudioSum = 0;
        waOpenLegacy.forEach(t => {
             const resp = (t.responsible || '').toUpperCase();
             const cat = (t.category || '').toUpperCase();
             let isLeo = false; let isClaudio = false;
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
                description: `Fechamento WhatsApp (Aberto)`,
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

    // LÓGICA 2: PROJEÇÃO FUTURA (Meses Seguintes - Parcelas)
    if (!isCurrentView) {
        const waProjected = whatsappTransactions.filter(t => 
            t.is_projected && 
            !t.is_paid && 
            t.whatsapp_cycle_key === previousCycleKey
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
                    description: `Projeção WhatsApp (Ciclo ${previousCycleKey})`,
                    amount: Math.abs(netProj),
                    type: netProj > 0 ? 'income' : 'expense',
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
    finalTab.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return finalTab;
  }, [transactions, targetMonth, targetYear, searchTerm, filterType, currentCycleKey, previousCycleKey]);

  // Lógica de Seleção
  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleSelectAll = () => {
    const selectableItems = filteredTransactions.filter(t => t.origin_file !== 'VIRTUAL_INVOICE');
    
    if (selectedIds.size >= selectableItems.length && selectableItems.length > 0) {
        setSelectedIds(new Set());
    } else {
        const allIds = selectableItems.map(t => t.id);
        setSelectedIds(new Set(allIds));
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Deseja excluir ${selectedIds.size} itens?`)) return;
    
    for (const id of selectedIds) {
        await removeTransaction(id);
    }
    setSelectedIds(new Set());
  };

  // UI (Estatísticas e Renderização)
  const stats = useMemo(() => {
      const total = filteredTransactions.reduce((acc, t) => t.type === 'expense' ? acc - t.amount : acc + t.amount, 0);
      const income = filteredTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
      const expense = filteredTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
      return { total, income, expense };
  }, [filteredTransactions]);

  const toggleStatus = async (t: Transaction) => {
      if (t.origin_file === 'VIRTUAL_INVOICE') {
          alert("Gerencie o status deste item pela tela do WhatsApp.");
          return;
      }
      await updateTransaction({ ...t, is_paid: !t.is_paid });
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-24 relative">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">Contas</h2>
        <div className="flex bg-slate-100 p-1 rounded-lg">
           <button onClick={() => setActiveTab('list')} className={`px-3 py-1.5 rounded-md text-xs font-bold ${activeTab === 'list' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>Lista</button>
           <button onClick={() => setActiveTab('manual')} className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 ${activeTab === 'manual' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}><PlusCircle size={14}/> Novo</button>
        </div>
      </div>

      {activeTab === 'manual' ? (
          <ManualEntry onSave={() => { setActiveTab('list'); fetchTransactions(); }} />
      ) : (
          <>
            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
                <button onClick={() => changeMonth(-1)} className="p-2 bg-slate-50 rounded-full text-slate-500"><ChevronLeft size={18}/></button>
                <div className="text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mês de Referência</p>
                    <p className="text-sm font-bold text-slate-700 capitalize flex items-center justify-center gap-2">
                        <Calendar size={14} className="text-blue-500"/> {currentMonthName}
                    </p>
                </div>
                <button onClick={() => changeMonth(1)} className="p-2 bg-slate-50 rounded-full text-slate-500"><ChevronRight size={18}/></button>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2 snap-x hide-scrollbar">
                <div className="snap-center min-w-[140px] bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg"><ArrowUp size={14}/></div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Receitas</span>
                    </div>
                    <p className="text-lg font-bold text-emerald-600">{formatCurrency(stats.income)}</p>
                </div>
                <div className="snap-center min-w-[140px] bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="p-1.5 bg-red-100 text-red-600 rounded-lg"><ArrowDown size={14}/></div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Despesas</span>
                    </div>
                    <p className="text-lg font-bold text-red-500">{formatCurrency(Math.abs(stats.expense))}</p>
                </div>
                <div className="snap-center min-w-[140px] bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Balanço</span>
                    </div>
                    <p className={`text-lg font-bold ${stats.total >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatCurrency(stats.total)}</p>
                </div>
            </div>

            {/* Filtros e Selecionar Tudo */}
            <div className="flex justify-between items-center gap-2 pb-1 overflow-x-auto">
                <div className="flex gap-2">
                    <button onClick={() => setFilterType('all')} className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap border ${filterType === 'all' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}>TODOS</button>
                    <button onClick={() => setFilterType('open')} className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap border ${filterType === 'open' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-white text-slate-600 border-slate-200'}`}>ABERTO</button>
                    <button onClick={() => setFilterType('paid')} className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap border ${filterType === 'paid' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white text-slate-600 border-slate-200'}`}>PAGO</button>
                </div>
                <button 
                    onClick={handleSelectAll}
                    className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500"
                    title="Selecionar Tudo"
                >
                    {selectedIds.size > 0 && selectedIds.size >= filteredTransactions.filter(t => t.origin_file !== 'VIRTUAL_INVOICE').length ? 
                        <CheckSquare size={18} className="text-blue-600"/> : 
                        <Square size={18}/>
                    }
                </button>
            </div>

            <div className="space-y-3">
                {filteredTransactions.length === 0 ? (
                    <div className="p-10 text-center text-slate-400 italic">Nenhum lançamento.</div>
                ) : (
                    filteredTransactions.map(t => {
                        const isSelected = selectedIds.has(t.id);
                        const isVirtual = t.origin_file === 'VIRTUAL_INVOICE';

                        return (
                            <div key={t.id} className={`bg-white p-4 rounded-xl border shadow-sm relative overflow-hidden transition-colors ${isSelected ? 'border-blue-400 bg-blue-50/30' : 'border-slate-100'} ${isVirtual ? 'bg-blue-50/40 border-blue-100' : ''}`}>
                                <div className="flex gap-3">
                                    {/* Área de Seleção */}
                                    {!isVirtual && (
                                        <button 
                                            onClick={() => toggleSelection(t.id)}
                                            className="self-center -ml-1 mr-1 text-slate-400 hover:text-blue-600"
                                        >
                                            {isSelected ? <CheckSquare size={20} className="text-blue-600" /> : <Square size={20} />}
                                        </button>
                                    )}

                                    <div className="flex-1">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-start gap-3">
                                                <div className={`p-2 rounded-full shrink-0 ${t.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                                    {t.type === 'income' ? <ArrowUp size={16}/> : <ArrowDown size={16}/>}
                                                </div>
                                                <div>
                                                    <p className={`text-sm font-bold ${isVirtual ? 'text-blue-700' : 'text-slate-700'}`}>
                                                        {t.description.includes('Fechamento WhatsApp') && <MessageCircle size={14} className="inline mr-1 -mt-0.5"/>}
                                                        {t.description.includes('Projeção WhatsApp') && <MessageCircle size={14} className="inline mr-1 -mt-0.5"/>}
                                                        {t.description.includes('Fatura Cartão') && <CreditCard size={14} className="inline mr-1 -mt-0.5"/>}
                                                        {t.description}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400">
                                                        {formatDateBR(t.date)} • {t.category}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-sm font-bold font-mono ${t.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                    {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-50">
                                            <button onClick={() => toggleStatus(t)} className="flex items-center gap-1.5">
                                                {t.is_paid 
                                                    ? <><CheckCircle size={16} className="text-emerald-500"/> <span className="text-[10px] font-bold text-emerald-600">PAGO</span></>
                                                    : <><Circle size={16} className="text-slate-300"/> <span className="text-[10px] font-bold text-slate-400">ABERTO</span></>
                                                }
                                            </button>
                                            {!isVirtual && !isSelected && (
                                                <button onClick={() => removeTransaction(t.id)} className="text-slate-300 hover:text-red-500">
                                                    <Trash2 size={16}/>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Barra flutuante de ações em massa */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-20 left-4 right-4 bg-slate-900 text-white p-4 rounded-xl shadow-xl flex justify-between items-center z-50 animate-in slide-in-from-bottom-5">
                    <span className="text-sm font-bold">{selectedIds.size} selecionado(s)</span>
                    <div className="flex gap-4">
                        <button onClick={() => setSelectedIds(new Set())} className="text-slate-400 hover:text-white">
                            <X size={20}/>
                        </button>
                        <button onClick={handleBulkDelete} className="flex items-center gap-2 text-red-400 hover:text-red-300 font-bold text-sm">
                            <Trash2 size={18} /> Excluir
                        </button>
                    </div>
                </div>
            )}
          </>
      )}
    </div>
  );
}