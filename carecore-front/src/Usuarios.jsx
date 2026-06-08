// =====================================================================
// ARQUIVO: src/Usuarios.jsx
// CARECORE+ OFICIAL
// FASE 1B — Gestão institucional de usuários e permissões
// =====================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Sidebar from './Sidebar';
import api from './services/api';
import { consultarCep } from './services/cepService';
import { AppShell, MainShell, PageHeader, PremiumButton, ScrollArea } from './components/PremiumUI';
import UserAvatar from './components/UserAvatar';
import {
  getCameraUnavailableMessage,
  getPreferredCameraConstraints,
  useDeviceInfo,
} from './hooks/useDeviceInfo';
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
import { calcularIdade } from './utils/conviventesUtils';
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

function usuarioLogadoEhGlobal() {
  try {
    const token = localStorage.getItem('@CareCore:token') || localStorage.getItem('token');
    const payload = token ? JSON.parse(atob(token.split('.')[1])) : {};

    return payload?.is_global === true;
  } catch {
    return false;
  }
}

function dataLocalISO(data = new Date()) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');

  return `${ano}-${mes}-${dia}`;
}

function formatarDataBR(dataISO) {
  if (!dataISO) return '';

  const [ano, mes, dia] = String(dataISO).slice(0, 10).split('-');

  if (!ano || !mes || !dia) return dataISO;

  return `${dia}/${mes}/${ano}`;
}

function dataBRParaISO(valor) {
  const data = String(valor || '').trim();
  const correspondencia = data.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!correspondencia) return '';

  const [, dia, mes, ano] = correspondencia;
  const dataTeste = new Date(Number(ano), Number(mes) - 1, Number(dia));

  if (
    dataTeste.getFullYear() !== Number(ano) ||
    dataTeste.getMonth() !== Number(mes) - 1 ||
    dataTeste.getDate() !== Number(dia)
  ) {
    return '';
  }

  return `${ano}-${mes}-${dia}`;
}

