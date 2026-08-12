import { useEffect, useMemo, useState } from "react";
import { ShoppingCart, TrendingUp, DollarSign, CheckCircle, AlertCircle, Star } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Modal } from "@/shared/ui/Modal";
import Invoice from "@/features/vendas/components/Invoice";
import { formatCurrency } from "@/shared/utils/currency";
import { estaAberto, estaCancelado, estaFechado, totalDoPedido, valorPagoDoPedido, valorPendenteDoPedido } from "@/shared/domain/pedido";
import { MONTHS, isSameMonth, toDate } from "@/shared/utils/date";
import { useChartColors } from "@/shared/theme/useChartColors";
import useVendaStore from "@/features/vendas/store/venda.store";

/** Nomes curtos usados pelos gráficos desta tela, ligados aos tokens do tema. */
const useC = () => {
  const c = useChartColors();
  return { ...c, green: c.success, amber: c.warning, red: c.danger };
};

type TopCliente = {
  clienteId: string;
  nome: string;
  total: number;
  pedidos: number;
};

type NotaAberta = { id?: string; clienteId: string; nome?: string };

/* ======================= UI ======================= */
type ChartTipEntry = {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string;
  color?: string;
  payload?: { fill?: string };
};

type ChartTipProps = {
  active?: boolean;
  payload?: ChartTipEntry[];
  label?: string | number;
};

const ChartTip = ({ active, payload, label }: ChartTipProps) => {
  const C = useC();
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-strong elev-2 rounded-xl px-3 py-2 text-xs">
      {label && <p className="mb-1 text-mist">{label}</p>}
      {payload.map((p) => (
        <p key={p.dataKey ?? p.name} className="mt-0.5" style={{ color: p.color ?? p.payload?.fill ?? C.accent }}>
          {p.name ?? p.dataKey}: <strong>{typeof p.value === "number" ? formatCurrency(p.value) : p.value}</strong>
        </p>
      ))}
    </div>
  );
};

