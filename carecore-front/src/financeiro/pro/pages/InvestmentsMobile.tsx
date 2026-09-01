import { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, Plus, Trash2, Edit2, Search, X,
  DollarSign, Globe, Trophy, ArrowUpRight, ArrowDownRight, ExternalLink
} from 'lucide-react';
import { useFinanceStore } from '../store/useFinanceStore';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/formatters';
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

// --- DADOS DE MERCADO ---
const marketMovers = [
    { ticker: 'BTC', name: 'Bitcoin', change: 4.2, price: 'R$ 620k' },
    { ticker: 'VALE3', name: 'Vale', change: 2.1, price: 'R$ 68,40' },
    { ticker: 'PRIO3', name: 'Prio', change: 1.8, price: 'R$ 44,20' },
    { ticker: 'HGLG11', name: 'CSHG Log', change: 0.5, price: 'R$ 162,00' },
    { ticker: 'USDBRL', name: 'Dólar', change: -0.4, price: 'R$ 5,98' },
];

function CandleChart({ data }: { data: any[] }) {
  if (!data.length) return null;
  const [selectedDay, setSelectedDay] = useState<any>(data[0]);
  useEffect(() => { if (data.length > 0) setSelectedDay(data[0]); }, [data]);
  
  const width = 300, height = 120, padding = 10, candleWidth = 20;
  const minVal = Math.min(...data.map(d => parseFloat(d.low)));
  const maxVal = Math.max(...data.map(d => parseFloat(d.high)));
  const range = maxVal - minVal;
  const getY = (val: number) => height - padding - ((val - minVal) / range) * (height - 2 * padding);
  const barWidth = (width - 2 * padding) / data.length;

  return (
    <div className="flex flex-col items-center w-full">
        <div className="flex justify-between w-full px-2 mb-2 items-end border-b border-slate-50 pb-2">
            <div><h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedDay ? new Date(parseInt(selectedDay.timestamp)*1000).toLocaleDateString('pt-BR') : 'Dólar'}</h4><p className="text-[9px] text-slate-400">Toque para detalhes</p></div>
            <div className="text-right"><span className="text-lg font-bold text-slate-700 block leading-none">R$ {parseFloat(selectedDay?.bid || 0).toFixed(2)}</span><span className={`text-[10px] font-bold ${parseFloat(selectedDay?.pctChange || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{selectedDay?.pctChange}%</span></div>
        </div>
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
        {data.slice().reverse().map((day, i) => {
            const open = parseFloat(day.open), close = parseFloat(day.bid), high = parseFloat(day.high), low = parseFloat(day.low);
            const isUp = close >= open; const color = isUp ? '#10b981' : '#ef4444';
            const x = padding + i * barWidth + (barWidth - candleWidth) / 2;
            const yOpen = getY(open), yClose = getY(close), yHigh = getY(high), yLow = getY(low);
            return (<g key={i} onClick={() => setSelectedDay(day)}><rect x={x - 5} y={0} width={candleWidth + 10} height={height} fill="transparent" /><line x1={x + candleWidth/2} y1={yHigh} x2={x + candleWidth/2} y2={yLow} stroke={color} strokeWidth={2} opacity={0.6} /><rect x={x} y={Math.min(yOpen, yClose)} width={candleWidth} height={Math.max(2, Math.abs(yOpen - yClose))} fill={color} opacity={0.8} rx={2} /></g>);
        })}
        </svg>
    </div>
  );
}

export function InvestmentsMobile() {
  const { investments, addInvestment, removeInvestment, updateInvestment, fetchInvestments } = useFinanceStore();
  const { user } = useAuth();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rates, setRates] = useState({ usd: 6.0, eur: 6.30 });
  const [historyData, setHistoryData] = useState<any[]>([]);

  const [newInv, setNewInv] = useState<Partial<Investment>>({
    name: '', type: 'fixed', amount: 0, rate: 0, start_date: new Date().toISOString().split('T')[0],
    is_cdi: true, cdi_percent: 100, liquidity: 'D+0', currency: 'BRL', ir: 0
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

  const { totalInvested, totalYield, projectedInvestments, netTotal } = useMemo(() => {
     const CURRENT_CDI_MONTHLY = 0.96; 
     let invested = 0; let current = 0; let netTotalCalc = 0;
     const projected = investments.map(inv => {
        let finalRate = inv.rate;
        if (inv.is_cdi) finalRate = CURRENT_CDI_MONTHLY * (inv.cdi_percent / 100);
        const { currentValue, yieldValue } = calculateCompoundInterest(inv.amount, finalRate, inv.start_date);
        
        const isUSD = inv.currency === 'USD';
        const multiplier = isUSD ? rates.usd : 1.0;
        
        const tax = yieldValue > 0 ? yieldValue * ((inv.ir || 0) / 100) : 0;
        const netValue = currentValue - tax;

        invested += inv.amount * multiplier; 
        current += currentValue * multiplier;
        netTotalCalc += netValue * multiplier;
        
        return { ...inv, currentValue, yieldValue, currentRate: finalRate };
     });
     return { 
       totalInvested: invested, 
       totalYield: current - invested, 
       projectedInvestments: projected,
       netTotal: netTotalCalc
     };
  }, [investments, rates.usd]);

  const handleOpenModal = (inv?: Investment) => {
      if (inv) { setNewInv(inv); setEditingId(inv.id); } else {
          setNewInv({ name: '', type: 'fixed', amount: 0, rate: 0, start_date: new Date().toISOString().split('T')[0], is_cdi: true, cdi_percent: 100, liquidity: 'D+0', currency: 'BRL', ir: 0 });
          setEditingId(null);
      }
      setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!user) { alert("Sessão expirada. Faça login novamente."); return; }
    if (!newInv.name || !newInv.amount) { alert("Preencha Nome e Valor."); return; }
    try {
        const idToUse = editingId || crypto.randomUUID();
        const investmentData = {
            id: idToUse,
            name: newInv.name,
            type: newInv.type || 'fixed',
            amount: Number(newInv.amount),
            rate: Number(newInv.rate || 0),
            start_date: newInv.start_date || new Date().toISOString(),
            is_cdi: Boolean(newInv.is_cdi),
            cdi_percent: Number(newInv.cdi_percent || 0),
            user_id: user.id,
            liquidity: newInv.liquidity || 'D+0',
            currency: newInv.currency || 'BRL',
            ir: Number(newInv.ir || 0)
        };
        if (editingId) {
            await updateInvestment(investmentData as Investment);
        } else {
            // @ts-ignore
            await addInvestment(investmentData);
        }
        setIsModalOpen(false); setEditingId(null);
    } catch (error) { console.error(error); alert("Erro ao salvar."); }
  };

  const handleDelete = async (id: string) => { if(confirm("Excluir?")) await removeInvestment(id); };

  const handleSearchRates = () => {
    window.open('https://www.google.com/search?q=melhor+investimento+renda+fixa+hoje+cdb+liquidez+diaria', '_blank');
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-24">
      {/* HEADER MOBILE COM BOTÃO */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100 mx-1">
          <div>
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <TrendingUp className="text-emerald-600" size={20}/> Investimentos
              </h2>
              <p className="text-xs text-slate-500">Gestão de carteira</p>
          </div>
          <button 
              onClick={() => handleOpenModal()}
              className="bg-slate-900 text-white p-2 rounded-full shadow-lg hover:bg-slate-800 active:scale-95 transition"
          >
              <Plus size={24} />
          </button>
      </div>

      <div className="flex flex-col gap-4">
         {/* Gráfico Dólar */}
         {historyData.length > 0 && (<div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm mx-1"><CandleChart data={historyData} /></div>)}
         
         {/* Botão de Pesquisa Externa */}
         <button onClick={handleSearchRates} className="mx-1 bg-white p-4 rounded-xl border border-blue-100 shadow-sm flex items-center justify-between group active:bg-blue-50 transition-colors">
            <div className="flex items-center gap-3">
               <div className="bg-blue-100 p-2 rounded-full text-blue-600"><Search size={20} /></div>
               <div className="text-left">
                  <p className="text-sm font-bold text-slate-700">Consultar Taxas Reais</p>
                  <p className="text-[10px] text-slate-400">Pesquisar melhores CDBs e LCIs hoje no Google</p>
               </div>
            </div>
            <ExternalLink size={16} className="text-slate-300 group-hover:text-blue-500" />
         </button>

         {/* Ranking de Mercado */}
         <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm mx-1">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm mb-4"><Trophy size={16} className="text-amber-500" /> Destaques da Semana</h3>
            <div className="space-y-3">
               {marketMovers.map((asset, i) => (
                 <div key={asset.ticker} className="flex items-center justify-between border-b border-slate-50 last:border-0 pb-2 last:pb-0">
                    <div className="flex items-center gap-3"><span className="text-xs font-bold text-slate-300 w-4">#{i+1}</span><div><p className="text-xs font-bold text-slate-700">{asset.ticker}</p><p className="text-[10px] text-slate-400">{asset.name}</p></div></div>
                    <div className="text-right"><p className="text-xs font-bold text-slate-700">{asset.price}</p><p className={`text-[10px] font-bold flex items-center justify-end gap-1 ${asset.change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{asset.change >= 0 ? <ArrowUpRight size={10}/> : <ArrowDownRight size={10}/>}{Math.abs(asset.change)}%</p></div>
                 </div>
               ))}
            </div>
         </div>

         {/* Cotação Moedas */}
         <div className="flex gap-3 overflow-x-auto pb-2 px-1 snap-x hide-scrollbar">
             <div className="snap-center min-w-[140px] bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
                 <div className="flex items-center gap-2 text-emerald-600 mb-2"><DollarSign size={16}/> <span className="text-xs font-bold uppercase">Dólar</span></div>
                 <p className="text-xl font-mono font-bold text-slate-700">R$ {rates.usd.toFixed(2)}</p>
             </div>
             <div className="snap-center min-w-[140px] bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
                 <div className="flex items-center gap-2 text-indigo-600 mb-2"><Globe size={16}/> <span className="text-xs font-bold uppercase">Euro</span></div>
                 <p className="text-xl font-mono font-bold text-slate-700">R$ {rates.eur.toFixed(2)}</p>
             </div>
         </div>
      </div>

      {/* Saldo Líquido */}
      <div className="bg-indigo-600 p-5 rounded-2xl text-white shadow-lg relative overflow-hidden mx-1">
           <div className="absolute right-0 top-0 p-4 opacity-20"><TrendingUp size={60} /></div>
           <p className="text-indigo-100 text-[10px] font-bold uppercase mb-1 tracking-widest">Saldo Líquido (Real)</p>
           <h3 className="text-3xl font-bold">{formatCurrency(netTotal)}</h3>
           <p className="text-xs text-indigo-200 mt-2 font-medium">Rendimento Bruto: +{formatCurrency(totalYield)}</p>
      </div>

      {/* Lista de Investimentos */}
      <div className="space-y-3 px-1">
         <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Minha Carteira</h3>
         {investments.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm italic bg-white rounded-xl border border-slate-100 border-dashed">Nenhum investimento cadastrado.</div> 
         ) : (
            projectedInvestments.map((inv) => {
               const isUSD = inv.name.toLowerCase().includes('dolar') || inv.name.toLowerCase().includes('usd') || inv.currency === 'USD';
               const net = inv.currentValue;
               return (
                   <div key={inv.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm relative group">
                       <div className="flex justify-between items-start mb-2">
                           <div>
                              <h4 className="font-bold text-slate-700 text-sm">{inv.name}</h4>
                              <p className="text-[10px] text-slate-400 font-bold">{inv.is_cdi ? `${inv.cdi_percent}% CDI` : `${inv.rate.toFixed(2)}% a.m.`} • {inv.liquidity || 'D+0'}</p>
                           </div>
                           <div className="text-right">
                              <p className="text-sm font-bold text-emerald-600 font-mono">{isUSD ? formatUSD(net) : formatCurrency(net)}</p>
                              {isUSD && <p className="text-[10px] text-emerald-600 font-bold">≈ {formatCurrency(net * rates.usd)}</p>}
                           </div>
                       </div>
                       <div className="flex justify-between items-center border-t border-slate-50 pt-3 mt-2">
                           <div className="text-[10px] text-slate-400">
                               Início: {new Date(inv.start_date).toLocaleDateString('pt-BR')}
                           </div>
                           <div className="flex gap-2">
                               <button onClick={() => handleOpenModal(inv)} className="p-1.5 bg-slate-50 text-slate-500 rounded-lg hover:bg-slate-100 active:scale-95"><Edit2 size={14} /></button>
                               <button onClick={() => handleDelete(inv.id)} className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 active:scale-95"><Trash2 size={14} /></button>
                           </div>
                       </div>
                   </div>
               );
            })
         )}
      </div>

      {/* Modal */}
      {isModalOpen && (
          <div className="fixed inset-0 bg-white z-[60] flex flex-col animate-in slide-in-from-bottom-5">
              <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
                  <h3 className="font-bold text-lg text-slate-800">{editingId ? 'Editar' : 'Novo Aporte'}</h3>
                  <button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-200 rounded-full text-slate-600"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                  <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">Nome</label>
                      <input type="text" className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-medium outline-none focus:ring-2 focus:ring-slate-800" placeholder="Ex: CDB Banco X" value={newInv.name} onChange={e => setNewInv({...newInv, name: e.target.value})} />
                  </div>
                  <div className="flex gap-3">
                      <div className="flex-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Valor</label>
                          <input type="number" className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-medium outline-none focus:ring-2 focus:ring-emerald-500" value={newInv.amount || ''} onChange={e => setNewInv({...newInv, amount: Number(e.target.value)})} />
                      </div>
                      <div className="flex-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Data</label>
                          <input type="date" className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-800" value={newInv.start_date} onChange={e => setNewInv({...newInv, start_date: e.target.value})} />
                      </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                       <div className="flex items-center gap-3 mb-3">
                           <input type="checkbox" id="mob_cdi" className="w-6 h-6 rounded border-slate-300" checked={newInv.is_cdi} onChange={e => setNewInv({...newInv, is_cdi: e.target.checked})} />
                           <label htmlFor="mob_cdi" className="font-bold text-slate-700">Rende % CDI?</label>
                       </div>
                       {newInv.is_cdi ? (
                           <div>
                               <label className="text-xs font-bold text-slate-400">Porcentagem (%)</label>
                               <input type="number" className="w-full mt-1 p-2 bg-white border border-slate-200 rounded-lg" placeholder="100" value={newInv.cdi_percent || ''} onChange={e => setNewInv({...newInv, cdi_percent: Number(e.target.value)})} />
                           </div>
                       ) : (
                           <div>
                               <label className="text-xs font-bold text-slate-400">Taxa Fixa (% a.m)</label>
                               <input type="number" className="w-full mt-1 p-2 bg-white border border-slate-200 rounded-lg" placeholder="1.0" value={newInv.rate || ''} onChange={e => setNewInv({...newInv, rate: Number(e.target.value)})} />
                           </div>
                       )}
                  </div>
              </div>
              <div className="p-4 border-t border-slate-100 bg-white pb-8">
                  <button onClick={handleSave} className="w-full py-4 bg-slate-900 text-white font-bold rounded-xl text-lg shadow-lg active:scale-95 transition flex items-center justify-center gap-2">
                      <TrendingUp size={20} /> Salvar Investimento
                  </button>
              </div>
          </div>
      )}
    </div>
  );
}