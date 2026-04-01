import { useState, useEffect } from "react";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import { Popover, Paper } from "@mui/material";
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
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

    // Usamos un estado interno para el valor para evitar que el calendario se resetee 
    // al mes actual si el componente padre se re-renderiza con el mismo prop.
    const [internalDate, setInternalDate] = useState<Dayjs | null>(value ? dayjs(value) : dayjs());

    // Sincronizar con el prop solo si el prop cambia de verdad (basado en el día)
    useEffect(() => {
        if (value) {
            const newDate = dayjs(value);
            if (!internalDate || !newDate.isSame(internalDate, 'day')) {
                setInternalDate(newDate);
            }
        }
    }, [value]);

    const handleButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(e.currentTarget);
        onOpenChange(true);
    };

    const handleClose = () => {
        onOpenChange(false);
        setAnchorEl(null);
    };

    const handleDateChange = (newValue: Dayjs | null) => {
        if (newValue) {
            setInternalDate(newValue);
            onChange(newValue.toDate());
        }
        handleClose();
    };

    return (
        <>
            <Button
                variant="outline"
                className={cn(
                    "w-full justify-start text-left font-semibold border-none bg-transparent hover:bg-transparent hover:text-primary transition-colors shadow-none px-0 text-slate-700 dark:text-slate-200",
                    !value && "text-muted-foreground",
                    className
                )}
                onClick={handleButtonClick}
            >
                <CalendarIcon className="mr-2 h-4 w-4 text-primary shrink-0" />
                <span className="truncate">
                    {value ? format(value, "dd/MM/yyyy", { locale: es }) : placeholder}
                </span>
            </Button>

            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                transformOrigin={{ vertical: "top", horizontal: "left" }}
                disablePortal={false}
                slotProps={{
                    paper: {
                        sx: {
                            borderRadius: "16px",
                            boxShadow: "0 10px 40px rgba(0,0,0,0.12)",
                            mt: 1,
                            overflow: 'hidden'
                        },
                    },
                }}
            >
                <Paper elevation={0} sx={{ p: 1 }}>
                    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
                        <DateCalendar
                            value={internalDate}
                            onChange={handleDateChange}
                            sx={{
                                "& .MuiPickersDay-root.Mui-selected": {
                                    backgroundColor: "#7c3aed !important",
                                },
                                "& .MuiPickersDay-today": {
                                    borderColor: "#a855f7",
                                    backgroundColor: "rgba(168,85,247,0.08)",
                                },
                                "& .MuiPickersArrowSwitcher-button": {
                                    color: "#7c3aed",
                                },
                                "& .MuiPickersCalendarHeader-label": {
                                    fontFamily: "inherit",
                                    fontWeight: 700,
                                    textTransform: "capitalize",
                                },
                                "& .MuiPickersDay-root": {
                                    fontFamily: "inherit",
                                },
                            }}
                        />
                    </LocalizationProvider>
                </Paper>
            </Popover>
        </>
    );
}
