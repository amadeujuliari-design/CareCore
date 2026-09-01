import { ReactNode, useState, useEffect } from 'react';
import { 
  LayoutDashboard, Table, FileText, List, MessageSquare, 
  CreditCard, TrendingUp, Settings, LogOut, Menu, X 
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFinanceStore } from '../store/useFinanceStore'; // Importando a store

interface LayoutProps {
  children: ReactNode;
  activePage: string;
  setActivePage: (page: string) => void;
}

export function Layout({ children, activePage, setActivePage }: LayoutProps) {
  const { signOut, user } = useAuth();
  const { appSettings } = useFinanceStore(); // Pegando config de fonte
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState('');

  // --- LÓGICA DE FONTE DINÂMICA ---
  useEffect(() => {
      // Padrão do navegador é 16px (100%)
      // Média (Seu pedido: -2 pontos) -> 14px (87.5%)
      // Compacta -> 12px (75%)
      // Maior -> 16px (100%)
      const root = document.documentElement;
      if (appSettings.fontSize === 'small') {
          root.style.fontSize = '75%'; // ~12px
      } else if (appSettings.fontSize === 'medium') {
          root.style.fontSize = '87.5%'; // ~14px (Padrão novo)
      } else {
          root.style.fontSize = '100%'; // ~16px
      }
  }, [appSettings.fontSize]);
  // --------------------------------

  useEffect(() => {
    const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };
    const formattedDate = new Date().toLocaleDateString('pt-BR', dateOptions);
    setCurrentDate(formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1));
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'transactions', label: 'Extrato', icon: Table },
    { id: 'invoices', label: 'Notas Fiscais', icon: FileText },
    { id: 'payables', label: 'A Pagar / Receber', icon: List },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
    { id: 'cards', label: 'Cartões', icon: CreditCard },
    { id: 'investments', label: 'Investimentos', icon: TrendingUp },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  const renderNavItem = (item: any, isMobile = false) => {
    const isActive = activePage === item.id;
    return (
      <button
        key={item.id}
        onClick={() => {
            setActivePage(item.id);
            if (isMobile) setIsDrawerOpen(false);
        }}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-left ${
          isActive 
            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/50' 
            : isMobile 
                ? 'text-slate-600 hover:bg-slate-50' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }`}
      >
        <item.icon size={20} />
        <span>{item.label}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row transition-all duration-300">
      
      {/* DESKTOP SIDEBAR */}
      <aside className="!hidden md:!flex flex-col w-64 bg-slate-900 text-white h-screen fixed left-0 top-0 z-50 shadow-xl">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent">
            Finance.Pro <span className="text-xs text-white bg-red-500 px-1 rounded">V3</span>
          </h1>
          <p className="text-xs text-slate-500 mt-2 font-medium uppercase tracking-wider">{currentDate}</p>
        </div>
        <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => renderNavItem(item, false))}
        </nav>
        <div className="p-4 border-t border-slate-800">
           <div className="flex items-center gap-3 px-2 py-3 mb-2 opacity-50">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">
                 {user?.email?.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 overflow-hidden"><p className="text-xs truncate">{user?.email}</p></div>
           </div>
          <button onClick={signOut} className="flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-950/30 hover:text-red-300 rounded-lg transition-colors w-full font-medium">
            <LogOut size={20} /> <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* MOBILE DRAWER */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-slate-200 z-40 px-4 h-16 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white font-bold">F</div>
             <span className="font-bold text-slate-800 text-lg">Finance.Pro</span>
          </div>
          <button onClick={() => setIsDrawerOpen(true)} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"><Menu size={28} /></button>
      </div>

      {isDrawerOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 md:hidden animate-in fade-in" onClick={() => setIsDrawerOpen(false)}/>
      )}

      <div className={`fixed top-0 left-0 bottom-0 w-[280px] bg-white z-50 shadow-2xl transform transition-transform duration-300 ease-out md:hidden ${isDrawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-5 border-b border-slate-100 flex justify-between items-center h-16">
              <span className="font-bold text-slate-800 text-lg">Menu</span>
              <button onClick={() => setIsDrawerOpen(false)} className="text-slate-400 hover:text-red-500 p-1"><X size={24} /></button>
          </div>
          <nav className="p-4 space-y-1 overflow-y-auto h-[calc(100%-80px)]">
              {navItems.map((item) => renderNavItem(item, true))}
              <div className="my-4 border-t border-slate-100 pt-4">
                <button onClick={signOut} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 font-bold text-sm transition-colors">
                  <LogOut size={20} /> <span>Sair do Sistema</span>
                </button>
              </div>
          </nav>
      </div>

      {/* CONTEÚDO */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 mt-16 md:mt-0 w-full overflow-x-hidden">
        <div className="md:hidden mb-6">
             <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full uppercase tracking-wide">{currentDate}</span>
        </div>
        <div className="max-w-7xl mx-auto">
            {children}
        </div>
      </main>
    </div>
  );
}