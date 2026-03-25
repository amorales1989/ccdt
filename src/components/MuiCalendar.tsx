import { useState } from "react";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import { PickersDay } from "@mui/x-date-pickers/PickersDay";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/es";

dayjs.locale("es");

interface MuiCalendarProps {
    selectedDate?: Date;
    onDateSelect?: (date: Date) => void;
    onMonthChange?: (date: Date) => void;
    /** Record<"yyyy-MM-dd", any[]> — fechas que tienen eventos */
    eventDates?: Record<string, any[]>;
    /** Render custom content cuando el día tiene eventos (tooltip, etc.) */
    renderDayWithEvents?: (date: Date, events: any[]) => React.ReactNode;
}

function EventDay(props: any) {
    const { day, eventDates, renderDayWithEvents, outsideCurrentMonth, ...other } = props;
    const dateStr = (day as Dayjs).format("YYYY-MM-DD");
    const dayEvents = eventDates?.[dateStr];
    const hasEvents = !outsideCurrentMonth && dayEvents && dayEvents.length > 0;

    const allPast = hasEvents
        ? dayEvents.every((e: any) => dayjs(e.date).isBefore(dayjs(), 'day'))
        : false;

    if (hasEvents && renderDayWithEvents) {
        return (
            <span style={{ position: "relative", display: "inline-flex" }}>
                <PickersDay
                    {...other}
                    outsideCurrentMonth={outsideCurrentMonth}
                    day={day}
                    sx={{
                        backgroundColor: allPast
                            ? "rgba(234,56,76,0.12)"
                            : "rgba(242,252,226,1)",
                        color: allPast ? "#7f1d1d" : "#064e3b",
                        fontWeight: "bold",
                        "&:hover": {
                            backgroundColor: allPast
                                ? "rgba(234,56,76,0.22)"
                                : "rgba(224,244,210,1)",
                        },
                        "&.Mui-selected": {
                            backgroundColor: allPast ? "#ea384c" : "#4ade80",
                            color: "#fff",
                        },
                    }}
                />
                {renderDayWithEvents((day as Dayjs).toDate(), dayEvents)}
            </span>
        );
    }

    return (
        <PickersDay
            {...other}
            outsideCurrentMonth={outsideCurrentMonth}
            day={day}
        />
    );
}

export function MuiCalendar({
    selectedDate,
    onDateSelect,
    onMonthChange,
    eventDates = {},
    renderDayWithEvents,
}: MuiCalendarProps) {
    const [value, setValue] = useState<Dayjs | null>(
        selectedDate ? dayjs(selectedDate) : dayjs()
    );

    const handleChange = (newValue: Dayjs | null) => {
        setValue(newValue);
        if (newValue && onDateSelect) {
            onDateSelect(newValue.toDate());
        }
    };

    const handleMonthChange = (newMonth: Dayjs) => {
        if (onMonthChange) {
            onMonthChange(newMonth.toDate());
        }
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
            <DateCalendar
                value={value}
                onChange={handleChange}
                onMonthChange={handleMonthChange}
                slots={{
                    day: (dayProps) => (
                        <EventDay
                            {...dayProps}
                            eventDates={eventDates}
                            renderDayWithEvents={renderDayWithEvents}
                        />
                    ),
                }}
                sx={{
                    width: "100%",
                    "& .MuiPickersCalendarHeader-root": {
                        paddingLeft: "16px",
                        paddingRight: "8px",
                    },
                    "& .MuiDayCalendar-weekDayLabel": {
                        color: "var(--muted-foreground, #6b7280)",
                        fontFamily: "inherit",
                        fontSize: "0.8rem",
                    },
                    "& .MuiPickersDay-root": {
                        fontFamily: "inherit",
                        fontSize: "0.875rem",
                        borderRadius: "6px",
                    },
                    "& .MuiPickersDay-today": {
                        border: "1px solid #a855f7",
                        backgroundColor: "rgba(168,85,247,0.08)",
                    },
                    "& .MuiPickersDay-root.Mui-selected": {
                        backgroundColor: "#7c3aed",
                        "&:hover": { backgroundColor: "#6d28d9" },
                    },
                    "& .MuiPickersArrowSwitcher-button": {
                        color: "#7c3aed",
                    },
                    "& .MuiPickersCalendarHeader-label": {
                        fontFamily: "inherit",
                        fontWeight: 600,
                        fontSize: "0.95rem",
                        textTransform: "capitalize",
                    },
                }}
            />
        </LocalizationProvider>
    );
}