function Kpi({ icon, chip, label, value, hint }: { icon: React.ReactNode; chip: string; label: string; value: string; hint?: string }) {
  return (
    <div className="card-interactive glass-sheen flex items-center gap-3 px-4 py-3.5">
      <div className={`rounded-xl p-2.5 ${chip}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
        <p className="nums truncate text-[15px] text-ink">{value}</p>
        {hint && <p className="text-[10px] text-faint">{hint}</p>}
      </div>
    </div>
  );
}

function CardHeader({ icon, chip, title, sub }: { icon: React.ReactNode; chip: string; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-fg/[0.07] px-4 py-3">
      <div className={`rounded-xl p-2 ${chip}`}>{icon}</div>
      <div>
        <h2 className="text-[13px] text-ink">{title}</h2>
        {sub && <p className="text-[11px] text-faint">{sub}</p>}
      </div>
    </div>
  );
}

/* ======================= Overview Page ======================= */
const SalesOverviewPage = () => {
  const vendas = useVendaStore((s) => s.vendas);
  const fetchVendas = useVendaStore((s) => s.fetchVendas);

  const [notaAberta, setNotaAberta] = useState<NotaAberta | null>(null);

  useEffect(() => {
    fetchVendas();
  }, [fetchVendas]);

  const abrirNota = (nota: NotaAberta) => setNotaAberta(nota);
  const fecharNota = () => {
    setNotaAberta(null);
    fetchVendas(true);
  };

  const dados = useMemo(() => {
    const agora = new Date();
    const anoAtual = agora.getFullYear();
    const naoCanceladas = vendas.filter((v) => !estaCancelado(v));
    const doMes = naoCanceladas.filter((v) => isSameMonth(v.pedido.dataPedido, agora));

    const faturadoMes = doMes.reduce((acc, v) => acc + totalDoPedido(v), 0);
    const recebidoMes = doMes.reduce((acc, v) => acc + valorPagoDoPedido(v), 0);
    const aReceberTotal = naoCanceladas.reduce((acc, v) => acc + valorPendenteDoPedido(v), 0);
    const percentualRecebido = faturadoMes ? (recebidoMes / faturadoMes) * 100 : 0;

    const porMes = MONTHS.map((name, i) => {
      const doMesI = naoCanceladas.filter((v) => {
        const d = toDate(v.pedido.dataPedido);
        return !!d && d.getFullYear() === anoAtual && d.getMonth() === i;
      });
      return {
        name,
        faturado: doMesI.reduce((acc, v) => acc + totalDoPedido(v), 0),
        recebido: doMesI.reduce((acc, v) => acc + valorPagoDoPedido(v), 0),
      };
    });

    const pagas = naoCanceladas.filter(estaFechado).length;
    const pendentes = naoCanceladas.filter(estaAberto).length;
    const canceladas = vendas.filter(estaCancelado).length;

    // Top clientes
    const porCliente = new Map<string, TopCliente>();
    naoCanceladas.forEach((v) => {
      const atual = porCliente.get(v.clienteId) ?? {
        clienteId: v.clienteId,
        nome: v.nomeCliente,
        total: 0,
        pedidos: 0,
      };
      atual.total += totalDoPedido(v);
      atual.pedidos += 1;
      porCliente.set(v.clienteId, atual);
    });
    const topClientes = Array.from(porCliente.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return {
      faturadoMes,
      recebidoMes,
      aReceberTotal,
      totalVendas: naoCanceladas.length,
      vendasNoMes: doMes.length,
      percentualRecebido,
      porMes,
      pagas,
      pendentes,
      canceladas,
      topClientes,
    };
  }, [vendas]);

  const abrirPorCliente = (c: TopCliente) => {
    const doCliente = vendas.filter((v) => v.clienteId === c.clienteId).sort((a, b) => +new Date(b.pedido.dataPedido) - +new Date(a.pedido.dataPedido));
    const alvo = doCliente[0];
    if (!alvo) return;
    abrirNota({ id: alvo.pedido.pedidoId, clienteId: alvo.clienteId, nome: alvo.nomeCliente });
  };

  return (
    <div className="flex h-full w-full flex-col">
      <TabOverview {...dados} onAbrirCliente={abrirPorCliente} />

      <Modal open={!!notaAberta} onClose={fecharNota} title="Venda" subtitle={notaAberta?.nome} size="full">
        {notaAberta && <Invoice id={notaAberta.id} clienteId={notaAberta.clienteId} nome={notaAberta.nome} />}
      </Modal>
    </div>
  );
};

/* ======================= Tab Content ======================= */
type TabOverviewProps = {
  faturadoMes: number;
  recebidoMes: number;
  aReceberTotal: number;
  totalVendas: number;
  vendasNoMes: number;
  percentualRecebido: number;
  porMes: { name: string; faturado: number; recebido: number }[];
  pagas: number;
  pendentes: number;
  canceladas: number;
  topClientes: TopCliente[];
  onAbrirCliente: (c: TopCliente) => void;
};

function TabOverview({ faturadoMes, recebidoMes, aReceberTotal, totalVendas, vendasNoMes, percentualRecebido, porMes, pagas, pendentes, canceladas, topClientes, onAbrirCliente }: TabOverviewProps) {
  const C = useC();

  const axisProps = {
    tick: { fontSize: 11, fill: C.tick },
    axisLine: false as const,
    tickLine: false as const,
  };

  const maiorTotal = topClientes[0]?.total ?? 0;
  const statusData = [
    { name: "Pago", value: pagas, color: C.green },
    { name: "Pendente", value: pendentes, color: C.red },
    { name: "Cancelado", value: canceladas, color: C.amber },
  ].filter((s) => s.value > 0);

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-3">
      {/* KPIs */}
      <div className="stagger grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi icon={<DollarSign className="h-4 w-4 text-accent-soft" />} chip="bg-accent/[0.15]" label="Faturado este mês" value={formatCurrency(faturadoMes)} hint={`${vendasNoMes} ${vendasNoMes === 1 ? "venda" : "vendas"}`} />
        <Kpi icon={<CheckCircle className="h-4 w-4 text-success" />} chip="bg-success/30" label="Recebido este mês" value={formatCurrency(recebidoMes)} hint={`${percentualRecebido.toFixed(0)}% do faturado`} />
        <Kpi icon={<AlertCircle className="h-4 w-4 text-danger" />} chip="bg-danger/20" label="A receber (total)" value={formatCurrency(aReceberTotal)} hint={`${pendentes} ${pendentes === 1 ? "nota aberta" : "notas abertas"}`} />
        <Kpi icon={<ShoppingCart className="h-4 w-4 text-warning" />} chip="bg-warning/25" label="Total de vendas" value={String(totalVendas)} hint={`${vendasNoMes} neste mês`} />
      </div>

      <div className="grid min-h-0 grid-cols-1 gap-3 lg:grid-cols-[2fr_1fr]">
        {/* Gráfico Anual */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-fg/[0.08] bg-surface">
          <CardHeader icon={<TrendingUp className="h-4 w-4 text-accent-soft" />} chip="bg-accent/[0.15]" title="Faturamento anual" sub="Faturado vs recebido por mês" />
          <div className="min-h-[220px] flex-1 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={porMes}>
                <defs>
                  <linearGradient id="gFat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.accent} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={C.accent} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.green} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={C.green} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                <XAxis dataKey="name" {...axisProps} />
                <YAxis {...axisProps} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="faturado" name="Faturado" stroke={C.accent} strokeWidth={2} fill="url(#gFat)" />
                <Area type="monotone" dataKey="recebido" name="Recebido" stroke={C.green} strokeWidth={2} fill="url(#gRec)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 border-t border-fg/[0.07] bg-fg/[0.02] px-4 py-2.5">
            {[
              { color: C.accent, label: "Faturado" },
              { color: C.green, label: "Recebido" },
            ].map(({ color, label }) => (
              <span key={label} className="flex items-center gap-1.5 text-[11px] text-mist">
                <span className="inline-block h-[3px] w-3 rounded-sm" style={{ background: color }} />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Status + Top Clientes */}
        <div className="grid min-h-0 grid-rows-2 gap-3">
          {/* Status */}
          <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-fg/[0.08] bg-surface">
            <CardHeader icon={<CheckCircle className="h-4 w-4 text-success" />} chip="bg-success/30" title="Status das vendas" sub={`${pagas + pendentes + canceladas} no total`} />
            <div className="flex min-h-0 flex-1 items-center gap-2 p-4">
              <div className="h-full min-h-[110px] flex-1">
                {statusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusData} cx="50%" cy="50%" innerRadius="55%" outerRadius="85%" paddingAngle={3} dataKey="value">
                        {statusData.map((s, i) => (
                          <Cell key={i} fill={s.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTip />} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-[11px] text-muted">Sem dados</div>
                )}
              </div>
              <div className="flex w-28 flex-col gap-2">
                {[
                  { color: C.green, label: "Pago", value: pagas },
                  { color: C.red, label: "Pendente", value: pendentes },
                  { color: C.amber, label: "Cancelado", value: canceladas },
                ].map(({ color, label, value }) => (
                  <div key={label} className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-2 text-mist">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
                      {label}
                    </span>
                    <span className="text-ink">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Clientes */}
          <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-fg/[0.08] bg-surface">
            <CardHeader icon={<Star className="h-4 w-4 text-warning" />} chip="bg-warning/25" title="Top clientes" sub={topClientes.length > 0 ? `${topClientes.length} melhores` : undefined} />
            <div className="flex-1 overflow-auto p-3">
              {topClientes.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {topClientes.map((c: TopCliente, i: number) => {
                    const pct = maiorTotal > 0 ? (c.total / maiorTotal) * 100 : 0;
                    return (
                      <button key={c.clienteId} onClick={() => onAbrirCliente(c)} className="flex w-full items-center gap-2.5 rounded-lg border border-fg/[0.06] bg-fg/[0.02] p-2 text-left transition-colors hover:bg-fg/[0.06]">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/[0.2] text-[10px] text-accent-soft">{i + 1}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-[11px] text-ink">{c.nome}</p>
                            <p className="shrink-0 text-[11px] text-success">{formatCurrency(c.total)}</p>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <div className="h-1 flex-1 overflow-hidden rounded-full bg-fg/[0.05]">
                              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(pct, 3)}%` }} />
                            </div>
                            <span className="shrink-0 text-[10px] text-muted">
                              {c.pedidos} {c.pedidos === 1 ? "venda" : "vendas"}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-muted">Sem dados para exibir</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SalesOverviewPage;
