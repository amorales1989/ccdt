import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Calendar, Clock, Search, Plus, Trash2, Edit2, MoreVertical } from "lucide-react";
import { differenceInDays, startOfToday } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createEvent, updateEvent, deleteEvent } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { EventForm } from "@/components/EventForm";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Event, EventWithBirthday } from "@/types/database";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface CalendarWidgetProps {
  auth: {
    isAdminOrSecretary: boolean;
  };
  data: {
    events: EventWithBirthday[];
    eventsLoading: boolean;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
  };
}

export function CalendarWidget({ auth, data }: CalendarWidgetProps) {
  const { isAdminOrSecretary } = auth;
  const { events, eventsLoading, searchTerm, setSearchTerm } = data;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [selectedEventForEdit, setSelectedEventForEdit] = useState<Event | null>(null);

  const { mutate: createEventMutate } = useMutation({
    mutationFn: (newEvent: Omit<Event, "id" | "created_at" | "updated_at">) => createEvent(newEvent),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({
        title: "Evento creado",
        description: "El evento ha sido creado exitosamente",
      });
      setEventDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Hubo un error al crear el evento",
        variant: "destructive",
      });
    }
  });

  const { mutate: updateEventMutate } = useMutation({
    mutationFn: (event: Event) => {
      if (!event.id) {
        throw new Error("Event ID is required for update operations");
      }
      return updateEvent(event.id, event);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({
        title: "Evento actualizado",
        description: "El evento ha sido actualizado exitosamente",
      });
      setEventDialogOpen(false);
      setSelectedEventForEdit(null);
    },
    onError: (error) => {
      console.error("Error updating event:", error);
      toast({
        title: "Error",
        description: "Hubo un error al actualizar el evento",
        variant: "destructive",
      });
    }
  });

  const { mutate: deleteEventMutate } = useMutation({
    mutationFn: (id: string) => deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({
        title: "Evento eliminado",
        description: "El evento ha sido eliminado exitosamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Hubo un error al eliminar el evento",
        variant: "destructive",
      });
    }
  });

  const handleCreateEvent = (event: Omit<Event, "id" | "created_at" | "updated_at">) => {
    createEventMutate(event);
  };

  const handleUpdateEvent = (event: any) => {
    if (!event.id && selectedEventForEdit) {
      event.id = selectedEventForEdit.id;
    }
    updateEventMutate(event as Event);
  };

  const handleDeleteEvent = (id: string) => {
    deleteEventMutate(id);
  };

  const handleEditEvent = (event: Event) => {
    setSelectedEventForEdit(event);
    setEventDialogOpen(true);
  };

  const renderActionButtons = (event: EventWithBirthday) => {
    if (event.isBirthday || !isAdminOrSecretary) return null;

    if (isMobile) {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover border-border">
            <DropdownMenuItem onClick={() => handleEditEvent(event as Event)}>
              <Edit2 className="mr-2 h-4 w-4 text-primary" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDeleteEvent(event.id)}>
              <Trash2 className="mr-2 h-4 w-4 text-destructive" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    return (
      <div className="flex justify-end space-x-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleEditEvent(event as Event)}
        >
          <Edit2 className="h-4 w-4 text-white" />
          <span className="sr-only">Editar</span>
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => handleDeleteEvent(event.id)}
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Eliminar</span>
        </Button>
      </div>
    );
  };

  return (
    <div className="animate-fade-in delay-200">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 px-2">
        <div className="text-center md:text-left">
          <h2 className="text-3xl font-bold tracking-tight text-primary">
            Calendario de Eventos
          </h2>
          <p className="text-muted-foreground text-sm">Próximas actividades y celebraciones</p>
        </div>

        {isAdminOrSecretary && (
          <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="button-gradient shadow-lg hover:shadow-primary/30 transition-all duration-300"
                onClick={() => setSelectedEventForEdit(null)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Agregar Evento
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-md sm:max-w-md glass-card border-none shadow-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black text-primary">
                  {selectedEventForEdit ? "Editar Evento" : "Agregar Evento"}
                </DialogTitle>
              </DialogHeader>
              <EventForm
                onSubmit={selectedEventForEdit ? handleUpdateEvent : handleCreateEvent}
                initialData={selectedEventForEdit || undefined}
                onSuccess={() => {
                  setEventDialogOpen(false);
                  setSelectedEventForEdit(null);
                }}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="glass-card p-6 mb-8">
        <div className="relative group max-w-2xl">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-primary/40 group-focus-within:text-primary transition-colors" />
          </div>
          <Input
            placeholder="Filtrar por título, descripción o departamento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 py-6 bg-accent/5 dark:bg-accent/10 border-accent/20 focus:bg-background transition-all duration-300 rounded-xl"
          />
        </div>
      </div>

      {eventsLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 glass-card animate-pulse opacity-50"></div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-20 glass-card border-dashed">
          <Calendar className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
          <p className="text-xl font-medium text-muted-foreground">No hay eventos próximos programados</p>
          {isAdminOrSecretary && (
            <p className="text-sm text-muted-foreground mt-2">Usa el botón superior para crear el primero</p>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {events.map((event, index) => {
            const eventDate = new Date(event.date);
            const isToday = differenceInDays(eventDate, startOfToday()) === 0;

            return (
              <div
                key={event.id}
                className="glass-card group flex flex-col md:flex-row items-center p-0 overflow-hidden hover:border-primary/40 transition-all duration-300 animate-slide-in"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {/* Date Side */}
                <div className={`w-full md:w-32 flex flex-row md:flex-col items-center justify-center p-4 gap-2 md:gap-0 ${isToday ? 'bg-primary text-white' : 'bg-primary/5 text-primary'} group-hover:scale-110 transition-transform duration-500 relative`}>
                  <div className="flex flex-row md:flex-col items-center justify-center gap-2 md:gap-0">
                    <span className="text-3xl font-black">
                      {(() => {
                        const parts = event.date.split('T')[0].split('-');
                        return parts[2] || '00';
                      })()}
                    </span>
                    <span className="text-xs uppercase font-bold tracking-widest">
                      {(() => {
                        const parts = event.date.split('T')[0].split('-');
                        if (parts.length === 3) {
                          const monthNames = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
                          return monthNames[parseInt(parts[1]) - 1];
                        }
                        return '---';
                      })()}
                    </span>
                  </div>
                  {/* Actions explicitly for mobile in the date bar */}
                  <div className="md:hidden absolute right-4">
                    {renderActionButtons(event)}
                  </div>
                </div>

                {/* Content Side */}
                <div className="flex-1 p-6 flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2 justify-center md:justify-start">
                      <h3 className="text-xl font-bold text-foreground pr-8 md:pr-0">
                        {event.title}
                      </h3>
                      {event.time && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 font-bold flex items-center gap-1.5 px-3 py-1">
                          <Clock className="h-3.5 w-3.5" />
                          {event.time}
                        </Badge>
                      )}
                      {isToday && (
                        <Badge className="bg-success/10 text-success border-success/20 animate-pulse">HOY</Badge>
                      )}
                    </div>
                    {event.isBirthday ? (
                      <Badge className="bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-300 border-pink-200 dark:border-pink-800/50 font-bold px-3 py-1 mt-1">
                        {event.description}
                      </Badge>
                    ) : (
                      <p className="text-muted-foreground line-clamp-2 text-sm italic">
                        {event.description || "Sin descripción adicional"}
                      </p>
                    )}
                  </div>

                  {/* Actions for desktop on the right */}
                  <div className="hidden md:block">
                    {renderActionButtons(event)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}