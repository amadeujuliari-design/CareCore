import { useState, useRef, useMemo, useEffect } from 'react';
import { 
  Upload, CheckCircle, CreditCard, 
  ChevronLeft, ChevronRight, Trash2, 
  RefreshCw, AlertCircle
} from 'lucide-react';
import { useFinanceStore } from '../store/useFinanceStore';
import { useAuth } from '../contexts/AuthContext';
import type { Transaction } from '../types';

// --- HELPERS (Mesma lógica do original) ---
const formatCurrency = (val: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const parseSmartNumber = (valStr: string): number => {
  if (!valStr) return 0;
  const clean = valStr.trim().replace(/[R$\s]/g, '');
  if (!clean || clean === '0' || clean === '0,00') return 0;
  if (clean.includes('.') && clean.includes(',')) {
     const lastDot = clean.lastIndexOf('.');
     const lastComma = clean.lastIndexOf(',');
     if (lastComma > lastDot) return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
  }
  if (clean.includes(',') && !clean.includes('.')) return parseFloat(clean.replace(',', '.'));
  return parseFloat(clean);
};

interface CardTransaction extends Transaction {
  is_projected?: boolean;
  invoice_month?: string;
  origin_file?: string;
}

export function CardsMobile() {
  const { transactions, addTransactions, removeTransaction, updateTransaction, fetchTransactions, accounts } = useFinanceStore();
  const { user } = useAuth();
  
  const [viewDate, setViewDate] = useState(new Date());
  const [feedback, setFeedback] = useState<{type: 'success' | 'error' | 'info', msg: string} | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const currentViewKey = useMemo(() => {
    const y = viewDate.getFullYear();
    const m = String(viewDate.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, [viewDate]);

  const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(viewDate);

  const currentInvoiceItems = useMemo(() => {
    return transactions.filter((t) => {
      const item = t as CardTransaction;
      if (item.category === 'Pagamento de Fatura') return false;
      if (!item.invoice_month) return false;
      return item.invoice_month.startsWith(currentViewKey);
    }) as CardTransaction[];
  }, [transactions, currentViewKey]);

  const totalFatura = useMemo(() => {
    return currentInvoiceItems.reduce((acc, t) => {
      if (t.category === 'Pagamento de Fatura') return acc;
      const val = t.type === 'expense' ? t.amount : -t.amount;
      return acc + val;
    }, 0);
  }, [currentInvoiceItems]);

  const isInvoiceClosed = currentInvoiceItems.length > 0 && currentInvoiceItems.every(t => t.is_paid);

  const conciliationMatch = useMemo(() => {
    if (totalFatura === 0) return null;
    return transactions.find(t => 
      !t.invoice_month && 
      t.type === 'expense' && 
      Math.abs(t.amount - totalFatura) < 0.05
    );
  }, [totalFatura, transactions]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const nameMatch = file.name.match(/(\d{4})-(\d{2})/);
    if (!nameMatch) {
      setFeedback({ type: 'error', msg: 'Nome inválido. Use: Fatura_AAAA-MM.csv' });
      return;
    }
    const fileYear = parseInt(nameMatch[1]);
    const fileMonth = parseInt(nameMatch[2]);
    const importBatchKey = `${fileYear}-${String(fileMonth).padStart(2, '0')}`;
    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === 'string') {
          processCSV(ev.target.result, importBatchKey, file.name);
      }
    };
    reader.readAsText(file, 'ISO-8859-1');
  };

  const processCSV = async (csvContent: string, batchKey: string, fileName: string) => {
    if (!user) return;
    try {
      const lines = csvContent.split('\n').filter(l => l.trim().length > 0);
      if (lines.length < 2) throw new Error("Arquivo vazio");

      // === SEGURANÇA CRÍTICA: LIMPEZA DE PROJEÇÕES ANTIGAS ===
      // Remove lançamentos deste mês que já existiam E projeções futuras para evitar duplicação
      const toRemove = transactions.filter(t => {
         const item = t as CardTransaction;
         if (!item.invoice_month) return false;
         
         const isCurrentMonth = item.invoice_month === batchKey;
         // Remove projeções futuras APENAS se elas vierem de uma projeção antiga de sistema
         const isFutureProjection = item.is_projected && item.invoice_month > batchKey && item.origin_file === 'SYSTEM_PROJECTION';
         
         return isCurrentMonth || isFutureProjection;
      });

      if (toRemove.length > 0) {
          await Promise.all(toRemove.map(t => removeTransaction(t.id)));
      }
      // ========================================================

      const headerLine = lines[0].toLowerCase();
      const delimiter = headerLine.includes(';') ? ';' : ',';
      const headers = headerLine.split(delimiter).map(h => h.trim().replace(/"/g, ''));
      
      let colMap = {
        date: headers.findIndex(h => h.includes('data')),
        desc: headers.findIndex(h => h.includes('descrição') || h.includes('estabelecimento')),
        parc: headers.findIndex(h => h.includes('parcela')),
        val: headers.findIndex(h => h.includes('valor (em r$)') || h.includes('valor (r$)') || h.includes('valor (brl)')),
      };

      if (colMap.val === -1) colMap.val = headers.findIndex(h => (h.includes('valor') || h.includes('amount')) && !h.includes('us$'));
      if (colMap.date === -1) colMap.date = 0;
      if (colMap.desc === -1) colMap.desc = 4;
      if (colMap.parc === -1) colMap.parc = 5;
      if (colMap.val === -1) colMap.val = 8; 

      const newTransactions: any[] = [];
      let importedCount = 0;
      let projectedCount = 0;

      for (const line of lines.slice(1)) {
         try {
            const cols = line.split(delimiter).map(c => c.trim().replace(/"/g, ''));
            if (cols.length < 3) continue;

            const dateStr = cols[colMap.date];
            const descRaw = cols[colMap.desc];
            const valStr = cols[colMap.val];
            const parcStr = cols[colMap.parc];

            if (!dateStr || !valStr) continue;

            const rawAmount = parseSmartNumber(valStr);
            const amountAbs = Math.abs(rawAmount);
            const descUpper = (descRaw || '').toUpperCase();
            
            let type: 'income' | 'expense' = 'expense';
            let category = 'Cartão';
            
            const isServicePayment = ['CLARO', 'VIVO', 'TIM', 'NET', 'OI', 'LUZ', 'ENERGIA', 'AGUA', 'GAS'].some(s => descUpper.includes(s));
            
            if (!isServicePayment && (descUpper.includes('PAGAMENTO DE FATURA') || descUpper.includes('PGTO FATURA'))) {
               category = 'Pagamento de Fatura';
               type = 'income';
            } else if (!isServicePayment && rawAmount < 0 && (descUpper.includes('PAGAMENTO') || descUpper.includes('INCLUSAO'))) {
                 category = 'Pagamento de Fatura';
                 type = 'income';
            } else if (descUpper.includes('ESTORNO') || descUpper.includes('CANCELAMENTO')) {
                category = 'Estorno';
                type = 'income';
            } else if (rawAmount < 0) {
                category = 'Crédito/Estorno';
                type = 'income';
            }

            if (amountAbs === 0 && category !== 'Pagamento de Fatura') continue;

            let currentP = 1, totalP = 1;
            if (parcStr && parcStr.includes('/')) {
                const p = parcStr.split('/');
                currentP = parseInt(p[0]);
                totalP = parseInt(p[1]);
            }

            let isoDate = batchKey + '-10';
            // @ts-ignore
            newTransactions.push({
                user_id: user.id,
                date: isoDate,
                description: `${descRaw} ${totalP > 1 ? `(${currentP}/${totalP})` : ''}`,
                amount: amountAbs,
                type: type,
                category: category,
                account_id: null,
                is_paid: false,
                origin_file: fileName,
                invoice_month: batchKey, 
                is_projected: false
            });
            importedCount++;

            const remaining = totalP - currentP;
            if (remaining > 0 && type === 'expense') {
                const [bYear, bMonth] = batchKey.split('-').map(Number);
                for (let i = 1; i <= remaining; i++) {
                    const futureDate = new Date(bYear, (bMonth - 1) + i, 10);
                    const fYear = futureDate.getFullYear();
                    const fMonth = String(futureDate.getMonth() + 1).padStart(2, '0');
                    const futureKey = `${fYear}-${fMonth}`;
                    // @ts-ignore
                    newTransactions.push({
                        user_id: user.id,
                        date: futureDate.toISOString().split('T')[0],
                        description: `${descRaw} (${currentP + i}/${totalP})`,
                        amount: amountAbs,
                        type: 'expense',
                        category: category,
                        account_id: null,
                        is_paid: false,
                        origin_file: 'SYSTEM_PROJECTION',
                        invoice_month: futureKey,
                        is_projected: true
                    });
                    projectedCount++;
                }
            }
         } catch (lineErr) { console.warn(lineErr); }
      }

      if (newTransactions.length > 0) {
          await addTransactions(newTransactions);
          await fetchTransactions(); 
      }

      const [y, m] = batchKey.split('-').map(Number);
      setViewDate(new Date(y, m - 1, 1));
      setFeedback({ type: 'success', msg: `Sucesso! ${importedCount} lançamentos e ${projectedCount} projeções.` });
    } catch (e) {
      console.error(e);
      setFeedback({ type: 'error', msg: 'Erro ao ler arquivo.' });
    } finally {
        setIsProcessing(false);
        if(fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const closeInvoice = async () => {
     if (!currentInvoiceItems.length) return;
     const msg = conciliationMatch 
        ? `VINCULAR pagamento de ${formatCurrency(conciliationMatch.amount)} e fechar fatura?`
        : `NENHUM PAGAMENTO de ${formatCurrency(totalFatura)} encontrado.\nCriar saída manual e fechar?`;
     if (confirm(msg)) {
        for (const t of currentInvoiceItems) { await updateTransaction({...t, is_paid: true}); }
        if (conciliationMatch) {
            await updateTransaction({ ...conciliationMatch, is_paid: true, description: `${conciliationMatch.description} (Fatura Cartão)` });
        } else {
            if (user) {
                // @ts-ignore
                await addTransactions([{
                    user_id: user.id,
                    date: new Date().toISOString().split('T')[0],
                    description: `Pagamento Fatura ${monthLabel}`,
                    amount: totalFatura,
                    type: 'expense',
                    category: 'Pagamento de Fatura',
                    account_id: accounts[0]?.id, 
                    is_paid: true,
                    origin_file: 'AUTO_CLOSING'
                }]);
            }
        }
        await fetchTransactions();
        setFeedback({ type: 'success', msg: 'Fatura fechada!' });
     }
  };

  const clearBatch = async () => {
    if (confirm(`Apagar todos os itens de ${monthLabel}?`)) {
      const promises = currentInvoiceItems.map(t => removeTransaction(t.id));
      await Promise.all(promises);
      await fetchTransactions(); 
      setFeedback({ type: 'info', msg: 'Lote limpo.' });
    }
  };

  const navMonth = (dir: number) => {
    const d = new Date(viewDate);
    d.setMonth(d.getMonth() + dir);
    setViewDate(d);
  };

  return (
    <div className="space-y-4 pb-24 animate-in fade-in duration-500">
      
      {/* HEADER + NAV MÊS */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <button onClick={() => navMonth(-1)} className="p-2 bg-slate-50 rounded-full text-slate-500"><ChevronLeft size={20}/></button>
          <div className="text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">FATURA</p>
              <p className="text-lg font-bold text-slate-800 capitalize">{monthLabel}</p>
          </div>
          <button onClick={() => navMonth(1)} className="p-2 bg-slate-50 rounded-full text-slate-500"><ChevronRight size={20}/></button>
      </div>

      {feedback && (
        <div className={`p-3 rounded-xl border flex items-center gap-3 text-xs font-bold ${feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
           {feedback.type === 'success' ? <CheckCircle size={16}/> : <AlertCircle size={16}/>}
           {feedback.msg}
        </div>
      )}

      {/* CARD PRINCIPAL (VALOR) */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
          <div className="absolute right-0 top-0 p-4 opacity-10"><CreditCard size={80}/></div>
          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-widest">Valor da Fatura</p>
          <h3 className="text-3xl font-bold">{formatCurrency(totalFatura)}</h3>
          
          <div className="flex gap-2 mt-4">
             {!isInvoiceClosed && (
                <label className={`flex-1 bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer ${isProcessing ? 'opacity-50' : ''}`}>
                    <Upload size={14}/> Importar CSV
                    <input type="file" ref={fileInputRef} accept=".csv" className="hidden" onChange={handleFileSelect} disabled={isProcessing} />
                </label>
             )}
             {currentInvoiceItems.length > 0 && !isInvoiceClosed && (
                 <button onClick={closeInvoice} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2">
                    <CheckCircle size={14}/> Fechar Fatura
                 </button>
             )}
          </div>
      </div>

      {/* AVISO DE CONCILIAÇÃO */}
      {conciliationMatch && !isInvoiceClosed && (
          <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl flex gap-3 items-center">
              <RefreshCw className="text-indigo-600 shrink-0" size={20} />
              <div>
                  <p className="text-xs font-bold text-indigo-800 uppercase">Pagamento Detectado</p>
                  <p className="text-xs text-indigo-600">Encontrei uma saída de {formatCurrency(conciliationMatch.amount)} no extrato.</p>
              </div>
          </div>
      )}

      {/* LISTA DE COMPRAS (CARDS) */}
      <div className="space-y-3">
        <div className="flex justify-between items-center px-1">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Lançamentos</h3>
            {currentInvoiceItems.length > 0 && !isProcessing && (
                <button onClick={clearBatch} className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1">
                    <Trash2 size={12}/> Limpar Mês
                </button>
            )}
        </div>

        {currentInvoiceItems.length === 0 ? (
          <div className="text-center py-10 text-slate-400 italic">Nenhum lançamento.</div>
        ) : (
          currentInvoiceItems.map((t) => (
            <div key={t.id} className={`bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between ${t.is_projected ? 'bg-amber-50/40 border-amber-100' : ''}`}>
               <div className="flex items-center gap-3 overflow-hidden">
                  <div className="text-center min-w-[35px]">
                      <p className="text-xs text-slate-400 font-bold">{t.date ? t.date.split('-')[2] : '-'}</p>
                      <p className="text-[9px] text-slate-300 uppercase">{t.date ? new Date(t.date).toLocaleDateString('pt-BR', {month:'short'}).slice(0,3) : '-'}</p>
                  </div>
                  <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-700 truncate">{t.description.replace(/\(\d+\/\d+\)/, '')}</p>
                      <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400">{t.category}</span>
                          {t.is_projected && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 rounded font-bold">PROJEÇÃO</span>}
                          {t.description.match(/\(\d+\/\d+\)/) && (
                              <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 rounded font-bold">
                                  {t.description.match(/\(\d+\/\d+\)/)?.[0]}
                              </span>
                          )}
                      </div>
                  </div>
               </div>
               <div className="text-right whitespace-nowrap ml-2">
                   <p className={`text-sm font-bold ${t.type === 'income' ? 'text-emerald-600' : 'text-slate-700'}`}>
                       {t.type === 'income' ? '+' : ''}{formatCurrency(t.amount)}
                   </p>
               </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}