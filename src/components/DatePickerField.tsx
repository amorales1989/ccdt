import * as React from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerFieldProps {
    value?: Date;
    onChange: (date: Date | undefined) => void;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    placeholder?: string;
    className?: string;
    /** Bloquea las fechas posteriores (ej. no permitir fechas futuras). */
    maxDate?: Date;
    /** Bloquea las fechas anteriores (ej. fin de campamento >= inicio). */
    minDate?: Date;
    /** Rango del selector de año. Por defecto cubre desde 1920 (fechas de nacimiento)
     *  hasta 10 años adelante (eventos y campamentos futuros). */
    fromYear?: number;
    toYear?: number;
}

const AÑO_ACTUAL = new Date().getFullYear();

export function DatePickerField({
    value,
    onChange,
    open,
    onOpenChange,
    // Un solo placeholder para toda la app: los 18 campos tenian 7 textos distintos.
    placeholder = "dd/mm/aaaa",
    className,
    maxDate,
    minDate,
    // El encabezado siempre es desplegable: navegar de a un mes hasta 1985 con las
    // flechas es inusable, y era la única forma de elegir el año antes.
    fromYear = 1920,
    toYear = AÑO_ACTUAL + 10,
}: DatePickerFieldProps) {
    return (
        <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    className={cn(
                        "w-full justify-start text-left font-semibold border-none bg-transparent hover:bg-transparent hover:text-primary transition-colors shadow-none px-0 text-slate-700 dark:text-slate-200",
                        className
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4 text-primary shrink-0" />
                    {/* El placeholder va gris suave y sin negrita, para que se distinga de una
                        fecha ya elegida. Se estila acá y no en el botón: ahí el `className` de
                        cada pantalla pisaba el color. */}
                    <span
                        className={cn(
                            "truncate",
                            !value && "font-normal text-slate-400 dark:text-slate-500",
                        )}
                    >
                        {value ? format(value, "dd/MM/yyyy", { locale: es }) : placeholder}
                    </span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 rounded-2xl shadow-2xl border-none" align="start">
                <Calendar
                    mode="single"
                    selected={value}
                    onSelect={(date) => {
                        onChange(date);
                        onOpenChange(false);
                    }}
                    initialFocus
                    locale={es}
                    disabled={
                        maxDate && minDate ? { after: maxDate, before: minDate }
                            : maxDate ? { after: maxDate }
                                : minDate ? { before: minDate }
                                    : undefined
                    }
                    captionLayout="dropdown-buttons"
                    fromYear={fromYear}
                    toYear={toYear}
                    defaultMonth={value ?? maxDate}
                    className="rounded-2xl"
                />
            </PopoverContent>
        </Popover>
    );
}
