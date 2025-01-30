import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { EventForm } from "@/components/EventForm";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getEvents, createEvent, updateEvent, deleteEvent } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import type { Event } from "@/types/database";

const Index = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch events
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: getEvents
  });

  // Create event mutation
  const createEventMutation = useMutation({
    mutationFn: (newEvent: Omit<Event, "id" | "created_at" | "updated_at">) => createEvent(newEvent),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({
        title: "Evento creado",
        description: "El evento ha sido creado exitosamente"
      });
    },
    onError: (error) => {
      console.error('Error creating event:', error);
      toast({
        title: "Error",
        description: "No se pudo crear el evento",
        variant: "destructive"
      });
    }
  });

  // Update event mutation
  const updateEventMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Event> }) => updateEvent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({
        title: "Evento actualizado",
        description: "El evento ha sido actualizado exitosamente"
      });
    },
    onError: (error) => {
      console.error('Error updating event:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el evento",
        variant: "destructive"
      });
    }
  });

  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({
        title: "Evento eliminado",
        description: "El evento ha sido eliminado exitosamente"
      });
    },
    onError: (error) => {
      console.error('Error deleting event:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el evento",
        variant: "destructive"
      });
    }
  });

  const handleAddEvent = (newEvent: Omit<Event, "id" | "created_at" | "updated_at">) => {
    createEventMutation.mutate(newEvent);
  };

  const handleEditEvent = (event: Event) => {
    const { id, created_at, updated_at, ...updateData } = event;
    updateEventMutation.mutate({ id, data: updateData });
  };

  const handleDeleteEvent = (id: string) => {
    deleteEventMutation.mutate(id);
  };

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center items-center">
        <p>Cargando eventos...</p>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen" style={{ background: "linear-gradient(109.6deg, rgba(223,234,247,1) 11.2%, rgba(244,248,252,1) 91.1%)" }}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Próximos Eventos</CardTitle>
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Evento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nuevo Evento</DialogTitle>
              </DialogHeader>
              <EventForm onSubmit={handleAddEvent} />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {events.map((event) => (
              <Card key={event.id} className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg">{event.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {new Date(event.date).toLocaleDateString()}
                    </p>
                    <p className="mt-2">{event.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Editar Evento</DialogTitle>
                        </DialogHeader>
                        <EventForm 
                          onSubmit={(updatedEvent) => handleEditEvent({ ...updatedEvent, id: event.id, created_at: event.created_at, updated_at: event.updated_at })} 
                          initialData={event} 
                        />
                      </DialogContent>
                    </Dialog>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleDeleteEvent(event.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;