import { useMemo } from "react";
import { CalendarDays } from "lucide-react";

/**
 * Filtro de período do financeiro.
 *
 * Quatro atalhos e um intervalo livre. Os atalhos cobrem o que se pergunta
 * todo dia ("quanto entrou hoje?", "e no mês?"); o intervalo existe para o
 * que não cabe em atalho — a semana do feriado, o trimestre do contador.
 *
 * O ano é uma lista dos anos em que a empresa teve movimento, não um campo
 * numérico: ninguém quer digitar 2026, e oferecer 1998 é oferecer uma tela
 * vazia.
 */
export type Granularidade = "dia" | "mes" | "ano" | "livre";

export type Periodo = {
  granularidade: Granularidade;
  /** ISO `AAAA-MM-DD`. Início e fim são inclusivos. */
  de: string;
  ate: string;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Período inicial: o mês corrente, que é o que a maioria abre para ver. */
export const periodoPadrao = (): Periodo => {
  const hoje = new Date();
  return {
    granularidade: "mes",
    de: iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)),
    ate: iso(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)),
  };
};

export const doDia = (d = new Date()): Periodo => ({ granularidade: "dia", de: iso(d), ate: iso(d) });

export const doMes = (ano: number, mes: number): Periodo => ({
  granularidade: "mes",
  de: iso(new Date(ano, mes, 1)),
  ate: iso(new Date(ano, mes + 1, 0)),
});

export const doAno = (ano: number): Periodo => ({
  granularidade: "ano",
  de: `${ano}-01-01`,
  ate: `${ano}-12-31`,
});

/** `true` se a data ISO cai dentro do período (comparação de string basta em ISO). */
export const dentroDoPeriodo = (dataIso: string | null | undefined, p: Periodo) => {
  if (!dataIso) return false;
  const d = String(dataIso).slice(0, 10);
  return d >= p.de && d <= p.ate;
};

const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const brDia = (isoStr: string) => {
  const [a, m, d] = isoStr.split("-");
  return `${d}/${m}/${a}`;
};

/** Frase curta que descreve o período — vira o subtítulo dos totais. */
export const rotuloPeriodo = (p: Periodo): string => {
  if (p.granularidade === "dia") {
    return p.de === iso(new Date()) ? "Hoje" : brDia(p.de);
  }

  if (p.granularidade === "mes") {
    const [ano, mes] = p.de.split("-");
    return `${MESES_CURTOS[Number(mes) - 1]} de ${ano}`;
  }

  if (p.granularidade === "ano") return p.de.slice(0, 4);

  return `${brDia(p.de)} a ${brDia(p.ate)}`;
};

type Props = {
  valor: Periodo;
  onChange: (p: Periodo) => void;
  /**
   * Datas ISO de tudo que existe (vendas e caixa).
   *
   * Servem para montar as listas de mês e ano com o que a empresa realmente
   * tem — um seletor com meses vazios faz a pessoa achar que perdeu dado.
   */
  datas: string[];
};

const FiltroPeriodo = ({ valor, onChange, datas }: Props) => {

  /* Meses e anos com movimento, do mais recente para o mais antigo. */
  const { meses, anos } = useMemo(() => {
    const setMeses = new Set<string>();
    const setAnos = new Set<string>();

    for (const d of datas) {
      if (!d) continue;
      const iso10 = String(d).slice(0, 10);
      setMeses.add(iso10.slice(0, 7));
      setAnos.add(iso10.slice(0, 4));
    }

    /* O mês corrente entra mesmo sem movimento: abrir o financeiro num mês
       ainda sem venda não pode deixar o seletor sem a opção de hoje. */
    const agora = new Date();
    setMeses.add(iso(agora).slice(0, 7));
    setAnos.add(String(agora.getFullYear()));

    return {
      meses: [...setMeses].sort().reverse(),
      anos: [...setAnos].sort().reverse(),
    };
  }, [datas]);

  const btn = (ativo: boolean) =>
    `focus-ring rounded-lg px-3 py-1.5 text-[12px] transition-colors ${
      ativo ? "bg-accent text-white" : "text-mist hover:text-ink"
    }`;

  const campo = "focus-ring rounded-lg border border-fg/[0.1] bg-fg/[0.03] px-2.5 py-1.5 text-[12px] text-ink outline-none transition-colors focus:border-accent/60";

  const hoje = new Date();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Atalhos */}
      <div className="flex gap-0.5 rounded-xl bg-fg/[0.04] p-0.5">
        <button type="button" className={btn(valor.granularidade === "dia")} onClick={() => onChange(doDia())}>
          Dia
        </button>
        <button type="button" className={btn(valor.granularidade === "mes")} onClick={() => onChange(doMes(hoje.getFullYear(), hoje.getMonth()))}>
          Mês
        </button>
        <button type="button" className={btn(valor.granularidade === "ano")} onClick={() => onChange(doAno(hoje.getFullYear()))}>
          Ano
        </button>
        <button
          type="button"
          className={btn(valor.granularidade === "livre")}
          onClick={() => onChange({ ...valor, granularidade: "livre" })}
        >
          Período
        </button>
      </div>

      {/* O controle secundário muda conforme o atalho — em vez de mostrar os
          quatro sempre e deixar três sem função. */}
      {valor.granularidade === "dia" && (
        <input type="date" className={campo} value={valor.de} max={iso(hoje)} onChange={(e) => e.target.value && onChange(doDia(new Date(`${e.target.value}T12:00:00`)))} />
      )}

      {valor.granularidade === "mes" && (
        <select
          className={campo}
          value={valor.de.slice(0, 7)}
          onChange={(e) => {
            const [a, m] = e.target.value.split("-");
            onChange(doMes(Number(a), Number(m) - 1));
          }}
        >
          {meses.map((m) => {
            const [a, mm] = m.split("-");
            return (
              <option key={m} value={m}>
                {MESES_CURTOS[Number(mm) - 1]} de {a}
              </option>
            );
          })}
        </select>
      )}

      {valor.granularidade === "ano" && (
        <select className={campo} value={valor.de.slice(0, 4)} onChange={(e) => onChange(doAno(Number(e.target.value)))}>
          {anos.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      )}

      {valor.granularidade === "livre" && (
        <span className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-faint">
          <CalendarDays size={13} className="text-muted" />
          <input
            type="date"
            className={campo}
            value={valor.de}
            max={valor.ate}
            onChange={(e) => e.target.value && onChange({ ...valor, granularidade: "livre", de: e.target.value })}
          />
          até
          <input
            type="date"
            className={campo}
            value={valor.ate}
            min={valor.de}
            onChange={(e) => e.target.value && onChange({ ...valor, granularidade: "livre", ate: e.target.value })}
          />
        </span>
      )}
    </div>
  );
};

export default FiltroPeriodo;
