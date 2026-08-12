import { useEffect } from "react";
import type { ReactNode } from "react";

/**
 * Folha que sobe de baixo — o modal do celular.
 *
 * Modal centralizado é padrão de mouse: no celular ele nasce longe do polegar
 * e some atrás do teclado. A folha ancora embaixo, respeita a área segura do
 * aparelho e fecha arrastando a alça ou tocando fora.
 */
export const Sheet = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  altura = "auto",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  /** `auto` cresce com o conteúdo; `cheia` ocupa quase a tela toda. */
  altura?: "auto" | "cheia";
}) => {
  useEffect(() => {
    if (!open) return;

    // Trava a rolagem de trás: sem isso o fundo rola junto com a folha.
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", aoTeclar);

    return () => {
      document.body.style.overflow = anterior;
      window.removeEventListener("keydown", aoTeclar);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div onClick={onClose} className="absolute inset-0 bg-canvas/70" style={{ backdropFilter: "blur(var(--blur-sm))", WebkitBackdropFilter: "blur(var(--blur-sm))" }} />

      <div
        className={`glass-strong elev-3 relative flex w-full flex-col rounded-t-3xl border-x-0 border-b-0 ${altura === "cheia" ? "h-[92dvh]" : "max-h-[88dvh]"}`}
        style={{ animation: "cf-sheet .28s cubic-bezier(.22,.61,.36,1) both" }}
      >
        {/* Alça: sinaliza que dá para arrastar/fechar. */}
        <button type="button" onClick={onClose} aria-label="Fechar" className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-fg/20" />

        {(title || subtitle) && (
          <div className="shrink-0 px-5 pb-3 pt-3">
            {title && <p className="text-[15px] text-ink">{title}</p>}
            {subtitle && <p className="mt-0.5 text-[12px] text-mist">{subtitle}</p>}
          </div>
        )}

        {/* `pb` com a área segura: em iPhone a barra de gestos come o rodapé. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
};

export default Sheet;
