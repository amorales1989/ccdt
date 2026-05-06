import { useEffect, useRef, useState } from "react";
import { Clock, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface TimePickerFieldProps {
  label: string;
  value: string; // "HH:mm"
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
  className?: string;
  clearable?: boolean;
  onClear?: () => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

function ScrollColumn({
  items,
  selected,
  onSelect,
}: {
  items: string[];
  selected: string;
  onSelect: (val: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const idx = items.indexOf(selected);
    if (ref.current && idx !== -1) {
      ref.current.scrollTop = idx * 40 - 80;
    }
  }, [selected, items]);

  return (
    <div
      ref={ref}
      className="h-[200px] overflow-y-auto scroll-smooth no-scrollbar"
      style={{ scrollbarWidth: "none" }}
    >
      <div className="py-20">
        {items.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onSelect(item)}
            className={cn(
              "w-full h-10 text-center text-sm font-semibold rounded-lg transition-all",
              item === selected
                ? "bg-primary text-white shadow-sm"
                : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TimePickerField({
  label,
  value,
  onChange,
  required,
  error,
  className,
  clearable,
  onClear,
}: TimePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [hh, mm] = value ? value.split(":") : ["", ""];
  const hour = hh || "08";
  const minute = mm || "00";

  const displayValue = value ? `${hh}:${mm}` : null;

  return (
    <div className={cn("space-y-1", className)}>
      <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className={cn(
                "flex-1 flex items-center gap-2 px-3 h-10 rounded-xl border bg-slate-50 text-sm transition-colors text-left",
                "hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20",
                open ? "border-primary/40 ring-2 ring-primary/20" : "border-slate-200",
                !displayValue && "text-slate-400"
              )}
            >
              <Clock className="h-4 w-4 text-slate-400 shrink-0" />
              <span className={cn("font-medium", displayValue ? "text-slate-800 dark:text-slate-200" : "text-slate-400")}>
                {displayValue || "--:--"}
              </span>
            </button>
            {clearable && displayValue && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onClear?.(); }}
                className="h-10 w-10 flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400 hover:text-red-500 hover:border-red-200 transition-colors shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[160px] p-3" align="start">
          <div className="flex items-center gap-1">
            <div className="flex-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center mb-1">Hora</p>
              <ScrollColumn
                items={HOURS}
                selected={hour}
                onSelect={(h) => { onChange(`${h}:${minute}`); }}
              />
            </div>
            <div className="text-lg font-bold text-slate-400 pb-1 self-center">:</div>
            <div className="flex-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center mb-1">Min</p>
              <ScrollColumn
                items={MINUTES}
                selected={minute}
                onSelect={(m) => { onChange(`${hour}:${m}`); }}
              />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {hour}:{minute}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-bold text-primary hover:underline"
            >
              Listo
            </button>
          </div>
        </PopoverContent>
      </Popover>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
