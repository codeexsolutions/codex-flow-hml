import { AnimatePresence } from "framer-motion";

import useTransicao from "@/shared/session/transicao.store";
import TransicaoSessao from "@/shared/session/TransicaoSessao";

/**
 * Onde a transição de sessão é realmente desenhada — acima do roteador.
 *
 * Fica em `main.tsx`, ao lado das rotas: assim a animação de saída continua na
 * tela mesmo depois de a sessão cair e o roteador desmontar a página que a
 * disparou.
 */
const CamadaTransicao = () => {
  const modo = useTransicao((s) => s.modo);
  const nome = useTransicao((s) => s.nome);
  const encerrar = useTransicao((s) => s.encerrar);

  return (
    <AnimatePresence>
      {modo && <TransicaoSessao key={modo} modo={modo} nome={nome} aoTerminar={encerrar} />}
    </AnimatePresence>
  );
};

export default CamadaTransicao;
