import { Search, Plus, ChevronRight, Eye, EyeOff, FileText } from "lucide-react";

import { formatTime, formatDate } from "@/shared/utils/date";
import { getInitials } from "@/shared/utils/format";
import { useDinheiroVisivel } from "@/shared/session/valoresVisiveis";

export type VendaResumo = {
  pedidoId: string;
  clienteId: string;
  nomeCliente?: string;
  data: string | Date;
  total: number;
  pago: number;
  status: "ABERTA" | "PARCIAL" | "PAGA";
};

type Props = {
  nomeUsuario?: string;
  vendas: VendaResumo[];
  faturamento: number;
  recebido: number;
  pendente: number;
  somenteHoje: boolean;
  onPeriodo: (hoje: boolean) => void;
  busca: string;
  onBusca: (v: string) => void;
  onAbrirNota: (v: VendaResumo) => void;
  onNovaVenda: () => void;
  onNovoOrcamento: () => void;
};

const saudacao = () => {
  const h = new Date().getHours();

  /* A madrugada era o buraco: às 2 da manhã caía em "Bom dia". */
  if (h < 5) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
};

const STATUS_TEXTO: Record<VendaResumo["status"], { label: string; cls: string }> = {
  PAGA: { label: "Pago", cls: "text-success" },
  PARCIAL: { label: "Parcial", cls: "text-accent-soft" },
  ABERTA: { label: "Em aberto", cls: "text-warning" },
};

/**
 * PDV do celular — tela própria, não o desktop encolhido.
 *
 * Três decisões que vêm do jeito de usar, não de estética:
 *
 * - **O número do dia é o herói.** Quem abre o PDV quer saber quanto vendeu.
 *   Ele vem grande, no topo, com um olho para esconder — balcão é lugar
 *   público e nem todo cliente precisa ver o faturamento da loja.
 * - **Uma ação primária só**, flutuando ao alcance do polegar. Vender é o que
 *   se faz aqui; o resto é consulta.
 * - **Sem tabela.** Cada venda é uma linha alta e tocável, com o valor à
 *   direita — o olho desce pela coluna de dinheiro sem precisar de cabeçalho.
 */
