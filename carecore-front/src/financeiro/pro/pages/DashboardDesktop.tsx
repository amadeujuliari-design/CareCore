import { useMemo, useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, Wallet, 
  Calendar, ArrowUp, ArrowDown, ChevronLeft, ChevronRight,
  PieChart as PieIcon, Activity, Filter
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { useFinanceStore } from '../store/useFinanceStore';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/formatters';

const COLORS = [
  '#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1',
  '#14B8A6', '#84CC16', '#06B6D4', '#D946EF', '#F97316', '#64748B', '#A855F7'
];

function calculateCompoundInterest(principal: number, monthlyRate: number, startDateIso: string) {
  if (!startDateIso) return { currentValue: principal, yieldValue: 0 };
  const [y, m, d] = startDateIso.split('T')[0].split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const now = new Date();
  const timeDiff = now.getTime() - start.getTime();
  const days = Math.max(0, Math.floor(timeDiff / (1000 * 60 * 60 * 24)));
  const dailyRate = Math.pow(1 + (monthlyRate / 100), 1/30) - 1;
  const amount = principal * Math.pow(1 + dailyRate, days);
  return { currentValue: amount, yieldValue: amount - principal };
}

export function DashboardDesktop() {
  const { user } = useAuth();
  const { 
    transactions, accounts, investments, 
    fetchTransactions, fetchAccounts, fetchInvestments 
  } = useFinanceStore();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [usdRate, setUsdRate] = useState(6.0);
  const [hiddenCategories, setHiddenCategories] = useState<string[]>([]);
  
  // NOVO ESTADO: Controla se o gráfico mostra Despesas ou Receitas
  const [chartType, setChartType] = useState<'expense' | 'income'>('expense');

  useEffect(() => {
    fetchTransactions();
    fetchAccounts();
    fetchInvestments();
    fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL')
      .then(r => r.json()).then(d => setUsdRate(parseFloat(d.USDBRL.bid))).catch(console.error);
  }, [fetchTransactions, fetchAccounts, fetchInvestments]);

  const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

  const accountsBalance = useMemo(() => accounts.reduce((acc, account) => acc + (account.balance || 0), 0), [accounts]);

  const investmentsBalance = useMemo(() => {
    return investments.reduce((acc, inv) => {
        const { currentValue, yieldValue } = calculateCompoundInterest(inv.amount, inv.rate, inv.start_date);
        const tax = yieldValue > 0 ? yieldValue * ((inv.ir || 0) / 100) : 0;
        const netValue = currentValue - tax;
        const multiplier = inv.currency === 'USD' ? usdRate : 1.0;
        return acc + (netValue * multiplier);
    }, 0);
  }, [investments, usdRate]);

  const monthlyTransactions = useMemo(() => {
    return transactions.filter(t => t.date.startsWith(currentMonthKey));
  }, [transactions, currentMonthKey]);

  const monthlyTotals = useMemo(() => {
    return monthlyTransactions.reduce((acc, t) => {
      if (t.type === 'income') acc.income += t.amount;
      else acc.expense += t.amount;
      return acc;
    }, { income: 0, expense: 0 });
  }, [monthlyTransactions]);

  const chartData = useMemo(() => {
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const data = [];
    for (let i = 1; i <= daysInMonth; i++) {
        const dayStr = `${currentMonthKey}-${String(i).padStart(2, '0')}`;
        const dayTrans = monthlyTransactions.filter(t => t.date === dayStr);
        const dayIncome = dayTrans.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const dayExpense = dayTrans.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        data.push({ name: String(i), receita: dayIncome, despesa: dayExpense });
    }
    return data;
  }, [monthlyTransactions, currentMonthKey]);

  // CORREÇÃO: Gráfico agora respeita o 'chartType' (Receita ou Despesa)
  const categoryData = useMemo(() => {
    // Filtra pelo tipo selecionado no botão
    const filtered = monthlyTransactions.filter(t => t.type === chartType);
    const groups: Record<string, number> = {};
    
    filtered.forEach(t => {
        const cat = t.category || 'Outros';
        groups[cat] = (groups[cat] || 0) + t.amount;
    });

    return Object.entries(groups)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
  }, [monthlyTransactions, chartType]); // Dependência adicionada: chartType

  const visibleCategoryData = useMemo(() => {
    return categoryData.filter(item => !hiddenCategories.includes(item.name));
  }, [categoryData, hiddenCategories]);

  const toggleCategory = (name: string) => {
    setHiddenCategories(prev => prev.includes(name) ? prev.filter(cat => cat !== name) : [...prev, name]);
  };

  const navMonth = (dir: number) => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + dir);
    setCurrentDate(d);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* HEADER E NAVEGAÇÃO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-2xl font-bold text-slate-800">Olá, {user?.email?.split('@')[0] || 'Usuário'}</h1>
           <p className="text-slate-500 text-sm">Visão geral das suas finanças</p>
        </div>

        <div className="flex items-center bg-white rounded-xl shadow-sm border border-slate-100 p-1">
           <button onClick={() => navMonth(-1)} className="p-2 hover:bg-slate-50 rounded-lg text-slate-600"><ChevronLeft size={20} /></button>
           <div className="px-4 flex items-center gap-2 min-w-[160px] justify-center">
              <Calendar size={16} className="text-slate-400" />
              <span className="font-bold text-slate-700 capitalize">
                {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </span>
           </div>
           <button onClick={() => navMonth(1)} className="p-2 hover:bg-slate-50 rounded-lg text-slate-600"><ChevronRight size={20} /></button>
        </div>
      </div>

      {/* CARDS PRINCIPAIS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden col-span-1 md:col-span-2">
           <div className="absolute right-0 top-0 p-4 opacity-10"><Wallet size={120} /></div>
           <p className="text-slate-400 font-medium mb-1 text-sm">Patrimônio Total</p>
           <h2 className="text-3xl font-bold mb-4">{formatCurrency(accountsBalance + investmentsBalance)}</h2>
           <div className="flex gap-4 text-xs font-medium text-slate-300">
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"/> Contas: {formatCurrency(accountsBalance)}</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"/> Investimentos: {formatCurrency(investmentsBalance)}</span>
           </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
            <div className="flex justify-between items-start">
               <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><TrendingUp size={24}/></div>
               <span className="text-xs font-bold text-slate-400 uppercase bg-slate-50 px-2 py-1 rounded">Receitas</span>
            </div>
            <div>
               <h3 className="text-2xl font-bold text-emerald-600 mt-4">{formatCurrency(monthlyTotals.income)}</h3>
            </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
            <div className="flex justify-between items-start">
               <div className="p-2 bg-red-100 text-red-600 rounded-lg"><TrendingDown size={24}/></div>
               <span className="text-xs font-bold text-slate-400 uppercase bg-slate-50 px-2 py-1 rounded">Despesas</span>
            </div>
            <div>
               <h3 className="text-2xl font-bold text-red-600 mt-4">{formatCurrency(monthlyTotals.expense)}</h3>
            </div>
        </div>
      </div>

      {/* ÁREA DE GRÁFICOS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* GRÁFICO DE ÁREA */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
             <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-slate-700 flex items-center gap-2"><Activity size={18} className="text-blue-500"/> Fluxo Diário</h3>
             </div>
             <div className="h-[300px] w-full">
                 <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10B981" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorDespesa" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                        <YAxis hide />
                        <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} formatter={(value: any) => formatCurrency(Number(value))} />
                        <Area type="monotone" dataKey="receita" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorReceita)" />
                        <Area type="monotone" dataKey="despesa" stroke="#EF4444" strokeWidth={3} fillOpacity={1} fill="url(#colorDespesa)" />
                    </AreaChart>
                </ResponsiveContainer>
             </div>
          </div>

          {/* GRÁFICO DE CATEGORIAS (PIE) */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
             <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-slate-700 flex items-center gap-2"><PieIcon size={18} className="text-purple-500"/> Categorias</h3>
                
                {/* BOTÕES DE FILTRO (NOVO) */}
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button 
                        onClick={() => setChartType('expense')}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${chartType === 'expense' ? 'bg-white shadow text-red-500' : 'text-slate-400'}`}
                    >
                        Saídas
                    </button>
                    <button 
                        onClick={() => setChartType('income')}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${chartType === 'income' ? 'bg-white shadow text-emerald-500' : 'text-slate-400'}`}
                    >
                        Entradas
                    </button>
                </div>
             </div>

             {categoryData.length > 0 ? (
                 <div className="h-[300px] w-full flex flex-col items-center">
                    <ResponsiveContainer width="100%" height="60%">
                        <PieChart>
                            <Pie
                                data={visibleCategoryData}
                                innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value"
                            >
                                {visibleCategoryData.map((entry, index) => {
                                    const originalIndex = categoryData.findIndex(c => c.name === entry.name);
                                    return <Cell key={`cell-${index}`} fill={COLORS[originalIndex % COLORS.length]} />;
                                })}
                            </Pie>
                            <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="w-full mt-4 space-y-2 max-h-[100px] overflow-y-auto custom-scrollbar">
                        {categoryData.map((entry, index) => {
                             const isHidden = hiddenCategories.includes(entry.name);
                             return (
                                <div key={index} onClick={() => toggleCategory(entry.name)} className={`flex justify-between items-center text-sm cursor-pointer hover:bg-slate-50 p-1 rounded ${isHidden ? 'opacity-40 grayscale' : ''}`}>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[index % COLORS.length]}} />
                                        <span className={`text-slate-600 truncate max-w-[120px] ${isHidden ? 'line-through' : ''}`}>{entry.name}</span>
                                    </div>
                                    <span className="font-bold text-slate-700">{formatCurrency(entry.value)}</span>
                                </div>
                             );
                        })}
                    </div>
                 </div>
             ) : (
                <div className="h-[300px] flex flex-col items-center justify-center text-slate-400 text-sm italic">
                    <Filter size={40} className="mb-2 opacity-20"/>
                    Sem {chartType === 'expense' ? 'despesas' : 'receitas'} neste mês
                </div>
             )}
          </div>
      </div>

      {/* ÚLTIMAS TRANSAÇÕES */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100"><h3 className="font-bold text-slate-800">Atividades Recentes</h3></div>
          <div className="divide-y divide-slate-100">
             {monthlyTransactions.slice(0, 5).map(t => (
                 <div key={t.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                     <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${t.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                            {t.type === 'income' ? <ArrowUp size={16}/> : <ArrowDown size={16}/>}
                        </div>
                        <div>
                            <p className="font-bold text-slate-700">{t.description}</p>
                            <p className="text-xs text-slate-400">{new Date(t.date).toLocaleDateString('pt-BR')} • {t.category}</p>
                        </div>
                     </div>
                     <span className={`font-bold ${t.type === 'income' ? 'text-emerald-600' : 'text-slate-700'}`}>
                        {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                     </span>
                 </div>
             ))}
             {monthlyTransactions.length === 0 && <div className="p-8 text-center text-slate-400">Sem dados.</div>}
          </div>
      </div>
    </div>
  );
}