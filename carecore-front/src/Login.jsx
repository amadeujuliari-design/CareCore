import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from './services/api';
import { useAuth } from './context/AuthContext';
import logoCarecore from './assets/logo.png';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  // =========================================================
  // LIMPA SESSÕES INVÁLIDAS ANTIGAS
  // =========================================================

  useEffect(() => {
    try {
      const token = localStorage.getItem('token');

      if (!token) return;

      const partesToken = token.split('.');

      if (partesToken.length !== 3) {
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
        return;
      }

      const payload = JSON.parse(
        atob(partesToken[1])
      );

      const exp = payload.exp;

      if (!exp) return;

      const agora = Date.now() / 1000;

      if (agora > exp) {
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
      }
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
    }
  }, []);

  // =========================================================
  // VALIDAÇÃO EMAIL
  // =========================================================

  const validarEmail = (emailTeste) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return regex.test(emailTeste);
  };

  // =========================================================
  // ERROS BACKEND
  // =========================================================

  const obterMensagemErro = (error) => {
    const data = error?.response?.data;

    if (!data) {
      return 'Não foi possível se conectar ao servidor.';
    }

    if (typeof data.detail === 'string') {
      return data.detail;
    }

    if (
      Array.isArray(data.erros) &&
      data.erros.length > 0
    ) {
      return data.erros[0]?.mensagem || 'Erro de validação.';
    }

    if (
      Array.isArray(data.detail) &&
      data.detail.length > 0
    ) {
      return data.detail[0]?.msg || 'Erro de validação.';
    }

    return 'Falha ao realizar login.';
  };

  // =========================================================
  // LOGIN
  // =========================================================

  const handleLogin = async (e) => {
    e.preventDefault();

    setErro('');

    const emailNormalizado = email
      .trim()
      .toLowerCase();

    if (!emailNormalizado || !senha) {
      setErro('Preencha e-mail e senha.');
      return;
    }

    if (!validarEmail(emailNormalizado)) {
      setErro('Digite um e-mail válido.');
      return;
    }

    try {
      setLoading(true);

      const response = await api.post(
        '/api/login',
        {
          email: emailNormalizado,
          senha,
        }
      );

      const data = response.data;

      if (!data?.access_token || !data?.usuario) {
        throw new Error('Resposta de autenticação inválida.');
      }

      // =====================================================
      // SALVA SESSÃO GLOBAL
      // =====================================================

      login({
        token: data.access_token,
        usuario: data.usuario,
      });

      // =====================================================
      // REDIRECIONA
      // =====================================================

      navigate('/dashboard');

    } catch (error) {

      // Limpa sessão quebrada
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');

      setErro(
        obterMensagemErro(error)
      );

    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">

      {/* =================================================== */}
      {/* LOGO */}
      {/* =================================================== */}

      <div className="sm:mx-auto sm:w-full sm:max-w-md">

        <img
          className="mx-auto h-24 w-auto object-contain"
          src={logoCarecore}
          alt="CARECORE+"
        />

        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          CARECORE+
        </h2>

        <p className="mt-2 text-center text-sm text-gray-600">
          Plataforma institucional de gestão socioassistencial
        </p>

      </div>

      {/* =================================================== */}
      {/* CARD */}
      {/* =================================================== */}

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">

        <div className="bg-white py-8 px-4 shadow-xl border border-gray-100 sm:rounded-xl sm:px-10">

          {/* =============================================== */}
          {/* ALERTA */}
          {/* =============================================== */}

          {erro && (
            <div className="mb-5 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
              {erro}
            </div>
          )}

          {/* =============================================== */}
          {/* FORM */}
          {/* =============================================== */}

          <form
            className="space-y-6"
            onSubmit={handleLogin}
          >

            {/* =========================================== */}
            {/* EMAIL */}
            {/* =========================================== */}

            <div>

              <label className="block text-sm font-medium text-gray-700">
                E-mail
              </label>

              <div className="mt-1">

                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand focus:border-brand sm:text-sm"
                  placeholder="usuario@instituicao.org"
                />

              </div>

            </div>

            {/* =========================================== */}
            {/* SENHA */}
            {/* =========================================== */}

            <div>

              <label className="block text-sm font-medium text-gray-700">
                Senha
              </label>

              <div className="mt-1">

                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={senha}
                  onChange={(e) =>
                    setSenha(e.target.value)
                  }
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand focus:border-brand sm:text-sm"
                  placeholder="Digite sua senha"
                />

              </div>

            </div>

            {/* =========================================== */}
            {/* BOTÃO */}
            {/* =========================================== */}

            <div>

              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-brand hover:bg-brandDark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >

                {loading
                  ? 'Entrando no sistema...'
                  : 'Entrar'}
              </button>

            </div>

          </form>

          {/* =============================================== */}
          {/* FOOTER */}
          {/* =============================================== */}

          <div className="mt-6">

            <div className="relative">

              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>

              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  Primeiro acesso institucional
                </span>
              </div>

            </div>

            <div className="mt-6">

              <Link
                to="/cadastro"
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Criar instituição
              </Link>

            </div>

          </div>

        </div>

        {/* ================================================= */}
        {/* RODAPÉ */}
        {/* ================================================= */}

        <div className="mt-6 text-center">

          <p className="text-xs text-gray-400">
            CARECORE+ © Plataforma institucional de acolhimento e gestão operacional
          </p>

        </div>

      </div>

    </div>
  );
}