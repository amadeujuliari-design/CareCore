// =====================================================================
// ARQUIVO: src/App.jsx
// Base visual global CARECORE+ Premium UI
// =====================================================================

import { Suspense } from 'react';
import { BrowserRouter } from 'react-router-dom';

import './carecore-premium.css';

import AppRouter from './routes/AppRouter';

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
        <AppRouter />
      </Suspense>
    </BrowserRouter>
  );
}
