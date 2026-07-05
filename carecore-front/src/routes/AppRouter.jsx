import { lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import AusenciaJustificadaAlerta from '../components/AusenciaJustificadaAlerta';
import AlertaPresencaOperacional from '../components/AlertaPresencaOperacional';
import ProtectedRoute from './ProtectedRoute';
import { PERFIS_MODULO_ATIVIDADES } from '../utils/rbacUtils';
import { deveExibirManutencaoProgramada } from '../config/manutencao';

const Login = lazy(() => import('../Login'));
const ManutencaoProgramada = lazy(() => import('../ManutencaoProgramada'));
const Dashboard = lazy(() => import('../Dashboard'));
const Quartos = lazy(() => import('../Quartos'));
const Cadastro = lazy(() => import('../Cadastro'));
const Conviventes = lazy(() => import('../Conviventes'));
const CentralOcorrencias = lazy(() => import('../CentralOcorrencias'));
const RotinaDiaria = lazy(() => import('../RotinaDiaria'));
const Lavanderia = lazy(() => import('../Lavanderia'));
const PertencesRecolhidos = lazy(() => import('../PertencesRecolhidos'));
const RotinaHistorico = lazy(() => import('../RotinaHistorico'));
const RotinaAjustesTotais = lazy(() => import('../RotinaAjustesTotais'));
const DashboardOperacional = lazy(() => import('../DashboardOperacional'));
const ConvenioSisa = lazy(() => import('../ConvenioSisa'));
const Avisos = lazy(() => import('../Avisos'));
const Usuarios = lazy(() => import('../Usuarios'));
const Relatorios = lazy(() => import('../Relatorios'));
const RelatoriosConfigOperacional = lazy(() => import('../RelatoriosConfigOperacional'));
const RelatorioPresencaAusencia = lazy(() => import('../RelatorioPresencaAusencia'));
const RelatorioCadastrosNovos = lazy(() => import('../RelatorioCadastrosNovos'));
const Organizacao = lazy(() => import('../Organizacao'));
const GestaoGlobal = lazy(() => import('../GestaoGlobal'));
const HistoricoLegado = lazy(() => import('../HistoricoLegado'));
const RelatorioPresencaLegado = lazy(() => import('../components/historico-legado/RelatorioPresencaLegado'));
const Suporte = lazy(() => import('../Suporte'));
const Cobrancas = lazy(() => import('../Cobrancas'));
const CobrancasAdmin = lazy(() => import('../CobrancasAdmin'));
const AcompanhamentoModulo = lazy(() => import('../AcompanhamentoModulo'));
const AcompanhamentoResumoMensal = lazy(() => import('../AcompanhamentoResumoMensal'));
const AtividadesCadastro = lazy(() => import('../AtividadesCadastro'));
const AtividadesChamada = lazy(() => import('../AtividadesChamada'));
const AtividadesGrade = lazy(() => import('../AtividadesGrade'));
const AtividadesConteudo = lazy(() => import('../AtividadesConteudo'));
const AtividadesRelatorios = lazy(() => import('../AtividadesRelatorios'));
const AtividadesConferenciaSisa = lazy(() => import('../AtividadesConferenciaSisa'));
const AtividadesPontosBrindes = lazy(() => import('../AtividadesPontosBrindes'));

function RotasAplicacao() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/cadastro" element={<Cadastro />} />
        <Route path="/manutencao" element={<ManutencaoProgramada />} />

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
            <ProtectedRoute perfis={['Gestor', 'Técnico', 'Orientador', 'Administrativo', 'Global']}>
              <Conviventes />
            </ProtectedRoute>
          }
        />

        <Route
          path="/conviventes/acompanhamentos"
          element={<Navigate to="/conviventes/acompanhamentos/transferencias" replace />}
        />

        <Route
          path="/conviventes/acompanhamentos/resumo-mensal"
          element={
            <ProtectedRoute perfis={['Gestor', 'Técnico', 'Global']}>
              <AcompanhamentoResumoMensal />
            </ProtectedRoute>
          }
        />

        <Route
          path="/conviventes/acompanhamentos/:slug"
          element={
            <ProtectedRoute perfis={['Gestor', 'Técnico', 'Global']}>
              <AcompanhamentoModulo />
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
            <ProtectedRoute perfis={['Gestor', 'Técnico', 'Orientador', 'Administrativo', 'Global']}>
              <RotinaDiaria />
            </ProtectedRoute>
          }
        />

        <Route
          path="/rotina/dashboard"
          element={
            <ProtectedRoute perfis={['Gestor', 'Técnico', 'Orientador', 'Administrativo', 'Global']}>
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
            <ProtectedRoute perfis={['Gestor', 'Técnico', 'Orientador', 'Administrativo', 'Global']}>
              <RotinaHistorico />
            </ProtectedRoute>
          }
        />

        <Route
          path="/rotina/ajustes-totais"
          element={
            <ProtectedRoute perfis={['Gestor', 'Manutenção']}>
              <RotinaAjustesTotais />
            </ProtectedRoute>
          }
        />

        <Route
          path="/atividades"
          element={
            <ProtectedRoute perfis={PERFIS_MODULO_ATIVIDADES}>
              <AtividadesCadastro />
            </ProtectedRoute>
          }
        />

        <Route
          path="/atividades/chamada"
          element={
            <ProtectedRoute perfis={PERFIS_MODULO_ATIVIDADES}>
              <AtividadesChamada />
            </ProtectedRoute>
          }
        />

        <Route
          path="/atividades/grade"
          element={
            <ProtectedRoute perfis={PERFIS_MODULO_ATIVIDADES}>
              <AtividadesGrade />
            </ProtectedRoute>
          }
        />

        <Route
          path="/atividades/conteudo"
          element={
            <ProtectedRoute perfis={PERFIS_MODULO_ATIVIDADES}>
              <AtividadesConteudo />
            </ProtectedRoute>
          }
        />

        <Route
          path="/atividades/relatorios"
          element={
            <ProtectedRoute perfis={PERFIS_MODULO_ATIVIDADES}>
              <AtividadesRelatorios />
            </ProtectedRoute>
          }
        />

        <Route
          path="/atividades/conferencia-sisa"
          element={
            <ProtectedRoute perfis={PERFIS_MODULO_ATIVIDADES}>
              <AtividadesConferenciaSisa />
            </ProtectedRoute>
          }
        />

        <Route
          path="/atividades/pontos-brindes"
          element={
            <ProtectedRoute perfis={PERFIS_MODULO_ATIVIDADES}>
              <AtividadesPontosBrindes />
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
          path="/relatorios/cadastros-novos"
          element={
            <ProtectedRoute perfis={['Gestor', 'Técnico', 'Orientador', 'Administrativo']}>
              <RelatorioCadastrosNovos />
            </ProtectedRoute>
          }
        />

        <Route
          path="/relatorios/presenca-ausencia"
          element={
            <ProtectedRoute perfis={['Gestor', 'Técnico', 'Orientador', 'Administrativo']}>
              <RelatorioPresencaAusencia />
            </ProtectedRoute>
          }
        />

        <Route
          path="/relatorios/config-operacional"
          element={
            <ProtectedRoute perfis={['Gestor', 'Técnico', 'Global', 'Manutenção']}>
              <RelatoriosConfigOperacional />
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
          path="/historico-legado/rotina/presencas"
          element={
            <ProtectedRoute perfis={['Gestor', 'Técnico', 'Orientador', 'Administrativo', 'Global']}>
              <RelatorioPresencaLegado />
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
      <AlertaPresencaOperacional />
    </>
  );
}

export default function AppRouter() {
  const { pathname } = useLocation();

  if (deveExibirManutencaoProgramada(pathname)) {
    return (
      <Routes>
        <Route path="*" element={<ManutencaoProgramada />} />
      </Routes>
    );
  }

  return <RotasAplicacao />;
}
