import { Link, useLocation, useNavigate } from 'react-router-dom';
import logoCarecore from './assets/logo.png';

function IconBox({ children, active }) {
  return (
    <span
      className={`
        carecore-menu-icon
        ${active ? 'carecore-menu-icon-active' : ''}
      `}
    >
      {children}
    </span>
  );
}

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = localStorage.getItem('@CareCore:token') || localStorage.getItem('token');

  let perfilUsuario = '';
  let nomeUsuario = 'Usuário';

  try {
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]));
      perfilUsuario = payload.perfil_acesso || '';
      nomeUsuario = payload.nome || payload.email || 'Usuário';
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
          icon: '▦',
          label: 'Dashboard'
        },
        {
          path: '/conviventes',
          icon: '👥',
          label: 'Conviventes'
        },
        {
          path: '/quartos',
          icon: '▣',
          label: 'Acomodações'
        },
        {
          path: '/ocorrencias',
          icon: '⚠',
          label:
            perfilUsuario === 'Orientador'
              ? 'Minhas Ocorrências'
              : 'Ocorrências'
        },
        {
          path: '/rotina',
          icon: '⏱',
          label: 'Rotina Diária'
        },
        {
          path: '/rotina/dashboard',
          icon: '↗',
          label: 'Dashboard Operacional'
        },
        {
          path: '/rotina/historico',
          icon: '☷',
          label: 'Histórico da Rotina'
        },
        {
          path: '/convenio-sisa',
          icon: '▤',
          label: 'Convênio / SISA'
        },
        {
          path: '/avisos',
          icon: '🔔',
          label: 'Comunicação Interna'
        },
        {
          path: '/relatorios',
          icon: '▥',
          label: 'Relatórios'
        },
        {
          path: '/usuarios',
          icon: '👤',
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
          icon: '☁',
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

  return (
    <aside className="carecore-sidebar">

      <div className="carecore-sidebar-brand carecore-sidebar-brand-logo-only">
        <img
          src={logoCarecore}
          alt="CARECORE+"
          className="carecore-logo-img carecore-logo-img-large"
        />
      </div>

      <nav className="carecore-sidebar-nav">

        {menuGroups.map(group => (
          <div key={group.title} className="carecore-menu-group">

            <p className="carecore-menu-title">
              {group.title}
            </p>

            <div className="carecore-menu-list">

              {group.items
                .filter(item => !item.perfis || item.perfis.includes(perfilNormalizado))
                .map(item => {
                const active = isActivePath(item.path);

                if (item.disabled) {
                  return (
                    <div
                      key={item.path}
                      className="carecore-menu-item carecore-menu-item-disabled"
                      title="Em breve"
                    >
                      <IconBox active={false}>{item.icon}</IconBox>
                      <span className="truncate">{item.label}</span>
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`
                      carecore-menu-item
                      ${active ? 'carecore-menu-item-active' : ''}
                    `}
                  >
                    <IconBox active={active}>{item.icon}</IconBox>

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
        ))}

      </nav>

      <div className="carecore-sidebar-footer">

        <div className="carecore-user-card">
          <div className="carecore-user-avatar">
            {(nomeUsuario || 'U').slice(0, 1).toUpperCase()}
          </div>

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
  );
}


