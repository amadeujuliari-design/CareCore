import { useState } from 'react';

import { FORM_HISTORICO_CONVIVENTE_INICIAL } from '../utils/conviventesProntuarioUtils';
import {
  criarFiltrosFluxoPadrao,
  criarFiltrosHistoricoPadrao,
  criarFiltrosListagemOperacionalPadrao,
  montarParamsFluxoProntuario,
  montarParamsHistoricoProntuario,
  montarParamsListagemOperacional,
  REGISTROS_POR_PAGINA_PRONTUARIO,
} from '../utils/prontuarioHistoricoFluxoUtils';
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
  const [filtrosFluxo, setFiltrosFluxo] = useState(criarFiltrosFluxoPadrao);
  const [filtrosHistorico, setFiltrosHistorico] = useState(criarFiltrosHistoricoPadrao);
  const [filtrosOcorrencias, setFiltrosOcorrencias] = useState(criarFiltrosListagemOperacionalPadrao);
  const [totalHistoricoConvivente, setTotalHistoricoConvivente] = useState(0);
  const [totalOcorrenciasConvivente, setTotalOcorrenciasConvivente] = useState(0);
  const [fluxoTemMais, setFluxoTemMais] = useState(false);
  const [ocorrenciasTemMais, setOcorrenciasTemMais] = useState(false);
  const [carregandoMaisFluxo, setCarregandoMaisFluxo] = useState(false);
  const [carregandoMaisHistorico, setCarregandoMaisHistorico] = useState(false);
  const [carregandoMaisOcorrencias, setCarregandoMaisOcorrencias] = useState(false);

  const resetarHistoricoProntuario = () => {
    setOcorrencias([]);
    setHistoricoFluxo([]);
    setOcorrenciasCarregadasPara(null);
    setHistoricosCarregadosPara(null);
    setFluxoCarregadoPara(null);
    setHistoricosConvivente([]);
    setTotalHistoricoConvivente(0);
    setTotalOcorrenciasConvivente(0);
    setFluxoTemMais(false);
    setOcorrenciasTemMais(false);
    setFiltrosFluxo(criarFiltrosFluxoPadrao());
    setFiltrosHistorico(criarFiltrosHistoricoPadrao());
    setFiltrosOcorrencias(criarFiltrosListagemOperacionalPadrao());
    setFormHistoricoConvivente({ ...FORM_HISTORICO_CONVIVENTE_INICIAL });
    setHistoricoEditando(null);
  };

  const carregarOcorrencias = async (
    conviventeId,
    filtrosParciais = null,
    { append = false } = {},
  ) => {
    const filtrosAtivos = {
      ...(filtrosParciais || filtrosOcorrencias),
      deslocamento: append
        ? (filtrosParciais?.deslocamento ?? filtrosOcorrencias.deslocamento)
        : 0,
    };

    if (!append) {
      setLoadingOcorrencias(true);
    } else {
      setCarregandoMaisOcorrencias(true);
    }

    try {
      const resposta = await listarOcorrenciasConvivente(
        conviventeId,
        montarParamsListagemOperacional(filtrosAtivos),
      );
      const registros = resposta.registros || [];

      setOcorrencias((prev) => (append ? [...prev, ...registros] : registros));
      setTotalOcorrenciasConvivente(resposta.total || 0);
      setOcorrenciasTemMais(registros.length === REGISTROS_POR_PAGINA_PRONTUARIO);
      setFiltrosOcorrencias(filtrosAtivos);
      setOcorrenciasCarregadasPara(conviventeId);
    } catch (error) {
      console.error('Erro ao carregar histórico', error);
      setErro('Não foi possível carregar as ocorrências do convivente.');
    } finally {
      setLoadingOcorrencias(false);
      setCarregandoMaisOcorrencias(false);
    }
  };

  const aplicarFiltrosOcorrencias = async (conviventeId) => {
    await carregarOcorrencias(conviventeId, {
      ...filtrosOcorrencias,
      deslocamento: 0,
    });
  };

  const restaurarFiltrosOcorrenciasPadrao = async (conviventeId) => {
    const padrao = criarFiltrosListagemOperacionalPadrao();
    setFiltrosOcorrencias(padrao);
    await carregarOcorrencias(conviventeId, padrao);
  };

  const carregarMaisOcorrenciasConvivente = async (conviventeId) => {
    if (!ocorrenciasTemMais) return;

    await carregarOcorrencias(
      conviventeId,
      { ...filtrosOcorrencias, deslocamento: ocorrencias.length },
      { append: true },
    );
  };

  const carregarHistoricosConvivente = async (
    conviventeId,
    filtrosParciais = null,
    { append = false } = {},
  ) => {
    const filtrosAtivos = {
      ...(filtrosParciais || filtrosHistorico),
      deslocamento: append
        ? (filtrosParciais?.deslocamento ?? filtrosHistorico.deslocamento)
        : 0,
    };

    if (!append) {
      setLoadingHistoricosConvivente(true);
    } else {
      setCarregandoMaisHistorico(true);
    }

    try {
      const resposta = await listarHistoricosConvivente(
        conviventeId,
        montarParamsHistoricoProntuario(filtrosAtivos),
      );
      const registros = resposta.registros || [];

      setHistoricosConvivente((prev) => (append ? [...prev, ...registros] : registros));
      setTotalHistoricoConvivente(resposta.total || 0);
      setFiltrosHistorico(filtrosAtivos);
      setHistoricosCarregadosPara(conviventeId);
    } catch (error) {
      console.error('Erro ao carregar históricos do convivente', error);
      setErro('Não foi possível carregar o histórico do convivente.');
    } finally {
      setLoadingHistoricosConvivente(false);
      setCarregandoMaisHistorico(false);
    }
  };

  const carregarHistoricoFluxo = async (
    conviventeId,
    filtrosParciais = null,
    { append = false } = {},
  ) => {
    const filtrosAtivos = {
      ...(filtrosParciais || filtrosFluxo),
      deslocamento: append
        ? (filtrosParciais?.deslocamento ?? filtrosFluxo.deslocamento)
        : 0,
    };

    if (!append) {
      setLoadingHistoricoFluxo(true);
    } else {
      setCarregandoMaisFluxo(true);
    }

    try {
      const historicoRecebido = await listarHistoricoFluxoConvivente(
        conviventeId,
        montarParamsFluxoProntuario(filtrosAtivos),
      );
      const registros = historicoRecebido.registros || [];

      setHistoricoFluxo((prev) => (
        append ? [...prev, ...registros] : registros
      ));
      setFluxoTemMais(Boolean(historicoRecebido.has_more));
      setFiltrosFluxo(filtrosAtivos);
      setFluxoCarregadoPara(conviventeId);
    } catch (error) {
      console.error('Erro ao carregar histórico de fluxo:', error);
      setErro('Não foi possível carregar o fluxo diário do convivente.');
    } finally {
      setLoadingHistoricoFluxo(false);
      setCarregandoMaisFluxo(false);
    }
  };

  const aplicarFiltrosHistorico = async (conviventeId) => {
    await carregarHistoricosConvivente(conviventeId, {
      ...filtrosHistorico,
      deslocamento: 0,
    });
  };

  const aplicarFiltrosFluxo = async (conviventeId) => {
    await carregarHistoricoFluxo(conviventeId, {
      ...filtrosFluxo,
      deslocamento: 0,
    });
  };

  const restaurarFiltrosHistoricoPadrao = async (conviventeId) => {
    const padrao = criarFiltrosHistoricoPadrao();
    setFiltrosHistorico(padrao);
    await carregarHistoricosConvivente(conviventeId, padrao);
  };

  const restaurarFiltrosFluxoPadrao = async (conviventeId) => {
    const padrao = criarFiltrosFluxoPadrao();
    setFiltrosFluxo(padrao);
    await carregarHistoricoFluxo(conviventeId, padrao);
  };

  const carregarMaisHistoricosConvivente = async (conviventeId) => {
    const proximoDeslocamento = historicosConvivente.length;
    if (proximoDeslocamento >= totalHistoricoConvivente) return;

    await carregarHistoricosConvivente(
      conviventeId,
      { ...filtrosHistorico, deslocamento: proximoDeslocamento },
      { append: true },
    );
  };

  const carregarMaisHistoricoFluxo = async (conviventeId) => {
    if (!fluxoTemMais) return;

    await carregarHistoricoFluxo(
      conviventeId,
      { ...filtrosFluxo, deslocamento: historicoFluxo.length },
      { append: true },
    );
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

      if (historicoEditando) {
        setHistoricosConvivente((prev) => prev.map((item) => (
          item.id === historicoSalvo.id ? historicoSalvo : item
        )));
      } else {
        await carregarHistoricosConvivente(editandoId, {
          ...filtrosHistorico,
          deslocamento: 0,
        });
      }

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
      setHistoricosConvivente((prev) => prev.filter((item) => item.id !== registro.id));
      setTotalHistoricoConvivente((prev) => Math.max(prev - 1, 0));
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
    aplicarFiltrosFluxo,
    aplicarFiltrosHistorico,
    aplicarFiltrosOcorrencias,
    cancelarEdicaoHistoricoConvivente,
    carregarHistoricoFluxo,
    carregarHistoricosConvivente,
    carregarMaisHistoricoFluxo,
    carregarMaisHistoricosConvivente,
    carregarMaisOcorrenciasConvivente,
    carregarOcorrencias,
    carregandoMaisFluxo,
    carregandoMaisHistorico,
    carregandoMaisOcorrencias,
    excluirHistoricoConvivente,
    filtrosFluxo,
    filtrosHistorico,
    filtrosOcorrencias,
    fluxoCarregadoPara,
    fluxoTemMais,
    ocorrenciasTemMais,
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
    restaurarFiltrosFluxoPadrao,
    restaurarFiltrosHistoricoPadrao,
    restaurarFiltrosOcorrenciasPadrao,
    salvandoHistoricoConvivente,
    setFiltrosFluxo,
    setFiltrosHistorico,
    setFiltrosOcorrencias,
    setFormHistoricoConvivente,
    totalHistoricoConvivente,
    totalOcorrenciasConvivente,
  };
}
