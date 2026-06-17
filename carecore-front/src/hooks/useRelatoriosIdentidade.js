import { useState } from 'react';

import {
  enviarLogoIdentidadeRelatorios,
  removerLogoIdentidadeRelatorios,
  salvarIdentidadeRelatorios,
} from '../services/relatoriosService';
import { urlArquivoBackend } from '../utils/arquivosApi';
import { limparFotoCache } from '../utils/fotoCache';
import { criarHeadersAutenticados } from '../utils/requestIdUtils';
import { emailValido, formatarTelefone, telefoneValido } from '../utils/usuariosUtils';

const FORM_IDENTIDADE_RELATORIO_INICIAL = {
  relatorio_nome_exibicao: '',
  relatorio_rodape_linha1: '',
  relatorio_rodape_linha2: '',
  relatorio_telefone: '',
  relatorio_email: '',
  relatorio_site: '',
};

function montarFormIdentidadeRelatorio(identidade = {}) {
  return {
    relatorio_nome_exibicao: identidade.relatorio_nome_exibicao || '',
    relatorio_rodape_linha1: identidade.relatorio_rodape_linha1 || '',
    relatorio_rodape_linha2: identidade.relatorio_rodape_linha2 || '',
    relatorio_telefone: identidade.relatorio_telefone || '',
    relatorio_email: identidade.relatorio_email || '',
    relatorio_site: identidade.relatorio_site || '',
  };
}

export function useRelatoriosIdentidade(token) {
  const [identidadeRelatorio, setIdentidadeRelatorio] = useState(null);
  const [formIdentidade, setFormIdentidade] = useState(FORM_IDENTIDADE_RELATORIO_INICIAL);
  const [errosIdentidade, setErrosIdentidade] = useState({});
  const [salvandoIdentidade, setSalvandoIdentidade] = useState(false);
  const [mensagemIdentidade, setMensagemIdentidade] = useState('');

  function aplicarIdentidadeRelatorio(identidade) {
    if (!identidade) return;

    setIdentidadeRelatorio(identidade);
    setFormIdentidade(montarFormIdentidadeRelatorio(identidade));
  }

  function atualizarCampoIdentidade(campo, valor) {
    setMensagemIdentidade('');
    setErrosIdentidade((atual) => ({ ...atual, [campo]: '' }));
    setFormIdentidade((atual) => ({
      ...atual,
      [campo]: campo === 'relatorio_telefone' ? formatarTelefone(valor) : valor,
    }));
  }

  function validarCampoIdentidade(campo, valor) {
    const texto = String(valor || '').trim();
    let mensagem = '';

    if (campo === 'relatorio_telefone' && texto && !telefoneValido(texto)) {
      mensagem = 'Telefone inválido. Use DDD + número.';
    }

    if (campo === 'relatorio_email' && texto && !emailValido(texto)) {
      mensagem = 'E-mail inválido.';
    }

    setErrosIdentidade((atual) => ({ ...atual, [campo]: mensagem }));
    return !mensagem;
  }

  async function salvarIdentidadeRelatorio(event) {
    event.preventDefault();
    if (!token) return;

    const camposValidos = [
      validarCampoIdentidade('relatorio_telefone', formIdentidade.relatorio_telefone),
      validarCampoIdentidade('relatorio_email', formIdentidade.relatorio_email),
    ].every(Boolean);

    if (!camposValidos) {
      setMensagemIdentidade('Corrija os campos destacados antes de salvar.');
      return;
    }

    setSalvandoIdentidade(true);
    setMensagemIdentidade('');
    try {
      const identidadeAtualizada = await salvarIdentidadeRelatorios(formIdentidade);
      setIdentidadeRelatorio(identidadeAtualizada);
      setMensagemIdentidade('Identidade dos relatórios salva com sucesso.');
    } catch (error) {
      setMensagemIdentidade(error.response?.data?.detail || 'Não foi possível salvar a identidade dos relatórios.');
    } finally {
      setSalvandoIdentidade(false);
    }
  }

  async function enviarLogoRelatorio(event) {
    const arquivo = event.target.files?.[0];
    event.target.value = '';
    if (!arquivo || !token) return;

    const formData = new FormData();
    formData.append('file', arquivo);

    setSalvandoIdentidade(true);
    setMensagemIdentidade('');
    try {
      const identidadeAtualizada = await enviarLogoIdentidadeRelatorios(formData);
      limparFotoCache();
      setIdentidadeRelatorio(identidadeAtualizada);
      setMensagemIdentidade('Logotipo atualizado com sucesso.');
    } catch (error) {
      setMensagemIdentidade(error.response?.data?.detail || 'Não foi possível enviar o logotipo.');
    } finally {
      setSalvandoIdentidade(false);
    }
  }

  async function removerLogoRelatorio() {
    if (!token) return;

    setSalvandoIdentidade(true);
    setMensagemIdentidade('');
    try {
      const identidadeAtualizada = await removerLogoIdentidadeRelatorios();
      limparFotoCache();
      setIdentidadeRelatorio(identidadeAtualizada);
      setMensagemIdentidade('Logotipo removido.');
    } catch (error) {
      setMensagemIdentidade(error.response?.data?.detail || 'Não foi possível remover o logotipo.');
    } finally {
      setSalvandoIdentidade(false);
    }
  }

  async function obterLogoRelatorioParaImpressao() {
    if (!identidadeRelatorio?.relatorio_logo_url || !token) {
      return '';
    }

    try {
      const response = await fetch(urlArquivoBackend(identidadeRelatorio.relatorio_logo_url), {
        headers: criarHeadersAutenticados(token),
      });
      if (!response.ok) return '';
      const blob = await response.blob();

      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result || '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(blob);
      });
    } catch {
      return '';
    }
  }

  return {
    aplicarIdentidadeRelatorio,
    atualizarCampoIdentidade,
    enviarLogoRelatorio,
    errosIdentidade,
    formIdentidade,
    identidadeRelatorio,
    mensagemIdentidade,
    obterLogoRelatorioParaImpressao,
    removerLogoRelatorio,
    salvarIdentidadeRelatorio,
    salvandoIdentidade,
    validarCampoIdentidade,
  };
}
