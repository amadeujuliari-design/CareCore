export interface Transaction {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  date: string;
  category?: string;
  account_id?: string;
  is_paid: boolean;
  origin_file?: string;
  created_at?: string;

  // Novos campos adicionados para as funcionalidades recentes
  invoice_month?: string;      // Para agrupar faturas de cartão
  whatsapp_cycle_key?: string; // Para agrupar ciclos do WhatsApp
  is_projected?: boolean;      // Para identificar parcelas futuras (projeções)
  responsible?: string;        // Para identificar Léo/Claudio no WhatsApp
  invoice_url?: string;        // Link para o PDF da Nota Fiscal
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: string; // 'checking' | 'investment' | 'cash'
  balance: number;
  created_at?: string;
  yields?: boolean; // Para contas que rendem CDI
}

export interface Investment {
  id: string;
  user_id: string;
  name: string;
  type: string; // 'CDB' | 'LCI' | 'LCA' | 'TESOURO' | 'ACOES' | 'FII' | 'CRIPT' | 'EXTERIOR'
  amount: number;
  rate: number; // Taxa anual (ex: 110% do CDI, 12% a.a.)
  start_date: string;
  liquidity_date?: string; // Data de vencimento/liquidez
  status: 'active' | 'redeemed';
  currency: 'BRL' | 'USD'; // Moeda do investimento
  created_at?: string;
  ir?: number; // Alíquota de IR estimada
  
  // Campos opcionais para flexibilidade
  is_cdi?: boolean;
  cdi_percent?: number;
  liquidity?: string;
}

export interface CategoryRule {
  id: string;
  user_id: string;
  keyword: string;
  category: string;
  created_at?: string;
}