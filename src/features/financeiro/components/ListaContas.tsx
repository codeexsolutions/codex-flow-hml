import { useMemo, useState } from "react";
import { CalendarDays, ChevronDown, Loader2, Plus, Trash2, Wallet } from "lucide-react";

import { Modal } from "@/shared/ui/Modal";
import BotaoRecibo from "@/shared/ui/BotaoRecibo";
import { Selo, type TomSelo } from "@/shared/ui/StatusBadge";
import { useAlert } from "@/shared/ui/Alert";
import { extractErrorMessage, getErrorTitle } from "@/shared/utils/errorHandler";
import { formatCurrency } from "@/shared/utils/currency";
import ContaService, { type Conta, type Parcela, type Recibo, type SituacaoParcela, type TipoConta } from "@/features/financeiro/services/conta.service";

/**
 * A lista de compromissos — a pagar ou a receber.
 *
 * A unidade da tela é a PARCELA, não a conta. Quem abre o financeiro de manhã
 * pergunta "o que vence hoje", e essa pergunta não tem resposta numa lista de
 * contas: "Aluguel — 12x" não diz se algo vence hoje. Então as parcelas em
 * aberto sobem para o topo, ordenadas por vencimento, e a conta a que
 * pertencem vira o subtítulo de cada linha.
 *
 * A conta inteira continua alcançável: clicar na linha abre todas as parcelas
 * dela, que é onde se renegocia uma data ou se confere o que já foi pago.
 */

const SITUACAO: Record<SituacaoParcela, { label: string; tom: TomSelo }> = {
  ABERTA: { label: "Em aberto", tom: "neutro" },
  PARCIAL: { label: "Parcial", tom: "info" },
  PAGA: { label: "Paga", tom: "sucesso" },
  VENCIDA: { label: "Vencida", tom: "perigo" },
};

const dataBr = (iso: string) => String(iso).slice(0, 10).split("-").reverse().join("/");

/** "vence hoje", "há 3 dias", "em 12 dias" — o que a pessoa realmente calcula. */
const prazo = (iso: string): { texto: string; atrasada: boolean } => {
  const hoje = new Date();
  const [a, m, d] = String(iso).slice(0, 10).split("-").map(Number);

  const alvo = new Date(a, (m ?? 1) - 1, d ?? 1);
  const zero = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const dias = Math.round((alvo.getTime() - zero.getTime()) / 86_400_000);

  if (dias === 0) return { texto: "vence hoje", atrasada: false };
  if (dias === 1) return { texto: "vence amanhã", atrasada: false };
  if (dias === -1) return { texto: "venceu ontem", atrasada: true };
  if (dias < 0) return { texto: `${Math.abs(dias)} dias em atraso`, atrasada: true };

  return { texto: `em ${dias} dias`, atrasada: false };
};

type Props = {
  tipo: TipoConta;
  contas: Conta[];
  carregando?: boolean;
  onRecarregar: () => void;
  onNova: () => void;
};

