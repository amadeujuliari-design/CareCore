// =====================================================================
// ARQUIVO: src/Usuarios.jsx
// CARECORE+ OFICIAL
// FASE 1B — Gestão institucional de usuários e permissões
// =====================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Sidebar from './Sidebar';
import api from './services/api';
import {
  BadgePerfil,
  BadgeStatus,
  CampoFotoUsuario,
  CampoSelect,
  CampoTexto,
} from './components/UsuariosCampos';
import {
  ESTADOS_CIVIS,
  FORM_INICIAL,
  GENEROS,
  NACIONALIDADES,
  PERFIS,
  UFS,
} from './utils/usuariosConstantes';
import {
  cepValido,
  cpfValido,
  dataParaInput,
  dataUrlParaArquivo,
  emailValido,
  formatarCEP,
  formatarCPF,
  formatarTelefone,
  imagemParaBase64Padronizada,
  limparMascara,
  obterMensagemErro,
  removerCamposVazios,
  telefoneValido,
  usuarioEhGestor,
} from './utils/usuariosUtils';

export default function Usuarios() {
  const navigate = useNavigate();

  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const [tela, setTela] = useState('lista');
  const [editandoId, setEditandoId] = useState(null);

  const [busca, setBusca] = useState('');
  const [filtroPerfil, setFiltroPerfil] = useState('');
  const [filtroAtivo, setFiltroAtivo] = useState('');

  const [form, setForm] = useState(FORM_INICIAL);
  const [senhaRedefinir, setSenhaRedefinir] = useState('');
  const [usuarioSenha, setUsuarioSenha] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [processandoFoto, setProcessandoFoto] = useState(false);

  const podeGerenciar = useMemo(() => usuarioEhGestor(), []);

  useEffect(() => {
    if (!localStorage.getItem('@CareCore:token') && !localStorage.getItem('token')) {
      navigate('/');
      return;
    }

    carregarUsuarios();
  }, []);

  useEffect(() => {
    return () => {
      pararCamera();
    };
  }, []);

  const carregarUsuarios = async () => {
    try {
      setLoading(true);
      setErro('');

      const params = {};

      if (busca.trim()) params.busca = busca.trim();
      if (filtroPerfil) params.perfil_acesso = filtroPerfil;
      if (filtroAtivo !== '') params.ativo = filtroAtivo === 'true';

      const response = await api.get('/api/usuarios', { params });

      setUsuarios(response.data || []);
    } catch (error) {
      setErro(obterMensagemErro(error));
    } finally {
      setLoading(false);
    }
  };

  const limparAlertas = () => {
    setErro('');
    setSucesso('');
  };

  const abrirNovo = () => {
    limparAlertas();
    setForm(FORM_INICIAL);
    setEditandoId(null);
    setTela('form');
  };

  const abrirEdicao = async (usuarioId) => {
    try {
      limparAlertas();
      setLoading(true);

      const response = await api.get(`/api/usuarios/${usuarioId}`);
      const usuario = response.data;

      setForm({
        ...FORM_INICIAL,
        nome: usuario.nome || '',
        email: usuario.email || '',
        senha: '',
        perfil_acesso: usuario.perfil_acesso || 'Consulta',
        cpf: formatarCPF(usuario.cpf || ''),
        telefone: formatarTelefone(usuario.telefone || ''),
        avatar_url: usuario.avatar_url || '',
        data_nascimento: dataParaInput(usuario.data_nascimento),
        genero: usuario.genero || '',
        rg: usuario.rg || '',
        orgao_emissor: usuario.orgao_emissor || '',
        estado_civil: usuario.estado_civil || '',
        nacionalidade: usuario.nacionalidade || '',
        naturalidade: usuario.naturalidade || '',
        cep: formatarCEP(usuario.cep || ''),
        logradouro: usuario.logradouro || '',
        numero: usuario.numero || '',
        complemento: usuario.complemento || '',
        bairro: usuario.bairro || '',
        cidade: usuario.cidade || '',
        uf: usuario.uf || '',
        cargo: usuario.cargo || '',
        setor: usuario.setor || '',
        conselho_profissional: usuario.conselho_profissional || '',
        numero_conselho: usuario.numero_conselho || '',
        carga_horaria: usuario.carga_horaria ?? '',
        data_admissao: dataParaInput(usuario.data_admissao),
        data_desligamento: dataParaInput(usuario.data_desligamento),
        motivo_desligamento: usuario.motivo_desligamento || '',
        observacoes_profissionais: usuario.observacoes_profissionais || '',
      });

      setEditandoId(usuario.id);
      setTela('form');
    } catch (error) {
      setErro(obterMensagemErro(error));
    } finally {
      setLoading(false);
    }
  };

  const atualizarCampo = (campo, valor) => {
    let valorFinal = valor;

    if (campo === 'cpf') valorFinal = formatarCPF(valor);
    if (campo === 'telefone') valorFinal = formatarTelefone(valor);
    if (campo === 'cep') valorFinal = formatarCEP(valor);
    if (campo === 'uf') valorFinal = valor.toUpperCase().slice(0, 2);

    setForm((atual) => ({
      ...atual,
      [campo]: valorFinal,
    }));
  };

  const buscarEnderecoPorCEP = async () => {
    const cep = limparMascara(form.cep);

    if (!cep) return;

    if (cep.length !== 8) {
      setErro('CEP inválido. Informe 8 dígitos.');
      return;
    }

    try {
      limparAlertas();

      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();

      if (data?.erro) {
        setErro('CEP não encontrado.');
        return;
      }

      setForm((atual) => ({
        ...atual,
        logradouro: data.logradouro || atual.logradouro,
        bairro: data.bairro || atual.bairro,
        cidade: data.localidade || atual.cidade,
        uf: data.uf || atual.uf,
      }));
    } catch {
      setErro('Não foi possível consultar o CEP agora. Confira os dados manualmente.');
    }
  };


  const pararCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraAtiva(false);
  };

  const abrirCamera = async () => {
    try {
      limparAlertas();

      if (!navigator.mediaDevices?.getUserMedia) {
        setErro('Seu navegador não permite captura por webcam.');
        return;
      }

      // Importante:
      // primeiro renderiza o bloco <video>, depois conecta o stream.
      // Se o stream for criado antes do vídeo existir no DOM, a tela fica preta.
      setCameraAtiva(true);

      await new Promise((resolve) => {
        window.setTimeout(resolve, 150);
      });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;

        await videoRef.current.play();
      }
    } catch (error) {
      console.error('Erro ao acessar webcam:', error);
      setErro('Não foi possível acessar a webcam. Verifique a permissão do navegador.');
      pararCamera();
    }
  };

  const capturarFotoWebcam = async () => {
    try {
      limparAlertas();

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas) {
        setErro('Webcam não está pronta para captura.');
        return;
      }

      const tamanho = 512;
      canvas.width = tamanho;
      canvas.height = tamanho;

      const ctx = canvas.getContext('2d');

      if (!ctx) {
        setErro('Não foi possível capturar a imagem.');
        return;
      }

      const largura = video.videoWidth;
      const altura = video.videoHeight;

      if (!largura || !altura) {
        setErro('A webcam ainda está inicializando. Tente novamente.');
        return;
      }

      const lado = Math.min(largura, altura);
      const sx = (largura - lado) / 2;
      const sy = (altura - lado) / 2;

      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, tamanho, tamanho);
      ctx.drawImage(video, sx, sy, lado, lado, 0, 0, tamanho, tamanho);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const arquivo = dataUrlParaArquivo(dataUrl);
      const fotoPadronizada = await imagemParaBase64Padronizada(arquivo);

      atualizarCampo('avatar_url', fotoPadronizada);
      pararCamera();
      setSucesso('Foto capturada com sucesso.');
    } catch (error) {
      setErro(error?.message || 'Erro ao capturar foto.');
    }
  };

  const selecionarArquivoFoto = () => {
    fileInputRef.current?.click();
  };

  const processarUploadFoto = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      setProcessandoFoto(true);
      limparAlertas();

      const fotoPadronizada = await imagemParaBase64Padronizada(file);

      atualizarCampo('avatar_url', fotoPadronizada);
      setSucesso('Foto carregada com sucesso.');
    } catch (error) {
      setErro(error?.message || 'Não foi possível processar a imagem.');
    } finally {
      setProcessandoFoto(false);
      event.target.value = '';
    }
  };

  const removerFoto = () => {
    atualizarCampo('avatar_url', '');
    pararCamera();
  };

  const validarForm = () => {
    if (!form.nome.trim()) return 'Informe o nome.';
    if (!form.email.trim()) return 'Informe o e-mail.';
    if (!emailValido(form.email)) return 'Informe um e-mail válido.';
    if (!form.perfil_acesso) return 'Selecione o perfil de acesso.';

    if (form.cpf && !cpfValido(form.cpf)) {
      return 'CPF inválido. Verifique os números informados.';
    }

    if (form.telefone && !telefoneValido(form.telefone)) {
      return 'Telefone inválido. Informe DDD + número com 10 ou 11 dígitos.';
    }

    if (form.cep && !cepValido(form.cep)) {
      return 'CEP inválido. Informe 8 dígitos.';
    }

    if (form.uf && !UFS.includes(form.uf)) {
      return 'UF inválida. Selecione uma UF válida.';
    }

    if (form.data_desligamento && !form.motivo_desligamento.trim()) {
      return 'Informe o motivo do desligamento.';
    }

    if (
      form.data_admissao &&
      form.data_desligamento &&
      form.data_desligamento < form.data_admissao
    ) {
      return 'Data de desligamento não pode ser anterior à data de admissão.';
    }

    if (!editandoId && !form.senha) {
      return 'Informe uma senha inicial para o usuário.';
    }

    if (!editandoId && form.senha.length < 8) {
      return 'A senha deve possuir no mínimo 8 caracteres.';
    }

    if (!editandoId && new Blob([form.senha]).size > 72) {
      return 'A senha não pode ultrapassar 72 bytes.';
    }

    return '';
  };

  const montarPayload = () => {
    const payload = {
      ...form,
      nome: form.nome.trim(),
      email: form.email.trim().toLowerCase(),
      cpf: limparMascara(form.cpf),
      telefone: limparMascara(form.telefone),
      cep: limparMascara(form.cep),
    };

    delete payload.conselho_profissional;
    delete payload.numero_conselho;
    delete payload.carga_horaria;

    if (editandoId) {
      delete payload.senha;
    }

    return removerCamposVazios(payload);
  };

  const salvarUsuario = async (e) => {
    e.preventDefault();

    if (!podeGerenciar) {
      setErro('Apenas Gestor pode criar ou editar usuários.');
      return;
    }

    const erroValidacao = validarForm();

    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }

    try {
      setSalvando(true);
      limparAlertas();

      const payload = montarPayload();

      if (editandoId) {
        await api.put(`/api/usuarios/${editandoId}`, payload);
        setSucesso('Usuário atualizado com sucesso.');
      } else {
        await api.post('/api/usuarios', payload);
        setSucesso('Usuário criado com sucesso.');
      }

      setTela('lista');
      setEditandoId(null);
      setForm(FORM_INICIAL);
      await carregarUsuarios();
    } catch (error) {
      setErro(obterMensagemErro(error));
    } finally {
      setSalvando(false);
    }
  };

  const alterarStatus = async (usuario) => {
    if (!podeGerenciar) return;

    const novoStatus = !usuario.ativo;
    const texto = novoStatus ? 'ativar' : 'inativar';

    const confirmar = window.confirm(
      `Deseja realmente ${texto} o usuário ${usuario.nome}?`
    );

    if (!confirmar) return;

    try {
      limparAlertas();

      await api.patch(`/api/usuarios/${usuario.id}/status`, {
        ativo: novoStatus,
      });

      setSucesso(
        novoStatus
          ? 'Usuário ativado com sucesso.'
          : 'Usuário inativado com sucesso.'
      );

      await carregarUsuarios();
    } catch (error) {
      setErro(obterMensagemErro(error));
    }
  };

  const abrirRedefinirSenha = (usuario) => {
    setUsuarioSenha(usuario);
    setSenhaRedefinir('');
    limparAlertas();
  };

  const redefinirSenha = async (e) => {
    e.preventDefault();

    if (!usuarioSenha) return;

    if (!senhaRedefinir || senhaRedefinir.length < 8) {
      setErro('Informe uma nova senha forte com no mínimo 8 caracteres.');
      return;
    }

    if (new Blob([senhaRedefinir]).size > 72) {
      setErro('A senha não pode ultrapassar 72 bytes.');
      return;
    }

    try {
      setSalvando(true);
      limparAlertas();

      await api.patch(`/api/usuarios/${usuarioSenha.id}/senha`, {
        nova_senha: senhaRedefinir,
      });

      setSucesso('Senha redefinida com sucesso.');
      setUsuarioSenha(null);
      setSenhaRedefinir('');
    } catch (error) {
      setErro(obterMensagemErro(error));
    } finally {
      setSalvando(false);
    }
  };

  const voltarLista = () => {
    setTela('lista');
    setEditandoId(null);
    setForm(FORM_INICIAL);
    limparAlertas();
  };

  return (
    <div className="carecore-app-fixed">
      <Sidebar />

      <section className="carecore-main-fixed">
        <header className="carecore-page-header-fixed px-5 py-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Administração
              </p>
              <h1 className="text-[23px] font-bold leading-none text-slate-900">
                Usuários e Permissões
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Gestão da equipe institucional, perfis de acesso e status de usuários.
              </p>
            </div>

            {tela === 'lista' && podeGerenciar && (
              <button
                type="button"
                onClick={abrirNovo}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800"
              >
                + Novo usuário
              </button>
            )}

            {tela === 'form' && (
              <button
                type="button"
                onClick={voltarLista}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Voltar
              </button>
            )}
          </div>
        </header>

        <main className="carecore-scroll-area">

        {erro && (
          <div className="mb-4 whitespace-pre-line rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {erro}
          </div>
        )}

        {sucesso && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {sucesso}
          </div>
        )}

        {!podeGerenciar && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Seu perfil permite consulta, mas criação e edição de usuários são restritas ao Gestor.
          </div>
        )}

        {tela === 'lista' && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 grid gap-3 md:grid-cols-4">
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, e-mail, CPF, cargo ou setor"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 md:col-span-2"
              />

              <select
                value={filtroPerfil}
                onChange={(e) => setFiltroPerfil(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              >
                <option value="">Todos os perfis</option>
                {PERFIS.map((perfil) => (
                  <option key={perfil} value={perfil}>
                    {perfil}
                  </option>
                ))}
              </select>

              <select
                value={filtroAtivo}
                onChange={(e) => setFiltroAtivo(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              >
                <option value="">Todos os status</option>
                <option value="true">Ativos</option>
                <option value="false">Inativos</option>
              </select>

              <button
                type="button"
                onClick={carregarUsuarios}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 md:col-span-4"
              >
                Aplicar filtros
              </button>
            </div>

            {loading ? (
              <div className="py-12 text-center text-sm text-slate-500">
                Carregando usuários...
              </div>
            ) : usuarios.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500">
                Nenhum usuário encontrado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2">Usuário</th>
                      <th className="px-3 py-2">Perfil</th>
                      <th className="px-3 py-2">Cargo / Setor</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right">Ações</th>
                    </tr>
                  </thead>

                  <tbody>
                    {usuarios.map((usuario) => (
                      <tr key={usuario.id} className="bg-slate-50">
                        <td className="rounded-l-xl px-3 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                              {(usuario.nome || 'U').slice(0, 1).toUpperCase()}
                            </div>

                            <div>
                              <p className="font-semibold text-slate-900">
                                {usuario.nome}
                              </p>
                              <p className="text-xs text-slate-500">
                                {usuario.email}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-3 py-3">
                          <BadgePerfil perfil={usuario.perfil_acesso} />
                        </td>

                        <td className="px-3 py-3 text-sm text-slate-600">
                          <p>{usuario.cargo || '-'}</p>
                          <p className="text-xs text-slate-400">
                            {usuario.setor || 'Sem setor'}
                          </p>
                        </td>

                        <td className="px-3 py-3">
                          <BadgeStatus ativo={usuario.ativo} />
                        </td>

                        <td className="rounded-r-xl px-3 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => abrirEdicao(usuario.id)}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              Ver/Editar
                            </button>

                            {podeGerenciar && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => abrirRedefinirSenha(usuario)}
                                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                                >
                                  Senha
                                </button>

                                <button
                                  type="button"
                                  onClick={() => alterarStatus(usuario)}
                                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                                    usuario.ativo
                                      ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                                      : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  }`}
                                >
                                  {usuario.ativo ? 'Inativar' : 'Ativar'}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {tela === 'form' && (
          <form
            onSubmit={salvarUsuario}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="mb-6">
              <h2 className="text-lg font-bold text-slate-900">
                {editandoId ? 'Editar usuário' : 'Novo usuário'}
              </h2>
              <p className="text-sm text-slate-500">
                Preencha dados pessoais, profissionais e permissões de acesso.
              </p>
            </div>

            <div className="grid gap-6">
              <section>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
                  Acesso
                </h3>

                <div className="grid gap-4 md:grid-cols-3">
                  <CampoTexto label="Nome" value={form.nome} onChange={(v) => atualizarCampo('nome', v)} required />
                  <CampoTexto label="E-mail" type="email" value={form.email} onChange={(v) => atualizarCampo('email', v)} required />

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                      Perfil de acesso
                    </label>
                    <select
                      value={form.perfil_acesso}
                      onChange={(e) => atualizarCampo('perfil_acesso', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                      required
                    >
                      {PERFIS.map((perfil) => (
                        <option key={perfil} value={perfil}>
                          {perfil}
                        </option>
                      ))}
                    </select>
                  </div>

                  {!editandoId && (
                    <CampoTexto
                      label="Senha inicial"
                      type="password"
                      value={form.senha}
                      onChange={(v) => atualizarCampo('senha', v)}
                      required
                      maxLength={72}
                    />
                  )}
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
                  Dados pessoais
                </h3>

                <div className="grid gap-4 md:grid-cols-4">
                  <CampoTexto label="CPF" value={form.cpf} onChange={(v) => atualizarCampo('cpf', v)} />
                  <CampoTexto label="Telefone" value={form.telefone} onChange={(v) => atualizarCampo('telefone', v)} />
                  <CampoTexto label="Data de nascimento" type="date" value={form.data_nascimento} onChange={(v) => atualizarCampo('data_nascimento', v)} />

                  <CampoSelect
                    label="Gênero"
                    value={form.genero}
                    onChange={(v) => atualizarCampo('genero', v)}
                    options={GENEROS}
                    placeholder="Selecione"
                  />

                  <CampoTexto label="RG" value={form.rg} onChange={(v) => atualizarCampo('rg', v)} />
                  <CampoTexto label="Órgão emissor" value={form.orgao_emissor} onChange={(v) => atualizarCampo('orgao_emissor', v)} />

                  <CampoSelect
                    label="Estado civil"
                    value={form.estado_civil}
                    onChange={(v) => atualizarCampo('estado_civil', v)}
                    options={ESTADOS_CIVIS}
                    placeholder="Selecione"
                  />

                  <CampoSelect
                    label="Nacionalidade"
                    value={form.nacionalidade}
                    onChange={(v) => atualizarCampo('nacionalidade', v)}
                    options={NACIONALIDADES}
                    placeholder="Selecione"
                  />

                  <CampoTexto label="Naturalidade / Cidade" value={form.naturalidade} onChange={(v) => atualizarCampo('naturalidade', v)} />

                  <CampoFotoUsuario
                    avatarUrl={form.avatar_url}
                    cameraAtiva={cameraAtiva}
                    processandoFoto={processandoFoto}
                    videoRef={videoRef}
                    canvasRef={canvasRef}
                    fileInputRef={fileInputRef}
                    onAbrirCamera={abrirCamera}
                    onCapturarFoto={capturarFotoWebcam}
                    onPararCamera={pararCamera}
                    onSelecionarArquivo={selecionarArquivoFoto}
                    onUploadArquivo={processarUploadFoto}
                    onRemoverFoto={removerFoto}
                  />
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
                  Endereço
                </h3>

                <div className="grid gap-4 md:grid-cols-4">
                  <CampoTexto
                    label="CEP"
                    value={form.cep}
                    onChange={(v) => atualizarCampo('cep', v)}
                    onBlur={buscarEnderecoPorCEP}
                  />
                  <CampoTexto label="Logradouro" value={form.logradouro} onChange={(v) => atualizarCampo('logradouro', v)} className="md:col-span-2" />
                  <CampoTexto label="Número" value={form.numero} onChange={(v) => atualizarCampo('numero', v)} />
                  <CampoTexto label="Complemento" value={form.complemento} onChange={(v) => atualizarCampo('complemento', v)} />
                  <CampoTexto label="Bairro" value={form.bairro} onChange={(v) => atualizarCampo('bairro', v)} />
                  <CampoTexto label="Cidade" value={form.cidade} onChange={(v) => atualizarCampo('cidade', v)} />
                  <CampoSelect
                    label="UF"
                    value={form.uf}
                    onChange={(v) => atualizarCampo('uf', v)}
                    options={UFS}
                    placeholder="UF"
                  />
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
                  Dados profissionais
                </h3>

                <div className="grid gap-4 md:grid-cols-4">
                  <CampoTexto label="Cargo" value={form.cargo} onChange={(v) => atualizarCampo('cargo', v)} />
                  <CampoTexto label="Setor" value={form.setor} onChange={(v) => atualizarCampo('setor', v)} />
                  <CampoTexto label="Data de admissão" type="date" value={form.data_admissao} onChange={(v) => atualizarCampo('data_admissao', v)} />
                  <CampoTexto label="Data de desligamento" type="date" value={form.data_desligamento} onChange={(v) => atualizarCampo('data_desligamento', v)} />

                  <div className="md:col-span-4">
                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                      Motivo do desligamento
                    </label>
                    <textarea
                      value={form.motivo_desligamento}
                      onChange={(e) => atualizarCampo('motivo_desligamento', e.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                    />
                  </div>

                  <div className="md:col-span-4">
                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                      Observações profissionais
                    </label>
                    <textarea
                      value={form.observacoes_profissionais}
                      onChange={(e) => atualizarCampo('observacoes_profissionais', e.target.value)}
                      rows={4}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                    />
                  </div>
                </div>
              </section>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={voltarLista}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>

              {podeGerenciar && (
                <button
                  type="submit"
                  disabled={salvando}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800 disabled:opacity-60"
                >
                  {salvando ? 'Salvando...' : 'Salvar usuário'}
                </button>
              )}
            </div>
          </form>
        )}

        {usuarioSenha && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <form
              onSubmit={redefinirSenha}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            >
              <h2 className="text-lg font-bold text-slate-900">
                Redefinir senha
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Usuário: <strong>{usuarioSenha.nome}</strong>
              </p>

              <div className="mt-4">
                <CampoTexto
                  label="Nova senha"
                  type="password"
                  value={senhaRedefinir}
                  onChange={setSenhaRedefinir}
                  required
                  maxLength={72}
                />
              </div>

              <p className="mt-2 text-xs text-slate-500">
                A senha deve atender às regras de segurança configuradas no backend.
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setUsuarioSenha(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={salvando}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800 disabled:opacity-60"
                >
                  Redefinir
                </button>
              </div>
            </form>
          </div>
        )}
        </main>
      </section>
    </div>
  );
}
