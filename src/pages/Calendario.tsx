
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { getEvents } from "@/lib/api";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { format, isBefore, startOfDay, isSameMonth, isAfter, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { CalendarPlus } from "lucide-react";
import { EventForm } from "@/components/EventForm";
import { useToast } from "@/components/ui/use-toast";
import { createEvent, updateEvent } from "@/lib/api";
import type { Event } from "@/types/database";

export default function Calendario() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [currentMonthEvents, setCurrentMonthEvents] = useState<Event[]>([]);
  const { toast } = useToast();

  const { data: events = [], isLoading, refetch } = useQuery({
    queryKey: ['events'],
    queryFn: getEvents
  });

  // Actualizar los eventos del mes cuando cambia el mes o la lista de eventos
  useEffect(() => {
    if (selectedDate && events.length > 0) {
      const filtered = events
        .filter(event => isSameMonth(new Date(event.date), selectedDate))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      setCurrentMonthEvents(filtered);
    }
  }, [selectedDate, events]);

  // Filtrar eventos y crear objeto de fechas
  const eventDates = events.reduce((acc: Record<string, any[]>, event) => {
    const dateStr = format(new Date(event.date), 'yyyy-MM-dd');
    if (!acc[dateStr]) {
      acc[dateStr] = [];
    }
    acc[dateStr].push(event);
    return acc;
  }, {});

  const handleCreateEvent = async (eventData: any) => {
    try {
      if (selectedEvent) {
        await updateEvent(selectedEvent.id, eventData);
        toast({
          title: "Evento actualizado",
          description: "El evento se ha actualizado exitosamente.",
        });
      } else {
        await createEvent(eventData);
        toast({
          title: "Evento creado",
          description: "El evento se ha creado exitosamente.",
        });
      }
      await refetch();
      setDialogOpen(false);
      setSelectedEvent(null);
    } catch (error) {
      toast({
        title: "Error",
        description: selectedEvent 
          ? "No se pudo actualizar el evento." 
          : "No se pudo crear el evento.",
        variant: "destructive",
      });
    }
  };

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
    setDialogOpen(true);
  };

  const modifiers = {
    hasEvent: (date: Date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      return dateStr in eventDates;
    }
  };

  const modifiersStyles = {
    hasEvent: {
      backgroundColor: '#F2FCE2', // Color verde por defecto
      color: '#064e3b',
      fontWeight: 'bold'
    }
  };

  const getEventCardStyle = (eventDate: string) => {
    const now = new Date();
    const date = new Date(eventDate);
    return isAfter(date, now) 
      ? "bg-[#F2FCE2] hover:bg-[#F2FCE2]/80" 
      : "bg-[#ea384c]/10 hover:bg-[#ea384c]/20";
  };

  // Handler para cambios de mes en el calendario
  const handleMonthChange = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Calendario de Eventos</CardTitle>
          <Dialog 
            open={dialogOpen} 
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) setSelectedEvent(null);
            }}
          >
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                <CalendarPlus className="mr-2 h-4 w-4" />
                Agregar Evento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {selectedEvent ? "Editar Evento" : "Crear Nuevo Evento"}
                </DialogTitle>
              </DialogHeader>
              <EventForm 
                onSubmit={handleCreateEvent} 
                initialData={selectedEvent || undefined}
              />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="relative">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                onMonthChange={handleMonthChange}
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

                    // Determinar si todos los eventos del día son pasados
                    const allPastEvents = dayEvents.every(event => 
                      isBefore(new Date(event.date), new Date())
                    );

                    return (
                      <HoverCard>
                        <HoverCardTrigger asChild>
                          <span 
                            className={`cursor-pointer w-full h-full flex items-center justify-center ${
                              allPastEvents ? 'bg-[#ea384c]/10' : 'bg-[#F2FCE2]'
                            }`}
                          >
                            {date.getDate()}
                          </span>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-80">
                          <div className="space-y-2">
                            {dayEvents.map((event) => {
                              const isPastEvent = isBefore(new Date(event.date), new Date());
                              return (
                                <div 
                                  key={event.id} 
                                  className={`p-2 rounded-md cursor-pointer ${
                                    isPastEvent 
                                      ? "bg-[#ea384c]/10 hover:bg-[#ea384c]/20" 
                                      : "bg-[#F2FCE2] hover:bg-[#F2FCE2]/80"
                                  }`}
                                  onClick={() => handleEventClick(event)}
                                >
                                  <h4 className="font-semibold">{event.title}</h4>
                                  <p className="text-sm text-muted-foreground">{event.description}</p>
                                </div>
                              );
                            })}
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    );
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold mb-4">
                Eventos del mes {format(selectedDate || new Date(), 'MMMM yyyy', { locale: es })}
              </h3>
              <div className="space-y-2">
                {currentMonthEvents.length > 0 ? (
                  currentMonthEvents.map((event) => (
                    <div 
                      key={event.id} 
                      className={`flex items-center gap-2 p-2 rounded-md cursor-pointer ${getEventCardStyle(event.date)}`}
                      onClick={() => handleEventClick(event)}
                    >
                      <span className="font-medium">
                        {format(new Date(event.date), 'dd/MM')}
                      </span>
                      <span>{event.title}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground">No hay eventos este mes</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
