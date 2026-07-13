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

const FORM_PROJETO_VAZIO = {
  nome_fantasia: '',
  cnpj: '',
  telefone: '',
  email: '',
  emails_adicionais: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
  tipo_projeto: 'Projeto',
};

const FORM_CONTATO_VAZIO = {
  telefone: '',
  email: '',
  emails_adicionais: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
};

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

function montarFormContato(origem = {}) {
  return {
    telefone: origem.telefone ? formatarTelefone(origem.telefone) : '',
    email: origem.email || '',
    emails_adicionais: origem.emails_adicionais || '',
    cep: origem.cep ? formatarCEP(origem.cep) : '',
    logradouro: origem.logradouro || '',
    numero: origem.numero || '',
    complemento: origem.complemento || '',
    bairro: origem.bairro || '',
    cidade: origem.cidade || '',
    uf: (origem.uf || '').toUpperCase(),
  };
}

function FormularioContato({
  form,
  errosCampo,
  buscandoCep,
  telefoneObrigatorio,
  onChange,
  onBuscarCep,
}) {
  return (
    <div className="space-y-3">
      <Campo label={telefoneObrigatorio ? 'Telefone *' : 'Telefone'} erro={errosCampo.telefone}>
        <input
          className={`${inputClassName} w-full ${errosCampo.telefone ? inputErroClassName : ''}`}
          value={form.telefone}
          onChange={(e) => onChange('telefone', formatarTelefone(e.target.value))}
          placeholder="(11) 99999-9999"
        />
      </Campo>

      <Campo label="E-mail" erro={errosCampo.email}>
        <input
          type="email"
          className={`${inputClassName} w-full ${errosCampo.email ? inputErroClassName : ''}`}
          value={form.email}
          onChange={(e) => onChange('email', e.target.value)}
          placeholder="contato@organizacao.org"
        />
      </Campo>

      <Campo
        label="E-mails adicionais"
        erro={errosCampo.emails_adicionais}
      >
        <input
          className={`${inputClassName} w-full ${errosCampo.emails_adicionais ? inputErroClassName : ''}`}
          value={form.emails_adicionais}
          onChange={(e) => onChange('emails_adicionais', e.target.value)}
          placeholder="financeiro@org.br, gestao@org.br"
        />
        <span className="mt-1 block text-[11px] font-semibold text-gray-500">
          Separe por vírgula. Usados nas notificações do boleto (Asaas).
        </span>
      </Campo>

      <Campo label={buscandoCep ? 'CEP - buscando endereço...' : 'CEP'} erro={errosCampo.cep}>
        <input
          className={`${inputClassName} w-full ${errosCampo.cep ? inputErroClassName : ''}`}
          value={form.cep}
          onChange={(e) => {
            const cepFormatado = formatarCEP(e.target.value);
            onChange('cep', cepFormatado);
            if (limparMascara(cepFormatado).length === 8) {
              onBuscarCep(cepFormatado);
            }
          }}
          placeholder="00000-000"
        />
      </Campo>

      <Campo label="Logradouro">
        <input
          className={`${inputClassName} w-full`}
          value={form.logradouro}
          onChange={(e) => onChange('logradouro', e.target.value)}
          placeholder="Rua / Avenida"
        />
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <Campo label="Número">
          <input
            className={`${inputClassName} w-full`}
            value={form.numero}
            onChange={(e) => onChange('numero', e.target.value)}
            placeholder="Número"
          />
        </Campo>
        <Campo label="Complemento">
          <input
            className={`${inputClassName} w-full`}
            value={form.complemento}
            onChange={(e) => onChange('complemento', e.target.value)}
            placeholder="Complemento"
          />
        </Campo>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_80px]">
        <Campo label="Cidade">
          <input
            className={`${inputClassName} w-full`}
            value={form.cidade}
            onChange={(e) => onChange('cidade', e.target.value)}
            placeholder="Cidade"
          />
        </Campo>
        <Campo label="UF" erro={errosCampo.uf}>
          <input
            className={`${inputClassName} w-full ${errosCampo.uf ? inputErroClassName : ''}`}
            value={form.uf}
            onChange={(e) => onChange('uf', e.target.value.toUpperCase().slice(0, 2))}
            placeholder="UF"
            maxLength={2}
          />
        </Campo>
      </div>

      <Campo label="Bairro">
        <input
          className={`${inputClassName} w-full`}
          value={form.bairro}
          onChange={(e) => onChange('bairro', e.target.value)}
          placeholder="Bairro"
        />
      </Campo>
    </div>
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
  const [form, setForm] = useState(FORM_PROJETO_VAZIO);

  const [edicaoAlvo, setEdicaoAlvo] = useState(null);
  const [formEdicao, setFormEdicao] = useState(FORM_CONTATO_VAZIO);
  const [metaEdicao, setMetaEdicao] = useState({ titulo: '', subtitulo: '' });
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [buscandoCepEdicao, setBuscandoCepEdicao] = useState(false);
  const [errosEdicao, setErrosEdicao] = useState({});

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

  const atualizarCampoEdicao = (campo, valor) => {
    setFormEdicao((prev) => ({ ...prev, [campo]: valor }));
    setErrosEdicao((prev) => ({ ...prev, [campo]: '' }));
  };

  const buscarCepGenerico = async (cepBuscado, setFormAlvo, setErrosAlvo, setBuscando) => {
    const cepLimpo = limparMascara(cepBuscado);

    if (cepLimpo.length !== 8) {
      return;
    }

    setBuscando(true);
    try {
      const endereco = await consultarCep(cepLimpo);

      if (!endereco) {
        setErrosAlvo((prev) => ({ ...prev, cep: 'CEP não encontrado.' }));
        return;
      }

      setFormAlvo((prev) => ({
        ...prev,
        logradouro: endereco.logradouro || prev.logradouro,
        bairro: endereco.bairro || prev.bairro,
        cidade: endereco.cidade || prev.cidade,
        uf: endereco.uf || prev.uf,
      }));
    } catch {
      setErrosAlvo((prev) => ({ ...prev, cep: 'Não foi possível buscar o CEP agora.' }));
    } finally {
      setBuscando(false);
    }
  };

  const buscarCep = async (cepBuscado) => {
    await buscarCepGenerico(cepBuscado, setForm, setErrosCampo, setBuscandoCep);
  };

  const buscarCepEdicao = async (cepBuscado) => {
    await buscarCepGenerico(cepBuscado, setFormEdicao, setErrosEdicao, setBuscandoCepEdicao);
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

    if (form.emails_adicionais) {
      const emails = form.emails_adicionais.split(/[,;\n]+/).map((e) => e.trim()).filter(Boolean);
      const invalido = emails.find((email) => !emailValido(email));
      if (invalido) {
        novosErros.emails_adicionais = `E-mail adicional inválido: ${invalido}`;
      }
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

  const validarFormularioContato = (dados, telefoneObrigatorio) => {
    const novosErros = {};

    if (telefoneObrigatorio && !dados.telefone.trim()) {
      novosErros.telefone = 'Informe o telefone.';
    } else if (dados.telefone && !telefoneValido(dados.telefone)) {
      novosErros.telefone = 'Telefone inválido.';
    }

    if (dados.email && !emailValido(dados.email)) {
      novosErros.email = 'E-mail inválido.';
    }

    if (dados.emails_adicionais) {
      const emails = dados.emails_adicionais.split(/[,;\n]+/).map((e) => e.trim()).filter(Boolean);
      const invalido = emails.find((email) => !emailValido(email));
      if (invalido) {
        novosErros.emails_adicionais = `E-mail adicional inválido: ${invalido}`;
      }
    }

    if (dados.cep && !cepValido(dados.cep)) {
      novosErros.cep = 'CEP incompleto.';
    }

    if (dados.uf && dados.uf.length !== 2) {
      novosErros.uf = 'UF deve ter 2 letras.';
    }

    setErrosEdicao(novosErros);
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

      setForm(FORM_PROJETO_VAZIO);
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

  const abrirEdicaoProjeto = (projeto) => {
    setErro('');
    setSucesso('');
    setEdicaoAlvo({ tipo: 'projeto', projetoId: projeto.id });
    setMetaEdicao({
      titulo: `Editar cadastro — ${projeto.nome_fantasia}`,
      subtitulo: `CNPJ do projeto: ${projeto.cnpj || 'Não informado'} (somente contato e endereço)`,
    });
    setFormEdicao(montarFormContato(projeto));
    setErrosEdicao({});
  };

  const abrirEdicaoOrganizacaoDoProjeto = async (projeto) => {
    setErro('');
    setSucesso('');
    setSalvandoEdicao(true);

    try {
      const response = await api.get(`/api/organizacao/projetos/${projeto.id}/organizacao-cadastro`);
      const organizacao = response.data || {};
      setEdicaoAlvo({ tipo: 'organizacao', projetoId: projeto.id, organizacaoId: organizacao.id });
      setMetaEdicao({
        titulo: `Editar organização — ${organizacao.nome || 'Organização'}`,
        subtitulo: `CNPJ: ${organizacao.cnpj || 'Não informado'} · vinculado ao projeto ${projeto.nome_fantasia}`,
      });
      setFormEdicao(montarFormContato(organizacao));
      setErrosEdicao({});
    } catch (error) {
      setErro(error.response?.data?.detail || 'Não foi possível carregar o cadastro da organização.');
      setEdicaoAlvo(null);
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const fecharEdicao = () => {
    setEdicaoAlvo(null);
    setFormEdicao(FORM_CONTATO_VAZIO);
    setErrosEdicao({});
    setMetaEdicao({ titulo: '', subtitulo: '' });
  };

  const salvarEdicao = async (event) => {
    event.preventDefault();
    if (!edicaoAlvo) return;

    setErro('');
    setSucesso('');

    const telefoneObrigatorio = edicaoAlvo.tipo === 'projeto';
    if (!validarFormularioContato(formEdicao, telefoneObrigatorio)) {
      setErro('Corrija os campos destacados antes de salvar.');
      return;
    }

    const payload = {
      telefone: formEdicao.telefone.trim() || null,
      email: formEdicao.email.trim() || null,
      emails_adicionais: formEdicao.emails_adicionais.trim() || null,
      cep: formEdicao.cep.trim() || null,
      logradouro: formEdicao.logradouro.trim() || null,
      numero: formEdicao.numero.trim() || null,
      complemento: formEdicao.complemento.trim() || null,
      bairro: formEdicao.bairro.trim() || null,
      cidade: formEdicao.cidade.trim() || null,
      uf: formEdicao.uf.trim().toUpperCase() || null,
    };

    setSalvandoEdicao(true);
    try {
      if (edicaoAlvo.tipo === 'projeto') {
        await api.put(`/api/organizacao/projetos/${edicaoAlvo.projetoId}/cadastro`, payload);
        setSucesso('Cadastro do projeto atualizado.');
      } else {
        await api.put(`/api/organizacao/projetos/${edicaoAlvo.projetoId}/organizacao-cadastro`, payload);
        setSucesso('Cadastro da organização atualizado.');
      }
      fecharEdicao();
      await carregarProjetos();
    } catch (error) {
      setErro(error.response?.data?.detail || 'Não foi possível salvar as alterações.');
    } finally {
      setSalvandoEdicao(false);
    }
  };

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          eyebrow="Organização"
          title="Projetos da Organização"
          subtitle="Cadastre projetos e atualize telefone, e-mail e endereço da organização ou do projeto."
          icon="◇"
        />

        <ScrollArea className="pb-24">
          <div className="mx-auto grid w-full min-w-0 max-w-6xl gap-6 lg:grid-cols-[1fr_420px]">
            <section className="min-w-0 rounded-3xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="text-lg font-black text-gray-900">Projetos cadastrados</h2>
              <p className="mt-1 text-sm text-gray-500">
                Cada projeto funciona como operação separada. Use editar para corrigir contato e endereço
                (ex.: endereço real do SIAT, distinto da organização).
              </p>

              {erro && !edicaoAlvo ? (
                <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{erro}</div>
              ) : null}
              {sucesso && !edicaoAlvo ? (
                <div className="mt-4 rounded-xl bg-green-50 p-3 text-sm font-bold text-green-700">{sucesso}</div>
              ) : null}

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
                            {projeto.email || 'E-mail não informado'}
                            {projeto.emails_adicionais ? ` · + ${projeto.emails_adicionais}` : ''}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {[projeto.logradouro, projeto.numero, projeto.bairro, projeto.cidade, projeto.uf]
                              .filter(Boolean)
                              .join(', ') || 'Endereço não informado'}
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
                          <button
                            type="button"
                            onClick={() => abrirEdicaoProjeto(projeto)}
                            className="w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-800 transition hover:bg-slate-50 sm:w-auto"
                          >
                            Editar projeto
                          </button>
                          <button
                            type="button"
                            onClick={() => abrirEdicaoOrganizacaoDoProjeto(projeto)}
                            className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 sm:w-auto"
                          >
                            Editar organização
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {edicaoAlvo ? (
                <form
                  onSubmit={salvarEdicao}
                  className="mt-6 rounded-2xl border border-brand/20 bg-brand/5 p-4"
                >
                  <h3 className="text-base font-black text-gray-900">{metaEdicao.titulo}</h3>
                  <p className="mt-1 text-xs text-gray-600">{metaEdicao.subtitulo}</p>

                  {erro ? (
                    <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{erro}</div>
                  ) : null}

                  <div className="mt-4">
                    <FormularioContato
                      form={formEdicao}
                      errosCampo={errosEdicao}
                      buscandoCep={buscandoCepEdicao}
                      telefoneObrigatorio={edicaoAlvo.tipo === 'projeto'}
                      onChange={atualizarCampoEdicao}
                      onBuscarCep={buscarCepEdicao}
                    />
                  </div>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <button
                      type="submit"
                      disabled={salvandoEdicao || buscandoCepEdicao}
                      className="min-h-11 flex-1 rounded-2xl bg-brand px-4 py-2 text-sm font-black text-white shadow-sm disabled:opacity-60"
                    >
                      {salvandoEdicao ? 'Salvando...' : 'Salvar alterações'}
                    </button>
                    <button
                      type="button"
                      onClick={fecharEdicao}
                      disabled={salvandoEdicao}
                      className="min-h-11 rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 disabled:opacity-60"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : null}
            </section>

            <section className="min-w-0 rounded-3xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="text-lg font-black text-gray-900">Adicionar projeto</h2>
              <p className="mt-1 text-sm text-gray-500">
                Use para implantar Projeto B, filial ou unidade vinculada à organização atual.
              </p>

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

                <FormularioContato
                  form={form}
                  errosCampo={errosCampo}
                  buscandoCep={buscandoCep}
                  telefoneObrigatorio
                  onChange={atualizarCampo}
                  onBuscarCep={buscarCep}
                />

                <button
                  type="submit"
                  disabled={salvando || buscandoCep || Boolean(edicaoAlvo)}
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
