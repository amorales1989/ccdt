import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface EventCalendarProps {
    selectedDate?: Date;
    onDateSelect?: (date: Date) => void;
    onMonthChange?: (date: Date) => void;
    /** Record<"yyyy-MM-dd", any[]> — fechas que tienen eventos */
    eventDates?: Record<string, any[]>;
    /** Render custom content cuando el día tiene eventos (tooltip, etc.) */
    renderDayWithEvents?: (date: Date, events: any[]) => React.ReactNode;
}

export function EventCalendar({
    selectedDate,
    onDateSelect,
    onMonthChange,
    eventDates = {},
    renderDayWithEvents,
}: EventCalendarProps) {
    const [value, setValue] = useState<Date>(selectedDate ?? new Date());

    // Un día se pinta verde si tiene eventos por venir y rojo si todos ya pasaron.
    const conEventos = (date: Date) => eventDates[format(date, "yyyy-MM-dd")];
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const modifiers = {
        conEventos: (date: Date) => !!conEventos(date)?.length,
        eventosPasados: (date: Date) => {
            const ev = conEventos(date);
            return !!ev?.length && ev.every((e: any) => new Date(e.date) < hoy);
        },
    };

    return (
        <Calendar
            mode="single"
            selected={value}
            month={value}
            onMonthChange={(m) => {
                setValue(m);
                onMonthChange?.(m);
            }}
            onSelect={(date) => {
                if (!date) return;
                setValue(date);
                onDateSelect?.(date);
            }}
            locale={es}
            showOutsideDays
            // Mismo criterio que DatePickerField: el encabezado permite saltar de mes/año
            // sin navegar de a uno con las flechas.
            captionLayout="dropdown-buttons"
            fromYear={new Date().getFullYear() - 10}
            toYear={new Date().getFullYear() + 10}
            className="w-full"
            modifiers={modifiers}
            modifiersClassNames={{
                conEventos: "bg-[rgba(242,252,226,1)] text-[#064e3b] font-bold hover:bg-[rgba(224,244,210,1)]",
                eventosPasados: "bg-[rgba(234,56,76,0.12)] text-[#7f1d1d] font-bold hover:bg-[rgba(234,56,76,0.22)]",
            }}
            components={{
                // El contenido extra (HoverCard con los eventos del día) se superpone al número.
                DayContent: ({ date, activeModifiers }) => {
                    const ev = conEventos(date);
                    const mostrar = !activeModifiers.outside && ev?.length && renderDayWithEvents;
                    return (
                        <span className={cn("relative inline-flex h-full w-full items-center justify-center")}>
                            {date.getDate()}
                            {mostrar ? renderDayWithEvents(date, ev) : null}
                        </span>
                    );
                },
            }}
        />
    );
}
