import { useState } from "react";
import { Eye, EyeOff, Plus, Receipt, ArrowLeftRight, CheckCircle2, Trash2, ArrowUpRight, ArrowDownRight } from "lucide-react";

import { useDinheiroVisivel } from "@/shared/session/valoresVisiveis";

export type AbaFinanceiro = "notas" | "caixa";

export type NotaItem = {
  id: string;
  cliente: string;
  pedido: string | number;
  total: number;
  pago: number;
  data: string;
  quitada: boolean;
  formaPagamento?: string | null;
};

export type MovimentacaoItem = {
  id: string;
  descricao: string;
  categoria?: string | null;
  valor: number;
  data: string;
  entrada: boolean;
};

type Props = {
  aba: AbaFinanceiro;
  onAba: (a: AbaFinanceiro) => void;
  saldoCaixa: number;
  aReceber: number;
  entradas: number;
  saidas: number;
  notas: NotaItem[];
  movimentacoes: MovimentacaoItem[];
  carregando: boolean;
  onPagar: (n: NotaItem) => void;
  onExcluir: (id: string) => void;
  onNovaMovimentacao: () => void;
};

const ABAS: { id: AbaFinanceiro; label: string; icon: typeof Receipt }[] = [
  { id: "notas", label: "Notas", icon: Receipt },
  { id: "caixa", label: "Caixa", icon: ArrowLeftRight },
];

/**
 * Financeiro no celular.
 *
 * O herói é o **saldo em caixa** — o dinheiro que existe agora. Logo abaixo,
 * o que ainda não entrou: a receber e atrasado, lado a lado, porque a distância
 * entre os dois é a pergunta real de quem abre esta tela.
 *
 * Duas decisões de segurança para o toque:
 *
 * - **Baixa de nota é um botão dedicado**, não a linha inteira. Encostar na
 *   lista não pode dar uma nota por paga.
 * - **Excluir pede confirmação na própria linha.** Sem modal, mas sem gesto de
 *   uma etapa só: no celular o dedo erra, e lançamento de caixa não volta.
 */
