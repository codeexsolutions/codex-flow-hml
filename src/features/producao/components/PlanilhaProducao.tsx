import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, User } from "lucide-react";

import type { Etapa, ItemProducao } from "@/features/producao/services/producao.service";

type Funcionario = { id: string; nome: string };

type Props = {
  itens: ItemProducao[];
  etapas: Etapa[];
  funcionarios: Funcionario[];
  /** Cria direto da célula: pessoa + dia já definidos pelo cruzamento. */
  onCriar: (dados: { titulo: string; responsavelId: string | null; prazo: string }) => Promise<void>;
  onMover: (itemId: string, responsavelId: string | null, prazo: string) => Promise<void>;
  onAbrir: (item: ItemProducao) => void;
};

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Segunda-feira da semana da data informada. */
function inicioDaSemana(base: Date): Date {
  const d = new Date(base);
  const dia = d.getDay();

  d.setDate(d.getDate() - (dia === 0 ? 6 : dia - 1));
  d.setHours(0, 0, 0, 0);

  return d;
}

/**
 * Planilha da produção — pessoas nas linhas, dias nas colunas.
 *
 * Por que esta visão existe ao lado do quadro: são perguntas diferentes.
 *
 *   • O quadro responde "em que etapa está este pedido".
 *   • A planilha responde "o que cada um vai fazer na quinta".
 *
 * Quem monta a semana precisa da segunda; quem acompanha o pedido precisa da
 * primeira. Uma tela só tentando servir às duas serviria mal a ambas.
 *
 * A célula é o cruzamento pessoa × dia, e escrever nela **cria o item já
 * atribuído** — o cruzamento já diz de quem e de quando, então pedir isso num
 * formulário seria repetir o que a posição do cursor já informou.
 *
 * Há uma linha "Sem responsável" no topo: trabalho existe antes de ter dono, e
 * esconder o que ninguém pegou é justamente perder o que mais importa ver.
 */
