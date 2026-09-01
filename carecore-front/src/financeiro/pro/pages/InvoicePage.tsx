import { useState, useRef } from 'react';
import { 
  Upload, 
  CheckCircle, 
  AlertTriangle, // Corrigido
  XCircle,       // Corrigido
  FileText, 
  Save, 
  TrendingUp, 
  Search, 
  Copy 
} from 'lucide-react';
import { useFinanceStore } from '../store/useFinanceStore';
import { Button } from '../components/ui/Button';
import { formatCurrency } from '../utils/formatters';
import { parseInvoicePDF } from '../utils/parsers';
import type { Transaction } from '../types';

export function InvoicePage() {
  const { transactions, addTransactions } = useFinanceStore();
  
  const [inputText, setInputText] = useState('');
  const [previewData, setPreviewData] = useState<Transaction[]>([]);
  const [feedback, setFeedback] = useState<{type: 'success'|'error'|'warning', msg: string} | null>(null);
  const [isReadingPdf, setIsReadingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- MONITOR DE FATURAMENTO ---
  const billingStats = (() => {
      const currentYear = new Date().getFullYear();
      const limitMEI = 81000; 
      
      const invoices = transactions.filter(t => 
          (t.category === 'Nota Fiscal' || t.origin_file === 'INVOICE_IMPORT') && 
          t.type === 'income' &&
          t.date.startsWith(String(currentYear))
      );

      const total = invoices.reduce((acc, t) => acc + t.amount, 0);
      const percent = (total / limitMEI) * 100;

      return { total, percent, limit: limitMEI, count: invoices.length };
  })();

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      setIsReadingPdf(true);
      setFeedback(null);
      
      const newTransactions: Transaction[] = [];
      let duplicatesCount = 0;
      let errorCount = 0;

      const existingSignatures = new Set(
          transactions.map(t => `${t.date}|${t.amount.toFixed(2)}`)
      );

      for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const data = await parseInvoicePDF(file);

          if (data) {
              const signature = `${data.date}|${data.amount.toFixed(2)}`;
              const inPreview = previewData.some(t => `${t.date}|${t.amount.toFixed(2)}` === signature);

              if (existingSignatures.has(signature) || inPreview) {
                  duplicatesCount++;
                  continue;
              }

              const newT: any = {
                  date: data.date,
                  description: data.description, 
                  amount: data.amount,
                  type: 'income',
                  category: 'Nota Fiscal',
                  is_paid: true,     
                  conciliated: false, 
                  origin_file: 'INVOICE_IMPORT' 
              };

              newTransactions.push(newT);
          } else {
              errorCount++;
          }
      }

      setIsReadingPdf(false);
      
      if (newTransactions.length > 0) {
          setPreviewData(prev => [...prev, ...newTransactions]);
          let msg = `${newTransactions.length} notas lidas com sucesso.`;
          if (duplicatesCount > 0) msg += ` (${duplicatesCount} ignoradas pois já existem).`;
          setFeedback({ type: 'success', msg });
      } else if (duplicatesCount > 0) {
          setFeedback({ type: 'warning', msg: `Todas as ${duplicatesCount} notas já estão cadastradas!` });
      } else if (errorCount > 0) {
          setFeedback({ type: 'error', msg: 'Não foi possível ler os arquivos PDF.' });
      }
      
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveImport = async () => {
      if (previewData.length === 0) return;
      await addTransactions(previewData);
      setPreviewData([]);
      setFeedback({ type: 'success', msg: 'Importação concluída e salva na nuvem!' });
  };

  const handleParseText = () => {
      if (!inputText.trim()) return;
      const newTransactions: any[] = [];
      const lines = inputText.split('\n');
      
      lines.forEach(line => {
          const regex = /(\d{2}\/\d{2}\/\d{4}).*?[R$]\s?([\d.,]+)/;
          const match = line.match(regex);
          if (match) {
              const [d, m, y] = match[1].split('/');
              const amount = parseFloat(match[2].replace(/\./g, '').replace(',', '.'));
              if (amount > 0) {
                  newTransactions.push({
                      date: `${y}-${m}-${d}`,
                      description: `NFS-e (Texto Importado)`, 
                      amount: amount,
                      type: 'income',
                      category: 'Nota Fiscal',
                      is_paid: true,
                      origin_file: 'INVOICE_IMPORT',
                      conciliated: false
                  });
              }
          }
      });

      if (newTransactions.length > 0) {
          setPreviewData(prev => [...prev, ...newTransactions]);
          setFeedback(null);
          setInputText('');
      } else {
          setFeedback({ type: 'error', msg: 'Nenhum padrão reconhecido no texto.' });
      }
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
       <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <FileText className="text-blue-600" /> Notas Fiscais
          </h1>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
               <span className="text-xs font-bold text-slate-400 uppercase">Faturamento Anual</span>
               <div className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(billingStats.total)}</div>
               <div className="text-xs text-slate-500 mt-2">{billingStats.count} notas emitidas</div>
           </div>
           <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
               <span className="text-xs font-bold text-slate-400 uppercase">Limite MEI</span>
               <div className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(billingStats.limit)}</div>
               <div className="w-full bg-slate-100 h-2 rounded-full mt-2 overflow-hidden">
                   <div className={`h-full ${billingStats.percent > 80 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min(billingStats.percent, 100)}%` }} />
               </div>
               <div className="text-xs text-right mt-1 font-bold text-slate-400">{billingStats.percent.toFixed(1)}% usado</div>
           </div>
           <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex flex-col justify-center items-center text-center">
               <TrendingUp className="text-blue-500 mb-2" />
               <span className="text-sm font-bold text-blue-700">Fiscal OK</span>
           </div>
       </div>

       <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
           <div className="flex justify-between items-start mb-4">
               <div>
                   <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                       <Upload className="text-red-500" size={20} /> Importar PDFs (NFS-e)
                   </h3>
                   <p className="text-sm text-slate-500 mt-1">
                       Selecione vários arquivos. O sistema reconhece: Danki, Associação Evangélica e Grants.
                   </p>
               </div>
               <div className="text-right">
                    <input 
                        type="file" 
                        multiple 
                        accept=".pdf"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handlePdfUpload}
                    />
                    <Button 
                        onClick={() => fileInputRef.current?.click()} 
                        disabled={isReadingPdf}
                        className="bg-red-600 hover:bg-red-700 text-white"
                    >
                        {isReadingPdf ? 'Lendo...' : 'Selecionar Arquivos'}
                    </Button>
               </div>
           </div>

           {feedback && (
               <div className={`p-3 rounded-lg text-sm font-bold flex items-center gap-2 mb-4
                   ${feedback.type === 'success' ? 'bg-green-50 text-green-700' : 
                     feedback.type === 'warning' ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'}`}>
                   {feedback.type === 'success' && <CheckCircle size={16}/>}
                   {feedback.type === 'warning' && <AlertTriangle size={16}/>}
                   {feedback.type === 'error' && <XCircle size={16}/>}
                   {feedback.msg}
               </div>
           )}

           {previewData.length > 0 && (
               <div className="border rounded-lg overflow-hidden animate-in slide-in-from-top-4">
                   <div className="bg-slate-50 p-3 border-b flex justify-between items-center">
                       <span className="font-bold text-slate-700 text-sm">{previewData.length} notas prontas</span>
                       <Button onClick={handleSaveImport} variant="success" className="h-8 text-xs">
                           <Save size={14} className="mr-2" /> Salvar Tudo na Nuvem
                       </Button>
                   </div>
                   <div className="max-h-60 overflow-y-auto">
                       <table className="w-full text-left text-xs">
                           <thead className="bg-white text-slate-500 uppercase sticky top-0 shadow-sm">
                               <tr>
                                   <th className="p-3">Data</th>
                                   <th className="p-3">Descrição (Extraída)</th>
                                   <th className="p-3 text-right">Valor</th>
                                   <th className="p-3 w-10"></th>
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100 bg-white">
                               {previewData.map((t, i) => (
                                   <tr key={i} className="hover:bg-slate-50">
                                       <td className="p-3 font-mono text-slate-500">{t.date?.split('-').reverse().join('/')}</td>
                                       <td className="p-3 font-bold text-slate-700">
                                            {t.description}
                                            <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px]">
                                                {t.category}
                                            </span>
                                       </td>
                                       <td className="p-3 text-right font-bold text-emerald-600">{formatCurrency(t.amount || 0)}</td>
                                       <td className="p-3 text-center">
                                           <button onClick={() => setPreviewData(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600">
                                               <XCircle size={14} />
                                           </button>
                                       </td>
                                   </tr>
                               ))}
                           </tbody>
                       </table>
                   </div>
               </div>
           )}
       </div>

       <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm opacity-80 hover:opacity-100 transition-opacity">
           <h3 className="font-bold text-slate-500 mb-2 flex items-center gap-2 text-xs uppercase tracking-wider">
               <Copy size={14} /> Colar Texto Manualmente
           </h3>
           <div className="flex gap-2">
               <textarea 
                   className="flex-1 h-20 p-3 text-xs font-mono bg-slate-50 border rounded-lg outline-none focus:ring-2 focus:ring-blue-100"
                   placeholder="Cole aqui o texto da nota se o PDF falhar..."
                   value={inputText}
                   onChange={e => setInputText(e.target.value)}
               />
               <Button onClick={handleParseText} variant="ghost" className="self-end h-20 w-32 border-dashed border-2">
                   <Search size={16} className="mb-1 block mx-auto"/> Processar
               </Button>
           </div>
       </div>
    </div>
  );
}