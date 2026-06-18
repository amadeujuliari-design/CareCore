import { useMemo, useState } from 'react';

import {
  TEMAS_EVOLUCAO_PIA,
  agruparEvolucoesPiaPorRegistro,
  montarFormEvolucaoPia,
  montarFormPiaPrincipal,
  ordenarRegistrosPiaPrincipais,
} from '../utils/conviventesProntuarioUtils';
import {
  listarRegistrosPiaConvivente,
  salvarRegistroPiaConvivente,
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

  const registrosPiaPrincipais = useMemo(
    () => ordenarRegistrosPiaPrincipais(registrosPia),
    [registrosPia],
  );

  const evolucoesPorRegistroPia = useMemo(
    () => agruparEvolucoesPiaPorRegistro(registrosPia),
    [registrosPia],
  );

  const registroPiaMaisRecente = registrosPiaPrincipais[0] || null;
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

  const handleSalvarRegistroPia = async () => {
    if (!editandoId) {
      setErro('Salve o prontuário antes de registrar o PIA.');
      return;
    }

    if (formularioPiaEvolucao && !formPia.subtitulo.trim()) {
      setErro('Informe o subtítulo/tema da evolução do PIA.');
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

    if (!formularioPiaEvolucao && registrosPiaPrincipais.length > 0) {
      const confirmarNovo = window.confirm(MENSAGEM_NOVO_PIA);

      if (!confirmarNovo) {
        setFormPia(montarFormEvolucaoPia(registroPiaMaisRecente));
        return;
      }
    }

    try {
      setSalvandoPia(true);
      const payload = {
        ...formPia,
        tipo_registro: formularioPiaEvolucao ? 'Evolução' : 'PIA',
        titulo: formularioPiaEvolucao ? 'Evolução' : formPia.titulo,
      };
      const registroSalvo = await salvarRegistroPiaConvivente(editandoId, payload);
      setRegistrosPia(prev => [registroSalvo, ...prev]);

      if (registroSalvo.registro_pai_id) {
        const registroPrincipal = registrosPiaPrincipais.find(registro => registro.id === registroSalvo.registro_pai_id);
        setFormPia(montarFormEvolucaoPia(registroPrincipal || { id: registroSalvo.registro_pai_id, status: registroSalvo.status }));
      } else {
        setFormPia(montarFormEvolucaoPia(registroSalvo));
      }

      setSucesso('Registro do PIA salvo com sucesso.');
      setTimeout(() => setSucesso(''), 3000);
    } catch (error) {
      setErro(error.response?.data?.detail || 'Erro ao salvar registro do PIA.');
    } finally {
      setSalvandoPia(false);
    }
  };

  return {
    evolucoesPorRegistroPia,
    formPia,
    formularioPiaEvolucao,
    loadingPia,
    piaCarregadoPara,
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
  };
}
