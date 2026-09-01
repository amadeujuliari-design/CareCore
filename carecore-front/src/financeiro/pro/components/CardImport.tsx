import { useState, useRef, useMemo, useEffect } from 'react';
import { 
  Upload, CheckCircle, CreditCard, 
  Search, ChevronLeft, ChevronRight, Trash2, 
  Lock, RefreshCw, AlertCircle 
} from 'lucide-react';
import { useFinanceStore } from '../store/useFinanceStore';
import { useAuth } from '../contexts/AuthContext';
import type { Transaction } from '../types';

interface CardTransaction extends Transaction {
  is_projected?: boolean;
  invoice_month?: string;
  origin_file?: string;
}

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const parseSmartNumber = (valStr: string): number => {
  if (!valStr) return 0;
  const clean = valStr.trim().replace(/[R$\s]/g, '');
  if (!clean || clean === '0' || clean === '0,00') return 0;
  
  if (clean.includes('.') && clean.includes(',')) {
     const lastDot = clean.lastIndexOf('.');
     const lastComma = clean.lastIndexOf(',');
     if (lastComma > lastDot) {
        return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
     }
  }
  if (clean.includes(',') && !clean.includes('.')) {
     return parseFloat(clean.replace(',', '.'));
  }
  return parseFloat(clean);
};

