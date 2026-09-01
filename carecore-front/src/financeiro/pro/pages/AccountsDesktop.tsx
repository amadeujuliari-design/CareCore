import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  Plus, Wallet, TrendingUp, Upload, FileText, Trash2, Edit2, CheckSquare, Square, 
  ArrowUp, ArrowDown, ArrowUpDown
} from 'lucide-react';
import { useFinanceStore } from '../store/useFinanceStore';
import { useAuth } from '../contexts/AuthContext';
import { processBankFile } from '../utils/importers';
import { formatCurrency } from '../utils/formatters';
import type { Account, Transaction } from '../types';

export function AccountsDesktop() {
  const { 
    accounts, 
    addAccount, 
    updateAccount, 
    transactions, 
    addTransactions, 
    removeTransaction,
    updateTransaction,
    fetchAccounts,
    fetchTransactions,
    rules,
    fetchRules 
  } = useFinanceStore();
  
  const { user } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeAccountId, setActiveAccountId] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [tempDate, setTempDate] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Transaction; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
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

  // CORREÇÃO: Cálculo removido. Soma direta dos saldos do banco.
  const totalPatrimony = useMemo(() => {
    return accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
  }, [accounts]);

  const handleSort = (key: keyof Transaction) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ column }: { column: keyof Transaction }) => {
    if (sortConfig.key !== column) return <ArrowUpDown size={14} className="ml-1 text-slate-300 inline" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp size={14} className="ml-1 text-blue-600 inline" /> 
      : <ArrowDown size={14} className="ml-1 text-blue-600 inline" />;
  };

  const currentTransactions = useMemo(() => {
    let sorted = transactions.filter(t => t.account_id === activeAccountId);
    if (sortConfig.key) {
      sorted.sort((a, b) => {
        // @ts-ignore
        const valA = a[sortConfig.key];
        // @ts-ignore
        const valB = b[sortConfig.key];

        if (sortConfig.key === 'amount') {
           return sortConfig.direction === 'asc' ? a.amount - b.amount : b.amount - a.amount;
        }
        if (typeof valA === 'string' && typeof valB === 'string') {
            return sortConfig.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return 0;
      });
    }
    return sorted;
  }, [transactions, activeAccountId, sortConfig]);

  const safeFormatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
        if (dateStr.includes('/') && dateStr.split('/').length === 3) return dateStr;
        const dateObj = new Date(dateStr + 'T12:00:00');
        if (isNaN(dateObj.getTime())) return dateStr; 
        return new Intl.DateTimeFormat('pt-BR').format(dateObj);
    } catch (e) { return dateStr; }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === currentTransactions.length && currentTransactions.length > 0) {
      setSelectedIds(new Set());
    } else {
      const allIds = currentTransactions.map(t => t.id);
      setSelectedIds(new Set(allIds));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Tem certeza que deseja excluir ${selectedIds.size} lançamentos?`)) return;
    setIsDeleting(true);
    try {
      const deletePromises = Array.from(selectedIds).map(id => removeTransaction(id));
      await Promise.all(deletePromises);
      setSelectedIds(new Set());
      await fetchTransactions();
    } catch (error) {
      console.error("Erro na exclusão em massa:", error);
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
            transactions
                .filter(t => t.account_id === activeAccountId)
                .map(t => {
                    const descClean = t.description.trim().toLowerCase().replace(/\s+/g, '');
                    return `${t.date}|${t.amount.toFixed(2)}|${descClean}`;
                })
        );
        
        const uniqueTransactions = newTrans.filter((t: any) => {
            const descClean = t.description.trim().toLowerCase().replace(/\s+/g, '');
            const fingerprint = `${t.date}|${t.amount.toFixed(2)}|${descClean}`;
            if (existingFingerprints.has(fingerprint)) return false;
            return true;
        });

        if (uniqueTransactions.length === 0) {
            alert("Todas as transações deste arquivo já foram importadas anteriormente.");
            setLoadingFile(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        const processedTransactions = uniqueTransactions.map((t: any) => {
            const matchedRule = rules.find(rule => 
                t.description.toLowerCase().includes(rule.keyword.toLowerCase())
            );
            
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

        // ATUALIZAÇÃO DIRETA DE SALDO (SEM CÁLCULOS)
        if (detectedBalance !== undefined) {
             const confirmMsg = `Importamos ${processedTransactions.length} transações.\n\n` +
                                `O arquivo informa um SALDO FINAL de ${formatCurrency(detectedBalance)}.\n` +
                                `Deseja gravar este valor como o saldo desta conta?`;
             
             if (confirm(confirmMsg)) {
                 const currentAccount = accounts.find(a => a.id === activeAccountId);
                 if (currentAccount) {
                     await updateAccount({ 
                         ...currentAccount,
                         balance: detectedBalance 
                     });
                     alert(`Saldo atualizado para ${formatCurrency(detectedBalance)}!`);
                 }
             } else {
                 alert(`${processedTransactions.length} novas transações importadas!`);
             }
        } else {
             alert(`${processedTransactions.length} novas transações importadas!`);
        }

      } else {
        alert("Nenhuma transação encontrada. Verifique se o arquivo tem as colunas corretas.");
      }
    } catch (error: any) {
      console.error(error);
      alert(`Erro ao processar arquivo: ${error.message}`);
    } finally {
      setLoadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const saveDateEdit = (id: string) => {
    const transaction = transactions.find(t => t.id === id);
    if (transaction) {
        updateTransaction({ ...transaction, date: tempDate });
    }
    setEditingDateId(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Minhas Contas</h2>
          <p className="text-slate-500">Gerencie saldos e importações</p>
        </div>
        <button 
          onClick={() => {
            setEditingId(null);
            setNewAccount({ name: '', balance: 0, yields: false, cdi_percent: 100 });
            setIsModalOpen(true);
          }}
          className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-lg"
        >
          <Plus size={20} /> Nova Conta
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-20"><Wallet size={48} /></div>
          <p className="text-blue-100 font-medium mb-1">Saldo Unificado</p>
          <div className="text-3xl font-bold">
              {typeof formatCurrency === 'function' ? formatCurrency(totalPatrimony) : `R$ ${totalPatrimony}`}
          </div>
        </div>

        {accounts.map(acc => {
          // CORREÇÃO: Usando saldo direto do banco
          const displayBalance = acc.balance || 0;
          
          return (
            <div 
              key={acc.id} 
              onClick={() => setActiveAccountId(acc.id)}
              className={`cursor-pointer p-6 rounded-2xl border transition-all relative overflow-hidden group
                ${activeAccountId === acc.id 
                  ? 'bg-white border-blue-500 ring-2 ring-blue-100 shadow-md' 
                  : 'bg-slate-50 border-transparent hover:bg-white hover:shadow-sm'
                }`}
            >
              <button 
                  onClick={(e) => handleEditClick(e, acc)}
                  className="absolute top-3 right-3 p-2 bg-slate-200 hover:bg-blue-100 text-slate-500 hover:text-blue-600 rounded-full transition-all opacity-0 group-hover:opacity-100 z-10"
              >
                  <Edit2 size={14} />
              </button>
              {acc.yields && (
                <div className="absolute top-0 right-10 bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-b-lg flex items-center gap-1">
                  <TrendingUp size={10} /> {acc.cdi_percent}% CDI
                </div>
              )}
              <h3 className="font-semibold text-slate-700">{acc.name}</h3>
              <p className={`text-2xl font-bold mt-2 ${activeAccountId === acc.id ? 'text-blue-600' : 'text-slate-600'}`}>
                 {typeof formatCurrency === 'function' ? formatCurrency(displayBalance) : `R$ ${displayBalance.toFixed(2)}`}
              </p>
            </div>
          );
        })}
      </div>

      {/* RESTANTE DO CÓDIGO (TABELA E IMPORTAÇÃO) MANTIDO IGUAL */}
      {activeAccountId && (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide">
              <span className="text-blue-600">{accounts.find(a => a.id === activeAccountId)?.name}</span>
            </h3>
            {selectedIds.size > 0 && (
              <button 
                onClick={handleBulkDelete}
                disabled={isDeleting}
                className="flex items-center gap-2 bg-red-100 text-red-600 px-3 py-1 rounded-lg text-sm font-bold hover:bg-red-200 transition-colors animate-in zoom-in-50 disabled:opacity-50"
              >
                {isDeleting ? 'Excluindo...' : <><Trash2 size={14} /> Excluir ({selectedIds.size})</>}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <input type="file" ref={fileInputRef} className="hidden" accept=".ofx,.csv" onChange={handleFileUpload} />
            <button 
              onClick={() => {
                if(!activeAccountId) alert("Selecione uma conta");
                else fileInputRef.current?.click();
              }}
              disabled={loadingFile}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-sm disabled:opacity-50"
            >
              <Upload size={16} /> {loadingFile ? 'Importando...' : 'Importar Extrato'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden min-h-[400px]">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-2">
             <h3 className="font-bold text-slate-700 flex items-center gap-2">
               <FileText size={18} className="text-slate-400" /> Extrato
             </h3>
          </div>
          <span className="text-xs text-slate-400 font-medium">Mostrando {currentTransactions.length} lançamentos</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-medium select-none">
              <tr>
                <th className="p-4 w-10">
                    <button onClick={handleSelectAll} className="text-slate-400 hover:text-blue-600">
                        {selectedIds.size > 0 && selectedIds.size === currentTransactions.length ? <CheckSquare size={20} className="text-blue-600" /> : <Square size={20} />}
                    </button>
                </th>
                <th className="p-4 w-32 cursor-pointer hover:text-blue-600 transition-colors" onClick={() => handleSort('date')}>
                    Data <SortIcon column="date" />
                </th>
                <th className="p-4 cursor-pointer hover:text-blue-600 transition-colors" onClick={() => handleSort('description')}>
                    Descrição <SortIcon column="description" />
                </th>
                <th className="p-4 w-44 text-right cursor-pointer hover:text-blue-600 transition-colors" onClick={() => handleSort('amount')}>
                    Valor <SortIcon column="amount" />
                </th>
                <th className="p-4 w-24 text-center">Status</th>
                <th className="p-4 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentTransactions.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">Nenhuma movimentação registrada nesta conta.</td></tr>
              ) : (
                currentTransactions.map((t) => (
                  <tr key={t.id} className={`transition-colors group ${selectedIds.has(t.id) ? 'bg-blue-50/50' : 'hover:bg-slate-50/80'}`}>
                    <td className="p-4">
                        <button onClick={() => toggleSelect(t.id)} className="text-slate-300 hover:text-blue-600">
                            {selectedIds.has(t.id) ? <CheckSquare size={20} className="text-blue-600" /> : <Square size={20} />}
                        </button>
                    </td>
                    <td className="p-4 text-slate-500 font-mono text-xs">
                        {editingDateId === t.id ? (
                            <input 
                                type="date" 
                                className="border rounded p-1 text-xs"
                                value={tempDate}
                                onChange={(e) => setTempDate(e.target.value)}
                                autoFocus
                                onBlur={() => saveDateEdit(t.id)}
                                onKeyDown={(e) => e.key === 'Enter' && saveDateEdit(t.id)}
                            />
                        ) : (
                            <div className="flex items-center gap-2 group-hover:text-blue-600 cursor-pointer" 
                                 onClick={() => { setEditingDateId(t.id); setTempDate(t.date); }}
                                 title="Clique para editar a data">
                                {safeFormatDate(t.date)}
                            </div>
                        )}
                    </td>
                    <td className="p-4 font-medium text-slate-700">
                      {t.description}
                      <div className="text-[10px] text-slate-400 font-normal mt-0.5">{t.category}{(t as any).origin_file && ` • ${(t as any).origin_file}`}</div>
                    </td>
                    <td className={`p-4 text-right font-bold font-mono whitespace-nowrap ${t.type === 'income' ? 'text-emerald-600' : 'text-red-500'}`}>
                      {t.type === 'income' ? '+' : '-'} {typeof formatCurrency === 'function' ? formatCurrency(t.amount) : t.amount.toFixed(2)}
                    </td>
                    <td className="p-4 text-center cursor-pointer" onClick={() => toggleConciliation(t)} title="Clique para alterar status">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold border transition-all
                          {(t as any).is_paid 
                            ? 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200' 
                            : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-green-100 hover:text-green-700 hover:border-green-300'
                        }`}>
                        {(t as any).is_paid ? 'CONCILIADO' : 'ABERTO'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button onClick={() => removeTransaction(t.id)} className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                          <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-slate-800 mb-4">{editingId ? 'Editar Conta' : 'Adicionar Conta'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Nome</label>
                <input autoFocus placeholder="Ex: C6 Bank..." className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={newAccount.name} onChange={e => setNewAccount({...newAccount, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Saldo Inicial</label>
                <input type="number" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={newAccount.balance} onChange={e => setNewAccount({...newAccount, balance: Number(e.target.value)})} />
              </div>
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                <input type="checkbox" checked={newAccount.yields} onChange={e => setNewAccount({...newAccount, yields: e.target.checked})} className="w-5 h-5 rounded text-blue-600" />
                <label className="text-sm text-slate-700">Rendimento Automático?</label>
              </div>
              {newAccount.yields && (
                 <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">% do CDI</label>
                    <input type="number" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={newAccount.cdi_percent} onChange={e => setNewAccount({...newAccount, cdi_percent: Number(e.target.value)})} />
                 </div>
              )}
              <div className="flex gap-2 mt-4">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
                <button onClick={handleSaveAccount} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/20">Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}