import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, X } from "lucide-react";
import { getDailyVerse } from "@/lib/api";
import { dismissDailyVerse, useDailyVerseDismissed } from "@/hooks/useDailyVerseDismissed";

export const DailyVerse = () => {
  const { data: verse } = useQuery({
    queryKey: ["daily-verse"],
    queryFn: getDailyVerse,
    staleTime: 1000 * 60 * 60,
    retry: false,
  });

  const [expanded, setExpanded] = useState(false);
  const dismissed = useDailyVerseDismissed();

  // Sin versículo (deshabilitado o error de red) no renderizamos nada: un skeleton acá
  // empujaría las cards del home hacia abajo por un widget que quizás nunca llega.
  // Cerrado por hoy tampoco: el versículo sigue accesible desde el ícono del navbar.
  if (dismissed || !verse?.text) return null;

  return (
    <div className="group relative overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm transition-shadow duration-300 hover:shadow-md animate-in fade-in slide-in-from-top-2 dark:border-slate-700 dark:bg-slate-800">
      {/* Acento lateral + halo: mismo lenguaje visual que las secciones del home */}
      <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-purple-500 to-indigo-500" />
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />

      <div className="relative flex items-start gap-3 py-4 pl-5 pr-3 sm:gap-4 sm:pl-6 sm:pr-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            {/* En móvil el eyebrow le roba el ancho a la referencia y la trunca,
                así que solo aparece desde sm. */}
            <span className="hidden shrink-0 text-[10px] font-semibold uppercase tracking-wider text-primary sm:inline">
              Versículo del día
            </span>
            <span className="truncate text-xs text-slate-400 dark:text-slate-500">
              {verse.reference} · {verse.version}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="mt-1.5 block w-full text-left"
          >
            <p
              className={`font-serif text-[15px] italic leading-relaxed text-slate-700 dark:text-slate-200 ${expanded ? "" : "line-clamp-2"
                }`}
            >
              “{verse.text}”
            </p>
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-0.5 text-slate-300 dark:text-slate-600">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Contraer versículo" : "Expandir versículo"}
            className="rounded-full p-1 transition-colors hover:bg-slate-100 hover:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
            />
          </button>
          <button
            type="button"
            onClick={dismissDailyVerse}
            aria-label="Ocultar versículo del día"
            className="rounded-full p-1 transition-colors hover:bg-slate-100 hover:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