export function CardImport() {
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

      // === CORREÇÃO CRÍTICA AQUI ===
      // Remove transações do mês atual E projeções futuras obsoletas
      const toRemove = transactions.filter(t => {
         const item = t as CardTransaction;
         if (!item.invoice_month) return false;

         // 1. Remove tudo que pertence a este mês de fatura (para reimportar limpo)
         const isCurrentMonth = item.invoice_month === batchKey;
         
         // 2. Remove projeções FUTURAS que podem estar duplicadas ou desatualizadas
         // (Ex: Se estou importando Jan/2026, apago as projeções de Fev/2026 em diante que existiam antes)
         const isFutureProjection = item.is_projected && item.invoice_month > batchKey;

         return isCurrentMonth || isFutureProjection;
      });

      if (toRemove.length > 0) {
          await Promise.all(toRemove.map(t => removeTransaction(t.id)));
      }
      // ==============================

      const headerLine = lines[0].toLowerCase();
      const delimiter = headerLine.includes(';') ? ';' : ',';
      const headers = headerLine.split(delimiter).map(h => h.trim().replace(/"/g, ''));
      
      const colMap = {
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

            // Reconhece o pagamento da própria fatura em diversas redações do banco:
            // "Inclusao de Pagamento", "Pagamento de Fatura", "Pag Fatura Boleto",
            // "Pgto Fatura", "Pagto Fatura", "Credito em Conta", etc.
            const hasPaymentVerb = /\bPAG(?:AMENTO|TO|GTO|GAMENTO)?\b/.test(descUpper) || descUpper.includes('PGTO') || descUpper.includes('INCLUSAO');
            const isInvoicePayment =
               descUpper.includes('PAGAMENTO DE FATURA') ||
               descUpper.includes('INCLUSAO DE PAGAMENTO') ||
               descUpper.includes('CREDITO EM CONTA') ||
               (descUpper.includes('FATURA') && (hasPaymentVerb || descUpper.includes('BOLETO'))) ||
               (descUpper.includes('BOLETO') && hasPaymentVerb);

            if (!isServicePayment && !descUpper.includes('MENSAL') && isInvoicePayment) {
                category = 'Pagamento de Fatura';
                type = 'income';
            }
            else if (!isServicePayment && rawAmount < 0 && hasPaymentVerb) {
                 category = 'Pagamento de Fatura';
                 type = 'income';
            }
            else if (descUpper.includes('ESTORNO') || descUpper.includes('CANCELAMENTO')) {
                category = 'Estorno';
                type = 'income';
            }
            else if (rawAmount < 0) {
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
      
      setFeedback({ type: 'success', msg: `Sucesso! ${importedCount} lançamentos oficiais, ${projectedCount} projeções recriadas e ${toRemove.length} itens antigos limpos.` });

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
        ? `ENCONTRADO: Pagamento de ${formatCurrency(conciliationMatch.amount)} em '${conciliationMatch.description}'.\n\nDeseja VINCULAR este pagamento e fechar a fatura?`
        : `NENHUM PAGAMENTO de ${formatCurrency(totalFatura)} encontrado no extrato.\n\nDeseja CRIAR uma saída manual na sua conta e fechar?`;

     if (confirm(msg)) {
        for (const t of currentInvoiceItems) {
            await updateTransaction({...t, is_paid: true});
        }
        
        if (conciliationMatch) {
            await updateTransaction({
                ...conciliationMatch, 
                is_paid: true,
                description: `${conciliationMatch.description} (Fatura Cartão)`
            });
        } else {
            if (user) {
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
        setFeedback({ type: 'success', msg: 'Fatura fechada e conciliada!' });
     }
  };

  const clearBatch = async () => {
    if (confirm(`ATENÇÃO: Deseja apagar todos os itens de ${monthLabel}?`)) {
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
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl text-white shadow-lg ${isInvoiceClosed ? 'bg-emerald-600' : 'bg-slate-900'}`}>
            {isInvoiceClosed ? <Lock size={24} /> : <CreditCard size={24} />}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 uppercase">{monthLabel}</h2>
            <p className="text-xs font-bold tracking-widest uppercase text-slate-400">LOTE: {currentViewKey}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
           <div className="flex items-center bg-slate-100 p-1 rounded-lg">
              <button onClick={() => navMonth(-1)} className="p-2 hover:bg-white rounded-md text-slate-600"><ChevronLeft size={20}/></button>
              <button onClick={() => setViewDate(new Date())} className="px-4 text-xs font-bold text-slate-500 hover:text-slate-800">HOJE</button>
              <button onClick={() => navMonth(1)} className="p-2 hover:bg-white rounded-md text-slate-600"><ChevronRight size={20}/></button>
           </div>
           
           <div className="flex gap-2">
               {!isInvoiceClosed && (
                <label className={`cursor-pointer bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}>
                    <Upload size={16}/> {isProcessing ? 'PROCESSANDO...' : 'IMPORTAR CSV'}
                    <input type="file" ref={fileInputRef} accept=".csv" className="hidden" onChange={handleFileSelect} disabled={isProcessing} />
                </label>
             )}
             
             {currentInvoiceItems.length > 0 && !isProcessing && (
                <button onClick={clearBatch} className="p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors" title="Limpar Lote / Reabrir">
                    <Trash2 size={18} />
                </button>
             )}
           </div>
        </div>
      </div>

      {feedback && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 ${feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
           {feedback.type === 'success' ? <CheckCircle size={20}/> : <AlertCircle size={20}/>}
           <span className="text-sm font-medium">{feedback.msg}</span>
        </div>
      )}

      {/* Cards de Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 p-4 opacity-10"><CreditCard size={64}/></div>
          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-widest">Valor da Fatura</p>
          <h3 className="text-3xl font-bold text-slate-800">{formatCurrency(totalFatura)}</h3>
          <p className="text-xs text-slate-400 mt-2">{currentInvoiceItems.length} lançamentos</p>
        </div>

        {/* Card Dinâmico de Conciliação */}
        <div className={`col-span-1 md:col-span-2 p-6 rounded-2xl border transition-all ${
            isInvoiceClosed ? 'bg-emerald-50 border-emerald-200' : 
            conciliationMatch ? 'bg-indigo-50 border-indigo-200' : 
            'bg-amber-50 border-amber-200'
        }`}>
           <div className="flex items-start justify-between">
              <div className="flex gap-4">
                 <div className={`p-3 rounded-full ${
                    isInvoiceClosed ? 'bg-emerald-200 text-emerald-700' : 
                    conciliationMatch ? 'bg-indigo-200 text-indigo-700' : 
                    'bg-amber-200 text-amber-700'
                 }`}>
                    {isInvoiceClosed ? <Lock size={24}/> : conciliationMatch ? <CheckCircle size={24}/> : <RefreshCw size={24}/>}
                 </div>
                 <div>
                    <h4 className={`font-bold uppercase text-xs mb-1 ${
                        isInvoiceClosed ? 'text-emerald-800' : 
                        conciliationMatch ? 'text-indigo-800' : 
                        'text-amber-800'
                    }`}>
                       {isInvoiceClosed ? 'Fatura Liquidada' : conciliationMatch ? 'Pagamento Encontrado' : 'Aguardando Pagamento'}
                    </h4>
                    <p className="text-sm text-slate-600 max-w-md">
                       {isInvoiceClosed 
                          ? 'Esta fatura já foi baixada e conciliada.'
                          : conciliationMatch 
                             ? `Detectamos uma saída de ${formatCurrency(conciliationMatch.amount)} dia ${new Date(conciliationMatch.date).toLocaleDateString()} na sua conta.`
                             : 'Não encontramos o pagamento no extrato. Ao fechar, criaremos um manual.'}
                    </p>
                 </div>
              </div>
              
              {!isInvoiceClosed && currentInvoiceItems.length > 0 && (
                   <button 
                    onClick={closeInvoice} 
                    className={`px-6 py-3 rounded-xl font-bold text-xs shadow-lg transition-transform hover:scale-105 flex items-center gap-2 ${
                        conciliationMatch ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-amber-600 text-white hover:bg-amber-700'
                    }`}
                 >
                    {conciliationMatch ? <CheckCircle size={16}/> : <Lock size={16}/>}
                    {conciliationMatch ? 'CONCILIAR E FECHAR' : 'FECHAR MANUALMENTE'}
                 </button>
              )}
           </div>
        </div>
      </div>

      {/* Tabela de Lançamentos */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wider">Lançamentos</h3>
          <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded font-bold text-slate-600">{currentInvoiceItems.length} ITENS</span>
        </div>

        {currentInvoiceItems.length === 0 ? (
          <div className="p-20 text-center opacity-50">
             <Search size={48} className="mx-auto text-slate-300 mb-2"/>
             <p className="text-slate-500 font-medium">Nenhum dado em {monthLabel}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead>
                <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50/50">
                  <th className="px-6 py-4 w-32">Data</th>
                  <th className="px-6 py-4">Descrição</th>
                  <th className="px-6 py-4 text-center w-32">Parcela</th>
                  <th className="px-6 py-4 text-right w-40">Valor</th>
                  <th className="px-6 py-4 text-center w-32">Origem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentInvoiceItems.map((t: any) => (
                  <tr key={t.id} className={`group hover:bg-slate-50 ${t.is_projected ? 'bg-amber-50/30' : t.category === 'Pagamento de Fatura' ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-4">
                       <span className="text-xs font-mono text-slate-500 font-medium">
                          {t.date ? new Date(t.date).toLocaleDateString('pt-BR') : '-'}
                       </span>
                    </td>
                    <td className="px-6 py-4">
                       <p className="text-sm font-semibold text-slate-700">{t.description.replace(/\(\d+\/\d+\)/, '').trim()}</p>
                       <p className="text-[10px] text-slate-400">{t.category}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                       {t.description.match(/\(\d+\/\d+\)/) ? (
                          <span className="text-xs font-mono font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-md">{t.description.match(/\(\d+\/\d+\)/)?.[0]}</span>
                       ) : <span className="text-slate-300">-</span>}
                    </td>
                    <td className={`px-6 py-4 text-right font-bold font-mono ${t.type === 'income' ? 'text-emerald-600' : 'text-slate-800'} ${t.category === 'Pagamento de Fatura' ? 'line-through text-slate-400' : ''}`}>
                       {t.type === 'income' ? '+' : ''}{formatCurrency(t.amount)}
                    </td>
                    <td className="px-6 py-4 text-center">
                       {t.is_projected ? (
                          <span className="text-[9px] bg-amber-100 text-amber-700 px-2 py-1 rounded font-bold uppercase tracking-wide">PROJEÇÃO</span>
                       ) : (
                          <span className="text-[9px] bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold uppercase tracking-wide">CARTÃO</span>
                       )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}