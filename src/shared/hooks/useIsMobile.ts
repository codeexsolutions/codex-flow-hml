import { useEffect, useState } from "react";

/**
 * `true` abaixo de 768px — o mesmo ponto de corte do `md:` do Tailwind, para a
 * lógica em JS e o CSS nunca discordarem sobre o que é "celular".
 *
 * Existe porque parte da versão mobile não é questão de estilo: no celular o
 * menu é outro componente, o modal vira folha e a tabela vira cartão. Isso se
 * decide em React, não em media query.
 */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => (typeof window === "undefined" ? false : window.matchMedia("(max-width: 767px)").matches));

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const aoMudar = (e: MediaQueryListEvent) => setMobile(e.matches);

    mq.addEventListener("change", aoMudar);
    setMobile(mq.matches);

    return () => mq.removeEventListener("change", aoMudar);
  }, []);

  return mobile;
}
