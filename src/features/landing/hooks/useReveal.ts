import { useEffect } from "react";

/**
 * Faz os blocos marcados com `data-reveal` entrarem conforme a rolagem.
 *
 * `IntersectionObserver` em vez de listener de scroll: o navegador avisa
 * quando o elemento entra na tela, sem rodar código a cada pixel rolado.
 *
 * **A rede de proteção importa mais do que parece.** O observer não dispara
 * enquanto o documento está oculto — e abrir link em aba de segundo plano é
 * caso comum. Sem a varredura manual, a pessoa trocava para a aba e via a
 * página inteira em branco até rolar. Por isso, além do observer, os elementos
 * já visíveis são revelados na hora e a varredura roda de novo quando a aba
 * volta a aparecer.
 *
 * Com `prefers-reduced-motion` tudo nasce visível.
 */
export function useReveal(dependencia?: unknown): void {
  useEffect(() => {
    const itens = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (itens.length === 0) return;

    const revelar = (el: Element) => el.classList.add("revelado");

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      itens.forEach(revelar);
      return;
    }

    /** Revela o que já está dentro da janela, sem depender do observer. */
    const varrer = () => {
      const altura = window.innerHeight || document.documentElement.clientHeight;

      itens.forEach((el) => {
        if (el.classList.contains("revelado")) return;

        const r = el.getBoundingClientRect();
        const visivel = r.top < altura * 0.94 && r.bottom > 0;

        if (visivel) revelar(el);
      });
    };

    const observador = new IntersectionObserver(
      (entradas, obs) => {
        entradas.forEach((entrada) => {
          if (!entrada.isIntersecting) return;

          revelar(entrada.target);
          obs.unobserve(entrada.target);
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -6% 0px" },
    );

    itens.forEach((el) => observador.observe(el));

    varrer();

    const aoVoltar = () => {
      if (document.visibilityState === "visible") varrer();
    };

    document.addEventListener("visibilitychange", aoVoltar);

    return () => {
      observador.disconnect();
      document.removeEventListener("visibilitychange", aoVoltar);
    };
    // `dependencia` permite reobservar quando a lista muda (ex.: planos que
    // chegam da API depois da primeira pintura).
  }, [dependencia]);
}