const PlanilhaProducao = ({ itens, etapas, funcionarios, onCriar, onMover, onAbrir }: Props) => {
  const [ancora, setAncora] = useState(() => inicioDaSemana(new Date()));
  const [editando, setEditando] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [arrastando, setArrastando] = useState<string | null>(null);

  const dias = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(ancora);
      d.setDate(d.getDate() + i);

      return d;
    });
  }, [ancora]);

  const hojeIso = iso(new Date());

  /* Mapa "responsavel|dia" → itens. Montado uma vez por render em vez de
     filtrar a lista inteira dentro de cada uma das ~56 células. */
  const grade = useMemo(() => {
    const mapa = new Map<string, ItemProducao[]>();

    for (const i of itens) {
      if (!i.prazo) continue;

      const chave = `${i.responsavel_fk ?? "sem"}|${String(i.prazo).slice(0, 10)}`;

      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave)!.push(i);
    }

    return mapa;
  }, [itens]);

  const linhas = useMemo(() => [{ id: "sem", nome: "Sem responsável" }, ...funcionarios], [funcionarios]);

  const corDaEtapa = (item: ItemProducao) => {
    const idx = etapas.findIndex((e) => e.id === item.etapa_fk);

    if (idx < 0) return "border-l-fg/20";

    /* A cor vem da posição no fluxo: começo frio, fim quente. Sem isso, todas
       as etiquetas ficariam iguais e a planilha viraria texto puro. */
    const cores = ["border-l-accent", "border-l-sky-400", "border-l-amber-400", "border-l-orange-400", "border-l-success"];

    return cores[Math.min(idx, cores.length - 1)];
  };

  const salvarCelula = async (responsavelId: string, dia: string) => {
    const titulo = texto.trim();

    setEditando(null);
    setTexto("");

    if (!titulo) return;

    await onCriar({ titulo, responsavelId: responsavelId === "sem" ? null : responsavelId, prazo: dia });
  };

  const semanaLabel = `${dias[0].getDate()}/${dias[0].getMonth() + 1} a ${dias[6].getDate()}/${dias[6].getMonth() + 1}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Navegação por semana */}
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={() => setAncora((a) => new Date(a.getFullYear(), a.getMonth(), a.getDate() - 7))}
          aria-label="Semana anterior"
          className="focus-ring grid h-8 w-8 place-items-center rounded-lg border border-fg/[0.1] text-mist transition-colors hover:text-ink"
        >
          <ChevronLeft size={15} />
        </button>

        <span className="text-[12.5px] tabular-nums text-ink">{semanaLabel}</span>

        <button
          onClick={() => setAncora((a) => new Date(a.getFullYear(), a.getMonth(), a.getDate() + 7))}
          aria-label="Próxima semana"
          className="focus-ring grid h-8 w-8 place-items-center rounded-lg border border-fg/[0.1] text-mist transition-colors hover:text-ink"
        >
          <ChevronRight size={15} />
        </button>

        <button onClick={() => setAncora(inicioDaSemana(new Date()))} className="focus-ring rounded-lg border border-fg/[0.1] px-2.5 py-1.5 text-[11.5px] text-mist transition-colors hover:text-ink">
          Esta semana
        </button>
      </div>

      {/* Grade */}
      <div className="card glass-sheen min-h-0 flex-1 overflow-auto">
        <table className="w-full border-separate border-spacing-0 text-left">
          <thead className="sticky top-0 z-20">
            <tr>
              {/* A coluna de nomes gruda na esquerda: rolando para sexta, você
                  precisa continuar sabendo de quem é a linha. */}
              <th className="sticky left-0 z-30 min-w-[150px] border-b border-r border-fg/[0.07] bg-surface px-3 py-2 text-[11px] uppercase tracking-[0.08em] text-faint">
                Equipe
              </th>

              {dias.map((d) => {
                const ehHoje = iso(d) === hojeIso;
                const fds = d.getDay() === 0 || d.getDay() === 6;

                return (
                  <th
                    key={iso(d)}
                    className={`min-w-[150px] border-b border-r border-fg/[0.07] px-3 py-2 text-center ${ehHoje ? "bg-accent/[0.1]" : fds ? "bg-fg/[0.02]" : "bg-surface"}`}
                  >
                    <span className={`block text-[11px] uppercase tracking-[0.08em] ${ehHoje ? "text-accent-soft" : "text-faint"}`}>{DIAS[d.getDay()]}</span>
                    <span className={`block text-[13px] tabular-nums ${ehHoje ? "text-accent-soft" : "text-ink"}`}>
                      {String(d.getDate()).padStart(2, "0")}/{String(d.getMonth() + 1).padStart(2, "0")}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {linhas.map((pessoa) => (
              <tr key={pessoa.id}>
                <th className="sticky left-0 z-10 border-b border-r border-fg/[0.07] bg-surface px-3 py-2 align-top">
                  <span className="flex items-center gap-1.5 text-[12.5px] font-normal text-ink">
                    <User size={12} className="shrink-0 text-muted" />
                    <span className="truncate">{pessoa.nome}</span>
                  </span>
                </th>

                {dias.map((d) => {
                  const diaIso = iso(d);
                  const chave = `${pessoa.id}|${diaIso}`;
                  const daCelula = grade.get(chave) ?? [];
                  const editandoAqui = editando === chave;
                  const ehHoje = diaIso === hojeIso;

                  return (
                    <td
                      key={diaIso}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (arrastando) void onMover(arrastando, pessoa.id === "sem" ? null : pessoa.id, diaIso);
                        setArrastando(null);
                      }}
                      onClick={() => {
                        if (!editandoAqui) {
                          setEditando(chave);
                          setTexto("");
                        }
                      }}
                      className={`group h-[62px] cursor-text border-b border-r border-fg/[0.05] p-1.5 align-top transition-colors hover:bg-fg/[0.03] ${ehHoje ? "bg-accent/[0.04]" : ""}`}
                    >
                      <div className="flex flex-col gap-1">
                        {daCelula.map((item) => (
                          <button
                            key={item.id}
                            draggable
                            onDragStart={(e) => {
                              e.stopPropagation();
                              setArrastando(item.id);
                            }}
                            onDragEnd={() => setArrastando(null)}
                            onClick={(e) => {
                              e.stopPropagation();
                              onAbrir(item);
                            }}
                            title={`${item.titulo}${item.etapa_nome ? ` · ${item.etapa_nome}` : ""}`}
                            className={`w-full cursor-grab truncate rounded border-l-[3px] bg-fg/[0.05] px-1.5 py-1 text-left text-[11.5px] text-ink transition-colors hover:bg-fg/[0.09] active:cursor-grabbing ${corDaEtapa(item)} ${arrastando === item.id ? "opacity-40" : ""}`}
                          >
                            {item.titulo}
                          </button>
                        ))}

                        {editandoAqui ? (
                          <input
                            autoFocus
                            value={texto}
                            onChange={(e) => setTexto(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onBlur={() => void salvarCelula(pessoa.id, diaIso)}
                            onKeyDown={(e) => {
                              /* Enter salva e segue; Esc desiste. É como se
                                 escreve em planilha, sem tirar a mão do teclado. */
                              if (e.key === "Enter") void salvarCelula(pessoa.id, diaIso);
                              if (e.key === "Escape") {
                                setEditando(null);
                                setTexto("");
                              }
                            }}
                            placeholder="Escreva e Enter"
                            className="w-full rounded border border-accent/60 bg-surface px-1.5 py-1 text-[11.5px] text-ink outline-none"
                          />
                        ) : (
                          daCelula.length === 0 && (
                            <span className="flex items-center justify-center py-1 text-faint opacity-0 transition-opacity group-hover:opacity-60">
                              <Plus size={13} />
                            </span>
                          )
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PlanilhaProducao;
