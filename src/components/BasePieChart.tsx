import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import {
  getPieChartOptions,
  type PieChartData,
  type PieChartOptions,
  type PieContext,
} from "@/lib/pieChartOptions";

const EMPTY_TEXT = "No hemos encontrado resultados";
const RAD = Math.PI / 180;

// Debajo de este porcentaje no se dibuja la etiqueta: se amontonan y no se lee ninguna.
const MIN_LABEL_PERCENT = 0.04;

const defaultOptions = getPieChartOptions<unknown>(
  (ctx) => `Valor: ${ctx.raw.value}\nPorcentaje: ${Math.round(ctx.percent * 100)}%`,
  (value, ctx) => `${ctx.label}: ${value} · ${Math.round(ctx.percent * 100)}%`,
);

type BasePieChartProps<T> = {
  data: PieChartData<T>;
  options?: PieChartOptions<T>;
  className?: string;
};

export function BasePieChart<T>({ data, options, className }: BasePieChartProps<T>) {
  const points = data?.datasets?.[0]?.data ?? [];
  const colors = data?.datasets?.[0]?.backgroundColor ?? [];
  const total = points.reduce((acc, p) => acc + (Number(p.value) || 0), 0);

  const container = cn(
    "w-full h-full rounded-xl border border-slate-100 dark:border-slate-800 bg-card p-4 shadow-sm",
    className,
  );

  if (!points.length || total <= 0) {
    return (
      <div className={cn(container, "flex items-center justify-center")}>
        <p className="text-sm text-muted-foreground">{EMPTY_TEXT}</p>
      </div>
    );
  }

  const opts = (options || defaultOptions) as PieChartOptions<T>;
  const { datalabels } = opts.plugins;
  const { padding } = opts.layout;

  const contextAt = (index: number): PieContext<T> => ({
    raw: points[index],
    dataIndex: index,
    label: points[index].label,
    percent: total ? points[index].value / total : 0,
    total,
    color: colors[index % colors.length],
  });

  // Etiqueta externa: caja redondeada + texto, centrada sobre el radio de la porción.
  // OJO: recharts cae al render por defecto (el número crudo) si esto devuelve null,
  // por eso las porciones chicas devuelven un <g /> vacío.
  const renderDataLabel = (props: {
    cx: number; cy: number; midAngle: number; outerRadius: number; index: number;
  }) => {
    const { cx, cy, midAngle, outerRadius, index } = props;
    const ctx = contextAt(index);
    const text = datalabels.formatter(points[index].value, ctx);
    if (!text || ctx.percent < MIN_LABEL_PERCENT) return <g />;

    const radius = outerRadius + datalabels.offset;
    const width = text.length * datalabels.fontSize * 0.58 + 12;
    const height = datalabels.fontSize + 10;

    // El SVG se deduce del centro y el padding (cx = padLeft + ancho útil / 2). La caja se
    // recorta contra ese borde: si no, las etiquetas de las porciones laterales quedan cortadas.
    const svgWidth = 2 * cx - padding.left + padding.right;
    const svgHeight = 2 * cy - padding.top + padding.bottom;
    const clamp = (v: number, size: number, limit: number) => Math.max(2, Math.min(v, limit - size - 2));
    const boxX = clamp(cx + radius * Math.cos(-midAngle * RAD) - width / 2, width, svgWidth);
    const boxY = clamp(cy + radius * Math.sin(-midAngle * RAD) - height / 2, height, svgHeight);
    const x = boxX + width / 2;
    const y = boxY + height / 2;

    return (
      <g>
        <rect
          x={boxX}
          y={boxY}
          width={width}
          height={height}
          rx={datalabels.borderRadius}
          fill={datalabels.backgroundColor}
          stroke={datalabels.borderColor}
          strokeWidth={datalabels.borderWidth}
        />
        <text
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={datalabels.fontSize}
          fontWeight={datalabels.fontWeight}
          fill={datalabels.color}
        >
          {text}
        </text>
      </g>
    );
  };

  const renderTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload?: { label?: string } }> }) => {
    const label = payload?.[0]?.payload?.label;
    if (!active || !label) return null;
    const index = points.findIndex((p) => p.label === label);
    if (index < 0) return null;
    const ctx = contextAt(index);

    return (
      <div className="rounded-md bg-slate-900/90 px-3 py-2 text-xs text-white shadow-lg">
        <p className="flex items-center gap-2 font-semibold">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ctx.color }} />
          {ctx.label}
        </p>
        {opts.plugins.tooltip.callbacks.afterLabel(ctx).split("\n").map((line, i) => (
          <p key={i} className="text-slate-200">{line}</p>
        ))}
      </div>
    );
  };

  return (
    <div className={container}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: padding.top, right: padding.right, bottom: padding.bottom, left: padding.left }}>
          <Pie
            data={points}
            dataKey="value"
            nameKey="label"
            outerRadius="100%"
            stroke="none"
            labelLine={false}
            label={renderDataLabel}
            isAnimationActive={false}
          >
            {points.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip content={renderTooltip} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

type PieLegendPanelProps<T> = {
  data: PieChartData<T>;
  /** Formatea el valor de cada ítem y el total (ej: dinero). */
  formatValue: (value: number) => string;
  title?: string;
  /** Subtexto con la cantidad de ítems, ej: (n) => `${n} conceptos`. */
  itemsLabel?: (count: number) => string;
  className?: string;
};

export function PieLegendPanel<T>({
  data,
  formatValue,
  title = "Total",
  itemsLabel = (n) => `${n} ${n === 1 ? "ítem" : "ítems"}`,
  className,
}: PieLegendPanelProps<T>) {
  const points = data?.datasets?.[0]?.data ?? [];
  const colors = data?.datasets?.[0]?.backgroundColor ?? [];
  const total = points.reduce((acc, p) => acc + (Number(p.value) || 0), 0);

  return (
    <div className={cn("flex flex-col min-h-0 rounded-xl border border-slate-100 dark:border-slate-800 bg-card", className)}>
      <div className="border-b border-slate-100 dark:border-slate-800 p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatValue(total)}</p>
        <p className="text-xs text-muted-foreground">{itemsLabel(points.length)}</p>
      </div>
      <ul className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {points.map((point, i) => (
          <li key={`${point.label}-${i}`} className="flex items-start gap-2">
            <span
              className="mt-1 h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: colors[i % colors.length] }}
            />
            <div className="min-w-0">
              <p className="truncate text-sm text-slate-900 dark:text-slate-100">{point.label}</p>
              <p className="text-xs text-muted-foreground">
                {formatValue(point.value)} · {total ? Math.round((point.value / total) * 100) : 0}%
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

type PieChartWithLegendProps<T> = BasePieChartProps<T> & Omit<PieLegendPanelProps<T>, "data" | "className">;

/** Grilla gráfico + panel de leyenda: apilada en mobile, lado a lado en pantallas anchas. */
export function PieChartWithLegend<T>({
  data,
  options,
  className,
  ...legendProps
}: PieChartWithLegendProps<T>) {
  return (
    <div className={cn("grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_260px] gap-4 xl:h-[500px]", className)}>
      <div className="h-[320px] xl:h-full min-w-0">
        <BasePieChart data={data} options={options} />
      </div>
      <PieLegendPanel data={data} className="h-[240px] xl:h-full" {...legendProps} />
    </div>
  );
}
