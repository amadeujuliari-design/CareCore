import { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import logoCarecore from './assets/logo.png';
import api from './services/api';

export default function Cadastro() {
  const navigate = useNavigate();

  const [etapa, setEtapa] = useState(1);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const [nomeFantasia, setNomeFantasia] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [telefone, setTelefone] = useState('');

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
    };
  }, [senha]);

  const senhaForte = Object.values(regrasSenha).every(Boolean);

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

  const validarEmail = (emailTeste) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(emailTeste);
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

  const handleProximaEtapa = (e) => {
    e.preventDefault();

    if (!nomeFantasia.trim() || !telefone.trim()) {
      setErro('Preencha o nome da instituição e o telefone.');
      return;
    }

    setErro('');
    setEtapa(2);
  };

  const handleFinalizarCadastro = async (e) => {
    e.preventDefault();

    if (!nomeUsuario.trim() || !email.trim() || !senha) {
      setErro('Preencha todos os dados do administrador.');
      return;
    }

    if (!validarEmail(email.trim())) {
      setErro('Por favor, digite um e-mail válido.');
      return;
    }

    if (!senhaForte) {
      setErro('A senha ainda não atende aos critérios mínimos de segurança.');
      return;
    }

    setLoading(true);
    setErro('');

    try {
      await api.post('/api/onboarding', {
        instituicao: {
          nome_fantasia: nomeFantasia.trim(),
          cnpj: cnpj.trim(),
          telefone: telefone.trim(),
        },
        usuario_master: {
          nome: nomeUsuario.trim(),
          email: email.trim().toLowerCase(),
          senha,
          perfil_acesso: 'Gestor',
        },
      });

      alert('Cadastro realizado com sucesso! Faça login para começar.');
      navigate('/');
    } catch (error) {
      setErro(obterMensagemErroServidor(error));
    } finally {
      setLoading(false);
    }
  };

  const ItemRegraSenha = ({ valido, texto }) => (
    <li className={`flex items-center gap-2 text-xs ${valido ? 'text-green-700' : 'text-gray-500'}`}>
      <span
        className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
          valido ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
        }`}
      >
        {valido ? '✓' : '•'}
      </span>
      {texto}
    </li>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <img className="mx-auto h-20 w-auto object-contain" src={logoCarecore} alt="CARECORE+" />

        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Crie a conta do seu Abrigo
        </h2>

        <p className="mt-2 text-center text-sm text-gray-600">
          {etapa === 1 ? 'Passo 1: Dados da Instituição' : 'Passo 2: Dados do Administrador'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
          {erro && (
            <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center font-medium">
              {erro}
            </div>
          )}

          {etapa === 1 ? (
            <form onSubmit={handleProximaEtapa} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Nome do Abrigo / Instituição *
                </label>

                <div className="mt-1">
                  <input
                    type="text"
                    required
                    value={nomeFantasia}
                    onChange={(e) => setNomeFantasia(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand focus:border-brand sm:text-sm"
                    placeholder="Ex: Casa Nova Esperança"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  CNPJ (Opcional)
                </label>

                <div className="mt-1">
                  <input
                    type="text"
                    value={cnpj}
                    onChange={(e) => setCnpj(formatarCNPJ(e.target.value))}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand focus:border-brand sm:text-sm"
                    placeholder="00.000.000/0000-00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Telefone de Contato *
                </label>

                <div className="mt-1">
                  <input
                    type="text"
                    required
                    value={telefone}
                    onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand focus:border-brand sm:text-sm"
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand hover:bg-brandDark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand transition-colors"
              >
                Próximo Passo &rarr;
              </button>
            </form>
          ) : (
            <form onSubmit={handleFinalizarCadastro} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Seu Nome Completo *
                </label>

                <div className="mt-1">
                  <input
                    type="text"
                    required
                    value={nomeUsuario}
                    onChange={(e) => setNomeUsuario(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand focus:border-brand sm:text-sm"
                    placeholder="Ex: João Diretor"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  E-mail (Seu login) *
                </label>

                <div className="mt-1">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand focus:border-brand sm:text-sm"
                    placeholder="diretoria@abrigo.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Crie uma Senha *
                </label>

                <div className="mt-1">
                  <input
                    type="password"
                    required
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    className={`appearance-none block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-brand focus:border-brand sm:text-sm ${
                      senha && !senhaForte ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Mínimo 8 caracteres"
                  />
                </div>

                <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <p className="mb-2 text-xs font-semibold text-gray-700">
                    A senha deve conter:
                  </p>

                  <ul className="grid grid-cols-1 gap-1">
                    <ItemRegraSenha valido={regrasSenha.minimo} texto="mínimo 8 caracteres" />
                    <ItemRegraSenha valido={regrasSenha.maiuscula} texto="1 letra maiúscula" />
                    <ItemRegraSenha valido={regrasSenha.minuscula} texto="1 letra minúscula" />
                    <ItemRegraSenha valido={regrasSenha.numero} texto="1 número" />
                    <ItemRegraSenha valido={regrasSenha.especial} texto="1 caractere especial: @$!%*?&_-" />
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
                  className="w-1/3 flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                >
                  Voltar
                </button>

                <button
                  type="submit"
                  disabled={loading || !senhaForte}
                  className="w-2/3 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Criando Conta...' : 'Finalizar Cadastro'}
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
                <span className="px-2 bg-white text-gray-500">
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