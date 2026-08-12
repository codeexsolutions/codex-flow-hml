import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";

export interface HeaderTab {
  label: string;
  path: string;
  icon?: ReactNode;
  end?: boolean;
}

interface HeaderPageProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  tabs?: HeaderTab[];
}

/**
 * Cabeçalho de página: identidade à esquerda, navegação à direita.
 *
 * Por decisão de layout o header não recebe mais botões de ação — criar,
 * exportar e afins vivem na própria tela (ver `PageToolbar`), junto do conteúdo
 * sobre o qual agem. Isso mantém o header enxuto e previsível em toda rota.
 */
const HeaderPage = ({ title, subtitle, icon, tabs }: HeaderPageProps) => {
  const hasTabs = Boolean(tabs && tabs.length > 0);

  return (
    <header
      className="safe-top relative z-10 shrink-0 border-b border-fg/[0.08]"
      style={{
        backgroundColor: "rgb(var(--canvas) / 0.72)",
        backdropFilter: "blur(var(--blur-md)) saturate(160%)",
        WebkitBackdropFilter: "blur(var(--blur-md)) saturate(160%)",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 lg:px-6">
        {/* Identidade */}
        <div className="flex min-w-0 items-center gap-3">
          {icon && (
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/[0.12] text-accent-soft ring-1 ring-inset ring-accent/20">
              <span aria-hidden className="absolute -inset-1 rounded-2xl bg-accent/25 blur-md" style={{ opacity: "calc(0.5 * var(--fx-glow, 1))" }} />
              <span className="relative">{icon}</span>
            </div>
          )}

          <div className="min-w-0">
            <h1 className="truncate text-[17px] leading-tight tracking-tight text-ink">{title}</h1>
            {subtitle && <p className="truncate text-[11.5px] text-faint">{subtitle}</p>}
          </div>
        </div>

        {/* Navegação — pílulas à direita, na mesma linha do título */}
        {hasTabs && (
          <nav className="glass-subtle flex items-center gap-1 rounded-xl p-1">
            {tabs!.map((tab) => (
              <NavLink
                key={tab.path}
                to={tab.path}
                end={tab.end ?? true}
                className={({ isActive }) => `focus-ring relative flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[12.5px] transition-all duration-200 ${isActive ? "bg-accent text-white shadow-glow" : "text-mist hover:bg-fg/[0.06] hover:text-ink"}`}
              >
                {tab.icon}
                {tab.label}
              </NavLink>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
};

export default HeaderPage;
