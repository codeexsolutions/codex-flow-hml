import { motion } from "framer-motion";
import { Eye, EyeOff, ChevronRight, TrendingUp, AlertTriangle, Package, ShoppingCart, Users } from "lucide-react";

import { formatNumber, getInitials } from "@/shared/utils/format";
import { formatDate } from "@/shared/utils/date";
import { useDinheiroVisivel } from "@/shared/session/valoresVisiveis";

export type VendaRecente = { id: string; cliente?: string; data: string | Date; total: number; paga: boolean };
export type ProdutoCritico = { id: string; nome: string; quantidade: number };

type Props = {
  nomeUsuario?: string;
  faturadoMes: number;
  recebidoMes: number;
  aReceber: number;
  vendasNoMes: number;
  totalClientes: number;
  totalProdutos: number;
  /** 12 meses, para o gráfico de barras. */
  porMes: { name: string; faturado: number }[];
  recentes: VendaRecente[];
  criticos: ProdutoCritico[];
  onVenda: (id: string) => void;
  onIrParaEstoque: () => void;
  onIrParaVendas: () => void;
  onIrParaClientes: () => void;
};

const saudacao = () => {
  const h = new Date().getHours();

  /* A madrugada era o buraco: às 2 da manhã caía em "Bom dia". */
  if (h < 5) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
};

/**
 * Dashboard do celular.
 *
 * Mesma gramática do PDV: um número herói, valores ocultáveis, listas sem
 * tabela e nada de gráfico denso.
 *
 * O gráfico aqui é **de barras, não de área**: no celular a linha de área vira
 * um borrão de 40px de altura onde não se lê mês nenhum. Doze barras com o mês
 * embaixo respondem a única pergunta que importa nesse tamanho — "que mês foi
 * melhor" — sem precisar de eixo, legenda nem tooltip.
 */
