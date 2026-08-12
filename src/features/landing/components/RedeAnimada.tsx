import { useEffect, useRef } from "react";

/**
 * Fundo de rede: pontos que flutuam, se ligam quando estão perto e disparam
 * pulsos de luz pelas linhas.
 *
 * Detalhes que fazem diferença aqui:
 *
 * - A cor sai do token `--accent` lido **no próprio canvas**, não no `html`.
 *   O elemento vive dentro de `.vitrine`, que fixa a identidade da marca: lendo
 *   do `html` a rede assumiria o tema que o visitante salvou em Aparência e a
 *   mesma página apareceria verde para um e vinho para outro.
 * - `prefers-reduced-motion` desenha **um quadro** e para. A tela continua
 *   bonita, sem movimento contínuo para quem pediu menos movimento.
 * - A animação congela com a aba em segundo plano: `requestAnimationFrame`
 *   rodando escondido é bateria queimada à toa.
 * - O ponteiro só é seguido em telas com mouse; no toque não há hover e o
 *   listener seria peso morto.
 */

type Ponto = { x: number; y: number; vx: number; vy: number };
type Pulso = { i: number; j: number; t: number; velocidade: number };

const DISTANCIA_LIGACAO = 132;

/**
 * `className` existe porque a rede tem dois usos: na página inicial ela cobre a
 * viewport inteira (`fixed`), e no painel do login precisa ficar presa ao painel
 * (`absolute`) — fixa, passaria por cima do formulário ao lado.
 */
const RedeAnimada = ({ className = "fixed inset-0" }: { className?: string }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const temMouse = window.matchMedia("(pointer: fine)").matches;

    /** Canal RGB do accent, para montar rgba() com opacidade variável. */
    const accent = () => getComputedStyle(canvas).getPropertyValue("--accent").trim() || "141 112 255";

    let largura = 0;
    let altura = 0;
    let pontos: Ponto[] = [];
    const pulsos: Pulso[] = [];
    const ponteiro = { x: -9999, y: -9999, ativo: false };

    const redimensionar = () => {
      // Teto de 2 no DPR: acima disso o ganho visual some e o custo dobra.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      largura = canvas.clientWidth;
      altura = canvas.clientHeight;
      canvas.width = Math.floor(largura * dpr);
      canvas.height = Math.floor(altura * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const quantidade = Math.min(Math.round((largura * altura) / 15000), 82);

      pontos = Array.from({ length: quantidade }, () => ({
        x: Math.random() * largura,
        y: Math.random() * altura,
        vx: (Math.random() - 0.5) * 0.24,
        vy: (Math.random() - 0.5) * 0.24,
      }));
    };

    const desenhar = () => {
      const cor = accent();
      ctx.clearRect(0, 0, largura, altura);

      for (const p of pontos) {
        p.x += p.vx;
        p.y += p.vy;

        // Atravessa a borda e reaparece do outro lado.
        if (p.x < -30) p.x = largura + 30;
        else if (p.x > largura + 30) p.x = -30;
        if (p.y < -30) p.y = altura + 30;
        else if (p.y > altura + 30) p.y = -30;

        if (ponteiro.ativo) {
          const dx = ponteiro.x - p.x;
          const dy = ponteiro.y - p.y;
          if (dx * dx + dy * dy < 26000) {
            p.x += dx * 0.0008;
            p.y += dy * 0.0008;
          }
        }
      }

      for (let i = 0; i < pontos.length; i++) {
        for (let j = i + 1; j < pontos.length; j++) {
          const a = pontos[i];
          const b = pontos[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist >= DISTANCIA_LIGACAO) continue;

          let opacidade = (1 - dist / DISTANCIA_LIGACAO) * 0.34;

          if (ponteiro.ativo) {
            const pd = Math.hypot((a.x + b.x) / 2 - ponteiro.x, (a.y + b.y) / 2 - ponteiro.y);
            if (pd < 170) opacidade = Math.min(0.8, opacidade + (1 - pd / 170) * 0.45);
          }

          ctx.strokeStyle = `rgba(${cor} / ${opacidade})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();

          if (!reduzir && pulsos.length < 9 && Math.random() < 0.0011) {
            pulsos.push({ i, j, t: 0, velocidade: 0.012 + Math.random() * 0.01 });
          }
        }
      }

      ctx.fillStyle = `rgba(${cor} / 0.75)`;
      for (const p of pontos) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }

      for (let k = pulsos.length - 1; k >= 0; k--) {
        const pulso = pulsos[k];
        pulso.t += pulso.velocidade;

        const a = pontos[pulso.i];
        const b = pontos[pulso.j];

        if (pulso.t >= 1 || !a || !b) {
          pulsos.splice(k, 1);
          continue;
        }

        const x = a.x + (b.x - a.x) * pulso.t;
        const y = a.y + (b.y - a.y) * pulso.t;

        const brilho = ctx.createRadialGradient(x, y, 0, x, y, 7);
        brilho.addColorStop(0, `rgba(${cor} / 0.9)`);
        brilho.addColorStop(1, `rgba(${cor} / 0)`);

        ctx.fillStyle = brilho;
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    let raf = 0;
    const laco = () => {
      desenhar();
      raf = requestAnimationFrame(laco);
    };

    redimensionar();
    window.addEventListener("resize", redimensionar);

    const aoMover = (e: PointerEvent) => {
      // `clientX/Y` é coordenada da janela. Quando a rede está presa a um painel
      // (login), a origem dela não é a da janela: sem descontar o retângulo, as
      // linhas acendiam deslocadas do cursor.
      const r = canvas.getBoundingClientRect();
      ponteiro.x = e.clientX - r.left;
      ponteiro.y = e.clientY - r.top;
      ponteiro.ativo = true;
    };
    const aoSair = () => {
      ponteiro.ativo = false;
    };

    if (temMouse) {
      window.addEventListener("pointermove", aoMover);
      window.addEventListener("pointerleave", aoSair);
    }

    const aoTrocarAba = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else raf = requestAnimationFrame(laco);
    };

    if (reduzir) {
      desenhar();
    } else {
      document.addEventListener("visibilitychange", aoTrocarAba);
      laco();
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", redimensionar);
      window.removeEventListener("pointermove", aoMover);
      window.removeEventListener("pointerleave", aoSair);
      document.removeEventListener("visibilitychange", aoTrocarAba);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={`pointer-events-none z-0 h-full w-full ${className}`} />;
};

export default RedeAnimada;
