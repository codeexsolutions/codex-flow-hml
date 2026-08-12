import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, FileImage, FileText, Loader2 } from "lucide-react";

import Dica from "@/shared/ui/Dica";

/**
 * "Baixar" numa linha de tabela, com a escolha do formato.
 *
 * Os dois formatos servem a coisas diferentes e a loja usa os dois: o PNG vai
 * para o WhatsApp do cliente (abre na conversa, sem baixar nada), o PDF vai
 * para o e-mail e para a impressora. Escolher por ela erraria metade das
 * vezes.
 *
 * A lista vai para um **portal no `body`**: a linha vive dentro de um corpo
 * com `overflow-y-auto`, e uma lista `absolute` seria recortada por ele.
 */

/** Largura da lista — precisa bater com o `w-[152px]` lá embaixo. */
const LARGURA = 152;

/** Espaço que a lista ocupa; abaixo disso ela abre para baixo. */
const ALTURA = 92;

type Props = {
  onEscolher: (formato: "png" | "pdf") => void;
  ocupado?: boolean;
  /** O que está sendo baixado — entra no tooltip. */
  label: string;
};

const MenuFormatoDownload = ({ onEscolher, ocupado = false, label }: Props) => {
  const [aberto, setAberto] = useState(false);
  const [posicao, setPosicao] = useState<{ left: number; top?: number; bottom?: number } | null>(null);

  const botao = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!aberto) return;

    const posicionar = () => {
      const r = botao.current?.getBoundingClientRect();
      if (!r) return;

      /* Alinhada à direita do botão, sem sair da tela. */
      const left = Math.max(8, Math.min(r.right - LARGURA, window.innerWidth - LARGURA - 8));

      /* Perto do rodapé a lista sobe; perto do topo, desce. Sem isso, a última
         linha da tabela abriria o menu fora da janela. */
      setPosicao(window.innerHeight - r.bottom < ALTURA ? { left, bottom: window.innerHeight - r.top + 6 } : { left, top: r.bottom + 6 });
    };

    posicionar();

    /* `capture`: a rolagem que importa é a do corpo da tabela, não a da janela. */
    window.addEventListener("scroll", posicionar, true);
    window.addEventListener("resize", posicionar);

    return () => {
      window.removeEventListener("scroll", posicionar, true);
      window.removeEventListener("resize", posicionar);
    };
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;

    const aoClicar = (ev: MouseEvent) => {
      const alvo = ev.target as Node;

      /* O menu está no portal, fora da árvore do botão: sem checar as duas
         referências, clicar num item contaria como clique fora e o menu
         sumiria antes do `click` chegar. */
      if (botao.current?.contains(alvo) || menu.current?.contains(alvo)) return;

      setAberto(false);
    };

    const aoTeclar = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;

      /* Não deixa o Esc vazar para o modal/tela por trás. */
      ev.stopPropagation();
      setAberto(false);
    };

    document.addEventListener("mousedown", aoClicar);
    document.addEventListener("keydown", aoTeclar, true);

    return () => {
      document.removeEventListener("mousedown", aoClicar);
      document.removeEventListener("keydown", aoTeclar, true);
    };
  }, [aberto]);

  const escolher = (formato: "png" | "pdf") => {
    setAberto(false);
    onEscolher(formato);
  };

  const item = "flex w-full items-center gap-2 px-3 py-2.5 text-left text-[12.5px] text-ink transition-colors hover:bg-fg/[0.06]";

  return (
    <>
      <Dica texto={label}>
        <button
          ref={botao}
          type="button"
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={aberto}
          disabled={ocupado}
          onClick={(ev) => {
            ev.stopPropagation();
            setAberto((a) => !a);
          }}
          className="focus-ring flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-lg border border-fg/[0.08] bg-surface/90 text-mist transition-colors hover:bg-fg/[0.08] hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          {ocupado ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        </button>
      </Dica>

      {aberto &&
        posicao &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            style={{ position: "fixed", left: posicao.left, top: posicao.top, bottom: posicao.bottom, width: LARGURA }}
            className="z-[300] overflow-hidden rounded-xl border border-fg/[0.1] bg-surface shadow-[0_24px_60px_-20px_rgba(0,0,0,0.5)]"
          >
            <button type="button" role="menuitem" className={item} onClick={() => escolher("png")}>
              <FileImage size={15} className="text-accent-soft" /> Imagem (PNG)
            </button>
            <button type="button" role="menuitem" className={`${item} border-t border-fg/[0.06]`} onClick={() => escolher("pdf")}>
              <FileText size={15} className="text-danger/80" /> PDF
            </button>
          </div>,
          document.body,
        )}
    </>
  );
};

export default MenuFormatoDownload;
