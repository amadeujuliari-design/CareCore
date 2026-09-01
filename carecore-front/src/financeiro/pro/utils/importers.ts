// --- FUNÇÕES AUXILIARES ---

const parseOFXDate = (dateStr: string): string => {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  const cleanDate = dateStr.substring(0, 8);
  if (cleanDate.length === 8) {
    const year = cleanDate.substring(0, 4);
    const month = cleanDate.substring(4, 6);
    const day = cleanDate.substring(6, 8);
    return `${year}-${month}-${day}`;
  }
  return new Date().toISOString().split('T')[0];
};

const parseCSVDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const cleanStr = dateStr.trim();
  
  // Formato DD-MM-YYYY (que veio no seu arquivo: 21-12-2025)
  if (cleanStr.includes('-')) {
    const parts = cleanStr.split('-');
    if (parts.length === 3) {
      // Se for dia-mês-ano
      if (parts[2].length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`;
      // Se for ano-mês-dia
      return cleanStr;
    }
  }
  
  // Formato DD/MM/AAAA
  if (cleanStr.includes('/')) {
    const parts = cleanStr.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  return cleanStr; // Tenta retornar direto se for ISO
};

const parseBrazilianNumber = (val: string): number => {
    if (!val) return 0;
    const clean = val.replace(/[R$\s"]/g, '');
    
    // Se tiver vírgula como decimal (16.154,73)
    if (clean.includes(',') && clean.includes('.')) {
        return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
    }
    // Se tiver apenas vírgula (10,00)
    if (clean.includes(',') && !clean.includes('.')) {
        return parseFloat(clean.replace(',', '.'));
    }
    return parseFloat(clean);
};

// --- FUNÇÃO PRINCIPAL ---

export const processBankFile = async (file: File): Promise<{ transactions: any[], balance?: number }> => {
  const text = await file.text();
  const transactions: any[] = [];
  let detectedBalance: number | undefined = undefined;

  // 1. Processamento de OFX
  if (file.name.toLowerCase().endsWith('.ofx')) {
    const parser = new DOMParser();
    const xmlStart = text.indexOf('<OFX>');
    const xmlContent = xmlStart !== -1 ? text.substring(xmlStart) : text;

    try {
        const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
        const trnList = xmlDoc.getElementsByTagName('STMTTRN');
        
        const ledgerBal = xmlDoc.getElementsByTagName('LEDGERBAL')[0];
        if (ledgerBal) {
            const balAmt = ledgerBal.getElementsByTagName('BALAMT')[0]?.textContent;
            if (balAmt) detectedBalance = parseFloat(balAmt);
        }

        for (let i = 0; i < trnList.length; i++) {
            const trn = trnList[i];
            const type = trn.getElementsByTagName('TRNTYPE')[0]?.textContent;
            const dateRaw = trn.getElementsByTagName('DTPOSTED')[0]?.textContent || '';
            const amount = parseFloat(trn.getElementsByTagName('TRNAMT')[0]?.textContent || '0');
            const memo = trn.getElementsByTagName('MEMO')[0]?.textContent || 'Sem descrição';

            transactions.push({
                id: crypto.randomUUID(),
                description: memo,
                amount: Math.abs(amount),
                type: type?.toUpperCase() === 'CREDIT' ? 'income' : 'expense',
                date: parseOFXDate(dateRaw),
                category: 'Outros',
                origin_file: file.name
            });
        }
    } catch (e) {
        console.error("Erro ao ler OFX:", e);
    }
  } 
  // 2. Processamento de CSV (Mercado Pago e outros)
  else if (file.name.toLowerCase().endsWith('.csv')) {
    const lines = text.split('\n');
    let headerFound = false;
    let separator = ','; 
    let colIndex = { date: -1, desc: -1, amount: -1 };

    // Detecta separador na primeira linha útil
    const sampleLine = lines.find(l => l.length > 20);
    if (sampleLine && sampleLine.includes(';')) separator = ';';

    // --- DETECÇÃO DE SALDO (LINHAS 0 e 1) ---
    // Seu arquivo tem INITIAL_BALANCE na linha 0 e valores na linha 1
    if (lines.length > 1) {
        const headerRow = lines[0].toUpperCase();
        if (headerRow.includes('FINAL_BALANCE')) {
            const valuesRow = lines[1].split(separator);
            // No seu arquivo, FINAL_BALANCE é a 4ª coluna (índice 3)
            // INITIAL; CREDITS; DEBITS; FINAL
            if (valuesRow.length >= 4) {
                const finalBalanceStr = valuesRow[3]; // Pega o último valor
                detectedBalance = parseBrazilianNumber(finalBalanceStr);
            }
        }
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        if (!headerFound) {
            const cols = line.split(separator).map(c => c.trim().toUpperCase().replace(/"/g, ''));
            
            // AQUI ESTAVA O PROBLEMA: Adicionei RELEASE_DATE
            const dateIdx = cols.findIndex(c => c === 'RELEASE_DATE' || c === 'DATE' || c === 'DATA');
            
            const amountIdx = cols.findIndex(c => c === 'TRANSACTION_NET_AMOUNT' || c === 'AMOUNT' || c === 'VALOR');
            const descIdx = cols.findIndex(c => c === 'TRANSACTION_TYPE' || c === 'DESCRIPTION' || c === 'DESCRIÇÃO');

            if (dateIdx > -1 && amountIdx > -1) {
                headerFound = true;
                colIndex.date = dateIdx;
                colIndex.amount = amountIdx;
                colIndex.desc = descIdx > -1 ? descIdx : -1;
                continue;
            }
        }

        if (headerFound) {
            const cols = line.split(separator);
            if (cols.length <= colIndex.amount) continue;

            const rawDate = cols[colIndex.date];
            const rawAmount = cols[colIndex.amount];
            const rawDesc = colIndex.desc > -1 ? cols[colIndex.desc] : (cols[1] || 'Movimentação');

            if (rawDate && rawAmount) {
                // Filtra linhas de cabeçalho repetidas ou inválidas
                if (rawDate.includes('DATE') || rawAmount.includes('AMOUNT')) continue;

                const amountValue = parseBrazilianNumber(rawAmount);
                if (isNaN(amountValue) || amountValue === 0) continue;

                transactions.push({
                    id: crypto.randomUUID(),
                    date: parseCSVDate(rawDate),
                    description: (rawDesc || 'Sem descrição').replace(/"/g, '').trim(),
                    amount: Math.abs(amountValue),
                    type: amountValue < 0 ? 'expense' : 'income',
                    category: 'Outros',
                    origin_file: file.name
                });
            }
        }
    }
  }

  return { transactions, balance: detectedBalance };
};