import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

/**
 * Estilo do balão de valores dos gráficos — recharts não herda CSS do tema.
 *
 * Compartilhado entre os gráficos do sistema: sem isto a caixa sairia branca
 * sobre fundo escuro em cinco dos sete temas.
 */
export const BALAO = {
  background: "rgb(var(--surface-raised))",
  border: "1px solid rgb(var(--fg) / 0.08)",
  borderRadius: 12,
  fontSize: 11.5,
  boxShadow: "var(--shadow-2)",
} as const;

/* Categorias: cada fatia é uma forma diferente, então precisa de matiz
   própria. A ordem é fixa — a maior fatia sempre pega a cor de destaque, e
   trocar de mês não repinta o que sobreviveu. */
export const PALETA_FORMAS = ["rgb(var(--accent))", "rgb(var(--success))", "rgb(var(--warning))", "rgb(var(--danger))", "rgb(var(--accent) / 0.45)", "rgb(var(--fg) / 0.3)"];

export type Fatia = { nome: string; valor: number };

/**
 * Rosca de distribuição, com o total no miolo.
 *
 * A legenda ao lado traz nome e valor de cada fatia: quem não distingue as
 * cores — daltonismo, monitor ruim, impressão em cinza — continua lendo o
 * gráfico inteiro pela legenda. Cor aqui é atalho, nunca o único caminho.
 */
export function Rosca({ fatias, formatar, rotuloCentro = "recebido", tamanho = 168 }: { fatias: Fatia[]; formatar: (v: number) => string; rotuloCentro?: string; tamanho?: number }) {
  const total = fatias.reduce((acc, f) => acc + Number(f.valor ?? 0), 0);

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-3">
      <div className="relative shrink-0" style={{ width: tamanho, height: tamanho }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={fatias}
              dataKey="valor"
              nameKey="nome"
              innerRadius={tamanho * 0.31}
              outerRadius={tamanho * 0.46}
              paddingAngle={2}
              /* O anel de fundo separa fatias vizinhas de cor parecida sem
                 precisar de uma linha divisória visível. */
              stroke="rgb(var(--surface))"
              strokeWidth={2}
              animationDuration={750}
              animationEasing="ease-out"
            >
              {fatias.map((f, i) => (
                <Cell key={f.nome} fill={PALETA_FORMAS[i % PALETA_FORMAS.length]} />
              ))}
            </Pie>

            <Tooltip contentStyle={BALAO} itemStyle={{ padding: 0 }} formatter={(v) => formatar(Number(v ?? 0))} />
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] uppercase tracking-[0.1em] text-faint">{rotuloCentro}</span>
          <span className="nums mt-0.5 max-w-[92px] truncate text-[13px] text-ink">{formatar(total)}</span>
        </div>
      </div>

      <ul className="min-w-[130px] flex-1 flex-col gap-1.5">
        {fatias.map((f, i) => (
          <li key={f.nome} className="flex items-center gap-2 py-1 text-[11.5px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: PALETA_FORMAS[i % PALETA_FORMAS.length] }} />
            <span className="min-w-0 flex-1 truncate text-mist">{f.nome}</span>
            <span className="nums shrink-0 text-ink">{formatar(f.valor)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
