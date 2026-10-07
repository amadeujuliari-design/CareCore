import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { buscarConfigOperacional } from '../services/configOperacionalService';
import { aplicarPresetCasaPorto, aplicarPresetReencontro, montarConfigOperacionalPadrao } from '../config/configOperacionalDefaults';
import {
  obterUsuarioSessao,
  usuarioPodeAcessarModuloOperacional,
} from '../utils/rbacUtils';

const ConfigOperacionalContext = createContext({
  config: null,
  nomeProjeto: '',
  carregando: true,
  erro: '',
  recarregar: async () => {},
});

async function resolverNomeProjetoAtual() {
  const usuario = obterUsuarioSessao();
  let nome = usuario?.projeto_nome || '';
  const token = localStorage.getItem('@CareCore:token') || localStorage.getItem('token');
  if (!token) return nome;
  try {
    const { data } = await api.get('/api/organizacao/projeto-atual');
    const vivo = data?.nome_fantasia || data?.relatorio_nome_exibicao || '';
    if (String(vivo).trim()) nome = String(vivo).trim();
  } catch {
    // O nome da sessão cobre o caso sem rede.
  }
  return nome;
}

export function ConfigOperacionalProvider({ children }) {
  const { usuario, loading: carregandoAuth } = useAuth();
  const [config, setConfig] = useState(null);
  const [nomeProjeto, setNomeProjeto] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const geracao = useRef(0);
  const sessaoChave = usuario
    ? `${usuario.id || usuario.email || ''}|${usuario.instituicao_id || ''}|${usuario.projeto_nome || ''}`
    : '';

  const recarregar = useCallback(async () => {
    const geracaoAtual = geracao.current + 1;
    geracao.current = geracaoAtual;
    const aindaVale = () => geracaoAtual === geracao.current;
    const token = localStorage.getItem('@CareCore:token') || localStorage.getItem('token');
    const usuarioSessao = obterUsuarioSessao();
    const nome = await resolverNomeProjetoAtual();
    if (!aindaVale()) return;
    setNomeProjeto(nome);
    if (!token) {
      setConfig(aplicarPresetReencontro(aplicarPresetCasaPorto(montarConfigOperacionalPadrao(), nome), nome));
      setCarregando(false);
      setErro('');
      return;
    }

    if (!usuarioPodeAcessarModuloOperacional(usuarioSessao)) {
      setConfig(aplicarPresetReencontro(aplicarPresetCasaPorto(montarConfigOperacionalPadrao(), nome), nome));
      setCarregando(false);
      setErro('');
      return;
    }

    setCarregando(true);
    setErro('');
    try {
      const dados = await buscarConfigOperacional();
      if (!aindaVale()) return;
      setConfig(aplicarPresetReencontro(aplicarPresetCasaPorto(dados, nome), nome));
    } catch (error) {
      if (!aindaVale()) return;
      setConfig(aplicarPresetReencontro(aplicarPresetCasaPorto(montarConfigOperacionalPadrao(), nome), nome));
      setErro('Não foi possível carregar a configuração operacional do projeto.');
      console.error(error);
    } finally {
      if (aindaVale()) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (carregandoAuth) return;
    setConfig(null);
    recarregar();
  }, [carregandoAuth, recarregar, sessaoChave]);

  const valor = useMemo(
    () => ({ config, nomeProjeto, carregando, erro, recarregar, setConfig }),
    [config, nomeProjeto, carregando, erro, recarregar],
  );

  return (
    <ConfigOperacionalContext.Provider value={valor}>
      {children}
    </ConfigOperacionalContext.Provider>
  );
}

export function useConfigOperacional() {
  return useContext(ConfigOperacionalContext);
}
