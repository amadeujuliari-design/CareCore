import * as pdfjsLib from 'pdfjs-dist';

// Configuração do Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface ParsedInvoice {
  number: string;
  date: string;
  amount: number;
  description: string;
  client: string;
}

export const extractDataFromPdfText = (fullText: string): ParsedInvoice | null => {
    try {
        const cleanText = fullText.replace(/\s+/g, ' ');

        // A. NÚMERO DA NOTA
        const numMatch = cleanText.match(/Número da NFS-e\s*(\d+)/i);
        const nfNumber = numMatch ? numMatch[1] : 'S/N';

        // B. DATA DE EMISSÃO
        const dateMatch = cleanText.match(/Data e Hora da emissão.*?(\d{2}\/\d{2}\/\d{4})/i);
        let isoDate = '';
        if (dateMatch) {
            const [d, m, y] = dateMatch[1].split('/');
            isoDate = `${y}-${m}-${d}`;
        } else {
           return null; // Sem data, sem nota
        }

        // C. VALOR DO SERVIÇO
        // Formato antigo: "Valor do Serviço R$ ..."
        // DANFSe v2.0: "VALOR DA OPERAÇÃO / SERVIÇO R$ ..." ou "VALOR LÍQUIDO DA NFS-e R$ ..."
        const valMatch =
            cleanText.match(/Valor do Serviço\s*R\$\s*([\d.,]+)/i) ||
            cleanText.match(/Valor da Opera[cç][aã]o\s*\/\s*Servi[cç]o\s*R\$\s*([\d.,]+)/i) ||
            cleanText.match(/Valor L[ií]quido da NFS-e\s*R\$\s*([\d.,]+)/i);
        let amount = 0;
        if (valMatch) {
            amount = parseFloat(valMatch[1].replace(/\./g, '').replace(',', '.'));
        } else {
            return null; // Sem valor, sem nota
        }

        // D. IDENTIFICAÇÃO DO CLIENTE (MAPA INTELIGENTE)
        let clientName = "Cliente Não Identificado";
        const upperText = cleanText.toUpperCase();
        const cnpjs = fullText.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g) || [];
        const clientCnpj = cnpjs.find(c => !c.includes("54.166.611")) || ""; // Ignora CNPJ do emissor
        const cleanCnpj = clientCnpj.replace(/\D/g, '');

        if (cleanCnpj === '61705877000172' || upperText.includes("ASSOCIAÇÃO EVANGÉLICA") || upperText.includes("ASSOCIACAO EVANGELICA")) {
            clientName = "Associação Evangélica Beneficente";
        } 
        else if (upperText.includes("DANKI")) {
            clientName = "Danki";
        }
        else if (upperText.includes("GRANTS") || upperText.includes("CA GRANTS")) {
            clientName = "CA Grants";
        }
        else if (clientCnpj) {
            clientName = `CNPJ ${clientCnpj}`;
        }

        return { 
            number: nfNumber, 
            date: isoDate, 
            amount, 
            description: `NFS-e ${nfNumber} - ${clientName}`,
            client: clientName 
        };

    } catch (e) {
        console.error("Erro fatal no parser", e);
        return null;
    }
};

export const parseInvoicePDF = async (file: File): Promise<ParsedInvoice | null> => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        let fullText = '';

        for (let j = 1; j <= pdf.numPages; j++) {
            const page = await pdf.getPage(j);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            fullText += pageText + ' ';
        }

        return extractDataFromPdfText(fullText);
    } catch (error) {
        console.error("Erro ao ler PDF:", error);
        return null;
    }
};