// Paleta de los eventos especiales de clase (días sin lista).
// El color lo asigna el back automáticamente al crear el evento (elige el menos usado del
// departamento en el año). Acá solo se resuelve la key a un color concreto para la UI y el PDF.
// Debe coincidir con EVENT_COLORS en ccdt-back/src/controllers/attendanceController.js.

export interface EventColor {
  key: string;
  hex: string;
  /** Fondo suave para pintar la columna en la grilla del PDF */
  rgb: [number, number, number];
  /** Color del texto sobre ese fondo */
  textRgb: [number, number, number];
}

export const EVENT_COLORS: EventColor[] = [
  { key: 'amber', hex: '#f59e0b', rgb: [254, 240, 199], textRgb: [146, 84, 4] },
  { key: 'sky', hex: '#0ea5e9', rgb: [219, 238, 253], textRgb: [7, 89, 133] },
  { key: 'violet', hex: '#8b5cf6', rgb: [233, 226, 254], textRgb: [91, 33, 182] },
  { key: 'rose', hex: '#f43f5e', rgb: [255, 225, 231], textRgb: [159, 18, 57] },
  { key: 'teal', hex: '#14b8a6', rgb: [204, 245, 240], textRgb: [17, 94, 89] },
  { key: 'lime', hex: '#84cc16', rgb: [231, 247, 200], textRgb: [63, 98, 18] },
];

const FALLBACK = EVENT_COLORS[0];

export const getEventColor = (key?: string | null): EventColor =>
  EVENT_COLORS.find(c => c.key === key) || FALLBACK;
