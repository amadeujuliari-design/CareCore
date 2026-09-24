import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { buscarConfigOperacional } from '../services/configOperacionalService';
import { aplicarPresetCasaPorto, montarConfigOperacionalPadrao } from '../config/configOperacionalDefaults';
import {
  obterUsuarioSessao,
  usuarioPodeAcessarModuloOperacional,
} from '../utils/rbacUtils';

const ConfigOperacionalContext = createContext({
  config: null,
  carregando: true,
  erro: '',
  recarregar: async () => {},
});

export function ConfigOperacionalProvider({ children }) {
  const [config, setConfig] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const recarregar = useCallback(async () => {
    const token = localStorage.getItem('@CareCore:token') || localStorage.getItem('token');
    const usuario = obterUsuarioSessao();
    const nomeProjeto = usuario?.projeto_nome || '';
    if (!token) {
      setConfig(aplicarPresetCasaPorto(montarConfigOperacionalPadrao(), nomeProjeto));
      setCarregando(false);
      setErro('');
      return;
    }

    if (!usuarioPodeAcessarModuloOperacional(usuario)) {
      setConfig(aplicarPresetCasaPorto(montarConfigOperacionalPadrao(), nomeProjeto));
      setCarregando(false);
      setErro('');
      return;
    }

    setCarregando(true);
    setErro('');
    try {
      const dados = await buscarConfigOperacional();
      setConfig(aplicarPresetCasaPorto(dados, nomeProjeto));
    } catch (error) {
      setConfig(aplicarPresetCasaPorto(montarConfigOperacionalPadrao(), nomeProjeto));
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
    () => ({ config, carregando, erro, recarregar, setConfig }),
    [config, carregando, erro, recarregar],
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
