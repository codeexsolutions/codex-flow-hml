import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/* ------------------------------------------------------------------ */
/* TIPOS */
/* ------------------------------------------------------------------ */

export type AlertType = "success" | "error" | "warning" | "info" | "question";
export type ToastPosition = "top" | "top-right" | "bottom" | "bottom-right";

export type AlertOptions = {
  type?: AlertType;
  title?: string;
  message?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
  showClose?: boolean;
  allowOutsideClick?: boolean;
  /** Modo toast: canto da tela, sem bloquear, some sozinho. */
  toast?: boolean;
  position?: ToastPosition;
  /** Fecha sozinho depois de N ms (padrão 4000 no toast). */
  timer?: number;
};

export type AlertResult = {
  confirmed: boolean;
  dismissed: boolean;
};

/* ------------------------------------------------------------------ */
/* ACCENT — cores por tipo (usadas em vars CSS + atributos SVG) */
/* ------------------------------------------------------------------ */

/**
 * Cores por tipo. Referenciam variáveis CSS que já mudam com o tema, então o
 * alerta acompanha claro/escuro sem precisar saber qual está ativo.
 * `--aa-on` é a cor do texto sobre o botão preenchido.
 */
const ACCENT: Record<AlertType, { main: string; soft: string; glow: string }> = {
  success: { main: "rgb(var(--success))", soft: "rgb(var(--success))", glow: "rgb(var(--success) / 0.2)" },
  error: { main: "rgb(var(--danger))", soft: "rgb(var(--danger))", glow: "rgb(var(--danger) / 0.2)" },
  warning: { main: "rgb(var(--warning))", soft: "rgb(var(--warning))", glow: "rgb(var(--warning) / 0.2)" },
  info: { main: "rgb(var(--accent))", soft: "rgb(var(--accent-soft))", glow: "rgb(var(--accent) / 0.2)" },
  question: { main: "rgb(var(--accent))", soft: "rgb(var(--accent-soft))", glow: "rgb(var(--accent) / 0.2)" },
};

// helper: injeta as cores do accent como CSS vars no elemento
const accentVars = (type: AlertType): React.CSSProperties => {
  const a = ACCENT[type];
  return {
    ["--aa-main" as string]: a.main,
    ["--aa-soft" as string]: a.soft,
    ["--aa-glow" as string]: a.glow,
  };
};

/* ------------------------------------------------------------------ */
/* KEYFRAMES + utilitários que o Tailwind não cobre (injetado 1x) */
/* ------------------------------------------------------------------ */

