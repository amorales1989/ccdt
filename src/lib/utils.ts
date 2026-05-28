import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Normaliza nombres y apellidos: trim, espacios simples, primera letra de cada palabra en mayúscula
export function normalizeName(value?: string | null): string {
  if (!value) return '';
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(w => {
      if (!w) return w;
      // preserva partículas y apellidos compuestos con guión/apóstrofe
      return w.split(/(['-])/).map(part => {
        if (part === "'" || part === '-') return part;
        return part.charAt(0).toLocaleUpperCase('es') + part.slice(1).toLocaleLowerCase('es');
      }).join('');
    })
    .join(' ');
}
