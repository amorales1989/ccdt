import { useState, useEffect } from "react";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/es";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";

dayjs.locale("es");

interface MuiDatePickerFieldProps {
    value?: Date;
    onChange: (date: Date | undefined) => void;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    placeholder?: string;
    className?: string;
}

export function MuiDatePickerField({
    value,
    onChange,
    open,
    onOpenChange,
    placeholder = "Seleccionar fecha",
    className,
}: MuiDatePickerFieldProps) {
    const [internalDate, setInternalDate] = useState<Dayjs | null>(value ? dayjs(value) : null);

    useEffect(() => {
        if (value) {
            const newDate = dayjs(value);
            if (!internalDate || !newDate.isSame(internalDate, 'day')) {
                setInternalDate(newDate);
            }
        } else if (value === undefined && internalDate !== null) {
            setInternalDate(null);
        }
    }, [value]);

    const handleDateChange = (newValue: Dayjs | null) => {
        setInternalDate(newValue);
        if (newValue) {
            onChange(newValue.toDate());
        } else {
            onChange(undefined);
        }
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
            <DatePicker
                open={open}
                onOpen={() => onOpenChange(true)}
                onClose={() => onOpenChange(false)}
                value={internalDate}
                onChange={handleDateChange}
                format="DD/MM/YYYY"
                slotProps={{
                    popper: {
                        sx: {
                            zIndex: 99999, // Super alto para estar sobre cualquier diálogo
                            "& .MuiPaper-root": {
                                borderRadius: "16px",
                                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                                border: "1px solid rgba(0, 0, 0, 0.05)",
                            },
                            "& .MuiYearCalendar-root": {
                                maxHeight: "300px",
                                overflowY: "auto !important",
                                touchAction: "pan-y !important",
                            }
                        }
                    },
                    dialog: {
                        sx: {
                            zIndex: 99999,
                        }
                    },
                    mobilePaper: {
                        sx: {
                            borderRadius: "24px 24px 0 0",
                            "& .MuiYearCalendar-root": {
                                maxHeight: "300px",
                                overflowY: "auto !important",
                                touchAction: "pan-y !important",
                            }
                        }
                    },
                    calendarHeader: {
                        sx: {
                            "& .MuiPickersCalendarHeader-label": {
                                fontWeight: 'bold',
                                textTransform: 'capitalize'
                            }
                        }
                    }
                }}
                slots={{
                    field: () => (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(true)}
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
                    )
                }}
            />
        </LocalizationProvider>
    );
}
