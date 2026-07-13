import { useEffect, useState } from 'react';
import {
  Bell,
  BedDouble,
  CalendarClock,
  CalendarRange,
  ChartNoAxesColumnIncreasing,
  ChevronDown,
  ClipboardList,
  CreditCard,
  FileBarChart,
  Fingerprint,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  MessageSquareWarning,
  PackageOpen,
  PanelsTopLeft,
  Users,
  UserRoundCog,
  WashingMachine,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import logoCarecore from './assets/logo.PNG';
import PasskeysModal from './components/PasskeysModal';
import UserAvatar from './components/UserAvatar';
import api, { limparSessaoLocal } from './services/api';
import { API_ROOT } from './config/apiBase';
import { carecoreVersaoRotulo } from './config/versao';
import { MENU_ACOMPANHAMENTOS, MENU_CONVIVENTES } from './config/acompanhamentosConfig';
import { acompanhamentoAtivo, moduloAtivo } from './config/configOperacionalDefaults';
import { useConfigOperacional } from './hooks/useConfigOperacional';
import { usuarioEhOficineiro, normalizarPerfilRbac } from './utils/rbacUtils';
import { decodificarPayloadJwt } from './utils/jwtUtils';
import {
  DIREITOS_RESERVADOS_TITULO,
  obterUrlDireitosReservados,
} from './utils/direitosReservados';

const TITULOS_NOME_IGNORADOS = new Set([
  'dra',
  'dra.',
  'dr',
  'dr.',
  'sr',
  'sr.',
  'sra',
  'sra.',
  'prof',
  'prof.',
]);

/** Nome curto no rodapé — primeiro + segundo nome, sem estourar a sidebar. */
function nomeExibicaoSidebar(nomeCompleto) {
  if (!nomeCompleto?.trim()) return 'Usuário';

  const semParenteses = nomeCompleto.split('(')[0].trim();
  const partes = semParenteses.split(/\s+/).filter(Boolean);
  const significativas = partes.filter((parte, index) => {
    if (index === 0 && TITULOS_NOME_IGNORADOS.has(parte.toLowerCase())) {
      return false;
    }

    return true;
  });

  const nomesExibicao = significativas.slice(0, 2);
  const nomeCurto = nomesExibicao.join(' ') || partes.slice(0, 2).join(' ') || semParenteses;

  if (nomeCurto.length <= 22) {
    return nomeCurto;
  }

  return `${nomeCurto.slice(0, 21).trim()}…`;
}

function IconBox({ icon: Icon, active }) {
  return (
    <span
      className={`
        carecore-menu-icon
        ${active ? 'carecore-menu-icon-active' : ''}
      `}
    >
      {Icon ? <Icon size={17} strokeWidth={2.2} /> : null}
    </span>
  );
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

function extrairSlugAcompanhamento(path) {
  const match = String(path || '').match(/^\/conviventes\/acompanhamentos\/([^/]+)$/);
  return match ? match[1] : null;
}

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { config: configOperacional } = useConfigOperacional();
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  const [menusExpandidos, setMenusExpandidos] = useState({});
  const [historicoLegadoApiAtivo, setHistoricoLegadoApiAtivo] = useState(false);
  const [cobrancasClienteVisivel, setCobrancasClienteVisivel] = useState(false);
  const [modalSenhaAberto, setModalSenhaAberto] = useState(false);
  const [modalPasskeysAberto, setModalPasskeysAberto] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [erroSenha, setErroSenha] = useState('');
  const [sucessoSenha, setSucessoSenha] = useState('');
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const token = localStorage.getItem('@CareCore:token') || localStorage.getItem('token');

  let perfilUsuario = '';
  let nomeUsuario = 'Usuário';
  let usuarioSessao = null;
  let isGlobal = false;
  let isManutencao = false;

  try {
    const usuarioRaw = localStorage.getItem('@CareCore:user') || localStorage.getItem('usuario');

    if (usuarioRaw) {
      usuarioSessao = JSON.parse(usuarioRaw);
    }

    if (token) {
      const payload = decodificarPayloadJwt(token) || {};
      perfilUsuario = payload.perfil_acesso || '';
      nomeUsuario = usuarioSessao?.nome || payload.nome || payload.email || 'Usuário';
      isGlobal = usuarioSessao?.is_global === true || payload.is_global === true;
      isManutencao = usuarioSessao?.is_manutencao === true || payload.is_manutencao === true || perfilUsuario === 'Manutenção';
    }
  } catch (e) {
    console.error('Erro ao ler perfil no menu lateral', e);
  }

  if (isManutencao) {
    nomeUsuario = 'Manutenção CareCore+';
    usuarioSessao = {
      ...(usuarioSessao || {}),
      nome: nomeUsuario,
    };
  }

  const perfilNormalizado = {
    Gestao: 'Gestor',
    Gestão: 'Gestor',
    Gerente: 'Gestor',
    Tecnico: 'Técnico',
    Executivo: 'Global',
    Manutencao: 'Manutenção',
  }[perfilUsuario] || normalizarPerfilRbac(perfilUsuario);

  const ehOficineiro = usuarioEhOficineiro({
    perfil_acesso: perfilNormalizado,
    is_manutencao: isManutencao,
  });

  const nomeExibicao = nomeExibicaoSidebar(nomeUsuario);
  const novaSenhaForte = senhaAtendePolitica(novaSenha);

  const historicoLegadoAtivo = configOperacional
    ? moduloAtivo(configOperacional, 'historico_legado')
    : historicoLegadoApiAtivo;

  useEffect(() => {
    if (!token) {
      setHistoricoLegadoApiAtivo(false);
      setCobrancasClienteVisivel(false);
      return;
    }

    let ativo = true;
    api.get(`${API_ROOT}/historico-legado/config`)
      .then((response) => {
        if (ativo) setHistoricoLegadoApiAtivo(response.data?.ativo === true);
      })
      .catch(() => {
        if (ativo) setHistoricoLegadoApiAtivo(false);
      });

    api.get(`${API_ROOT}/cobrancas/modulo/status`)
      .then((response) => {
        if (ativo) setCobrancasClienteVisivel(response.data?.cliente_visivel === true);
      })
      .catch(() => {
        if (ativo) setCobrancasClienteVisivel(false);
      });

    return () => {
      ativo = false;
    };
  }, [token]);

  const menuGroups = [
    {
      title: 'Menu',
      items: [
        {
          path: '/dashboard',
          icon: LayoutDashboard,
          label: 'Dashboard'
        },
        {
          path: '/conviventes',
          icon: Users,
          label: 'Conviventes',
          perfis: ['Gestor', 'Técnico', 'Orientador', 'Administrativo', 'Global'],
          children: [
            MENU_CONVIVENTES,
            MENU_ACOMPANHAMENTOS,
          ],
        },
        {
          path: '/quartos',
          icon: BedDouble,
          label: 'Acomodações',
          perfis: ['Gestor', 'Técnico', 'Orientador', 'Administrativo']
        },
        {
          path: '/ocorrencias',
          icon: MessageSquareWarning,
          label: 'Comunicação',
          perfis: ['Gestor', 'Técnico', 'Orientador', 'Administrativo'],
          children: [
            {
              path: '/ocorrencias',
              icon: MessageSquareWarning,
              label:
                perfilUsuario === 'Orientador'
                  ? 'Minhas Ocorrências'
                  : 'Ocorrências'
            },
            {
              path: '/avisos',
              icon: Bell,
              label: 'Avisos'
            }
          ]
        },
        {
          path: '/avisos',
          icon: Bell,
          label: 'Avisos',
          perfis: ['Global'],
          globalOnly: true
        },
        {
          path: '/rotina',
          icon: CalendarClock,
          label: 'Rotina Diária',
          perfis: ['Gestor', 'Técnico', 'Orientador', 'Administrativo', 'Global'],
          children: [
            {
              path: '/rotina',
              icon: CalendarClock,
              label: 'Registro da Rotina',
              perfis: ['Gestor', 'Técnico', 'Orientador', 'Administrativo', 'Global'],
            },
            {
              path: '/rotina/lavanderia',
              icon: WashingMachine,
              label: 'Lavanderia'
            },
            {
              path: '/rotina/pertences-recolhidos',
              icon: PackageOpen,
              label: 'Pertences Recolhidos'
            },
            {
              path: '/rotina/dashboard',
              icon: ChartNoAxesColumnIncreasing,
              label: 'Dashboard Operacional',
              perfis: ['Gestor', 'Técnico', 'Orientador', 'Administrativo', 'Global'],
            },
            {
              path: '/rotina/historico',
              icon: ClipboardList,
              label: 'Histórico da Rotina',
              perfis: ['Gestor', 'Técnico', 'Orientador', 'Administrativo', 'Global'],
            },
            {
              path: '/rotina/ajustes-totais',
              icon: ClipboardList,
              label: 'Ajustes de Totais',
              perfis: ['Gestor']
            }
          ]
        },
        {
          path: '/atividades',
          icon: CalendarRange,
          label: 'Atividades',
          perfis: ['Gestor', 'Técnico', 'Orientador', 'Administrativo', 'Global', 'Oficineiro(a)'],
          children: [
            {
              path: '/atividades',
              icon: CalendarRange,
              label: 'Cadastro'
            },
            {
              path: '/atividades/chamada',
              icon: CalendarRange,
              label: 'Chamada de presença'
            },
            {
              path: '/atividades/grade',
              icon: ClipboardList,
              label: 'Grade mensal'
            },
            {
              path: '/atividades/conteudo',
              icon: FileBarChart,
              label: 'Conteúdo das sessões'
            },
            {
              path: '/atividades/relatorios',
              icon: FileBarChart,
              label: 'Relatórios'
            },
            {
              path: '/atividades/conferencia-sisa',
              icon: FileBarChart,
              label: 'Conferência SISA'
            },
            {
              path: '/atividades/pontos-brindes',
              icon: FileBarChart,
              label: 'Pontos e brindes'
            }
          ]
        },
        {
          path: '/convenio-sisa',
          icon: PanelsTopLeft,
          label: 'Convênio / SISA',
          perfis: ['Gestor', 'Técnico', 'Administrativo']
        },
        {
          path: '/relatorios',
          icon: FileBarChart,
          label: 'Relatórios',
          children: [
            {
              path: '/relatorios',
              icon: FileBarChart,
              label: 'Central de relatórios',
            },
            {
              path: '/relatorios/cadastros-novos',
              icon: FileBarChart,
              label: 'Cadastros novos',
            },
            {
              path: '/relatorios/presenca-ausencia',
              icon: FileBarChart,
              label: 'Presença e ausência',
            },
          ],
        },
        {
          path: '/historico-legado',
          icon: ClipboardList,
          label: 'Histórico Legado',
          perfis: ['Gestor', 'Técnico', 'Orientador', 'Administrativo', 'Global'],
          feature: 'historicoLegado',
          children: [
            {
              path: '/historico-legado',
              icon: ClipboardList,
              label: 'Ocorrências/Rotina'
            },
            {
              path: '/historico-legado/rotina',
              icon: CalendarClock,
              label: 'Rotina Legada'
            },
            {
              path: '/historico-legado/rotina/presencas',
              icon: FileBarChart,
              label: 'Presenças legado'
            }
          ]
        },
        {
          path: '/usuarios',
          icon: UserRoundCog,
          label: 'Usuários',
          perfis: ['Gestor', 'Global']
        },
        {
          path: '/suporte',
          icon: LifeBuoy,
          label: 'Suporte'
        },
      ]
    },
    {
      title: 'Gestão Global',
      items: [
        {
          path: '/gestao-global',
          icon: ChartNoAxesColumnIncreasing,
          label: 'Visão Gerencial',
          perfis: ['Gestor', 'Global'],
          globalOnly: true
        },
        {
          path: '/organizacao',
          icon: PanelsTopLeft,
          label: 'Projetos',
          perfis: ['Gestor', 'Global'],
          globalOnly: true
        },
        {
          path: '/cobrancas',
          icon: CreditCard,
          label: 'Cobranças',
          perfis: ['Manutenção'],
        },
        {
          path: '/admin/cobrancas',
          icon: CreditCard,
          label: 'Operação Financeira',
          perfis: ['Manutenção']
        }
      ]
    },
  ];

  const handleLogout = () => {
    limparSessaoLocal();
    navigate('/');
  };

  const abrirModalSenha = () => {
    setSenhaAtual('');
    setNovaSenha('');
    setConfirmarSenha('');
    setErroSenha('');
    setSucessoSenha('');
    setModalSenhaAberto(true);
  };

  const fecharModalSenha = () => {
    if (salvandoSenha) return;
    setModalSenhaAberto(false);
    setSenhaAtual('');
    setNovaSenha('');
    setConfirmarSenha('');
    setErroSenha('');
    setSucessoSenha('');
  };

  const alterarMinhaSenha = async (event) => {
    event.preventDefault();
    setErroSenha('');
    setSucessoSenha('');

    if (!senhaAtual) {
      setErroSenha('Informe a senha atual.');
      return;
    }

    if (!novaSenhaForte) {
      setErroSenha('A nova senha ainda não atende aos critérios mínimos.');
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setErroSenha('A confirmação da nova senha não confere.');
      return;
    }

    if (senhaAtual === novaSenha) {
      setErroSenha('A nova senha deve ser diferente da senha atual.');
      return;
    }

    try {
      setSalvandoSenha(true);
      await api.patch('/api/usuarios/me/senha/alterar', {
        senha_atual: senhaAtual,
        nova_senha: novaSenha,
      });

      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');
      setSucessoSenha('Senha alterada com sucesso.');
    } catch (error) {
      setErroSenha(
        error?.response?.data?.detail ||
        'Não foi possível alterar sua senha.'
      );
    } finally {
      setSalvandoSenha(false);
    }
  };

  const isActivePath = (path) => {
    if (path === '/rotina') {
      return location.pathname === '/rotina';
    }

    if (path === '/conviventes') {
      return location.pathname === '/conviventes';
    }

    if (path === '/conviventes/acompanhamentos') {
      return location.pathname.startsWith('/conviventes/acompanhamentos');
    }

    return (
      location.pathname === path ||
      location.pathname.startsWith(path + '/')
    );
  };

  const itemTemDescendenteAtivo = (item) => (
    isActivePath(item.path) ||
    item.children?.some(child => itemTemDescendenteAtivo(child))
  );

  const usuarioPodeVerItem = (item) => {
    if (ehOficineiro) {
      return Boolean(item.path?.startsWith('/atividades'));
    }

    const perfilPermitido = isManutencao
      || !item.perfis
      || item.perfis.includes(perfilNormalizado);
    const globalPermitido = !item.globalOnly || isGlobal;
    if (item.path === '/convenio-sisa' && configOperacional && !moduloAtivo(configOperacional, 'sisa')) {
      return false;
    }
    const featurePermitida =
      (item.feature !== 'historicoLegado' || historicoLegadoAtivo) &&
      (item.feature !== 'cobrancasCliente' || cobrancasClienteVisivel || isManutencao);
    return perfilPermitido && globalPermitido && featurePermitida;
  };

  const filtrarChildrenRecursivo = (children) => (
    children
      ?.filter((child) => {
        if (!usuarioPodeVerItem(child)) return false;
        const slug = extrairSlugAcompanhamento(child.path);
        if (slug && configOperacional && !acompanhamentoAtivo(configOperacional, slug)) {
          return false;
        }
        return true;
      })
      .map(child => ({
        ...child,
        children: filtrarChildrenRecursivo(child.children),
      }))
  );

  const itensVisiveisPorGrupo = menuGroups.map((group) => ({
    ...group,
    items: group.items
      .filter(usuarioPodeVerItem)
      .map(item => ({
        ...item,
        children: filtrarChildrenRecursivo(item.children),
      })),
  })).filter(group => group.items.length > 0);

  const isActiveItem = (item) => itemTemDescendenteAtivo(item);

  const menuEstaExpandido = (path, ativoPorRota) => (
    Object.prototype.hasOwnProperty.call(menusExpandidos, path)
      ? menusExpandidos[path]
      : ativoPorRota
  );

  const renderSubmenuLabel = (child) => {
    const tituloCompleto = child.labelTitle || child.label;

    if (child.menuLabelLinhas?.length) {
      return (
        <span
          className="carecore-submenu-label carecore-submenu-label-multiline"
          title={tituloCompleto}
        >
          {child.menuLabelLinhas.map((linha) => (
            <span key={linha} className="carecore-submenu-label-line">{linha}</span>
          ))}
        </span>
      );
    }

    return (
      <span
        className="carecore-submenu-label"
        title={tituloCompleto}
      >
        {child.label}
      </span>
    );
  };

  const renderSubmenuItems = (children, { onNavigate, depth = 0 } = {}) => (
    children.map(child => {
      const childTemSubmenu = child.children?.length > 0;
      const childActive = itemTemDescendenteAtivo(child);
      const childExpanded = childTemSubmenu && menuEstaExpandido(child.path, childActive);

      if (childTemSubmenu) {
        return (
          <div key={child.path} className={depth > 0 ? 'carecore-submenu-nested' : ''}>
            <Link
              to={child.children[0]?.path || child.path}
              onClick={(event) => {
                if (childActive) {
                  event.preventDefault();
                }

                setMenusExpandidos((prev) => ({
                  ...prev,
                  [child.path]: !(prev[child.path] ?? childActive),
                }));

                if (!childActive) {
                  onNavigate?.();
                }
              }}
              className={`
                carecore-submenu-item
                ${childActive ? 'carecore-submenu-item-active' : ''}
              `}
            >
              <IconBox icon={child.icon} active={childActive} />
              {renderSubmenuLabel(child)}
              <ChevronDown
                size={14}
                strokeWidth={2.2}
                className={`
                  ml-auto shrink-0 transition-transform duration-200
                  ${childExpanded ? 'rotate-180 text-emerald-700' : 'text-slate-400'}
                `}
              />
            </Link>

            {childExpanded && (
              <div className="carecore-submenu-list carecore-submenu-list-nested">
                {renderSubmenuItems(child.children, { onNavigate, depth: depth + 1 })}
              </div>
            )}
          </div>
        );
      }

      return (
        <Link
          key={child.path}
          to={child.path}
          onClick={onNavigate}
          className={`
            carecore-submenu-item
            ${isActivePath(child.path) ? 'carecore-submenu-item-active' : ''}
          `}
        >
          <IconBox icon={child.icon} active={isActivePath(child.path)} />
          {renderSubmenuLabel(child)}
          {isActivePath(child.path) && (
            <span className="carecore-active-dot" />
          )}
        </Link>
      );
    })
  );

  const renderMenuGroups = ({ onNavigate } = {}) => (
    itensVisiveisPorGrupo.map(group => (
      <div key={group.title} className="carecore-menu-group">

        <p className="carecore-menu-title">
          {group.title}
        </p>

        <div className="carecore-menu-list">

          {group.items.map(item => {
            const active = isActiveItem(item);
            const temSubmenu = item.children?.length > 0;
            const expanded = temSubmenu && menuEstaExpandido(item.path, active);

            if (item.disabled) {
              return (
                <div
                  key={item.path}
                  className="carecore-menu-item carecore-menu-item-disabled"
                  title="Em breve"
                >
                  <IconBox icon={item.icon} active={false} />
                  <span className="truncate">{item.label}</span>
                </div>
              );
            }

            return (
              <div key={item.path}>
                <Link
                  to={item.path}
                  onClick={(event) => {
                    if (temSubmenu) {
                      if (active) {
                        event.preventDefault();
                      }

                      setMenusExpandidos((prev) => ({
                        ...prev,
                        [item.path]: !(prev[item.path] ?? active),
                      }));

                      if (active) {
                        return;
                      }
                    }

                    onNavigate?.();
                  }}
                  className={`
                    carecore-menu-item
                    ${active ? 'carecore-menu-item-active' : ''}
                  `}
                >
                  <IconBox icon={item.icon} active={active} />

                  <span className="truncate">
                    {item.label}
                  </span>

                  {temSubmenu ? (
                    <ChevronDown
                      size={15}
                      strokeWidth={2.2}
                      className={`
                        ml-auto shrink-0 transition-transform duration-200
                        ${expanded ? 'rotate-180 text-emerald-700' : 'text-slate-400'}
                      `}
                    />
                  ) : active ? (
                    <span className="carecore-active-dot" />
                  ) : null}
                </Link>

                {expanded && (
                  <div className="carecore-submenu-list">
                    {renderSubmenuItems(item.children, { onNavigate })}
                  </div>
                )}
              </div>
            );
          })}

        </div>

      </div>
    ))
  );

  return (
    <>
      <div className="carecore-mobile-topbar">
        <button
          type="button"
          onClick={() => setMenuMobileAberto(true)}
          className="carecore-mobile-menu-button"
          aria-label="Abrir menu"
        >
          ☰
        </button>

        <img
          src={logoCarecore}
          alt="CARECORE+"
          className="carecore-mobile-logo"
        />

        <UserAvatar usuario={usuarioSessao} nome={nomeUsuario} size="sm" />
      </div>

      {menuMobileAberto && (
        <div className="carecore-mobile-overlay" onClick={() => setMenuMobileAberto(false)}>
          <aside className="carecore-mobile-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="carecore-mobile-drawer-header">
              <img
                src={logoCarecore}
                alt="CARECORE+"
                className="carecore-mobile-drawer-logo"
              />

              <button
                type="button"
                onClick={() => setMenuMobileAberto(false)}
                className="carecore-mobile-close"
                aria-label="Fechar menu"
              >
                ×
              </button>
            </div>

            <nav className="carecore-sidebar-nav">
              {renderMenuGroups({ onNavigate: () => setMenuMobileAberto(false) })}
            </nav>

            <div className="carecore-sidebar-footer">
              <div className="carecore-user-card">
                <UserAvatar usuario={usuarioSessao} nome={nomeUsuario} size="sm" />

                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="carecore-user-name" title={nomeUsuario}>
                    {nomeExibicao}
                  </p>
                  <p className="carecore-user-role">
                    {perfilNormalizado || perfilUsuario || 'Perfil'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setMenuMobileAberto(false);
                  abrirModalSenha();
                }}
                className="carecore-logout-button"
              >
                <KeyRound size={14} />
                Alterar senha
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuMobileAberto(false);
                  setModalPasskeysAberto(true);
                }}
                className="carecore-logout-button"
              >
                <Fingerprint size={14} />
                Acesso biométrico
              </button>

              <div className="carecore-version-card">
                <p>
                  <strong>CARECORE+</strong> <span>{carecoreVersaoRotulo()}</span>
                </p>
                <a
                  href={obterUrlDireitosReservados()}
                  className="carecore-legal-link"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMenuMobileAberto(false)}
                >
                  {DIREITOS_RESERVADOS_TITULO}
                </a>
              </div>

              <button
                onClick={handleLogout}
                className="carecore-logout-button"
              >
                <span>↩</span>
                Sair
              </button>
            </div>
          </aside>
        </div>
      )}

      <aside className="carecore-sidebar">

      <div className="carecore-sidebar-brand carecore-sidebar-brand-logo-only">
        <img
          src={logoCarecore}
          alt="CARECORE+"
          className="carecore-logo-img carecore-logo-img-large"
        />
      </div>

      <nav className="carecore-sidebar-nav">

        {renderMenuGroups()}

      </nav>

      <div className="carecore-sidebar-footer">

        <div className="carecore-user-card">
          <UserAvatar usuario={usuarioSessao} nome={nomeUsuario} size="sm" />

          <div className="min-w-0 flex-1 overflow-hidden">
            <p className="carecore-user-name" title={nomeUsuario}>
              {nomeExibicao}
            </p>
            <p className="carecore-user-role">
              {perfilNormalizado || perfilUsuario || 'Perfil'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={abrirModalSenha}
          className="carecore-logout-button"
        >
          <KeyRound size={14} />
          Alterar senha
        </button>

        <button
          type="button"
          onClick={() => setModalPasskeysAberto(true)}
          className="carecore-logout-button"
        >
          <Fingerprint size={14} />
          Acesso biométrico
        </button>

        <div className="carecore-version-card">
          <p>
            <strong>CARECORE+</strong> <span>{carecoreVersaoRotulo()}</span>
          </p>
          <a
            href={obterUrlDireitosReservados()}
            className="carecore-legal-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            {DIREITOS_RESERVADOS_TITULO}
          </a>
        </div>

        <button
          onClick={handleLogout}
          className="carecore-logout-button"
        >
          <span>↩</span>
          Sair
        </button>

      </div>

      </aside>

      {modalSenhaAberto && (
        <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={alterarMinhaSenha}
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">Alterar minha senha</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Informe sua senha atual para criar uma nova senha de acesso.
                </p>
              </div>

              <button
                type="button"
                onClick={fecharModalSenha}
                className="rounded-full px-3 py-1 text-xl font-bold text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            {erroSenha && (
              <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {erroSenha}
              </div>
            )}

            {sucessoSenha && (
              <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                {sucessoSenha}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">
                  Senha atual
                </label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={senhaAtual}
                  onChange={(event) => setSenhaAtual(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">
                  Nova senha
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={novaSenha}
                  onChange={(event) => setNovaSenha(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                  maxLength={72}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">
                  Confirmar nova senha
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmarSenha}
                  onChange={(event) => setConfirmarSenha(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                  maxLength={72}
                />
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs font-semibold text-slate-600">
                <p className="mb-2 font-black text-slate-700">A nova senha deve conter:</p>
                <ul className="grid gap-1">
                  <li className={novaSenha.length >= 8 ? 'text-emerald-700' : ''}>Mínimo de 8 caracteres</li>
                  <li className={/[A-Z]/.test(novaSenha) ? 'text-emerald-700' : ''}>Ao menos 1 letra maiúscula</li>
                  <li className={/[a-z]/.test(novaSenha) ? 'text-emerald-700' : ''}>Ao menos 1 letra minúscula</li>
                  <li className={/\d/.test(novaSenha) ? 'text-emerald-700' : ''}>Ao menos 1 número</li>
                  <li className={/[@$!%*?&_\-#]/.test(novaSenha) ? 'text-emerald-700' : ''}>Ao menos 1 caractere especial</li>
                </ul>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={fecharModalSenha}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvandoSenha}
                className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {salvandoSenha ? 'Alterando...' : 'Alterar senha'}
              </button>
            </div>
          </form>
        </div>
      )}

      {modalPasskeysAberto && (
        <PasskeysModal onClose={() => setModalPasskeysAberto(false)} />
      )}
    </>
  );
}


