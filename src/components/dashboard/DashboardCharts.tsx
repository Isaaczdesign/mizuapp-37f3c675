import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ChartTooltip } from "@/components/dashboard/ui";

export function RevenueChart({ data, formatter }: { data: { date: string; revenue: number }[]; formatter: (v: number) => string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ left: -12, right: 8, top: 6, bottom: 0 }}>
        <defs>
          <linearGradient id="revLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="100%" stopColor="hsl(var(--accent))" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 6" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
        <YAxis tickLine={false} axisLine={false} width={54} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
        <Tooltip cursor={{ stroke: "hsl(var(--accent))", strokeOpacity: 0.25 }} content={<ChartTooltip formatter={formatter} />} />
        <Line type="monotone" dataKey="revenue" stroke="url(#revLine)" strokeWidth={2.5} dot={false}
          activeDot={{ r: 4, fill: "hsl(var(--accent))" }} animationDuration={700} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function PeakHoursChart({ data }: { data: { hour: string; pedidos: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ left: -18, right: 8, top: 6, bottom: 0 }}>
        <defs>
          <linearGradient id="peakBar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--accent))" />
            <stop offset="100%" stopColor="hsl(var(--primary))" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 6" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="hour" tickLine={false} axisLine={false} interval={2} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
        <Tooltip cursor={{ fill: "hsl(var(--accent)/0.06)" }} content={<ChartTooltip />} />
        <Bar dataKey="pedidos" fill="url(#peakBar)" radius={[6, 6, 2, 2]} animationDuration={700} />
      </BarChart>
    </ResponsiveContainer>
  );
}
