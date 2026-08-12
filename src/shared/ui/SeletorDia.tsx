import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { MESES_EXTENSO, diaExtenso } from "@/shared/utils/date";

/**
 * Escolher UM dia — a pergunta que a loja faz de verdade.
 *
 * O filtro anterior era "Hoje / Este mês", dois botões. Funciona para a
 * pergunta do balcão ("quanto vendi até agora?") e não responde a mais nenhuma:
 * conferir sábado passado, refazer o caixa de anteontem, achar a venda que o
 * cliente diz ter feito "na terça" — tudo isso exigia sair da tela.
 *
 * Aqui o dia é um valor, com três formas de mexer nele, cada uma para um uso:
 *   - as setas, para andar de um em um (é o gesto de conferir dia a dia);
 *   - o calendário, para pular para uma data distante;
 *   - "Hoje", para voltar ao normal sem precisar achar o dia certo no mês.
 *
 * A data aparece por extenso porque `11/08/2026` obriga a pessoa a traduzir —
 * e o que ela quer saber é se está olhando para uma terça ou para um sábado,
 * já que o movimento da loja é diferente nos dois.
 */

const DIAS_DA_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"] as const;

/** Meia-noite do dia — comparar datas com hora dentro nunca bate. */
const soODia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const mesmoDia = (a: Date, b: Date) =>
  a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();

const somarDias = (d: Date, n: number) => {
  const novo = new Date(d);
  novo.setDate(novo.getDate() + n);
  return novo;
};

type Props = {
  valor: Date;
  onChange: (dia: Date) => void;
  /** Último dia escolhível. Padrão: hoje — não se vende no futuro. */
  max?: Date;
};

const SeletorDia = ({ valor, onChange, max }: Props) => {
  const [aberto, setAberto] = useState(false);
  const [mesVisivel, setMesVisivel] = useState(() => soODia(valor));
  const caixa = useRef<HTMLDivElement>(null);

  const limite = soODia(max ?? new Date());
  const hoje = soODia(new Date());
  const selecionado = soODia(valor);

  /* Abrir o calendário mostra o mês do dia escolhido, e não onde a navegação
     do mês parou da última vez. */
  useEffect(() => {
    if (aberto) setMesVisivel(soODia(valor));
  }, [aberto, valor]);

  /* Fecha ao clicar fora ou no Esc: um popover que só fecha pelo próprio botão
     fica no caminho de tudo que estiver embaixo dele. */
  useEffect(() => {
    if (!aberto) return;

    const foraDaCaixa = (ev: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(ev.target as Node)) setAberto(false);
    };
    const noEsc = (ev: KeyboardEvent) => ev.key === "Escape" && setAberto(false);

    document.addEventListener("mousedown", foraDaCaixa);
    document.addEventListener("keydown", noEsc);

    return () => {
      document.removeEventListener("mousedown", foraDaCaixa);
      document.removeEventListener("keydown", noEsc);
    };
  }, [aberto]);

  /*
   * A grade do mês, com os vazios do começo.
   *
   * `getDay()` do dia 1 diz quantas casas pular para o mês cair na coluna
   * certa — sem isso, todo mês começaria no domingo e o calendário mentiria
   * sobre o dia da semana, que é justamente o que se quer saber aqui.
   */
  const grade = useMemo(() => {
    const ano = mesVisivel.getFullYear();
    const mes = mesVisivel.getMonth();

    const vazios = new Date(ano, mes, 1).getDay();
    const total = new Date(ano, mes + 1, 0).getDate();

    return [
      ...Array.from({ length: vazios }, () => null),
      ...Array.from({ length: total }, (_, i) => new Date(ano, mes, i + 1)),
    ];
  }, [mesVisivel]);

  const escolher = (dia: Date) => {
    onChange(dia);
    setAberto(false);
  };

  const podeAvancar = selecionado < limite;

  const seta = "focus-ring flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-mist transition-colors hover:bg-fg/[0.06] hover:text-ink disabled:cursor-not-allowed disabled:opacity-30";

  return (
    <div ref={caixa} className="relative flex items-center gap-0.5 rounded-xl border border-fg/[0.08] bg-fg/[0.03] p-1">
      <button type="button" aria-label="Dia anterior" className={seta} onClick={() => onChange(somarDias(selecionado, -1))}>
        <ChevronLeft className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        className="focus-ring flex min-w-[186px] cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-[12.5px] text-ink transition-colors hover:bg-fg/[0.06]"
      >
        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-accent-soft" />
        <span className="truncate first-letter:uppercase">{diaExtenso(selecionado)}</span>
      </button>

      <button type="button" aria-label="Próximo dia" className={seta} disabled={!podeAvancar} onClick={() => onChange(somarDias(selecionado, 1))}>
        <ChevronRight className="h-4 w-4" />
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-label="Escolher dia"
          /* `right-0`: o seletor mora à direita do cabeçalho da tabela, e um
             popover ancorado à esquerda sairia da tela em 1280px. */
          className="absolute right-0 top-[calc(100%+8px)] z-30 w-[276px] rounded-2xl border border-fg/[0.1] bg-surface p-3 shadow-e3"
        >
          <div className="mb-2 flex items-center justify-between">
            <button type="button" aria-label="Mês anterior" className={seta} onClick={() => setMesVisivel((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </button>

            <span className="text-[12.5px] text-ink first-letter:uppercase">
              {MESES_EXTENSO[mesVisivel.getMonth()]} de {mesVisivel.getFullYear()}
            </span>

            <button
              type="button"
              aria-label="Próximo mês"
              className={seta}
              disabled={new Date(mesVisivel.getFullYear(), mesVisivel.getMonth(), 1) >= new Date(limite.getFullYear(), limite.getMonth(), 1)}
              onClick={() => setMesVisivel((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1">
            {DIAS_DA_SEMANA.map((d, i) => (
              <span key={`${d}-${i}`} className="text-center text-[10px] uppercase tracking-wider text-faint">
                {d}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {grade.map((dia, i) =>
              dia === null ? (
                <span key={`vazio-${i}`} />
              ) : (
                <button
                  key={dia.toISOString()}
                  type="button"
                  disabled={dia > limite}
                  onClick={() => escolher(dia)}
                  aria-current={mesmoDia(dia, selecionado) ? "date" : undefined}
                  className={`focus-ring flex h-8 cursor-pointer items-center justify-center rounded-lg text-[12px] tabular-nums transition-colors disabled:cursor-not-allowed disabled:text-faint/40 disabled:hover:bg-transparent ${
                    mesmoDia(dia, selecionado)
                      ? "bg-accent text-white shadow-glow"
                      : mesmoDia(dia, hoje)
                        ? "text-accent-soft ring-1 ring-inset ring-accent/40 hover:bg-fg/[0.06]"
                        : "text-mist hover:bg-fg/[0.06] hover:text-ink"
                  }`}
                >
                  {dia.getDate()}
                </button>
              ),
            )}
          </div>

          {/* O caminho de volta ao normal. Sem ele, quem foi conferir março
              precisa navegar de volta mês a mês para voltar a operar. */}
          <button
            type="button"
            onClick={() => escolher(hoje)}
            disabled={mesmoDia(selecionado, hoje)}
            className="focus-ring mt-3 w-full cursor-pointer rounded-lg border border-fg/[0.08] py-1.5 text-[12px] text-mist transition-colors hover:bg-fg/[0.05] hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            Voltar para hoje
          </button>
        </div>
      )}
    </div>
  );
};

export default SeletorDia;
