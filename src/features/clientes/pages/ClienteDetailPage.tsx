import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, Pencil, MessageCircle, Mail, CalendarDays, Loader2, AlertTriangle,
  PhoneCall, Receipt, Wallet, ShoppingBag, TrendingUp, Users, Cake, MapPin, IdCard, UserRound,
  ClipboardList, ExternalLink,
} from "lucide-react";

import { PageScreen, PageToolbar } from "@/shared/ui/PageShell";
import { Modal } from "@/shared/ui/Modal";
import Invoice from "@/features/vendas/components/Invoice";

import CustomerService from "@/features/clientes/services/client.service";
import NoteService from "@/features/vendas/services/note.service";
import CustomerType, { camposDeLead, completudeCliente, SEXO_LABEL } from "@/shared/domain/cliente";
import type { PedidoClienteType } from "@/shared/domain/pedido";
import { useAlert } from "@/shared/ui/Alert";
import { extractErrorMessage, getErrorTitle } from "@/shared/utils/errorHandler";
import { getInitials, onlyDigits, formatDocument, formatNumber } from "@/shared/utils/format";
import { formatDate, toDate } from "@/shared/utils/date";
import { maskCep, maskPhone } from "@/shared/validation/masks";
import { formatTime as horaPedido } from "@/shared/utils/date";
import { ClienteStatusBadge as StatusBadge, PedidoStatusBadge } from "@/shared/ui/StatusBadge";
import { formatCurrency } from "@/shared/utils/currency";

import ClienteForm from "@/features/clientes/components/ClienteForm";
import { ClienteFormData } from "@/features/clientes/schema/cliente.schema";
import ClienteSalesChart from "@/features/clientes/components/ClientesSalesChart";
import { aniversarioBr, diasAteAniversario, idadeEmAnos } from "@/features/clientes/utils/aniversario";

const ITEMS_PER_PAGE = 6;

/* -------------------------------------------------------------------------- */
/* Peças da ficha */
/* -------------------------------------------------------------------------- */

const StatCard = ({ icon, label, value }: { icon: ReactNode; label: string; value: string }) => (
  <div className="card glass-sheen rounded-2xl p-4 transition-colors hover:border-fg/[0.12]">
    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-accent/[0.14] text-accent-soft ring-1 ring-inset ring-accent/20">{icon}</div>
    <p className="text-[11px] uppercase tracking-[0.1em] text-faint">{label}</p>
    <p className="mt-1 truncate text-xl tabular-nums tracking-tight text-ink">{value}</p>
  </div>
);

const SectionHead = ({ icon, title, meta, acao }: { icon: ReactNode; title: string; meta?: string; acao?: ReactNode }) => (
  <div className="flex items-center gap-3 border-b border-fg/[0.07] px-5 py-3.5">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/[0.14] text-accent-soft ring-1 ring-inset ring-accent/20">{icon}</div>
    <div className="min-w-0 flex-1">
      <h2 className="text-[13px] text-ink">{title}</h2>
      {meta && <p className="text-[11px] text-faint">{meta}</p>}
    </div>
    {acao}
  </div>
);

/**
 * Linha de dado da ficha: rótulo à esquerda, valor à direita.
 *
 * Vazio não some — aparece como "—" em tom apagado. Sumir com a linha faria a
 * ficha mudar de altura conforme o cliente e esconderia justamente o que falta
 * preencher, que é a informação mais acionável desta tela.
 */
const Dado = ({ icon, label, valor, acao }: { icon: ReactNode; label: string; valor?: string | null; acao?: ReactNode }) => (
  <div className="flex items-center gap-3 px-5 py-2.5">
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-fg/[0.04] text-muted">{icon}</span>
    <span className="w-[92px] shrink-0 text-[11px] uppercase tracking-[0.08em] text-faint">{label}</span>
    <span className={`min-w-0 flex-1 truncate text-[12.5px] ${valor ? "text-ink" : "text-faint"}`}>{valor || "—"}</span>
    {acao}
  </div>
);

/**
 * Anel de completude da ficha.
 *
 * SVG cru, sem biblioteca de gráfico: é um valor único de 0 a 100 — recharts
 * aqui traria um container responsivo e um tooltip para desenhar um arco.
 * O número vem escrito no miolo; a cor é reforço, não o dado.
 */
