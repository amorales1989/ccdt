// Opciones y armado de datos para <BasePieChart />.
// Espeja la API que usamos con chart.js + chartjs-plugin-datalabels en la app Vue, pero
// implementada sobre recharts, que es la librería de gráficos que ya usa este proyecto.

// Cada punto del dataset no es un número suelto: lleva el registro original pegado, así el
// tooltip y las etiquetas muestran datos extra sin salir a buscarlos a otro lado.
export type PiePoint<T = unknown> = {
  value: number;
  label: string;
  fullRow: T;
};

export type PieChartData<T = unknown> = {
  labels: string[];
  datasets: { data: PiePoint<T>[]; backgroundColor: string[] }[];
};

export type PieContext<T = unknown> = {
  raw: PiePoint<T>;
  dataIndex: number;
  label: string;
  /** 0..1 */
  percent: number;
  total: number;
  color: string;
};

export type PieDataLabelOptions<T = unknown> = {
  color: string;
  offset: number;
  borderWidth: number;
  borderColor: string;
  borderRadius: number;
  backgroundColor: string;
  fontSize: number;
  fontWeight: string | number;
  formatter: (value: number, context: PieContext<T>) => string | null;
};

export type PieLayoutOptions = {
  padding: { top: number; bottom: number; left: number; right: number };
};

export type PieChartOptions<T = unknown> = {
  responsive: boolean;
  maintainAspectRatio: boolean;
  plugins: {
    legend: { display: boolean };
    tooltip: {
      callbacks: {
        label: () => string;
        afterLabel: (context: PieContext<T>) => string;
      };
    };
    datalabels: PieDataLabelOptions<T>;
  };
  layout: PieLayoutOptions;
};

export function getPieChartOptions<T = unknown>(
  afterLabelFn: (context: PieContext<T>) => string,
  formatterFn: (value: number, context: PieContext<T>) => string | null,
  dataLabelOpts: Partial<PieDataLabelOptions<T>> = {},
  layoutOpts: Partial<PieLayoutOptions> = {},
): PieChartOptions<T> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      // La leyenda se arma aparte en HTML (<PieLegendPanel />).
      legend: { display: false },
      tooltip: {
        callbacks: {
          // El tooltip muestra solo el texto propio multilínea de afterLabel.
          label: () => "",
          afterLabel: afterLabelFn,
        },
      },
      datalabels: {
        color: "#606060",
        offset: 12,
        borderWidth: 1,
        borderColor: "#EEEEEE",
        borderRadius: 5,
        backgroundColor: "#F5F5F5",
        fontSize: 11,
        fontWeight: "normal",
        formatter: formatterFn,
        ...dataLabelOpts,
      },
    },
    // Padding generoso para que las etiquetas externas no se corten.
    layout: {
      padding: { top: 50, bottom: 50, left: 50, right: 50 },
      ...layoutOpts,
    },
  };
}

type BuildPieDataOptions<T> = {
  getValue: (row: T) => number;
  getLabel: (row: T) => string;
  colors: string[];
  /** Más categorías que esto se agrupan en una porción "Otros". */
  maxSlices?: number;
  otherLabel?: string;
  /** Fila sintética para "Otros". Por defecto queda la primera de las agrupadas. */
  mergeOthers?: (rows: T[]) => T;
};

/** Ordena por valor descendente y agrupa la cola en "Otros" si hay más de `maxSlices`. */
export function buildPieData<T>(rows: T[], opts: BuildPieDataOptions<T>): PieChartData<T> {
  const { getValue, getLabel, colors, maxSlices = 10, otherLabel = "Otros", mergeOthers } = opts;

  const sorted = [...rows].sort((a, b) => getValue(b) - getValue(a));
  const top = sorted.slice(0, maxSlices);
  const rest = sorted.slice(maxSlices);

  const points: PiePoint<T>[] = top.map((row) => ({
    value: getValue(row),
    label: getLabel(row),
    fullRow: row,
  }));

  if (rest.length) {
    points.push({
      value: rest.reduce((acc, row) => acc + getValue(row), 0),
      label: otherLabel,
      fullRow: mergeOthers ? mergeOthers(rest) : rest[0],
    });
  }

  return {
    labels: points.map((p) => p.label),
    datasets: [
      {
        data: points,
        backgroundColor: points.map((_, i) => colors[i % colors.length]),
      },
    ],
  };
}
