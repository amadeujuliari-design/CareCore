import { create } from 'zustand';
import { localApi } from '../lib/localApi';
import type { Transaction, Account, Investment, CategoryRule } from '../types';

interface FinanceStore {
  transactions: Transaction[];
  accounts: Account[];
  investments: Investment[];
  rules: CategoryRule[];
  isLoading: boolean;
  appSettings: {
    fontSize: 'small' | 'medium' | 'large';
  };
  
  // Actions
  fetchTransactions: () => Promise<void>;
  addTransaction: (transaction: Omit<Transaction, 'id' | 'created_at'>) => Promise<void>;
  addTransactions: (transactions: Omit<Transaction, 'id' | 'created_at'>[]) => Promise<void>;
  updateTransaction: (transaction: Transaction) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;

  fetchAccounts: () => Promise<void>;
  addAccount: (account: Omit<Account, 'id' | 'created_at'>) => Promise<void>;
  updateAccount: (account: Account) => Promise<void>;
  removeAccount: (id: string) => Promise<void>;

  fetchInvestments: () => Promise<void>;
  addInvestment: (investment: Omit<Investment, 'id' | 'created_at'>) => Promise<void>;
  updateInvestment: (investment: Investment) => Promise<void>;
  removeInvestment: (id: string) => Promise<void>;

  fetchRules: () => Promise<void>;
  addRule: (rule: Omit<CategoryRule, 'id' | 'created_at'>) => Promise<void>;
  removeRule: (id: string) => Promise<void>;

  setAppSettings: (settings: Partial<{ fontSize: 'small' | 'medium' | 'large' }>) => void;
  applyRulesToRetroactive: () => Promise<number>;
}

