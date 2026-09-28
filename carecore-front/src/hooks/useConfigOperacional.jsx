import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import api from '../services/api';
import { buscarConfigOperacional } from '../services/configOperacionalService';
import { aplicarPresetCasaPorto, montarConfigOperacionalPadrao } from '../config/configOperacionalDefaults';
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
  const [config, setConfig] = useState(null);
  const [nomeProjeto, setNomeProjeto] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const recarregar = useCallback(async () => {
    const token = localStorage.getItem('@CareCore:token') || localStorage.getItem('token');
    const usuario = obterUsuarioSessao();
    const nome = await resolverNomeProjetoAtual();
    setNomeProjeto(nome);
    if (!token) {
      setConfig(aplicarPresetCasaPorto(montarConfigOperacionalPadrao(), nome));
      setCarregando(false);
      setErro('');
      return;
    }

    if (!usuarioPodeAcessarModuloOperacional(usuario)) {
      setConfig(aplicarPresetCasaPorto(montarConfigOperacionalPadrao(), nome));
      setCarregando(false);
      setErro('');
      return;
    }

    setCarregando(true);
    setErro('');
    try {
      const dados = await buscarConfigOperacional();
      setConfig(aplicarPresetCasaPorto(dados, nome));
    } catch (error) {
      setConfig(aplicarPresetCasaPorto(montarConfigOperacionalPadrao(), nome));
      setErro('Não foi possível carregar a configuração operacional do projeto.');
      console.error(error);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

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
