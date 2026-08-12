import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import CustomerType from "@/shared/domain/cliente";
import { MONTHS, toDate } from "@/shared/utils/date";
import { useChartColors } from "@/shared/theme/useChartColors";

interface ClientesGrowthChartProps {
  customers: CustomerType[];
}

const ClientesGrowthChart = ({ customers }: ClientesGrowthChartProps) => {
  const C = useChartColors();

  const growth = useMemo(() => {
    const year = new Date().getFullYear();
    const base = MONTHS.map((name) => ({ name, clientes: 0 }));
    customers.forEach((c) => {
      if (!c.created_at) return;
      const d = toDate(c.created_at);
      if (d && d.getFullYear() === year) base[d.getMonth()].clientes += 1;
    });
    return base;
  }, [customers]);

  return (
    <div className="card glass-sheen flex flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-fg/[0.07] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-accent/[0.15] p-2 ring-1 ring-inset ring-accent/20">
            <TrendingUp className="h-4 w-4 text-accent-soft" />
          </div>
          <h2 className="text-[13px] text-ink">Crescimento mensal</h2>
        </div>
      </div>

      <div className="min-h-[160px] flex-1 p-3">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={growth}>
            <defs>
              <linearGradient id="gClientes" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.accent} stopOpacity={0.25} />
                <stop offset="95%" stopColor={C.accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: C.tick }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: C.tick }} axisLine={false} tickLine={false} allowDecimals={false} width={26} />
            <Tooltip
              cursor={{ stroke: C.grid }}
              contentStyle={{
                background: C.surface,
                border: `1px solid ${C.grid}`,
                borderRadius: 12,
                fontSize: 12,
                boxShadow: "var(--shadow-2)",
              }}
              labelStyle={{ color: C.ink }}
              itemStyle={{ color: C.mist }}
            />
            <Area type="monotone" dataKey="clientes" stroke={C.accent} strokeWidth={2} fill="url(#gClientes)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ClientesGrowthChart;
