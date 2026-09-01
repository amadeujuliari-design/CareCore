import { useMemo, useState } from 'react';
import {
  ChevronDown,
  CreditCard,
  FileText,
  LayoutDashboard,
  List,
  MessageSquare,
  PanelsTopLeft,
  Settings,
  ShieldCheck,
  Table,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import logoCarecore from '../assets/logo.PNG';
import UserAvatar from './UserAvatar';
import { limparSessaoLocal } from '../services/api';
import { carecoreVersaoRotulo } from '../config/versao';
import { useAuth } from '../context/AuthContext';
import { montarUsuarioAvatarRemetente } from '../config/manutencao';
import { ROTULO_MENU_ORGS_PROJETOS } from '../utils/orgPacoteUtils.js';

const ITENS_MENU = [
  { to: '/financeiro/dashboard', label: 'Visão Geral', icon: LayoutDashboard },
  { to: '/financeiro/extrato', label: 'Extrato', icon: Table },
  {
    to: '/financeiro/notas',
    label: 'Notas Fiscais',
    icon: FileText,
    children: [
      { to: '/financeiro/notas', label: 'Leitura de PDFs' },
      {
        to: '/financeiro/notas/conferencia-nfse',
        label: 'Conferência NFS-e',
        icon: ShieldCheck,
      },
    ],
  },
  { to: '/financeiro/pagar-receber', label: 'A Pagar / Receber', icon: List },
  { to: '/financeiro/whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { to: '/financeiro/cartoes', label: 'Cartões', icon: CreditCard },
  { to: '/financeiro/investimentos', label: 'Investimentos', icon: TrendingUp },
  { to: '/financeiro/contas', label: 'Contas', icon: Wallet },
  { to: '/financeiro/configuracoes', label: 'Configurações', icon: Settings },
  { to: '/organizacao', label: ROTULO_MENU_ORGS_PROJETOS, icon: PanelsTopLeft },
];

function itemAtivo(location, item) {
  if (item.children?.length) {
    return item.children.some(
      (child) =>
        location.pathname === child.to
        || location.pathname.startsWith(`${child.to}/`),
    ) || location.pathname === item.to
      || location.pathname.startsWith(`${item.to}/`);
  }
  return location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
}

function ItemMenuSimples({ item, ativo }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className={`carecore-menu-item ${ativo ? 'carecore-menu-item-active' : ''}`}
    >
      <span className={`carecore-menu-icon ${ativo ? 'carecore-menu-icon-active' : ''}`}>
        <Icon size={17} strokeWidth={2.2} />
      </span>
      <span>{item.label}</span>
    </Link>
  );
}

function ItemMenuComSubmenu({ item, location, menusExpandidos, setMenusExpandidos }) {
  const Icon = item.icon;
  const ativo = itemAtivo(location, item);
  const expanded = menusExpandidos[item.to] ?? ativo;

  return (
    <div>
      <Link
        to={item.to}
        onClick={(event) => {
          if (ativo) {
            event.preventDefault();
          }
          setMenusExpandidos((prev) => ({
            ...prev,
            [item.to]: !(prev[item.to] ?? ativo),
          }));
        }}
        className={`carecore-menu-item ${ativo ? 'carecore-menu-item-active' : ''}`}
      >
        <span className={`carecore-menu-icon ${ativo ? 'carecore-menu-icon-active' : ''}`}>
          <Icon size={17} strokeWidth={2.2} />
        </span>
        <span className="truncate">{item.label}</span>
        <ChevronDown
          size={15}
          strokeWidth={2.2}
          className={`ml-auto shrink-0 transition-transform duration-200 ${
            expanded ? 'rotate-180 text-emerald-700' : 'text-slate-400'
          }`}
        />
      </Link>

      {expanded && (
        <div className="carecore-submenu-list">
          {item.children.map((child) => {
            const ChildIcon = child.icon;
            const childAtivo =
              location.pathname === child.to
              || location.pathname.startsWith(`${child.to}/`);
            return (
              <Link
                key={child.to}
                to={child.to}
                className={`carecore-submenu-item ${
                  childAtivo ? 'carecore-submenu-item-active' : ''
                }`}
              >
                {ChildIcon ? (
                  <ChildIcon size={14} strokeWidth={2.2} className="shrink-0 opacity-80" />
                ) : null}
                <span>{child.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function FinanceSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [menusExpandidos, setMenusExpandidos] = useState({});

  const logout = () => {
    limparSessaoLocal();
    navigate('/');
    window.location.href = '/';
  };

  const nomeOrg = usuario?.organizacao_nome || 'Finanças';

  const expandidosIniciais = useMemo(() => {
    const mapa = {};
    ITENS_MENU.forEach((item) => {
      if (item.children?.length && itemAtivo(location, item)) {
        mapa[item.to] = true;
      }
    });
    return mapa;
  }, [location.pathname]);

  const expandidos = { ...expandidosIniciais, ...menusExpandidos };

  return (
    <aside className="carecore-sidebar">
      <div className="carecore-sidebar-brand carecore-sidebar-brand-logo-only">
        <img src={logoCarecore} alt="CareCore+" className="carecore-sidebar-logo" />
      </div>

      <div className="px-4 py-3">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900">
          <span className="block text-[10px] uppercase tracking-wide text-emerald-700">Organização</span>
          <span className="truncate" title={nomeOrg}>{nomeOrg}</span>
        </div>
      </div>

      <nav className="carecore-sidebar-nav">
        {ITENS_MENU.map((item) =>
          item.children?.length ? (
            <ItemMenuComSubmenu
              key={item.to}
              item={item}
              location={location}
              menusExpandidos={expandidos}
              setMenusExpandidos={setMenusExpandidos}
            />
          ) : (
            <ItemMenuSimples
              key={item.to}
              item={item}
              ativo={itemAtivo(location, item)}
            />
          ),
        )}
      </nav>

      <div className="carecore-sidebar-footer">
        <div className="carecore-sidebar-user">
          <UserAvatar usuario={montarUsuarioAvatarRemetente(usuario)} tamanho="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-gray-900">{usuario?.nome || 'Usuário'}</p>
            <p className="truncate text-[11px] font-semibold text-emerald-700">Finanças</p>
          </div>
        </div>

        <button type="button" onClick={logout} className="carecore-logout-button">
          Sair
        </button>

        <p className="carecore-sidebar-version">{carecoreVersaoRotulo()}</p>
      </div>
    </aside>
  );
}
