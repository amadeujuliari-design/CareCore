import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { buscarConfigOperacional } from '../services/configOperacionalService';
import { montarConfigOperacionalPadrao } from '../config/configOperacionalDefaults';

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
    if (!token) {
      setConfig(montarConfigOperacionalPadrao());
      setCarregando(false);
      setErro('');
      return;
    }

    setCarregando(true);
    setErro('');
    try {
      const dados = await buscarConfigOperacional();
      setConfig(dados);
    } catch (error) {
      setConfig(montarConfigOperacionalPadrao());
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
