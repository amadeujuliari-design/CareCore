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

export function AppShell({ children }) {
  return (
    <div className="carecore-app-fixed">
      {children}
    </div>
  );
}

export function MainShell({ children }) {
  return (
    <section className="carecore-main-fixed">
      {children}
    </section>
  );
}

export function PageHeader({ eyebrow, title, subtitle, icon, actions }) {
  return (
    <header className="carecore-page-header-fixed px-5 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {eyebrow}
            </p>
          )}

          <div className="flex items-center gap-3">
            {icon && (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                {icon}
              </span>
            )}

            <div className="min-w-0">
              <h1 className="truncate text-[23px] font-bold leading-none text-slate-900">
                {title}
              </h1>

              {subtitle && (
                <p className="mt-1 text-sm text-slate-500">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </div>

        {actions && (
          <div className="flex flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}

export function ScrollArea({ children, className = '' }) {
  return (
    <main className={`carecore-scroll-area ${className}`}>
      {children}
    </main>
  );
}

export function PremiumButton({
  children,
  variant = 'primary',
  className = '',
  ...props
}) {
  const variants = {
    primary: 'bg-slate-900 text-white shadow hover:bg-slate-800',
    brand: 'bg-brand text-white shadow hover:bg-brandDark',
    secondary: 'border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50',
    danger: 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
  };

  return (
    <button
      className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant] || variants.primary} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function SectionCard({ title, subtitle, children, actions, className = '' }) {
  return (
    <section className={`rounded-3xl border border-slate-100 bg-white shadow-sm ${className}`}>
      {(title || subtitle || actions) && (
        <div className="border-b border-slate-100 px-5 py-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            {title && (
              <h2 className="text-base font-black text-slate-900">
                {title}
              </h2>
            )}

            {subtitle && (
              <p className="mt-1 text-xs font-medium text-slate-500">
                {subtitle}
              </p>
            )}
          </div>

          {actions && (
            <div className="flex flex-wrap gap-2">
              {actions}
            </div>
          )}
        </div>
      )}

      {children}
    </section>
  );
}

export function SectionTitle({ title, subtitle, actions }) {
  return (
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h2 className="text-base font-black text-slate-900">
          {title}
        </h2>

        {subtitle && (
          <p className="mt-1 text-xs text-slate-500">
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex flex-wrap gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}

export function FilterPanel({ title = 'Filtros', subtitle, actions, children, className = '' }) {
  return (
    <section className={`rounded-3xl border border-slate-100 bg-white p-5 shadow-sm ${className}`}>
      <SectionTitle title={title} subtitle={subtitle} actions={actions} />
      {children}
    </section>
  );
}

export function EmptyState({ title, subtitle }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center">
      <p className="text-sm font-bold text-slate-600">
        {title}
      </p>

      {subtitle && (
        <p className="mt-1 text-xs text-slate-400">
          {subtitle}
        </p>
      )}
    </div>
  );
}
