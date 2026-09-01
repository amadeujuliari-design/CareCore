import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Upload, CheckCircle, AlertCircle, ArrowUp, ArrowDown, Trash2, CheckSquare } from 'lucide-react';
import type { Transaction } from '../types'; 
import { useFinanceStore } from '../store/useFinanceStore'; 
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, formatDateBR } from '../utils/formatters';

const parseNumber = (s: any): number => {
    if (!s) return 0;
    if (typeof s === 'number') return s;
    let c = s.toString().trim().replace(/[R$\s"US]/g, '');
    if (c.includes(',') && !c.includes('.')) return parseFloat(c.replace(',', '.'));
    if (c.includes('.') && c.includes(',')) {
        return c.indexOf('.') < c.indexOf(',') 
            ? parseFloat(c.replace(/\./g, '').replace(',', '.')) 
            : parseFloat(c.replace(/,/g, ''));
    }
    return parseFloat(c);
};

export function WhatsappPageMobile() {
  const { transactions, addTransactions, addTransaction, removeTransaction, updateTransaction, fetchTransactions } = useFinanceStore();
  const { user } = useAuth();
  
  const whatsappTransactions = transactions.filter(t => t.origin_file === 'WHATSAPP_IMPORT');
  const [feedback, setFeedback] = useState<{type: 'success' | 'error' | 'info', msg: string} | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cutoffDate, setCutoffDate] = useState(new Date().toISOString().split('T')[0]);
  const [importCycleKey, setImportCycleKey] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  // --- NOVA LÓGICA DE FECHAMENTO (MOBILE) ---
  const handleCycleClose = async () => {
    const openTransactions = whatsappTransactions.filter(t => 
        !t.is_paid && 
        t.date <= cutoffDate && 
        !t.is_projected 
    );

    if (openTransactions.length === 0) { alert('Sem pendências reais.'); return; }

    const getOwner = (t: Transaction) => {
        if (t.responsible) return t.responsible.toUpperCase();
        return t.category ? t.category.toUpperCase() : '';
    };

    const leoDebt = openTransactions.filter(t => getOwner(t).includes('LEO') || getOwner(t).includes('LÉO')).reduce((acc, t) => acc + t.amount, 0);
    const claudioDebt = openTransactions.filter(t => getOwner(t).includes('CLAUDIO') || getOwner(t).includes('CLÁUDIO')).reduce((acc, t) => acc + t.amount, 0);

    const targetNetBalance = leoDebt - claudioDebt;
    const netAbs = Math.abs(targetNetBalance);
    const direction = targetNetBalance > 0 ? "Léo deve" : "Claudio deve";

    const msg = `
      FECHAMENTO
      ----------
      Dívida Léo: ${formatCurrency(leoDebt)}
      Dívida Claudio: ${formatCurrency(claudioDebt)}
      
      FINAL: ${direction} ${formatCurrency(netAbs)}
      
      Confirmar baixa e criar lançamento?
    `;
    
    if (confirm(msg)) {
        setIsProcessing(true);
        try {
            await Promise.all(openTransactions.map(t => updateTransaction({ ...t, is_paid: true })));
            
            if (netAbs > 0.01 && user) {
                await addTransaction({
                    user_id: user.id,
                    description: "Fechamento WhatsApp (Consolidado)",
                    amount: netAbs,
                    type: targetNetBalance > 0 ? 'income' : 'expense',
                    category: "Acerto Mensal",
                    date: new Date().toISOString().split('T')[0],
                    is_paid: true, 
                    origin_file: "MANUAL_CLOSING"
                });
            }
            alert(`Ciclo fechado!`);
            await fetchTransactions();
        } catch (e) {
            alert('Erro ao fechar.');
        } finally {
            setIsProcessing(false);
        }
    }
  };

  const processFileContent = async (fileContent: string) => {
    if (!user) return;
    try {
      const futureProjections = transactions.filter(t => t.origin_file === 'WHATSAPP_IMPORT' && t.is_projected === true && t.is_paid === false);
      if (futureProjections.length > 0) await Promise.all(futureProjections.map(t => removeTransaction(t.id)));

      const content = fileContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const lowerContent = content.toLowerCase();
      let splitIndex = -1;
      const variations = ["zerado nessa data", "zerado nesta data"];
      for (const v of variations) {
          const idx = lowerContent.lastIndexOf(v);
          if (idx > splitIndex) splitIndex = idx;
      }
      const processingContent = splitIndex !== -1 ? content.substring(content.indexOf('\n', splitIndex) + 1) : content;

      const lines = processingContent.split('\n');
      let currentBatch: any[] = [];
      let lastValidDate: Date | null = null;
      
      const dateRegex = /\[?(\d{2})\/(\d{2})\/(\d{4})\]?/;
      const transRegex = /(L[ée]o|Cl[aá]udio|Claydio|Renato|Eu|Voc[êe])\s+deve\s+(?:(\d+)[xX]\s*)?(?:R\$)?\s*([\d\.,]+)\s*(.*)/i;

      lines.forEach((line) => {
        if (!line.trim()) return;
        const dateMatch = line.match(dateRegex);
        if (dateMatch) lastValidDate = new Date(parseInt(dateMatch[3]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[1]));

        if (lastValidDate && line.toLowerCase().includes('deve')) {
            const match = line.match(transRegex);
            if (match) {
                const rawName = match[1];
                const installmentsStr = match[2];
                const amount = parseNumber(match[3]);
                const desc = match[4].trim();
                
                let responsibleName = 'Desconhecido';
                if (/L[ée]o|Eu/i.test(rawName)) responsibleName = 'Léo';
                else if (/Cl[aá]udio|Claydio|Renato|Voc[êe]/i.test(rawName)) responsibleName = 'Claudio';

                const totalInstallments = installmentsStr ? parseInt(installmentsStr) : 1;
                const singleAmount = amount; 

                for (let i = 0; i < totalInstallments; i++) {
                    const installmentDate = new Date(lastValidDate);
                    installmentDate.setMonth(installmentDate.getMonth() + i);
                    const isProjected = i > 0;
                    currentBatch.push({
                        user_id: user.id,
                        description: desc + (totalInstallments > 1 ? ` (${i+1}/${totalInstallments})` : ''),
                        amount: singleAmount,
                        type: 'expense',
                        category: 'Outros',
                        responsible: responsibleName,
                        date: installmentDate.toISOString().split('T')[0],
                        is_paid: false,
                        origin_file: 'WHATSAPP_IMPORT',
                        is_projected: isProjected, 
                        whatsapp_cycle_key: `${installmentDate.getFullYear()}-${String(installmentDate.getMonth() + 1).padStart(2, '0')}`
                    });
                }
            }
        }
      });

      const existingSignatures = new Set(transactions.filter(t => t.origin_file === 'WHATSAPP_IMPORT').map(t => `${t.date}-${t.amount.toFixed(2)}-${t.description.trim().toLowerCase()}`));
      const uniqueItems = currentBatch.filter(t => !existingSignatures.has(`${t.date}-${t.amount.toFixed(2)}-${t.description.trim().toLowerCase()}`));

      if (uniqueItems.length > 0) {
          await addTransactions(uniqueItems);
          await fetchTransactions();
          setFeedback({ type: 'success', msg: `${uniqueItems.length} importados.` });
      } else {
          setFeedback({ type: 'info', msg: 'Sem novos dados.' });
      }

    } catch (error: any) {
        setFeedback({ type: 'error', msg: `Erro: ${error.message}` });
    } finally {
        setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (evt) => processFileContent(evt.target?.result as string);
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4 pb-24 px-1 animate-in fade-in">
       <div className="flex justify-between items-center pt-2">
         <div>
            <h2 className="text-xl font-bold text-slate-800">WhatsApp</h2>
            <p className="text-xs text-slate-500">Conciliação de Gastos</p>
         </div>
         <label className="bg-slate-900 text-white p-2 rounded-lg shadow-lg cursor-pointer">
             <Upload size={20} />
             <input type="file" accept=".txt" className="hidden" onChange={handleFileUpload} />
         </label>
       </div>

       <div className="flex gap-2">
          <input type="month" value={importCycleKey} onChange={e => setImportCycleKey(e.target.value)} className="p-2 border rounded-lg text-sm font-bold flex-1"/>
          <input type="date" value={cutoffDate} onChange={e => setCutoffDate(e.target.value)} className="p-2 border rounded-lg text-sm font-bold flex-1"/>
       </div>

       <button onClick={handleCycleClose} className="w-full bg-emerald-600 text-white p-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm">
           <CheckSquare size={18} /> Fechar Ciclo
       </button>

       {feedback && <p className={`text-xs p-2 rounded ${feedback.type === 'error' ? 'text-red-600 bg-red-50' : 'text-emerald-600 bg-emerald-50'}`}>{feedback.msg}</p>}

       <div className="space-y-2">
          {whatsappTransactions.length === 0 ? <p className="text-center text-gray-400 py-4">Vazio</p> :
           whatsappTransactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(t => (
             <div key={t.id} className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm flex justify-between items-start">
                 <div>
                    <p className="text-sm font-bold text-slate-700">{t.description}</p>
                    <p className="text-xs text-slate-400">{formatDateBR(t.date)} • {t.responsible}</p>
                 </div>
                 <div className="text-right">
                    <p className="font-mono font-bold text-slate-700">{formatCurrency(t.amount)}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${t.is_paid ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                        {t.is_paid ? 'PAGO' : 'ABERTO'}
                    </span>
                 </div>
             </div>
           ))
          }
       </div>
    </div>
  );
}