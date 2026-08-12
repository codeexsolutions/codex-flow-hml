import { Search, X, Plus, ChevronRight, UserPlus, MessageCircle, Cake } from "lucide-react";

import { formatDocument, getInitials, formatNumber } from "@/shared/utils/format";
import { maskPhone } from "@/shared/validation/masks";

export type Filtro = "todos" | "ativo" | "inativo";

export type ClienteItem = {
  id: string;
  nome: string;
  cpfCnpj?: string;
  telefone?: string;
  whatsapp?: string;
  ativo: boolean;
  aniversarioHoje?: boolean;
};

type Props = {
  clientes: ClienteItem[];
  total: number;
  ativos: number;
  busca: string;
  onBusca: (v: string) => void;
  filtro: Filtro;
  onFiltro: (f: Filtro) => void;
  carregando: boolean;
  onAbrir: (c: ClienteItem) => void;
  onNovo: () => void;
};

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "ativo", label: "Ativos" },
  { id: "inativo", label: "Inativos" },
];

/** Link direto para a conversa — o número já vai com DDI. */
const linkWhatsapp = (numero: string) => {
  const digitos = numero.replace(/\D/g, "");
  const comDdi = digitos.length <= 11 ? `55${digitos}` : digitos;
  return `https://wa.me/${comDdi}`;
};

/**
 * Clientes no celular.
 *
 * O que muda em relação às outras listas: aqui o herói **não é dinheiro**.
 * Quem abre esta tela quer achar alguém — então a busca sobe para o topo, no
 * lugar de um número grande, e cada linha carrega o atalho de WhatsApp: no
 * balcão, o motivo mais comum de procurar um cliente é falar com ele.
 */
const ClientesMobile = ({ clientes, total, ativos, busca, onBusca, filtro, onFiltro, carregando, onAbrir, onNovo }: Props) => {
  return (
    <div className="flex min-h-full flex-col pb-4">
      {/* ---------- Topo ---------- */}
      <div className="safe-top px-5 pt-5">
        <h1 className="text-[22px] leading-tight text-ink">Clientes</h1>
        <p className="mt-0.5 text-[12.5px] text-faint">
          {formatNumber(total)} {total === 1 ? "cadastrado" : "cadastrados"} · {formatNumber(ativos)} {ativos === 1 ? "ativo" : "ativos"}
        </p>
      </div>

      {/* ---------- Busca ---------- */}
      <div className="mt-4 px-5">
        <div className="flex items-center gap-2.5 rounded-2xl border border-fg/[0.08] bg-fg/[0.03] px-4 focus-within:border-accent/50">
          <Search className="h-4 w-4 shrink-0 text-muted" />
          <input
            value={busca}
            onChange={(e) => onBusca(e.target.value)}
            placeholder="Nome, documento ou telefone"
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

      {/* ---------- Filtros ---------- */}
      <div className="mt-3 flex gap-2 px-5">
        {FILTROS.map((f) => {
          const on = filtro === f.id;

          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onFiltro(f.id)}
              aria-pressed={on}
              className={`min-h-[38px] flex-1 rounded-full border text-[13px] transition-colors ${
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
        {carregando ? (
          <p className="py-16 text-center text-[13px] text-faint">Carregando clientes…</p>
        ) : clientes.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl border border-fg/[0.08] bg-fg/[0.03] text-faint">
              <UserPlus size={22} />
            </span>
            <p className="text-[14px] text-ink">{busca.trim() ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}</p>
            <p className="max-w-[250px] text-[12.5px] leading-relaxed text-faint">
              {busca.trim() ? "Tente outro nome, documento ou telefone." : "Cadastre o primeiro para poder abrir notas no PDV."}
            </p>
            {!busca.trim() && (
              <button type="button" onClick={onNovo} className="mt-1 min-h-[44px] rounded-2xl bg-accent px-5 text-[14px] text-white transition-all active:scale-[0.99]">
                Cadastrar primeiro cliente
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col">
            {clientes.map((c) => {
              const numero = c.whatsapp || c.telefone || "";

              return (
                <div key={c.id} className="flex min-h-[68px] items-center gap-3 border-b border-fg/[0.05] py-3">
                  <button type="button" onClick={() => onAbrir(c)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-[13px] ${
                        c.ativo ? "border-accent/25 bg-accent/[0.12] text-accent-soft" : "border-fg/[0.1] bg-fg/[0.04] text-muted"
                      }`}
                    >
                      {getInitials(c.nome)}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className={`truncate text-[14.5px] ${c.ativo ? "text-ink" : "text-mist"}`}>{c.nome}</span>

                        {/* Aniversário do dia: o motivo mais barato de ligar
                            para um cliente que já é seu. */}
                        {c.aniversarioHoje && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent/20 px-1.5 py-0.5 text-[10px] text-accent-soft" title="Faz aniversário hoje">
                            <Cake size={10} /> hoje
                          </span>
                        )}

                        {!c.ativo && <span className="shrink-0 rounded-full bg-fg/[0.06] px-1.5 py-0.5 text-[10px] text-muted">Inativo</span>}
                      </span>
                      <span className="block truncate text-[12px] text-faint">
                        {numero ? maskPhone(numero) : c.cpfCnpj ? formatDocument(c.cpfCnpj) : "Sem contato"}
                      </span>
                    </span>
                  </button>

                  {/* Falar com o cliente é o motivo mais comum de procurá-lo. */}
                  {numero && (
                    <a
                      href={linkWhatsapp(numero)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Falar com ${c.nome} no WhatsApp`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-success/25 bg-success/[0.1] text-success transition-colors active:bg-success/20"
                    >
                      <MessageCircle size={17} />
                    </a>
                  )}

                  <button type="button" onClick={() => onAbrir(c)} aria-label={`Abrir ${c.nome}`} className="shrink-0 text-muted">
                    <ChevronRight size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ---------- Ação primária ---------- */}
      <button
        type="button"
        onClick={onNovo}
        className="fixed right-5 z-[90] flex h-14 items-center gap-2 rounded-full bg-accent px-5 text-[15px] text-white shadow-[0_12px_32px_-8px_rgb(var(--accent))] transition-transform active:scale-95"
        style={{ bottom: "calc(72px + env(safe-area-inset-bottom) + 12px)" }}
      >
        <Plus size={20} />
        Novo cliente
      </button>
    </div>
  );
};

export default ClientesMobile;
