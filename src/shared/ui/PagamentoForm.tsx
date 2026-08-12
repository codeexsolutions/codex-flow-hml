import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Banknote, QrCode, CreditCard, Landmark, FileText, Handshake, Check, Loader2, ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import MoneyInput from "@/shared/ui/inputs/MoneyInput";
import { formatCurrency } from "@/shared/utils/currency";

/**
 * Formulário de recebimento — um só, para toda parte do sistema.
 *
 * Antes havia dois: o da nota (tipo + valor, sem contexto de quanto faltava) e
 * o do financeiro (só a forma, quitando tudo obrigatoriamente). Quem dava baixa
 * num lugar encontrava outra tela no outro, e o do financeiro nem permitia
 * receber metade — que é o caso mais comum do balcão.
 *
 * O que este resolve, em ordem de importância para quem opera:
 *
 * 1. **Mostra a conta antes de pedir o valor.** Total, já pago e quanto falta
 *    ficam no topo. Sem isso o operador calcula de cabeça e erra.
 * 2. **Atalhos para os valores reais.** Tudo, metade, ou digitar. Metade é o
 *    sinal; digitar é o "me dá 50 reais agora".
 * 3. **Forma de pagamento com ícone.** Seis opções em texto puro viram uma
 *    lista para ler; com ícone, viram alvos para reconhecer.
 * 4. **Avisa o que vai acontecer.** O rodapé diz se a nota fica quitada ou
 *    quanto continua em aberto — antes de confirmar, não depois.
 */

export const FORMAS: { id: string; label: string; icone: LucideIcon }[] = [
  { id: "Dinheiro", label: "Dinheiro", icone: Banknote },
  { id: "Pix", label: "Pix", icone: QrCode },
  { id: "Crédito", label: "Crédito", icone: CreditCard },
  { id: "Débito", label: "Débito", icone: Landmark },
  { id: "Cheque", label: "Cheque", icone: FileText },
  { id: "Negociação", label: "Negociação", icone: Handshake },
];

type Props = {
  total: number;
  jaPago: number;
  salvando?: boolean;
  /** Rótulo do botão. O padrão serve para nota; o financeiro usa o dele. */
  textoConfirmar?: string;
  /**
   * Encolhe tipografia e espaçamentos.
   *
   * Na nota o formulário mora numa coluna de 320px ao lado da venda, não numa
   * tela própria. Com os tamanhos do financeiro, os três números do topo
   * quebravam em duas linhas e o formulário passava da altura visível — quem
   * recebia não via a conta inteira sem rolar.
   */
  compacto?: boolean;
  onConfirmar: (valor: number, forma: string) => void | Promise<void>;
  onCancelar?: () => void;
};

