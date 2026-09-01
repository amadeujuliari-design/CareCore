import { useState, useMemo, useRef, useEffect } from 'react';
import { 
  FileText, RefreshCw, Upload, Loader2, Paperclip 
} from 'lucide-react';
import { useFinanceStore } from '../store/useFinanceStore';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/formatters';
import { localApi } from '../lib/localApi';
import type { Transaction } from '../types';

import * as pdfjsLib from 'pdfjs-dist';
// Configura o Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export function ServiceInvoicesMobile() {
  const { transactions, updateTransaction, addTransactions, fetchTransactions } = useFinanceStore();
  const { user } = useAuth();
  
  const [isReadingPdf, setIsReadingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      fetchTransactions();
  }, [fetchTransactions]);

  // --- ESTATÍSTICAS MEI ---
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
      return { total, percent, limit: limitMEI };
  }, [transactions]);

  // --- LEITURA DE PDF ---
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
          console.error("Erro parser:", e);
          return null;
      }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      if (!user) return;

      setIsReadingPdf(true);
      const newTransactions: Omit<Transaction, 'id' | 'created_at'>[] = [];
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
                  fullText += textContent.items.map((item: { str?: string }) => item.str || '').join(' ') + ' ';
              }

              const data = extractDataFromPdfText(fullText);
              if (data) {
                  const existingInvoice = transactions.find(t => 
                      t.description.includes(`NFS-e ${data.number}`) && 
                      (t.category === 'Nota Fiscal' || t.origin_file === 'INVOICE_IMPORT')
                  );

                  // --- UPLOAD LOCAL ---
                  let publicPdfUrl = undefined;
                  try {
                      const uploaded = await localApi.uploadInvoice(file);
                      publicPdfUrl = uploaded.publicUrl;
                  } catch (e) {
                      console.error("Erro upload", e);
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
          try {
              await addTransactions(newTransactions);
              await fetchTransactions();
              alert(`${newTransactions.length} notas importadas com sucesso! ${repairedCount} PDFs anexados.`);
          } catch (error) {
              console.error(error);
              alert('Não foi possível salvar no banco local. Verifique se a API está rodando.');
          }
      } else if (repairedCount > 0) {
          await fetchTransactions();
          alert(`${repairedCount} PDFs anexados a notas já existentes.`);
      } else if (uploadErrorsCount > 0) {
          alert('Não foi possível salvar os PDFs no banco local.');
      } else {
          alert('Não foi possível ler os arquivos PDF.');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- AUTO CONCILIAÇÃO ---
  const handleAutoReconcile = async () => {
      if(!confirm("Tentar cruzar Notas Fiscais com Extrato Bancário?")) return;

      const openInvoices = transactions
        .filter(t => (t.category === 'Nota Fiscal' || t.origin_file === 'INVOICE_IMPORT') && !t.is_paid)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      if (openInvoices.length === 0) { alert('Tudo em dia! Sem notas abertas.'); return; }

      const availableBankTransactions = [...transactions]
        .filter(t => t.type === 'income' && ['extrato', '.ofx', '.csv'].some(k => (t.origin_file||'').toLowerCase().includes(k)))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      let matchCount = 0;
      for (const invoice of openInvoices) {
          const matchIndex = availableBankTransactions.findIndex(t => {
              const isValueMatch = Math.abs(t.amount - invoice.amount) < 0.05;
              const tDate = new Date(t.date);
              const iDate = new Date(invoice.date);
              const diffDays = Math.ceil(Math.abs(tDate.getTime() - iDate.getTime()) / (1000 * 60 * 60 * 24)); 
              return isValueMatch && diffDays <= 5;
          });

          if (matchIndex !== -1) {
              await updateTransaction({ ...invoice, is_paid: true });
              availableBankTransactions.splice(matchIndex, 1);
              matchCount++;
          }
      }
      alert(matchCount > 0 ? `${matchCount} notas conciliadas!` : "Nenhuma correspondência encontrada.");
  };

  // --- LISTAGEM DE NOTAS (SEM LIMITES E ORDEM CORRETA) ---
  const invoices = transactions
      .filter(t => t.category === 'Nota Fiscal' || t.origin_file === 'INVOICE_IMPORT')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-24">
       
       <div className="flex justify-between items-center px-1">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">Notas Fiscais</h2>
          <div className="flex gap-2">
              <input type="file" multiple accept=".pdf" ref={fileInputRef} className="hidden" onChange={handlePdfUpload} />
              <button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isReadingPdf}
                className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 active:scale-95 transition-transform"
              >
                  {isReadingPdf ? <Loader2 size={14} className="animate-spin"/> : <Upload size={14}/>} Importar
              </button>
              <button onClick={handleAutoReconcile} className="bg-slate-100 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 active:scale-95 transition-transform">
                  <RefreshCw size={14}/> Conciliar
              </button>
          </div>
       </div>

       {/* CARD MEI */}
       <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mx-1">
           <div className="flex justify-between items-end mb-2">
               <div>
                   <p className="text-[10px] font-bold text-slate-400 uppercase">Faturamento Anual</p>
                   <p className="text-2xl font-bold text-slate-800">{formatCurrency(billingStats.total)}</p>
               </div>
               <div className="text-right">
                   <p className="text-[10px] font-bold text-slate-400 uppercase">Limite Usado</p>
                   <p className={`text-lg font-bold ${billingStats.percent > 80 ? 'text-red-500' : 'text-emerald-500'}`}>{billingStats.percent.toFixed(1)}%</p>
               </div>
           </div>
           <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className={`h-full ${billingStats.percent > 80 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(billingStats.percent, 100)}%` }} />
           </div>
       </div>

       {/* LISTA DE NOTAS */}
       <div className="space-y-3 px-1">
           <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Histórico Completo ({invoices.length})</h3>
           {invoices.length === 0 ? (
               <div className="text-center py-8 text-slate-400 italic text-sm">Nenhuma nota emitida.</div>
           ) : (
               invoices.map(t => (
                   <div key={t.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
                       <div className="flex items-center gap-3">
                           <div className="bg-slate-50 p-2 rounded-lg text-slate-500">
                               <FileText size={18}/>
                           </div>
                           <div className="min-w-0 max-w-[160px]">
                               <p className="text-xs font-bold text-slate-700 truncate">{t.description}</p>
                               {/* CORREÇÃO AQUI: Formatação de string pura para evitar fuso horário */}
                               <p className="text-[10px] text-slate-400 font-mono">
                                   {t.date?.split('-').reverse().join('/')}
                               </p>
                           </div>
                       </div>
                       <div className="text-right">
                           <p className="text-sm font-bold text-emerald-600">{formatCurrency(t.amount)}</p>
                           <div className="flex items-center justify-end gap-2 mt-1">
                               
                               {t.invoice_url && (
                                   <a 
                                     href={t.invoice_url} 
                                     target="_blank" 
                                     rel="noopener noreferrer" 
                                     className="text-blue-600 bg-blue-50 p-1 rounded hover:bg-blue-100"
                                     title="Ver PDF"
                                   >
                                       <Paperclip size={14} />
                                   </a>
                               )}

                               <p className={`text-[9px] font-bold ${t.is_paid ? 'text-blue-500' : 'text-orange-400'}`}>
                                   {t.is_paid ? 'CONCILIADO' : 'PENDENTE'}
                               </p>
                           </div>
                       </div>
                   </div>
               ))
           )}
       </div>
    </div>
  );
}