import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Tooltip de verdade, no lugar do `title` do navegador.
 *
 * O `title` nativo tem três defeitos que importam numa fileira de ícones: leva
 * quase um segundo para aparecer, sai com a tipografia do sistema operacional
 * (não a do tema) e some sozinho depois de alguns segundos. Numa tabela onde
 * cinco ícones dividem 160px, isso é a diferença entre saber o que o botão faz
 * e clicar para descobrir.
 *
 * A bolha vai para um **portal no `body`**, e não ao lado do botão. As linhas
 * moram dentro de um corpo com `overflow-y-auto`: uma bolha `absolute` subindo
 * a partir do ícone seria RECORTADA por esse contêiner, e nenhum `z-index`
 * resolve — recorte e empilhamento são coisas diferentes, e o recorte vem
 * primeiro.
 *
 * O `aria-label` continua no botão: a bolha é para quem enxerga, e leitor de
 * tela já tem o nome pela propriedade certa.
 */

type Props = {
  texto: string;
  children: ReactNode;
};

const Dica = ({ texto, children }: Props) => {
  const alvo = useRef<HTMLSpanElement>(null);
  const [posicao, setPosicao] = useState<{ left: number; top: number } | null>(null);

  const mostrar = () => {
    const r = alvo.current?.getBoundingClientRect();
    if (!r) return;

    /* Ancorada ao centro do botão e 8px acima dele — a bolha se centraliza
       sozinha pelo `translate`, então não é preciso medi-la antes. */
    setPosicao({ left: r.left + r.width / 2, top: r.top - 8 });
  };

  const esconder = () => setPosicao(null);

  return (
    <span
      ref={alvo}
      className="inline-flex"
      onMouseEnter={mostrar}
      onMouseLeave={esconder}
      /* Foco também mostra: quem navega por teclado passa pelos mesmos ícones
         e não tem como "pairar" sobre eles. */
      onFocus={mostrar}
      onBlur={esconder}
    >
      {children}

      {posicao &&
        createPortal(
          <span
            role="tooltip"
            style={{ position: "fixed", left: posicao.left, top: posicao.top, transform: "translate(-50%, -100%)" }}
            /* Bolha curta de propósito: ela nomeia o ícone, não explica a
               ação. Rótulo que precisa de 240px não cabe num tooltip — cabe
               numa frase na tela. */
            className="pointer-events-none z-[400] whitespace-nowrap rounded-md border border-fg/[0.1] bg-surface px-2 py-1 text-[11px] leading-none text-ink shadow-[0_8px_20px_-8px_rgba(0,0,0,0.6)]"
          >
            {texto}
          </span>,
          document.body,
        )}
    </span>
  );
};

export default Dica;
