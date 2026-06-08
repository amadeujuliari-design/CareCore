import { useState } from 'react';

import { FORM_HISTORICO_CONVIVENTE_INICIAL } from '../utils/conviventesProntuarioUtils';
import {
  excluirHistoricoConviventeApi,
  listarHistoricoFluxoConvivente,
  listarHistoricosConvivente,
  listarOcorrenciasConvivente,
  salvarHistoricoConvivente,
} from '../services/conviventesProntuarioService';

export function useProntuarioHistorico({ editandoId, podeCriarHistoricoConvivente, setErro, setSucesso }) {
  const [ocorrencias, setOcorrencias] = useState([]);
  const [loadingOcorrencias, setLoadingOcorrencias] = useState(false);
  const [historicosConvivente, setHistoricosConvivente] = useState([]);
  const [loadingHistoricosConvivente, setLoadingHistoricosConvivente] = useState(false);
  const [historicoFluxo, setHistoricoFluxo] = useState([]);
  const [loadingHistoricoFluxo, setLoadingHistoricoFluxo] = useState(false);
  const [ocorrenciasCarregadasPara, setOcorrenciasCarregadasPara] = useState(null);
  const [historicosCarregadosPara, setHistoricosCarregadosPara] = useState(null);
  const [fluxoCarregadoPara, setFluxoCarregadoPara] = useState(null);
  const [salvandoHistoricoConvivente, setSalvandoHistoricoConvivente] = useState(false);
  const [historicoEditando, setHistoricoEditando] = useState(null);
  const [formHistoricoConvivente, setFormHistoricoConvivente] = useState({
    ...FORM_HISTORICO_CONVIVENTE_INICIAL,
  });

  const resetarHistoricoProntuario = () => {
    setOcorrencias([]);
    setHistoricoFluxo([]);
    setOcorrenciasCarregadasPara(null);
    setHistoricosCarregadosPara(null);
    setFluxoCarregadoPara(null);
    setHistoricosConvivente([]);
    setFormHistoricoConvivente({ ...FORM_HISTORICO_CONVIVENTE_INICIAL });
    setHistoricoEditando(null);
  };

  const carregarOcorrencias = async (conviventeId) => {
    setLoadingOcorrencias(true);
    try {
      const ocorrenciasRecebidas = await listarOcorrenciasConvivente(conviventeId);
      setOcorrencias(ocorrenciasRecebidas);
      setOcorrenciasCarregadasPara(conviventeId);
    } catch (error) {
      console.error('Erro ao carregar histórico', error);
    } finally {
      setLoadingOcorrencias(false);
    }
  };

  const carregarHistoricosConvivente = async (conviventeId) => {
    setLoadingHistoricosConvivente(true);
    try {
      const historicosRecebidos = await listarHistoricosConvivente(conviventeId);
      setHistoricosConvivente(historicosRecebidos);
      setHistoricosCarregadosPara(conviventeId);
    } catch (error) {
      console.error('Erro ao carregar históricos do convivente', error);
      setErro('Não foi possível carregar o histórico do convivente.');
    } finally {
      setLoadingHistoricosConvivente(false);
    }
  };

  const carregarHistoricoFluxo = async (conviventeId) => {
    try {
      setLoadingHistoricoFluxo(true);
      const historicoRecebido = await listarHistoricoFluxoConvivente(conviventeId);

      setHistoricoFluxo(historicoRecebido);
      setFluxoCarregadoPara(conviventeId);
    } catch (error) {
      console.error('Erro ao carregar histórico de fluxo:', error);
    } finally {
      setLoadingHistoricoFluxo(false);
    }
  };

  const handleSalvarHistoricoConvivente = async () => {
    if (!editandoId) {
      setErro('Salve o prontuário antes de registrar histórico.');
      return;
    }

    if (!podeCriarHistoricoConvivente) {
      setErro('Seu perfil pode consultar, mas não inserir histórico no convivente.');
      return;
    }

    if (!formHistoricoConvivente.origem_informacao.trim()) {
      setErro('Informe a origem da informação.');
      return;
    }

    if (!formHistoricoConvivente.data_origem) {
      setErro('Informe a data de origem da informação.');
      return;
    }

    if (!formHistoricoConvivente.descricao.trim()) {
      setErro('Informe o conteúdo do histórico.');
      return;
    }

    try {
      setSalvandoHistoricoConvivente(true);
      const historicoSalvo = await salvarHistoricoConvivente(
        editandoId,
        {
          origem_informacao: formHistoricoConvivente.origem_informacao,
          data_origem: formHistoricoConvivente.data_origem,
          titulo: formHistoricoConvivente.titulo,
          descricao: formHistoricoConvivente.descricao,
        },
        historicoEditando?.id || null,
      );

      setHistoricosConvivente(prev => (
        historicoEditando
          ? prev.map(item => item.id === historicoSalvo.id ? historicoSalvo : item)
          : [historicoSalvo, ...prev]
      ));
      setFormHistoricoConvivente({ ...FORM_HISTORICO_CONVIVENTE_INICIAL });
      setHistoricoEditando(null);
      setSucesso(historicoEditando ? 'Histórico atualizado com sucesso.' : 'Histórico do convivente salvo com sucesso.');
      setTimeout(() => setSucesso(''), 3000);
    } catch (error) {
      setErro(error.response?.data?.detail || 'Erro ao salvar histórico do convivente.');
    } finally {
      setSalvandoHistoricoConvivente(false);
    }
  };

  const iniciarEdicaoHistoricoConvivente = (registro) => {
    setHistoricoEditando(registro);
    setFormHistoricoConvivente({
      origem_informacao: registro.origem_informacao || '',
      data_origem: registro.data_origem ? String(registro.data_origem).slice(0, 10) : '',
      titulo: registro.titulo || '',
      descricao: registro.descricao || '',
    });
  };

  const cancelarEdicaoHistoricoConvivente = () => {
    setHistoricoEditando(null);
    setFormHistoricoConvivente({ ...FORM_HISTORICO_CONVIVENTE_INICIAL });
  };

  const excluirHistoricoConvivente = async (registro) => {
    if (!window.confirm('Excluir este histórico manual do convivente? Esta ação não apaga o Histórico Legado SIAT.')) {
      return;
    }

    try {
      await excluirHistoricoConviventeApi(editandoId, registro.id);
      setHistoricosConvivente(prev => prev.filter(item => item.id !== registro.id));
      if (historicoEditando?.id === registro.id) {
        cancelarEdicaoHistoricoConvivente();
      }
      setSucesso('Histórico excluído com sucesso.');
      setTimeout(() => setSucesso(''), 3000);
    } catch (error) {
      setErro(error.response?.data?.detail || 'Erro ao excluir histórico do convivente.');
    }
  };

  return {
    cancelarEdicaoHistoricoConvivente,
    carregarHistoricoFluxo,
    carregarHistoricosConvivente,
    carregarOcorrencias,
    excluirHistoricoConvivente,
    fluxoCarregadoPara,
    formHistoricoConvivente,
    handleSalvarHistoricoConvivente,
    historicoEditando,
    historicoFluxo,
    historicosCarregadosPara,
    historicosConvivente,
    iniciarEdicaoHistoricoConvivente,
    loadingHistoricoFluxo,
    loadingHistoricosConvivente,
    loadingOcorrencias,
    ocorrencias,
    ocorrenciasCarregadasPara,
    resetarHistoricoProntuario,
    salvandoHistoricoConvivente,
    setFormHistoricoConvivente,
  };
}
