import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Outlet, useLocation } from "react-router-dom";

import useTransicao from "@/shared/session/transicao.store";
import TourInicial from "@/features/tour/TourInicial";

import Sidebar from "@/shared/ui/Sidebar";
import BottomNav from "@/shared/ui/BottomNav";
import useSwipeAbas from "@/shared/hooks/useSwipeAbas";

const Main = () => {
  const { pathname } = useLocation();

  /* Arrastar a tela para o lado troca de aba, no celular. A dock continua sendo
     o caminho declarado; o gesto é o atalho de quem já decorou a ordem. */
  useSwipeAbas();

  /* Na saída o sistema recua enquanto o overlay entra — o oposto exato da
     abertura. Sem isso o logout "cortava": o app sumia de um frame ao outro. */
  const saindo = useTransicao((s) => s.modo) === "saida";
  const reduzir = useReducedMotion();

  /** Vira `true` quando a abertura acaba — a partir daí não há mais camada. */
  const [abriu, setAbriu] = useState(false);

  return (
    /*
     * O sistema entra crescendo, por baixo do overlay que dissolve — é a
     * "abertura" que fecha a animação de login. Roda uma vez, na montagem,
     * que é exatamente quando a sessão passa a valer.
     */
    <motion.div
      className="aurora flex h-[100dvh] w-screen overflow-hidden bg-canvas"
      initial={{ opacity: 0, scale: 0.94 }}
      animate={saindo ? { opacity: 0, scale: 0.94, filter: "blur(6px)" } : { opacity: 1, scale: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.55, ease: [0.22, 0.61, 0.36, 1] }}
      onAnimationComplete={() => !saindo && setAbriu(true)}
      /*
       * Depois que a abertura termina, `transform` e `filter` são APAGADOS.
       *
       * Não é limpeza cosmética: qualquer transform ou filter — mesmo neutro,
       * como `scale(1)` e `blur(0px)` — promove o elemento a camada própria de
       * composição, e camada composta perde a renderização de texto por
       * subpixel. Como isto envolve o sistema inteiro, TODA letra do app ficava
       * borrada para sempre por causa de uma animação de meio segundo.
       */
      style={abriu && !saindo ? { transform: "none", filter: "none" } : undefined}
    >
      {/* A sidebar some no celular (ela mesma se esconde); lá quem navega é a
          barra inferior, ao alcance do polegar. */}
      <Sidebar />

      <main className="relative min-w-0 flex-1 overflow-hidden">
        {/*
         * Só a entrada anima, e só opacidade — sem `AnimatePresence`.
         *
         * As duas tentativas anteriores falharam por motivos concretos:
         * `popLayout` mantém a tela que sai sobreposta à que entra por um
         * instante (o piscar), e animar `scale` num contêiner de tela cheia
         * força o navegador a re-rasterizar todo o texto a cada frame — é
         * literalmente o tremido.
         *
         * Opacidade é composta na GPU e não toca no layout nem no texto. Some
         * um deslocamento de 6px, curto o bastante para dar direção sem chamar
         * atenção. A tela antiga simplesmente sai: ninguém sente falta da
         * saída quando a entrada é rápida.
         */}
        <div key={pathname} className="h-full w-full" style={reduzir ? undefined : { animation: "tela-entra 0.22s cubic-bezier(0.22,0.61,0.36,1) both" }}>
          <Outlet />
        </div>
      </main>

      <BottomNav />

      {/* Apresentação do sistema — uma vez por usuário. */}
      <TourInicial />
    </motion.div>
  );
};

export default Main;
