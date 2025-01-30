import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { EventForm } from "@/components/EventForm";

interface Event {
  id: number;
  title: string;
  date: string;
  description: string;
}

const Index = () => {
  const [events, setEvents] = useState<Event[]>([
    { 
      id: 1, 
      title: "Encuentro de Adolescentes", 
      date: "2024-03-20", 
      description: "Reunión especial con juegos y alabanzas" 
    },
    { 
      id: 2, 
      title: "Taller de Liderazgo", 
      date: "2024-03-25", 
      description: "Capacitación para líderes juveniles" 
    }
  ]);

  const handleAddEvent = (newEvent: Omit<Event, "id">) => {
    const id = Math.max(0, ...events.map(e => e.id)) + 1;
    setEvents([...events, { ...newEvent, id }]);
  };

  const handleEditEvent = (updatedEvent: Event) => {
    setEvents(events.map(event => 
      event.id === updatedEvent.id ? updatedEvent : event
    ));
  };

  const handleDeleteEvent = (id: number) => {
    setEvents(events.filter(event => event.id !== id));
  };

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
                        <EventForm onSubmit={(updatedEvent) => handleEditEvent({ ...updatedEvent, id: event.id })} initialData={event} />
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