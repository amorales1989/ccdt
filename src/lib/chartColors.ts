// Paleta compartida por los gráficos de Contabilidad (pantalla y PDF), para que un motivo
// tenga el mismo color en los dos lados. Primarios (azul, amarillo, rojo) y secundarios
// (verde, naranja, violeta), alternados para que dos motivos contiguos no queden parecidos.
export const CHART_COLORS = ["#1d4ed8", "#facc15", "#dc2626", "#16a34a", "#f97316", "#7c3aed"];

export const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};
