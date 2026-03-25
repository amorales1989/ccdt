import { useState } from "react";
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
    label?: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    placeholder?: string;
    className?: string;
    disabled?: Date;
}

export function MuiDatePickerField({
    value,
    onChange,
    label,
    open,
    onOpenChange,
    placeholder = "Seleccionar fecha",
    className,
}: MuiDatePickerFieldProps) {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

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
            onChange(newValue.toDate());
        }
        handleClose();
    };

    return (
        <>
            <Button
                variant="outline"
                className={cn("w-full justify-start text-left font-normal", !value && "text-muted-foreground", className)}
                onClick={handleButtonClick}
            >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {value ? format(value, "dd/MM/yyyy", { locale: es }) : placeholder}
            </Button>

            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                transformOrigin={{ vertical: "top", horizontal: "left" }}
                slotProps={{
                    paper: {
                        sx: {
                            borderRadius: "12px",
                            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
                            mt: 0.5,
                        },
                    },
                }}
            >
                <Paper elevation={0}>
                    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
                        <DateCalendar
                            value={value ? dayjs(value) : null}
                            onChange={handleDateChange}
                            sx={{
                                "& .MuiPickersDay-root.Mui-selected": {
                                    backgroundColor: "#7c3aed",
                                    "&:hover": { backgroundColor: "#6d28d9" },
                                },
                                "& .MuiPickersDay-today": {
                                    border: "1px solid #a855f7",
                                    backgroundColor: "rgba(168,85,247,0.08)",
                                },
                                "& .MuiPickersArrowSwitcher-button": {
                                    color: "#7c3aed",
                                },
                                "& .MuiPickersCalendarHeader-label": {
                                    fontFamily: "inherit",
                                    fontWeight: 600,
                                    textTransform: "capitalize",
                                },
                                "& .MuiDayCalendar-weekDayLabel": {
                                    fontFamily: "inherit",
                                },
                                "& .MuiPickersDay-root": {
                                    fontFamily: "inherit",
                                    borderRadius: "6px",
                                },
                            }}
                        />
                    </LocalizationProvider>
                </Paper>
            </Popover>
        </>
    );
}
