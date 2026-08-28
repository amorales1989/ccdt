// Paleta compartida por los gráficos de Contabilidad (pantalla y PDF), para que un motivo
// tenga el mismo color en los dos lados. Alcanza para las 10 porciones + "Otros" del tope
// de categorías, y está ordenada para que dos motivos contiguos no queden parecidos.
export const CHART_COLORS = [
  "#296DC3", // azul
  "#E91E63", // rosa/fucsia
  "#8BC34A", // verde lima
  "#FF9800", // naranja
  "#FFC107", // ámbar
  "#FF5722", // naranja rojizo
  "#AB47BC", // violeta
  "#26A69A", // teal
  "#EF5350", // rojo
  "#8D6E63", // marrón
  "#607D8B", // gris azulado
];

export const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};
