
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EventForm } from "@/components/EventForm";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getEvents, createEvent, updateEvent, deleteEvent, getStudents } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import type { Event } from "@/types/database";

const Index = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  // Fetch events
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['events'],
    queryFn: getEvents
  });

  // Fetch students for statistics
  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ['students'],
    queryFn: getStudents
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

  type Department = "niños" | "adolescentes" | "jovenes" | "adultos";
  const departments: Department[] = ["niños", "adolescentes", "jovenes", "adultos"];

  const renderStudentStats = () => {
    if (!profile) return null;

    const isAdminOrSecretary = ["admin", "secretaria"].includes(profile.role);
    const userDepartments = profile.departments || [];

    // Group students by department
    const studentsByDepartment = departments.reduce((acc, dept) => {
      // Solo procesar departamentos relevantes para el usuario
      if (!isAdminOrSecretary && !userDepartments.includes(dept as Department)) {
        return acc;
      }

      const deptStudents = students.filter(s => s.department === dept);
      acc[dept] = {
        male: deptStudents.filter(s => s.gender === "masculino").length,
        female: deptStudents.filter(s => s.gender === "femenino").length,
        total: deptStudents.length
      };
      return acc;
    }, {} as Record<Department, { male: number; female: number; total: number }>);

    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Estadísticas de Alumnos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {departments.map(dept => {
              // Solo mostrar departamentos relevantes para el usuario
              if (!isAdminOrSecretary && !userDepartments.includes(dept as Department)) {
                return null;
              }

              const stats = studentsByDepartment[dept] || { male: 0, female: 0, total: 0 };
              return (
                <Card key={dept} className="p-4">
                  <h3 className="font-semibold text-lg capitalize mb-2">{dept}</h3>
                  <div className="space-y-2">
                    <p>Varones: {stats.male}</p>
                    <p>Mujeres: {stats.female}</p>
                    <p className="font-semibold">Total: {stats.total}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  };

  const canManageEvents = profile?.role === 'admin' || profile?.role === 'secretaria';

  if (eventsLoading || studentsLoading) {
    return (
      <div className="p-6 flex justify-center items-center">
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen" style={{ background: "linear-gradient(109.6deg, rgba(223,234,247,1) 11.2%, rgba(244,248,252,1) 91.1%)" }}>
      {renderStudentStats()}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Próximos Eventos</CardTitle>
          {canManageEvents && (
            <Dialog>
              <DialogTrigger asChild>
                <Button size="icon" className="rounded-full w-10 h-10">
                  <Plus className="h-5 w-5" />
                  <span className="sr-only">Nuevo Evento</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Crear Nuevo Evento</DialogTitle>
                </DialogHeader>
                <EventForm onSubmit={handleAddEvent} />
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {events.map((event) => (
              <Card key={event.id} className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg">{event.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(event.date), "dd/MM/yyyy")}
                    </p>
                    <p className="mt-2">{event.description}</p>
                  </div>
                  {canManageEvents && (
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
                  )}
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
