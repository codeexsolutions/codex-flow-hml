import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MessageCircle, Check, ArrowRight, Loader2 } from "lucide-react";

import RedeAnimada from "@/features/landing/components/RedeAnimada";

/**
 * A tela entre o cadastro e a conversa.
 *
 * Poderia não existir: bastaria trocar `window.location` pelo link do wa.me
 * assim que o cadastro terminasse. Mas nesse desenho, três coisas dão errado
 * e todas custam o cliente — o bloqueador de pop-up engole o redirecionamento
 * e a pessoa fica olhando uma tela em branco; no desktop sem WhatsApp Web a
 * aba abre num QR code sem explicação; e quem fecha a conversa por engano não
 * tem como voltar, porque saiu do sistema.
 *
 * Com a tela no meio, o redirecionamento é uma tentativa, não uma aposta:
 * se falhar, o botão está ali. E a conta já existe — o acesso continua
 * disponível pelo caminho de pagamento, para quem preferir resolver sozinho.
 */

type EstadoNavegacao = {
  linkWhatsapp?: string;
  nome?: string;
  planoCodigo?: string;
};

/** Tempo antes de abrir o WhatsApp: o suficiente para ler o que aconteceu. */
const ESPERA_MS = 1600;

const BoasVindasPage = () => {

  const navigate = useNavigate();
  const { state } = useLocation() as { state: EstadoNavegacao | null };

  const link = state?.linkWhatsapp ?? "";
  const primeiroNome = (state?.nome ?? "").trim().split(" ")[0];

  const [abrindo, setAbrindo] = useState(Boolean(link));

  /* Uma tentativa só. Sem o ref, um re-render abriria a conversa de novo e a
     pessoa voltaria para o começo do atendimento. */
  const jaAbriu = useRef(false);

  useEffect(() => {
    // Chegar aqui sem link é sinal de navegação direta na barra de endereço:
    // não há conversa para abrir, então o lugar certo é o pagamento.
    if (!link) {
      navigate("/checkout", { replace: true });
      return;
    }

    const timer = window.setTimeout(() => {
      if (jaAbriu.current) return;

      jaAbriu.current = true;
      setAbrindo(false);
      window.open(link, "_blank", "noopener,noreferrer");
    }, ESPERA_MS);

    return () => window.clearTimeout(timer);
  }, [link, navigate]);

  if (!link) return null;

  return (
    <div className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-canvas px-4">
      <RedeAnimada className="absolute inset-0" />

      <div className="glass-liquid relative z-10 w-full max-w-md rounded-2xl p-7 text-center">
        <span className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-accent-soft to-transparent opacity-70" />

        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-success/[0.12] text-success ring-1 ring-inset ring-success/25">
          <Check size={24} />
        </span>

        <h1 className="mt-4 text-[20px] leading-tight text-ink">
          Conta criada{primeiroNome ? `, ${primeiroNome}` : ""}.
        </h1>

        <p className="mt-2 text-[13px] leading-relaxed text-mist">
          Agora falta a parte rápida: a gente conversa pelo WhatsApp, confere se o plano
          escolhido é mesmo o que você precisa e libera o acesso na hora.
        </p>

        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => { jaAbriu.current = true; setAbrindo(false); }}
          className="group relative mt-6 flex min-h-[48px] w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-accent-soft via-accent to-accent-strong text-[14px] text-white shadow-[0_10px_25px_-8px_rgba(108,92,231,0.7)] transition-all duration-200 hover:brightness-110 active:scale-[0.99]"
        >
          <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-fg/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          <span className="relative flex items-center gap-2">
            {abrindo ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
            {abrindo ? "Abrindo o WhatsApp..." : "Falar no WhatsApp agora"}
          </span>
        </a>

        <p className="mt-3 text-[11.5px] leading-relaxed text-faint">
          A mensagem já vai escrita com o seu perfil — é só enviar.
        </p>

        {/* Quem prefere resolver sozinho não fica preso à conversa: a conta
            existe e o caminho de pagamento continua aberto. */}
        <button
          type="button"
          onClick={() => navigate("/checkout", { replace: true })}
          className="mt-5 inline-flex items-center gap-1.5 text-[12px] text-mist transition-colors hover:text-ink"
        >
          Prefiro pagar por Pix agora
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
};

export default BoasVindasPage;
