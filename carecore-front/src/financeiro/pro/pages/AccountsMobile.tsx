import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  Plus, Wallet, TrendingUp, Upload, FileText, Trash2, Edit2, CheckSquare, Square, 
  ArrowUp, ArrowDown, CheckCircle, Circle
} from 'lucide-react';
import { useFinanceStore } from '../store/useFinanceStore';
import { useAuth } from '../contexts/AuthContext';
import { processBankFile } from '../utils/importers';
import { formatCurrency, formatDateBR } from '../utils/formatters';
import type { Account, Transaction } from '../types';

export function AccountsMobile() {
  const { 
    accounts, addAccount, updateAccount, transactions, addTransactions, 
    removeTransaction, updateTransaction, fetchAccounts, fetchTransactions, 
    rules, fetchRules 
  } = useFinanceStore();
  
  const { user } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeAccountId, setActiveAccountId] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingFile, setLoadingFile] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [newAccount, setNewAccount] = useState<Partial<Account>>({
    name: '',
    balance: 0,
    yields: false,
    cdi_percent: 100
  });

  useEffect(() => {
    fetchAccounts();
    fetchTransactions();
    fetchRules();
  }, [fetchAccounts, fetchTransactions, fetchRules]);

  useEffect(() => {
    if (accounts.length > 0 && !activeAccountId) {
      setActiveAccountId(accounts[0].id);
    }
  }, [accounts, activeAccountId]);

  // CORREÇÃO: Soma direta de saldo (Sem cálculo de transações)
  const totalPatrimony = useMemo(() => {
    return accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
  }, [accounts]);

  const currentTransactions = useMemo(() => {
    const sorted = transactions.filter(t => t.account_id === activeAccountId);
    return sorted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, activeAccountId]);

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Excluir ${selectedIds.size} lançamentos?`)) return;
    setIsDeleting(true);
    try {
      const deletePromises = Array.from(selectedIds).map(id => removeTransaction(id));
      await Promise.all(deletePromises);
      setSelectedIds(new Set());
      await fetchTransactions();
    } catch (error) {
      alert("Houve um erro ao excluir alguns itens.");
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleConciliation = (transaction: Transaction) => {
      updateTransaction({ ...transaction, is_paid: !transaction.is_paid });
  };

  const handleSaveAccount = async () => {
    if (!newAccount.name || !user) return;
    
    if (editingId) {
        await updateAccount({
            id: editingId,
            name: newAccount.name,
            balance: Number(newAccount.balance),
            yields: newAccount.yields || false,
            cdi_percent: newAccount.yields ? Number(newAccount.cdi_percent) : 0
        } as any);
    } else {
        await addAccount({
            name: newAccount.name || 'Nova Conta',
            balance: Number(newAccount.balance),
            yields: newAccount.yields || false,
            cdi_percent: newAccount.yields ? Number(newAccount.cdi_percent) : 0,
            type: 'checking',
            user_id: user.id
        });
    }
    setIsModalOpen(false);
    setEditingId(null);
    setNewAccount({ name: '', balance: 0, yields: false, cdi_percent: 100 });
  };

  const handleEditClick = (e: React.MouseEvent, acc: Account) => {
    e.stopPropagation();
    setEditingId(acc.id);
    setNewAccount({
        name: acc.name,
        balance: acc.balance,
        yields: acc.yields,
        cdi_percent: acc.cdi_percent || 100
    });
    setIsModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeAccountId || !user) return;
    
    setLoadingFile(true);
    try {
      const { transactions: newTrans, balance: detectedBalance } = await processBankFile(file);
      
      if (newTrans.length > 0) {
        
        const existingFingerprints = new Set(
            transactions.filter(t => t.account_id === activeAccountId).map(t => {
                const descClean = t.description.trim().toLowerCase().replace(/\s+/g, '');
                return `${t.date}|${t.amount.toFixed(2)}|${descClean}`;
            })
        );
        
        const uniqueTransactions = newTrans.filter((t: any) => {
            const descClean = t.description.trim().toLowerCase().replace(/\s+/g, '');
            const fingerprint = `${t.date}|${t.amount.toFixed(2)}|${descClean}`;
            return !existingFingerprints.has(fingerprint);
        });

        if (uniqueTransactions.length === 0) {
            alert("Todas as transações deste arquivo já foram importadas.");
            setLoadingFile(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        const processedTransactions = uniqueTransactions.map((t: any) => {
            const matchedRule = rules.find(rule => t.description.toLowerCase().includes(rule.keyword.toLowerCase()));
            
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { conciliated, ...rest } = t;
            
            return {
                ...rest,
                account_id: activeAccountId,
                user_id: user.id,
                is_paid: false,
                category: matchedRule ? matchedRule.category : (t.category || 'Outros')
            };
        });

        if (addTransactions) {
            await addTransactions(processedTransactions);
        } else {
            await Promise.all(processedTransactions.map(t => 
                // @ts-ignore
                useFinanceStore.getState().addTransaction(t)
            ));
        }
        
        await fetchTransactions();

        // ATUALIZAÇÃO DIRETA DE SALDO
        if (detectedBalance !== undefined) {
             const confirmMsg = `Importamos ${processedTransactions.length} itens.\n` +
                                `Saldo Final do arquivo: ${formatCurrency(detectedBalance)}.\n` +
                                `Deseja atualizar o saldo da conta para este valor?`;

             if (confirm(confirmMsg)) {
                 const currentAccount = accounts.find(a => a.id === activeAccountId);
                 if (currentAccount) {
                     await updateAccount({ 
                         ...currentAccount, 
                         balance: detectedBalance 
                     });
                     alert(`Saldo atualizado para ${formatCurrency(detectedBalance)}!`);
                 }
             }
        } else {
             alert(`${processedTransactions.length} importados!`);
        }

      } else {
        alert("Arquivo sem transações válidas.");
      }
    } catch (error: any) {
      alert(`Erro: ${error.message}`);
    } finally {
      setLoadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4 pb-24 animate-in fade-in duration-500">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">Contas</h2>
        <button 
          onClick={() => {
            setEditingId(null);
            setNewAccount({ name: '', balance: 0, yields: false, cdi_percent: 100 });
            setIsModalOpen(true);
          }}
          className="bg-slate-900 text-white p-2 rounded-lg shadow-lg"
        >
          <Plus size={20} />
        </button>
      </div>

      <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-20"><Wallet size={48} /></div>
          <p className="text-blue-100 font-medium mb-1 text-sm">Saldo Unificado</p>
          <div className="text-3xl font-bold">
              {typeof formatCurrency === 'function' ? formatCurrency(totalPatrimony) : `R$ ${totalPatrimony}`}
          </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 snap-x hide-scrollbar">
        {accounts.map(acc => {
          // CORREÇÃO: Usando saldo direto do banco
          const displayBalance = acc.balance || 0;
          
          return (
            <div 
              key={acc.id} 
              onClick={() => setActiveAccountId(acc.id)}
              className={`snap-center min-w-[200px] p-4 rounded-2xl border transition-all relative overflow-hidden
                ${activeAccountId === acc.id ? 'bg-white border-blue-500 ring-2 ring-blue-100 shadow-md' : 'bg-slate-50 border-transparent'}`}
            >
              <button onClick={(e) => handleEditClick(e, acc)} className="absolute top-3 right-3 p-1.5 bg-slate-200 text-slate-500 rounded-full"><Edit2 size={12} /></button>
              {acc.yields && (
                <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold flex items-center gap-1 w-fit mb-2">
                  <TrendingUp size={8} /> {acc.cdi_percent}% CDI
                </span>
              )}
              <h3 className="font-bold text-slate-700 text-sm truncate pr-6">{acc.name}</h3>
              <p className={`text-lg font-bold mt-1 ${activeAccountId === acc.id ? 'text-blue-600' : 'text-slate-600'}`}>
                 {formatCurrency(displayBalance)}
              </p>
            </div>
          );
        })}
      </div>

      {/* RESTO DO CÓDIGO MOBILE MANTIDO IGUAL */}
      {activeAccountId && (
        <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-3">
             <h3 className="font-bold text-slate-700 text-sm">{accounts.find(a => a.id === activeAccountId)?.name}</h3>
             {selectedIds.size > 0 && (
                <button onClick={handleBulkDelete} className="bg-red-50 text-red-500 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                    <Trash2 size={12}/> {selectedIds.size}
                </button>
             )}
          </div>
          <div className="flex gap-2">
             <input type="file" ref={fileInputRef} className="hidden" accept="*" onChange={handleFileUpload} />
             <button 
               onClick={() => { if(!activeAccountId) alert("Selecione uma conta"); else fileInputRef.current?.click(); }}
               disabled={loadingFile}
               className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
             >
                <Upload size={16} /> {loadingFile ? '...' : 'Importar Extrato'}
             </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
         {currentTransactions.length === 0 ? (
            <div className="p-8 text-center text-slate-400 italic text-sm">Nenhuma movimentação.</div>
         ) : (
            currentTransactions.map((t) => (
                <div key={t.id} className={`bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between ${selectedIds.has(t.id) ? 'ring-2 ring-blue-400 bg-blue-50' : ''}`}>
                   <div className="flex items-center gap-3 overflow-hidden">
                      <button onClick={() => toggleSelect(t.id)} className="shrink-0 text-slate-300">
                          {selectedIds.has(t.id) ? <CheckSquare size={20} className="text-blue-600"/> : <Square size={20}/>}
                      </button>
                      <div className="min-w-0">
                          <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-400 font-mono">{formatDateBR(t.date).slice(0,5)}</span>
                              <p className="text-sm font-bold text-slate-700 truncate">{t.description}</p>
                          </div>
                          <p className="text-[10px] text-slate-400 pl-10">{t.category}</p>
                      </div>
                   </div>
                   <div className="text-right pl-2">
                       <p className={`text-sm font-bold ${t.type === 'income' ? 'text-emerald-600' : 'text-slate-800'}`}>
                           {t.type === 'income' ? '+' : ''}{formatCurrency(t.amount)}
                       </p>
                       <div className="flex justify-end gap-2 mt-1">
                           <button onClick={() => toggleConciliation(t)}>
                              {t.is_paid ? <CheckCircle size={14} className="text-emerald-500"/> : <Circle size={14} className="text-slate-300"/>}
                           </button>
                           <button onClick={() => removeTransaction(t.id)}>
                               <Trash2 size={14} className="text-slate-300"/>
                           </button>
                       </div>
                   </div>
                </div>
            ))
         )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-800 mb-4">{editingId ? 'Editar Conta' : 'Nova Conta'}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Nome</label>
                <input className="w-full p-3 border rounded-xl outline-none" value={newAccount.name} onChange={e => setNewAccount({...newAccount, name: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Saldo Inicial</label>
                <input type="number" className="w-full p-3 border rounded-xl outline-none" value={newAccount.balance} onChange={e => setNewAccount({...newAccount, balance: Number(e.target.value)})} />
              </div>
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl">
                <input type="checkbox" checked={newAccount.yields} onChange={e => setNewAccount({...newAccount, yields: e.target.checked})} className="w-5 h-5" />
                <label className="text-sm font-bold text-slate-600">Rendimento CDI?</label>
              </div>
              {newAccount.yields && (
                 <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">% do CDI</label>
                    <input type="number" className="w-full p-3 border rounded-xl outline-none" value={newAccount.cdi_percent} onChange={e => setNewAccount({...newAccount, cdi_percent: Number(e.target.value)})} />
                 </div>
              )}
              <div className="flex gap-2 mt-4">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl">Cancelar</button>
                <button onClick={handleSaveAccount} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg">Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}