const PDVMobile = ({
  nomeUsuario,
  vendas,
  faturamento,
  recebido,
  pendente,
  somenteHoje,
  onPeriodo,
  busca,
  onBusca,
  onAbrirNota,
  onNovaVenda,
  onNovoOrcamento,
}: Props) => {
  const { mostrar: mostrarValores, alternar, dinheiro } = useDinheiroVisivel();


  return (
    <div className="flex min-h-full flex-col">
      {/* ---------- Saudação ---------- */}
      <div className="safe-top flex items-center justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <p className="text-[19px] leading-tight text-ink">
            {saudacao()}
            {nomeUsuario ? `, ${nomeUsuario.split(" ")[0]}` : ""}
          </p>
          <p className="mt-0.5 text-[12.5px] capitalize text-faint">
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
          </p>
        </div>

        <button
          type="button"
          onClick={alternar}
          aria-label={mostrarValores ? "Esconder valores" : "Mostrar valores"}
          className="focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-mist transition-colors hover:bg-fg/[0.06]"
        >
          {mostrarValores ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>
      </div>

      {/* ---------- O número do dia ---------- */}
      <div className="px-5 pt-6">
        <p className="text-[12.5px] text-mist">{somenteHoje ? "Vendido hoje" : "Vendido no período"}</p>
        <p className="mt-1 text-[38px] leading-none tracking-tight text-ink">{dinheiro(faturamento)}</p>

        <div className="mt-4 flex items-stretch gap-3">
          <div className="min-w-0 flex-1 rounded-2xl border border-fg/[0.07] px-3.5 py-3">
            <p className="text-[11px] text-faint">Recebido</p>
            <p className="mt-0.5 truncate text-[15px] text-success">{dinheiro(recebido)}</p>
          </div>
          <div className="min-w-0 flex-1 rounded-2xl border border-fg/[0.07] px-3.5 py-3">
            <p className="text-[11px] text-faint">A receber</p>
            <p className="mt-0.5 truncate text-[15px] text-warning">{dinheiro(pendente)}</p>
          </div>
        </div>
      </div>

      {/* ---------- Atalhos ---------- */}
      <div className="mt-5 flex gap-2 px-5">
        <button
          type="button"
          onClick={onNovoOrcamento}
          className="focus-ring flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-2xl border border-warning/40 bg-warning/[0.12] text-[13px] text-warning transition-colors active:bg-warning/20"
        >
          <FileText size={16} /> Orçamento
        </button>

        <div className="flex rounded-2xl border border-fg/[0.08] p-1">
          {[
            { v: true, label: "Hoje" },
            { v: false, label: "Todas" },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => onPeriodo(opt.v)}
              aria-pressed={somenteHoje === opt.v}
              className={`focus-ring min-h-[36px] rounded-xl px-4 text-[13px] transition-colors ${somenteHoje === opt.v ? "bg-accent text-white" : "text-mist"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ---------- Busca ---------- */}
      <div className="mt-4 px-5">
        <div className="flex items-center gap-2.5 rounded-2xl border border-fg/[0.08] bg-fg/[0.03] px-4 focus-within:border-accent/50">
          <Search className="h-4 w-4 shrink-0 text-muted" />
          <input
            value={busca}
            onChange={(e) => onBusca(e.target.value)}
            placeholder="Buscar por cliente"
            // 16px evita o zoom automático do iOS ao focar o campo.
            className="w-full flex-1 bg-transparent py-3 text-[16px] text-ink outline-none placeholder:text-faint"
          />
        </div>
      </div>

      {/* ---------- Lista ---------- */}
      <div className="mt-5 flex-1 px-5">
        <p className="mb-1 text-[12.5px] text-faint">
          {vendas.length} {vendas.length === 1 ? "venda" : "vendas"}
        </p>

        {vendas.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <p className="text-[14px] text-mist">{busca.trim() ? "Nenhuma venda encontrada" : somenteHoje ? "Nenhuma venda hoje" : "Nenhuma venda ainda"}</p>
            <p className="max-w-[240px] text-[12.5px] leading-relaxed text-faint">
              {busca.trim() ? "Tente outro nome de cliente." : "Toque em Nova venda para abrir a primeira nota."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {vendas.map((v) => {
              const st = STATUS_TEXTO[v.status];

              return (
                <button
                  key={v.pedidoId}
                  type="button"
                  onClick={() => onAbrirNota(v)}
                  // 64px de altura: linha confortável para o dedo, sem virar tabela.
                  className="focus-ring flex min-h-[64px] items-center gap-3 border-b border-fg/[0.05] py-3 text-left transition-colors active:bg-fg/[0.04]"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-accent/25 bg-accent/[0.12] text-[13px] text-accent-soft">
                    {getInitials(v.nomeCliente)}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] text-ink">{v.nomeCliente || "Cliente"}</span>
                    <span className="block truncate text-[12px] text-faint">
                      {formatTime(v.data)}
                      {!somenteHoje && ` · ${formatDate(v.data)}`}
                    </span>
                  </span>

                  <span className="shrink-0 text-right">
                    <span className="block text-[14.5px] tabular-nums text-ink">{dinheiro(v.total)}</span>
                    <span className={`block text-[11.5px] ${st.cls}`}>{st.label}</span>
                  </span>

                  <ChevronRight size={16} className="shrink-0 text-muted" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ---------- Ação primária ----------
          Flutua acima da barra inferior, do lado do polegar. */}
      <button
        type="button"
        onClick={onNovaVenda}
        className="focus-ring fixed right-5 z-[90] flex h-14 items-center gap-2 rounded-full bg-accent px-5 text-[15px] text-white shadow-[0_12px_32px_-8px_rgb(var(--accent))] transition-transform active:scale-95"
        style={{ bottom: "calc(72px + env(safe-area-inset-bottom) + 12px)" }}
      >
        <Plus size={20} />
        Nova venda
      </button>
    </div>
  );
};

export default PDVMobile;
