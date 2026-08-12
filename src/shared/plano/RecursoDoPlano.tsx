import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, ArrowRight, Sparkles } from "lucide-react";

import usePlano from "@/shared/plano/plano.store";
import { RECURSO_LABEL } from "@/features/assinatura/types/assinatura.types";

/**
 * Porta de módulo pago.
 *
 * Envolve uma rota inteira: se o plano libera, a tela aparece; se não, entra
 * a oferta no lugar. A escolha de mostrar a oferta em vez de redirecionar
 * para a home é deliberada — quem clicou em "Correios" quer Correios, e
 * mandá-lo de volta ao início não responde nada. A tela abaixo responde:
 * o que é, por que está fechado, e o que fazer a respeito.
 *
 * Isto NÃO é segurança. O `planoMiddleware` do backend é quem barra de fato,
 * respondendo 402 para quem digitar a rota na mão.
 */

type Props = {
  /** Flag de `recursos` — as mesmas chaves que o backend usa. */
  recurso: string;
  /** Uma frase dizendo o que a pessoa ganha ao liberar. */
  promessa?: string;
  children: ReactNode;
};

const RecursoDoPlano = ({ recurso, promessa, children }: Props) => {

  const navigate = useNavigate();
  const meu = usePlano((s) => s.meu);

  // Plano ainda não carregado: mostra a tela. Escurecer primeiro e liberar
  // depois faria o módulo piscar um "bloqueado" falso a cada navegação.
  if (!meu) return <>{children}</>;

  if (meu.recursos?.[recurso] === true) return <>{children}</>;

  const nome = RECURSO_LABEL[recurso] ?? "Este recurso";

  return (
    <div className="flex h-full w-full items-center justify-center overflow-y-auto p-6">
      <div className="glass-liquid relative w-full max-w-md rounded-2xl p-7 text-center">
        <span className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-accent-soft to-transparent opacity-70" />

        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent/[0.12] text-accent-soft ring-1 ring-inset ring-accent/20">
          <Lock size={20} />
        </span>

        <h2 className="mt-4 text-lg text-ink">{nome} não está no seu plano</h2>

        <p className="mt-2 text-[13px] leading-relaxed text-mist">
          {promessa ?? `Seu plano ${meu.plano?.nome ?? "atual"} não inclui este módulo. Liberar leva um minuto e vale a partir do próximo acesso.`}
        </p>

        <button
          type="button"
          onClick={() => navigate("/planos")}
          className="group relative mt-6 flex min-h-[46px] w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-accent-soft via-accent to-accent-strong text-[14px] text-white shadow-[0_10px_25px_-8px_rgba(108,92,231,0.7)] transition-all duration-200 hover:brightness-110 active:scale-[0.99]"
        >
          <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-fg/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          <span className="relative flex items-center gap-2">
            <Sparkles size={15} />
            Ver planos com {nome.toLowerCase()}
            <ArrowRight size={15} />
          </span>
        </button>

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-3 text-[12px] text-mist transition-colors hover:text-ink"
        >
          Voltar
        </button>
      </div>
    </div>
  );
};

export default RecursoDoPlano;