const PagamentoForm = ({ total, jaPago, salvando = false, textoConfirmar = "Adicionar pagamento", compacto = false, onConfirmar, onCancelar }: Props) => {
  const restante = useMemo(() => Math.max(Math.round((total - jaPago) * 100) / 100, 0), [total, jaPago]);

  const [forma, setForma] = useState(FORMAS[0].id);

  /* As seis formas ficam guardadas atrás do botão do método escolhido: elas só
     importam no instante em que se troca de método, e ocupavam mais altura que
     o campo do valor — o dado que realmente muda a cada recebimento. */
  const [abertoFormas, setAbertoFormas] = useState(false);
  const formasRef = useRef<HTMLDivElement>(null);
  const [valor, setValor] = useState(restante);

  /* Quando a nota muda (outro pedido, outro valor), o campo acompanha —
     manter o valor da nota anterior seria erro esperando acontecer. */
  useEffect(() => setValor(restante), [restante]);

  /* Clique fora e Esc fecham — a lista some sozinha depois de escolher, mas
     desistir da troca tem que custar o mesmo tanto. */
  useEffect(() => {
    if (!abertoFormas) return;

    const aoClicar = (e: MouseEvent) => {
      if (!formasRef.current?.contains(e.target as Node)) setAbertoFormas(false);
    };

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbertoFormas(false);
    };

    document.addEventListener("mousedown", aoClicar);
    document.addEventListener("keydown", aoTeclar);

    return () => {
      document.removeEventListener("mousedown", aoClicar);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [abertoFormas]);

  const metade = Math.round((restante / 2) * 100) / 100;
  const sobra = Math.max(Math.round((restante - valor) * 100) / 100, 0);
  const excede = valor > restante;

  const podeConfirmar = valor > 0 && !excede && !salvando;

  const escolhida = FORMAS.find((f) => f.id === forma) ?? FORMAS[0];
  const FormaAtual = escolhida.icone;

  return (
    <div className={`flex flex-col ${compacto ? "gap-3.5" : "gap-5"}`}>
      {/* A conta, antes de pedir o valor */}
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl bg-fg/[0.06]">
        {[
          { rotulo: "Nota", valor: total, cor: "text-ink" },
          { rotulo: "Recebido", valor: jaPago, cor: "text-success" },
          { rotulo: "Falta", valor: restante, cor: restante > 0 ? "text-warning" : "text-success" },
        ].map((c) => (
          <div key={c.rotulo} className={`bg-surface text-center ${compacto ? "px-1.5 py-2" : "px-3 py-2.5"}`}>
            <p className={`uppercase tracking-[0.08em] text-faint ${compacto ? "text-[9.5px]" : "text-[10.5px]"}`}>{c.rotulo}</p>
            <p className={`mt-0.5 truncate tabular-nums ${compacto ? "text-[12px]" : "mt-1 text-[14px]"} ${c.cor}`}>{formatCurrency(c.valor)}</p>
          </div>
        ))}
      </div>

      {/* Quanto está recebendo */}
      <div>
        <label className={`mb-1.5 block uppercase tracking-[0.08em] text-faint ${compacto ? "text-[10px]" : "mb-2 text-[11px]"}`}>Quanto está recebendo</label>

        <MoneyInput
          value={valor}
          onChange={setValor}
          withIcon
          className={`w-full rounded-xl border bg-fg/[0.03] tabular-nums text-ink outline-none transition-colors ${
            compacto ? "px-3 py-2.5 text-[13.5px]" : "px-3.5 py-3 text-[15px]"
          } ${excede ? "border-danger/60" : "border-fg/[0.08] focus:border-accent/60"}`}
        />

        <div className="mt-2 flex gap-2">
          <button type="button" onClick={() => setValor(restante)} className={`flex-1 rounded-lg border transition-colors ${compacto ? "py-1 text-[10.5px]" : "py-1.5 text-[11.5px]"} ${valor === restante ? "border-accent bg-accent/[0.12] text-accent-soft" : "border-fg/[0.1] text-mist hover:text-ink"}`}>
            Tudo · {formatCurrency(restante)}
          </button>
          <button type="button" onClick={() => setValor(metade)} className={`flex-1 rounded-lg border transition-colors ${compacto ? "py-1 text-[10.5px]" : "py-1.5 text-[11.5px]"} ${valor === metade ? "border-accent bg-accent/[0.12] text-accent-soft" : "border-fg/[0.1] text-mist hover:text-ink"}`}>
            Metade · {formatCurrency(metade)}
          </button>
        </div>

        {excede && <p className={`mt-2 text-danger ${compacto ? "text-[10.5px]" : "text-[11.5px]"}`}>Passou do que falta — o máximo é {formatCurrency(restante)}.</p>}
      </div>

      {/* Como está recebendo */}
      <div ref={formasRef} className="relative">
        <label className={`mb-1.5 block uppercase tracking-[0.08em] text-faint ${compacto ? "text-[10px]" : "mb-2 text-[11px]"}`}>Como o cliente pagou</label>

        {/* O método escolhido é o próprio botão: mostra o estado e abre a troca. */}
        <button
          type="button"
          onClick={() => setAbertoFormas((v) => !v)}
          aria-expanded={abertoFormas}
          className={`flex w-full items-center gap-2.5 rounded-xl border transition-colors ${
            compacto ? "min-h-[40px] px-3 text-[12px]" : "min-h-[46px] px-3.5 text-[13px]"
          } ${abertoFormas ? "border-accent/60 bg-accent/[0.08] text-ink" : "border-fg/[0.08] bg-fg/[0.03] text-ink hover:border-fg/[0.16]"}`}
        >
          <span className={`grid shrink-0 place-items-center rounded-lg bg-accent/[0.14] text-accent-soft ${compacto ? "h-6 w-6" : "h-7 w-7"}`}>
            <FormaAtual size={compacto ? 13 : 15} />
          </span>

          <span className="min-w-0 flex-1 truncate text-left">{escolhida.label}</span>

          <ChevronDown size={15} className={`shrink-0 text-muted transition-transform duration-200 ${abertoFormas ? "rotate-180" : ""}`} />
        </button>

        {/* A lista cresce a partir do botão, e cada opção entra escalonada — o
            movimento sai de onde o clique foi, não do nada. */}
        <AnimatePresence>
          {abertoFormas && (
            <motion.div
              initial={{ opacity: 0, scaleY: 0.86, y: -6 }}
              animate={{ opacity: 1, scaleY: 1, y: 0 }}
              exit={{ opacity: 0, scaleY: 0.9, y: -4 }}
              transition={{ type: "spring", stiffness: 500, damping: 34, mass: 0.6 }}
              className="absolute left-0 right-0 top-full z-20 mt-1.5 origin-top rounded-xl border border-fg/[0.1] bg-surface p-2 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.5)]"
            >
              <div className="grid grid-cols-3 gap-1.5">
                {FORMAS.map((f, i) => {
                  const Icone = f.icone;
                  const on = forma === f.id;

                  return (
                    <motion.button
                      key={f.id}
                      type="button"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.02 * i, duration: 0.16, ease: "easeOut" }}
                      onClick={() => {
                        setForma(f.id);
                        setAbertoFormas(false);
                      }}
                      aria-pressed={on}
                      className={`flex flex-col items-center justify-center gap-1 rounded-lg border transition-colors ${
                        compacto ? "min-h-[50px] text-[10.5px]" : "min-h-[58px] gap-1.5 text-[11.5px]"
                      } ${on ? "border-accent bg-accent/[0.12] text-accent-soft" : "border-fg/[0.07] text-mist hover:border-fg/[0.18] hover:text-ink"}`}
                    >
                      <Icone size={compacto ? 15 : 17} />
                      {f.label}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* O que vai acontecer — antes de confirmar */}
      {/* O aviso troca de conteúdo conforme o valor digitado — animar a troca
          faz o olho perceber que ele mudou, sem precisar reler. */}
      <AnimatePresence mode="wait">
        {valor > 0 && !excede && (
          <motion.p
            key={sobra === 0 ? "quita" : "resta"}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`rounded-xl border border-fg/[0.07] bg-fg/[0.02] leading-relaxed text-mist ${compacto ? "px-3 py-2 text-[11px]" : "px-3.5 py-2.5 text-[12px]"}`}
          >
            {sobra === 0 ? (
              <>
                Depois disso a nota fica <span className="text-success">sem saldo em aberto</span>.
              </>
            ) : (
              <>
                Ainda ficam <span className="tabular-nums text-warning">{formatCurrency(sobra)}</span> a receber.
              </>
            )}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="flex justify-end gap-2">
        {onCancelar && (
          <button type="button" onClick={onCancelar} className="min-h-[44px] rounded-xl border border-fg/[0.1] px-4 text-[13px] text-mist transition-colors hover:text-ink">
            Cancelar
          </button>
        )}

        <button
          type="button"
          onClick={() => onConfirmar(valor, forma)}
          disabled={!podeConfirmar}
          className={`flex items-center justify-center gap-2 rounded-xl bg-accent text-white transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-40 ${
            compacto ? "min-h-[40px] w-full px-4 text-[12.5px]" : "min-h-[44px] px-5 text-[13px]"
          }`}
        >
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          {textoConfirmar}
        </button>
      </div>
    </div>
  );
};

export default PagamentoForm;
