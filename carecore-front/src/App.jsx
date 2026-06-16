// =====================================================================
// ARQUIVO: src/App.jsx
// Base visual global CARECORE+ Premium UI
// =====================================================================

import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import './carecore-premium.css';

import AusenciaJustificadaAlerta from './components/AusenciaJustificadaAlerta';
import ProtectedRoute from './routes/ProtectedRoute';

const Login = lazy(() => import('./Login'));
const Dashboard = lazy(() => import('./Dashboard'));
const Quartos = lazy(() => import('./Quartos'));
const Cadastro = lazy(() => import('./Cadastro'));
const Conviventes = lazy(() => import('./Conviventes'));
const CentralOcorrencias = lazy(() => import('./CentralOcorrencias'));
const RotinaDiaria = lazy(() => import('./RotinaDiaria'));
const Lavanderia = lazy(() => import('./Lavanderia'));
const PertencesRecolhidos = lazy(() => import('./PertencesRecolhidos'));
const RotinaHistorico = lazy(() => import('./RotinaHistorico'));
const DashboardOperacional = lazy(() => import('./DashboardOperacional'));
const ConvenioSisa = lazy(() => import('./ConvenioSisa'));
const Avisos = lazy(() => import('./Avisos'));
const Usuarios = lazy(() => import('./Usuarios'));
const Relatorios = lazy(() => import('./Relatorios'));
const Organizacao = lazy(() => import('./Organizacao'));
const GestaoGlobal = lazy(() => import('./GestaoGlobal'));
const HistoricoLegado = lazy(() => import('./HistoricoLegado'));
const Suporte = lazy(() => import('./Suporte'));
const Cobrancas = lazy(() => import('./Cobrancas'));
const CobrancasAdmin = lazy(() => import('./CobrancasAdmin'));

function PageFallback() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm font-semibold text-slate-500">
      Carregando...
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/cadastro" element={<Cadastro />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/quartos"
          element={
            <ProtectedRoute perfis={['Gestor', 'Técnico', 'Orientador', 'Administrativo']}>
              <Quartos />
            </ProtectedRoute>
          }
        />

        <Route
          path="/conviventes"
          element={
            <ProtectedRoute perfis={['Gestor', 'Técnico', 'Orientador', 'Administrativo']}>
              <Conviventes />
            </ProtectedRoute>
          }
        />

        <Route
          path="/ocorrencias"
          element={
            <ProtectedRoute perfis={['Gestor', 'Técnico', 'Orientador', 'Administrativo']}>
              <CentralOcorrencias />
            </ProtectedRoute>
          }
        />

        <Route
          path="/rotina"
          element={
            <ProtectedRoute perfis={['Gestor', 'Técnico', 'Orientador', 'Administrativo']}>
              <RotinaDiaria />
            </ProtectedRoute>
          }
        />

        <Route
          path="/rotina/dashboard"
          element={
            <ProtectedRoute perfis={['Gestor', 'Técnico', 'Orientador', 'Administrativo']}>
              <DashboardOperacional />
            </ProtectedRoute>
          }
        />

        <Route
          path="/rotina/lavanderia"
          element={
            <ProtectedRoute perfis={['Gestor', 'Técnico', 'Orientador', 'Administrativo']}>
              <Lavanderia />
            </ProtectedRoute>
          }
        />

        <Route
          path="/rotina/pertences-recolhidos"
          element={
            <ProtectedRoute perfis={['Gestor', 'Técnico', 'Orientador', 'Administrativo']}>
              <PertencesRecolhidos />
            </ProtectedRoute>
          }
        />

        <Route
          path="/rotina/historico"
          element={
            <ProtectedRoute perfis={['Gestor', 'Técnico', 'Orientador', 'Administrativo']}>
              <RotinaHistorico />
            </ProtectedRoute>
          }
        />

        <Route
          path="/avisos"
          element={
            <ProtectedRoute>
              <Avisos />
            </ProtectedRoute>
          }
        />

        <Route
          path="/relatorios"
          element={
            <ProtectedRoute>
              <Relatorios />
            </ProtectedRoute>
          }
        />

        <Route
          path="/historico-legado"
          element={
            <ProtectedRoute perfis={['Gestor', 'Técnico', 'Orientador', 'Administrativo', 'Global']}>
              <HistoricoLegado />
            </ProtectedRoute>
          }
        />
        <Route
          path="/historico-legado/rotina"
          element={
            <ProtectedRoute perfis={['Gestor', 'Técnico', 'Orientador', 'Administrativo', 'Global']}>
              <HistoricoLegado />
            </ProtectedRoute>
          }
        />


        <Route
          path="/usuarios"
          element={
            <ProtectedRoute perfis={['Gestor', 'Global']}>
              <Usuarios />
            </ProtectedRoute>
          }
        />

        <Route
          path="/organizacao"
          element={
            <ProtectedRoute perfis={['Gestor', 'Global']}>
              <Organizacao />
            </ProtectedRoute>
          }
        />

        <Route
          path="/gestao-global"
          element={
            <ProtectedRoute perfis={['Gestor', 'Global']}>
              <GestaoGlobal />
            </ProtectedRoute>
          }
        />

        <Route
          path="/cobrancas"
          element={
            <ProtectedRoute perfis={['Gestor', 'Global']}>
              <Cobrancas />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/cobrancas"
          element={
            <ProtectedRoute perfis={['Manutenção']}>
              <CobrancasAdmin />
            </ProtectedRoute>
          }
        />

        <Route
          path="/convenio-sisa"
          element={
            <ProtectedRoute perfis={['Gestor', 'Técnico', 'Administrativo']}>
              <ConvenioSisa />
            </ProtectedRoute>
          }
        />
        <Route
          path="/suporte"
          element={
            <ProtectedRoute>
              <Suporte />
            </ProtectedRoute>
          }
        />
        </Routes>
        <AusenciaJustificadaAlerta />
      </Suspense>
    </BrowserRouter>
  );
}
