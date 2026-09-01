import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Upload, CheckCircle, AlertCircle, ArrowUpDown, ArrowUp, ArrowDown, Trash2, CheckSquare } from 'lucide-react';
import type { Transaction } from '../types'; 
import { useFinanceStore } from '../store/useFinanceStore'; 
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/formatters';

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

const displayDate = (dateIso: string) => {
    if (!dateIso) return '-';
    try {
        const [year, month, day] = dateIso.split('T')[0].split('-');
        return `${day}/${month}/${year}`;
    } catch (e) { return dateIso; }
};

export function WhatsappPageDesktop() {
  // Adicionei addTransaction no destructuring
  const { transactions, addTransactions, addTransaction, removeTransaction, updateTransaction, fetchTransactions } = useFinanceStore();
  const { user } = useAuth();
  
  const whatsappTransactions = transactions.filter(t => t.origin_file === 'WHATSAPP_IMPORT');
  const [feedback, setFeedback] = useState<{type: 'success' | 'error' | 'info', msg: string} | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Transaction; direction: 'asc' | 'desc' } | null>({ key: 'date', direction: 'asc' });
  const [cutoffDate, setCutoffDate] = useState(new Date().toISOString().split('T')[0]);
  const [importCycleKey, setImportCycleKey] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  // --- NOVA LÓGICA DO BOTÃO FECHAR CICLO ---
  const handleCycleClose = async () => {
    // 1. Filtra itens elegíveis (Abertos + Não Projeção + Data Corte)
    const openTransactions = whatsappTransactions.filter(t => 
        !t.is_paid && 
        t.date <= cutoffDate && 
        !t.is_projected 
    );

    if (openTransactions.length === 0) {
        setFeedback({ type: 'info', msg: 'Nenhuma pendência real encontrada para conciliar.' });
        return;
    }

    // 2. Calcula Dívidas
    const getOwner = (t: Transaction) => {
        if (t.responsible) return t.responsible.toUpperCase();
        return t.category ? t.category.toUpperCase() : '';
    };

    const leoDebt = openTransactions
        .filter(t => { const o = getOwner(t); return o.includes('LEO') || o.includes('LÉO'); })
        .reduce((acc, t) => acc + t.amount, 0);

    const claudioDebt = openTransactions
        .filter(t => { const o = getOwner(t); return o.includes('CLAUDIO') || o.includes('CLÁUDIO'); })
        .reduce((acc, t) => acc + t.amount, 0);

    // Net Balance: Léo - Claudio
    // Se Positivo: Léo deve pagar (Income para o sistema/casa).
    // Se Negativo: Claudio deve pagar (Expense).
    const targetNetBalance = leoDebt - claudioDebt;
    const netAbs = Math.abs(targetNetBalance);
    const direction = targetNetBalance > 0 ? "Léo deve pagar" : "Claudio deve pagar";

    const msg = `
      CONFIRMAÇÃO DE FECHAMENTO
      -------------------------
      Itens no Ciclo: ${openTransactions.length}
      
      Dívida Léo: ${formatCurrency(leoDebt)}
      Dívida Claudio: ${formatCurrency(claudioDebt)}
      
      RESULTADO FINAL: ${direction} ${formatCurrency(netAbs)}
      
      Ao confirmar:
      1. Todos os ${openTransactions.length} itens serão marcados como PAGOS.
      2. Será criado um lançamento REAL de ${formatCurrency(netAbs)} no extrato.
      
      Deseja proceder?
    `;

    if (confirm(msg)) {
        setIsProcessing(true);
        try {
            // 3. Marca itens como pagos
            const updatePromises = openTransactions.map(t => updateTransaction({ ...t, is_paid: true }));
            await Promise.all(updatePromises);

            // 4. Cria Transação Real (Se houver saldo)
            if (netAbs > 0.01 && user) {
                await addTransaction({
                    user_id: user.id,
                    description: "Fechamento WhatsApp (Consolidado)",
                    amount: netAbs,
                    // Lógica: Se Leo deve (Net > 0), entra dinheiro na conta (Income). 
                    // Se Claudio deve (Net < 0), sai dinheiro da conta do Leo para pagar o Claudio? 
                    // Ou consideramos tudo do ponto de vista do "Caixa Único"?
                    // Mantendo a lógica do Payables: Net > 0 = Income.
                    type: targetNetBalance > 0 ? 'income' : 'expense',
                    category: "Acerto Mensal",
                    date: new Date().toISOString().split('T')[0],
                    is_paid: true, 
                    origin_file: "MANUAL_CLOSING"
                });
            }

            setFeedback({ type: 'success', msg: `Ciclo fechado! Lançamento de ${formatCurrency(netAbs)} criado.` });
            await fetchTransactions();
        } catch (error) {
            console.error(error);
            setFeedback({ type: 'error', msg: 'Erro ao fechar ciclo.' });
        } finally {
            setIsProcessing(false);
        }
    }
  };

  // --- LÓGICA ORIGINAL DE IMPORTAÇÃO (TXT) RESTAURADA ---
  const processFileContent = async (fileContent: string) => {
    if (!user) return;
    try {
      const futureProjections = transactions.filter(t => 
        t.origin_file === 'WHATSAPP_IMPORT' && t.is_projected === true && t.is_paid === false
      );
      
      if (futureProjections.length > 0) {
          await Promise.all(futureProjections.map(t => removeTransaction(t.id)));
      }

      const content = fileContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const lowerContent = content.toLowerCase();
      let splitIndex = -1;
      const variations = ["zerado nessa data", "zerado nesta data"];
      
      for (const v of variations) {
          const idx = lowerContent.lastIndexOf(v);
          if (idx > splitIndex) splitIndex = idx;
      }

      const processingContent = splitIndex !== -1 
          ? content.substring(content.indexOf('\n', splitIndex) + 1) 
          : content;

      const lines = processingContent.split('\n');
      let currentBatch: any[] = [];
      let lastValidDate: Date | null = null;
      
      const dateRegex = /\[?(\d{2})\/(\d{2})\/(\d{4})\]?/;
      const transRegex = /(L[ée]o|Cl[aá]udio|Claydio|Renato|Eu|Voc[êe])\s+deve\s+(?:(\d+)[xX]\s*)?(?:R\$)?\s*([\d\.,]+)\s*(.*)/i;

      lines.forEach((line) => {
        if (!line.trim()) return;

        const dateMatch = line.match(dateRegex);
        if (dateMatch) {
            lastValidDate = new Date(parseInt(dateMatch[3]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[1]));
        }

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

      const existingSignatures = new Set(transactions
          .filter(t => t.origin_file === 'WHATSAPP_IMPORT')
          .map(t => `${t.date}-${t.amount.toFixed(2)}-${t.description.trim().toLowerCase()}`));
      
      const uniqueItems = currentBatch.filter(t => {
          const sig = `${t.date}-${t.amount.toFixed(2)}-${t.description.trim().toLowerCase()}`;
          return !existingSignatures.has(sig);
      });

      if (uniqueItems.length > 0) {
          await addTransactions(uniqueItems);
          await fetchTransactions();
          setFeedback({ type: 'success', msg: `${uniqueItems.length} lançamentos importados!` });
      } else {
          setFeedback({ type: 'info', msg: 'Nenhum lançamento novo identificado.' });
      }

    } catch (error: any) {
        console.error(error);
        setFeedback({ type: 'error', msg: `Erro na importação: ${error.message}` });
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

  const handleBulkDelete = async () => {
      if(!confirm('Excluir TODOS os lançamentos do WhatsApp?')) return;
      const promises = whatsappTransactions.map(t => removeTransaction(t.id));
      await Promise.all(promises);
      await fetchTransactions();
      setFeedback({ type: 'success', msg: 'Histórico limpo.' });
  };

  const handleSort = (key: keyof Transaction) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig?.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const sortedTransactions = useMemo(() => {
    let items = [...whatsappTransactions];
    if (sortConfig) {
      items.sort((a, b) => {
        // @ts-ignore
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        // @ts-ignore
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return items;
  }, [whatsappTransactions, sortConfig]);

  const SortIcon = ({ column }: { column: keyof Transaction }) => {
    if (sortConfig?.key !== column) return <ArrowUpDown size={14} className="ml-1 text-slate-300 inline" />;
    return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="ml-1 text-blue-600 inline" /> : <ArrowDown size={14} className="ml-1 text-blue-600 inline" />;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">WhatsApp & Dívidas</h2>
          <p className="text-slate-500">Conciliação de gastos compartilhados</p>
        </div>
        <div className="flex gap-2">
           <button onClick={handleCycleClose} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-bold shadow-sm">
                <CheckSquare size={18} /> <span className="font-bold">Fechar Ciclo (Conciliar)</span>
            </button>
            <label className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg cursor-pointer flex items-center gap-2 transition-colors font-bold shadow-lg">
                <Upload size={18} /> Importar Chat
                <input type="file" accept=".txt" className="hidden" onChange={handleFileUpload} disabled={isProcessing} />
            </label>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
         <div className="flex-1">
            <label className="block text-xs font-bold text-slate-500 mb-1">Mês de Referência</label>
            <input type="month" value={importCycleKey} onChange={e => setImportCycleKey(e.target.value)} className="p-2 border rounded-lg text-sm font-bold text-slate-700"/>
         </div>
         <div className="flex-1">
            <label className="block text-xs font-bold text-slate-500 mb-1">Data de Corte</label>
            <input type="date" value={cutoffDate} onChange={e => setCutoffDate(e.target.value)} className="p-2 border rounded-lg text-sm font-bold text-slate-700"/>
         </div>
      </div>

      {feedback && (
        <div className={`p-4 rounded-lg flex items-center gap-2 ${feedback.type === 'success' ? 'bg-emerald-100 text-emerald-700' : feedback.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
            {feedback.type === 'success' ? <CheckCircle size={20}/> : <AlertCircle size={20}/>}
            <span className="font-medium">{feedback.msg}</span>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-slate-700">Histórico</h3>
            <div className="flex gap-4 items-center">
                 <span className="text-xs font-normal text-gray-500">{whatsappTransactions.length} itens</span>
                 {whatsappTransactions.length > 0 && <button onClick={handleBulkDelete} className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1"><Trash2 size={12} /> Limpar Tudo</button>}
            </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-medium select-none">
              <tr>
                <th className="p-4 cursor-pointer hover:text-blue-600" onClick={() => handleSort('date')}>Data <SortIcon column="date"/></th>
                <th className="p-4 cursor-pointer hover:text-blue-600" onClick={() => handleSort('responsible')}>Resp. <SortIcon column="responsible"/></th>
                <th className="p-4 cursor-pointer hover:text-blue-600" onClick={() => handleSort('category')}>Categoria <SortIcon column="category"/></th>
                <th className="p-4 cursor-pointer hover:text-blue-600" onClick={() => handleSort('description')}>Descrição <SortIcon column="description"/></th>
                <th className="p-4 cursor-pointer hover:text-blue-600" onClick={() => handleSort('amount')}>Valor <SortIcon column="amount"/></th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedTransactions.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400">Nenhum dado importado.</td></tr>
              ) : (
                sortedTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="p-4 font-mono text-xs text-slate-500">{displayDate(t.date)}</td>
                    <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${t.responsible === 'Léo' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                            {t.responsible || '???'}
                        </span>
                    </td>
                    <td className="p-4 text-xs font-medium text-slate-600">
                        {t.category}
                    </td>
                    <td className="p-4 font-medium text-slate-700">
                        {t.description}
                        {t.is_projected && <span className="ml-2 text-[10px] bg-yellow-100 text-yellow-700 px-1 rounded border border-yellow-200">Projeção</span>}
                    </td>
                    <td className="p-4 font-mono font-bold text-slate-700">{formatCurrency(t.amount)}</td>
                    <td className="p-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${t.is_paid ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                            {t.is_paid ? 'PAGO' : 'ABERTO'}
                        </span>
                    </td>
                    <td className="p-4 text-right">
                        <button onClick={() => removeTransaction(t.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-colors"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}