const AnelFicha = ({ pct, tamanho = 64 }: { pct: number; tamanho?: number }) => {
  const raio = (tamanho - 7) / 2;
  const volta = 2 * Math.PI * raio;

  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: tamanho, height: tamanho }}>
      <svg width={tamanho} height={tamanho} className="-rotate-90" aria-hidden>
        <circle cx={tamanho / 2} cy={tamanho / 2} r={raio} fill="none" stroke="rgb(var(--fg) / 0.08)" strokeWidth={5} />
        <circle
          cx={tamanho / 2}
          cy={tamanho / 2}
          r={raio}
          fill="none"
          stroke="rgb(var(--accent))"
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={volta}
          strokeDashoffset={volta * (1 - pct / 100)}
          style={{ transition: "stroke-dashoffset .6s ease" }}
        />
      </svg>
      <span className="absolute text-[12px] tabular-nums text-ink">{pct}%</span>
    </span>
  );
};

/** Ação de contato da barra de ferramentas — desabilitada quando falta o dado. */
const AcaoContato = ({ icon, label, href, externo = false, tone = "neutral" }: { icon: ReactNode; label: string; href?: string; externo?: boolean; tone?: "neutral" | "success" }) => {
  const cls =
    tone === "success"
      ? "border-success/30 bg-success/[0.1] text-success hover:bg-success/20"
      : "border-fg/[0.08] bg-fg/[0.04] text-mist hover:bg-fg/[0.08] hover:text-ink";

  if (!href) {
    return (
      <span className="flex h-9 cursor-not-allowed items-center gap-1.5 rounded-xl border border-fg/[0.06] px-3 text-[13px] text-faint opacity-60" title={`${label} não cadastrado`}>
        {icon} {label}
      </span>
    );
  }

  return (
    <a
      href={href}
      {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={`focus-ring flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[13px] transition-colors ${cls}`}
    >
      {icon} {label}
    </a>
  );
};

/* -------------------------------------------------------------------------- */
/* Página */
/* -------------------------------------------------------------------------- */

type PedidoAberto = { id?: string; clienteId: string; nome?: string };

const ClienteDetalhe = () => {
  const params = useParams();
  const id = params.id ?? params.clienteId ?? Object.values(params)[0];
  const navigate = useNavigate();
  const alert = useAlert();

  const [client, setClient] = useState<CustomerType | null>(null);
  const [pedidos, setPedidos] = useState<PedidoClienteType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pedidoAberto, setPedidoAberto] = useState<PedidoAberto | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!id) {
        setError("Cliente não informado.");
        return;
      }
      const res = await CustomerService.getAll();
      const list = (Array.isArray(res.data) ? res.data : (res.data?.data ?? [])) as CustomerType[];
      const found = list.find((c) => String(c.id) === String(id)) ?? null;

      if (!found) {
        setError("Cliente não encontrado.");
        return;
      }

      setClient(found);

      try {
        const pres = await NoteService.getAll();
        const all = pres.data?.data ?? [];
        setPedidos((all as PedidoClienteType[]).filter((p) => String(p.clienteId) === String(found.id)));
      } catch {
        setPedidos([]);
      }
    } catch {
      setError("Não foi possível carregar o cliente.");
    } finally {
      setLoading(false);
    }
  };

  /* Só o `id` na dependência: `load` é recriada a cada render e entraria em
     laço se fosse observada. */
  useEffect(() => {
    load();
  }, [id]);

  const handleUpdate = async (data: ClienteFormData) => {
    if (!client?.id) return;
    setSaving(true);
    try {
      await CustomerService.update(client.id, data);
      setShowEdit(false);
      await load();
      alert.success("Cliente atualizado", "As alterações foram salvas com sucesso.");
    } catch (err) {
      alert.error(getErrorTitle(err), extractErrorMessage(err, "Não foi possível atualizar o cliente."));
    } finally {
      setSaving(false);
    }
  };

  const abrirPedido = (p: PedidoClienteType) => {
    if (!client?.id) return;
    setPedidoAberto({
      id: p.pedido?.pedidoId,
      clienteId: String(client.id),
      nome: client.nome,
    });
  };

  const fecharPedido = () => {
    setPedidoAberto(null);
    load();
  };

  const stats = useMemo(() => {
    const total = pedidos.reduce((a, p) => a + (p.pedido?.totalPedido ?? 0), 0);
    const count = pedidos.length;
    const ticket = count ? total / count : 0;
    const ultimo = pedidos.reduce<Date | null>((acc, p) => {
      const d = toDate(p.pedido?.dataPedido);
      if (!d) return acc;
      return !acc || d > acc ? d : acc;
    }, null);
    return { total, count, ticket, ultimo };
  }, [pedidos]);

  const monthly = useMemo(() => {
    const now = new Date();
    const buckets = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return {
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        total: 0,
      };
    });
    const idx = new Map(buckets.map((b, i) => [b.key, i]));
    pedidos.forEach((p) => {
      const d = toDate(p.pedido?.dataPedido);
      if (!d) return;
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      const i = idx.get(k);
      if (i !== undefined) buckets[i].total += p.pedido.totalPedido ?? 0;
    });
    return buckets;
  }, [pedidos]);

  const statusBreak = useMemo(() => {
    const c: Record<string, number> = { FECHADO: 0, ABERTO: 0, CANCELADO: 0 };
    pedidos.forEach((p) => {
      const s = p.pedido?.pedidoStatus ?? "";
      if (s in c) c[s] += 1;
    });
    const total = pedidos.length || 1;
    return [
      { key: "FECHADO", label: "Fechados", color: "rgb(var(--success))", count: c.FECHADO, pct: (c.FECHADO / total) * 100 },
      { key: "ABERTO", label: "Abertos", color: "rgb(var(--warning))", count: c.ABERTO, pct: (c.ABERTO / total) * 100 },
      { key: "CANCELADO", label: "Cancelados", color: "rgb(var(--danger))", count: c.CANCELADO, pct: (c.CANCELADO / total) * 100 },
    ];
  }, [pedidos]);

  const pedidosOrdenados = useMemo(
    () =>
      [...pedidos].sort((a, b) => {
        const da = a.pedido?.dataPedido ? new Date(a.pedido.dataPedido).getTime() : 0;
        const db = b.pedido?.dataPedido ? new Date(b.pedido.dataPedido).getTime() : 0;
        return db - da;
      }),
    [pedidos],
  );

  const totalPages = Math.max(1, Math.ceil(pedidosOrdenados.length / ITEMS_PER_PAGE));
  const currentPedidos = pedidosOrdenados.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const emptyRows = Math.max(0, ITEMS_PER_PAGE - currentPedidos.length);

  const waDigits = onlyDigits(client?.contato?.whatsapp ?? "");
  const telDigits = onlyDigits(client?.contato?.celular ?? client?.contato?.telefone ?? "");
  const email = client?.contato?.email;

  /* ---- Ficha: o que já existe e o que falta ---- */
  const completude = client ? completudeCliente(client) : 0;
  const faltando = client ? camposDeLead(client).filter((c) => !c.ok) : [];

  const dias = diasAteAniversario(client?.dataNascimento);
  const idade = idadeEmAnos(client?.dataNascimento);

  /** "hoje", "amanhã" ou "em 12 dias" — a ficha responde quando, não só a data. */
  const proximoAniversario = dias === null ? "" : dias === 0 ? "é hoje" : dias === 1 ? "é amanhã" : `em ${dias} dias`;

  const endereco = client?.endereco;
  const linhaEndereco = [endereco?.logradouro, endereco?.numero].filter(Boolean).join(", ");
  const linhaBairro = [endereco?.bairro, [endereco?.cidade, endereco?.uf].filter(Boolean).join("/")].filter(Boolean).join(" · ");
  const temEndereco = Boolean(linhaEndereco || linhaBairro || endereco?.cep);

  /** Busca no mapa pelo endereço escrito — não guardamos coordenadas. */
  const linkMapa = temEndereco ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([linhaEndereco, linhaBairro, endereco?.cep].filter(Boolean).join(" "))}` : undefined;

  /* ------------------------------- Cabeçalho ------------------------------- */

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={() => navigate("/clientes")} className="focus-ring flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-fg/[0.08] bg-fg/[0.04] px-3 text-[13px] text-mist transition-colors hover:bg-fg/[0.08] hover:text-ink">
        <ChevronLeft className="h-4 w-4" /> Voltar
      </button>

      {client && (
        <>
          {/* As ações de contato saíram do cartão no fim da lateral para a barra
              de ferramentas: falar com o cliente é o que se vem fazer aqui, e
              estava a uma rolagem de distância. */}
          <span className="mx-1 hidden h-5 w-px bg-fg/[0.08] sm:block" />

          <AcaoContato icon={<MessageCircle className="h-4 w-4" />} label="WhatsApp" href={waDigits ? `https://wa.me/55${waDigits}` : undefined} externo tone="success" />
          <AcaoContato icon={<PhoneCall className="h-4 w-4" />} label="Ligar" href={telDigits ? `tel:${telDigits}` : undefined} />
          <AcaoContato icon={<Mail className="h-4 w-4" />} label="E-mail" href={email ? `mailto:${email}` : undefined} />

          <button onClick={() => setShowEdit(true)} className="focus-ring flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/[0.14] px-3 text-[13px] text-accent-soft transition-all hover:bg-accent/25 active:scale-95">
            <Pencil className="h-4 w-4" /> Editar
          </button>
        </>
      )}
    </div>
  );

  const headerIcon = client ? <div className="flex h-full w-full items-center justify-center rounded-xl bg-gradient-to-br from-accent/30 to-accent-soft/10 text-[13px] text-accent-soft ring-1 ring-accent/25">{getInitials(client.nome)}</div> : <Users size={22} />;

  /* O subtítulo diz quem é o cliente para a loja — o documento, que pode nem
     existir, virou uma linha da ficha como qualquer outra. */
  const subtitulo = client ? [stats.count > 0 ? `${formatNumber(stats.count)} ${stats.count === 1 ? "pedido" : "pedidos"}` : "Sem pedidos ainda", client.created_at ? `cliente desde ${formatDate(client.created_at)}` : ""].filter(Boolean).join(" · ") : "—";

  /* -------------------------------- Render -------------------------------- */

  return (
    <PageScreen title={client?.nome ?? "Cliente"} subtitle={subtitulo} icon={headerIcon}>
      <PageToolbar>{headerActions}</PageToolbar>

      {loading ? (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-faint" />
        </div>
      ) : error ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
          <AlertTriangle className="h-8 w-8 text-danger" />
          <p className="text-danger">{error}</p>
          <button onClick={load} className="mt-2 cursor-pointer rounded-lg border border-fg/[0.1] bg-fg/[0.05] px-4 py-2 text-sm text-ink transition-colors hover:bg-fg/[0.1]">
            Tentar novamente
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {/* ---------------- Coluna principal: o que ele comprou ---------------- */}
          <div className="flex flex-col gap-4 xl:col-span-2">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard icon={<Wallet size={16} />} label="Total em pedidos" value={formatCurrency(stats.total)} />
              <StatCard icon={<ShoppingBag size={16} />} label="Pedidos" value={formatNumber(stats.count)} />
              <StatCard icon={<TrendingUp size={16} />} label="Ticket médio" value={formatCurrency(stats.ticket)} />
              <StatCard icon={<CalendarDays size={16} />} label="Último pedido" value={stats.ultimo ? formatDate(stats.ultimo) : "—"} />
            </div>

            <div className="card glass-sheen overflow-hidden rounded-2xl">
              <SectionHead icon={<TrendingUp className="h-4 w-4" />} title="Vendas" meta="Últimos 6 meses" />
              <div className="h-[280px] p-4">
                <ClienteSalesChart monthlyData={monthly} />
              </div>
            </div>

            <div className="card glass-sheen flex flex-col overflow-hidden rounded-2xl">
              <SectionHead icon={<Receipt className="h-4 w-4" />} title="Pedidos" meta={`${pedidos.length} ${pedidos.length === 1 ? "pedido" : "pedidos"} no total`} />

              <div>
                {pedidosOrdenados.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-fg/[0.06] bg-fg/[0.03]">
                      <Receipt className="h-6 w-6 text-faint" />
                    </div>
                    <p className="text-[13px] text-mist">Nenhum pedido encontrado</p>
                  </div>
                ) : (
                  <>
                    {currentPedidos.map((p) => {
                      const total = p.pedido?.totalPedido ?? 0;
                      const nItens = p.pedido?.itensPedido?.length ?? 0;
                      const status = p.pedido?.pedidoStatus;

                      return (
                        <button
                          key={p.pedido?.pedidoId}
                          onClick={() => abrirPedido(p)}
                          className="group relative flex h-[68px] w-full cursor-pointer items-center gap-3 border-b border-fg/[0.04] px-5 text-left transition-colors before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:rounded-r before:bg-accent before:opacity-0 before:transition-opacity last:border-b-0 hover:bg-fg/[0.03] hover:before:opacity-100"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/[0.12] text-accent-soft ring-1 ring-inset ring-accent/15">
                            <Receipt size={16} />
                          </span>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] text-ink">
                              <span className="text-faint">#</span>
                              {p.pedido?.pedidoId?.slice(0, 8)}
                            </p>
                            <p className="text-[11px] text-faint">
                              {formatDate(p.pedido?.dataPedido)} · {horaPedido(p.pedido?.dataPedido)} · {nItens} {nItens === 1 ? "item" : "itens"}
                            </p>
                          </div>

                          <span className="hidden sm:block">
                            <PedidoStatusBadge status={status} />
                          </span>

                          <p className="text-right text-[13px] tabular-nums text-ink">{formatCurrency(total)}</p>
                          <ChevronRight size={16} className="text-muted" />
                        </button>
                      );
                    })}

                    {/* Linhas fantasma pra manter altura constante */}
                    {Array.from({ length: emptyRows }).map((_, i) => (
                      <div key={`empty-${i}`} className="h-[68px] border-b border-fg/[0.04] last:border-b-0" />
                    ))}
                  </>
                )}
              </div>

              {pedidosOrdenados.length > 0 && (
                <div className="flex shrink-0 items-center justify-between gap-3 border-t border-fg/[0.06] bg-fg/[0.02] px-5 py-3">
                  <p className="flex items-center gap-2 text-[12px] text-faint">
                    <TrendingUp size={14} className="text-accent-soft" />
                    Ticket médio: <span className="tabular-nums text-ink">{formatCurrency(stats.ticket)}</span>
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      aria-label="Página anterior"
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-fg/[0.08] bg-fg/[0.04] text-mist transition-colors hover:bg-fg/[0.08] hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="text-[12px] text-faint">
                      Página <span className="text-mist">{currentPage}</span>/<span className="text-mist">{totalPages}</span>
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      aria-label="Próxima página"
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-fg/[0.08] bg-fg/[0.04] text-mist transition-colors hover:bg-fg/[0.08] hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ---------------- Lateral: quem ele é ---------------- */}
          <aside className="flex flex-col gap-4">
            {/* ---- Ficha: identidade + o que falta preencher ---- */}
            {/*
              O cartão de perfil era um retrato: avatar grande, nome, documento.
              Com o documento opcional, a pergunta que a ficha precisa responder
              mudou — "o que eu ainda não sei sobre este cliente?". O anel mede
              isso e as lacunas viram atalho para a edição.
            */}
            <div className="card glass-sheen overflow-hidden rounded-2xl">
              <div className="flex items-center gap-3.5 px-5 py-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-accent/25 bg-gradient-to-br from-accent/30 to-accent-soft/10 text-[16px] text-accent-soft">
                  {client ? getInitials(client.nome) : "?"}
                </span>

                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[15px] text-ink">{client?.nome}</h2>
                  <div className="mt-1.5">{client && <StatusBadge status={client.status} />}</div>
                </div>

                <AnelFicha pct={completude} />
              </div>

              {faltando.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowEdit(true)}
                  className="flex w-full cursor-pointer items-center gap-2 border-t border-fg/[0.06] bg-fg/[0.02] px-5 py-2.5 text-left text-[11.5px] text-mist transition-colors hover:bg-fg/[0.05] hover:text-ink"
                >
                  <ClipboardList className="h-3.5 w-3.5 shrink-0 text-muted" />
                  <span className="min-w-0 flex-1 truncate">Falta {faltando.map((f) => f.label.toLowerCase()).join(", ")}</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted" />
                </button>
              ) : (
                <p className="border-t border-fg/[0.06] bg-success/[0.05] px-5 py-2.5 text-[11.5px] text-success">Ficha completa</p>
              )}
            </div>

            {/* ---- Dados do cliente ---- */}
            <div className="card glass-sheen overflow-hidden rounded-2xl">
              <SectionHead icon={<UserRound className="h-4 w-4" />} title="Dados" />

              <div className="divide-y divide-fg/[0.04] py-1">
                <Dado icon={<IdCard size={14} />} label="Documento" valor={client?.cpfCnpj ? formatDocument(client.cpfCnpj) : ""} />
                <Dado
                  icon={<Cake size={14} />}
                  label="Nascimento"
                  valor={client?.dataNascimento ? `${aniversarioBr(client.dataNascimento)}${idade !== null ? ` · ${idade} anos` : ""}` : ""}
                  acao={proximoAniversario ? <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${dias === 0 ? "bg-accent/20 text-accent-soft" : "text-faint"}`}>{proximoAniversario}</span> : undefined}
                />
                <Dado icon={<UserRound size={14} />} label="Sexo" valor={client?.sexo ? SEXO_LABEL[client.sexo] : ""} />
              </div>
            </div>

            {/* ---- Contato ---- */}
            <div className="card glass-sheen overflow-hidden rounded-2xl">
              <SectionHead icon={<PhoneCall className="h-4 w-4" />} title="Contato" />

              <div className="divide-y divide-fg/[0.04] py-1">
                <Dado icon={<MessageCircle size={14} />} label="WhatsApp" valor={client?.contato?.whatsapp ? maskPhone(String(client.contato.whatsapp)) : ""} />
                <Dado icon={<PhoneCall size={14} />} label="Telefone" valor={client?.contato?.celular || client?.contato?.telefone ? maskPhone(String(client?.contato?.celular || client?.contato?.telefone)) : ""} />
                <Dado icon={<Mail size={14} />} label="E-mail" valor={email ?? ""} />
              </div>
            </div>

            {/* ---- Endereço ---- */}
            <div className="card glass-sheen overflow-hidden rounded-2xl">
              <SectionHead
                icon={<MapPin className="h-4 w-4" />}
                title="Endereço"
                acao={
                  linkMapa ? (
                    <a href={linkMapa} target="_blank" rel="noopener noreferrer" className="focus-ring flex shrink-0 items-center gap-1 rounded-lg border border-fg/[0.08] px-2 py-1 text-[11px] text-mist transition-colors hover:bg-fg/[0.05] hover:text-ink">
                      Mapa <ExternalLink size={11} />
                    </a>
                  ) : undefined
                }
              />

              {temEndereco ? (
                <div className="divide-y divide-fg/[0.04] py-1">
                  <Dado icon={<MapPin size={14} />} label="Logradouro" valor={linhaEndereco} />
                  <Dado icon={<MapPin size={14} />} label="Bairro" valor={linhaBairro} />
                  <Dado icon={<MapPin size={14} />} label="CEP" valor={endereco?.cep ? maskCep(String(endereco.cep)) : ""} />
                  {endereco?.complemento && <Dado icon={<MapPin size={14} />} label="Complemento" valor={endereco.complemento} />}
                </div>
              ) : (
                <button type="button" onClick={() => setShowEdit(true)} className="flex w-full cursor-pointer items-center justify-between gap-2 px-5 py-4 text-left text-[12px] text-faint transition-colors hover:bg-fg/[0.03] hover:text-mist">
                  Nenhum endereço cadastrado — adicione para entregas e rotas.
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                </button>
              )}
            </div>

            {/* ---- Status dos pedidos ---- */}
            {pedidos.length > 0 && (
              <div className="card glass-sheen rounded-2xl p-5">
                <p className="mb-4 text-[11px] uppercase tracking-[0.12em] text-mist">Status dos pedidos</p>
                <div className="space-y-3.5">
                  {statusBreak.map((s) => (
                    <div key={s.key}>
                      <div className="mb-1.5 flex items-center justify-between text-[13px]">
                        <span className="flex items-center gap-2 text-mist">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                          {s.label}
                        </span>
                        <span className="tabular-nums text-ink">{s.count}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-fg/[0.06]">
                        <div className="h-full rounded-full transition-all" style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* Edição — mesma ficha do cadastro */}
      {client && <ClienteForm open={showEdit} cliente={client} saving={saving} onClose={() => setShowEdit(false)} onSubmit={handleUpdate} />}

      {/* Nota do pedido, igual à do PDV */}
      <Modal open={!!pedidoAberto} onClose={fecharPedido} title="Pedido" subtitle={pedidoAberto?.nome} size="full">
        {pedidoAberto && <Invoice id={pedidoAberto.id} clienteId={pedidoAberto.clienteId} nome={pedidoAberto.nome} />}
      </Modal>
    </PageScreen>
  );
};

export default ClienteDetalhe;
