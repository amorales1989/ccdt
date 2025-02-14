
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { getEvents } from "@/lib/api";
import { useState } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function Calendario() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: getEvents
  });

  // Crear un objeto con las fechas que tienen eventos
  const eventDates = events.reduce((acc: Record<string, any[]>, event) => {
    const dateStr = format(new Date(event.date), 'yyyy-MM-dd');
    if (!acc[dateStr]) {
      acc[dateStr] = [];
    }
    acc[dateStr].push(event);
    return acc;
  }, {});

  const modifiers = {
    hasEvent: (date: Date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      return dateStr in eventDates;
    }
  };

  const modifiersStyles = {
    hasEvent: {
      backgroundColor: '#e9d5ff',
      color: '#000',
      fontWeight: 'bold'
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p>Cargando calendario...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Calendario de Eventos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center">
          <div className="relative w-full max-w-3xl">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border w-full"
              locale={es}
              modifiers={modifiers}
              modifiersStyles={modifiersStyles}
              components={{
                DayContent: ({ date }) => {
                  const dateStr = format(date, 'yyyy-MM-dd');
                  const dayEvents = eventDates[dateStr];

                  if (!dayEvents) {
                    return <span>{date.getDate()}</span>;
                  }

                  return (
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <span className="cursor-pointer w-full h-full flex items-center justify-center">
                          {date.getDate()}
                        </span>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-80">
                        <div className="space-y-2">
                          {dayEvents.map((event) => (
                            <div key={event.id} className="p-2 rounded-md bg-accent/50">
                              <h4 className="font-semibold">{event.title}</h4>
                              <p className="text-sm text-muted-foreground">{event.description}</p>
                            </div>
                          ))}
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  );
                }
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
