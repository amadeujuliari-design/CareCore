import { useState } from 'react';
import {
  Bell,
  BedDouble,
  CalendarClock,
  ChartNoAxesColumnIncreasing,
  ClipboardList,
  Cloud,
  FileBarChart,
  LayoutDashboard,
  MessageSquareWarning,
  PanelsTopLeft,
  Users,
  UserRoundCog,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import logoCarecore from './assets/logo.png';
import UserAvatar from './components/UserAvatar';

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

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  const token = localStorage.getItem('@CareCore:token') || localStorage.getItem('token');

  let perfilUsuario = '';
  let nomeUsuario = 'Usuário';
  let usuarioSessao = null;

  try {
    const usuarioRaw = localStorage.getItem('@CareCore:user') || localStorage.getItem('usuario');

    if (usuarioRaw) {
      usuarioSessao = JSON.parse(usuarioRaw);
    }

    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]));
      perfilUsuario = payload.perfil_acesso || '';
      nomeUsuario = usuarioSessao?.nome || payload.nome || payload.email || 'Usuário';
    }
  } catch (e) {
    console.error('Erro ao ler perfil no menu lateral', e);
  }

  const perfilNormalizado = {
    Gestao: 'Gestor',
    Gestão: 'Gestor',
    Gerente: 'Gestor',
    Tecnico: 'Técnico',
  }[perfilUsuario] || perfilUsuario;

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
          label: 'Conviventes'
        },
        {
          path: '/quartos',
          icon: BedDouble,
          label: 'Acomodações'
        },
        {
          path: '/ocorrencias',
          icon: MessageSquareWarning,
          label:
            perfilUsuario === 'Orientador'
              ? 'Minhas Ocorrências'
              : 'Ocorrências'
        },
        {
          path: '/rotina',
          icon: CalendarClock,
          label: 'Rotina Diária'
        },
        {
          path: '/rotina/dashboard',
          icon: ChartNoAxesColumnIncreasing,
          label: 'Dashboard Operacional'
        },
        {
          path: '/rotina/historico',
          icon: ClipboardList,
          label: 'Histórico da Rotina'
        },
        {
          path: '/convenio-sisa',
          icon: PanelsTopLeft,
          label: 'Convênio / SISA'
        },
        {
          path: '/avisos',
          icon: Bell,
          label: 'Comunicação Interna'
        },
        {
          path: '/relatorios',
          icon: FileBarChart,
          label: 'Relatórios'
        },
        {
          path: '/usuarios',
          icon: UserRoundCog,
          label: 'Usuários',
          perfis: ['Gestor']
        }
      ]
    },
    {
      title: 'Suporte',
      items: [
        {
          path: '/backup',
          icon: Cloud,
          label: 'Backup',
          disabled: true
        }
      ]
    }
  ];

  const handleLogout = () => {
    localStorage.removeItem('@CareCore:token');
    localStorage.removeItem('@CareCore:user');
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    navigate('/');
  };

  const isActivePath = (path) => {
    if (path === '/rotina') {
      return location.pathname === '/rotina';
    }

    return (
      location.pathname === path ||
      location.pathname.startsWith(path + '/')
    );
  };

  const itensVisiveisPorGrupo = menuGroups.map((group) => ({
    ...group,
    items: group.items.filter(item => !item.perfis || item.perfis.includes(perfilNormalizado)),
  }));

  const renderMenuGroups = ({ onNavigate } = {}) => (
    itensVisiveisPorGrupo.map(group => (
      <div key={group.title} className="carecore-menu-group">

        <p className="carecore-menu-title">
          {group.title}
        </p>

        <div className="carecore-menu-list">

          {group.items.map(item => {
            const active = isActivePath(item.path);

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
              <Link
                key={item.path}
                to={item.path}
                onClick={onNavigate}
                className={`
                  carecore-menu-item
                  ${active ? 'carecore-menu-item-active' : ''}
                `}
              >
                <IconBox icon={item.icon} active={active} />

                <span className="truncate">
                  {item.label}
                </span>

                {active && (
                  <span className="carecore-active-dot" />
                )}
              </Link>
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

                <div className="min-w-0">
                  <p className="carecore-user-name">
                    {nomeUsuario}
                  </p>
                  <p className="carecore-user-role">
                    {perfilUsuario || 'Perfil'}
                  </p>
                </div>
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

          <div className="min-w-0">
            <p className="carecore-user-name">
              {nomeUsuario}
            </p>
            <p className="carecore-user-role">
              {perfilUsuario || 'Perfil'}
            </p>
          </div>
        </div>

        <div className="carecore-version-card">
          <p>
            <strong>CARECORE+</strong> <span>v1.0.0</span>
          </p>
          <small>© 2026 • LGPD-ready</small>
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
    </>
  );
}


