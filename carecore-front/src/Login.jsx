import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from './services/api';
import { useAuth } from './context/AuthContext';
import logoCarecore from './assets/logo.PNG';
import {
  criarOpcoesLoginPasskey,
  verificarLoginPasskey,
} from './services/passkeysService';
import {
  obterCredencialPasskey,
  passkeysDisponiveis,
} from './utils/passkeysUtils';
import { decodificarPayloadJwt } from './utils/jwtUtils';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingBiometria, setLoadingBiometria] = useState(false);

  // =========================================================
  // LIMPA SESSÕES INVÁLIDAS ANTIGAS
  // =========================================================

  useEffect(() => {
    try {
      const token = localStorage.getItem('token');

      if (!token) return;

      const payload = decodificarPayloadJwt(token);

      if (!payload) {
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
        return;
      }

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

  const handleLoginBiometria = async () => {
    setErro('');

    const emailNormalizado = email
      .trim()
      .toLowerCase();

    if (!validarEmail(emailNormalizado)) {
      setErro('Informe seu e-mail para entrar com biometria neste aparelho.');
      return;
    }

    try {
      setLoadingBiometria(true);

      const opcoes = await criarOpcoesLoginPasskey(emailNormalizado);
      const credential = await obterCredencialPasskey(opcoes.publicKey);
      const data = await verificarLoginPasskey({
        email: emailNormalizado,
        credential,
        challenge_token: opcoes.challenge_token,
      });

      if (!data?.access_token || !data?.usuario) {
        throw new Error('Resposta de autenticação inválida.');
      }

      login({
        token: data.access_token,
        usuario: data.usuario,
      });

      navigate('/dashboard');
    } catch (error) {
      setErro(
        error?.response?.data?.detail ||
        error?.message ||
        'Não foi possível entrar com biometria.'
      );
    } finally {
      setLoadingBiometria(false);
    }
  };

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="min-h-screen overflow-hidden bg-gradient-to-br from-sky-500 via-teal-500 to-amber-300 p-4">
      <div className="flex min-h-[calc(100vh-32px)] items-center justify-center rounded-[2rem] bg-slate-50/95 px-4 py-10 shadow-2xl backdrop-blur">
        <div className="grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white bg-white shadow-2xl lg:grid-cols-[1.05fr_0.95fr]">
          <section className="hidden bg-gradient-to-br from-[#12385b] via-[#1f9a92] to-[#d9c465] p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div>
              <div className="inline-flex rounded-3xl bg-white p-4 shadow-2xl shadow-black/20">
                <img
                  className="h-20 w-auto object-contain"
                  src={logoCarecore}
                  alt="CARECORE+"
                />
              </div>

              <div className="mt-12 max-w-lg">
                <p className="text-sm font-bold uppercase tracking-[0.22em] text-teal-50">
                  Tecnologia que cuida
                </p>

                <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight">
                  <span
                    style={{
                      WebkitTextStroke: '0.75px rgba(15, 23, 42, 0.78)',
                      textShadow: '0 3px 14px rgba(15, 23, 42, 0.42)',
                    }}
                  >
                    Gestão institucional para acolhimento, rotina e cuidado assistencial.
                  </span>
                </h1>

                <p
                  className="mt-5 text-base font-medium leading-relaxed text-white/90"
                  style={{
                    WebkitTextStroke: '0.35px rgba(15, 23, 42, 0.66)',
                    textShadow: '0 2px 10px rgba(15, 23, 42, 0.38)',
                  }}
                >
                  Centralize prontuários, acomodações, ocorrências, rotina diária, SISA e relatórios em uma plataforma segura para sua instituição.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <p
                  className="font-black"
                  style={{
                    WebkitTextStroke: '0.35px rgba(15, 23, 42, 0.68)',
                    textShadow: '0 2px 8px rgba(15, 23, 42, 0.34)',
                  }}
                >
                  LGPD
                </p>
                <p
                  className="mt-1 text-xs text-white/85"
                  style={{
                    WebkitTextStroke: '0.2px rgba(15, 23, 42, 0.56)',
                    textShadow: '0 1px 6px rgba(15, 23, 42, 0.30)',
                  }}
                >
                  Dados protegidos
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <p
                  className="font-black"
                  style={{
                    WebkitTextStroke: '0.35px rgba(15, 23, 42, 0.68)',
                    textShadow: '0 2px 8px rgba(15, 23, 42, 0.34)',
                  }}
                >
                  SISA
                </p>
                <p
                  className="mt-1 text-xs text-white/85"
                  style={{
                    WebkitTextStroke: '0.2px rgba(15, 23, 42, 0.56)',
                    textShadow: '0 1px 6px rgba(15, 23, 42, 0.30)',
                  }}
                >
                  Controle mensal
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <p
                  className="font-black"
                  style={{
                    WebkitTextStroke: '0.35px rgba(15, 23, 42, 0.68)',
                    textShadow: '0 2px 8px rgba(15, 23, 42, 0.34)',
                  }}
                >
                  RBAC
                </p>
                <p
                  className="mt-1 text-xs text-white/85"
                  style={{
                    WebkitTextStroke: '0.2px rgba(15, 23, 42, 0.56)',
                    textShadow: '0 1px 6px rgba(15, 23, 42, 0.30)',
                  }}
                >
                  Acesso por perfil
                </p>
              </div>
            </div>
          </section>

          <section className="px-5 py-8 sm:px-10 lg:px-12 lg:py-12">
            <div className="mx-auto w-full max-w-md">
              <div className="text-center lg:text-left">
                <img
                  className="mx-auto h-20 w-auto object-contain lg:mx-0 lg:hidden"
                  src={logoCarecore}
                  alt="CARECORE+"
                />

                <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-violet-600 lg:mt-0">
                  Acesso institucional
                </p>

                <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
                  Entrar no CARECORE+
                </h2>

                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  Plataforma institucional de gestão socioassistencial.
                </p>
              </div>

              {erro && (
                <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
                  {erro}
                </div>
              )}

              <form className="mt-8 space-y-5" onSubmit={handleLogin}>
                <div>
                  <label className="block text-sm font-bold text-slate-700">
                    E-mail
                  </label>

                  <div className="mt-2">
                    <input
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                      placeholder="usuario@instituicao.org"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700">
                    Senha
                  </label>

                  <div className="mt-2">
                    <input
                      type="password"
                      autoComplete="current-password"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      required
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      className="block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                      placeholder="Digite sua senha"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || loadingBiometria}
                  className="flex w-full justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-violet-700 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition-all hover:from-blue-700 hover:to-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? 'Entrando no sistema...' : 'Entrar'}
                </button>

                {passkeysDisponiveis() && (
                  <button
                    type="button"
                    onClick={handleLoginBiometria}
                    disabled={loading || loadingBiometria}
                    className="flex w-full justify-center rounded-2xl border border-teal-100 bg-gradient-to-r from-teal-50 via-sky-50 to-amber-50 px-4 py-3 text-sm font-black text-teal-800 shadow-sm transition hover:border-teal-200 hover:from-teal-100 hover:to-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loadingBiometria ? 'Validando biometria...' : 'Entrar com biometria neste aparelho'}
                  </button>
                )}
              </form>

              <div className="mt-8">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>

                  <div className="relative flex justify-center text-sm">
                    <span className="bg-white px-3 text-sm font-semibold text-slate-500">
                      Primeiro acesso institucional
                    </span>
                  </div>
                </div>

                <div className="mt-6">
                  <Link
                    to="/cadastro"
                    className="flex w-full justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                  >
                    Criar instituição
                  </Link>
                </div>
              </div>

              <p className="mt-8 text-center text-xs font-medium text-slate-400">
                CARECORE+ © Plataforma institucional de acolhimento e gestão operacional
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}