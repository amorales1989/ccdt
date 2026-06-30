import { useEffect, useMemo, useState } from "react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { BIBLE_BOOKS, buildReference, parseReference } from "@/lib/bibleBooks";

interface BibleReferencePickerProps {
  value?: string;
  onChange: (value: string) => void;
}

export function BibleReferencePicker({ value, onChange }: BibleReferencePickerProps) {
  const { book, chapter, verseFrom: pVerseFrom, verseTo: pVerseTo } = useMemo(() => parseReference(value), [value]);

  // Los versículos se guardan en estado local: el string canónico (buildReference) es
  // "lossy" mid-tipeo (descarta "hasta" cuando es igual a "desde"), así que no podemos
  // derivar el valor del input de él o se pierden dígitos al escribir.
  const [verseFrom, setVerseFrom] = useState(pVerseFrom);
  const [verseTo, setVerseTo] = useState(pVerseTo);

  // Re-sincronizar solo cuando cambia la referencia externa (libro/capítulo): carga de un
  // registro existente o reset del borrador. No depende de los versículos para no pisar el tipeo.
  useEffect(() => {
    setVerseFrom(pVerseFrom);
    setVerseTo(pVerseTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book, chapter]);

  const selectedBook = BIBLE_BOOKS.find((b) => b.name === book);
  const chapterCount = selectedBook?.chapters || 0;

  const emit = (next: Partial<{ book: string; chapter: string; verseFrom: string; verseTo: string }>) => {
    const b = next.book ?? book;
    const c = next.chapter ?? chapter;
    const vf = next.verseFrom ?? verseFrom;
    const vt = next.verseTo ?? verseTo;
    onChange(buildReference(b, c, vf, vt));
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
      {/* Libro */}
      <Select
        value={book || undefined}
        onValueChange={(b) => { setVerseFrom(""); setVerseTo(""); emit({ book: b, chapter: "", verseFrom: "", verseTo: "" }); }}
      >
        <SelectTrigger className="col-span-2 h-9 text-sm">
          <SelectValue placeholder="Libro" />
        </SelectTrigger>
        <SelectContent className="max-h-64">
          {BIBLE_BOOKS.map((b) => (
            <SelectItem key={b.name} value={b.name}>{b.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Capítulo */}
      <Select
        value={chapter || undefined}
        onValueChange={(c) => { setVerseFrom(""); setVerseTo(""); emit({ chapter: c, verseFrom: "", verseTo: "" }); }}
        disabled={!selectedBook}
      >
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder="Cap." />
        </SelectTrigger>
        <SelectContent className="max-h-64">
          {Array.from({ length: chapterCount }, (_, i) => String(i + 1)).map((c) => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Versículo desde */}
      <Input
        type="number"
        min={1}
        placeholder="Vers."
        className="h-9 text-sm"
        value={verseFrom}
        disabled={!chapter}
        onChange={(e) => {
          const vf = e.target.value;
          const clearTo = verseTo && vf && Number(verseTo) < Number(vf);
          setVerseFrom(vf);
          if (clearTo) setVerseTo("");
          emit({ verseFrom: vf, ...(clearTo ? { verseTo: "" } : {}) });
        }}
      />

      {/* Versículo hasta (opcional, debe ser mayor que "desde") */}
      <Input
        type="number"
        min={verseFrom ? Number(verseFrom) + 1 : 1}
        placeholder="hasta"
        className="h-9 text-sm"
        value={verseTo}
        disabled={!verseFrom}
        onChange={(e) => { setVerseTo(e.target.value); emit({ verseTo: e.target.value }); }}
        onBlur={(e) => {
          if (e.target.value && verseFrom && Number(e.target.value) <= Number(verseFrom)) {
            const fixed = String(Number(verseFrom) + 1);
            setVerseTo(fixed);
            emit({ verseTo: fixed });
          }
        }}
      />
    </div>
  );
}
