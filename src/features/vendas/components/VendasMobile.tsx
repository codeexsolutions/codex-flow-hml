import { Search, ChevronRight, Eye, EyeOff, X, Download } from "lucide-react";

import { formatCurrency } from "@/shared/utils/currency";
import { formatDateShort } from "@/shared/utils/date";
import { getInitials } from "@/shared/utils/format";
import { useDinheiroVisivel } from "@/shared/session/valoresVisiveis";

export type StatusFiltro = "todos" | "pago" | "pendente" | "cancelado";

export type VendaItem = {
  pedidoId: string;
  clienteId: string;
  nomeCliente?: string;
  data: string | Date;
  total: number;
  pendente: number;
  status: "pago" | "pendente" | "cancelado";
};

type Props = {
  vendas: VendaItem[];
  totalVendas: number;
  totalEmAberto: number;
  busca: string;
  onBusca: (v: string) => void;
  status: StatusFiltro;
  onStatus: (s: StatusFiltro) => void;
  onAbrirNota: (v: VendaItem) => void;
  /** Download rápido da nota, direto da linha — não abre a tela da nota. */
  onBaixarNota: (v: VendaItem) => void;
};

const FILTROS: { id: StatusFiltro; label: string }[] = [
  { id: "todos", label: "Todas" },
  { id: "pendente", label: "Em aberto" },
  { id: "pago", label: "Pagas" },
  { id: "cancelado", label: "Canceladas" },
];

const STATUS: Record<VendaItem["status"], { label: string; cls: string }> = {
  pago: { label: "Paga", cls: "text-success" },
  pendente: { label: "Em aberto", cls: "text-warning" },
  cancelado: { label: "Cancelada", cls: "text-muted line-through" },
};

/**
 * Vendas no celular.
 *
 * Duas diferenças em relação ao PDV, que tem lista parecida:
 *
 * - Aqui o herói é o **total em aberto**, não o faturado. Quem abre "Vendas"
 *   está atrás do que falta receber; o quanto vendeu já está no PDV e no início.
 * - Os filtros de status ficam numa **fita rolável**, não num seletor. São
 *   quatro opções com nomes longos: em 390px elas não cabem lado a lado sem
 *   virar abreviação ilegível.
 */
const VendasMobile = ({ vendas, totalVendas, totalEmAberto, busca, onBusca, status, onStatus, onAbrirNota, onBaixarNota }: Props) => {
  const { mostrar, alternar, dinheiro } = useDinheiroVisivel();


  return (
    <div className="flex min-h-full flex-col pb-4">
      {/* ---------- Topo ---------- */}
      <div className="safe-top flex items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <p className="text-[12.5px] text-mist">Total em aberto</p>
          <p className="mt-1 text-[34px] leading-none tracking-tight text-warning">{dinheiro(totalEmAberto)}</p>
          <p className="mt-1.5 text-[12.5px] text-faint">
            {totalVendas} {totalVendas === 1 ? "venda registrada" : "vendas registradas"}
          </p>
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

      {/* ---------- Busca ---------- */}
      <div className="mt-5 px-5">
        <div className="flex items-center gap-2.5 rounded-2xl border border-fg/[0.08] bg-fg/[0.03] px-4 focus-within:border-accent/50">
          <Search className="h-4 w-4 shrink-0 text-muted" />
          <input
            value={busca}
            onChange={(e) => onBusca(e.target.value)}
            placeholder="Buscar por cliente"
            /* 16px evita o zoom automático do iOS ao focar. */
            className="w-full flex-1 bg-transparent py-3 text-[16px] text-ink outline-none placeholder:text-faint"
          />
          {busca && (
            <button type="button" onClick={() => onBusca("")} aria-label="Limpar busca" className="shrink-0 text-muted">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* ---------- Filtros em fita ---------- */}
      <div className="mt-3 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTROS.map((f) => {
          const on = status === f.id;

          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onStatus(f.id)}
              aria-pressed={on}
              className={`focus-ring min-h-[38px] shrink-0 rounded-full border px-4 text-[13px] transition-colors ${
                on ? "border-accent bg-accent text-white" : "border-fg/[0.1] text-mist active:bg-fg/[0.05]"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* ---------- Lista ---------- */}
      <div className="mt-4 flex-1 px-5">
        {vendas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <p className="text-[14px] text-mist">Nenhuma venda encontrada</p>
            <p className="max-w-[240px] text-[12.5px] leading-relaxed text-faint">
              {busca.trim() ? "Tente outro nome de cliente." : "Ajuste o filtro para ver outras vendas."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {vendas.map((v) => {
              const st = STATUS[v.status];

              return (
                <button
                  key={v.pedidoId}
                  type="button"
                  onClick={() => onAbrirNota(v)}
                  className="focus-ring flex min-h-[68px] items-center gap-3 border-b border-fg/[0.05] py-3 text-left transition-colors active:bg-fg/[0.04]"
                >
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-[13px] ${
                      v.status === "cancelado" ? "border-fg/[0.1] bg-fg/[0.04] text-muted" : "border-accent/25 bg-accent/[0.12] text-accent-soft"
                    }`}
                  >
                    {getInitials(v.nomeCliente)}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[14.5px] ${v.status === "cancelado" ? "text-mist" : "text-ink"}`}>{v.nomeCliente || "Cliente"}</span>
                    {/* Sem a hora: nesta tela ela não decide nada e roubava o
                       espaço de "falta X", que é o dado que faz agir. */}
                    <span className="block truncate text-[12px] text-faint">
                      {formatDateShort(v.data)}
                      {v.status === "pendente" && v.pendente > 0 && ` · falta ${formatCurrency(v.pendente)}`}
                    </span>
                  </span>

                  <span className="shrink-0 text-right">
                    <span className={`block text-[14.5px] tabular-nums ${v.status === "cancelado" ? "text-muted line-through" : "text-ink"}`}>{dinheiro(v.total)}</span>
                    <span className={`block text-[11.5px] ${st.cls}`}>{st.label}</span>
                  </span>

                  <button
                    type="button"
                    title="Baixar nota"
                    aria-label={`Baixar nota de ${v.nomeCliente || "cliente"}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onBaixarNota(v);
                    }}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-accent/[0.12] hover:text-accent-soft active:bg-accent/20"
                  >
                    <Download size={16} />
                  </button>

                  <ChevronRight size={16} className="shrink-0 text-muted" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default VendasMobile;
