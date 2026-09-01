import React, { useMemo, useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, Wallet, Calendar, 
  ArrowUp, ArrowDown, Bell, Eye, EyeOff, UserCircle, PieChart as PieChartIcon,
  Filter
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip 
} from 'recharts';
import { useFinanceStore } from '../store/useFinanceStore';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, formatDateBR } from '../utils/formatters';

// Cores expandidas para suportar mais categorias sem repetição
const COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1',
  '#14B8A6', '#84CC16', '#06B6D4', '#D946EF', '#F97316', '#64748B', '#A855F7'
];

// Função auxiliar de cálculo financeiro
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

export function DashboardMobile() {
  const { user } = useAuth();
  const { 
    transactions, accounts, investments, 
    fetchTransactions, fetchAccounts, fetchInvestments 
  } = useFinanceStore();

  const [hideValues, setHideValues] = useState(false);
  const [usdRate, setUsdRate] = useState(6.0);
  
  // Controle de categorias ocultas
  const [hiddenCategories, setHiddenCategories] = useState<string[]>([]);
  
  // NOVO: Controle do Tipo de Gráfico (Igual ao Desktop)
  const [chartType, setChartType] = useState<'expense' | 'income'>('expense');

  useEffect(() => {
    fetchTransactions();
    fetchAccounts();
    fetchInvestments();
    
    fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL')
      .then(r => r.json())
      .then(d => setUsdRate(parseFloat(d.USDBRL.bid)))
      .catch(console.error);
  }, [fetchTransactions, fetchAccounts, fetchInvestments]);

  // --- CÁLCULOS ---

  const currentDate = new Date();
  const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

  const accountsBalance = useMemo(() => {
    return accounts.reduce((acc, account) => acc + (account.balance || 0), 0);
  }, [accounts]);

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

  // --- DADOS DO GRÁFICO (MODIFICADO: Filtra por chartType) ---
  const categoryData = useMemo(() => {
    // Filtra pelo tipo selecionado (expense ou income)
    const filtered = monthlyTransactions.filter(t => t.type === chartType);
    
    const grouped = filtered.reduce((acc, t) => {
        const cat = t.category || 'Outros';
        acc[cat] = (acc[cat] || 0) + t.amount;
        return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
  }, [monthlyTransactions, chartType]);

  // Dados filtrados visualmente (respeita o toggle da legenda)
  const visibleCategoryData = useMemo(() => {
    return categoryData.filter(item => !hiddenCategories.includes(item.name));
  }, [categoryData, hiddenCategories]);

  const togglePrivacy = () => setHideValues(!hideValues);

  const toggleCategory = (name: string) => {
    setHiddenCategories(prev => 
      prev.includes(name) 
        ? prev.filter(cat => cat !== name) 
        : [...prev, name]
    );
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500">
      
      {/* HEADER MOBILE */}
      <div className="flex justify-between items-center px-1 pt-2">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-500">
                <UserCircle size={24} />
            </div>
            <div>
                <p className="text-xs text-slate-500 font-medium">Bem vindo,</p>
                <h2 className="text-sm font-bold text-slate-800">{user?.email?.split('@')[0]}</h2>
            </div>
        </div>
        <div className="flex gap-2">
            <button onClick={togglePrivacy} className="p-2 text-slate-400 hover:text-slate-600">
                {hideValues ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
            <button className="p-2 text-slate-400 hover:text-slate-600 relative">
                <Bell size={20} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
            </button>
        </div>
      </div>

      {/* CARD PATRIMÔNIO (PRINCIPAL) */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden mx-1">
         <div className="absolute right-[-20px] top-[-20px] p-4 opacity-10 rotate-12"><Wallet size={150} /></div>
         
         <p className="text-slate-400 text-xs font-medium mb-1">Patrimônio Total</p>
         <h1 className="text-3xl font-bold mb-6 tracking-tight">
            {hideValues ? '••••••••' : formatCurrency(accountsBalance + investmentsBalance)}
         </h1>

         <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-sm">
                <div className="text-[10px] text-slate-300 mb-1 flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div> Em Contas
                </div>
                <p className="font-bold text-sm">
                    {hideValues ? '••••' : formatCurrency(accountsBalance)}
                </p>
            </div>
            <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-sm">
                <div className="text-[10px] text-slate-300 mb-1 flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div> Investido
                </div>
                <p className="font-bold text-sm">
                    {hideValues ? '••••' : formatCurrency(investmentsBalance)}
                </p>
            </div>
         </div>
      </div>

      {/* RESUMO MENSAL (CARDS HORIZONTAIS) */}
      <div>
        <h3 className="font-bold text-slate-700 mb-3 px-1 flex items-center gap-2 text-sm">
            <Calendar size={14} className="text-slate-400"/> Este Mês
        </h3>
        <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2">
                    <ArrowUp size={16} />
                </div>
                <p className="text-xs text-slate-400 font-medium">Entradas</p>
                <p className="text-lg font-bold text-emerald-600">
                    {hideValues ? '••••' : formatCurrency(monthlyTotals.income)}
                </p>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-2">
                    <ArrowDown size={16} />
                </div>
                <p className="text-xs text-slate-400 font-medium">Saídas</p>
                <p className="text-lg font-bold text-red-600">
                    {hideValues ? '••••' : formatCurrency(monthlyTotals.expense)}
                </p>
            </div>
        </div>
      </div>

      {/* --- GRÁFICO DE CATEGORIAS (MODIFICADO) --- */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden p-4 mx-1">
          {/* Header do Gráfico com Toggle (NOVO) */}
          <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                  <PieChartIcon size={14} className="text-slate-400"/> Categorias
              </h3>
              
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button 
                    onClick={() => setChartType('expense')}
                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${chartType === 'expense' ? 'bg-white shadow text-red-500' : 'text-slate-400'}`}
                >
                    Saídas
                </button>
                <button 
                    onClick={() => setChartType('income')}
                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${chartType === 'income' ? 'bg-white shadow text-emerald-500' : 'text-slate-400'}`}
                >
                    Entradas
                </button>
              </div>
          </div>
          
          {categoryData.length > 0 ? (
            <>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                          <Pie
                              data={visibleCategoryData}
                              cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5}
                              dataKey="value" stroke="none"
                          >
                              {visibleCategoryData.map((entry, index) => {
                                  const originalIndex = categoryData.findIndex(c => c.name === entry.name);
                                  return <Cell key={`cell-${index}`} fill={COLORS[originalIndex % COLORS.length]} />;
                              })}
                          </Pie>
                          <Tooltip 
                              formatter={(value: any) => hideValues ? '••••' : formatCurrency(Number(value))}
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          />
                      </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legenda */}
                <div className="mt-4 space-y-2 max-h-[250px] overflow-y-auto custom-scrollbar">
                    {categoryData.map((entry, index) => {
                        const isHidden = hiddenCategories.includes(entry.name);
                        return (
                          <div 
                              key={index} 
                              onClick={() => toggleCategory(entry.name)}
                              className={`flex justify-between items-center text-xs p-1 rounded active:bg-slate-50 transition-all ${isHidden ? 'opacity-40 grayscale' : ''}`}
                          >
                              <div className="flex items-center gap-2">
                                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                  <span className={`text-slate-600 font-medium truncate max-w-[150px] ${isHidden ? 'line-through' : ''}`}>
                                      {entry.name}
                                  </span>
                              </div>
                              <span className="font-bold text-slate-700">
                                  {hideValues ? '••••' : formatCurrency(entry.value)}
                              </span>
                          </div>
                        );
                    })}
                </div>
            </>
          ) : (
            <div className="h-[200px] flex flex-col items-center justify-center text-slate-400 text-xs italic">
                <Filter size={24} className="mb-2 opacity-20"/>
                Sem {chartType === 'expense' ? 'despesas' : 'receitas'} neste mês
            </div>
          )}
      </div>

      {/* ÚLTIMAS TRANSAÇÕES */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mx-1">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
             <h3 className="font-bold text-slate-700 text-sm">Últimas Atividades</h3>
          </div>
          <div className="divide-y divide-slate-100">
             {monthlyTransactions.slice(0, 5).map(t => (
                 <div key={t.id} className="p-4 flex justify-between items-center">
                     <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${t.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                            {t.type === 'income' ? <TrendingUp size={16}/> : <TrendingDown size={16}/>}
                        </div>
                        <div className="min-w-0">
                            <p className="font-bold text-slate-700 text-sm truncate max-w-[120px]">{t.description}</p>
                            <p className="text-[10px] text-slate-400">{formatDateBR(t.date)} • {t.category}</p>
                        </div>
                     </div>
                     <span className={`font-bold text-sm whitespace-nowrap ${t.type === 'income' ? 'text-emerald-600' : 'text-slate-800'}`}>
                        {hideValues ? '••••' : (t.type === 'income' ? '+' : '') + formatCurrency(t.amount)}
                     </span>
                 </div>
             ))}
             {monthlyTransactions.length === 0 && (
                 <div className="p-6 text-center text-slate-400 text-xs italic">
                    Nenhuma movimentação recente.
                 </div>
             )}
          </div>
      </div>
    </div>
  );
}