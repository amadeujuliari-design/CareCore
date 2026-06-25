import { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import logoCarecore from './assets/logo.PNG';
import api from './services/api';
import { consultarCep } from './services/cepService';
import { formatarCEP, limparMascara } from './utils/usuariosUtils';
import CampoSenha from './components/CampoSenha';

function ItemRegraSenha({ valido, texto }) {
  return (
    <li className={`flex items-center gap-2 text-xs ${valido ? 'text-green-700' : 'text-gray-500'}`}>
      <span className="min-w-6 text-[10px] font-bold">
        {valido ? 'OK' : '-'}
      </span>
      {texto}
    </li>
  );
}

export default function Cadastro() {
  const navigate = useNavigate();

  const [etapa, setEtapa] = useState(1);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [loading, setLoading] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [errosCampo, setErrosCampo] = useState({});

  const [nomeFantasia, setNomeFantasia] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [telefone, setTelefone] = useState('');
  const [emailOrganizacao, setEmailOrganizacao] = useState('');
  const [cepOrganizacao, setCepOrganizacao] = useState('');
  const [logradouroOrganizacao, setLogradouroOrganizacao] = useState('');
  const [numeroOrganizacao, setNumeroOrganizacao] = useState('');
  const [complementoOrganizacao, setComplementoOrganizacao] = useState('');
  const [bairroOrganizacao, setBairroOrganizacao] = useState('');
  const [cidadeOrganizacao, setCidadeOrganizacao] = useState('');
  const [ufOrganizacao, setUfOrganizacao] = useState('');
  const [possuiVariosProjetos, setPossuiVariosProjetos] = useState(false);
  const [nomeProjeto, setNomeProjeto] = useState('');
  const [cnpjProjeto, setCnpjProjeto] = useState('');
  const [telefoneProjeto, setTelefoneProjeto] = useState('');

  const [nomeUsuario, setNomeUsuario] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  const regrasSenha = useMemo(() => {
    return {
      minimo: senha.length >= 8,
      maiuscula: /[A-Z]/.test(senha),
      minuscula: /[a-z]/.test(senha),
      numero: /\d/.test(senha),
      especial: /[@$!%*?&_\-#]/.test(senha),
      tamanhoMaximo: new Blob([senha]).size <= 72,
    };
  }, [senha]);

  const senhaForte = Object.values(regrasSenha).every(Boolean);
  const inputClassName = 'appearance-none block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100';
  const inputErroClassName = 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-100';
  const labelClassName = 'block text-sm font-bold text-slate-700';

  const classeInput = (campo) => `${inputClassName} ${errosCampo[campo] ? inputErroClassName : ''}`;
  const mensagemCampo = (campo) => (
    errosCampo[campo] ? <p className="mt-1 text-xs font-bold text-red-600">{errosCampo[campo]}</p> : null
  );

  const limparErroCampo = (campo) => {
    setErrosCampo((prev) => ({ ...prev, [campo]: '' }));
  };

  const formatarCNPJ = (valor) => {
    let v = valor.replace(/\D/g, '');
    v = v.replace(/^(\d{2})(\d)/, '$1.$2');
    v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
    v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
    v = v.replace(/(\d{4})(\d)/, '$1-$2');
    return v.substring(0, 18);
  };

  const formatarTelefone = (valor) => {
    let v = valor.replace(/\D/g, '');

    if (v.length <= 10) {
      v = v.replace(/^(\d{2})(\d)/g, '($1) $2');
      v = v.replace(/(\d{4})(\d)/, '$1-$2');
    } else {
      v = v.replace(/^(\d{2})(\d)/g, '($1) $2');
      v = v.replace(/(\d{5})(\d)/, '$1-$2');
    }

    return v.substring(0, 15);
  };

  const cnpjValido = (valor) => {
    const cnpjLimpo = limparMascara(valor);

    if (!cnpjLimpo) return true;
    if (cnpjLimpo.length !== 14) return false;
    if (/^(\d)\1{13}$/.test(cnpjLimpo)) return false;

    const calcularDigito = (base) => {
      const pesos = base.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      const soma = base
        .split('')
        .reduce((total, digito, index) => total + Number(digito) * pesos[index], 0);
      const resto = soma % 11;

      return resto < 2 ? '0' : String(11 - resto);
    };

    const primeiroDigito = calcularDigito(cnpjLimpo.slice(0, 12));
    const segundoDigito = calcularDigito(cnpjLimpo.slice(0, 12) + primeiroDigito);

    return cnpjLimpo.endsWith(primeiroDigito + segundoDigito);
  };

  const telefoneValido = (valor) => {
    const telefoneLimpo = limparMascara(valor);

    return telefoneLimpo.length === 10 || telefoneLimpo.length === 11;
  };

  const cepValido = (valor) => {
    const cepLimpo = limparMascara(valor);

    return !cepLimpo || cepLimpo.length === 8;
  };

  const validarEmail = (emailTeste) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(emailTeste);
  };

  const buscarCepOrganizacao = async (cepBuscado) => {
    const cepLimpo = limparMascara(cepBuscado);

    if (cepLimpo.length !== 8) {
      return;
    }

    setBuscandoCep(true);
    try {
      const endereco = await consultarCep(cepLimpo);

      if (!endereco) {
        setErro('CEP não encontrado.');
        setErrosCampo((prev) => ({ ...prev, cepOrganizacao: 'CEP não encontrado.' }));
        return;
      }

      setLogradouroOrganizacao(endereco.logradouro || '');
      setBairroOrganizacao(endereco.bairro || '');
      setCidadeOrganizacao(endereco.cidade || '');
      setUfOrganizacao(endereco.uf || '');
      limparErroCampo('cepOrganizacao');
      setErro('');
    } catch {
      setErro('Não foi possível buscar o CEP agora. Preencha o endereço manualmente.');
      setErrosCampo((prev) => ({ ...prev, cepOrganizacao: 'Não foi possível buscar o CEP agora.' }));
    } finally {
      setBuscandoCep(false);
    }
  };

  const obterMensagemErroServidor = (error) => {
    const data = error?.response?.data;

    if (!data) {
      return 'Erro ao se conectar com o servidor. Verifique se o Python está rodando.';
    }

    if (typeof data.detail === 'string') {
      return data.detail;
    }

    if (Array.isArray(data.detail) && data.detail.length > 0) {
      return data.detail[0]?.msg || 'Erro de validação nos dados enviados.';
    }

    if (Array.isArray(data.erros) && data.erros.length > 0) {
      return data.erros[0]?.mensagem || 'Erro de validação nos dados enviados.';
    }

    return 'Não foi possível concluir o cadastro. Verifique os dados informados.';
  };

  const validarCampoEtapaOrganizacao = (campo, valorAtual) => {
    const valor = String(valorAtual || '').trim();
    let mensagem = '';

    if (campo === 'nomeFantasia' && !valor) {
      mensagem = 'Informe o nome da organização.';
    }

    if (campo === 'telefone' && (!valor || !telefoneValido(valor))) {
      mensagem = 'Telefone inválido. Use DDD + número.';
    }

    if (campo === 'cnpj' && valor && !cnpjValido(valor)) {
      mensagem = 'CNPJ inválido ou incompleto.';
    }

    if (campo === 'emailOrganizacao' && valor && !validarEmail(valor)) {
      mensagem = 'E-mail institucional inválido.';
    }

    if (campo === 'cepOrganizacao' && valor && !cepValido(valor)) {
      mensagem = 'CEP incompleto.';
    }

    if (campo === 'ufOrganizacao' && valor && valor.length !== 2) {
      mensagem = 'UF deve ter 2 letras.';
    }

    if (campo === 'nomeProjeto' && !valor) {
      mensagem = 'Informe o nome do primeiro projeto.';
    }

    if (campo === 'cnpjProjeto' && valor && !cnpjValido(valor)) {
      mensagem = 'CNPJ do projeto inválido ou incompleto.';
    }

    if (campo === 'telefoneProjeto' && valor && !telefoneValido(valor)) {
      mensagem = 'Telefone do projeto inválido. Use DDD + número.';
    }

    setErrosCampo((prev) => ({ ...prev, [campo]: mensagem }));
    return !mensagem;
  };

  const validarCampoAdministrador = (campo, valorAtual) => {
    const valor = String(valorAtual || '').trim();
    let mensagem = '';

    if (campo === 'nomeUsuario' && !valor) {
      mensagem = 'Informe o nome completo do usuário global.';
    }

    if (campo === 'email' && (!valor || !validarEmail(valor))) {
      mensagem = 'E-mail de login inválido.';
    }

    if (campo === 'senha' && !senhaForte) {
      mensagem = 'A senha ainda não atende aos critérios mínimos.';
    }

    setErrosCampo((prev) => ({ ...prev, [campo]: mensagem }));
    return !mensagem;
  };

  const handleProximaEtapa = (e) => {
    e.preventDefault();

    const camposValidos = [
      validarCampoEtapaOrganizacao('nomeFantasia', nomeFantasia),
      validarCampoEtapaOrganizacao('telefone', telefone),
      validarCampoEtapaOrganizacao('cnpj', cnpj),
      validarCampoEtapaOrganizacao('emailOrganizacao', emailOrganizacao),
      validarCampoEtapaOrganizacao('cepOrganizacao', cepOrganizacao),
      validarCampoEtapaOrganizacao('ufOrganizacao', ufOrganizacao),
      validarCampoEtapaOrganizacao('nomeProjeto', nomeProjeto),
      validarCampoEtapaOrganizacao('cnpjProjeto', cnpjProjeto),
      validarCampoEtapaOrganizacao('telefoneProjeto', telefoneProjeto),
    ].every(Boolean);

    if (!camposValidos) {
      setErro('Corrija os campos destacados antes de avançar.');
      return;
    }

    setErro('');
    setEtapa(2);
  };

  const handleFinalizarCadastro = async (e) => {
    e.preventDefault();

    const camposValidos = [
      validarCampoAdministrador('nomeUsuario', nomeUsuario),
      validarCampoAdministrador('email', email),
      validarCampoAdministrador('senha', senha),
    ].every(Boolean);

    if (!camposValidos) {
      setErro('Corrija os campos destacados antes de finalizar.');
      return;
    }

    setLoading(true);
    setErro('');
    setSucesso('');

    try {
      await api.post('/api/onboarding', {
        projeto_unico: !possuiVariosProjetos,
        organizacao: {
          nome: nomeFantasia.trim(),
          cnpj: cnpj.trim(),
          telefone: telefone.trim(),
          email: emailOrganizacao.trim(),
          cep: cepOrganizacao.trim(),
          logradouro: logradouroOrganizacao.trim(),
          numero: numeroOrganizacao.trim(),
          complemento: complementoOrganizacao.trim(),
          bairro: bairroOrganizacao.trim(),
          cidade: cidadeOrganizacao.trim(),
          uf: ufOrganizacao.trim().toUpperCase(),
        },
        projeto: {
          nome_fantasia: nomeProjeto.trim(),
          cnpj: cnpjProjeto.trim() || cnpj.trim(),
          telefone: telefoneProjeto.trim() || telefone.trim(),
          email: emailOrganizacao.trim(),
          cep: cepOrganizacao.trim(),
          logradouro: logradouroOrganizacao.trim(),
          numero: numeroOrganizacao.trim(),
          complemento: complementoOrganizacao.trim(),
          bairro: bairroOrganizacao.trim(),
          cidade: cidadeOrganizacao.trim(),
          uf: ufOrganizacao.trim().toUpperCase(),
          tipo_projeto: possuiVariosProjetos ? 'Projeto' : 'Projeto principal',
          projeto_unico: !possuiVariosProjetos,
        },
        usuario_master: {
          nome: nomeUsuario.trim(),
          email: email.trim().toLowerCase(),
          senha,
          perfil_acesso: 'Gestor',
        },
      });

      setSucesso('Cadastro realizado com sucesso. Redirecionando para o login...');
      window.setTimeout(() => navigate('/'), 900);
    } catch (error) {
      setErro(obterMensagemErroServidor(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen overflow-y-auto bg-gradient-to-br from-blue-600 via-violet-600 to-pink-500 px-4 py-10 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        <img className="mx-auto h-20 w-auto object-contain drop-shadow-sm" src={logoCarecore} alt="CARECORE+" />

        <h2 className="mt-6 text-center text-3xl font-black tracking-tight text-white">
          Crie a conta do seu Abrigo
        </h2>

        <p className="mt-2 text-center text-sm font-semibold text-blue-50">
          {etapa === 1 ? 'Passo 1: Organização e Projeto' : 'Passo 2: Usuário Global'}
        </p>

        <div className="mx-auto mt-5 grid max-w-xs grid-cols-2 gap-2 rounded-full bg-white/15 p-1 text-xs font-bold text-white shadow-inner backdrop-blur">
          <span className={`rounded-full px-3 py-2 text-center ${etapa === 1 ? 'bg-white text-violet-700 shadow' : 'text-white/80'}`}>
            Organização
          </span>
          <span className={`rounded-full px-3 py-2 text-center ${etapa === 2 ? 'bg-white text-violet-700 shadow' : 'text-white/80'}`}>
            Administrador
          </span>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="bg-white/95 py-8 px-4 shadow-2xl sm:rounded-[2rem] sm:px-10 border border-white/80 backdrop-blur">
          {erro && (
            <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center font-medium">
              {erro}
            </div>
          )}
          {sucesso && (
            <div className="mb-4 bg-green-50 text-green-700 p-3 rounded-lg text-sm text-center font-medium">
              {sucesso}
            </div>
          )}

          {etapa === 1 ? (
            <form onSubmit={handleProximaEtapa} className="space-y-6">
              <div>
                <label className={labelClassName}>
                  Nome da Organização *
                </label>

                <div className="mt-1">
                  <input
                    type="text"
                    required
                    value={nomeFantasia}
                    onChange={(e) => {
                      setNomeFantasia(e.target.value);
                      limparErroCampo('nomeFantasia');
                    }}
                    onBlur={() => validarCampoEtapaOrganizacao('nomeFantasia', nomeFantasia)}
                    className={classeInput('nomeFantasia')}
                    placeholder="Ex: Associação Nova Esperança"
                  />
                  {mensagemCampo('nomeFantasia')}
                </div>
              </div>

              <div>
                <label className={labelClassName}>
                  CNPJ principal (Opcional)
                </label>

                <div className="mt-1">
                  <input
                    type="text"
                    value={cnpj}
                    onChange={(e) => {
                      setCnpj(formatarCNPJ(e.target.value));
                      limparErroCampo('cnpj');
                    }}
                    onBlur={() => validarCampoEtapaOrganizacao('cnpj', cnpj)}
                    className={classeInput('cnpj')}
                    placeholder="00.000.000/0000-00"
                  />
                  {mensagemCampo('cnpj')}
                </div>
              </div>

              <div>
                <label className={labelClassName}>
                  Telefone da Organização *
                </label>

                <div className="mt-1">
                  <input
                    type="text"
                    required
                    value={telefone}
                    onChange={(e) => {
                      setTelefone(formatarTelefone(e.target.value));
                      limparErroCampo('telefone');
                    }}
                    onBlur={() => validarCampoEtapaOrganizacao('telefone', telefone)}
                    className={classeInput('telefone')}
                    placeholder="(11) 99999-9999"
                  />
                  {mensagemCampo('telefone')}
                </div>
              </div>

              <div>
                <label className={labelClassName}>
                  E-mail institucional
                </label>
                <div className="mt-1">
                  <input
                    type="email"
                    value={emailOrganizacao}
                    onChange={(e) => {
                      setEmailOrganizacao(e.target.value);
                      limparErroCampo('emailOrganizacao');
                    }}
                    onBlur={() => validarCampoEtapaOrganizacao('emailOrganizacao', emailOrganizacao)}
                    className={classeInput('emailOrganizacao')}
                    placeholder="contato@organizacao.org"
                  />
                  {mensagemCampo('emailOrganizacao')}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-black text-slate-800">Endereço para contratos, boletos e correspondências</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Informe o CEP para preencher automaticamente rua, bairro, cidade e UF.
                </p>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <input
                      value={cepOrganizacao}
                      onChange={(e) => {
                        const cepFormatado = formatarCEP(e.target.value);
                        setCepOrganizacao(cepFormatado);
                        limparErroCampo('cepOrganizacao');

                        if (limparMascara(cepFormatado).length === 8) {
                          buscarCepOrganizacao(cepFormatado);
                        }
                      }}
                      onBlur={() => validarCampoEtapaOrganizacao('cepOrganizacao', cepOrganizacao)}
                      className={classeInput('cepOrganizacao')}
                      placeholder="CEP"
                    />
                    {buscandoCep ? (
                      <p className="mt-1 text-xs font-bold text-violet-600">Buscando endereço...</p>
                    ) : null}
                    {mensagemCampo('cepOrganizacao')}
                  </div>
                  <input value={logradouroOrganizacao} onChange={(e) => setLogradouroOrganizacao(e.target.value)} className={inputClassName} placeholder="Logradouro" />
                  <input value={numeroOrganizacao} onChange={(e) => setNumeroOrganizacao(e.target.value)} className={inputClassName} placeholder="Número" />
                  <input value={complementoOrganizacao} onChange={(e) => setComplementoOrganizacao(e.target.value)} className={inputClassName} placeholder="Complemento" />
                  <input value={bairroOrganizacao} onChange={(e) => setBairroOrganizacao(e.target.value)} className={inputClassName} placeholder="Bairro" />
                  <input value={cidadeOrganizacao} onChange={(e) => setCidadeOrganizacao(e.target.value)} className={inputClassName} placeholder="Cidade" />
                  <div>
                    <input
                      value={ufOrganizacao}
                      onChange={(e) => {
                        setUfOrganizacao(e.target.value.toUpperCase().slice(0, 2));
                        limparErroCampo('ufOrganizacao');
                      }}
                      onBlur={() => validarCampoEtapaOrganizacao('ufOrganizacao', ufOrganizacao)}
                      className={classeInput('ufOrganizacao')}
                      placeholder="UF"
                      maxLength={2}
                    />
                    {mensagemCampo('ufOrganizacao')}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
                <p className="text-sm font-black text-violet-900">Essa organização terá vários projetos/unidades?</p>
                <p className="mt-1 text-xs font-semibold text-violet-700">
                  A organização será apenas a estrutura mãe. O atendimento operacional sempre acontece em um projeto/unidade.
                </p>
                <div className="mt-3 grid grid-cols-1 gap-2">
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-white p-3 text-sm font-bold text-slate-700">
                    <input
                      type="radio"
                      checked={!possuiVariosProjetos}
                      onChange={() => setPossuiVariosProjetos(false)}
                    />
                    Não, começará com apenas um projeto
                  </label>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-white p-3 text-sm font-bold text-slate-700">
                    <input
                      type="radio"
                      checked={possuiVariosProjetos}
                      onChange={() => setPossuiVariosProjetos(true)}
                    />
                    Sim, terá vários projetos/unidades
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-sm font-black text-blue-900">Primeiro projeto/unidade operacional *</p>
                <p className="mt-1 text-xs font-semibold text-blue-700">
                  Este será o projeto onde usuários, conviventes, rotina, avisos e relatórios serão cadastrados.
                </p>
                <div className="mt-4 space-y-3">
                  <input
                    type="text"
                    required
                    value={nomeProjeto}
                    onChange={(e) => {
                      setNomeProjeto(e.target.value);
                      limparErroCampo('nomeProjeto');
                    }}
                    onBlur={() => validarCampoEtapaOrganizacao('nomeProjeto', nomeProjeto)}
                    className={classeInput('nomeProjeto')}
                    placeholder="Ex: Abrigo Masculino, Casa de Passagem, Projeto Acolhida"
                  />
                  {mensagemCampo('nomeProjeto')}
                  <input
                    type="text"
                    value={cnpjProjeto}
                    onChange={(e) => {
                      setCnpjProjeto(formatarCNPJ(e.target.value));
                      limparErroCampo('cnpjProjeto');
                    }}
                    onBlur={() => validarCampoEtapaOrganizacao('cnpjProjeto', cnpjProjeto)}
                    className={classeInput('cnpjProjeto')}
                    placeholder="CNPJ do projeto (opcional, pode repetir o principal)"
                  />
                  {mensagemCampo('cnpjProjeto')}
                  <input
                    type="text"
                    value={telefoneProjeto}
                    onChange={(e) => {
                      setTelefoneProjeto(formatarTelefone(e.target.value));
                      limparErroCampo('telefoneProjeto');
                    }}
                    onBlur={() => validarCampoEtapaOrganizacao('telefoneProjeto', telefoneProjeto)}
                    className={classeInput('telefoneProjeto')}
                    placeholder="Telefone do projeto (opcional)"
                  />
                  {mensagemCampo('telefoneProjeto')}
                </div>
              </div>

              <button
                type="submit"
                className="flex w-full justify-center rounded-2xl border border-transparent bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-slate-900/20 transition-colors hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-violet-100"
              >
                Próximo passo
              </button>
            </form>
          ) : (
            <form onSubmit={handleFinalizarCadastro} className="space-y-6">
              <div>
                <label className={labelClassName}>
                  Seu Nome Completo *
                </label>

                <div className="mt-1">
                  <input
                    type="text"
                    required
                    value={nomeUsuario}
                    onChange={(e) => {
                      setNomeUsuario(e.target.value);
                      limparErroCampo('nomeUsuario');
                    }}
                    onBlur={() => validarCampoAdministrador('nomeUsuario', nomeUsuario)}
                    className={classeInput('nomeUsuario')}
                    placeholder="Ex: João Diretor"
                  />
                  {mensagemCampo('nomeUsuario')}
                </div>
              </div>

              <div>
                <label className={labelClassName}>
                  E-mail (Seu login) *
                </label>

                <div className="mt-1">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      limparErroCampo('email');
                    }}
                    onBlur={() => validarCampoAdministrador('email', email)}
                    className={classeInput('email')}
                    placeholder="diretoria@abrigo.com"
                  />
                  {mensagemCampo('email')}
                </div>
              </div>

              <div>
                <label className={labelClassName}>
                  Crie uma Senha *
                </label>

                <div className="mt-1">
                  <CampoSenha
                    value={senha}
                    onChange={(e) => {
                      setSenha(e.target.value);
                      limparErroCampo('senha');
                    }}
                    onBlur={() => validarCampoAdministrador('senha', senha)}
                    className={`text-slate-900 transition focus:border-violet-400 ${
                      errosCampo.senha ? inputErroClassName : ''
                    } ${senha && !senhaForte ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}`}
                    placeholder="Mínimo 8 caracteres"
                    autoComplete="new-password"
                  />
                  {mensagemCampo('senha')}
                </div>

                <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <p className="mb-2 text-xs font-semibold text-gray-700">
                    A senha deve conter:
                  </p>

                  <ul className="grid grid-cols-1 gap-1">
                    <ItemRegraSenha valido={regrasSenha.minimo} texto="mínimo de 8 caracteres" />
                    <ItemRegraSenha valido={regrasSenha.maiuscula} texto="1 letra maiúscula" />
                    <ItemRegraSenha valido={regrasSenha.minuscula} texto="1 letra minúscula" />
                    <ItemRegraSenha valido={regrasSenha.numero} texto="1 número" />
                    <ItemRegraSenha valido={regrasSenha.especial} texto="1 caractere especial (@$!%*?&_-#)" />
                    <ItemRegraSenha valido={regrasSenha.tamanhoMaximo} texto="até 72 bytes" />
                  </ul>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setErro('');
                    setEtapa(1);
                  }}
                  className="flex w-1/3 justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none"
                >
                  Voltar
                </button>

                <button
                  type="submit"
                  disabled={loading || !senhaForte}
                  className="flex w-2/3 justify-center rounded-2xl border border-transparent bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-slate-900/20 transition-colors hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? 'Criando conta...' : 'Finalizar cadastro'}
                </button>
              </div>
            </form>
          )}

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>

              <div className="relative flex justify-center text-sm">
                <span className="bg-white/95 px-2 text-gray-500">
                  Já possui conta?
                </span>
              </div>
            </div>

            <div className="mt-6 text-center">
              <Link to="/" className="font-medium text-brand hover:text-brandDark">
                Voltar para a tela de Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}