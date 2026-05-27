// =====================================================================
// ARQUIVO: src/App.jsx
// Base visual global CARECORE+ Premium UI
// =====================================================================

import { BrowserRouter, Routes, Route } from 'react-router-dom';

import './carecore-premium.css';

import Login from './Login';
import Dashboard from './Dashboard';
import Quartos from './Quartos';
import Cadastro from './Cadastro';
import Conviventes from './Conviventes';
import CentralOcorrencias from './CentralOcorrencias';
import RotinaDiaria from './RotinaDiaria';
import RotinaHistorico from './RotinaHistorico';
import DashboardOperacional from './DashboardOperacional';
import ConvenioSisa from './ConvenioSisa';
import Avisos from './Avisos';
import Usuarios from './Usuarios';
import Relatorios from './Relatorios';

import ProtectedRoute from './routes/ProtectedRoute';

export default function App() {
  return (
    <BrowserRouter>
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
            <ProtectedRoute>
              <Quartos />
            </ProtectedRoute>
          }
        />

        <Route
          path="/conviventes"
          element={
            <ProtectedRoute>
              <Conviventes />
            </ProtectedRoute>
          }
        />

        <Route
          path="/ocorrencias"
          element={
            <ProtectedRoute>
              <CentralOcorrencias />
            </ProtectedRoute>
          }
        />

        <Route
          path="/rotina"
          element={
            <ProtectedRoute>
              <RotinaDiaria />
            </ProtectedRoute>
          }
        />

        <Route
          path="/rotina/dashboard"
          element={
            <ProtectedRoute>
              <DashboardOperacional />
            </ProtectedRoute>
          }
        />

        <Route
          path="/rotina/historico"
          element={
            <ProtectedRoute>
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
          path="/usuarios"
          element={
            <ProtectedRoute perfis={['Gestor']}>
              <Usuarios />
            </ProtectedRoute>
          }
        />

        <Route
          path="/convenio-sisa"
          element={
            <ProtectedRoute>
              <ConvenioSisa />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
