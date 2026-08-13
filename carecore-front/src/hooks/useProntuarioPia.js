import { useMemo, useState } from 'react';

import {
  TEMAS_EVOLUCAO_PIA,
  agruparEvolucoesPiaPorRegistro,
  montarFormEdicaoPia,
  montarFormEvolucaoPia,
  montarFormPiaPrincipal,
  ordenarRegistrosPiaPrincipais,
} from '../utils/conviventesProntuarioUtils';
import {
  listarRegistrosPiaConvivente,
  salvarRegistroPiaConvivente,
  excluirRegistroPiaConvivente,
} from '../services/conviventesProntuarioService';

const MENSAGEM_NOVO_PIA = 'Este convivente já possui PIA registrado. Deseja abrir um novo PIA principal mesmo assim? Se cancelar, você continuará evoluindo o PIA existente.';

export function useProntuarioPia({ editandoId, setErro, setSucesso }) {
  const [registrosPia, setRegistrosPia] = useState([]);
  const [totalRegistrosPia, setTotalRegistrosPia] = useState(0);
  const [piaTemMais, setPiaTemMais] = useState(false);
  const [loadingPia, setLoadingPia] = useState(false);
  const [salvandoPia, setSalvandoPia] = useState(false);
  const [piaCarregadoPara, setPiaCarregadoPara] = useState(null);
  const [formPia, setFormPia] = useState(() => montarFormPiaPrincipal());
  const [alertaSubtituloPia, setAlertaSubtituloPia] = useState('');
  const [excluindoPiaId, setExcluindoPiaId] = useState(null);

  const registrosPiaPrincipais = useMemo(
    () => ordenarRegistrosPiaPrincipais(registrosPia),
    [registrosPia],
  );

  const evolucoesPorRegistroPia = useMemo(
    () => agruparEvolucoesPiaPorRegistro(registrosPia),
    [registrosPia],
  );

  const registroPiaMaisRecente = registrosPiaPrincipais[0] || null;
  const formularioPiaEdicao = Boolean(formPia.id);
  const formularioPiaEvolucao = Boolean(formPia.registro_pai_id);

  const resetarPia = () => {
    setRegistrosPia([]);
    setTotalRegistrosPia(0);
    setPiaTemMais(false);
    setPiaCarregadoPara(null);
    setFormPia(montarFormPiaPrincipal());
  };

  const carregarRegistrosPia = async (conviventeId, { append = false } = {}) => {
    if (!conviventeId) return;

    try {
      if (!append) {
        setLoadingPia(true);
      }
      const resposta = await listarRegistrosPiaConvivente(conviventeId, {
        limite: 100,
        deslocamento: append ? registrosPia.length : 0,
      });
      const registrosRecebidos = resposta.registros || [];
      const principalMaisRecente = ordenarRegistrosPiaPrincipais(
        append ? [...registrosPia, ...registrosRecebidos] : registrosRecebidos,
      )[0];

      setRegistrosPia((prev) => (append ? [...prev, ...registrosRecebidos] : registrosRecebidos));
      setTotalRegistrosPia(resposta.total || registrosRecebidos.length);
      setPiaTemMais(Boolean(resposta.has_more));
      if (!append) {
        setFormPia(principalMaisRecente ? montarFormEvolucaoPia(principalMaisRecente) : montarFormPiaPrincipal());
        setPiaCarregadoPara(conviventeId);
      }
    } catch (error) {
      console.error('Erro ao carregar PIA', error);
      setErro('Não foi possível carregar os registros do PIA.');
    } finally {
      setLoadingPia(false);
    }
  };

  const prepararNovoPiaPrincipal = () => {
    if (registrosPiaPrincipais.length > 0) {
      const confirmarNovo = window.confirm(MENSAGEM_NOVO_PIA);

      if (!confirmarNovo) {
        setFormPia(montarFormEvolucaoPia(registroPiaMaisRecente));
        return;
      }
    }

    setFormPia(montarFormPiaPrincipal());
  };

  const prepararEvolucaoPia = (registroPrincipal) => {
    setFormPia(montarFormEvolucaoPia(registroPrincipal));
  };

  const prepararEdicaoPia = (registro) => {
    if (!registro?.id) return;
    setFormPia(montarFormEdicaoPia(registro));
  };

  const cancelarEdicaoPia = () => {
    if (registroPiaMaisRecente) {
      setFormPia(montarFormEvolucaoPia(registroPiaMaisRecente));
      return;
    }
    setFormPia(montarFormPiaPrincipal());
  };

  const handleSalvarRegistroPia = async () => {
    if (!editandoId) {
      setErro('Salve o prontuário antes de registrar o PIA.');
      return;
    }

    if (formularioPiaEvolucao && !formPia.subtitulo.trim()) {
      setAlertaSubtituloPia(
        'Informe o subtítulo/tema da evolução para salvar. O texto que você já digitou foi mantido. Clique em OK, preencha o subtítulo e salve novamente.',
      );
      return;
    }

    if (!formularioPiaEvolucao && !formPia.titulo.trim()) {
      setErro('Informe o título do PIA principal.');
      return;
    }

    if (!formPia.descricao.trim()) {
      setErro('Informe a descrição para registrar no PIA.');
      return;
    }

    if (!formularioPiaEdicao && !formularioPiaEvolucao && registrosPiaPrincipais.length > 0) {
      const confirmarNovo = window.confirm(MENSAGEM_NOVO_PIA);

      if (!confirmarNovo) {
        setFormPia(montarFormEvolucaoPia(registroPiaMaisRecente));
        return;
      }
    }

    try {
      setSalvandoPia(true);
      const { id: registroId, ...campos } = formPia;
      const payload = {
        ...campos,
        tipo_registro: formularioPiaEvolucao ? 'Evolução' : formPia.tipo_registro,
        titulo: formularioPiaEvolucao ? 'Evolução' : formPia.titulo,
      };
      if (formularioPiaEdicao) {
        delete payload.registro_pai_id;
      }

      const registroSalvo = await salvarRegistroPiaConvivente(
        editandoId,
        payload,
        formularioPiaEdicao ? registroId : null,
      );

      setRegistrosPia((prev) => {
        if (formularioPiaEdicao) {
          return prev.map((item) => (item.id === registroSalvo.id ? { ...item, ...registroSalvo } : item));
        }
        return [registroSalvo, ...prev];
      });

      if (registroSalvo.registro_pai_id) {
        const registroPrincipal = registrosPiaPrincipais.find(
          (registro) => registro.id === registroSalvo.registro_pai_id,
        );
        setFormPia(
          montarFormEvolucaoPia(
            registroPrincipal || { id: registroSalvo.registro_pai_id, status: registroSalvo.status },
          ),
        );
      } else {
        setFormPia(montarFormEvolucaoPia(registroSalvo));
      }

      setSucesso(
        formularioPiaEdicao
          ? 'Registro do PIA atualizado com sucesso.'
          : 'Registro do PIA salvo com sucesso.',
      );
      setTimeout(() => setSucesso(''), 3000);
    } catch (error) {
      setErro(error.response?.data?.detail || 'Erro ao salvar registro do PIA.');
    } finally {
      setSalvandoPia(false);
    }
  };

  const fecharAlertaSubtituloPia = () => {
    setAlertaSubtituloPia('');
  };

  const handleExcluirEvolucaoPia = async (registro) => {
    if (!editandoId || !registro?.id || !registro?.registro_pai_id) {
      return;
    }

    const rotulo = registro.subtitulo || 'esta evolução';
    const confirmar = window.confirm(
      `Excluir a evolução "${rotulo}"? Esta ação não pode ser desfeita.`,
    );
    if (!confirmar) {
      return;
    }

    try {
      setExcluindoPiaId(registro.id);
      await excluirRegistroPiaConvivente(editandoId, registro.id);
      setRegistrosPia((prev) => prev.filter((item) => item.id !== registro.id && item.registro_pai_id !== registro.id));
      if (formPia.id === registro.id) {
        const registroPrincipal = registrosPiaPrincipais.find(
          (item) => item.id === registro.registro_pai_id,
        );
        setFormPia(montarFormEvolucaoPia(registroPrincipal || registroPiaMaisRecente));
      }
      setSucesso('Evolução do PIA excluída com sucesso.');
      setTimeout(() => setSucesso(''), 3000);
    } catch (error) {
      setErro(error.response?.data?.detail || 'Não foi possível excluir a evolução do PIA.');
    } finally {
      setExcluindoPiaId(null);
    }
  };

  return {
    evolucoesPorRegistroPia,
    formPia,
    formularioPiaEdicao,
    formularioPiaEvolucao,
    loadingPia,
    piaCarregadoPara,
    prepararEdicaoPia,
    cancelarEdicaoPia,
    prepararEvolucaoPia,
    prepararNovoPiaPrincipal,
    registroPiaMaisRecente,
    registrosPia,
    registrosPiaPrincipais,
    salvandoPia,
    setFormPia,
    temasEvolucaoPia: TEMAS_EVOLUCAO_PIA,
    carregarRegistrosPia,
    carregarMaisRegistrosPia: (conviventeId) => {
      if (!piaTemMais) return;
      return carregarRegistrosPia(conviventeId, { append: true });
    },
    piaTemMais,
    totalRegistrosPia,
    resetarPia,
    handleSalvarRegistroPia,
    handleExcluirEvolucaoPia,
    alertaSubtituloPia,
    fecharAlertaSubtituloPia,
    excluindoPiaId,
  };
}
