import React, { useState, useEffect, useRef } from 'react';
import { 
  Trash2, Plus, Database, RefreshCw, 
  Download, Upload, FileJson, CheckCircle, Type 
} from 'lucide-react';
import { useFinanceStore } from '../store/useFinanceStore';
import { useAuth } from '../contexts/AuthContext';

export function SettingsMobile() {
  const { user } = useAuth();
  
  const { 
    rules, addRule, removeRule, transactions, 
    accounts, investments, updateTransaction, 
    fetchRules, fetchTransactions, fetchAccounts, fetchInvestments,
    addAccount, addTransactions, addInvestment,
    appSettings, setAppSettings // Pegando configurações da store
  } = useFinanceStore();

  const [newKeyword, setNewKeyword] = useState('');
  const [newCategory, setNewCategory] = useState('');
  
  // Agora com 3 abas: rules, data, display
  const [activeTab, setActiveTab] = useState<'rules' | 'data' | 'display'>('rules');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStats, setProcessStats] = useState<{updated: number, skipped: number} | null>(null);
  
  // Backup logic
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchRules();
    fetchTransactions();
    // Pre-fetch para o backup ter dados atualizados
    fetchAccounts();
    fetchInvestments();
  }, [fetchRules, fetchTransactions, fetchAccounts, fetchInvestments]);

  const handleAddRule = async () => {
    if (!newKeyword || !newCategory || !user) return;
    await addRule({ keyword: newKeyword, category: newCategory, user_id: user.id });
    setNewKeyword('');
    setNewCategory('');
  };

  const handleApplyRulesToHistory = async () => {
    if (!confirm('Aplicar regras a TODO o histórico?')) return;
    setIsProcessing(true);
    setProcessStats(null);
    try {
      let updatedCount = 0; let skippedCount = 0;
      const updates = transactions.map(t => {
        if (t.origin_file === 'SYSTEM_PROJECTION') { skippedCount++; return null; }
        const matchedRule = rules.find(r => t.description.toLowerCase().includes(r.keyword.toLowerCase()));
        if (matchedRule && t.category !== matchedRule.category) {
            updatedCount++;
            return { ...t, category: matchedRule.category };
        }
        return null;
      }).filter(Boolean);

      if (updates.length > 0) {
          // @ts-ignore
          await Promise.all(updates.map(t => t && updateTransaction(t)));
          await fetchTransactions();
      }
      setProcessStats({ updated: updatedCount, skipped: skippedCount });
      alert('Regras aplicadas com sucesso!');
    } catch (error) { alert('Erro ao processar.'); } 
    finally { setIsProcessing(false); }
  };

  const handleExport = () => {
    const backup = {
      version: "2.0", date: new Date().toISOString(),
      stats: { t: transactions.length, a: accounts.length },
      data: { transactions, accounts, investments, rules }
    };
    const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `backup-mobile-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !user) return;
      if (!confirm('Restaurar backup?')) return;
      setIsRestoring(true);
      const reader = new FileReader();
      reader.onload = async (ev) => {
          try {
              const json = JSON.parse(ev.target?.result as string);
              if (json.data?.accounts) {
                  for (const acc of json.data.accounts) {
                      if (!accounts.find(a => a.name === acc.name)) {
                          // eslint-disable-next-line @typescript-eslint/no-unused-vars
                          const { id, ...d } = acc; await addAccount({ ...d, user_id: user.id });
                      }
                  }
              }
              if (json.data?.transactions) {
                  const existing = new Set(transactions.map(t => `${t.date}-${t.amount}`));
                  const newT = json.data.transactions.filter((t: any) => !existing.has(`${t.date}-${t.amount}`)).map((t: any) => {
                      // eslint-disable-next-line @typescript-eslint/no-unused-vars
                      const { id, ...d } = t; return { ...d, user_id: user.id };
                  });
                  if (newT.length) await addTransactions(newT);
              }
              if (json.data?.rules) {
                  const existingK = new Set(rules.map(r => r.keyword));
                  for (const r of json.data.rules) {
                      if (!existingK.has(r.keyword)) {
                          // eslint-disable-next-line @typescript-eslint/no-unused-vars
                          const { id, ...d } = r; await addRule({ ...d, user_id: user.id });
                      }
                  }
              }
              alert('Backup restaurado!'); window.location.reload();
          } catch (e) { alert('Erro no arquivo.'); } finally { setIsRestoring(false); }
      };
      reader.readAsText(file);
  };

  return (
    <div className="space-y-4 animate-in fade-in pb-24">
      <h2 className="text-xl font-bold text-slate-800 px-1">Configurações</h2>
      
      {/* ABAS */}
      <div className="flex p-1 bg-slate-100 rounded-xl mx-1">
        <button onClick={() => setActiveTab('rules')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'rules' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}>Regras</button>
        <button onClick={() => setActiveTab('data')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'data' ? 'bg-white shadow text-emerald-600' : 'text-slate-400'}`}>Dados</button>
        <button onClick={() => setActiveTab('display')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'display' ? 'bg-white shadow text-purple-600' : 'text-slate-400'}`}>Visual</button>
      </div>

      {/* ABA: REGRAS */}
      {activeTab === 'rules' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm mx-1">
                <div className="flex flex-col gap-2 mb-4">
                    <input placeholder="Palavra-chave (Ex: Uber)" className="p-3 bg-slate-50 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" value={newKeyword} onChange={e => setNewKeyword(e.target.value)} />
                    <div className="flex gap-2">
                        <input placeholder="Categoria" className="flex-1 p-3 bg-slate-50 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" value={newCategory} onChange={e => setNewCategory(e.target.value)} />
                        <button onClick={handleAddRule} className="bg-blue-600 text-white p-3 rounded-lg"><Plus size={20}/></button>
                    </div>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {rules.map(rule => (
                        <div key={rule.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <span className="font-mono font-bold text-slate-600">"{rule.keyword}"</span>
                                <span className="text-slate-400">➜</span>
                                <span className="text-slate-700 truncate">{rule.category}</span>
                            </div>
                            <button onClick={() => removeRule(rule.id)} className="text-slate-300 hover:text-red-500 p-2"><Trash2 size={14} /></button>
                        </div>
                    ))}
                </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mx-1">
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 bg-purple-100 text-purple-600 rounded-lg"><RefreshCw size={18} /></div>
                    <h3 className="font-bold text-slate-700 text-sm">Reprocessar Histórico</h3>
                </div>
                <button onClick={handleApplyRulesToHistory} disabled={isProcessing} className="w-full bg-purple-600 text-white p-3 rounded-xl font-bold text-sm shadow-lg shadow-purple-900/10">
                    {isProcessing ? 'Processando...' : 'Aplicar Regras'}
                </button>
                {processStats && <div className="mt-3 text-center text-xs text-purple-600 font-bold bg-purple-50 p-2 rounded-lg animate-in zoom-in">{processStats.updated} atualizados</div>}
            </div>
          </div>
      )}

      {/* ABA: DADOS (Backup) */}
      {activeTab === 'data' && (
          <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm mx-1 space-y-4">
              <div className="text-center mb-4">
                  <div className="bg-emerald-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2"><Database className="text-emerald-600" size={24} /></div>
                  <h3 className="font-bold text-slate-800">Backup e Restauração</h3>
                  <p className="text-xs text-slate-500">Salve seus dados localmente</p>
              </div>
              <button onClick={handleExport} className="w-full py-3 bg-emerald-50 text-emerald-700 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border border-emerald-100"><Download size={18}/> Exportar Dados</button>
              <div className="relative"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-300">Ou</span></div></div>
              <button onClick={() => fileInputRef.current?.click()} className="w-full py-3 bg-blue-50 text-blue-600 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border border-blue-100"><Upload size={18}/> {isRestoring ? 'Restaurando...' : 'Restaurar Backup'}</button>
              <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          </div>
      )}

      {/* ABA: VISUAL (Fonte) - RECUPERADA */}
      {activeTab === 'display' && (
         <div className="space-y-4 mx-1">
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
               <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Type size={18} /> Tamanho da Fonte</h3>
               <div className="flex gap-2">
                  <button 
                    onClick={() => setAppSettings({ fontSize: 'small' })} 
                    className={`flex-1 py-3 rounded-lg text-xs font-bold transition-all border ${appSettings.fontSize === 'small' ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-slate-500 border-slate-200'}`}
                  >
                    Pequeno
                  </button>
                  <button 
                    onClick={() => setAppSettings({ fontSize: 'medium' })} 
                    className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all border ${appSettings.fontSize === 'medium' ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-slate-500 border-slate-200'}`}
                  >
                    Médio
                  </button>
                  <button 
                    onClick={() => setAppSettings({ fontSize: 'large' })} 
                    className={`flex-1 py-3 rounded-lg text-base font-bold transition-all border ${appSettings.fontSize === 'large' ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-slate-500 border-slate-200'}`}
                  >
                    Grande
                  </button>
               </div>
               <p className="text-[10px] text-slate-400 mt-3 text-center">Ajusta o tamanho de todo o aplicativo.</p>
            </div>
         </div>
      )}
    </div>
  );
}