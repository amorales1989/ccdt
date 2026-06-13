// Libros de la Biblia (canon protestante) con su cantidad de capítulos.
// Usado por BibleReferencePicker para armar referencias tipo "Lucas 15:11-32".
export interface BibleBook {
  name: string;
  chapters: number;
}

export const BIBLE_BOOKS: BibleBook[] = [
  // Antiguo Testamento
  { name: "Génesis", chapters: 50 },
  { name: "Éxodo", chapters: 40 },
  { name: "Levítico", chapters: 27 },
  { name: "Números", chapters: 36 },
  { name: "Deuteronomio", chapters: 34 },
  { name: "Josué", chapters: 24 },
  { name: "Jueces", chapters: 21 },
  { name: "Rut", chapters: 4 },
  { name: "1 Samuel", chapters: 31 },
  { name: "2 Samuel", chapters: 24 },
  { name: "1 Reyes", chapters: 22 },
  { name: "2 Reyes", chapters: 25 },
  { name: "1 Crónicas", chapters: 29 },
  { name: "2 Crónicas", chapters: 36 },
  { name: "Esdras", chapters: 10 },
  { name: "Nehemías", chapters: 13 },
  { name: "Ester", chapters: 10 },
  { name: "Job", chapters: 42 },
  { name: "Salmos", chapters: 150 },
  { name: "Proverbios", chapters: 31 },
  { name: "Eclesiastés", chapters: 12 },
  { name: "Cantares", chapters: 8 },
  { name: "Isaías", chapters: 66 },
  { name: "Jeremías", chapters: 52 },
  { name: "Lamentaciones", chapters: 5 },
  { name: "Ezequiel", chapters: 48 },
  { name: "Daniel", chapters: 12 },
  { name: "Oseas", chapters: 14 },
  { name: "Joel", chapters: 3 },
  { name: "Amós", chapters: 9 },
  { name: "Abdías", chapters: 1 },
  { name: "Jonás", chapters: 4 },
  { name: "Miqueas", chapters: 7 },
  { name: "Nahúm", chapters: 3 },
  { name: "Habacuc", chapters: 3 },
  { name: "Sofonías", chapters: 3 },
  { name: "Hageo", chapters: 2 },
  { name: "Zacarías", chapters: 14 },
  { name: "Malaquías", chapters: 4 },
  // Nuevo Testamento
  { name: "Mateo", chapters: 28 },
  { name: "Marcos", chapters: 16 },
  { name: "Lucas", chapters: 24 },
  { name: "Juan", chapters: 21 },
  { name: "Hechos", chapters: 28 },
  { name: "Romanos", chapters: 16 },
  { name: "1 Corintios", chapters: 16 },
  { name: "2 Corintios", chapters: 13 },
  { name: "Gálatas", chapters: 6 },
  { name: "Efesios", chapters: 6 },
  { name: "Filipenses", chapters: 4 },
  { name: "Colosenses", chapters: 4 },
  { name: "1 Tesalonicenses", chapters: 5 },
  { name: "2 Tesalonicenses", chapters: 3 },
  { name: "1 Timoteo", chapters: 6 },
  { name: "2 Timoteo", chapters: 4 },
  { name: "Tito", chapters: 3 },
  { name: "Filemón", chapters: 1 },
  { name: "Hebreos", chapters: 13 },
  { name: "Santiago", chapters: 5 },
  { name: "1 Pedro", chapters: 5 },
  { name: "2 Pedro", chapters: 3 },
  { name: "1 Juan", chapters: 5 },
  { name: "2 Juan", chapters: 1 },
  { name: "3 Juan", chapters: 1 },
  { name: "Judas", chapters: 1 },
  { name: "Apocalipsis", chapters: 22 },
];

// Arma la referencia: "Lucas 15:11-32" | "Lucas 19:10" | "Salmos 23"
export function buildReference(book?: string, chapter?: string, verseFrom?: string, verseTo?: string): string {
  if (!book) return "";
  if (!chapter) return book;
  let ref = `${book} ${chapter}`;
  if (verseFrom) {
    ref += `:${verseFrom}`;
    if (verseTo && verseTo !== verseFrom) ref += `-${verseTo}`;
  }
  return ref;
}

// Parsea "1 Corintios 13:4-7" -> { book, chapter, verseFrom, verseTo }
export function parseReference(value?: string): {
  book: string; chapter: string; verseFrom: string; verseTo: string;
} {
  const empty = { book: "", chapter: "", verseFrom: "", verseTo: "" };
  if (!value) return empty;
  const m = value.trim().match(/^(.+?)(?:\s+(\d+)(?::(\d+)(?:\s*-\s*(\d+))?)?)?$/);
  if (!m) return empty;
  return {
    book: m[1] || "",
    chapter: m[2] || "",
    verseFrom: m[3] || "",
    verseTo: m[4] || "",
  };
}
