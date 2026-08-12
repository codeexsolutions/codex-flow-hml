import type { CSSProperties, ReactNode } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import Dica from "@/shared/ui/Dica";

export type Coluna<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
};

const MIN_TABLE_WIDTH = 720;

export const TabelaCard = ({
  title,
  icon,
  count,
  countLabel,
  onAdd,
  addLabel = "Adicionar",
  filters,
  children,
  footer,
  minWidth = MIN_TABLE_WIDTH,
}: {
  title: string;
  icon?: ReactNode;
  count?: number;
  countLabel?: string;
  onAdd?: () => void;
  addLabel?: string;
  filters?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  minWidth?: number;
}) => (
  <section className="card glass-sheen flex min-h-[220px] min-w-0 flex-1 flex-col overflow-hidden">
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-fg/[0.07] px-4 py-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/[0.14] text-accent-soft ring-1 ring-inset ring-accent/20">{icon}</span>}
        <div className="min-w-0">
          <h2 className="truncate text-[13px] text-ink">{title}</h2>
          {count !== undefined && (
            <p className="text-[11px] text-faint">
              {count} {countLabel ?? (count === 1 ? "registro" : "registros")}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
        {filters}
        {onAdd && (
          <button type="button" onClick={onAdd} className="focus-ring inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-gradient-to-br from-accent-soft to-accent px-3 py-2 text-[12.5px] text-white shadow-glow transition-all hover:brightness-110 active:scale-[0.98]">
            <Plus className="h-3.5 w-3.5" />
            {addLabel}
          </button>
        )}
      </div>
    </header>

    <div className="min-h-0 flex-1 overflow-auto">
      <div className="min-w-0 sm:[min-width:var(--tabela-min)]" style={{ "--tabela-min": `${minWidth}px` } as CSSProperties}>
        {children}
      </div>
    </div>

    {footer && <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-fg/[0.06] px-4 py-2.5 text-[12px] text-faint">{footer}</div>}
  </section>
);

const alignCls = { left: "text-left", right: "text-right", center: "text-center" } as const;

export function TabelaHead<T>({ colunas, cols }: { colunas: Coluna<T>[]; cols: string }) {
  return (
    <div className={`sticky top-0 z-10 hidden ${cols} gap-2 border-b border-fg/[0.07] bg-surface/80 px-4 py-2 text-[10.5px] uppercase tracking-wider text-faint backdrop-blur sm:grid`}>
      {colunas.map((c) => (
        <span key={c.id} className={alignCls[c.align ?? "left"]}>
          {c.header}
        </span>
      ))}
    </div>
  );
}

export function TabelaRow<T>({ colunas, cols, row, onClick }: { colunas: Coluna<T>[]; cols: string; row: T; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  const [principal, ...demais] = colunas;
  const visiveis = demais.filter((c) => Boolean(c.header));

  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={`group relative block w-full border-b border-fg/[0.04] text-left text-[12.5px] text-ink transition-colors before:absolute before:left-0 before:top-0 before:h-full before:w-[2px] before:bg-accent before:opacity-0 before:transition-opacity ${onClick ? "cursor-pointer hover:bg-fg/[0.035] hover:before:opacity-100" : ""}`}
    >
      <span className={`hidden ${cols} items-center gap-2 px-4 py-2.5 sm:grid`}>
        {colunas.map((c) => (
          <span key={c.id} className={`min-w-0 truncate ${alignCls[c.align ?? "left"]}`}>
            {c.cell(row)}
          </span>
        ))}
      </span>

      {/* Cartão — celular */}
      <span className="flex flex-col gap-1.5 px-4 py-3 sm:hidden">
        {principal && <span className="min-w-0 truncate text-[13px] text-ink">{principal.cell(row)}</span>}

        {visiveis.map((c) => (
          <span key={c.id} className="flex items-baseline justify-between gap-3">
            <span className="shrink-0 text-[10.5px] uppercase tracking-wider text-faint">{c.header}</span>
            <span className="min-w-0 truncate text-right text-[12.5px]">{c.cell(row)}</span>
          </span>
        ))}
      </span>
    </Tag>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Lista de altura fixa

   O outro formato de tabela do sistema, usado por Clientes e Estoque: as
   linhas têm altura constante, o corpo não rola e o que não couber vai para a
   próxima página (ver `useAutoPageSize`). As três peças abaixo eram copiadas
   nas duas telas — as classes do cabeçalho, da linha e das linhas-fantasma
   eram idênticas byte a byte, e só as células mudavam.
   ══════════════════════════════════════════════════════════════════════ */

export const ListaCabecalho = ({ cols, children }: { cols: string; children: ReactNode }) => (
  <div className={`grid shrink-0 ${cols} border-b border-fg/[0.06] bg-fg/[0.02] px-5 py-2.5 text-[10px] uppercase tracking-[0.12em] text-muted`}>{children}</div>
);

/**
 * Linha da lista. `onClick` a torna um `<button>` — abrir o registro é a ação
 * principal dessas telas, e um `<div>` com `onClick` não recebe foco nem
 * responde ao Enter.
 *
 * `acoes` são os botões da própria linha (ligar, editar, o que a tela tiver).
 * Eles ficam FORA do botão da linha, sobrepostos à direita: botão dentro de
 * botão é HTML inválido, e na prática o clique no ícone dispararia também a
 * navegação da linha — a pessoa pediria "editar" e receberia outra tela.
 */
export const ListaLinha = ({
  cols,
  altura,
  onClick,
  ariaLabel,
  acoes,
  children,
}: {
  cols: string;
  altura: number;
  onClick?: () => void;
  ariaLabel?: string;
  acoes?: ReactNode;
  children: ReactNode;
}) => {
  const Tag = onClick ? "button" : "div";

  const linha = (
    <Tag
      {...(onClick ? { type: "button" as const, onClick, "aria-label": ariaLabel } : {})}
      className={`group relative grid w-full ${cols} items-center border-b border-fg/[0.04] px-5 text-left transition-colors before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:rounded-r before:bg-accent before:opacity-0 before:transition-opacity hover:bg-fg/[0.03] hover:before:opacity-100`}
      style={{ height: altura }}
    >
      {children}
    </Tag>
  );

  if (!acoes) return linha;

  return (
    /* `group` também aqui: as ações são irmãs do botão da linha, e o
       `group-hover` delas precisa de um ancestral comum aos dois. */
    <div className="group relative" style={{ height: altura }}>
      {linha}

      {/* `pointer-events-none` na faixa e `auto` só nos botões: o vão entre
          eles continua sendo área clicável da linha. */}
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
        <div className="pointer-events-auto flex items-center gap-1 opacity-60 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          {acoes}
        </div>
      </div>
    </div>
  );
};

/**
 * Botão de ícone de uma linha de tabela.
 *
 * Alvo de 30px com o ícone em 14: menor que isso vira alvo de mira no
 * trackpad. Quem responde "o que este ícone faz" é a `Dica` — tooltip do tema,
 * imediato, em vez do `title` do navegador (lento, cinza e recortado pelo
 * `overflow` da tabela).
 */
export const ListaAcao = ({
  icon,
  label,
  onClick,
  tone = "neutral",
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  tone?: "neutral" | "success";
}) => (
  <Dica texto={label}>
    <button
      type="button"
      aria-label={label}
      onClick={(ev) => {
        ev.stopPropagation();
        onClick();
      }}
      className={`focus-ring flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-lg border border-fg/[0.08] bg-surface/90 transition-colors hover:bg-fg/[0.08] ${
        tone === "success" ? "text-success hover:text-success" : "text-mist hover:text-ink"
      }`}
    >
      {icon}
    </button>
  </Dica>
);

/**
 * Linhas vazias que completam a página.
 *
 * Sem elas o rodapé sobe e desce conforme a última página tem duas ou dez
 * linhas — e a paginação vira um alvo que se move entre um clique e outro.
 */
export const ListaFantasmas = ({ quantidade, altura }: { quantidade: number; altura: number }) => (
  <>
    {Array.from({ length: quantidade }).map((_, i) => (
      <div key={`fantasma-${i}`} aria-hidden className="border-b border-fg/[0.04]" style={{ height: altura }} />
    ))}
  </>
);

/**
 * Rodapé de paginação das listas.
 *
 * Estava copiado em quatro telas — Clientes, Estoque, o extrato de faturas e o
 * histórico de pedidos do cliente — com quatro variações de espaçamento e dois
 * jeitos diferentes de desabilitar as setas. Aqui é um só; o que muda entre as
 * telas é o `resumo` da esquerda ("12 clientes", "Mostrando 1–8 de 11", o
 * ticket médio), que cada uma escreve do seu jeito.
 */
export const TabelaPaginacao = ({
  pagina,
  totalPaginas,
  onPagina,
  resumo,
}: {
  pagina: number;
  totalPaginas: number;
  onPagina: (p: number) => void;
  resumo?: ReactNode;
}) => {
  const botao =
    "focus-ring flex cursor-pointer items-center gap-1 rounded-lg border border-fg/[0.08] bg-fg/[0.04] px-2.5 py-1.5 text-mist transition-colors hover:bg-fg/[0.08] disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-fg/[0.06] bg-fg/[0.02] px-5 py-3 text-[11px] text-faint">
      <div className="min-w-0">{resumo}</div>

      <div className="flex items-center gap-2">
        <button type="button" disabled={pagina <= 1} onClick={() => onPagina(Math.max(1, pagina - 1))} aria-label="Página anterior" className={botao}>
          <ChevronLeft className="h-3.5 w-3.5" /> Anterior
        </button>

        <span className="px-1 tabular-nums">
          {pagina} / {totalPaginas}
        </span>

        <button type="button" disabled={pagina >= totalPaginas} onClick={() => onPagina(Math.min(totalPaginas, pagina + 1))} aria-label="Próxima página" className={botao}>
          Próxima <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

export const TabelaVazia = ({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) => (
  <div className="flex h-full min-h-[180px] flex-col items-center justify-center gap-2.5 px-6 py-10 text-center">
    {icon && <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-fg/[0.07] bg-fg/[0.03] text-faint">{icon}</span>}
    <p className="text-[13px] text-mist">{title}</p>
    {description && <p className="max-w-[280px] text-[11.5px] leading-relaxed text-faint">{description}</p>}
    {action}
  </div>
);