const DashboardMobile = ({
  nomeUsuario,
  faturadoMes,
  recebidoMes,
  aReceber,
  vendasNoMes,
  totalClientes,
  totalProdutos,
  porMes,
  recentes,
  criticos,
  onVenda,
  onIrParaEstoque,
  onIrParaVendas,
  onIrParaClientes,
}: Props) => {
  const { mostrar, alternar, dinheiro } = useDinheiroVisivel();


  const maior = Math.max(...porMes.map((m) => m.faturado), 1);

  /* Altura em PIXEL, não em porcentagem: o framer-motion não resolve `%` de
     forma confiável ao animar `height`, e as barras ficavam invisíveis. */
  const ALTURA_GRAFICO = 96;
  const mesAtual = new Date().getMonth();

  return (
    <div className="flex min-h-full flex-col pb-4">
      {/* ---------- Saudação ---------- */}
      <div className="safe-top flex items-center justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <p className="text-[19px] leading-tight text-ink">
            {saudacao()}
            {nomeUsuario ? `, ${nomeUsuario.split(" ")[0]}` : ""}
          </p>
          <p className="mt-0.5 text-[12.5px] text-faint">Resumo do seu negócio</p>
        </div>

        <button
          type="button"
          onClick={alternar}
          aria-label={mostrar ? "Esconder valores" : "Mostrar valores"}
          className="focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-mist transition-colors hover:bg-fg/[0.06]"
        >
          {mostrar ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>
      </div>

      {/* ---------- Número do mês ---------- */}
      <div className="px-5 pt-6">
        <p className="text-[12.5px] text-mist">Faturado no mês</p>
        <motion.p
          className="mt-1 text-[38px] leading-none tracking-tight text-ink"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          {dinheiro(faturadoMes)}
        </motion.p>
        <p className="mt-1.5 text-[12.5px] text-faint">
          {vendasNoMes} {vendasNoMes === 1 ? "venda" : "vendas"} neste mês
        </p>

        <div className="mt-4 flex items-stretch gap-3">
          <div className="min-w-0 flex-1 rounded-2xl border border-fg/[0.07] px-3.5 py-3">
            <p className="text-[11px] text-faint">Recebido</p>
            <p className="mt-0.5 truncate text-[15px] text-success">{dinheiro(recebidoMes)}</p>
          </div>
          <div className="min-w-0 flex-1 rounded-2xl border border-fg/[0.07] px-3.5 py-3">
            <p className="text-[11px] text-faint">A receber</p>
            <p className="mt-0.5 truncate text-[15px] text-warning">{dinheiro(aReceber)}</p>
          </div>
        </div>
      </div>

      {/* ---------- Ano em barras ---------- */}
      <div className="mt-6 px-5">
        <p className="mb-3 flex items-center gap-1.5 text-[12.5px] text-mist">
          <TrendingUp size={14} className="text-accent-soft" /> Faturamento do ano
        </p>

        {/* Barras e rótulos em linhas separadas: a altura em % precisa de um pai
            com altura DEFINIDA. Com o rótulo dentro da mesma coluna, o pai ficava
            com altura automática e todas as barras resolviam para zero. */}
        <div className="flex items-end gap-1.5" style={{ height: ALTURA_GRAFICO }}>
          {porMes.map((m, i) => {
            const altura = m.faturado > 0 ? Math.max((m.faturado / maior) * ALTURA_GRAFICO, 4) : 2;
            const atual = i === mesAtual;

            return (
              <div key={m.name} className="flex min-w-0 flex-1 items-end" style={{ height: ALTURA_GRAFICO }}>
                {/* Altura por `style`, com transição em CSS — animar `height`
                   pelo framer-motion aqui deixava as barras presas perto de
                   zero. O CSS resolve o mesmo efeito sem a disputa. */}
                <div
                  className={`w-full rounded-t transition-[height] duration-500 ease-out ${atual ? "bg-accent" : m.faturado > 0 ? "bg-accent/30" : "bg-fg/[0.08]"}`}
                  style={{ height: altura, transitionDelay: `${i * 30}ms` }}
                />
              </div>
            );
          })}
        </div>

        <div className="mt-1.5 flex gap-1.5">
          {porMes.map((m, i) => (
            <span key={m.name} className={`min-w-0 flex-1 text-center text-[9px] ${i === mesAtual ? "text-accent-soft" : "text-muted"}`}>
              {m.name}
            </span>
          ))}
        </div>
      </div>

      {/* ---------- Atalhos ---------- */}
      <div className="mt-6 grid grid-cols-2 gap-3 px-5">
        <button
          type="button"
          onClick={onIrParaClientes}
          className="focus-ring flex min-h-[68px] flex-col items-start justify-center gap-1 rounded-2xl border border-fg/[0.07] px-4 text-left active:bg-fg/[0.04]"
        >
          <span className="flex items-center gap-1.5 text-[11px] text-faint">
            <Users size={13} /> Clientes
          </span>
          <span className="text-[19px] leading-none text-ink">{formatNumber(totalClientes)}</span>
        </button>

        <button
          type="button"
          onClick={onIrParaEstoque}
          className="focus-ring flex min-h-[68px] flex-col items-start justify-center gap-1 rounded-2xl border border-fg/[0.07] px-4 text-left active:bg-fg/[0.04]"
        >
          <span className="flex items-center gap-1.5 text-[11px] text-faint">
            <Package size={13} /> Produtos
          </span>
          <span className="text-[19px] leading-none text-ink">{formatNumber(totalProdutos)}</span>
        </button>
      </div>

      {/* ---------- Estoque crítico ---------- */}
      {criticos.length > 0 && (
        <div className="mt-6 px-5">
          <p className="mb-2 flex items-center gap-1.5 text-[12.5px] text-warning">
            <AlertTriangle size={14} /> Estoque baixo
          </p>

          <div className="flex flex-col">
            {criticos.slice(0, 4).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={onIrParaEstoque}
                className="focus-ring flex min-h-[52px] items-center gap-3 border-b border-fg/[0.05] py-2.5 text-left active:bg-fg/[0.04]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
                  <Package size={15} />
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{p.nome}</span>
                <span className={`shrink-0 text-[13px] tabular-nums ${p.quantidade <= 0 ? "text-danger" : "text-warning"}`}>
                  {p.quantidade <= 0 ? "Esgotado" : `${p.quantidade} un.`}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ---------- Últimas vendas ---------- */}
      <div className="mt-6 px-5">
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-[12.5px] text-mist">
            <ShoppingCart size={14} className="text-accent-soft" /> Últimas vendas
          </p>
          <button type="button" onClick={onIrParaVendas} className="focus-ring text-[12.5px] text-accent">
            Ver todas
          </button>
        </div>

        {recentes.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-faint">Nenhuma venda ainda.</p>
        ) : (
          <div className="flex flex-col">
            {recentes.slice(0, 5).map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => onVenda(v.id)}
                className="focus-ring flex min-h-[64px] items-center gap-3 border-b border-fg/[0.05] py-3 text-left active:bg-fg/[0.04]"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-accent/25 bg-accent/[0.12] text-[13px] text-accent-soft">
                  {getInitials(v.cliente)}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] text-ink">{v.cliente || "Cliente"}</span>
                  <span className="block text-[12px] text-faint">{formatDate(v.data)}</span>
                </span>

                <span className="shrink-0 text-right">
                  <span className="block text-[14.5px] tabular-nums text-ink">{dinheiro(v.total)}</span>
                  <span className={`block text-[11.5px] ${v.paga ? "text-success" : "text-warning"}`}>{v.paga ? "Paga" : "Em aberto"}</span>
                </span>

                <ChevronRight size={16} className="shrink-0 text-muted" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardMobile;