const STYLE_ID = "aurora-alert-styles";
const CSS = `
@keyframes aa-backdrop-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes aa-card-in {
 0% { opacity: 0; transform: translateY(14px) scale(.94) }
 60% { opacity: 1; transform: translateY(0) scale(1.01) }
 100% { opacity: 1; transform: translateY(0) scale(1) }
}
@keyframes aa-card-out {
 from { opacity: 1; transform: translateY(0) scale(1) }
 to { opacity: 0; transform: translateY(8px) scale(.96) }
}
@keyframes aa-halo {
 0%, 100% { transform: scale(1); opacity: .45 }
 50% { transform: scale(1.1); opacity: .7 }
}
@keyframes aa-ring-draw { to { stroke-dashoffset: 0 } }
@keyframes aa-mark-draw { to { stroke-dashoffset: 0 } }
@keyframes aa-toast-in-r { from { opacity: 0; transform: translateX(24px) } to { opacity: 1; transform: none } }
@keyframes aa-toast-in-t { from { opacity: 0; transform: translateY(-24px) } to { opacity: 1; transform: none } }
@keyframes aa-toast-in-b { from { opacity: 0; transform: translateY(24px) } to { opacity: 1; transform: none } }
@keyframes aa-toast-out { to { opacity: 0; transform: translateY(-6px) scale(.98) } }
@keyframes aa-progress { from { transform: scaleX(1) } to { transform: scaleX(0) } }

.aa-ring { stroke-dasharray: 166; stroke-dashoffset: 166; animation: aa-ring-draw .5s cubic-bezier(.65,0,.35,1) forwards; }
.aa-mark { stroke-dasharray: 48; stroke-dashoffset: 48; animation: aa-mark-draw .38s cubic-bezier(.65,0,.35,1) .32s forwards; }

.aa-btn { transition: transform .12s ease, filter .16s ease, background .16s ease, border-color .16s ease, box-shadow .16s ease; }
.aa-btn:hover { filter: brightness(1.06); }
.aa-btn:active { transform: translateY(1px) scale(.99); }
.aa-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px rgb(var(--accent) / .35); }

/* Superfície de vidro do alerta — segue os tokens do tema e o nível de efeito */
.aa-surface {
 background-color: rgb(var(--glass-bg) / calc(var(--glass-alpha) + 0.22));
 backdrop-filter: blur(var(--blur-lg)) saturate(180%);
 -webkit-backdrop-filter: blur(var(--blur-lg)) saturate(180%);
 border: 1px solid rgb(var(--glass-border) / calc(var(--glass-border-alpha) + 0.05));
}
[data-fx="lite"] .aa-surface {
 background-color: rgb(var(--surface));
 backdrop-filter: none;
 -webkit-backdrop-filter: none;
}

.aa-scrim {
 background: rgb(var(--canvas) / .62);
 backdrop-filter: blur(var(--blur-md));
 -webkit-backdrop-filter: blur(var(--blur-md));
}
[data-fx="lite"] .aa-scrim {
 background: rgb(var(--canvas) / .9);
 backdrop-filter: none;
 -webkit-backdrop-filter: none;
}

@media (prefers-reduced-motion: reduce) {
 .aa-ring, .aa-mark { animation: none !important; stroke-dashoffset: 0 !important; }
 .aa-halo { animation: none !important; }
}
[data-motion="reduce"] .aa-ring,
[data-motion="reduce"] .aa-mark { animation: none !important; stroke-dashoffset: 0 !important; }
[data-motion="reduce"] .aa-halo { animation: none !important; }
`;

function useInjectStyles() {
  useEffect(() => {
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = CSS;
    document.head.appendChild(el);
  }, []);
}

/* ------------------------------------------------------------------ */
/* ÍCONE ANIMADO (SVG desenhado na entrada) */
/* ------------------------------------------------------------------ */

