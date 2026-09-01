import { useState, useMemo, useRef, useEffect } from 'react';
import { 
  FileText, TrendingUp, Save, RefreshCw, Upload, 
  AlertTriangle, CheckCircle, XCircle, Paperclip 
} from 'lucide-react';
import { useFinanceStore } from '../store/useFinanceStore';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { formatCurrency } from '../utils/formatters';
import { localApi } from '../lib/localApi';
import type { Transaction } from '../types';

import * as pdfjsLib from 'pdfjs-dist';
// Configura o Worker do PDF.js (CDN do seu backup)
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

type PendingInvoice = Omit<Transaction, 'id' | 'created_at'>;

export function ServiceInvoicesDesktop() {
  const { transactions, addTransactions, updateTransaction, fetchTransactions } = useFinanceStore();
  const { user } = useAuth();
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [inputText, setInputText] = useState('');
  const [previewData, setPreviewData] = useState<PendingInvoice[]>([]);
  const [feedback, setFeedback] = useState<{type: 'success'|'error'|'warning', msg: string} | null>(null);
  const [isReadingPdf, setIsReadingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      fetchTransactions();
  }, [fetchTransactions]);

  // --- 1. MONITOR DE FATURAMENTO (MEI) ---
  const billingStats = useMemo(() => {
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
  }, [transactions]);

  // --- 2. LISTA DE HISTÓRICO (NOVO) ---
  const invoiceHistory = useMemo(() => {
    return transactions
      .filter(t => t.category === 'Nota Fiscal' || t.origin_file === 'INVOICE_IMPORT')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions]);

  // --- 3. INTELIGÊNCIA DE LEITURA ---
  const extractDataFromPdfText = (fullText: string) => {
      try {
          const cleanText = fullText.replace(/\s+/g, ' ');
          
          const numMatch = cleanText.match(/Número da NFS-e\s*(\d+)/i);
          if (!numMatch) return null;
          const nfNumber = numMatch[1];

          const dateMatch = cleanText.match(/Data e Hora da emissão.*?(\d{2}\/\d{2}\/\d{4})/i);
          let isoDate = '';
          if (dateMatch) {
              const [d, m, y] = dateMatch[1].split('/');
              isoDate = `${y}-${m}-${d}`;
          } else {
             return null;
          }

          // Formato antigo: "Valor do Serviço R$ ..."
          // DANFSe v2.0: "VALOR DA OPERAÇÃO / SERVIÇO R$ ..." ou "VALOR LÍQUIDO DA NFS-e R$ ..."
          const valMatch =
              cleanText.match(/Valor do Serviço\s*R\$\s*([\d.,]+)/i) ||
              cleanText.match(/Valor da Opera[cç][aã]o\s*\/\s*Servi[cç]o\s*R\$\s*([\d.,]+)/i) ||
              cleanText.match(/Valor L[ií]quido da NFS-e\s*R\$\s*([\d.,]+)/i);
          let amount = 0;
          if (valMatch) {
              amount = parseFloat(valMatch[1].replace(/\./g, '').replace(',', '.'));
          } else {
              return null;
          }

          let clientName = "Cliente Não Identificado";
          const upperText = cleanText.toUpperCase();
          
          const cnpjs: string[] = fullText.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g) || [];
          const clientCnpj = cnpjs.find(c => !c.includes("54.166.611")) || "";
          const cleanCnpj = clientCnpj.replace(/\D/g, '');

          if (cleanCnpj === '61705877000172' || upperText.includes("ASSOCIAÇÃO EVANGÉLICA") || upperText.includes("ASSOCIACAO EVANGELICA")) {
              clientName = "Associação Evangélica Beneficente";
          } 
          else if (upperText.includes("DANKI")) clientName = "Danki";
          else if (upperText.includes("GRANTS") || upperText.includes("CA GRANTS")) clientName = "CA Grants";
          else if (upperText.includes("VILA REENCONTRO") || upperText.includes("REENCONTRO")) clientName = "Vila Reencontro";
          else if (upperText.includes("RECOMEÇAR") || upperText.includes("RECOMECAR")) clientName = "Recomeçar";
          else if (clientCnpj) clientName = `CNPJ ${clientCnpj}`;

          return { number: nfNumber, date: isoDate, amount, client: clientName };
      } catch (e) {
          console.error("Erro fatal no parser", e);
          return null;
      }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      if (!user) return;

      setIsReadingPdf(true);
      setFeedback(null);
      const newTransactions: PendingInvoice[] = [];
      let duplicatesCount = 0;
      let repairedCount = 0;
      let uploadErrorsCount = 0;

      for (let i = 0; i < files.length; i++) {
          const file = files[i];
          try {
              const arrayBuffer = await file.arrayBuffer();
              const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
              let fullText = '';

              for (let j = 1; j <= pdf.numPages; j++) {
                  const page = await pdf.getPage(j);
                  const textContent = await page.getTextContent();
                  fullText += textContent.items.map((item: { str?: string }) => item.str || '').join(' ');
              }

              const data = extractDataFromPdfText(fullText);
              if (data) {
                  const existingInvoice = transactions.find(t => 
                      t.description.includes(`NFS-e ${data.number}`) && 
                      (t.category === 'Nota Fiscal' || t.origin_file === 'INVOICE_IMPORT')
                  );
                  const inPreview = [...previewData, ...newTransactions].some(t => t.description.includes(`NFS-e ${data.number}`));

                  if (inPreview) {
                      duplicatesCount++;
                      continue;
                  }

                  // --- UPLOAD DO ARQUIVO LOCAL ---
                  let publicPdfUrl = undefined;
                  try {
                      const uploaded = await localApi.uploadInvoice(file);
                      publicPdfUrl = uploaded.publicUrl;
                  } catch (upErr) {
                      console.error(upErr);
                      uploadErrorsCount++;
                      continue;
                  }

                  if (existingInvoice) {
                      await updateTransaction({ ...existingInvoice, invoice_url: publicPdfUrl });
                      repairedCount++;
                      continue;
                  }

                  newTransactions.push({
                      user_id: user.id,
                      date: data.date,
                      description: `NFS-e ${data.number} - ${data.client}`, 
                      amount: data.amount,
                      type: 'income',
                      category: 'Nota Fiscal',
                      is_paid: false, 
                      origin_file: 'INVOICE_IMPORT',
                      invoice_url: publicPdfUrl
                  });
              }
          } catch (error) { console.error(error); }
      }

      setIsReadingPdf(false);
      if (newTransactions.length > 0) {
          setPreviewData(prev => [...prev, ...newTransactions]);
          setFeedback({ type: 'success', msg: `${newTransactions.length} notas lidas. ${repairedCount} PDFs anexados. (${duplicatesCount} duplicadas).` });
      } else if (repairedCount > 0) {
          await fetchTransactions();
          setFeedback({ type: 'success', msg: `${repairedCount} PDFs anexados a notas já existentes.` });
      } else if (duplicatesCount > 0) {
          setFeedback({ type: 'warning', msg: `Todas as ${duplicatesCount} notas já estão cadastradas!` });
      } else if (uploadErrorsCount > 0) {
          setFeedback({ type: 'error', msg: 'Não foi possível salvar os PDFs no banco local.' });
      } else {
          setFeedback({ type: 'error', msg: 'Não foi possível ler os dados.' });
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveImport = async () => {
      if (previewData.length === 0) return;
      try {
          await addTransactions(previewData);
          setPreviewData([]);
          await fetchTransactions();
          setFeedback({ type: 'success', msg: 'Importação concluída com sucesso!' });
      } catch (error) {
          console.error(error);
          setFeedback({ type: 'error', msg: 'Não foi possível salvar no banco local. Verifique se a API está rodando.' });
      }
  };

  // --- AUTO-CONCILIAÇÃO ---
  const handleAutoReconcile = async () => {
      const openInvoices = transactions
        .filter(t => (t.category === 'Nota Fiscal' || t.origin_file === 'INVOICE_IMPORT') && !t.is_paid)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      if (openInvoices.length === 0) { alert('Não há notas fiscais em aberto.'); return; }

      const availableBankTransactions = [...transactions]
        .filter(t => {
            const isBankEntry = t.type === 'income' && 
                ((t.origin_file || '').toLowerCase().includes('extrato') ||
                 (t.origin_file || '').toLowerCase().endsWith('.ofx') ||
                 (t.origin_file || '').toLowerCase().endsWith('.csv'));
            return isBankEntry;
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      let matchCount = 0;
      const TOLERANCE_DAYS = 5;

      for (const invoice of openInvoices) {
          const invoiceDate = new Date(invoice.date);
          const matchIndex = availableBankTransactions.findIndex(t => {
              const isValueMatch = Math.abs(t.amount - invoice.amount) < 0.05;
              const tDate = new Date(t.date);
              const diffDays = Math.ceil(Math.abs(tDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24)); 
              return isValueMatch && diffDays <= TOLERANCE_DAYS;
          });

          if (matchIndex !== -1) {
              await updateTransaction({ ...invoice, is_paid: true });
              availableBankTransactions.splice(matchIndex, 1);
              matchCount++;
          }
      }
      
      if (matchCount > 0) alert(`Sucesso! ${matchCount} notas conciliadas automaticamente.`);
      else alert("Nenhuma correspondência encontrada (Extrato vs Nota).");
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
       <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <FileText className="text-blue-600" /> Notas Fiscais
          </h1>
          <Button onClick={handleAutoReconcile} variant="outline" className="text-xs border-blue-200 text-blue-700 hover:bg-blue-50">
              <RefreshCw size={14} className="mr-2" /> Auto-Conciliar Inteligente
          </Button>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           {/* Cards de Métricas (Mantidos) */}
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
               <span className="text-sm font-bold text-blue-700">Monitoramento Fiscal</span>
           </div>
       </div>

       <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
           <div className="flex justify-between items-start mb-4">
               <div>
                   <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                       <Upload className="text-red-500" size={20} /> Importar PDFs (NFS-e)
                   </h3>
                   <p className="text-sm text-slate-500 mt-1">
                       Selecione vários arquivos. O PDF será salvo automaticamente.
                   </p>
               </div>
               <div className="text-right">
                    <input type="file" multiple accept=".pdf" ref={fileInputRef} className="hidden" onChange={handlePdfUpload} />
                    <Button onClick={() => fileInputRef.current?.click()} disabled={isReadingPdf} className="bg-red-600 hover:bg-red-700 text-white">
                        {isReadingPdf ? 'Processando...' : 'Selecionar Arquivos'}
                    </Button>
               </div>
           </div>

           {feedback && (
               <div className={`p-3 rounded-lg text-sm font-bold flex items-center gap-2 mb-4 ${feedback.type === 'success' ? 'bg-green-50 text-green-700' : feedback.type === 'warning' ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'}`}>
                   {feedback.type === 'success' ? <CheckCircle size={16}/> : <AlertTriangle size={16}/>}
                   {feedback.msg}
               </div>
           )}

           {previewData.length > 0 && (
               <div className="border rounded-lg overflow-hidden animate-in slide-in-from-top-4 mb-8">
                   <div className="bg-slate-50 p-3 border-b flex justify-between items-center">
                       <span className="font-bold text-slate-700 text-sm">{previewData.length} notas prontas</span>
                       <Button onClick={handleSaveImport} variant="success" className="h-8 text-xs">
                           <Save size={14} className="mr-2" /> Salvar Tudo
                       </Button>
                   </div>
                   <div className="max-h-60 overflow-y-auto">
                       <table className="w-full text-left text-xs">
                           <thead className="bg-white text-slate-500 uppercase sticky top-0 shadow-sm">
                               <tr>
                                   <th className="p-3">Data</th>
                                   <th className="p-3">Descrição</th>
                                   <th className="p-3 text-right">Valor</th>
                                   <th className="p-3 text-center">PDF</th>
                                   <th className="p-3 w-10"></th>
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100 bg-white">
                               {previewData.map((t, i) => (
                                   <tr key={i} className="hover:bg-slate-50">
                                       <td className="p-3 font-mono text-slate-500">{t.date?.split('-').reverse().join('/')}</td>
                                       <td className="p-3 font-bold text-slate-700">{t.description}</td>
                                       <td className="p-3 text-right font-bold text-emerald-600">{formatCurrency(t.amount || 0)}</td>
                                       <td className="p-3 text-center">
                                            {t.invoice_url ? (
                                                <Paperclip size={14} className="text-blue-500 inline" />
                                            ) : '-'}
                                       </td>
                                       <td className="p-3 text-center"><button onClick={() => setPreviewData(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600"><XCircle size={14} /></button></td>
                                   </tr>
                               ))}
                           </tbody>
                       </table>
                   </div>
               </div>
           )}

           {/* --- TABELA DE HISTÓRICO (ADICIONADA AQUI) --- */}
           <div className="border-t border-slate-100 pt-6">
               <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                   <FileText size={18} className="text-slate-400"/> Histórico de Notas Emitidas
               </h3>
               <div className="overflow-x-auto">
                   <table className="w-full text-left text-xs">
                       <thead className="text-slate-500 border-b border-slate-100">
                           <tr>
                               <th className="p-3">Data</th>
                               <th className="p-3">Descrição</th>
                               <th className="p-3 text-right">Valor</th>
                               <th className="p-3 text-center">PDF</th>
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                           {invoiceHistory.length === 0 ? (
                               <tr><td colSpan={4} className="p-4 text-center text-slate-400 italic">Nenhuma nota registrada.</td></tr>
                           ) : (
                               invoiceHistory.map(t => (
                                   <tr key={t.id} className="hover:bg-slate-50">
                                       <td className="p-3 font-mono text-slate-600">{t.date?.split('-').reverse().join('/')}</td>
                                       <td className="p-3 text-slate-700">{t.description}</td>
                                       <td className="p-3 text-right font-bold text-slate-700">{formatCurrency(t.amount)}</td>
                                       <td className="p-3 text-center">
                                           {t.invoice_url ? (
                                               <a 
                                                 href={t.invoice_url} 
                                                 target="_blank" 
                                                 rel="noopener noreferrer"
                                                 className="inline-flex p-1 text-blue-600 hover:bg-blue-50 rounded"
                                                 title="Abrir PDF"
                                               >
                                                   <Paperclip size={16} />
                                               </a>
                                           ) : (
                                               <span className="text-slate-300">-</span>
                                           )}
                                       </td>
                                   </tr>
                               ))
                           )}
                       </tbody>
                   </table>
               </div>
           </div>
       </div>
    </div>
  );
}