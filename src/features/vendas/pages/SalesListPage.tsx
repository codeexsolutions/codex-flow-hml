import { useEffect, useMemo, useRef, useState, type LegacyRef } from "react";
import { ShoppingCart, Search, XCircle, UserRound, Download, Loader2 } from "lucide-react";
import { Modal } from "@/shared/ui/Modal";
import Invoice from "@/features/vendas/components/Invoice";
import NotaResumo from "@/features/vendas/components/NotaResumo";
import { formatCurrency } from "@/shared/utils/currency";
import { type PedidoClienteType, estaAberto, estaCancelado, estaFechado, totalDoPedido, valorPagoDoPedido, valorPendenteDoPedido } from "@/shared/domain/pedido";
import { formatDateShort } from "@/shared/utils/date";
import { PedidoStatusBadge } from "@/shared/ui/StatusBadge";
import useAuth from "@/features/auth/store/auth.store";
import { ehGestor } from "@/features/vendas/components/TabsVendas";
import useVendaStore from "@/features/vendas/store/venda.store";
import VendasMobile, { type VendaItem } from "@/features/vendas/components/VendasMobile";
import Sheet from "@/shared/ui/Sheet";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import { gerarBlobNota } from "@/shared/ui/DownloadButton";
import { baixarNotaPdf } from "@/shared/ui/downloadNota";
import useEnterprise from "@/features/empresa/store/enterprise.store";

type StatusFiltro = "todos" | "pago" | "pendente" | "cancelado";
type NotaAberta = { id?: string; clienteId: string; nome?: string };