function AlertIcon({ type }: { type: AlertType }) {
  const { main, soft, glow } = ACCENT[type];
  const stroke = {
    fill: "none",
    stroke: soft,
    strokeWidth: 5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <div className="relative h-[78px] w-[78px]">
      <div className="aa-halo absolute -inset-2 rounded-full [animation:aa-halo_2.4s_ease-in-out_infinite]" style={{ background: `radial-gradient(circle, ${glow} 0%, transparent 70%)`, opacity: "var(--fx-glow, 1)" }} />
      <svg viewBox="0 0 60 60" width={78} height={78} className="relative">
        <circle className="aa-ring" cx="30" cy="30" r="26.5" fill="none" stroke={main} strokeWidth={4} opacity={0.9} />
        {type === "success" && <polyline className="aa-mark" points="19,31 27,39 42,22" {...stroke} />}
        {type === "error" && (
          <>
            <line className="aa-mark" x1="21" y1="21" x2="39" y2="39" {...stroke} />
            <line className="aa-mark" x1="39" y1="21" x2="21" y2="39" {...stroke} style={{ animationDelay: ".42s" }} />
          </>
        )}
        {type === "warning" && (
          <>
            <line className="aa-mark" x1="30" y1="18" x2="30" y2="34" {...stroke} />
            <circle cx="30" cy="42" r="2.6" fill={soft} />
          </>
        )}
        {type === "info" && (
          <>
            <circle cx="30" cy="20" r="2.6" fill={soft} />
            <line className="aa-mark" x1="30" y1="28" x2="30" y2="42" {...stroke} />
          </>
        )}
        {type === "question" && <path className="aa-mark" d="M23 24a7 7 0 0 1 13 2c0 5-6 5-6 9" {...stroke} />}
        {type === "question" && <circle cx="30" cy="42" r="2.6" fill={soft} />}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MODAL */
/* ------------------------------------------------------------------ */

function Modal({ opts, closing, onConfirm, onCancel }: { opts: AlertOptions; closing: boolean; onConfirm: () => void; onCancel: () => void }) {
  const type = opts.type ?? "info";
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && opts.allowOutsideClick !== false) onCancel();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, onConfirm, opts.allowOutsideClick]);

  return (
    <div
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && opts.allowOutsideClick !== false) onCancel();
      }}
      className="aa-scrim fixed inset-0 z-[9999] flex items-center justify-center p-5 [animation:aa-backdrop-in_.2s_ease]"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={opts.title}
        style={{
          ...accentVars(type),
          animation: closing ? "aa-card-out .18s ease forwards" : "aa-card-in .34s cubic-bezier(.34,1.56,.64,1)",
          boxShadow: "var(--shadow-3)",
        }}
        className="aa-surface relative w-full max-w-[390px] overflow-hidden rounded-[22px] px-[26px] pb-6 pt-[30px]"
      >
        {/* Halo de cor do tipo, atrás do conteúdo */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(120% 90% at 50% -10%, var(--aa-glow) 0%, transparent 55%)",
            opacity: "var(--fx-glow, 1)",
          }}
        />
        {/* fio de luz no topo */}
        <div aria-hidden className="pointer-events-none absolute inset-x-[18%] top-0 h-px opacity-80" style={{ background: "linear-gradient(90deg, transparent, var(--aa-main), transparent)" }} />

        {opts.showClose !== false && (
          <button aria-label="Fechar" onClick={onCancel} className="aa-btn absolute right-3.5 top-3.5 z-10 grid h-8 w-8 cursor-pointer place-items-center rounded-lg border-0 bg-fg/[0.04] text-[15px] leading-none text-faint hover:bg-fg/[0.08] hover:text-ink">
            ✕
          </button>
        )}

        <div className="relative mb-[18px] grid place-items-center">
          <AlertIcon type={type} />
        </div>

        {opts.title && <h2 className="relative m-0 text-center text-[19px] tracking-[-0.015em] text-ink">{opts.title}</h2>}

        {opts.message && <div className="relative mt-2 text-center text-[13.5px] leading-[1.55] text-mist">{opts.message}</div>}

        <div className="relative mt-6 flex gap-2.5">
          {opts.showCancel && (
            <button onClick={onCancel} className="aa-btn flex-1 cursor-pointer rounded-xl border border-fg/[0.1] bg-fg/[0.04] px-3.5 py-[11px] text-[13.5px] text-ink hover:bg-fg/[0.08]">
              {opts.cancelText ?? "Cancelar"}
            </button>
          )}
          <button
            ref={confirmRef}
            onClick={onConfirm}
            style={{
              ...accentVars(type),
              background: "var(--aa-main)",
              boxShadow: "0 6px 20px -8px var(--aa-main)",
            }}
            className="aa-btn flex-1 cursor-pointer rounded-xl border-0 px-3.5 py-[11px] text-[13.5px] text-white"
          >
            {opts.confirmText ?? "Entendi"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TOAST */
/* ------------------------------------------------------------------ */

function Toast({ opts, closing, onClose }: { opts: AlertOptions; closing: boolean; onClose: () => void }) {
  const type = opts.type ?? "info";
  const accent = ACCENT[type];
  const position = opts.position ?? "top-right";
  const timer = opts.timer ?? 4000;

  const anchor: React.CSSProperties =
    position === "top-right"
      ? { top: 18, right: 18, animationName: "aa-toast-in-r" }
      : position === "bottom-right"
        ? { bottom: 18, right: 18, animationName: "aa-toast-in-b" }
        : position === "bottom"
          ? { bottom: 18, left: "50%", transform: "translateX(-50%)", animationName: "aa-toast-in-b" }
          : { top: 18, left: "50%", transform: "translateX(-50%)", animationName: "aa-toast-in-t" };

  return (
    <div
      role="status"
      style={{
        ...anchor,
        animation: closing ? "aa-toast-out .2s ease forwards" : `${anchor.animationName} .32s cubic-bezier(.34,1.56,.64,1)`,
        boxShadow: "var(--shadow-2)",
      }}
      className="aa-surface fixed z-[9999] flex max-w-[360px] items-center gap-3 overflow-hidden rounded-2xl px-[15px] py-[13px]"
    >
      {/* barra lateral colorida por tipo */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ background: accent.main }} />

      <span className="grid h-[32px] w-[32px] shrink-0 place-items-center rounded-[10px] text-[15px]" style={{ background: accent.glow, color: accent.main }}>
        {type === "success" ? "✓" : type === "error" ? "✕" : type === "warning" ? "!" : type === "question" ? "?" : "i"}
      </span>
      <div className="min-w-0 flex-1">
        {opts.title && <div className="text-[13.5px] leading-[1.3] text-ink">{opts.title}</div>}
        {opts.message && <div className={`text-[12.5px] leading-[1.4] text-mist ${opts.title ? "mt-0.5" : ""}`}>{opts.message}</div>}
      </div>
      <button aria-label="Fechar" onClick={onClose} className="aa-btn ml-1 grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-[12px] text-faint hover:bg-fg/[0.08] hover:text-ink">
        ✕
      </button>
      {timer > 0 && <span aria-hidden className="absolute bottom-0 left-0 h-[2.5px] w-full origin-left opacity-70" style={{ background: accent.main, animation: `aa-progress ${timer}ms linear forwards` }} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* CONTEXT + PROVIDER */
/* ------------------------------------------------------------------ */

type FireFn = (options: AlertOptions) => Promise<AlertResult>;

const AlertContext = createContext<{ fire: FireFn } | null>(null);

// ponte para uso imperativo fora de componentes (ex.: interceptor do axios)
let _fire: FireFn | null = null;

export function AlertProvider({ children }: { children: React.ReactNode }) {
  useInjectStyles();
  const [active, setActive] = useState<AlertOptions | null>(null);
  const [closing, setClosing] = useState(false);
  const resolveRef = useRef<((r: AlertResult) => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finish = useCallback((result: AlertResult) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    resolveRef.current?.(result);
    resolveRef.current = null;
    setClosing(true);
    setTimeout(() => {
      setActive(null);
      setClosing(false);
    }, 200);
  }, []);

  const fire = useCallback<FireFn>(
    (options) =>
      new Promise<AlertResult>((resolve) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        resolveRef.current = resolve;
        setClosing(false);
        setActive(options);
        const timer = options.toast ? (options.timer ?? 4000) : (options.timer ?? 0);
        if (timer > 0) {
          timerRef.current = setTimeout(() => finish({ confirmed: false, dismissed: true }), timer);
        }
      }),
    [finish],
  );

  useEffect(() => {
    _fire = fire;
    return () => {
      if (_fire === fire) _fire = null;
    };
  }, [fire]);

  return (
    <AlertContext.Provider value={{ fire }}>
      {children}
      {active &&
        createPortal(
          active.toast ? <Toast opts={active} closing={closing} onClose={() => finish({ confirmed: false, dismissed: true })} /> : <Modal opts={active} closing={closing} onConfirm={() => finish({ confirmed: true, dismissed: false })} onCancel={() => finish({ confirmed: false, dismissed: true })} />,
          document.body,
        )}
    </AlertContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* HOOK + HELPERS */
/* ------------------------------------------------------------------ */

function makeHelpers(fire: FireFn) {
  return {
    fire,
    success: (title: string, message?: React.ReactNode, o?: AlertOptions) => fire({ type: "success", title, message, ...o }),
    error: (title: string, message?: React.ReactNode, o?: AlertOptions) => fire({ type: "error", title, message, ...o }),
    warning: (title: string, message?: React.ReactNode, o?: AlertOptions) => fire({ type: "warning", title, message, ...o }),
    info: (title: string, message?: React.ReactNode, o?: AlertOptions) => fire({ type: "info", title, message, ...o }),
    confirm: (title: string, message?: React.ReactNode, o?: AlertOptions) => fire({ type: "question", title, message, showCancel: true, confirmText: "Confirmar", ...o }),
    toast: (type: AlertType, title: string, message?: React.ReactNode, o?: AlertOptions) => fire({ type, title, message, toast: true, showClose: false, ...o }),
  };
}

export function useAlert() {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error("useAlert precisa estar dentro de <AlertProvider>.");
  return makeHelpers(ctx.fire);
}

/**
 * API imperativa para usar em qualquer lugar (interceptors, services, utils),
 * sem precisar de hook. Requer o <AlertProvider> montado na árvore.
 */
export const alert = makeHelpers((options) => {
  if (!_fire) return Promise.reject(new Error("AlertProvider não está montado."));
  return _fire(options);
});