function obterRegrasSenha(senha = '') {
  return {
    minimo: senha.length >= 8,
    maiuscula: /[A-Z]/.test(senha),
    minuscula: /[a-z]/.test(senha),
    numero: /\d/.test(senha),
    especial: /[@$!%*?&_\-#]/.test(senha),
    tamanhoMaximo: new Blob([senha]).size <= 72,
  };
}

function senhaAtendePolitica(senha = '') {
  return Object.values(obterRegrasSenha(senha)).every(Boolean);
}

function BadgeGlobal() {
  return (
    <span className="inline-flex items-center rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-xs font-black uppercase tracking-wide text-violet-700">
      Global
    </span>
  );
}

function ListaRegrasSenha({ regras }) {
  const itens = [
    ['minimo', 'mínimo de 8 caracteres'],
    ['maiuscula', '1 letra maiúscula'],
    ['minuscula', '1 letra minúscula'],
    ['numero', '1 número'],
    ['especial', '1 caractere especial (@$!%*?&_-#)'],
    ['tamanhoMaximo', 'até 72 bytes'],
  ];

  return (
    <ul className="mt-2 space-y-1 text-xs font-semibold text-slate-500">
      {itens.map(([chave, texto]) => (
        <li
          key={chave}
          className={regras[chave] ? 'text-emerald-600' : 'text-slate-500'}
        >
          {regras[chave] ? 'OK' : '-'} {texto}
        </li>
      ))}
    </ul>
  );
}

export default function Usuarios() {
  const navigate = useNavigate();
  const deviceInfo = useDeviceInfo();

  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const [tela, setTela] = useState('lista');
  const [editandoId, setEditandoId] = useState(null);

  const [busca, setBusca] = useState('');
  const [filtroPerfil, setFiltroPerfil] = useState('');
  const [filtroAtivo, setFiltroAtivo] = useState('true');
  const [paginaUsuarios, setPaginaUsuarios] = useState(1);
  const usuariosPorPagina = 15;

  const [form, setForm] = useState(FORM_INICIAL);
  const [errosCampo, setErrosCampo] = useState({});
  const [senhaRedefinir, setSenhaRedefinir] = useState('');
  const [erroSenhaRedefinir, setErroSenhaRedefinir] = useState('');
  const [usuarioSenha, setUsuarioSenha] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [processandoFoto, setProcessandoFoto] = useState(false);

  const podeGerenciarGlobais = useMemo(() => usuarioLogadoEhGlobal(), []);
  const podeGerenciar = useMemo(() => usuarioEhGestor() || podeGerenciarGlobais, [podeGerenciarGlobais]);
  const perfisDisponiveis = useMemo(
    () => PERFIS.filter((perfil) => podeGerenciarGlobais || perfil !== 'Global'),
    [podeGerenciarGlobais]
  );
  const regrasSenhaInicial = useMemo(() => obterRegrasSenha(form.senha), [form.senha]);
  const regrasSenhaRedefinicao = useMemo(() => obterRegrasSenha(senhaRedefinir), [senhaRedefinir]);
  const exibindoApenasUsuariosAtivos = filtroAtivo === 'true';
  const totalPaginasUsuarios = Math.max(1, Math.ceil(usuarios.length / usuariosPorPagina));
  const paginaUsuariosSegura = Math.min(paginaUsuarios, totalPaginasUsuarios);
  const indiceInicialUsuarios = (paginaUsuariosSegura - 1) * usuariosPorPagina;
  const indiceFinalUsuarios = indiceInicialUsuarios + usuariosPorPagina;
  const usuariosVisiveis = usuarios.slice(indiceInicialUsuarios, indiceFinalUsuarios);

  const irParaPaginaUsuarios = (novaPagina) => {
    setPaginaUsuarios(Math.min(Math.max(novaPagina, 1), totalPaginasUsuarios));
  };

  useEffect(() => {
    if (!localStorage.getItem('@CareCore:token') && !localStorage.getItem('token')) {
      navigate('/');
    }
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
      setPaginaUsuarios(1);
    } catch (error) {
      setErro(obterMensagemErro(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!localStorage.getItem('@CareCore:token') && !localStorage.getItem('token')) return;

    const atrasoBusca = busca.trim() ? 350 : 0;
    const timer = window.setTimeout(() => {
      carregarUsuarios();
    }, atrasoBusca);

    return () => window.clearTimeout(timer);
  }, [busca, filtroPerfil, filtroAtivo]);

  const limparAlertas = () => {
    setErro('');
    setSucesso('');
  };

  const limparErroCampo = (campo) => {
    setErrosCampo((atual) => ({ ...atual, [campo]: '' }));
  };

  const validarCampo = (campo, valorAtual = form[campo]) => {
    const valor = String(valorAtual || '').trim();
    let mensagem = '';

    if (campo === 'nome' && !valor) {
      mensagem = 'Informe o nome.';
    }

    if (campo === 'email') {
      if (!valor) {
        mensagem = 'Informe o e-mail.';
      } else if (!emailValido(valor)) {
        mensagem = 'Informe um e-mail válido.';
      }
    }

    if (campo === 'senha' && !editandoId) {
      if (!valor) {
        mensagem = 'Informe uma senha inicial para o usuário.';
      } else if (!senhaAtendePolitica(valor)) {
        mensagem = 'A senha ainda não atende aos critérios mínimos.';
      }
    }

    if (campo === 'cpf' && valor && !cpfValido(valor)) {
      mensagem = 'CPF inválido.';
    }

    if (campo === 'telefone' && valor && !telefoneValido(valor)) {
      mensagem = 'Telefone inválido. Use DDD + número.';
    }

    if (campo === 'cep' && valor && !cepValido(valor)) {
      mensagem = 'CEP incompleto.';
    }

    setErrosCampo((atual) => ({ ...atual, [campo]: mensagem }));
    return !mensagem;
  };

  const abrirNovo = () => {
    limparAlertas();
    setErrosCampo({});
    setForm(FORM_INICIAL);
    setEditandoId(null);
    setTela('form');
  };

  const abrirEdicao = async (usuarioId) => {
    try {
      limparAlertas();
      setErrosCampo({});
      setLoading(true);

      const response = await api.get(`/api/usuarios/${usuarioId}`);
      const usuario = response.data;

      setForm({
        ...FORM_INICIAL,
        nome: usuario.nome || '',
        email: usuario.email || '',
        senha: '',
        perfil_acesso: usuario.perfil_acesso || 'Consulta',
        is_global: usuario.is_global === true,
        ativo: usuario.ativo !== false,
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

    if (errosCampo[campo]) limparErroCampo(campo);

    setForm((atual) => ({
      ...atual,
      [campo]: valorFinal,
    }));
  };

  const buscarEnderecoPorCEP = async (valor = form.cep) => {
    const cep = limparMascara(valor);

    if (!cep) return;

    if (cep.length !== 8) {
      setErrosCampo((atual) => ({ ...atual, cep: 'CEP incompleto.' }));
      return;
    }

    try {
      limparAlertas();

      const endereco = await consultarCep(cep);

      if (!endereco) {
        setErrosCampo((atual) => ({ ...atual, cep: 'CEP não encontrado.' }));
        return;
      }

      setErrosCampo((atual) => ({ ...atual, cep: '' }));
      setForm((atual) => ({
        ...atual,
        logradouro: endereco.logradouro || atual.logradouro,
        bairro: endereco.bairro || atual.bairro,
        cidade: endereco.cidade || atual.cidade,
        uf: endereco.uf || atual.uf,
      }));
    } catch {
      setErrosCampo((atual) => ({ ...atual, cep: 'Não foi possível consultar o CEP agora.' }));
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
        setErro('Seu navegador não permite captura direta pela câmera. Use a opção de enviar arquivo.');
        return;
      }

      // Importante:
      // primeiro renderiza o bloco <video>, depois conecta o stream.
      // Se o stream for criado antes do vídeo existir no DOM, a tela fica preta.
      setCameraAtiva(true);

      await new Promise((resolve) => {
        window.setTimeout(resolve, 150);
      });

      const stream = await navigator.mediaDevices.getUserMedia(
        getPreferredCameraConstraints(deviceInfo, { square: true })
      );

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;

        await videoRef.current.play();
      }
    } catch (error) {
      console.error('Erro ao acessar webcam:', error);
      setErro(getCameraUnavailableMessage(deviceInfo, 'a câmera'));
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
    const camposValidos = [
      validarCampo('nome'),
      validarCampo('email'),
      validarCampo('cpf'),
      validarCampo('telefone'),
      validarCampo('cep'),
      validarCampo('senha'),
    ].every(Boolean);

    if (!camposValidos) return 'Corrija os campos destacados antes de salvar.';
    if (!form.perfil_acesso) return 'Selecione o perfil de acesso.';

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
    delete payload.ativo;

    if (!podeGerenciarGlobais) {
      delete payload.is_global;
    }

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
      setErrosCampo({});
      await carregarUsuarios();
    } catch (error) {
      setErro(obterMensagemErro(error));
    } finally {
      setSalvando(false);
    }
  };

  const montarDadosDesligamento = (usuario, dados = {}) => {
    const dataAtual = dados.data_desligamento || usuario.data_desligamento || dataLocalISO();
    const motivoAtual = dados.motivo_desligamento || usuario.motivo_desligamento || '';
    const veioDoFormulario = Object.prototype.hasOwnProperty.call(dados, 'data_desligamento') ||
      Object.prototype.hasOwnProperty.call(dados, 'motivo_desligamento');

    if (veioDoFormulario) {
      const dataDesligamento = (dados.data_desligamento || '').trim();
      const motivoDesligamento = (dados.motivo_desligamento || '').trim();

      if (!dataDesligamento) {
        const mensagem = 'Preencha a data de desligamento antes de inativar o usuário.';
        setErro(mensagem);
        window.alert(mensagem);
        return null;
      }

      if (!motivoDesligamento) {
        const mensagem = 'Preencha o motivo do desligamento antes de inativar o usuário.';
        setErro(mensagem);
        window.alert(mensagem);
        return null;
      }

      return {
        data_desligamento: dataDesligamento,
        motivo_desligamento: motivoDesligamento,
      };
    }

    const dataInformada = window.prompt(
      `Informe a data de desligamento de ${usuario.nome} (DD/MM/AAAA):`,
      formatarDataBR(dataAtual)
    );

    if (dataInformada === null) return null;

    const dataDesligamento = dataBRParaISO(dataInformada);

    if (!dataDesligamento) {
      const mensagem = 'Informe a data de desligamento no formato DD/MM/AAAA.';
      setErro(mensagem);
      window.alert(mensagem);
      return null;
    }

    const motivoInformado = window.prompt(
      `Informe o motivo do desligamento de ${usuario.nome}:`,
      motivoAtual
    );

    if (motivoInformado === null) return null;

    const motivoDesligamento = motivoInformado.trim();

    if (!motivoDesligamento) {
      const mensagem = 'Informe o motivo do desligamento.';
      setErro(mensagem);
      window.alert(mensagem);
      return null;
    }

    return {
      data_desligamento: dataDesligamento,
      motivo_desligamento: motivoDesligamento,
    };
  };

  const alterarStatus = async (usuario, dadosDesligamento = {}) => {
    if (!podeGerenciar) return;

    const novoStatus = !usuario.ativo;
    const texto = novoStatus ? 'ativar' : 'inativar';
    const payload = { ativo: novoStatus };

    if (!novoStatus) {
      const dadosObrigatorios = montarDadosDesligamento(usuario, dadosDesligamento);

      if (!dadosObrigatorios) return;

      Object.assign(payload, dadosObrigatorios);
    }

    const confirmar = window.confirm(
      `Deseja realmente ${texto} o usuário ${usuario.nome}?`
    );

    if (!confirmar) return;

    try {
      limparAlertas();

      await api.patch(`/api/usuarios/${usuario.id}/status`, {
        ...payload,
      });

      setSucesso(
        novoStatus
          ? 'Usuário ativado com sucesso.'
          : 'Usuário inativado com sucesso.'
      );

      await carregarUsuarios();

      if (editandoId === usuario.id) {
        setForm((atual) => ({
          ...atual,
          ativo: novoStatus,
          ...(payload.data_desligamento ? { data_desligamento: payload.data_desligamento } : {}),
          ...(payload.motivo_desligamento ? { motivo_desligamento: payload.motivo_desligamento } : {}),
        }));
      }
    } catch (error) {
      setErro(obterMensagemErro(error));
    }
  };

  const abrirRedefinirSenha = (usuario) => {
    setUsuarioSenha(usuario);
    setSenhaRedefinir('');
    setErroSenhaRedefinir('');
    limparAlertas();
  };

  const redefinirSenha = async (e) => {
    e.preventDefault();

    if (!usuarioSenha) return;

    if (!senhaAtendePolitica(senhaRedefinir)) {
      setErroSenhaRedefinir('A senha ainda não atende aos critérios mínimos.');
      setErro('Informe uma nova senha forte.');
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
      setErroSenhaRedefinir('');
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
    setErrosCampo({});
    limparAlertas();
  };

  return (
    <AppShell>
      <Sidebar />

      <MainShell>
        <PageHeader
          eyebrow="Administração"
          title="Usuários e Permissões"
          subtitle="Gestão da equipe institucional, perfis de acesso e status de usuários."
          icon="○"
          actions={(
            <>
            {tela === 'lista' && podeGerenciar && (
              <PremiumButton
                type="button"
                onClick={abrirNovo}
              >
                + Novo usuário
              </PremiumButton>
            )}

            {tela === 'form' && (
              <PremiumButton
                type="button"
                variant="secondary"
                onClick={voltarLista}
              >
                Voltar
              </PremiumButton>
            )}
            </>
          )}
        />

        <ScrollArea>

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
          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-5 grid gap-3 md:grid-cols-4">
              <input
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setPaginaUsuarios(1);
                }}
                placeholder="Buscar por nome, e-mail, CPF, cargo ou setor"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 md:col-span-2"
              />

              <select
                value={filtroPerfil}
                onChange={(e) => {
                  setFiltroPerfil(e.target.value);
                  setPaginaUsuarios(1);
                }}
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
                onChange={(e) => {
                  setFiltroAtivo(e.target.value);
                  setPaginaUsuarios(1);
                }}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              >
                <option value="">Todos os status</option>
                <option value="true">Ativos</option>
                <option value="false">Inativos</option>
              </select>

            </div>

            {exibindoApenasUsuariosAtivos && (
              <p className="mb-5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-medium text-blue-700">
                Exibindo apenas usuários ativos. Para consultar históricos ou desligados, altere o filtro de status para Todos os status ou Inativos.
              </p>
            )}

            {loading ? (
              <div className="py-12 text-center text-sm text-slate-500">
                Carregando usuários...
              </div>
            ) : usuarios.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500">
                Nenhum usuário encontrado.
              </div>
            ) : (
              <>
              <div className="space-y-3 md:hidden">
                {usuariosVisiveis.map((usuario) => (
                  <article
                    key={usuario.id}
                    className="rounded-3xl border border-slate-100 bg-slate-50 p-4 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <UserAvatar usuario={usuario} size="md" />

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-slate-900">
                          {usuario.nome}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {usuario.email}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <BadgePerfil perfil={usuario.perfil_acesso} />
                          <BadgeStatus ativo={usuario.ativo} />
                          {usuario.is_global && <BadgeGlobal />}
                        </div>

                        <div className="mt-3 rounded-2xl bg-white px-3 py-2 text-xs text-slate-500">
                          <p>
                            <strong className="text-slate-700">Cargo:</strong> {usuario.cargo || '-'}
                          </p>
                          <p>
                            <strong className="text-slate-700">Setor:</strong> {usuario.setor || 'Sem setor'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-2">
                      <button
                        type="button"
                        onClick={() => abrirEdicao(usuario.id)}
                        className="min-h-11 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"
                      >
                        Ver/Editar
                      </button>

                      {podeGerenciar && (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => abrirRedefinirSenha(usuario)}
                            className="min-h-11 rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700"
                          >
                            Senha
                          </button>

                          <button
                            type="button"
                            onClick={() => alterarStatus(usuario)}
                            className={`min-h-11 rounded-2xl border px-3 py-2 text-sm font-bold ${
                              usuario.ativo
                                ? 'border-red-100 bg-red-50 text-red-700'
                                : 'border-emerald-100 bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {usuario.ativo ? 'Inativar' : 'Ativar'}
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
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
                    {usuariosVisiveis.map((usuario) => (
                      <tr key={usuario.id} className="bg-slate-50">
                        <td className="rounded-l-xl px-3 py-3">
                          <div className="flex items-center gap-3">
                            <UserAvatar usuario={usuario} size="sm" />

                            <div>
                              <p className="font-semibold text-slate-900">
                                {usuario.nome}
                                {usuario.is_global && (
                                  <span className="ml-2 align-middle">
                                    <BadgeGlobal />
                                  </span>
                                )}
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

              {usuarios.length > usuariosPorPagina && (
                <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
                  <span>
                    Exibindo {indiceInicialUsuarios + 1} a {Math.min(indiceFinalUsuarios, usuarios.length)} de {usuarios.length} usuários
                  </span>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => irParaPaginaUsuarios(paginaUsuariosSegura - 1)}
                      disabled={paginaUsuariosSegura === 1}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Anterior
                    </button>

                    {Array.from({ length: totalPaginasUsuarios }, (_, index) => index + 1).map((pagina) => (
                      <button
                        key={pagina}
                        type="button"
                        onClick={() => irParaPaginaUsuarios(pagina)}
                        className={`h-8 min-w-8 rounded-xl border px-2 text-xs font-bold ${
                          pagina === paginaUsuariosSegura
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {pagina}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => irParaPaginaUsuarios(paginaUsuariosSegura + 1)}
                      disabled={paginaUsuariosSegura === totalPaginasUsuarios}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              )}
              </>
            )}
          </section>
        )}

        {tela === 'form' && (
          <form
            onSubmit={salvarUsuario}
            autoComplete="off"
            className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm"
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
              <section className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
                  Acesso
                </h3>

                <div className="grid gap-4 md:grid-cols-3">
                  <CampoTexto
                    label="Nome"
                    name="novo_usuario_nome"
                    autoComplete="off"
                    value={form.nome}
                    onChange={(v) => atualizarCampo('nome', v)}
                    onBlur={() => validarCampo('nome')}
                    erro={errosCampo.nome}
                    required
                  />
                  <CampoTexto
                    label="E-mail"
                    name="novo_usuario_email"
                    autoComplete="off"
                    type="email"
                    value={form.email}
                    onChange={(v) => atualizarCampo('email', v)}
                    onBlur={() => validarCampo('email')}
                    erro={errosCampo.email}
                    placeholder="usuario@email.com"
                    required
                  />

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
                      {perfisDisponiveis.map((perfil) => (
                        <option key={perfil} value={perfil}>
                          {perfil}
                        </option>
                      ))}
                    </select>
                  </div>

                  {!editandoId && (
                    <div>
                      <CampoTexto
                        label="Senha inicial"
                        name="nova_senha_usuario"
                        autoComplete="new-password"
                        type="password"
                        value={form.senha}
                        onChange={(v) => atualizarCampo('senha', v)}
                        onBlur={() => validarCampo('senha')}
                        erro={errosCampo.senha}
                        required
                        maxLength={72}
                      />
                      <ListaRegrasSenha regras={regrasSenhaInicial} />
                    </div>
                  )}

                  {podeGerenciarGlobais && (
                    <label className="flex min-h-[68px] cursor-pointer items-start gap-3 rounded-2xl border border-violet-100 bg-violet-50/70 p-3 md:col-span-3">
                      <input
                        type="checkbox"
                        checked={form.is_global === true}
                        onChange={(e) => atualizarCampo('is_global', e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-violet-300 text-violet-600 focus:ring-violet-500"
                      />
                      <span>
                        <span className="block text-sm font-black text-violet-950">
                          Usuário global da organização
                        </span>
                        <span className="mt-1 block text-xs font-semibold text-violet-700">
                          Pode acessar e alternar entre todos os projetos desta organização.
                        </span>
                      </span>
                    </label>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
                  Dados pessoais
                </h3>

                <div className="grid gap-4 md:grid-cols-4">
                  <CampoTexto
                    label="CPF"
                    name="usuario_cpf"
                    value={form.cpf}
                    onChange={(v) => atualizarCampo('cpf', v)}
                    onBlur={() => validarCampo('cpf')}
                    erro={errosCampo.cpf}
                    placeholder="000.000.000-00"
                  />
                  <CampoTexto
                    label="Telefone"
                    name="usuario_telefone"
                    value={form.telefone}
                    onChange={(v) => atualizarCampo('telefone', v)}
                    onBlur={() => validarCampo('telefone')}
                    erro={errosCampo.telefone}
                    placeholder="(00) 00000-0000"
                  />
                  <CampoTexto
                    label={(
                      <>
                        Data de nascimento
                        {form.data_nascimento && (
                          <span className="ml-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-brand">
                            {calcularIdade(form.data_nascimento)} anos
                          </span>
                        )}
                      </>
                    )}
                    type="date"
                    value={form.data_nascimento}
                    onChange={(v) => atualizarCampo('data_nascimento', v)}
                  />

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
                    isTouchDevice={deviceInfo.isTouchDevice}
                    isSecureCameraContext={deviceInfo.isSecureCameraContext}
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
                  Endereço
                </h3>

                <div className="grid gap-4 md:grid-cols-4">
                  <CampoTexto
                    label="CEP"
                    value={form.cep}
                    onChange={(v) => atualizarCampo('cep', v)}
                    onBlur={() => {
                      if (validarCampo('cep')) {
                        buscarEnderecoPorCEP();
                      }
                    }}
                    erro={errosCampo.cep}
                    placeholder="00000-000"
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

              <section className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
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

            <div className="mt-6 flex flex-col-reverse justify-end gap-3 sm:flex-row">
              <PremiumButton
                type="button"
                variant="secondary"
                onClick={voltarLista}
              >
                Cancelar
              </PremiumButton>

              {podeGerenciar && editandoId && (
                <button
                  type="button"
                  onClick={() => alterarStatus(
                    {
                      id: editandoId,
                      nome: form.nome,
                      ativo: form.ativo,
                    },
                    {
                      data_desligamento: form.data_desligamento,
                      motivo_desligamento: form.motivo_desligamento,
                    }
                  )}
                  className={`min-h-11 rounded-2xl border px-4 py-2 text-sm font-bold transition ${
                    form.ativo
                      ? 'border-red-100 bg-red-50 text-red-700 hover:bg-red-100'
                      : 'border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  {form.ativo ? 'Inativar usuário' : 'Reativar usuário'}
                </button>
              )}

              {podeGerenciar && (
                <PremiumButton
                  type="submit"
                  disabled={salvando}
                >
                  {salvando ? 'Salvando...' : 'Salvar usuário'}
                </PremiumButton>
              )}
            </div>
          </form>
        )}

        {usuarioSenha && (
          <div className="carecore-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <form
              onSubmit={redefinirSenha}
              className="carecore-modal-panel w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
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
                  onChange={(valor) => {
                    setSenhaRedefinir(valor);
                    setErroSenhaRedefinir('');
                  }}
                  onBlur={() => {
                    if (senhaRedefinir && !senhaAtendePolitica(senhaRedefinir)) {
                      setErroSenhaRedefinir('A senha ainda não atende aos critérios mínimos.');
                    }
                  }}
                  erro={erroSenhaRedefinir}
                  name="redefinir_senha_usuario"
                  autoComplete="new-password"
                  required
                  maxLength={72}
                />
                <ListaRegrasSenha regras={regrasSenhaRedefinicao} />
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
        </ScrollArea>
      </MainShell>
    </AppShell>
  );
}
