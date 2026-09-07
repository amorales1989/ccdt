import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CustomTooltip } from "@/components/CustomTooltip";
import { getDailyVerse } from "@/lib/api";
import { restoreDailyVerse, useDailyVerseDismissed } from "@/hooks/useDailyVerseDismissed";

// Aparece solo cuando la card del home fue cerrada con la X: es la forma de volver
// a leer el versículo. Comparte la query con la card, así que no pide dos veces.
export const DailyVerseButton = () => {
  const dismissed = useDailyVerseDismissed();
  const { data: verse } = useQuery({
    queryKey: ["daily-verse"],
    queryFn: getDailyVerse,
    staleTime: 1000 * 60 * 60,
    retry: false,
  });

  if (!dismissed || !verse?.text) return null;

  return (
    <Popover>
      <CustomTooltip title="Versículo del día">
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Versículo del día"
            className="h-9 w-9 rounded-xl text-slate-500 hover:text-primary hover:bg-purple-50 dark:hover:bg-purple-900/20"
          >
            {/* PNG monocromo enmascarado: toma currentColor, así respeta el hover
                y el tema oscuro igual que los íconos lucide del navbar. */}
            <span
              className="h-5 w-5 bg-current"
              style={{
                maskImage: "url(/amor-propio.png)",
                WebkitMaskImage: "url(/amor-propio.png)",
                maskSize: "contain",
                WebkitMaskSize: "contain",
                maskRepeat: "no-repeat",
                WebkitMaskRepeat: "no-repeat",
                maskPosition: "center",
                WebkitMaskPosition: "center",
              }}
            />
          </Button>
        </PopoverTrigger>
      </CustomTooltip>

      <PopoverContent
        align="end"
        className="w-[min(92vw,340px)] rounded-2xl border-slate-100 p-5 shadow-xl dark:border-slate-800"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
          Versículo del día
        </p>
        <p className="mt-2 font-serif text-[15px] italic leading-relaxed text-slate-700 dark:text-slate-200">
          “{verse.text}”
        </p>
        <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
          {verse.reference} · {verse.version}
        </p>
        <button
          type="button"
          onClick={restoreDailyVerse}
          className="mt-3 text-xs font-medium text-primary hover:underline"
        >
          Mostrar en el inicio
        </button>
      </PopoverContent>
    </Popover>
  );
};
