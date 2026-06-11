import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { AppShell, MainShell, PageHeader, ScrollArea } from './components/PremiumUI';
import api from './services/api';
import { consultarCep } from './services/cepService';
import { useAuth } from './context/AuthContext';
import {
  cepValido,
  emailValido,
  formatarCEP,
  formatarTelefone,
  limparMascara,
  telefoneValido,
} from './utils/usuariosUtils';

const inputClassName = 'min-h-11 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand';
const inputErroClassName = 'border-red-400 bg-red-50 focus:border-red-500';

function formatarCNPJ(valor) {
  const v = limparMascara(valor).slice(0, 14);

  return v
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function cnpjValido(valor) {
  const cnpj = limparMascara(valor);

  if (!cnpj) return true;
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

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

  const primeiroDigito = calcularDigito(cnpj.slice(0, 12));
  const segundoDigito = calcularDigito(cnpj.slice(0, 12) + primeiroDigito);

  return cnpj.endsWith(primeiroDigito + segundoDigito);
}

function Campo({ label, erro, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black uppercase tracking-wide text-gray-600">{label}</span>
      {children}
      {erro ? <span className="mt-1 block text-xs font-bold text-red-600">{erro}</span> : null}
    </label>
  );
}

export default function Organizacao() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [projetos, setProjetos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [selecionandoProjetoId, setSelecionandoProjetoId] = useState('');
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [errosCampo, setErrosCampo] = useState({});
  const [form, setForm] = useState({
    nome_fantasia: '',
    cnpj: '',
    telefone: '',
    email: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    tipo_projeto: 'Projeto',
  });

  const usuarioSessao = (() => {
    try {
      const usuarioRaw = localStorage.getItem('@CareCore:user') || localStorage.getItem('usuario');
      return usuarioRaw ? JSON.parse(usuarioRaw) : null;
    } catch {
      return null;
    }
  })();

  const carregarProjetos = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/organizacao/projetos');
      setProjetos(response.data || []);
    } catch (error) {
      setErro(error.response?.data?.detail || 'Não foi possível carregar os projetos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarProjetos();
  }, []);

  const atualizarCampo = (campo, valor) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
    setErrosCampo((prev) => ({ ...prev, [campo]: '' }));
  };

  const buscarCep = async (cepBuscado) => {
    const cepLimpo = limparMascara(cepBuscado);

    if (cepLimpo.length !== 8) {
      return;
    }

    setBuscandoCep(true);
    try {
      const endereco = await consultarCep(cepLimpo);

      if (!endereco) {
        setErrosCampo((prev) => ({ ...prev, cep: 'CEP não encontrado.' }));
        return;
      }

      setForm((prev) => ({
        ...prev,
        logradouro: endereco.logradouro || prev.logradouro,
        bairro: endereco.bairro || prev.bairro,
        cidade: endereco.cidade || prev.cidade,
        uf: endereco.uf || prev.uf,
      }));
    } catch {
      setErrosCampo((prev) => ({ ...prev, cep: 'Não foi possível buscar o CEP agora.' }));
    } finally {
      setBuscandoCep(false);
    }
  };

  const validarFormulario = () => {
    const novosErros = {};

    if (!form.nome_fantasia.trim()) {
      novosErros.nome_fantasia = 'Informe o nome do projeto.';
    }

    if (!form.telefone.trim()) {
      novosErros.telefone = 'Informe o telefone.';
    } else if (!telefoneValido(form.telefone)) {
      novosErros.telefone = 'Telefone inválido.';
    }

    if (form.cnpj && !cnpjValido(form.cnpj)) {
      novosErros.cnpj = 'CNPJ inválido.';
    }

    if (form.email && !emailValido(form.email)) {
      novosErros.email = 'E-mail inválido.';
    }

    if (form.cep && !cepValido(form.cep)) {
      novosErros.cep = 'CEP incompleto.';
    }

    if (form.uf && form.uf.length !== 2) {
      novosErros.uf = 'UF deve ter 2 letras.';
    }

    setErrosCampo(novosErros);
    return Object.keys(novosErros).length === 0;
  };

  const criarProjeto = async (event) => {
    event.preventDefault();
    setErro('');
    setSucesso('');

    if (!validarFormulario()) {
      setErro('Corrija os campos destacados antes de salvar.');
      return;
    }

    setSalvando(true);
    try {
      await api.post('/api/organizacao/projetos', {
        ...form,
        nome_fantasia: form.nome_fantasia.trim(),
        cnpj: form.cnpj.trim(),
        telefone: form.telefone.trim(),
        email: form.email.trim(),
        uf: form.uf.trim().toUpperCase(),
      });

      setForm({
        nome_fantasia: '',
        cnpj: '',
        telefone: '',
        email: '',
        cep: '',
        logradouro: '',
        numero: '',
        complemento: '',
        bairro: '',
        cidade: '',
        uf: '',
        tipo_projeto: 'Projeto',
      });
      setSucesso('Projeto cadastrado e vinculado à organização.');
      setErrosCampo({});
      await carregarProjetos();
    } catch (error) {
      setErro(error.response?.data?.detail || 'Não foi possível cadastrar o projeto.');
    } finally {
      setSalvando(false);
    }
  };

  const selecionarProjeto = async (projetoId) => {
    setErro('');
    setSucesso('');
    setSelecionandoProjetoId(projetoId);

    try {
      const response = await api.post(`/api/organizacao/projetos/${projetoId}/selecionar`);
      const token = response.data?.access_token;
      const usuario = response.data?.usuario;

      if (!token || !usuario) {
        throw new Error('Resposta inválida ao selecionar projeto.');
      }

      login({ token, usuario });
      navigate('/dashboard');
    } catch (error) {
      setErro(error.response?.data?.detail || 'Não foi possível entrar neste projeto.');
    } finally {
      setSelecionandoProjetoId('');
    }
  };

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          eyebrow="Organização"
          title="Projetos da Organização"
          subtitle="Cadastre projetos/unidades vinculados à mesma organização mãe."
          icon="◇"
        />

        <ScrollArea className="pb-24">
          <div className="mx-auto grid w-full min-w-0 max-w-6xl gap-6 lg:grid-cols-[1fr_420px]">
            <section className="min-w-0 rounded-3xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="text-lg font-black text-gray-900">Projetos cadastrados</h2>
              <p className="mt-1 text-sm text-gray-500">
                Cada projeto funciona como operação separada, mas fica vinculado à mesma organização.
              </p>

              {loading ? (
                <p className="mt-6 text-sm font-semibold text-gray-500">Carregando...</p>
              ) : projetos.length === 0 ? (
                <p className="mt-6 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm font-semibold text-gray-500">
                  Nenhum projeto cadastrado.
                </p>
              ) : (
                <div className="mt-5 space-y-3">
                  {projetos.map((projeto) => (
                    <article key={projeto.id} className="min-w-0 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h3 className="break-words font-black text-gray-900">{projeto.nome_fantasia}</h3>
                          <p className="mt-1 text-xs font-semibold text-gray-500">
                            CNPJ: {projeto.cnpj || 'Não informado'} · Telefone: {projeto.telefone || '-'}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {projeto.cidade ? `${projeto.cidade}/${projeto.uf || ''}` : 'Endereço não informado'}
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 sm:items-end">
                          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                            {projeto.projeto_unico ? 'Projeto principal' : 'Projeto'}
                          </span>
                          {usuarioSessao?.instituicao_id === projeto.id ? (
                            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-black text-green-700">
                              Projeto ativo
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => selecionarProjeto(projeto.id)}
                              disabled={selecionandoProjetoId === projeto.id}
                              className="w-full rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60 sm:w-auto"
                            >
                              {selecionandoProjetoId === projeto.id ? 'Entrando...' : 'Entrar neste projeto'}
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="min-w-0 rounded-3xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="text-lg font-black text-gray-900">Adicionar projeto</h2>
              <p className="mt-1 text-sm text-gray-500">
                Use para implantar Projeto B, filial ou unidade vinculada à organização atual.
              </p>

              {erro && <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{erro}</div>}
              {sucesso && <div className="mt-4 rounded-xl bg-green-50 p-3 text-sm font-bold text-green-700">{sucesso}</div>}

              <form onSubmit={criarProjeto} className="mt-5 space-y-3">
                <Campo label="Nome do projeto *" erro={errosCampo.nome_fantasia}>
                  <input
                    className={`${inputClassName} w-full ${errosCampo.nome_fantasia ? inputErroClassName : ''}`}
                    value={form.nome_fantasia}
                    onChange={(e) => atualizarCampo('nome_fantasia', e.target.value)}
                    onBlur={() => {
                      if (!form.nome_fantasia.trim()) {
                        setErrosCampo((prev) => ({ ...prev, nome_fantasia: 'Informe o nome do projeto.' }));
                      }
                    }}
                    placeholder="Ex: Projeto Acolhida Masculina"
                  />
                </Campo>

                <Campo label="CNPJ do projeto" erro={errosCampo.cnpj}>
                  <input
                    className={`${inputClassName} w-full ${errosCampo.cnpj ? inputErroClassName : ''}`}
                    value={form.cnpj}
                    onChange={(e) => atualizarCampo('cnpj', formatarCNPJ(e.target.value))}
                    onBlur={() => {
                      if (form.cnpj && !cnpjValido(form.cnpj)) {
                        setErrosCampo((prev) => ({ ...prev, cnpj: 'CNPJ inválido.' }));
                      }
                    }}
                    placeholder="00.000.000/0000-00"
                  />
                </Campo>

                <Campo label="Telefone *" erro={errosCampo.telefone}>
                  <input
                    className={`${inputClassName} w-full ${errosCampo.telefone ? inputErroClassName : ''}`}
                    value={form.telefone}
                    onChange={(e) => atualizarCampo('telefone', formatarTelefone(e.target.value))}
                    onBlur={() => {
                      if (!form.telefone.trim()) {
                        setErrosCampo((prev) => ({ ...prev, telefone: 'Informe o telefone.' }));
                      } else if (!telefoneValido(form.telefone)) {
                        setErrosCampo((prev) => ({ ...prev, telefone: 'Telefone inválido.' }));
                      }
                    }}
                    placeholder="(11) 99999-9999"
                  />
                </Campo>

                <Campo label="E-mail do projeto" erro={errosCampo.email}>
                  <input
                    type="email"
                    className={`${inputClassName} w-full ${errosCampo.email ? inputErroClassName : ''}`}
                    value={form.email}
                    onChange={(e) => atualizarCampo('email', e.target.value)}
                    onBlur={() => {
                      if (form.email && !emailValido(form.email)) {
                        setErrosCampo((prev) => ({ ...prev, email: 'E-mail inválido.' }));
                      }
                    }}
                    placeholder="projeto@organizacao.org"
                  />
                </Campo>

                <Campo label={buscandoCep ? 'CEP - buscando endereço...' : 'CEP'} erro={errosCampo.cep}>
                  <input
                    className={`${inputClassName} w-full ${errosCampo.cep ? inputErroClassName : ''}`}
                    value={form.cep}
                    onChange={(e) => {
                      const cepFormatado = formatarCEP(e.target.value);
                      atualizarCampo('cep', cepFormatado);
                      if (limparMascara(cepFormatado).length === 8) {
                        buscarCep(cepFormatado);
                      }
                    }}
                    onBlur={() => {
                      if (form.cep && !cepValido(form.cep)) {
                        setErrosCampo((prev) => ({ ...prev, cep: 'CEP incompleto.' }));
                      }
                    }}
                    placeholder="00000-000"
                  />
                </Campo>

                <Campo label="Logradouro">
                  <input className={`${inputClassName} w-full`} value={form.logradouro} onChange={(e) => atualizarCampo('logradouro', e.target.value)} placeholder="Rua / Avenida" />
                </Campo>

                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Número">
                    <input className={`${inputClassName} w-full`} value={form.numero} onChange={(e) => atualizarCampo('numero', e.target.value)} placeholder="Número" />
                  </Campo>
                  <Campo label="Complemento">
                    <input className={`${inputClassName} w-full`} value={form.complemento} onChange={(e) => atualizarCampo('complemento', e.target.value)} placeholder="Complemento" />
                  </Campo>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_80px]">
                  <Campo label="Cidade">
                    <input className={`${inputClassName} w-full`} value={form.cidade} onChange={(e) => atualizarCampo('cidade', e.target.value)} placeholder="Cidade" />
                  </Campo>
                  <Campo label="UF" erro={errosCampo.uf}>
                    <input
                      className={`${inputClassName} w-full ${errosCampo.uf ? inputErroClassName : ''}`}
                      value={form.uf}
                      onChange={(e) => atualizarCampo('uf', e.target.value.toUpperCase().slice(0, 2))}
                      onBlur={() => {
                        if (form.uf && form.uf.length !== 2) {
                          setErrosCampo((prev) => ({ ...prev, uf: 'UF deve ter 2 letras.' }));
                        }
                      }}
                      placeholder="UF"
                      maxLength={2}
                    />
                  </Campo>
                </div>

                <Campo label="Bairro">
                  <input className={`${inputClassName} w-full`} value={form.bairro} onChange={(e) => atualizarCampo('bairro', e.target.value)} placeholder="Bairro" />
                </Campo>

                <button
                  type="submit"
                  disabled={salvando || buscandoCep}
                  className="min-h-11 w-full rounded-2xl bg-brand px-4 py-2 text-sm font-black text-white shadow-sm disabled:opacity-60"
                >
                  {salvando ? 'Salvando...' : 'Cadastrar projeto'}
                </button>
              </form>
            </section>
          </div>
        </ScrollArea>
      </MainShell>
    </AppShell>
  );
}
