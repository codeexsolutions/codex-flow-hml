import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, UserPlus, Search, AlertTriangle, ChevronRight, Cake, RotateCw, MapPin, MessageCircle, Pencil, Phone, ClipboardList } from "lucide-react";
import CustomerService from "@/features/clientes/services/client.service";
import useClienteStore from "@/features/clientes/store/cliente.store";
import useSincronizacao from "@/shared/realtime/useSincronizacao";
import ClientType, { camposDeLead, completudeCliente, eStatus, type ContactType } from "@/shared/domain/cliente";
import ClienteForm from "@/features/clientes/components/ClienteForm";
import ClientesMobile, { type ClienteItem } from "@/features/clientes/components/ClientesMobile";
import FichaCliente from "@/features/clientes/components/FichaCliente";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import type { ClienteFormData } from "@/features/clientes/schema/cliente.schema";
import ClientesGrowthChart from "@/features/clientes/components/ClientesGrowthChart";
import { useAlert } from "@/shared/ui/Alert";
import { extractErrorMessage, getErrorTitle } from "@/shared/utils/errorHandler";
import { formatDocument, formatNumber, getInitials, onlyDigits, toPercent } from "@/shared/utils/format";
import { maskPhone } from "@/shared/validation/masks";
import { ClienteStatusBadge as StatusBadge } from "@/shared/ui/StatusBadge";
import { SkeletonTableRows, SkeletonIdentityCell } from "@/shared/ui/skeleton";
import { useAutoPageSize, ROW_HEIGHT } from "@/shared/hooks/useAutoPageSize";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { PageScreen } from "@/shared/ui/PageShell";
import { ListaAcao, ListaCabecalho, ListaFantasmas, ListaLinha, TabelaPaginacao } from "@/shared/ui/DataTable";
import { aniversarioBr, diaAniversario, ehAniversarianteDoMes, ehAniversarioHoje } from "@/features/clientes/utils/aniversario";

type Filtro = "todos" | "ativo" | "inativo" | "incompletos";

const FILTROS: { value: Filtro; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "ativo", label: "Ativos" },
  { value: "inativo", label: "Inativos" },
  /* Filtro novo: com CPF opcional, "quem está pela metade" virou uma pergunta
     que se faz de verdade — e sem ele não havia como agir sobre a resposta. */
  { value: "incompletos", label: "A completar" },
];

/*
 * Colunas.
 *
 * "Documento" saiu do lugar de destaque: agora que o CPF é opcional, a coluna
 * ficaria vazia na maior parte das linhas — e uma coluna majoritariamente vazia
 * ensina que o dado não importa. No lugar entram as três coisas que se procura
 * numa base de clientes: como falar com ele, onde ele está e o quanto a ficha
 * está preenchida.
 */
const COLS = "grid-cols-[minmax(0,1fr)_148px_152px_84px_104px_104px]";
/** Soma das colunas fixas + folga para a flexível: abaixo disso a tabela rola. */
const TABLE_MIN_WIDTH = 824;

function contactDigits(contato?: ContactType) {
  if (!contato) return "";
  return onlyDigits(`${contato.telefone ?? ""}${contato.celular ?? ""}${contato.whatsapp ?? ""}`);
}

/** O número que a loja usa para falar com o cliente, na ordem de preferência. */
const numeroDeContato = (c: ClientType) => c.contato?.whatsapp || c.contato?.celular || c.contato?.telefone || "";

const localDoCliente = (c: ClientType) => {
  const cidade = c.endereco?.cidade?.trim();
  const uf = c.endereco?.uf?.trim();

  if (cidade && uf) return `${cidade}/${uf}`;
  return cidade || uf || "";
};

