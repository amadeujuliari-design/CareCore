import { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, Plus, Trash2, Edit2, Search, ExternalLink, 
  DollarSign, Globe, Trophy, ArrowUpRight, ArrowDownRight 
} from 'lucide-react';
import { useFinanceStore } from '../store/useFinanceStore';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/formatters';
import { Button } from '../components/ui/Button';
import type { Investment } from '../types';

// --- HELPERS ---
const formatUSD = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

function calculateCompoundInterest(principal: number, monthlyRate: number, startDateIso: string) {
  if (!startDateIso) return { currentValue: principal, yieldValue: 0, days: 0 };
  const [y, m, d] = startDateIso.split('T')[0].split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const now = new Date();
  const timeDiff = now.getTime() - start.getTime();
  const days = Math.max(0, Math.floor(timeDiff / (1000 * 60 * 60 * 24)));
  const dailyRate = Math.pow(1 + (monthlyRate / 100), 1/30) - 1;
  const amount = principal * Math.pow(1 + dailyRate, days);
  return { currentValue: amount, yieldValue: amount - principal, days };
}

// --- COMPONENTE DE GRÁFICO ---
function CandleChart({ data }: { data: any[] }) {
  if (!data.length) return null;
  const [selectedDay, setSelectedDay] = useState<any>(data[0]);
  useEffect(() => { if (data.length > 0) setSelectedDay(data[0]); }, [data]);
  
  const width = 300, height = 150, padding = 10, candleWidth = 20;
  const minVal = Math.min(...data.map(d => parseFloat(d.low)));
  const maxVal = Math.max(...data.map(d => parseFloat(d.high)));
  const range = maxVal - minVal;
  const getY = (val: number) => height - padding - ((val - minVal) / range) * (height - 2 * padding);
  const barWidth = (width - 2 * padding) / data.length;

  return (
    <div className="flex flex-col items-center w-full">
        <div className="flex justify-between w-full px-2 mb-4 items-end border-b border-slate-100 pb-2">
            <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    {selectedDay ? new Date(parseInt(selectedDay.timestamp)*1000).toLocaleDateString('pt-BR') : 'Dólar'}
                </h4>
                <p className="text-[10px] text-slate-400">Variação Diária</p>
            </div>
            <div className="text-right">
                <span className="text-2xl font-bold text-slate-700 block leading-none">R$ {parseFloat(selectedDay?.bid || 0).toFixed(2)}</span>
                <span className={`text-xs font-bold ${parseFloat(selectedDay?.pctChange || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {selectedDay?.pctChange}%
                </span>
            </div>
        </div>
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
        {data.slice().reverse().map((day, i) => {
            const open = parseFloat(day.open), close = parseFloat(day.bid), high = parseFloat(day.high), low = parseFloat(day.low);
            const isUp = close >= open; const color = isUp ? '#10b981' : '#ef4444';
            const x = padding + i * barWidth + (barWidth - candleWidth) / 2;
            const yOpen = getY(open), yClose = getY(close), yHigh = getY(high), yLow = getY(low);
            return (<g key={i} onMouseEnter={() => setSelectedDay(day)} className="cursor-crosshair transition-opacity hover:opacity-80">
                <rect x={x - 5} y={0} width={candleWidth + 10} height={height} fill="transparent" />
                <line x1={x + candleWidth/2} y1={yHigh} x2={x + candleWidth/2} y2={yLow} stroke={color} strokeWidth={2} opacity={0.6} />
                <rect x={x} y={Math.min(yOpen, yClose)} width={candleWidth} height={Math.max(2, Math.abs(yOpen - yClose))} fill={color} opacity={0.8} rx={2} />
            </g>);
        })}
        </svg>
    </div>
  );
}

const marketMovers = [
    { ticker: 'BTC', name: 'Bitcoin', change: 4.2, price: 'R$ 620k' },
    { ticker: 'VALE3', name: 'Vale', change: 2.1, price: 'R$ 68,40' },
    { ticker: 'PRIO3', name: 'Prio', change: 1.8, price: 'R$ 44,20' },
    { ticker: 'HGLG11', name: 'CSHG Log', change: 0.5, price: 'R$ 162,00' },
    { ticker: 'USDBRL', name: 'Dólar', change: -0.4, price: 'R$ 5,98' },
];

export function InvestmentsDesktop() {
  const { investments, fetchInvestments, addInvestment, removeInvestment, updateInvestment } = useFinanceStore();
  const { user } = useAuth();
  
  const [rates, setRates] = useState({ usd: 6.0, eur: 6.30 });
  const [historyData, setHistoryData] = useState<any[]>([]); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [newInv, setNewInv] = useState<Partial<Investment>>({
    name: '', type: 'fixed', amount: 0, rate: 0, start_date: new Date().toISOString().split('T')[0],
    is_cdi: false, cdi_percent: 100, ir: 0, currency: 'BRL', liquidity: 'D+0'
  });

  useEffect(() => {
    fetchInvestments();
    
    fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL')
        .then(r => r.json())
        .then(d => setRates({ usd: parseFloat(d.USDBRL.bid), eur: parseFloat(d.EURBRL.bid) }))
        .catch(console.error);
    
    fetch('https://economia.awesomeapi.com.br/json/daily/USD-BRL/7')
        .then(r => r.json())
        .then(d => setHistoryData(d))
        .catch(console.error);
  }, [fetchInvestments]);

  // --- CORREÇÃO CIRÚRGICA APLICADA AQUI ---
  const handleSave = async () => {
    if (!user) {
        alert("Sessão expirada. Faça login novamente.");
        return;
    }
    if (!newInv.name || !newInv.amount) {
        alert("Preencha o nome e o valor.");
        return;
    }

    try {
        const idToUse = editingId || crypto.randomUUID(); // Geração do ID obrigatório

        const invData = { 
            id: idToUse, 
            name: newInv.name, 
            type: newInv.type || 'fixed',
            amount: Number(newInv.amount), 
            rate: newInv.is_cdi ? (1.05 * (Number(newInv.cdi_percent)/100)) : Number(newInv.rate || 0), 
            start_date: newInv.start_date || new Date().toISOString(), 
            is_cdi: Boolean(newInv.is_cdi), 
            cdi_percent: Number(newInv.cdi_percent || 0), 
            ir: Number(newInv.ir || 0), 
            currency: newInv.currency || 'BRL', 
            liquidity: newInv.liquidity || 'D+0', 
            user_id: user.id 
        };

        if (editingId) {
            await updateInvestment({ ...invData, id: editingId } as Investment);
        } else {
            // @ts-ignore
            await addInvestment(invData);
        }

        setIsModalOpen(false); 
        setEditingId(null);
        setNewInv({ name: '', type: 'fixed', amount: 0, rate: 0, start_date: new Date().toISOString().split('T')[0], is_cdi: false, cdi_percent: 100, ir: 0, currency: 'BRL', liquidity: 'D+0' });
    } catch (error) {
        console.error("Erro ao salvar:", error);
        alert("Erro ao salvar o investimento. Verifique sua conexão.");
    }
  };
  
  const handleEdit = (inv: Investment) => { setEditingId(inv.id); setNewInv({ ...inv }); setIsModalOpen(true); };

  const totals = useMemo(() => {
    return investments.reduce((acc, inv) => {
      const { currentValue, yieldValue } = calculateCompoundInterest(inv.amount, inv.rate, inv.start_date);
      const tax = yieldValue > 0 ? yieldValue * ((inv.ir || 0) / 100) : 0;
      const netValue = currentValue - tax;
      const multiplier = inv.currency === 'USD' ? rates.usd : 1.0;
      return { invested: acc.invested + (inv.amount * multiplier), yield: acc.yield + (yieldValue * multiplier), net: acc.net + (netValue * multiplier) };
    }, { invested: 0, yield: 0, net: 0 });
  }, [investments, rates.usd]);

  const handleSearchRates = () => {
      window.open('https://www.google.com/search?q=melhor+investimento+renda+fixa+hoje+cdb+liquidez+diaria', '_blank');
  };

  return (
    <div className="grid grid-cols-12 gap-6 pb-20 pt-4 animate-in fade-in">
      
      {/* Header */}
      <div className="col-span-12 flex justify-between items-center mb-2">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><TrendingUp className="text-blue-600" /> Carteira de Investimentos</h2>
        <div className="flex gap-3">
            <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm flex items-center gap-3">
                <div className="flex items-center gap-2 text-emerald-600"><DollarSign size={16}/><span className="text-xs font-bold">USD</span></div>
                <span className="font-mono font-bold text-slate-700">R$ {rates.usd.toFixed(2)}</span>
            </div>
            <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm flex items-center gap-3">
                <div className="flex items-center gap-2 text-indigo-600"><Globe size={16}/><span className="text-xs font-bold">EUR</span></div>
                <span className="font-mono font-bold text-slate-700">R$ {rates.eur.toFixed(2)}</span>
            </div>
            <Button onClick={() => { setEditingId(null); setIsModalOpen(true); }} className="bg-slate-900 text-white ml-2"><Plus size={18} /> Novo Investimento</Button>
        </div>
      </div>

      {/* COLUNA PRINCIPAL (Tabela e Cards) */}
      <div className="col-span-12 lg:col-span-8 space-y-6">
         <div className="grid grid-cols-3 gap-4">
             <div className="bg-blue-600 p-6 rounded-2xl text-white shadow-lg relative overflow-hidden">
                 <div className="absolute right-0 top-0 p-4 opacity-10"><TrendingUp size={80}/></div>
                 <p className="text-blue-100 text-xs font-bold uppercase">Total Líquido</p>
                 <h3 className="text-3xl font-bold mt-1">{formatCurrency(totals.net)}</h3>
             </div>
             <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                 <p className="text-slate-400 text-xs font-bold uppercase">Total Investido</p>
                 <h3 className="text-2xl font-bold text-slate-700 mt-1">{formatCurrency(totals.invested)}</h3>
             </div>
             <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                 <p className="text-slate-400 text-xs font-bold uppercase">Rendimento</p>
                 <h3 className="text-2xl font-bold text-emerald-600 mt-1">+{formatCurrency(totals.yield)}</h3>
             </div>
         </div>

         <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
             <div className="p-4 border-b border-slate-50 font-bold text-slate-700 flex items-center gap-2"><Trophy size={18} className="text-amber-500"/> Minha Carteira</div>
             <table className="w-full text-left text-sm">
                 <thead className="bg-slate-50 text-slate-500 font-medium">
                     <tr><th className="p-4">Ativo</th><th className="p-4 text-right">Investido</th><th className="p-4 text-right">Atual (Líq)</th><th className="p-4 text-right">Rentabilidade</th><th className="p-4 w-20"></th></tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                     {investments.map(inv => {
                         const { currentValue, yieldValue } = calculateCompoundInterest(inv.amount, inv.rate, inv.start_date);
                         const isUSD = inv.currency === 'USD';
                         const tax = yieldValue > 0 ? yieldValue * ((inv.ir || 0) / 100) : 0;
                         const net = currentValue - tax;
                         return (
                             <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                                 <td className="p-4"><p className="font-bold text-slate-700">{inv.name}</p><p className="text-xs text-slate-400">{inv.is_cdi ? `${inv.cdi_percent}% CDI` : `${inv.rate}% a.m.`} • {inv.liquidity}</p></td>
                                 <td className="p-4 text-right font-mono">{isUSD ? formatUSD(inv.amount) : formatCurrency(inv.amount)}</td>
                                 <td className="p-4 text-right font-bold text-blue-600 font-mono">{isUSD ? formatUSD(net) : formatCurrency(net)}</td>
                                 <td className={`p-4 text-right font-bold ${yieldValue>=0?'text-emerald-600':'text-red-500'}`}>{yieldValue>=0?'+':''}{isUSD ? formatUSD(yieldValue) : formatCurrency(yieldValue)}</td>
                                 <td className="p-4 flex gap-2 justify-end"><button onClick={() => handleEdit(inv)} className="text-slate-400 hover:text-blue-600"><Edit2 size={16}/></button><button onClick={() => removeInvestment(inv.id)} className="text-slate-400 hover:text-red-600"><Trash2 size={16}/></button></td>
                             </tr>
                         );
                     })}
                 </tbody>
             </table>
         </div>
      </div>

      {/* COLUNA DIREITA (Widgets e Gráfico) */}
      <div className="col-span-12 lg:col-span-4 space-y-6">
         
         {historyData.length > 0 && (
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                 <CandleChart data={historyData} />
             </div>
         )}

         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><TrendingUp size={20} className="text-blue-600" /> Mercado</h3>
            <div className="space-y-4">
               {marketMovers.map((asset, i) => (
                  <div key={asset.ticker} className="flex items-center justify-between group cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition-colors">
                      <div className="flex items-center gap-3"><span className="text-xs font-bold text-slate-300 w-4">#{i+1}</span><div><p className="font-bold text-slate-700 text-sm">{asset.ticker}</p><p className="text-xs text-slate-400">{asset.name}</p></div></div>
                      <div className="text-right"><p className="font-bold text-slate-700 text-sm">{asset.price}</p><span className={`text-[10px] font-bold flex items-center justify-end gap-1 ${asset.change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{asset.change >= 0 ? <ArrowUpRight size={12}/> : <ArrowDownRight size={12}/>}{Math.abs(asset.change)}%</span></div>
                  </div>
               ))}
            </div>
         </div>

         <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-2xl text-white shadow-xl">
             <div className="flex items-center gap-2 mb-4"><Search size={20} className="text-emerald-400"/><h3 className="font-bold text-lg">Melhores Taxas</h3></div>
             <p className="text-sm text-slate-300 mb-6">Compare CDBs e LCIs com liquidez diária.</p>
             <button onClick={handleSearchRates} className="w-full py-3 bg-white text-slate-900 rounded-xl font-bold hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2">
                Pesquisar no Google <ExternalLink size={16}/>
             </button>
         </div>

      </div>

      {/* MODAL */}
      {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95">
                  <h3 className="font-bold text-lg mb-4">{editingId ? 'Editar' : 'Novo'} Investimento</h3>
                  <div className="space-y-3">
                      <input placeholder="Nome (Ex: Tesouro Selic)" className="w-full p-2 border rounded" value={newInv.name} onChange={e => setNewInv({...newInv, name: e.target.value})} />
                      <div className="flex gap-2"><input type="number" placeholder="Valor" className="flex-1 p-2 border rounded" value={newInv.amount} onChange={e => setNewInv({...newInv, amount: Number(e.target.value)})} /><input type="date" className="flex-1 p-2 border rounded" value={newInv.start_date} onChange={e => setNewInv({...newInv, start_date: e.target.value})} /></div>
                      <div className="flex items-center gap-2"><input type="checkbox" checked={newInv.is_cdi} onChange={e => setNewInv({...newInv, is_cdi: e.target.checked})} /> <label>Rende % do CDI?</label></div>
                      {newInv.is_cdi ? <input type="number" placeholder="% do CDI (Ex: 100)" className="w-full p-2 border rounded" value={newInv.cdi_percent} onChange={e => setNewInv({...newInv, cdi_percent: Number(e.target.value)})} /> : <input type="number" placeholder="Taxa Fixa % a.m." className="w-full p-2 border rounded" value={newInv.rate} onChange={e => setNewInv({...newInv, rate: Number(e.target.value)})} />}
                      <div className="flex gap-2"><button onClick={() => setIsModalOpen(false)} className="flex-1 p-2 bg-slate-100 rounded">Cancelar</button><button onClick={handleSave} className="flex-1 p-2 bg-blue-600 text-white rounded">Salvar</button></div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}