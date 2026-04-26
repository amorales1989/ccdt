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
}

export function DatePickerField({
    value,
    onChange,
    open,
    onOpenChange,
    placeholder = "Seleccionar fecha",
    className,
}: DatePickerFieldProps) {
    return (
        <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    className={cn(
                        "w-full justify-start text-left font-semibold border-none bg-transparent hover:bg-transparent hover:text-primary transition-colors shadow-none px-0 text-slate-700 dark:text-slate-200",
                        !value && "text-muted-foreground",
                        className
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4 text-primary shrink-0" />
                    <span className="truncate">
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
                    className="rounded-2xl"
                />
            </PopoverContent>
        </Popover>
    );
}
