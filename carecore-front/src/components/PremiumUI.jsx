// =====================================================================
// ARQUIVO: src/components/PremiumUI.jsx
// Componentes visuais reutilizáveis CARECORE+ Premium UI
// =====================================================================

export function PremiumPage({ title, subtitle, actions, children }) {
  return (
    <main className="carecore-page">
      <header className="carecore-topbar">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm font-medium text-slate-500">
              {subtitle}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </header>

      <section className="carecore-content">
        {children}
      </section>
    </main>
  );
}

export function PremiumCard({ title, subtitle, icon, children, footer, className = '' }) {
  return (
    <section className={`carecore-card p-5 ${className}`}>
      {(title || subtitle || icon) && (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && (
              <h2 className="text-base font-extrabold text-slate-900">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-1 text-sm text-slate-500">
                {subtitle}
              </p>
            )}
          </div>

          {icon && (
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
              {icon}
            </div>
          )}
        </div>
      )}

      {children}

      {footer && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          {footer}
        </div>
      )}
    </section>
  );
}

export function PremiumMetric({ label, value, helper, icon, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    purple: 'bg-violet-50 text-violet-700',
    red: 'bg-rose-50 text-rose-700'
  };

  return (
    <div className="carecore-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">
            {value}
          </p>
          {helper && (
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {helper}
            </p>
          )}
        </div>

        {icon && (
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tones[tone] || tones.blue}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

export function PremiumBadge({ children, variant = 'default' }) {
  const variants = {
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    warning: 'bg-amber-50 text-amber-700 border-amber-100',
    danger: 'bg-rose-50 text-rose-700 border-rose-100',
    info: 'bg-blue-50 text-blue-700 border-blue-100',
    purple: 'bg-violet-50 text-violet-700 border-violet-100'
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${variants[variant] || variants.default}`}>
      {children}
    </span>
  );
}

export function PremiumAlertTitle({ children }) {
  return (
    <div className="flex items-center gap-2">
      <span className="carecore-badge-alert">⚠</span>
      <h2 className="text-base font-extrabold text-slate-900">
        {children}
      </h2>
    </div>
  );
}