const SkeletonRows = ({ count }: { count: number }) => (
  <SkeletonTableRows count={count} cols={COLS} rowHeight={ROW_HEIGHT}>
    <SkeletonIdentityCell />
    <div className="h-3 w-24 rounded bg-fg/[0.05]" />
    <div className="h-3 w-20 rounded bg-fg/[0.05]" />
    <div className="h-3 w-12 rounded bg-fg/[0.05]" />
    <div className="h-5 w-16 rounded-full bg-fg/[0.05]" />
    <div className="ml-auto h-7 w-[68px] rounded-lg bg-fg/[0.05]" />
  </SkeletonTableRows>
);

/** Cartão da coluna lateral — mesma casca para gráfico, aniversários e ficha. */
const PainelLateral = ({ icon, title, meta, children }: { icon: React.ReactNode; title: string; meta?: string; children: React.ReactNode }) => (
  <div className="card glass-sheen rounded-lg p-4">
    <div className="mb-3.5 flex items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/[0.15] text-accent-soft">{icon}</span>
      <div className="min-w-0">
        <h2 className="truncate text-[13px] text-ink">{title}</h2>
        {meta && <p className="text-[11px] text-faint">{meta}</p>}
      </div>
    </div>
    {children}
  </div>
);

const Clientes = () => {
  const navigate = useNavigate();
  const mobile = useIsMobile();
  const alert = useAlert();

  // Estado dos clientes vive no store — assim PDV, Dashboard e Relatórios
  // enxergam a mesma lista e uma criação aqui reflete em todos.
  const customers = useClienteStore((s) => s.clientes) as ClientType[];
  const loading = useClienteStore((s) => s.loading);
  const error = useClienteStore((s) => s.error);
  const fetchClientes = useClienteStore((s) => s.fetchClientes);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [page, setPage] = useState(1);

  const [showCreate, setShowCreate] = useState(false);
  /* Cliente em edição pela própria lista — antes era preciso abrir a ficha,
     achar "Editar" e voltar, três telas para corrigir um telefone. */
  const [editando, setEditando] = useState<ClientType | null>(null);
  const [saving, setSaving] = useState(false);

  const { bodyRef, perPage } = useAutoPageSize<HTMLDivElement>();

  const load = async () => {
    await fetchClientes(true);
  };

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  /* Cliente cadastrado no PDV de outro balcão aparece aqui sem recarregar. */
  useSincronizacao(["clientes"], () => fetchClientes(true));

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const digits = onlyDigits(q);

    return (
      customers
        .filter((c) => {
          const matchStatus =
            filtro === "todos" ||
            (filtro === "ativo" && c.status === eStatus.ATIVO) ||
            (filtro === "inativo" && c.status === eStatus.INATIVO) ||
            (filtro === "incompletos" && completudeCliente(c) < 100);

          if (!matchStatus) return false;
          if (!q) return true;

          const matchNome = c.nome?.toLowerCase().includes(q);
          const matchEmail = c.contato?.email?.toLowerCase().includes(q);
          const matchLocal = localDoCliente(c).toLowerCase().includes(q);
          const matchDoc = digits.length > 0 && (onlyDigits(c.cpfCnpj ?? "").includes(digits) || contactDigits(c.contato).includes(digits));

          return matchNome || matchEmail || matchLocal || matchDoc;
        })
        // Mais recentes primeiro; clientes sem data vão para o fim.
        .sort((a, b) => {
          const da = a.created_at ? new Date(a.created_at).getTime() : 0;
          const db = b.created_at ? new Date(b.created_at).getTime() : 0;
          return db - da;
        })
    );
  }, [customers, debouncedSearch, filtro]);

  const stats = useMemo(() => {
    const total = customers.length;
    const ativos = customers.filter((c) => c.status === eStatus.ATIVO).length;
    return { total, ativos, inativos: total - ativos };
  }, [customers]);

  const pctAtivos = toPercent(stats.ativos, stats.total);

  /* ---- Aniversariantes do mês ---- */
  /* O dado de nascimento só vale se alguém puder agir sobre ele; sem esta
     lista ele seria mais um campo preenchido que ninguém lê. */
  const aniversariantes = useMemo(
    () =>
      customers
        .filter((c) => ehAniversarianteDoMes(c.dataNascimento))
        .sort((a, b) => (diaAniversario(a.dataNascimento) ?? 0) - (diaAniversario(b.dataNascimento) ?? 0)),
    [customers],
  );

  /* ---- Saúde da base: média das fichas e a lacuna mais comum ---- */
  const ficha = useMemo(() => {
    if (customers.length === 0) return { media: 0, lacuna: null as null | { label: string; faltam: number } };

    const media = Math.round(customers.reduce((acc, c) => acc + completudeCliente(c), 0) / customers.length);

    const faltas = new Map<string, number>();
    customers.forEach((c) =>
      camposDeLead(c)
        .filter((campo) => !campo.ok)
        .forEach((campo) => faltas.set(campo.label, (faltas.get(campo.label) ?? 0) + 1)),
    );

    const pior = [...faltas.entries()].sort((a, b) => b[1] - a[1])[0];

    return { media, lacuna: pior ? { label: pior[0], faltam: pior[1] } : null };
  }, [customers]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageItems = filtered.slice((page - 1) * perPage, page * perPage);
  const emptySlots = Math.max(0, perPage - pageItems.length);

  useEffect(() => setPage(1), [debouncedSearch, filtro]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleCreate = async (data: ClienteFormData) => {
    setSaving(true);
    try {
      await CustomerService.create(data);
      setShowCreate(false);
      await load();
      alert.success("Cliente cadastrado!", "O cliente foi adicionado com sucesso.");
    } catch (err) {
      alert.error(getErrorTitle(err), extractErrorMessage(err, "Não foi possível cadastrar o cliente."));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (data: ClienteFormData) => {
    if (!editando?.id) return;

    setSaving(true);
    try {
      await CustomerService.update(String(editando.id), data);
      setEditando(null);
      await load();
      alert.success("Cliente atualizado", "As alterações foram salvas com sucesso.");
    } catch (err) {
      alert.error(getErrorTitle(err), extractErrorMessage(err, "Não foi possível atualizar o cliente."));
    } finally {
      setSaving(false);
    }
  };

  /**
   * Abre a conversa no WhatsApp já com o número do cliente.
   *
   * É a ação que mais se faz com uma base de clientes e a que mais custava:
   * abrir a ficha, selecionar o número, copiar, trocar de aplicativo. O `55`
   * entra só quando falta — número já salvo com DDI não pode virar `5555…`.
   */
  const abrirWhatsapp = (c: ClientType) => {
    const digitos = onlyDigits(String(numeroDeContato(c)));
    if (!digitos) return;

    const destino = digitos.length <= 11 ? `55${digitos}` : digitos;
    window.open(`https://wa.me/${destino}`, "_blank", "noopener,noreferrer");
  };

  const hasFilters = Boolean(search) || filtro !== "todos";

  if (mobile) {
    const itens: ClienteItem[] = filtered.map((c) => ({
      id: String(c.id ?? ""),
      nome: c.nome,
      cpfCnpj: c.cpfCnpj ?? undefined,
      telefone: c.contato?.telefone ? String(c.contato.telefone) : undefined,
      whatsapp: c.contato?.whatsapp ? String(c.contato.whatsapp) : undefined,
      ativo: c.status === eStatus.ATIVO,
      aniversarioHoje: ehAniversarioHoje(c.dataNascimento),
    }));

    return (
      <div className="h-full w-full overflow-y-auto text-ink">
        <ClientesMobile
          clientes={itens}
          total={customers.length}
          ativos={stats.ativos}
          busca={search}
          onBusca={setSearch}
          filtro={filtro === "incompletos" ? "todos" : filtro}
          onFiltro={setFiltro}
          carregando={loading}
          onAbrir={(c) => navigate(`/clientes/${c.id}`)}
          onNovo={() => setShowCreate(true)}
        />

        {showCreate && <ClienteForm saving={saving} onClose={() => setShowCreate(false)} onSubmit={handleCreate} />}
      </div>
    );
  }

  return (
    <PageScreen title="Clientes" subtitle="Cadastre, organize e acompanhe sua base de clientes" icon={<Users />}>
      {error && (
        <div className="flex shrink-0 items-center justify-between gap-2.5 rounded-xl border border-danger/40 bg-danger/15 px-4 py-3 text-[13px] text-danger">
          <span className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </span>
          <button onClick={load} className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-danger/30 px-2.5 py-1 text-[12px] text-danger transition-colors hover:bg-danger/10">
            <RotateCw className="h-3.5 w-3.5" /> Tentar novamente
          </button>
        </div>
      )}

      {/*
       * Duas colunas: a lista à esquerda, os painéis à direita.
       *
       * Abaixo de `lg` volta a empilhar: em tela estreita não há largura para
       * duas colunas sem espremer as duas.
       */}
      <section className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        {/* ---------- Lista ---------- */}
        <div className="card glass-sheen flex min-h-[260px] min-w-0 flex-1 flex-col overflow-hidden rounded-lg">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-fg/[0.06] px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/[0.15]">
                <Users className="h-4 w-4 text-accent-soft" />
              </div>
              <div>
                <h2 className="text-[13px] text-ink">Todos os clientes</h2>
                <p className="text-[11px] text-faint">
                  {formatNumber(filtered.length)} {filtered.length === 1 ? "resultado" : "resultados"}
                </p>
              </div>
            </div>

            <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
              <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-fg/[0.08] bg-fg/[0.04] px-3 transition-colors focus-within:border-accent/60 focus-within:bg-fg/[0.06] sm:max-w-xs">
                <Search className="h-4 w-4 text-muted" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nome, telefone, e-mail ou cidade…"
                  aria-label="Buscar clientes"
                  className="flex-1 bg-transparent py-2 text-[13px] text-ink outline-none placeholder:text-faint"
                />
              </div>

              <div className="flex items-center gap-1 rounded-lg border border-fg/[0.07] bg-fg/[0.03] p-1">
                {FILTROS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFiltro(opt.value)}
                    aria-pressed={filtro === opt.value}
                    className={`cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-[12px] transition-colors ${filtro === opt.value ? "bg-accent text-white shadow-glow" : "text-mist hover:text-ink"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="focus-ring inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-gradient-to-br from-accent-soft to-accent px-3 py-2 text-[12.5px] text-white shadow-glow transition-all hover:brightness-110 active:scale-[0.98]"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Novo cliente
              </button>
            </div>
          </div>

          {/* Colunas + linhas rolam juntas na horizontal quando a tela é estreita. */}
          <div className="flex min-h-0 flex-1 flex-col overflow-x-auto">
            <div className="flex min-h-0 flex-1 flex-col" style={{ minWidth: TABLE_MIN_WIDTH }}>
              <ListaCabecalho cols={COLS}>
                <p>Cliente</p>
                <p>Contato</p>
                <p>Local</p>
                <p>Ficha</p>
                <p className="text-right">Situação</p>
                <p className="text-right">Ações</p>
              </ListaCabecalho>

              {/* Corpo: sem scroll — o que não cabe vai pra próxima página */}
              <div ref={bodyRef} className="min-h-0 flex-1 overflow-hidden">
                {loading ? (
                  <SkeletonRows count={perPage} />
                ) : filtered.length === 0 ? (
                  <div className="flex h-full items-center justify-center py-10">
                    <div className="flex max-w-xs flex-col items-center gap-3 text-center text-faint">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-fg/[0.06] bg-fg/[0.03]">
                        <Users className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-[13px] text-mist">Nenhum cliente encontrado</p>
                        <p className="mt-0.5 text-[11px]">{hasFilters ? "Ajuste a busca ou os filtros." : "Comece cadastrando seu primeiro cliente."}</p>
                      </div>
                      {!hasFilters && (
                        <button onClick={() => setShowCreate(true)} className="mt-1 cursor-pointer rounded-xl bg-accent px-3.5 py-2 text-[12px] text-white transition-colors hover:bg-accent">
                          Cadastrar primeiro cliente
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    {pageItems.map((c) => {
                      const numero = numeroDeContato(c);
                      const local = localDoCliente(c);
                      const fazAniversarioHoje = ehAniversarioHoje(c.dataNascimento);
                      const doMes = ehAniversarianteDoMes(c.dataNascimento);

                      return (
                        <ListaLinha
                          key={c.id ?? c.nome}
                          cols={COLS}
                          altura={ROW_HEIGHT}
                          onClick={() => c.id && navigate(`/clientes/${c.id}`)}
                          ariaLabel={`Abrir cliente ${c.nome}`}
                          /*
                           * Três ações, e não um menu de três pontinhos.
                           *
                           * Um menu esconde as ações atrás de um clique e de
                           * uma leitura; com três itens ele custa mais do que
                           * economiza. WhatsApp só aparece para quem tem
                           * número — botão que não faz nada ensina a não
                           * clicar nos que fazem.
                           */
                          acoes={
                            <>
                              {numero && (
                                <ListaAcao
                                  icon={<MessageCircle size={14} />}
                                  label="WhatsApp"
                                  tone="success"
                                  onClick={() => abrirWhatsapp(c)}
                                />
                              )}

                              <ListaAcao icon={<Pencil size={14} />} label="Editar" onClick={() => setEditando(c)} />

                              <ListaAcao
                                icon={<ChevronRight size={14} />}
                                label="Abrir ficha"
                                onClick={() => c.id && navigate(`/clientes/${c.id}`)}
                              />
                            </>
                          }
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-gradient-to-br from-accent/25 to-accent-soft/10 text-[11px] text-accent-soft">{getInitials(c.nome)}</div>

                            <div className="flex min-w-0 flex-col">
                              <span className="flex min-w-0 items-center gap-1.5">
                                <span className="truncate text-[13px] text-ink">{c.nome}</span>

                                {/* Bolo só no mês do aniversário: o ícone existe
                                    para provocar a ligação, não para decorar. */}
                                {doMes && (
                                  <span
                                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] ${fazAniversarioHoje ? "bg-accent/20 text-accent-soft" : "text-faint"}`}
                                    title={fazAniversarioHoje ? "Faz aniversário hoje" : `Aniversário em ${aniversarioBr(c.dataNascimento)}`}
                                  >
                                    <Cake size={10} />
                                    {fazAniversarioHoje ? "hoje" : aniversarioBr(c.dataNascimento)}
                                  </span>
                                )}
                              </span>

                              <span className="truncate text-[11px] text-faint">{c.contato?.email || (c.cpfCnpj ? formatDocument(c.cpfCnpj) : "Sem documento")}</span>
                            </div>
                          </div>

                          <span className="flex min-w-0 items-center gap-1.5 text-[12px] tabular-nums text-mist">
                            {numero ? (
                              <>
                                {c.contato?.whatsapp ? <MessageCircle size={12} className="shrink-0 text-success" /> : <Phone size={12} className="shrink-0 text-muted" />}
                                <span className="truncate">{maskPhone(String(numero))}</span>
                              </>
                            ) : (
                              <span className="text-faint">—</span>
                            )}
                          </span>

                          <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-mist">
                            {local ? (
                              <>
                                <MapPin size={12} className="shrink-0 text-muted" />
                                <span className="truncate">{local}</span>
                              </>
                            ) : (
                              <span className="text-faint">—</span>
                            )}
                          </span>

                          <span>
                            <FichaCliente cliente={c} />
                          </span>

                          <span className="flex justify-end">
                            <StatusBadge status={c.status} />
                          </span>

                          {/* Célula vazia: reserva a largura das ações, que
                              são desenhadas sobrepostas pela `ListaLinha`. */}
                          <span aria-hidden />
                        </ListaLinha>
                      );
                    })}

                    <ListaFantasmas quantidade={emptySlots} altura={ROW_HEIGHT} />
                  </>
                )}
              </div>
            </div>
          </div>

          <TabelaPaginacao
            pagina={page}
            totalPaginas={totalPages}
            onPagina={setPage}
            resumo={`${formatNumber(filtered.length)} ${filtered.length === 1 ? "cliente" : "clientes"}`}
          />
        </div>

        {/* ---------- Painéis ---------- */}
        <aside className="flex shrink-0 flex-col gap-3 overflow-y-auto lg:w-[300px]">
          <div className="flex min-h-[240px] flex-col [&>*]:h-full">
            <ClientesGrowthChart customers={customers} />
          </div>

          {/* ---- Aniversariantes do mês ---- */}
          <PainelLateral
            icon={<Cake className="h-4 w-4" />}
            title="Aniversariantes do mês"
            meta={aniversariantes.length > 0 ? `${aniversariantes.length} ${aniversariantes.length === 1 ? "cliente" : "clientes"}` : undefined}
          >
            {aniversariantes.length === 0 ? (
              <p className="text-[11.5px] leading-relaxed text-faint">Ninguém faz aniversário este mês — ou a data de nascimento ainda não foi preenchida nas fichas.</p>
            ) : (
              <ul className="flex max-h-[168px] flex-col gap-1 overflow-y-auto">
                {aniversariantes.slice(0, 12).map((c) => {
                  const hoje = ehAniversarioHoje(c.dataNascimento);

                  return (
                    <li key={c.id ?? c.nome}>
                      <button
                        type="button"
                        onClick={() => c.id && navigate(`/clientes/${c.id}`)}
                        className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-fg/[0.04]"
                      >
                        {/* O dia é o dado que decide a ação — por isso vem primeiro
                            e em caixa própria, não escondido no fim da linha. */}
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] tabular-nums ${hoje ? "bg-accent text-white" : "bg-fg/[0.05] text-mist"}`}>
                          {diaAniversario(c.dataNascimento)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[12.5px] text-mist">{c.nome}</span>
                        {hoje && <span className="shrink-0 text-[10px] uppercase tracking-wide text-accent-soft">hoje</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </PainelLateral>

          {/* ---- Saúde das fichas + composição da base ---- */}
          <PainelLateral icon={<ClipboardList className="h-4 w-4" />} title="Fichas da base" meta={`${ficha.media}% preenchidas em média`}>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-fg/[0.05]">
              <div className="bg-gradient-to-r from-accent-soft to-accent transition-all" style={{ width: `${ficha.media}%` }} />
            </div>

            {ficha.lacuna && (
              <button
                type="button"
                onClick={() => setFiltro("incompletos")}
                className="mt-3 flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-fg/[0.06] px-3 py-2 text-left text-[11.5px] text-mist transition-colors hover:bg-fg/[0.04] hover:text-ink"
              >
                <span className="min-w-0 truncate">
                  {formatNumber(ficha.lacuna.faltam)} sem {ficha.lacuna.label.toLowerCase()}
                </span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted" />
              </button>
            )}

            <div className="mt-4 flex items-center justify-between border-t border-fg/[0.06] pt-3 text-[12px]">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-success" />
                <span className="text-mist">Ativos</span>
                <span className="tabular-nums text-ink">{formatNumber(stats.ativos)}</span>
                <span className="tabular-nums text-faint">({pctAtivos}%)</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-faint" />
                <span className="text-mist">Inativos</span>
                <span className="tabular-nums text-ink">{formatNumber(stats.inativos)}</span>
              </span>
            </div>
          </PainelLateral>
        </aside>
      </section>

      {showCreate && <ClienteForm saving={saving} onClose={() => setShowCreate(false)} onSubmit={handleCreate} />}

      {/* Edição pela lista: mesma ficha da tela de detalhe, sem sair daqui. */}
      {editando && <ClienteForm cliente={editando} saving={saving} onClose={() => setEditando(null)} onSubmit={handleUpdate} />}
    </PageScreen>
  );
};

export default Clientes;