const FinanceiroMobile = ({
  aba,
  onAba,
  saldoCaixa,
  aReceber,
  entradas,
  saidas,
  notas,
  movimentacoes,
  carregando,
  onPagar,
  onExcluir,
  onNovaMovimentacao,
}: Props) => {
  const { mostrar, alternar, dinheiro } = useDinheiroVisivel();
  const [confirmando, setConfirmando] = useState<string | null>(null);


  return (
    <div className="flex min-h-full flex-col pb-4">
      {/* ---------- Saldo ---------- */}
      <div className="safe-top flex items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <p className="text-[12.5px] text-mist">Saldo em caixa</p>
          <p className={`mt-1 text-[34px] leading-none tracking-tight ${saldoCaixa < 0 ? "text-danger" : "text-ink"}`}>{dinheiro(saldoCaixa)}</p>
        </div>

        <button
          type="button"
          onClick={alternar}
          aria-label={mostrar ? "Esconder valores" : "Mostrar valores"}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-mist transition-colors hover:bg-fg/[0.06]"
        >
          {mostrar ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>
      </div>

      {/* ---------- O que ainda não entrou ---------- */}
      <div className="mt-4 flex gap-3 px-5">
        <div className="min-w-0 flex-1 rounded-2xl border border-warning/20 bg-warning/[0.05] px-3.5 py-3">
          <span className="block text-[11px] text-faint">A receber</span>
          <span className="mt-0.5 block truncate text-[16px] leading-tight text-warning">{dinheiro(aReceber)}</span>
        </div>

      </div>

      {/* ---------- Abas ---------- */}
      <div className="mt-4 flex gap-2 px-5">
        {ABAS.map((a) => {
          const on = aba === a.id;
          const Icone = a.icon;

          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onAba(a.id)}
              aria-pressed={on}
              className={`flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-full border text-[13.5px] transition-colors ${
                on ? "border-accent bg-accent text-white" : "border-fg/[0.1] text-mist active:bg-fg/[0.05]"
              }`}
            >
              <Icone size={15} />
              {a.label}
            </button>
          );
        })}
      </div>

      {/* ---------- Conteúdo ---------- */}
      <div className="mt-4 flex-1 px-5">
        {carregando ? (
          <p className="py-16 text-center text-[13px] text-faint">Carregando…</p>
        ) : aba === "notas" ? (
          notas.length === 0 ? (
            <Vazio icone={<Receipt size={22} />} titulo="Nenhuma nota registrada" texto="As notas emitidas no PDV aparecem aqui para você acompanhar o recebimento." />
          ) : (
            <div className="flex flex-col">
              {notas.map((n) => {
                const restante = n.total - n.pago;
                const parcial = !n.quitada && n.pago > 0;

                return (
                  <div key={n.id} className="flex min-h-[68px] items-center gap-3 border-b border-fg/[0.05] py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14.5px] text-ink">{n.cliente}</p>
                      <p className="truncate text-[12px] text-faint">
                        #{n.pedido} · {n.data}
                        {n.quitada && n.formaPagamento ? ` · ${n.formaPagamento}` : ""}
                        {parcial ? ` · falta ${dinheiro(restante)}` : ""}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-[14.5px] tabular-nums text-ink">{dinheiro(n.total)}</p>
                      <p className={`text-[11px] ${n.quitada ? "text-success" : parcial ? "text-warning" : "text-mist"}`}>{n.quitada ? "Pago" : parcial ? "Parcial" : "Pendente"}</p>
                    </div>

                    {/* Botão dedicado: encostar na linha não pode dar baixa. */}
                    {!n.quitada && (
                      <button
                        type="button"
                        onClick={() => onPagar(n)}
                        aria-label={`Registrar pagamento de ${n.cliente}`}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-success/25 bg-success/[0.1] text-success transition-colors active:bg-success/20"
                      >
                        <CheckCircle2 size={17} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <>
            {/* Entradas e saídas do período */}
            <div className="mb-3 flex gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-fg/[0.07] px-3.5 py-2.5">
                <ArrowUpRight size={15} className="shrink-0 text-success" />
                <span className="min-w-0">
                  <span className="block text-[10.5px] text-faint">Entradas</span>
                  <span className="block truncate text-[13.5px] text-ink">{dinheiro(entradas)}</span>
                </span>
              </div>

              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-fg/[0.07] px-3.5 py-2.5">
                <ArrowDownRight size={15} className="shrink-0 text-danger" />
                <span className="min-w-0">
                  <span className="block text-[10.5px] text-faint">Saídas</span>
                  <span className="block truncate text-[13.5px] text-ink">{dinheiro(saidas)}</span>
                </span>
              </div>
            </div>

            {movimentacoes.length === 0 ? (
              <Vazio icone={<ArrowLeftRight size={22} />} titulo="Nenhuma movimentação" texto="Lance entradas e saídas para acompanhar o caixa da empresa." acao={{ label: "Lançar a primeira", onClick: onNovaMovimentacao }} />
            ) : (
              <div className="flex flex-col">
                {movimentacoes.map((m) => (
                  <div key={m.id} className="flex min-h-[64px] items-center gap-3 border-b border-fg/[0.05] py-3">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${m.entrada ? "bg-success/[0.12] text-success" : "bg-danger/[0.12] text-danger"}`}
                    >
                      {m.entrada ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14.5px] text-ink">{m.descricao}</p>
                      <p className="truncate text-[12px] text-faint">
                        {m.data}
                        {m.categoria ? ` · ${m.categoria}` : ""}
                      </p>
                    </div>

                    {confirmando === m.id ? (
                      <div className="flex shrink-0 items-center gap-2">
                        <button type="button" onClick={() => setConfirmando(null)} className="min-h-[36px] rounded-full border border-fg/[0.12] px-3 text-[12.5px] text-mist">
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmando(null);
                            onExcluir(m.id);
                          }}
                          className="min-h-[36px] rounded-full bg-danger px-3 text-[12.5px] text-white"
                        >
                          Excluir
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className={`shrink-0 text-[14.5px] tabular-nums ${m.entrada ? "text-success" : "text-danger"}`}>
                          {m.entrada ? "+" : "−"} {dinheiro(m.valor)}
                        </span>

                        <button type="button" onClick={() => setConfirmando(m.id)} aria-label={`Excluir ${m.descricao}`} className="shrink-0 p-1.5 text-muted transition-colors active:text-danger">
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ---------- Ação primária: só o caixa aceita lançamento manual ---------- */}
      {aba === "caixa" && (
        <button
          type="button"
          onClick={onNovaMovimentacao}
          className="fixed right-5 z-[90] flex h-14 items-center gap-2 rounded-full bg-accent px-5 text-[15px] text-white shadow-[0_12px_32px_-8px_rgb(var(--accent))] transition-transform active:scale-95"
          style={{ bottom: "calc(72px + env(safe-area-inset-bottom) + 12px)" }}
        >
          <Plus size={20} />
          Lançar
        </button>
      )}
    </div>
  );
};

const Vazio = ({ icone, titulo, texto, acao }: { icone: React.ReactNode; titulo: string; texto: string; acao?: { label: string; onClick: () => void } }) => (
  <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
    <span className="grid h-14 w-14 place-items-center rounded-2xl border border-fg/[0.08] bg-fg/[0.03] text-faint">{icone}</span>
    <p className="text-[14px] text-ink">{titulo}</p>
    <p className="max-w-[260px] text-[12.5px] leading-relaxed text-faint">{texto}</p>
    {acao && (
      <button type="button" onClick={acao.onClick} className="mt-1 min-h-[44px] rounded-2xl bg-accent px-5 text-[14px] text-white transition-all active:scale-[0.99]">
        {acao.label}
      </button>
    )}
  </div>
);

export default FinanceiroMobile;
