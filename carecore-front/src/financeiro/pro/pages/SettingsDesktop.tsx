import { useState, useRef, useEffect } from 'react';
import { useFinanceStore } from '../store/useFinanceStore';
import { useAuth } from '../contexts/AuthContext';
import { 
  Trash2, Plus, Database, RefreshCw, 
  Download, Upload, FileJson, AlertCircle, CheckCircle 
} from 'lucide-react';

export function SettingsDesktop() {
  const { user } = useAuth();
  
  const { 
    rules, addRule, removeRule, 
    transactions, accounts, investments, 
    fetchRules, fetchTransactions, fetchAccounts, fetchInvestments,
    addTransactions, addAccount, addInvestment,
    updateTransaction 
  } = useFinanceStore();

  const [newKeyword, setNewKeyword] = useState('');
  const [newCategory, setNewCategory] = useState('');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStats, setProcessStats] = useState<{updated: number, skipped: number} | null>(null);

  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Igual ao Mobile: Garante que os dados estejam carregados ao abrir a tela
  useEffect(() => {
    fetchRules();
    fetchTransactions();
    fetchAccounts();
    fetchInvestments();
  }, [fetchRules, fetchTransactions, fetchAccounts, fetchInvestments]);

  const handleAddRule = async () => {
    if (!newKeyword || !newCategory || !user) return;
    await addRule({ 
      keyword: newKeyword, 
      category: newCategory, 
      user_id: user.id 
    });
    setNewKeyword('');
    setNewCategory('');
  };

  const handleExport = () => {
    const backup = {
      version: "2.0", 
      date: new Date().toISOString(),
      user: user?.email,
      stats: {
        transactions: transactions.length,
        accounts: accounts.length,
        investments: investments.length,
        rules: rules.length
      },
      data: {
        transactions,
        accounts,
        investments,
        rules
      }
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance-pro-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!confirm('ATENÇÃO: Restaurar backup? Dados duplicados serão ignorados, mas recomendamos cuidado.')) {
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
    }

    setIsRestoring(true);
    const reader = new FileReader();
    
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result as string;
        const json = JSON.parse(text);

        // 1. Contas
        if (json.data?.accounts) {
           for (const acc of json.data.accounts) {
               const exists = accounts.find(a => a.name === acc.name);
               if (!exists) {
                   // eslint-disable-next-line @typescript-eslint/no-unused-vars
                   const { id, created_at, ...accData } = acc;
                   await addAccount({ ...accData, user_id: user.id });
               }
           }
        }

        // 2. Transações
        if (json.data?.transactions) {
           const existingSigs = new Set(transactions.map(t => `${t.date}-${t.amount}-${t.description}`));
           const newTrans = json.data.transactions
               .filter((t: any) => !existingSigs.has(`${t.date}-${t.amount}-${t.description}`))
               .map((t: any) => {
                   // eslint-disable-next-line @typescript-eslint/no-unused-vars
                   const { id, created_at, ...tData } = t;
                   return { ...tData, user_id: user.id };
               });
           
           if (newTrans.length > 0) await addTransactions(newTrans);
        }

        // 3. Investimentos
        if (json.data?.investments) {
            for (const inv of json.data.investments) {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { id, created_at, ...invData } = inv;
                await addInvestment({ ...invData, user_id: user.id });
            }
        }

        // 4. Regras
        if (json.data?.rules) {
            const existingKeywords = new Set(rules.map(r => r.keyword.toLowerCase()));
            for (const rule of json.data.rules) {
                if (!existingKeywords.has(rule.keyword.toLowerCase())) {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { id, created_at, ...ruleData } = rule;
                    await addRule({ ...ruleData, user_id: user.id });
                }
            }
        }

        alert('Backup restaurado com sucesso! A página será recarregada.');
        window.location.reload();

      } catch (error) {
        console.error(error);
        alert('Erro ao processar arquivo de backup.');
      } finally {
        setIsRestoring(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleApplyRulesToHistory = async () => {
    if (!confirm('Aplicar regras a TODO o histórico?\nIsso pode demorar um pouco.')) return;
    
    setIsProcessing(true);
    setProcessStats(null);

    try {
      let updatedCount = 0;
      let skippedCount = 0;

      const updates = transactions.map(t => {
        if (t.origin_file === 'SYSTEM_PROJECTION') {
            skippedCount++;
            return null;
        }
        
        const matchedRule = rules.find(r => 
            t.description.toLowerCase().includes(r.keyword.toLowerCase())
        );

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
      alert(`Processo concluído!\n${updatedCount} atualizados.`);
    } catch (error) {
      console.error(error);
      alert('Erro ao processar regras.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-20 animate-in fade-in duration-500">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Configurações</h1>
        <p className="text-slate-500">Gerencie regras, dados e backups</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* COLUNA 1: REGRAS (Igual ao Mobile: Cria e Lista as Regras/Categorias) */}
        <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Database size={24} /></div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Regras de Categorização</h3>
                        <p className="text-sm text-slate-500">Defina categorias automáticas</p>
                    </div>
                </div>

                <div className="flex gap-3 mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200 items-end">
                    <div className="flex-1">
                        <label className="text-xs font-bold text-slate-500 mb-1 block">Palavra-chave</label>
                        <input 
                            value={newKeyword} 
                            onChange={e => setNewKeyword(e.target.value)} 
                            placeholder="Ex: Uber..." 
                            className="w-full p-2 border rounded-lg outline-none focus:border-blue-500 bg-white"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="text-xs font-bold text-slate-500 mb-1 block">Categoria</label>
                        <input 
                            value={newCategory} 
                            onChange={e => setNewCategory(e.target.value)} 
                            placeholder="Ex: Transporte..." 
                            className="w-full p-2 border rounded-lg outline-none focus:border-blue-500 bg-white"
                        />
                    </div>
                    <button 
                        onClick={handleAddRule} 
                        disabled={!newKeyword || !newCategory}
                        className="bg-blue-600 text-white p-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                        <Plus size={20} />
                    </button>
                </div>

                {/* LISTA DE REGRAS/CATEGORIAS EXISTENTES (Igual ao Mobile) */}
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {rules.map(rule => (
                        <div key={rule.id} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-lg hover:shadow-sm transition-all group">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <span className="font-mono font-bold text-slate-600 text-xs bg-slate-100 px-2 py-1 rounded">"{rule.keyword}"</span>
                                <span className="text-slate-300">➜</span>
                                <span className="text-slate-700 text-sm font-medium truncate">{rule.category}</span>
                            </div>
                            <button onClick={() => removeRule(rule.id)} className="text-slate-300 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                    {rules.length === 0 && <p className="text-center text-slate-400 text-sm py-4">Nenhuma regra cadastrada.</p>}
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><RefreshCw size={24} /></div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Aplicar Regras</h3>
                        <p className="text-sm text-slate-500">Reprocessar histórico</p>
                    </div>
                </div>
                
                <button 
                    onClick={handleApplyRulesToHistory} 
                    disabled={isProcessing}
                    className="w-full bg-purple-50 text-purple-700 border border-purple-200 p-3 rounded-xl font-bold text-sm hover:bg-purple-100 transition-colors flex items-center justify-center gap-2"
                >
                    {isProcessing ? <RefreshCw size={16} className="animate-spin"/> : <CheckCircle size={16}/>}
                    {isProcessing ? 'Processando...' : 'Aplicar em Todo o Histórico'}
                </button>
                
                {processStats && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-100 rounded-lg text-center animate-in zoom-in">
                        <p className="text-green-700 font-bold text-sm">Sucesso! {processStats.updated} itens atualizados.</p>
                        <p className="text-green-600 text-xs">{processStats.skipped} ignorados (projeções).</p>
                    </div>
                )}
            </div>
        </div>

        {/* COLUNA 2: DADOS E BACKUP */}
        <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><Database size={24} /></div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Backup e Dados</h3>
                        <p className="text-sm text-slate-500">Segurança das suas informações</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="text-slate-400 mt-0.5" size={18}/>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                O backup gera um arquivo <strong>JSON</strong> contendo todas as suas transações, contas, investimentos e regras.
                                Guarde este arquivo em local seguro.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button 
                            onClick={handleExport}
                            className="flex flex-col items-center justify-center gap-2 p-6 bg-white border-2 border-slate-100 rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition-all group"
                        >
                            <div className="p-3 bg-blue-100 text-blue-600 rounded-full group-hover:scale-110 transition-transform">
                                <Download size={24} />
                            </div>
                            <span className="font-bold text-slate-700 group-hover:text-blue-700">Exportar JSON</span>
                        </button>

                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isRestoring}
                            className="flex flex-col items-center justify-center gap-2 p-6 bg-white border-2 border-slate-100 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50 transition-all group disabled:opacity-50"
                        >
                            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full group-hover:scale-110 transition-transform">
                                {isRestoring ? <RefreshCw className="animate-spin" size={24}/> : <Upload size={24} />}
                            </div>
                            <span className="font-bold text-slate-700 group-hover:text-emerald-700">
                                {isRestoring ? 'Restaurando...' : 'Restaurar Backup'}
                            </span>
                        </button>
                    </div>
                    
                    <input 
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={handleImport}
                    />
                </div>
            </div>

            <div className="bg-slate-900 rounded-xl shadow-lg p-6 text-white relative overflow-hidden">
                <FileJson className="absolute right-[-20px] bottom-[-20px] opacity-10" size={120} />
                <h3 className="font-bold text-lg mb-2">Formato do Arquivo</h3>
                <p className="text-slate-400 text-sm mb-4">
                    O arquivo JSON é compatível apenas com esta versão do Finance.Pro.
                    Não edite o arquivo manualmente para evitar corrupção de dados.
                </p>
                <div className="text-xs font-mono bg-black/30 p-3 rounded-lg text-slate-300">
                    version: "2.0"<br/>
                    data: &#123; transactions: [...], accounts: [...] &#125;
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}