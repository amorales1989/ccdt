import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { differenceInDays, startOfToday, format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { DeleteConfirmationDialog } from "./DeleteConfirmationDialog";
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDeleteId, setEventToDeleteId] = useState<string | null>(null);

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
    setEventToDeleteId(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (eventToDeleteId) {
      deleteEventMutate(eventToDeleteId);
      setEventToDeleteId(null);
      setDeleteDialogOpen(false);
    }
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
              <MoreVertIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover border-border">
            <DropdownMenuItem onClick={() => handleEditEvent(event as Event)}>
              <EditIcon className="mr-2 h-4 w-4 text-primary/70" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDeleteEvent(event.id)}>
              <DeleteIcon className="mr-2 h-4 w-4 text-destructive/70" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    return (
      <div className="flex justify-end space-x-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-primary/60 hover:text-primary transition-colors"
          onClick={() => handleEditEvent(event as Event)}
        >
          <EditIcon className="h-4 w-4" />
          <span className="sr-only">Editar</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive/60 hover:text-destructive transition-colors"
          onClick={() => handleDeleteEvent(event.id)}
        >
          <DeleteIcon className="h-4 w-4" />
          <span className="sr-only">Eliminar</span>
        </Button>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 dark:border-slate-700 animate-in fade-in slide-in-from-left-4 duration-700 delay-200">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div className="text-center md:text-left">
          <h2 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100 mb-1">
            Próximos Eventos
          </h2>
        </div>

        {isAdminOrSecretary && (
          <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="button-gradient shadow-lg hover:shadow-primary/30 transition-all duration-300"
                onClick={() => setSelectedEventForEdit(null)}
              >
                <AddIcon className="mr-2 h-4 w-4" />
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

      {eventsLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 glass-card animate-pulse opacity-50"></div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-20 glass-card border-dashed">
          <CalendarTodayIcon className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
          <p className="text-xl font-medium text-muted-foreground">No hay eventos próximos programados</p>
          {isAdminOrSecretary && (
            <p className="text-sm text-muted-foreground mt-2">Usa el botón superior para crear el primero</p>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {events.map((event, index) => {
            const todayStr = format(toZonedTime(new Date(), 'America/Argentina/Buenos_Aires'), 'yyyy-MM-dd');
            const isToday = event.date.split('T')[0] === todayStr;

            return (
              <div
                key={event.id}
                className="group flex flex-row items-center p-2 rounded-xl border border-slate-100 dark:border-slate-700/50 bg-white dark:bg-transparent hover:border-slate-200 transition-all duration-300 relative overflow-hidden animate-slide-in"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {/* Date Side */}
                <div className={`w-[4.25rem] h-[4.25rem] shrink-0 flex flex-col items-center justify-center rounded-xl ml-1 ${isToday ? 'bg-indigo-50 text-indigo-600' : 'bg-[#f4f6fa] dark:bg-slate-800/80 text-slate-500'}`}>
                  <span className="text-2xl font-black leading-none tracking-tight">
                    {(() => {
                      const d1 = event.date.split('T')[0];
                      const d2 = event.end_date ? event.end_date.split('T')[0] : null;
                      const p1 = d1.split('-');
                      const day1 = p1[2] || '00';

                      if (d2 && d2 !== d1) {
                        const p2 = d2.split('-');
                        const day2 = p2[2] || '00';
                        if (p1[1] === p2[1]) return `${day1}-${day2}`;
                        return `${day1}+`;
                      }
                      return day1;
                    })()}
                  </span>
                  <span className="text-[9px] uppercase font-bold tracking-widest text-center mt-1">
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

                {/* Content Side */}
                <div className="flex-1 px-4 flex flex-col justify-center min-w-0">
                  <div className="flex flex-wrap items-start gap-2 mb-1">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      {event.title}
                    </h3>
                    {event.time && (
                      <div className="bg-[#f4f6fa] text-slate-500 dark:bg-slate-800 dark:text-slate-400 font-semibold flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] shrink-0">
                        <AccessTimeIcon className="h-3 w-3 opacity-70" />
                        {event.time} {event.end_time ? `- ${event.end_time}` : ''}
                      </div>
                    )}
                    {isToday && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 font-bold uppercase tracking-wider text-[9px] shrink-0">HOY</span>
                    )}
                  </div>

                  {event.isBirthday ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-block bg-pink-50 text-[#ff4b72] font-bold px-2 py-0.5 text-[9px] rounded-full tracking-wide">
                        {event.description}
                      </span>
                      {event.assigned_class && (
                        <span className="inline-block bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 text-[9px] rounded-full tracking-wide">
                          {event.assigned_class}
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-[#8492a6] dark:text-slate-400 text-xs font-medium">
                      {event.description || "Sin descripción adicional"}
                    </p>
                  )}
                </div>

                {/* Actions on the right */}
                <div className="pr-2 shrink-0">
                  {renderActionButtons(event)}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {isAdminOrSecretary && (
        <DeleteConfirmationDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={confirmDelete}
          title="¿Eliminar este evento?"
          description="Esta acción eliminará el evento de forma permanente y no se puede deshacer."
        />
      )}
    </div>
  );
}