const ListaContas = ({ tipo, contas, carregando = false, onRecarregar, onNova }: Props) => {
  const alert = useAlert();

  const [pagando, setPagando] = useState<{ conta: Conta; parcela: Parcela } | null>(null);
  const [valorPago, setValorPago] = useState("");
  const [forma, setForma] = useState("PIX");
  const [salvando, setSalvando] = useState(false);
  const [recibo, setRecibo] = useState<Recibo | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);

  const aPagar = tipo === "PAGAR";

  /* Parcelas em aberto de todas as contas, a que vence primeiro na frente. */
  const pendentes = useMemo(() => {
    const linhas: { conta: Conta; parcela: Parcela }[] = [];

    for (const conta of contas) {
      for (const parcela of conta.parcelas) {
        if (parcela.situacao !== "PAGA") linhas.push({ conta, parcela });
      }
    }

    return linhas.sort((x, y) => String(x.parcela.vencimento).localeCompare(String(y.parcela.vencimento)));
  }, [contas]);

  const abrirPagamento = (conta: Conta, parcela: Parcela) => {
    setPagando({ conta, parcela });
    setValorPago(String((parcela.valor - parcela.valorPago).toFixed(2)).replace(".", ","));
    setForma("PIX");
  };

  const confirmarPagamento = async () => {
    if (!pagando) return;

    const valor = Number(String(valorPago).replace(/\./g, "").replace(",", ".")) || 0;

    if (!(valor > 0)) {
      alert.warning("Valor inválido", "Informe quanto foi pago.");
      return;
    }

    setSalvando(true);

    try {
      const gerado = await ContaService.pagar(pagando.parcela.id, { valor, formaPagamento: forma });

      setPagando(null);
      /* O recibo abre sozinho: quem acabou de receber é quem precisa dele na
         mão, e procurar o botão depois é o passo que ninguém dá. */
      setRecibo(gerado);
      onRecarregar();
    } catch (err) {
      alert.error(getErrorTitle(err), extractErrorMessage(err, "Não foi possível registrar o pagamento."));
    } finally {
      setSalvando(false);
    }
  };

  const cancelar = async (conta: Conta) => {
    const ok = await alert.confirm(
      `Cancelar "${conta.descricao}"?`,
      "A conta sai das pendências. Os pagamentos já registrados continuam no histórico.",
      { confirmText: "Cancelar conta" },
    );

    if (!ok) return;

    try {
      await ContaService.cancelar(conta.id);
      onRecarregar();
    } catch (err) {
      alert.error(getErrorTitle(err), extractErrorMessage(err, "Não foi possível cancelar."));
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] text-faint">
          {pendentes.length} {pendentes.length === 1 ? "parcela em aberto" : "parcelas em aberto"}
        </p>

        <button
          type="button"
          onClick={onNova}
          className="focus-ring inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-gradient-to-br from-accent-soft to-accent px-3 py-2 text-[12.5px] text-white shadow-glow transition-all hover:brightness-110 active:scale-[0.98]"
        >
          <Plus size={14} />
          {aPagar ? "Nova conta a pagar" : "Nova conta a receber"}
        </button>
      </div>

      <div className="card glass-sheen min-h-0 flex-1 overflow-y-auto">
        {carregando ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-mist">
            <Loader2 size={15} className="animate-spin text-accent" /> Carregando…
          </div>
        ) : pendentes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2.5 px-6 py-16 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-xl border border-fg/[0.07] bg-fg/[0.03] text-faint">
              <Wallet size={20} />
            </span>
            <p className="text-[13px] text-mist">{aPagar ? "Nada a pagar" : "Nada a receber"}</p>
            <p className="max-w-[280px] text-[11.5px] leading-relaxed text-faint">
              {aPagar
                ? "Lance aluguel, fornecedor ou guia de imposto para acompanhar os vencimentos aqui."
                : "Parcele uma venda em aberto no PDV ou crie um acordo de recebimento."}
            </p>
          </div>
        ) : (
          pendentes.map(({ conta, parcela }) => {
            const situacao = SITUACAO[parcela.situacao] ?? SITUACAO.ABERTA;
            const p = prazo(parcela.vencimento);
            const saldo = parcela.valor - parcela.valorPago;

            return (
              <div key={parcela.id} className="border-b border-fg/[0.04] last:border-0">
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* O dia grande à esquerda: a lista é lida por data. */}
                  <div className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl border ${p.atrasada ? "border-danger/30 bg-danger/[0.08] text-danger" : "border-fg/[0.08] bg-fg/[0.03] text-mist"}`}>
                    <span className="text-[14px] leading-none tabular-nums">{dataBr(parcela.vencimento).slice(0, 2)}</span>
                    <span className="text-[9px] uppercase tracking-wide">{dataBr(parcela.vencimento).slice(3, 5)}</span>
                  </div>

                  <button type="button" onClick={() => setAberta(aberta === conta.id ? null : conta.id)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-[13px] text-ink">
                      {conta.descricao}
                      {conta.parcelas.length > 1 && <span className="ml-1.5 text-[11px] text-faint">{parcela.numero}/{conta.parcelas.length}</span>}
                    </p>
                    <p className="truncate text-[11px] text-faint">
                      <span className={p.atrasada ? "text-danger" : ""}>{p.texto}</span>
                      {conta.clienteNome && ` · ${conta.clienteNome}`}
                      {conta.fornecedor && ` · ${conta.fornecedor}`}
                      {parcela.valorPago > 0 && ` · pago ${formatCurrency(parcela.valorPago)}`}
                    </p>
                  </button>

                  <span className="hidden lg:block">
                    <Selo tom={situacao.tom}>{situacao.label}</Selo>
                  </span>

                  <p className="shrink-0 text-right text-[13px] tabular-nums text-ink">{formatCurrency(saldo)}</p>

                  <button
                    type="button"
                    onClick={() => abrirPagamento(conta, parcela)}
                    className={`focus-ring shrink-0 cursor-pointer rounded-lg px-3 py-1.5 text-[12px] transition-colors ${
                      aPagar ? "bg-danger/[0.12] text-danger hover:bg-danger/20" : "bg-success/[0.12] text-success hover:bg-success/20"
                    }`}
                  >
                    {aPagar ? "Pagar" : "Receber"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setAberta(aberta === conta.id ? null : conta.id)}
                    aria-label="Ver todas as parcelas"
                    className="focus-ring shrink-0 cursor-pointer rounded-lg p-1.5 text-muted transition-colors hover:text-ink"
                  >
                    <ChevronDown size={15} className={`transition-transform ${aberta === conta.id ? "rotate-180" : ""}`} />
                  </button>
                </div>

                {/* A conta inteira, quando se quer conferir o acordo. */}
                {aberta === conta.id && (
                  <div className="border-t border-fg/[0.05] bg-fg/[0.015] px-4 py-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-[11px] uppercase tracking-[0.1em] text-faint">
                        Todas as parcelas · total {formatCurrency(conta.valorTotal)}
                      </p>

                      <button type="button" onClick={() => void cancelar(conta)} className="flex items-center gap-1.5 text-[11.5px] text-muted transition-colors hover:text-danger">
                        <Trash2 size={12} /> Cancelar conta
                      </button>
                    </div>

                    <div className="flex flex-col gap-1">
                      {conta.parcelas.map((x) => {
                        const s = SITUACAO[x.situacao] ?? SITUACAO.ABERTA;

                        return (
                          <div key={x.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-[12px] hover:bg-fg/[0.03]">
                            <span className="w-8 shrink-0 tabular-nums text-faint">{x.numero}/{conta.parcelas.length}</span>
                            <span className="flex shrink-0 items-center gap-1.5 tabular-nums text-mist">
                              <CalendarDays size={11} className="text-muted" />
                              {dataBr(x.vencimento)}
                            </span>
                            <span className="flex-1" />
                            <span className="tabular-nums text-ink">{formatCurrency(x.valor)}</span>
                            <Selo tom={s.tom}>{s.label}</Selo>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ---------- Registrar pagamento ---------- */}
      <Modal
        open={!!pagando}
        onClose={() => !salvando && setPagando(null)}
        title={aPagar ? "Registrar pagamento" : "Registrar recebimento"}
        subtitle={pagando ? `${pagando.conta.descricao} · parcela ${pagando.parcela.numero}` : ""}
        size="sm"
      >
        {pagando && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-fg/[0.07] bg-fg/[0.02] px-4 py-3">
              <p className="text-[11px] text-faint">Saldo desta parcela</p>
              <p className="text-[22px] tabular-nums text-ink">{formatCurrency(pagando.parcela.valor - pagando.parcela.valorPago)}</p>
              <p className="mt-0.5 text-[11px] text-faint">Vence em {dataBr(pagando.parcela.vencimento)}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-[0.08em] text-faint">Valor</label>
                <input
                  autoFocus
                  value={valorPago}
                  onChange={(e) => setValorPago(e.target.value)}
                  inputMode="decimal"
                  className="w-full rounded-lg border border-fg/[0.09] bg-fg/[0.03] px-3 py-2 text-[13px] tabular-nums text-ink outline-none focus:border-accent/60"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-[0.08em] text-faint">Forma</label>
                <select value={forma} onChange={(e) => setForma(e.target.value)} className="w-full rounded-lg border border-fg/[0.09] bg-fg/[0.03] px-3 py-2 text-[13px] text-ink outline-none focus:border-accent/60">
                  {["PIX", "DINHEIRO", "DÉBITO", "CRÉDITO", "BOLETO", "TRANSFERÊNCIA"].map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Pagar menos que o saldo é normal (entrada, acerto parcial) — a
                parcela fica "Parcial" e o resto continua devendo. */}
            <p className="text-[11px] leading-relaxed text-faint">
              Pode pagar menos que o saldo: a parcela fica como parcial e o restante continua em aberto.
            </p>

            <div className="flex justify-end gap-2 border-t border-fg/[0.07] pt-3.5">
              <button type="button" onClick={() => setPagando(null)} disabled={salvando} className="focus-ring min-h-[38px] cursor-pointer rounded-lg px-3 text-[12.5px] text-mist hover:bg-fg/[0.05] hover:text-ink disabled:opacity-50">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmarPagamento()}
                disabled={salvando}
                className="focus-ring inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-lg bg-gradient-to-br from-accent-soft to-accent px-4 text-[12.5px] text-white shadow-glow transition-all hover:brightness-110 disabled:opacity-50"
              >
                {salvando ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} />}
                Confirmar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ---------- Recibo do pagamento ---------- */}
      <Modal open={!!recibo} onClose={() => setRecibo(null)} title="Pagamento registrado" subtitle={recibo ? `Recibo nº ${recibo.reciboNumero}` : ""} size="sm">
        {recibo && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-success/25 bg-success/[0.07] px-4 py-3">
              <p className="text-[11px] text-success">{recibo.tipo === "PAGAR" ? "Pago" : "Recebido"}</p>
              <p className="text-[22px] tabular-nums text-ink">{formatCurrency(recibo.valor)}</p>
              <p className="mt-0.5 text-[11px] text-faint">
                {recibo.contaDescricao} · parcela {recibo.parcelaNumero}
                {recibo.formaPagamento && ` · ${recibo.formaPagamento}`}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-fg/[0.07] pt-3.5">
              <BotaoRecibo
                dados={{
                  numero: String(recibo.reciboNumero),
                  clienteNome: recibo.contaDescricao,
                  valor: recibo.valor,
                  formaPagamento: recibo.formaPagamento,
                  pagoEm: recibo.pagoEm,
                }}
              />

              <button type="button" onClick={() => setRecibo(null)} className="focus-ring min-h-[38px] cursor-pointer rounded-lg bg-fg/[0.06] px-4 text-[12.5px] text-ink transition-colors hover:bg-fg/[0.1]">
                Fechar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ListaContas;