/* ======================= Sales / Outlet Page ======================= */
const SalesList = () => {
  const mobile = useIsMobile();
  const vendas = useVendaStore((s) => s.vendas);
  const fetchVendas = useVendaStore((s) => s.fetchVendas);
  const enterprise = useEnterprise((s) => s.enterprise);

  const [notaAberta, setNotaAberta] = useState<NotaAberta | null>(null);
  const [search, setSearch] = useState("");
  const { user } = useAuth();
  const gestor = ehGestor(user);

  /* Download rápido na linha: um único nó de nota fora da tela, cujo conteúdo
     é preenchido com a venda escolhida antes de rasterizar. Assim não há N
     notas escondidas e o modal não precisa abrir. */
  const [notaDownload, setNotaDownload] = useState<PedidoClienteType | null>(null);
  const [baixandoNota, setBaixandoNota] = useState(false);
  const refNotaDownload = useRef<HTMLDivElement>(null);

  const baixarNota = async (v: PedidoClienteType, formato: "png" | "pdf" = "png") => {
    if (baixandoNota) return;

    setBaixandoNota(true);
    setNotaDownload(v);

    try {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      const blob = await gerarBlobNota(refNotaDownload);

      if (formato === "pdf") {
        await baixarNotaPdf(blob, enterprise?.nomeFantasia ?? "nota");
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = `nota-${v.pedido.pedidoId}.png`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }
    } catch {
      /* Falha de download não trava a tabela — o usuário tenta de novo. */
    } finally {
      setBaixandoNota(false);
      setNotaDownload(null);
    }
  };

  const [status, setStatus] = useState<StatusFiltro>("todos");
  /** "" = todos. Só o gestor vê este filtro — o vendedor já recebe só as dele. */
  const [vendedor, setVendedor] = useState("");

  useEffect(() => {
    fetchVendas();
  }, [fetchVendas]);

  const abrirNota = (nota: NotaAberta) => setNotaAberta(nota);
  const fecharNota = () => {
    setNotaAberta(null);
    fetchVendas(true);
  };

  /* ======================= Filtros ======================= */
  const vendasFiltradas = useMemo(() => {
    let base = [...vendas].sort((a, b) => +new Date(b.pedido.dataPedido) - +new Date(a.pedido.dataPedido));

    if (status === "pago") base = base.filter(estaFechado);
    else if (status === "pendente") base = base.filter(estaAberto);
    else if (status === "cancelado") base = base.filter(estaCancelado);

    if (vendedor) base = base.filter((v) => String(v.vendedorId ?? "") === vendedor);

    const termo = search.trim().toLowerCase();
    if (termo) base = base.filter((v) => v.nomeCliente?.toLowerCase().includes(termo));

    return base;
  }, [vendas, status, search, vendedor]);

  /**
   * Vendedores extraídos das próprias vendas, não da lista de funcionários.
   *
   * Assim quem saiu da empresa continua aparecendo enquanto tiver venda no
   * período — some da lista quando não houver mais o que filtrar. Buscar de
   * `/funcionarios` daria o oposto: ex-funcionário sumiria e as vendas dele
   * ficariam inalcançáveis.
   */
  const vendedores = useMemo(() => {
    const mapa = new Map<string, string>();

    for (const v of vendas) {
      if (v.vendedorId) mapa.set(String(v.vendedorId), v.nomeVendedor || "Sem nome");
    }

    return Array.from(mapa, ([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [vendas]);

const totalEmAberto = useMemo(() => {
  return vendas
    .filter((v) => !estaCancelado(v))
    .reduce((acc, v) => acc + valorPendenteDoPedido(v), 0);
}, [vendas]);

  if (mobile) {
    const itens: VendaItem[] = vendasFiltradas.map((v) => ({
      pedidoId: v.pedido.pedidoId,
      clienteId: v.clienteId,
      nomeCliente: v.nomeCliente,
      data: v.pedido.dataPedido,
      total: totalDoPedido(v),
      pendente: valorPendenteDoPedido(v),
      status: estaCancelado(v) ? "cancelado" : estaFechado(v) ? "pago" : "pendente",
    }));

    return (
      <div className="h-full w-full overflow-y-auto text-ink">
        <VendasMobile
          vendas={itens}
          totalVendas={vendas.length}
          totalEmAberto={totalEmAberto}
          busca={search}
          onBusca={setSearch}
          status={status}
          onStatus={setStatus}
          onAbrirNota={(v) => abrirNota({ id: v.pedidoId, clienteId: v.clienteId, nome: v.nomeCliente })}
          onBaixarNota={(v) => {
            const original = vendasFiltradas.find((x) => x.pedido.pedidoId === v.pedidoId);
            if (original) void baixarNota(original);
          }}
        />

        {/* A nota ocupa a tela toda: é onde a venda é editada e recebida. */}
        <Sheet open={!!notaAberta} onClose={fecharNota} title={notaAberta?.id ? "Venda" : "Nova venda"} subtitle={notaAberta?.nome} altura="cheia">
          {notaAberta && <Invoice id={notaAberta.id} clienteId={notaAberta.clienteId} nome={notaAberta.nome} onSaved={fecharNota} />}
        </Sheet>

        {/* Nó de nota fora da tela para o download rápido. */}
        <NotaEscondida venda={notaDownload} refNota={refNotaDownload} />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="min-h-0 flex-1 ">
        <TabSales
          vendas={vendasFiltradas}
          todasCount={vendas.length}
          totalEmAberto={totalEmAberto}
          search={search}
          setSearch={setSearch}
          status={status}
          setStatus={setStatus}
          vendedor={vendedor}
          setVendedor={setVendedor}
          /* Vendedor só filtra o que já é dele — o seletor é do gestor. */
          vendedores={gestor ? vendedores : []}
          onAbrir={(v: PedidoClienteType) =>
            abrirNota({
              id: v.pedido.pedidoId,
              clienteId: v.clienteId,
              nome: v.nomeCliente,
            })
          }
          onBaixarNota={baixarNota}
          baixandoId={baixandoNota ? notaDownload?.pedido.pedidoId ?? null : null}
        />
      </div>

      <Modal open={!!notaAberta} onClose={fecharNota} title={notaAberta?.id ? "Venda" : "Nova venda"} subtitle={notaAberta?.nome} size="full">
        {notaAberta && <Invoice id={notaAberta.id} clienteId={notaAberta.clienteId} nome={notaAberta.nome} />}
      </Modal>

      {/* Nó de nota fora da tela para o download rápido. */}
      <NotaEscondida venda={notaDownload} refNota={refNotaDownload} />
    </div>
  );
};

/** Nó de nota escondido à esquerda — `html-to-image` precisa que ele exista
    no DOM, então fica fora do viewport em vez de `display:none`. */
function NotaEscondida({ venda, refNota }: { venda: PedidoClienteType | null; refNota: LegacyRef<HTMLDivElement> }) {
  return (
    <div className="fixed -left-[9999px] top-0 w-[900px]" aria-hidden>
      {venda && <NotaResumo venda={venda} refNota={refNota} />}
    </div>
  );
}

/* ======================= Tabela ======================= */
function TabSales({
  vendas,
  todasCount,
  totalEmAberto,
  search,
  setSearch,
  status,
  setStatus,
  vendedor,
  setVendedor,
  vendedores,
  onAbrir,
  onBaixarNota,
  baixandoId,
}: {
  vendas: PedidoClienteType[];
  todasCount: number;
  totalEmAberto: number;
  search: string;
  setSearch: (v: string) => void;
  status: StatusFiltro;
  setStatus: (v: StatusFiltro) => void;
  vendedor: string;
  setVendedor: (v: string) => void;
  vendedores: { id: string; nome: string }[];
  onAbrir: (v: PedidoClienteType) => void;
  onBaixarNota: (v: PedidoClienteType) => void;
  baixandoId: string | null;
}) {
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-3">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex max-w-xs flex-1 items-center gap-2 rounded-lg border border-fg/[0.08] bg-fg/[0.05] px-3 transition-colors focus-within:border-accent">
          <Search className="h-3.5 w-3.5 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente..." className="flex-1 bg-transparent py-2 text-xs text-ink outline-none placeholder:text-faint" />
        </div>

        {/* Só aparece quando há mais de um vendedor com venda: com um só, o
            seletor não filtra nada e vira ruído na barra. */}
        {vendedores.length > 1 && (
          <div className="flex items-center gap-2 rounded-lg border border-fg/[0.08] bg-fg/[0.05] px-3">
            <UserRound className="h-3.5 w-3.5 shrink-0 text-muted" />
            <select
              value={vendedor}
              onChange={(e) => setVendedor(e.target.value)}
              aria-label="Filtrar por vendedor"
              className="cursor-pointer bg-transparent py-2 text-xs text-ink outline-none"
            >
              <option value="">Todos os vendedores</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nome}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-1.5">
          {(["todos", "pago", "pendente", "cancelado"] as const).map((opt) => (
            <button key={opt} onClick={() => setStatus(opt)} className={`cursor-pointer rounded-lg px-3 py-2 text-[11px] capitalize transition-colors ${status === opt ? "bg-accent text-white" : "border border-fg/[0.08] bg-fg/[0.05] text-mist hover:bg-fg/[0.09]"}`}>
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela com scroll horizontal responsivo */}
      <div className="flex min-h-0 flex-col overflow-hidden card glass-sheen rounded-xl">
        <div className="flex items-center justify-between border-b border-fg/[0.07] bg-fg/[0.02] px-4 py-3">
          <div>
            <h2 className="text-[13px] text-ink">Todas as vendas</h2>
            <p className="text-[11px] text-muted">
              {vendas.length} {vendas.length === 1 ? "nota" : "notas"}
              {vendas.length !== todasCount ? " de " + todasCount : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-muted">Total em aberto</p>
            <p className="text-base text-danger">{formatCurrency(totalEmAberto)}</p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-8 border-b border-fg/[0.06] bg-fg/[0.03] py-2 text-center text-[10px] uppercase tracking-wide text-muted">
              <p>ID</p>
              <p>Cliente</p>
              <p>Data</p>
              <p>Status</p>
              <p>Total</p>
              <p className="text-success">Pago</p>
              <p className="text-danger">Pendente</p>
              <p>Nota</p>
            </div>

            {vendas.length > 0 ? (
              <div className="divide-y divide-fg/[0.04]">
                {vendas.map((v) => {
                  const total = totalDoPedido(v);
                  const pago = valorPagoDoPedido(v);
                  const pendente = valorPendenteDoPedido(v);
                  const idCurto = v.pedido.pedidoId?.slice(-6).toUpperCase() ?? "—";
                  const baixandoEsta = baixandoId === v.pedido.pedidoId;

                  return (
                    <div key={v.pedido.pedidoId} className="grid w-full grid-cols-8 items-center gap-2 px-2 py-2.5 text-center text-[11px] text-ink transition-colors hover:bg-fg/[0.04]">
                      <button onClick={() => onAbrir(v)} className="contents">
                        <p className="truncate font-mono text-[10px] text-mist">#{idCurto}</p>
                        <p className="truncate text-left text-[11px]">{v.nomeCliente}</p>
                        <p className="text-mist">{formatDateShort(v.pedido.dataPedido)}</p>
                        <p className="flex justify-center">{<PedidoStatusBadge status={v.pedido.pedidoStatus} />}</p>
                        <p>{formatCurrency(total)}</p>
                        <p className={pago > 0 ? "text-success" : "text-muted"}>{formatCurrency(pago)}</p>
                        <p className={pendente > 0 ? "text-danger" : "text-muted"}>{formatCurrency(pendente)}</p>
                      </button>
                      <button
                        title="Baixar nota"
                        aria-label={`Baixar nota de ${v.nomeCliente}`}
                        disabled={baixandoEsta}
                        onClick={() => onBaixarNota(v)}
                        className="grid h-8 w-8 place-items-center justify-self-center rounded-lg text-faint transition-colors hover:bg-accent/[0.12] hover:text-accent-soft disabled:opacity-50"
                      >
                        {baixandoEsta ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center py-10">
                <div className="flex flex-col items-center gap-2 text-muted">
                  {status === "cancelado" ? <XCircle className="h-6 w-6" /> : <ShoppingCart className="h-6 w-6" />}
                  <p>Nenhuma venda encontrada</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SalesList;