export const useFinanceStore = create<FinanceStore>((set, get) => ({
  transactions: [],
  accounts: [],
  investments: [],
  rules: [],
  isLoading: false,
  appSettings: {
    fontSize: 'medium'
  },

  // --- TRANSACTIONS ---
  fetchTransactions: async () => {
    set({ isLoading: true });
    try {
      const data = await localApi.list<Transaction>('transactions');
      set({ transactions: data || [] });
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  addTransaction: async (transaction) => {
    try {
      const data = await localApi.insert<Transaction>('transactions', transaction);
      set((state) => ({ transactions: [data, ...state.transactions] }));
      
      if (transaction.account_id) {
        const account = get().accounts.find(a => a.id === transaction.account_id);
        if (account) {
          const newBalance = transaction.type === 'income' 
            ? account.balance + transaction.amount 
            : account.balance - transaction.amount;
          await get().updateAccount({ ...account, balance: newBalance });
        }
      }
    } catch (error) {
      console.error('Error adding transaction:', error);
    }
  },

  addTransactions: async (newTransactions) => {
    try {
      const data = await localApi.insertMany<Transaction>('transactions', newTransactions);
      if (data) {
        set((state) => ({ 
          transactions: [...data, ...state.transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        }));
      }
    } catch (error) {
      console.error('Error adding transactions batch:', error);
      throw error;
    }
  },

  updateTransaction: async (updatedTransaction) => {
    try {
      const data = await localApi.update<Transaction>('transactions', updatedTransaction.id, updatedTransaction);
      set((state) => ({ transactions: state.transactions.map((t) => t.id === updatedTransaction.id ? data : t) }));
    } catch (error) { console.error('Error updating transaction:', error); }
  },

  removeTransaction: async (id) => {
    try {
      const transaction = get().transactions.find(t => t.id === id);
      await localApi.remove('transactions', id);
      set((state) => ({ transactions: state.transactions.filter((t) => t.id !== id) }));
      if (transaction && transaction.account_id) {
        const account = get().accounts.find(a => a.id === transaction.account_id);
        if (account) {
          const newBalance = transaction.type === 'income' ? account.balance - transaction.amount : account.balance + transaction.amount;
          await get().updateAccount({ ...account, balance: newBalance });
        }
      }
    } catch (error) { console.error('Error removing transaction:', error); }
  },

  // --- ACCOUNTS ---
  fetchAccounts: async () => {
    try {
      const data = await localApi.list<Account>('accounts');
      set({ accounts: data || [] });
    } catch (error) { console.error('Error fetching accounts:', error); }
  },

  addAccount: async (account) => {
    try {
      const data = await localApi.insert<Account>('accounts', account);
      set((state) => ({ accounts: [...state.accounts, data] }));
    } catch (error) { console.error('Error adding account:', error); }
  },

  updateAccount: async (account) => {
    try {
      const data = await localApi.update<Account>('accounts', account.id, account);
      set((state) => ({ accounts: state.accounts.map((a) => a.id === account.id ? data : a) }));
    } catch (error) { console.error('Error updating account:', error); }
  },

  removeAccount: async (id) => {
    try {
      await localApi.remove('accounts', id);
      set((state) => ({ accounts: state.accounts.filter((a) => a.id !== id) }));
    } catch (error) { console.error('Error removing account:', error); }
  },

  // --- INVESTMENTS ---
  fetchInvestments: async () => {
    try {
      const data = await localApi.list<Investment>('investments');
      set({ investments: data || [] });
    } catch (error) { console.error('Error fetching investments:', error); }
  },

  addInvestment: async (investment) => {
    try {
      const data = await localApi.insert<Investment>('investments', investment);
      set((state) => ({ investments: [...state.investments, data] }));
    } catch (error) { console.error('Error adding investment:', error); }
  },

  updateInvestment: async (investment) => {
    try {
      const data = await localApi.update<Investment>('investments', investment.id, investment);
      set((state) => ({ investments: state.investments.map((i) => i.id === investment.id ? data : i) }));
    } catch (error) { console.error('Error updating investment:', error); }
  },

  removeInvestment: async (id) => {
    try {
      await localApi.remove('investments', id);
      set((state) => ({ investments: state.investments.filter((i) => i.id !== id) }));
    } catch (error) { console.error('Error removing investment:', error); }
  },

  // --- RULES ---
  fetchRules: async () => {
    try {
      const data = await localApi.list<CategoryRule>('category_rules');
      set({ rules: data || [] });
    } catch (error) { console.error('Error fetching rules:', error); }
  },

  addRule: async (rule) => {
    try {
      const data = await localApi.insert<CategoryRule>('category_rules', rule);
      set((state) => ({ rules: [...state.rules, data] }));
    } catch (error) { console.error('Error adding rule:', error); }
  },

  removeRule: async (id) => {
    try {
      await localApi.remove('category_rules', id);
      set((state) => ({ rules: state.rules.filter(r => r.id !== id) }));
    } catch (error) { console.error('Error removing rule:', error); }
  },

  setAppSettings: (newSettings) => set((state) => ({ 
    appSettings: { ...state.appSettings, ...newSettings } 
  })),

  // --- CORREÇÃO AQUI: Recategorização Segura ---
  applyRulesToRetroactive: async () => {
    const { transactions, rules } = get();
    if (rules.length === 0 || transactions.length === 0) return 0;

    const updates: Transaction[] = [];
    
    // Lista de categorias que consideramos "Genéricas".
    // Apenas transações com estas categorias poderão ser alteradas automaticamente.
    const safeToChange = ['Outros', 'Cartão', 'Geral', 'Pendente', 'Despesa', 'Receita', '', null];

    for (const t of transactions) {
      // SEGURO: Se a categoria atual não for genérica, PULA.
      // Isso impede que categorias como "Dívida: LEO", "Viagem", "Saúde" sejam sobrescritas.
      if (!safeToChange.includes(t.category)) {
          continue; 
      }

      const matchedRule = rules.find(r => 
        t.description.toLowerCase().includes(r.keyword.toLowerCase())
      );

      if (matchedRule && t.category !== matchedRule.category) {
         updates.push({ ...t, category: matchedRule.category });
      }
    }

    if (updates.length > 0) {
      for (const update of updates) {
         await localApi.update<Transaction>('transactions', update.id, { category: update.category });
      }
      set(state => ({
        transactions: state.transactions.map(t => {
          const updated = updates.find(u => u.id === t.id);
          return updated ? updated : t;
        })
      }));
    }

    return updates.length;
  }
}));